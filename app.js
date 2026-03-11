import { analyzeANC, auditSideEffects } from './clinical.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const LS_KEY = "labnotes_records_v1";
const LS_THEME = "labnotes_theme";

const state = {
  catalog: null,
  records: [],
  selected: null,
  editingId: null,
  new: {
    selectedPanels: new Set()
  },
  filters: {
    search: ""
  }
};

const CONVERSIONS = {
  glucose_fasting: { factor: 1 / 18.01, unit: "mmol/L" },
  creatinine: { factor: 88.4, unit: "µmol/L" },
  bun: { factor: 1 / 2.8, unit: "mmol/L" },
  chol_total: { factor: 1 / 38.67, unit: "mmol/L" },
  ldl: { factor: 1 / 38.67, unit: "mmol/L" },
  hdl: { factor: 1 / 38.67, unit: "mmol/L" },
  triglycerides: { factor: 1 / 88.57, unit: "mmol/L" },
  bili_total: { factor: 17.1, unit: "µmol/L" },
  bili_direct: { factor: 17.1, unit: "µmol/L" }
};

/* ---------- helpers ---------- */
function localISODate() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function sanitize(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function getActualValue(v, mod) {
  if (v === "" || v === undefined) return undefined;
  return mod === "x10^3" ? Number(v) * 1000 : Number(v);
}

function updateModDisplay(el) {
  const w = el.closest(".num-with-mod");
  if (w) w.classList.toggle("active-mod", w.querySelector("input[type=checkbox]").checked);
}

function updateConversionHint(id, val, aid) {
  const hintEl = $(`#hint_${id.replace(/\./g, '\\.')}`);
  if (!hintEl || !CONVERSIONS[aid]) return;
  const num = Number(val);
  if (!val || isNaN(num)) {
    hintEl.textContent = "";
    return;
  }
  const conv = CONVERSIONS[aid];
  const res = num * conv.factor;
  hintEl.textContent = `≈ ${res.toFixed(2)} ${conv.unit}`;
}

function calcAbsolute(aid, pctValue) {
  const wbcRaw = Number($("#in_wbc")?.value);
  const wbcMod = $("#mod_wbc")?.checked ? 1000 : 1;
  const wbc = wbcRaw * wbcMod; // e.g. 6.5 × 1000 = 6500 if modifier active
  if (!wbc || isNaN(wbc) || !pctValue) return;
  const pct = Number(pctValue);
  const absEl = $(`#in_${aid}`);
  if (absEl && !isNaN(pct)) {
    const res = wbc * (pct / 100);
    absEl.value = res.toFixed(2); // Keep 2 decimals for clarity
    updateConversionHint(`in_${aid}`, absEl.value, aid);
  }
}

/* ---------- theme ---------- */
function initTheme() {
  const saved = localStorage.getItem(LS_THEME) || "dark";
  document.body.dataset.theme = saved;
}

function toggleTheme() {
  const current = document.body.dataset.theme === "light" ? "dark" : "light";
  document.body.dataset.theme = current;
  localStorage.setItem(LS_THEME, current);
}

/* ---------- OmniSearch data cache ---------- */
const omniCache = { topics: [], resources: [] };

async function initOmniSearch() {
  try {
    const [manifest, index] = await Promise.all([
      fetch("manual/dataset/manifest.json").then(r => r.json()).catch(() => ({ topics: [] })),
      fetch("manual/dataset/printables/generated_index.json").then(r => r.json()).catch(() => ({ printables: [] }))
    ]);
    omniCache.topics = manifest.topics || [];
    omniCache.resources = index.printables || [];
  } catch(e) { /* offline – search still works for records */ }
}

function runOmniSearch(query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const records = state.records
    .filter(r => r.date.includes(q) || (r.context||'').toLowerCase().includes(q) || (r.labName||'').toLowerCase().includes(q))
    .slice(0, 5)
    .map(r => ({
      icon: r.isClozapine ? '🩺' : '🧪',
      title: `${r.date} · ${r.context || 'Sin contexto'}`,
      sub: r.isClozapine ? 'Clozapina' : 'Registro',
      action: () => openDetail(r.id)
    }));

  const topics = omniCache.topics
    .filter(t => t.title.toLowerCase().includes(q) || (t.tags||[]).some(tag => tag.toLowerCase().includes(q)))
    .slice(0, 4)
    .map(t => ({
      icon: '📖',
      title: t.title,
      sub: 'Protocolo clínico',
      action: () => openManualTopic(t.id)
    }));

  const resources = omniCache.resources
    .filter(p => p.title.toLowerCase().includes(q))
    .slice(0, 4)
    .map(p => ({
      icon: '🗂️',
      title: p.title,
      sub: p.template === 'pdf' ? 'PDF' : 'Infografía',
      action: () => openManualResource(p.id)
    }));

  return { records, topics, resources };
}

function renderOmniResults(results) {
  const el = $('#omniResults');
  if (!results) { el.classList.add('hidden'); return; }
  const { records, topics, resources } = results;
  const total = records.length + topics.length + resources.length;
  if (total === 0) {
    el.innerHTML = '<div class="omni-no-results">Sin resultados — intenta otra búsqueda</div>';
    el.classList.remove('hidden');
    return;
  }

  let html = '';
  if (records.length) {
    html += '<div class="omni-section-header">🧪 Registros</div>';
    records.forEach((r, i) => { html += omniItem(r, i, 'rec'); });
  }
  if (topics.length) {
    html += '<div class="omni-section-header">📖 Protocolos</div>';
    topics.forEach((r, i) => { html += omniItem(r, i, 'top'); });
  }
  if (resources.length) {
    html += '<div class="omni-section-header">🗂️ Recursos</div>';
    resources.forEach((r, i) => { html += omniItem(r, i, 'res'); });
  }
  el.innerHTML = html;
  el.classList.remove('hidden');
  // Wire up clicks
  el.querySelectorAll('.omni-result').forEach(item => {
    item.addEventListener('click', () => {
      const bucket = item.dataset.bucket;
      const idx = parseInt(item.dataset.idx);
      const map = { rec: results.records, top: results.topics, res: results.resources };
      map[bucket][idx].action();
      closeOmni();
    });
  });
}

function omniItem(r, idx, bucket) {
  return `<div class="omni-result" data-bucket="${bucket}" data-idx="${idx}">
    <span class="omni-result-icon">${r.icon}</span>
    <div class="omni-result-text">
      <div class="omni-result-title">${sanitize(r.title)}</div>
      <div class="omni-result-sub">${r.sub}</div>
    </div>
  </div>`;
}

function closeOmni() {
  $('#omniResults').classList.add('hidden');
  $('#omniClear').classList.add('hidden');
  $('#omniInput').value = '';
}

function openManualTopic(id) {
  showTab('manual');
  const iframe = $('#manualFrame');
  if (iframe) {
    const navigate = () => iframe.contentWindow?.postMessage({ action: 'navigate', view: 'topic', id }, '*');
    if (iframe.dataset.loaded) navigate();
    else { iframe.onload = () => { iframe.dataset.loaded = '1'; setTimeout(navigate, 300); }; }
  }
}

function openManualResource(id) {
  showTab('manual');
  const iframe = $('#manualFrame');
  if (iframe) {
    const navigate = () => iframe.contentWindow?.postMessage({ action: 'navigate', view: 'print', id }, '*');
    if (iframe.dataset.loaded) navigate();
    else { iframe.onload = () => { iframe.dataset.loaded = '1'; setTimeout(navigate, 300); }; }
  }
}

function openManualClzProtocol() {
  openManualTopic('psych_clozapine_cigh');
}

/* ---------- init ---------- */
window.onload = async () => {
  initTheme();
  const catalog = await fetch("lab_catalog.json").then(r => r.json());

  // Resolve analytes_refs in panels
  const allAnalytes = {};
  catalog.panels.forEach(p => {
    p.analytes.forEach(a => {
      if (!allAnalytes[a.analyte_id]) allAnalytes[a.analyte_id] = a;
    });
  });

  catalog.panels.forEach(p => {
    if (p.analytes_refs && (!p.analytes || p.analytes.length === 0)) {
      p.analytes = p.analytes_refs
        .map(id => allAnalytes[id])
        .filter(Boolean);
    }
  });

  state.catalog = catalog;
  const saved = localStorage.getItem(LS_KEY);
  state.records = saved ? JSON.parse(saved).records : [];
  $("#nrDate").value = localISODate();
  initUI();
  initOmniSearch();
  renderTabContent('lab');
};

/* ---------- UI ---------- */
function initUI() {
  // Back buttons
  $("#btnBackFromNew").onclick     = () => showCurrentTab();
  $("#btnBackFromDetail").onclick  = () => showCurrentTab();
  $("#btnBackFromExport").onclick  = () => show("#viewDetail");
  $("#btnBackFromSettings").onclick = () => showCurrentTab();

  // Step navigation
  $("#btnNext1").onclick = () => goToStep(2);
  $("#btnPrev2").onclick = () => goToStep(1);
  $("#btnNext2").onclick = () => {
    if (!state.new.selectedPanels.size) { alert("Seleccione al menos un estudio"); return; }
    goToStep(3);
  };
  $("#btnPrev3").onclick = () => goToStep(2);

  // Action buttons
  $("#btnTheme").onclick    = toggleTheme;
  $("#btnSettings").onclick = () => show("#viewSettings");
  $("#btnSaveRecord").onclick  = saveNewRecord;
  $("#btnExport").onclick      = openExport;
  $("#btnEditRecord").onclick  = () => openNew(state.selected?.id);
  $("#btnCopyExport").onclick  = () => navigator.clipboard.writeText($("#exportText").value);
  $("#btnReset").onclick       = () => { if (confirm("¿Borrar todo?")) { state.records = []; persist(); renderTabContent(state.currentTab || 'lab'); } };
  $("#btnExportAll").onclick   = exportAll;

  // Inputs
  $("#nrPanelSearch").oninput = (e) => renderPanelSelection(e.target.value.toLowerCase());
  $("#trendMetric").onchange  = renderTrends;
  $("#inputImport").onchange  = importJSON;

  $("#btnClearPanels").onclick = () => {
    state.new.selectedPanels.clear();
    $$(`.pill`).forEach(p => p.classList.remove("active"));
    renderCapture();
    renderPanelSelection();
  };

  // OmniSearch
  const omniInput = $("#omniInput");
  const omniClear = $("#omniClear");
  let omniTimer;
  omniInput.oninput = (e) => {
    clearTimeout(omniTimer);
    const q = e.target.value.trim();
    omniClear.classList.toggle('hidden', !q);
    if (!q) { $("#omniResults").classList.add('hidden'); return; }
    omniTimer = setTimeout(() => renderOmniResults(runOmniSearch(q)), 180);
  };
  omniClear.onclick = closeOmni;
  document.addEventListener('click', (e) => {
    if (!$("#omniSearchWrap").contains(e.target)) $("#omniResults").classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOmni(); });

  renderPanelSelection();
}

/* ---------- tab management ---------- */
state.currentTab = 'lab';

function showTab(tab) {
  state.currentTab = tab;

  // Hide all in-container tab sections
  $$('.tab-section').forEach(s => s.classList.add('hidden'));

  // Handle manual tab separately (it's fixed-position, outside .container)
  const manualEl = $('#tabManual');
  if (tab === 'manual') {
    if (manualEl) manualEl.classList.remove('hidden');
  } else {
    if (manualEl) manualEl.classList.add('hidden');
    // Show the correct in-container tab
    const el = $(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (el) { el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  }

  // Update bottom nav active state
  $$('.nav-item').forEach(ni => {
    ni.classList.toggle('active', ni.dataset.tab === tab);
  });

  // Show/hide FAB (not on manual tab)
  const fab = $('#fabNew');
  if (fab) fab.classList.toggle('hidden', tab === 'manual');

  // Render the correct content
  renderTabContent(tab);

  // Hide any open views when switching tabs
  $$('.view').forEach(v => v.classList.add('hidden'));
}

function showCurrentTab() {
  // Hide views and return to current tab
  $$('.view').forEach(v => v.classList.add('hidden'));
  showTab(state.currentTab || 'lab');
}

function renderTabContent(tab) {
  if (tab === 'lab') renderDashboard();
  else if (tab === 'cloz') renderClozapineTab();
  // 'manual' tab renders via iframe — no action needed
}

/* ---------- Clozapine tab ---------- */
function renderClozapineTab() {
  const clzRecords = state.records
    .filter(r => r.isClozapine)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Stats: latest ANC, latest WBC
  const statsEl = $('#clzStats');
  const latestWithData = clzRecords.find(r => r.data?.anc !== undefined || r.data?.wbc !== undefined);
  if (latestWithData) {
    statsEl.classList.remove('hidden');
    statsEl.innerHTML = [
      latestWithData.data?.anc !== undefined ? `<div class="clz-stat-chip"><span class="clz-stat-value">${latestWithData.data.anc}</span><div class="clz-stat-label">ANC último</div></div>` : '',
      latestWithData.data?.wbc !== undefined ? `<div class="clz-stat-chip"><span class="clz-stat-value">${latestWithData.data.wbc}</span><div class="clz-stat-label">WBC último</div></div>` : '',
      `<div class="clz-stat-chip"><span class="clz-stat-value">${clzRecords.length}</span><div class="clz-stat-label">Registros CLZ</div></div>`
    ].join('');
  } else if (clzRecords.length > 0) {
    statsEl.classList.remove('hidden');
    statsEl.innerHTML = `<div class="clz-stat-chip"><span class="clz-stat-value">${clzRecords.length}</span><div class="clz-stat-label">Registros CLZ</div></div>`;
  } else {
    statsEl.classList.add('hidden');
  }

  const listEl = $('#clzRecordsList');
  listEl.innerHTML = '';

  if (!clzRecords.length) {
    $('#clzEmpty').classList.remove('hidden');
    $('#clzTrendCard').classList.add('hidden');
    return;
  }
  $('#clzEmpty').classList.add('hidden');

  clzRecords.forEach(r => {
    const c = createRecordCard(r);
    listEl.appendChild(c);
  });

  // Render CLZ ANC trend
  const ancData = clzRecords.filter(r => r.data?.anc !== undefined).slice(0, 10).reverse();
  if (ancData.length >= 2) {
    $('#clzTrendCard').classList.remove('hidden');
    drawTrendChart($('#clzTrendChart'), ancData, 'anc');
  } else {
    $('#clzTrendCard').classList.add('hidden');
  }
}

function show(id) {
  // Show a full-page view (overlays on top of tabs)
  $$('.view').forEach(v => v.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function renderPanelSelection(filter = "") {
  const p = $("#nrPanels");
  p.innerHTML = "";
  state.catalog.panels.forEach(panel => {
    if (filter && !panel.name.toLowerCase().includes(filter)) return;
    const b = document.createElement("button");
    b.className = "pill" + (state.new.selectedPanels.has(panel.panel_id) ? " active" : "");
    b.textContent = panel.name;
    b.onclick = () => {
      state.new.selectedPanels.has(panel.panel_id)
        ? state.new.selectedPanels.delete(panel.panel_id)
        : state.new.selectedPanels.add(panel.panel_id);
      b.classList.toggle("active");
      renderCapture();
    };
    p.appendChild(b);
  });
}

function goToStep(s) {
  $$(".step").forEach(el => el.classList.add("hidden"));
  $(`#nrStep${s}`).classList.remove("hidden");
  const titles = ["", "Información", "Estudios", "Captura"];
  $("#nrTitle").textContent = `${titles[s]}`;
  // Update stepper dots
  $$(".step-dot").forEach(dot => {
    const n = parseInt(dot.dataset.step);
    dot.classList.toggle("active", n === s);
    dot.classList.toggle("done", n < s);
  });
  if (s === 3) {
    if ($("#nrClozapine").checked) $("#clozTriage").classList.remove("hidden");
    else $("#clozTriage").classList.add("hidden");
    renderCapture();
  }
}

function toggleClozapineFields() {
  const habits = $("#clozHabits");
  if ($("#nrClozapine").checked) habits.classList.remove("hidden");
  else habits.classList.add("hidden");
}

/* ---------- shared record card builder ---------- */
function createRecordCard(r) {
  const c = document.createElement("div");
  c.className = "record-card";
  if (r.isClozapine) c.classList.add("clz-border");

  // Build badges
  let badgesHtml = "";
  if (r.isClozapine) badgesHtml += '<span class="badge clz">CLOZAPINA</span> ';
  if (r.eval && r.eval.alerts.some(a => a.type === "critical" || a.type === "danger")) {
    badgesHtml += '<span class="badge danger">⚠ CRÍTICO</span> ';
  } else if (r.eval && r.eval.alerts.length > 0) {
    badgesHtml += `<span class="badge warn">${r.eval.alerts.length} alertas</span> `;
  }

  // Clinical snippets
  let clinicalSnippets = "";
  if (r.data && (r.data.anc !== undefined || r.data.wbc !== undefined)) {
    clinicalSnippets = `
      <div style="display:flex; gap:12px; margin-top:8px; font-family:var(--font-mono); font-size:12px; color:var(--m3-on-surface-variant);">
        ${r.data.anc !== undefined ? `<span>ANC: <b style="color:var(--m3-on-surface)">${r.data.anc}</b></span>` : ""}
        ${r.data.wbc !== undefined ? `<span>WBC: <b style="color:var(--m3-on-surface)">${r.data.wbc}</b></span>` : ""}
        ${r.data.plt !== undefined ? `<span>PLT: <b style="color:var(--m3-on-surface)">${r.data.plt}</b></span>` : ""}
      </div>`;
  }

  // Triage alert
  let triageAlert = "";
  if (r.isClozapine && r.clinical?.triage) {
    if (r.clinical.triage.fever || r.clinical.triage.chestPain) {
      triageAlert = '<div class="badge danger" style="margin-top:6px;">⚠ FIEBRE / DOLOR TORÁCICO</div>';
    }
  }

  c.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
          <span style="font-weight:600; font-size:15px;">${r.date}</span>
          <span style="font-size:13px; color:var(--m3-on-surface-variant);">${sanitize(r.context || "Sin contexto")}</span>
          ${r.labName ? `<span style="font-size:11px; color:var(--m3-outline);">· ${sanitize(r.labName)}</span>` : ""}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">${badgesHtml}</div>
        ${clinicalSnippets}
        ${triageAlert}
      </div>
      <button class="btn btn-text" style="min-width:32px; padding:0; height:32px; border-radius:50%; flex-shrink:0;"
        onclick="event.stopPropagation(); deleteRecord('${r.id}')" title="Eliminar">✕</button>
    </div>`;
  c.onclick = () => openDetail(r.id);
  return c;
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const l = $("#recordsList");
  l.innerHTML = "";

  const filtered = state.records
    .filter(r => {
      const s = state.filters.search;
      if (!s) return true;
      return r.date.includes(s) ||
        (r.context && r.context.toLowerCase().includes(s)) ||
        (r.labName && r.labName.toLowerCase().includes(s));
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const emptyEl = $("#emptyState");
  if (!filtered.length) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  filtered.forEach(r => {
    l.appendChild(createRecordCard(r));
  });

  renderTrends();
}

/**
 * Renders a simple line chart on the canvas for the selected metric
 */
function drawChart(canvas, dataPoints, metric) {
  const ctx = canvas.getContext("2d");
  canvas.width  = canvas.offsetWidth * 2;
  canvas.height = 400;
  ctx.scale(2, 2);
  const sw = canvas.offsetWidth;
  const sh = 200;
  ctx.clearRect(0, 0, sw, sh);

  const values = dataPoints.map(p => p.data[metric]);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const range = max - min || 1;

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = sh - (sh * (i / 4));
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(sw - 10, y); ctx.stroke();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  dataPoints.forEach((p, i) => {
    const x = 40 + (i * (sw - 60) / (dataPoints.length - 1));
    const y = sh - 30 - ((p.data[metric] - min) / range) * (sh - 60);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points & Labels
  dataPoints.forEach((p, i) => {
    const x = 40 + (i * (sw - 60) / (dataPoints.length - 1));
    const y = sh - 30 - ((p.data[metric] - min) / range) * (sh - 60);
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "10px Inter";
    ctx.fillText(p.date.slice(5), x - 12, sh - 5);
    ctx.fillText(p.data[metric].toString(), x - 10, y - 10);
  });
}

function renderTrends() {
  const metric = $("#trendMetric").value;
  const canvas = $("#trendChart");
  const card   = $("#trendsCard");

  const dataPoints = state.records
    .filter(r => r.data && r.data[metric] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  if (dataPoints.length < 2) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  drawChart(canvas, dataPoints, metric);
}

function deleteRecord(id) {
  if (confirm("¿Eliminar este registro?")) {
    state.records = state.records.filter(x => x.id !== id);
    persist();
    renderDashboard();
  }
}

/* ---------- new ---------- */
function openNew(id = null) {
  if (id && typeof id !== "string" && typeof id !== "number") id = null;
  state.editingId = id;
  state.new.selectedPanels.clear();
  $("#nrPanelSearch").value = "";
  
  if (id) {
    const r = state.records.find(x => x.id === id);
    $("#nrDate").value = r.date;
    $("#nrSex").value = r.sex;
    $("#nrContext").value = r.context;
    $("#nrLabName").value = r.labName;
    $("#nrClozapine").checked = r.isClozapine;
    $("#nrBEN").checked = r.isBEN;
    
    // Select panels
    r.panels.forEach(p => state.new.selectedPanels.add(p.panel_id));
    
    // Wait for step change to populate triage (DOM needs to be visible)
    setTimeout(() => {
      if (r.clinical?.triage) {
        $("#nrConstipation").value = r.clinical.triage.constipation;
        $("#nrSomnolence").value = r.clinical.triage.somnolence;
        $("#nrFever").checked = r.clinical.triage.fever;
        $("#nrChestPain").checked = r.clinical.triage.chestPain;
        $("#nrClinicalNotes").value = r.clinical.triage.notes;
        // Update range outputs
        $$("output").forEach(o => o.value = o.previousElementSibling.value);
      }
      // Fill analyte inputs
      r.panels.forEach(p => {
        p.results.forEach(res => {
          const el = $(`#in_${res.analyte_id}`);
          if (el) el.value = res.value;
          const modEl = $(`#mod_${res.analyte_id}`);
          if (modEl) {
            modEl.checked = !!res.modifier;
            updateModDisplay(modEl);
          }
        });
      });
    }, 100);
  } else {
    $("#nrClozapine").checked = false;
    $("#nrDate").value = localISODate();
    $("#nrContext").value = "";
    $("#nrLabName").value = "";
    $("#nrFever").checked = false;
    $("#nrChestPain").checked = false;
    $("#nrClinicalNotes").value = "";
  }

  toggleClozapineFields();
  renderPanelSelection();
  goToStep(1);
  show("#viewNew");
}

function renderCapture() {
  const a = $("#nrCaptureArea");
  a.innerHTML = "";
  const rendered = new Set();

  state.new.selectedPanels.forEach(pid => {
    const p = state.catalog.panels.find(x => x.panel_id === pid);
    const analytesToRender = p.analytes.filter(an => !rendered.has(an.analyte_id));
    if (analytesToRender.length === 0) return;

    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<h3>${p.name}</h3>`;

      analytesToRender.forEach(an => {
        rendered.add(an.analyte_id);
        const mod = ["wbc", "anc", "alc", "plt", "mono_abs", "baso_abs", "eos_abs"].includes(an.analyte_id);
        const isBHCalc = ["anc", "alc", "mono_abs", "baso_abs", "eos_abs"].includes(an.analyte_id);
        
        const r = document.createElement("div");
        r.className = "analyte-grid";

        let inputHtml = "";
        const inputId = `in_${an.analyte_id}`;

        if (an.units === "qual") {
          inputHtml = `
            <select id="${inputId}">
               <option value="">--</option>
               <option value="negativo">Negativo</option>
               <option value="positivo">Positivo</option>
               <option value="traza">Traza</option>
            </select>`;
        } else if (an.units === "text") {
          inputHtml = `<input id="${inputId}" type="text" placeholder="Observación">`;
        } else {
          inputHtml = `
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div class="${mod ? 'num-with-mod' : ''}">
                <input id="${inputId}" class="font-mono" type="number" step="any" 
                  oninput="updateConversionHint('${inputId}', this.value, '${an.analyte_id}')">
                ${mod ? `<label class="tinycheck">
                  <input type="checkbox" id="mod_${an.analyte_id}"
                    onchange="updateModDisplay(this.parentElement.previousElementSibling)">×10³
                </label>` : ""}
              </div>
              ${isBHCalc ? `
              <div class="bh-calc-row" style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                <input type="number" placeholder="%" class="pct-input" style="width:70px; margin:0;"
                  oninput="calcAbsolute('${an.analyte_id}', this.value)">
                <span class="muted small">Calc. desde %</span>
              </div>` : ""}
              <div id="hint_${inputId.replace(/\./g, '\\.')}" class="conversion-hint font-mono"></div>
            </div>`;
        }

        r.innerHTML = `
          <div>${an.name}</div>
          <div>${inputHtml}</div>
          <div class="muted small">${an.units || ""}</div>`;
        c.appendChild(r);
      });
    a.appendChild(c);
  });
}

function saveNewRecord() {
  if (!$("#nrDate").value) { alert("Fecha obligatoria"); return; }
  if (!state.new.selectedPanels.size) { alert("Selecciona al menos un panel"); return; }

  const panels = [];
  const data = {}; // Flat map of analyte_id -> scaled value for quick lookup
  state.new.selectedPanels.forEach(pid => {
    const res = [];
    state.catalog.panels.find(p => p.panel_id === pid).analytes.forEach(a => {
      const el = $(`#in_${a.analyte_id}`);
      if (!el) return;
      const v = el.value;
      if (v !== "") {
        if (a.units === "qual" || a.units === "text") {
          res.push({ analyte_id: a.analyte_id, value: v });
          data[a.analyte_id] = v;
        } else {
          const numV = Number(v);
          if (numV < 0 && !["urine_ph"].includes(a.analyte_id)) return;
          const m = $(`#mod_${a.analyte_id}`)?.checked ? "x10^3" : null;
          const scaledV = getActualValue(numV, m);
          res.push({ analyte_id: a.analyte_id, value: numV, modifier: m });
          data[a.analyte_id] = scaledV;
        }
      }
    });
    panels.push({ panel_id: pid, results: res });
  });

  const record = {
    id: "rec_" + Date.now(), // Assuming no editingId for new records
    date: $("#nrDate").value || new Date().toISOString().split("T")[0],
    sex: $("#nrSex").value,
    context: $("#nrContext").value,
    labName: $("#nrLabName").value,
    isClozapine: $("#nrClozapine").checked,
    isBEN: $("#nrBEN").checked,
    data: data, // Populate with collected analyte data
    panels: panels, // Add panels to the record
    clinical: {}
  };

  if (record.isClozapine) {
    record.clinical = {
      habits: {
        smoking: $("#nrSmoking").checked,
        quit: $("#nrQuitSmoking").checked,
        caffeine: $("#nrCaffeine").value,
        fluvox: $("#nrFluvoxamine").checked
      },
      triage: {
        constipation: Number($("#nrConstipation").value),
        somnolence: Number($("#nrSomnolence").value),
        fever: $("#nrFever").checked,
        chestPain: $("#nrChestPain").checked,
        notes: $("#nrClinicalNotes").value
      }
    };
  }

  record.eval = evaluate(record);
  if (state.editingId) {
    state.records = state.records.map(r => r.id === state.editingId ? record : r);
  } else {
    state.records.push(record);
  }
  persist();

  // Feedback visual
  $("#btnSaveRecord").textContent = "Guardado...";
  setTimeout(() => {
    $("#btnSaveRecord").textContent = "Guardar";
    openDetail(record.id);
  }, 400);
}

/* ---------- evaluation ---------- */
function evaluate(rec) {
  const alerts = [];
  const panelEvals = {};
  const allAnalytes = {};
  const alertedAnalytes = new Set();

  rec.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    panelEvals[p.panel_id] = p.results.map(r => {
      const a = panelDef.analytes.find(x => x.analyte_id === r.analyte_id);
      const v = (a.units === "qual" || a.units === "text") ? r.value : getActualValue(r.value, r.modifier);

      let status = "normal";
      let statusLabel = "";

      if (a.critical && typeof v === 'number') {
        const crit = a.critical.find(c => (c.op === "<" && v < c.value) || (c.op === ">" && v > c.value));
        if (crit) {
          status = "critical";
          statusLabel = crit.label;
          if (!alertedAnalytes.has(r.analyte_id)) {
            alerts.push({ type: 'critical', msg: `${a.name}: CRÍTICO (${v} ${a.units})` });
            alertedAnalytes.add(r.analyte_id);
          }
        }
      }

      if (status !== 'critical' && a.flags && typeof v === 'number') {
        const flag = a.flags.find(f => (f.op === "<" && v < f.value) || (f.op === "<=" && v <= f.value) || (f.op === ">" && v > f.value) || (f.op === ">=" && v >= f.value));
        if (flag) {
          status = "warn";
          statusLabel = flag.label;
          if (!alertedAnalytes.has(r.analyte_id)) {
            alerts.push({ type: 'warn', msg: `${a.name}: ${flag.label.replace(/_/g, ' ')}` });
            alertedAnalytes.add(r.analyte_id);
          }
        }
      }

      if (status === "normal" && a.ref_ranges) {
        let ref = a.ref_ranges.find(x => x.sex === rec.sex) || a.ref_ranges.find(x => x.sex === "any") || a.ref_ranges[0];
        if (a.units === "qual") { if (v !== ref.qualitative_normal) status = "warn"; }
        else if (typeof v === 'number') {
          if (ref.low !== undefined && v < ref.low) status = "low";
          if (ref.high !== undefined && v > ref.high) status = "high";
        }
      }

      const evalResult = {
        ...r, scaled: v, name: a.name, units: a.units, status, statusLabel,
        hints: a.interpretation_hints || [], checklist: a.follow_up_checklist || [],
        conv: CONVERSIONS[r.analyte_id] ? { val: (v * CONVERSIONS[r.analyte_id].factor).toFixed(2), unit: CONVERSIONS[r.analyte_id].unit } : null
      };
      allAnalytes[r.analyte_id] = evalResult;
      return evalResult;
    });
  });

  // Derived Metrics (Anion Gap, BUN/Cr, AST/ALT)
  rec.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    if (!panelDef.derived_metrics) return;
    panelDef.derived_metrics.forEach(m => {
      let val = null;
      if (m.metric_id === "anion_gap") { const na = allAnalytes.sodium?.scaled, cl = allAnalytes.chloride?.scaled, hco3 = allAnalytes.bicarb?.scaled; if (na && cl && hco3) val = na - (cl + hco3); }
      else if (m.metric_id === "bun_cr_ratio") { const bun = allAnalytes.bun?.scaled, cr = allAnalytes.creatinine?.scaled; if (bun && cr && cr > 0) val = bun / cr; }
      else if (m.metric_id === "ast_alt_ratio") { const ast = allAnalytes.ast?.scaled, alt = allAnalytes.alt?.scaled; if (ast && alt && alt > 0) val = ast / alt; }

      if (val !== null) {
        let status = "normal";
        if (m.ref_range) { if (val < m.ref_range.low) status = "low"; if (val > m.ref_range.high) status = "high"; }
        panelEvals[p.panel_id].push({ name: `(Calc) ${m.name}`, value: val.toFixed(1), scaled: val, units: m.units || "", status, isDerived: true, hints: m.interpretation_hints || [] });
        if (status !== "normal") alerts.push({ type: 'info', msg: `Métrica: ${m.name} fuera de rango (${val.toFixed(1)})` });
      }
    });
  });

  // Clinical alerts (if Clozapine)
  if (rec.isClozapine && rec.clinical) {
    const sideAlerts = auditSideEffects({
      constipation: rec.clinical.triage?.constipation,
      fever: rec.clinical.triage?.fever
    });
    sideAlerts.forEach(a => {
      alerts.push({
        type: "danger",
        title: a.title,
        msg: a.message,
        hint: a.advice
      });
    });

    const ancVal = rec.data["anc"]; // stored as /µL (e.g. 1800)
    if (ancVal !== undefined && !isNaN(ancVal)) {
      // analyzeANC expects k/µL, so divide by 1000
      const ancK = ancVal / 1000;
      const ancAnalysis = analyzeANC(ancK, rec.isBEN);
      if (ancAnalysis && ancAnalysis.status !== "OK") {
        alerts.push({
          type: ancAnalysis.status === "CRITICAL" ? "danger" : "warning",
          title: "ALERTA ANC (CLZ)",
          msg: `ANC: ${ancK.toFixed(2)} k/µL — ${ancAnalysis.message}`,
          hint: ancAnalysis.action
        });
      }
    }
  }

  return { alerts, panelEvals }; // Keep panelEvals in the return object
}

/* ---------- detail ---------- */
function openDetail(id) {
  const r = state.records.find(x => x.id === id);
  state.selected = r;
  $("#detailHeader").innerHTML = `<strong>${r.date}</strong> · ${sanitize(r.context || '')}${r.isClozapine ? ' 🔵 CLZ' : ''}${r.isBEN ? ' · BEN' : ''}`;

  // Show/hide CLZ manual bridge button
  const bridge = $("#clzManualBridge");
  if (bridge) bridge.classList.toggle("hidden", !r.isClozapine);

  // Dark mode when critical alerts are present
  if (r.eval.alerts.some(a => a.type === 'critical' || a.type === 'danger')) {
    document.body.dataset.theme = "dark";
  }

  if (r.eval.alerts.length) {
    $("#detailAlerts").innerHTML = r.eval.alerts.map(a => `<div class="badge ${a.type}">${sanitize(a.msg)}</div>`).join("");
  } else {
    $("#detailAlerts").innerHTML = `<span class="badge ok">Resultados sin alertas críticas</span>`;
  }

  const checklists = [];
  Object.values(r.eval.panelEvals).flat().forEach(e => { if (e.status !== 'normal' && e.checklist?.length) checklists.push({ name: e.name, items: e.checklist }); });

  if (checklists.length) {
    $("#detailChecklists").innerHTML = `<h3>Seguimiento sugerido</h3>` + checklists.map(c =>
      `<div class="card" style="font-size:0.9em"><strong>${sanitize(c.name)}:</strong><ul style="margin:5px 0; padding-left:20px;">${c.items.map(i => `<li>${sanitize(i)}</li>`).join("")}</ul></div>`
    ).join("");
  } else { $("#detailChecklists").innerHTML = ""; }

  const w = $("#detailPanels");
  w.innerHTML = "";
  r.panels.forEach(p => {
    const panelDef = state.catalog.panels.find(x => x.panel_id === p.panel_id);
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<h3>${sanitize(panelDef.name)}</h3>`;
    r.eval.panelEvals[p.panel_id].forEach(e => {
      let v = e.value;
      if (e.modifier) v = `${e.value} ${e.modifier} (= ${e.scaled})`;

      const convHtml = e.conv ? `<div class="conv-val font-mono">SI: ${sanitize(e.conv.val)} ${sanitize(e.conv.unit)}</div>` : "";

      c.innerHTML += `
        <div class="analyte-row">
          <div class="analyte-grid">
            <div style="${e.isDerived ? 'font-style:italic' : ''}">${sanitize(e.name)}</div>
            <div class="font-mono">
              <div>${sanitize(v.toString())} <small>${sanitize(e.units || "")}</small></div>
              ${convHtml}
            </div>
            <div><span class="badge ${e.status}">${e.statusLabel || e.status}</span></div>
          </div>
          ${(e.status !== 'normal' && e.hints?.length) ? `<div class="hints small muted">${e.hints[0]}</div>` : ""}
        </div>`;
    });
    w.appendChild(c);
  });
  show("#viewDetail");
}

/* ---------- export ---------- */
function openExport() {
  const r = state.selected;
  let text = `LABS: ${r.date} | ${r.context || "Sin contexto"}\n`;
  const sexLabel = r.sex === 'male' ? 'M' : r.sex === 'female' ? 'F' : '—';
  text += `Sex: ${sexLabel} | Lab: ${r.labName || "—"}\n`;
  if (r.isClozapine) text += `[CLZ${r.isBEN ? ' / BEN' : ''}]\n`;
  text += '\n';

  const abnormal = [];
  const normal = [];

  Object.values(r.eval.panelEvals).flat().forEach(e => {
    if (e.isDerived) return; // Skip derived for compact note unless critical?
    const v = e.modifier ? e.scaled : e.value;
    const statusChar = e.status === 'high' ? '↑' : e.status === 'low' ? '↓' : e.status === 'critical' ? '‼' : '';
    if (statusChar) {
      abnormal.push(`${e.name}: ${v}${statusChar}`);
    } else {
      normal.push(`${e.name}: ${v}`);
    }
  });

  if (abnormal.length) {
    text += `ALTERA.: ${abnormal.join(", ")}\n`;
  }
  if (normal.length) {
    text += `NORMAL: ${normal.join(", ")}\n`;
  }

  // Derived metrics if abnormal
  const derivedAbnormal = Object.values(r.eval.panelEvals).flat().filter(e => e.isDerived && e.status !== 'normal');
  if (derivedAbnormal.length) {
    text += `METRICAS: ${derivedAbnormal.map(e => `${e.name}: ${e.value}${e.status === 'high' ? '↑' : '↓'}`).join(", ")}\n`;
  }

  if (r.eval.alerts.length) {
    text += `\nALERTAS: ${r.eval.alerts.map(a => a.msg).join(" | ")}\n`;
  }

  // Clinical triage section for Clozapine records
  if (r.isClozapine && r.clinical?.triage) {
    const t = r.clinical.triage;
    const h = r.clinical.habits || {};
    text += `\nCLÍNICO: Estreñim.${t.constipation}/5 · Somnol.${t.somnolence}/5`;
    if (t.fever) text += ` · FIEBRE`;
    if (t.chestPain) text += ` · DOLOR TORÁCICO`;
    if (h.smoking) text += `\nHábitos: Fumador`;
    if (h.quit) text += ` · Cese reciente`;
    if (h.fluvox) text += ` · Fluvoxamina`;
    if (h.caffeine === "high") text += ` · Cafeína alta`;
    if (t.notes) text += `\nNotas: ${t.notes}`;
    text += "\n";
  }

  $("#exportText").value = text.trim();
  show("#viewExport");
}

function exportAll() {
  const b = new Blob([JSON.stringify({ records: state.records }, null, 2)], { type: "application/json" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = `labnotes_${localISODate()}.json`; a.click();
  URL.revokeObjectURL(u);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.records) throw new Error("Formato inválido");
      if (confirm(`¿Importar ${data.records.length} registros? Los datos existentes se mantendrán.`)) {
        // Simple merge by ID
        const existingIds = new Set(state.records.map(r => r.id));
        data.records.forEach(r => {
          if (!existingIds.has(r.id)) state.records.push(r);
        });
        persist();
        renderDashboard();
        alert("Importación exitosa");
      }
    } catch (err) {
      alert("Error al importar: " + err.message);
    }
  };
  reader.readAsText(file);
}

function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify({ records: state.records }));
}

/* ── Expose to global scope (required because app.js is type=module) ── */
window.openNew             = openNew;
window.openDetail          = openDetail;
window.deleteRecord        = deleteRecord;
window.showTab             = showTab;
window.openManualClzProtocol = openManualClzProtocol;
window.toggleClozapineFields = toggleClozapineFields;
window.openExport          = openExport;
