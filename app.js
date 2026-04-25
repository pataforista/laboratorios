import { analyzeANC, auditSideEffects } from './clinical.js';
import * as manualLoader from './manualLoader.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const LS_KEY = "labnotes_records_v2";
const LS_KEY_V1 = "labnotes_records_v1";
const LS_THEME = "labnotes_theme";

const state = {
  catalog: null,
  templates: null,
  records: [],
  selected: null,
  editingId: null,
  new: {
    selectedPanels: new Set()
  },
  filters: {
    search: ""
  },
  manual: {
    manifest: null,
    currentTopic: null
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

function validateRecord(r) {
  if (!r || typeof r !== 'object') return false;
  if (!r.id || !r.date || !Array.isArray(r.panels)) return false;
  // Basic check for data structure
  if (typeof r.isClozapine !== 'boolean') return false;
  return true;
}

function migrateFromV1() {
  const v1Data = localStorage.getItem(LS_KEY_V1);
  if (v1Data && !localStorage.getItem(LS_KEY)) {
    try {
      const parsed = JSON.parse(v1Data);
      if (parsed && Array.isArray(parsed.records)) {
        // Simple migration: v1 and v2 have similar structures for now
        // but we ensure all records are valid
        const validRecords = parsed.records.filter(validateRecord);
        localStorage.setItem(LS_KEY, JSON.stringify({ records: validRecords }));
        console.log(`Migrated ${validRecords.length} records from V1 to V2`);
      }
    } catch (e) {
      console.error("Migration failed:", e);
    }
  }
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
  const saved = localStorage.getItem(LS_THEME) || "auto";
  setTheme(saved, false);
}

}

/* ---------- Manual Dashboard (Native) ---------- */
async function initManualDashboard() {
  const input = $("#manualSearch");
  const results = $("#manualResults");
  const chips = $$(".m-chip");
  const backBtn = $("#btnBackToManual");

  if (!input) return;

  // Initial load
  state.manual.manifest = await manualLoader.loadManualIndex();
  renderManualHome();

  input.oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { results.classList.add("hidden"); return; }
    
    // Combine hardcoded MANUAL_INDEX with manifest topics if needed
    // For now, search manifest topics
    const filtered = state.manual.manifest?.topics.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
    ) || [];
    
    renderManualSearchResults(filtered);
  };

  chips.forEach(chip => {
    chip.onclick = () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const filter = chip.dataset.filter;
      renderManualHome(filter);
    };
  });

  if (backBtn) {
    backBtn.onclick = () => {
      $("#manualHome").classList.remove("hidden");
      $("#manualTopic").classList.add("hidden");
    };
  }

  // Close search results on blur
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add("hidden");
    }
  });
}

function renderManualHome(filter = "all") {
  const grid = $("#manualGrid");
  if (!grid) return;
  
  if (!state.manual.manifest) {
    grid.innerHTML = '<div class="body-sm muted">Cargando manual...</div>';
    return;
  }

  let topics = state.manual.manifest.topics;
  if (filter !== "all") {
    // Basic filter logic
    if (filter === "protocol") topics = topics.filter(t => t.id.startsWith("psych_"));
    else if (filter === "calculator") topics = topics.filter(t => t.tags?.includes("calculator") || t.id.includes("calc"));
  }

  grid.innerHTML = topics.map(t => `
    <div class="manual-topic-card" onclick="openManualTopic('${t.id}')">
      <h4>${sanitize(t.title)}</h4>
      <p>${sanitize(t.tags?.slice(0, 3).join(", ") || "")}</p>
    </div>
  `).join("");
}

function renderManualSearchResults(items) {
  const el = $("#manualResults");
  if (!el) return;

  const icons = { calculator: "🧮", printable: "🖨️", protocol: "🩺", topic: "📖" };
  
  el.innerHTML = items.map(item => {
    let handler = `openManualTopic('${item.id}')`;
    if (item.format === 'a4') handler = `openManualResource('${item.id}')`;
    
    return `
      <div class="manual-result-item" onclick="${handler}">
        <div class="manual-result-icon">📖</div>
        <div class="manual-result-info">
          <h4>${sanitize(item.title)}</h4>
          <p>${sanitize(item.tags?.join(", ") || "")}</p>
        </div>
      </div>
    `;
  }).join("");
  el.classList.remove("hidden");
}

async function openManualTopic(id, blockId = null) {
  showTab('manual');
  const topic = await manualLoader.loadTopic(id);
  if (!topic) return;

  state.manual.currentTopic = topic;
  $("#manualHome").classList.add("hidden");
  $("#manualTopic").classList.remove("hidden");

  const renderEl = $("#topicRender");
  renderEl.innerHTML = `<h1 style="color:var(--m3-primary); margin-bottom:16px;">${sanitize(topic.title)}</h1>`;
  
  topic.blocks.forEach(block => {
    const bEl = document.createElement("div");
    bEl.className = `manual-block ${block.type}`;
    bEl.id = block.id;

    let contentHtml = "";
    if (block.title) contentHtml += `<h2>${sanitize(block.title)}</h2>`;
    if (block.content) contentHtml += `<p>${sanitize(block.content)}</p>`;
    
    if (block.items) {
      contentHtml += `<ul>${block.items.map(i => `<li>${sanitize(i)}</li>`).join("")}</ul>`;
    }

    if (block.sub_blocks) {
      block.sub_blocks.forEach(sub => {
        contentHtml += `
          <div class="card" style="margin-top:12px; border-left: 4px solid var(--m3-primary); padding-left:12px;">
            <h3 style="font-size:16px; margin-bottom:4px;">${sanitize(sub.title)}</h3>
            <p style="font-size:14px; margin:0;">${sanitize(sub.content)}</p>
          </div>
        `;
      });
    }

    bEl.innerHTML = contentHtml;
    renderEl.appendChild(bEl);
  });

  if (blockId) {
    const target = document.getElementById(blockId);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }
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
  if (!results) { el.classList.add('hidden'); el.removeAttribute('role'); return; }
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'Resultados de búsqueda');
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
      const idx = parseInt(item.dataset.idx, 10);
      const map = { rec: results.records, top: results.topics, res: results.resources };
      map[bucket][idx].action();
      closeOmni();
    });
  });
}

function omniItem(r, idx, bucket) {
  return `<div class="omni-result" data-bucket="${bucket}" data-idx="${idx}" role="option" tabindex="-1">
    <span class="omni-result-icon" aria-hidden="true">${r.icon}</span>
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

function openManualResource(id) {
  // Map IDs to actual PDF filenames in manual/pdfs/
  const pdfMap = {
    'bp_log_a4': 'registro TA.pdf',
    'clozapine_infographic_pdf': 'Infografia_clozapina.pdf',
    'medication_log_a4': 'Infografia.pdf', // Placeholder or matching
    'lifestyle_master_guide': 'Habitos_saludables.pdf'
  };
  const filename = pdfMap[id] || 'Infografia.pdf';
  window.open(`./manual/pdfs/${filename}`, '_blank');
}

window.openCalculator = openCalculator;

window.openCalculator = openCalculator;

function openManualClzProtocol() {
  openManualTopic('psych_clozapine_monitoring');
}

// Global button listeners
document.addEventListener("DOMContentLoaded", () => {
  const btnBack = $("#btnBackFromCalc");
  if (btnBack) btnBack.onclick = () => $("#viewCalculator").close();
});

/* ---------- Calculators ---------- */
function openCalculator(type) {
  $("#calcFib4").classList.add("hidden");
  $("#calcQtc").classList.add("hidden");
  
  if (type === 'fib4') {
    $("#calcFib4").classList.remove("hidden");
    $("#calcTitle").textContent = "FIB-4";
  } else if (type === 'qtc') {
    $("#calcQtc").classList.remove("hidden");
    $("#calcTitle").textContent = "QTc";
  }
  
  show("#viewCalculator");
}

window.runFib4 = function() {
  const age = Number($("#fibAge").value);
  const plt = Number($("#fibPlt").value);
  const ast = Number($("#fibAst").value);
  const alt = Number($("#fibAlt").value);
  
  import('./clinical.js').then(m => {
    const res = m.calculateFIB4(age, ast, alt, plt);
    if (res === null) { alert("Datos incompletos"); return; }
    
    $("#fibVal").textContent = res.toFixed(2);
    let interp = "";
    if (res < 1.3) interp = "Bajo riesgo de fibrosis avanzada.";
    else if (res > 2.67) interp = "Alto riesgo. Sugiere fibrosis avanzada (F3-F4).";
    else interp = "Riesgo indeterminado. Requiere evaluación adicional.";
    
    $("#fibInterpretation").textContent = interp;
    $("#fibResult").classList.remove("hidden");
  });
};

window.runQtc = function() {
  const qt = Number($("#qtVal").value);
  const hr = Number($("#qtHr").value);
  
  import('./clinical.js').then(m => {
    const res = m.calculateQTc(qt, hr, 'fridericia');
    if (res === null) { alert("Datos incompletos"); return; }
    
    $("#qtcVal").textContent = res.toFixed(0) + " ms";
    let interp = "";
    if (res > 500) interp = "CRÍTICO (>500 ms). Riesgo de TdP. Suspender fármacos QT-prolongadores.";
    else if (res > 450) interp = "Prolongado (>450 ms). Monitoreo frecuente.";
    else interp = "Rango normal.";
    
    $("#qtcInterpretation").textContent = interp;
    $("#qtcResult").classList.remove("hidden");
  });
};

// Global error handler
window.addEventListener('error', (e) => {
  console.error("Global error caught:", e.error);
  // We could add a UI notification here
});

window.addEventListener('unhandledrejection', (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

/* ---------- init ---------- */
window.onload = async () => {
  try {
    initTheme();
    migrateFromV1();

    const catalog = await fetch("lab_catalog.json")
      .then(r => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo de laboratorio");
        return r.json();
      });

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
    state.templates = await fetch("export_templates.json").then(r => r.json()).catch(() => null);

    const saved = localStorage.getItem(LS_KEY);
    state.records = saved ? JSON.parse(saved).records.filter(validateRecord) : [];
    
    $("#nrDate").value = localISODate();
    initUI();
    initOmniSearch();
    initManualDashboard();
    renderTabContent('lab');
    checkStorageQuota();
  } catch (err) {
    console.error("Initialization error:", err);
    alert("Error al iniciar la aplicación: " + err.message);
    // Even if it fails, try to init UI components that don't depend on catalog
    try {
      initTheme();
      initUI();
    } catch(e) {}
  }
};

/* ---------- UI ---------- */
function initUI() {
  // Back buttons
  $("#btnBackFromNew").onclick     = () => hide("#viewNew");
  $("#btnBackFromDetail").onclick  = () => hide("#viewDetail");
  $("#btnBackFromExport").onclick  = () => hide("#viewExport");
  $("#btnBackFromSettings").onclick = () => hide("#viewSettings");

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

  // Wire up iframe theme sync on load
  const manualIframe = $('#manualIframe');
  if (manualIframe) {
    manualIframe.addEventListener('load', () => {
      const theme = document.body.dataset.theme || localStorage.getItem(LS_THEME) || 'dark';
      // Small delay to ensure the iframe's message listener is registered
      setTimeout(() => sendThemeToManual(theme), 80);
    });
  }
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

  // Navigation
  $$('.nav-item').forEach(btn => {
    btn.onclick = () => showTab(btn.dataset.tab);
  });

  // OmniSearch
  const omniInput = $("#omniInput");
  const omniClear = $("#omniClear");
  let omniTimer;
  let omniFocusIndex = -1;

  omniInput.oninput = (e) => {
    clearTimeout(omniTimer);
    const q = e.target.value.trim();
    omniClear.classList.toggle('hidden', !q);
    if (!q) { $("#omniResults").classList.add('hidden'); omniFocusIndex = -1; return; }
    omniTimer = setTimeout(() => {
      renderOmniResults(runOmniSearch(q));
      omniFocusIndex = -1;
    }, 180);
  };

  omniInput.onkeydown = (e) => {
    const items = $$('.omni-result');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      omniFocusIndex = (omniFocusIndex + 1) % items.length;
      updateOmniFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      omniFocusIndex = (omniFocusIndex - 1 + items.length) % items.length;
      updateOmniFocus(items);
    } else if (e.key === 'Enter' && omniFocusIndex > -1) {
      e.preventDefault();
      items[omniFocusIndex].click();
    }
  };

  function updateOmniFocus(items) {
    items.forEach((it, i) => {
      const isFocused = i === omniFocusIndex;
      it.classList.toggle('focused', isFocused);
      if (isFocused) {
        it.id = `omni-opt-${i}`;
        omniInput.setAttribute('aria-activedescendant', it.id);
        it.scrollIntoView({ block: 'nearest' });
      }
    });
  }

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
    // Send theme now — if iframe already loaded this works immediately;
    // if it's still loading, the onload handler above will catch it.
    sendThemeToManual(document.body.dataset.theme || localStorage.getItem(LS_THEME) || 'dark');
  } else {
    if (manualEl) manualEl.classList.add('hidden');
    // Show the correct in-container tab
    const el = $(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (el) { el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  }

  // Update bottom nav active state
  $$('.nav-item').forEach(ni => {
    const isActive = ni.dataset.tab === tab;
    ni.classList.toggle('active', isActive);
    ni.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show/hide FAB (not on manual tab)
  const fab = $('#fabNew');
  if (fab) fab.classList.toggle('hidden', tab === 'manual');

  // Render the correct content
  renderTabContent(tab);

  // Close any open dialogs when switching tabs
  $$('dialog.view-dialog').forEach(d => {
    if (d.open) d.close();
  });
}

function showCurrentTab() {
  // Close any open dialogs and return to current tab
  $$('dialog.view-dialog').forEach(d => {
    if (d.open) d.close();
  });
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
      latestWithData.data?.anc !== undefined ? `
        <div class="clz-stat-chip ${analyzeANC(latestWithData.data.anc/1000, latestWithData.isBEN)?.status.toLowerCase() || ''}">
          <span class="clz-stat-value">${(latestWithData.data.anc/1000).toFixed(2)} <small>k/µL</small></span>
          <div class="clz-stat-label">ANC (${latestWithData.data.anc})</div>
        </div>` : '',
      latestWithData.data?.wbc !== undefined ? `
        <div class="clz-stat-chip">
          <span class="clz-stat-value">${(latestWithData.data.wbc/1000).toFixed(2)} <small>k/µL</small></span>
          <div class="clz-stat-label">WBC (${latestWithData.data.wbc})</div>
        </div>` : '',
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
    drawChart($('#clzTrendChart'), ancData, 'anc');
  } else {
    $('#clzTrendCard').classList.add('hidden');
  }
}

function show(id) {
  // Show a dialog view
  const el = $(id);
  if (el && typeof el.showModal === 'function') {
    el.showModal();
  } else if (el) {
    el.classList.remove('hidden');
  }
}

function hide(id) {
  const el = $(id);
  if (el && typeof el.close === 'function') {
    el.close();
  } else if (el) {
    el.classList.add('hidden');
  }
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
          <span style="font-weight:600; font-size:15px;">${sanitize(r.date)}</span>
          <span style="font-size:13px; color:var(--m3-on-surface-variant);">${sanitize(r.context || "Sin contexto")}</span>
          ${r.labName ? `<span style="font-size:11px; color:var(--m3-outline);">· ${sanitize(r.labName)}</span>` : ""}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">${badgesHtml}</div>
        ${clinicalSnippets}
        ${triageAlert}
      </div>
      <button class="btn btn-text" style="min-width:32px; padding:0; height:32px; border-radius:50%; flex-shrink:0;"
        onclick="event.stopPropagation(); deleteRecord('${sanitize(r.id)}')" aria-label="Eliminar registro">✕</button>
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
/* ---------- chart caching ---------- */
const chartCache = new Map();

function drawChart(canvas, dataPoints, metric) {
  if (!canvas || canvas.offsetWidth === 0) return;
  
  // Memoization: Check if data or metric changed
  const cacheKey = `${canvas.id}_${metric}_${JSON.stringify(dataPoints.map(p => p.id))}`;
  if (chartCache.get(canvas.id) === cacheKey) return; 
  chartCache.set(canvas.id, cacheKey);

  requestAnimationFrame(() => {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    
    const sw = canvas.offsetWidth;
    const sh = canvas.offsetHeight;
    ctx.clearRect(0, 0, sw, sh);

    let theme = document.body.dataset.theme;
    if (theme === 'auto') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const isDark = theme !== 'light';
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const textColor = isDark ? "#e4d8eb" : "#1c1f2b";
    const primaryColor = "#d0bcff"; // M3 Dark Primary

    const values = dataPoints.map(p => p.data[metric]);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.1;
    const range = max - min || 1;

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = sh - 30 - ( (sh - 60) * (i / 4) );
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(sw - 10, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Gradient Line
    const gradient = ctx.createLinearGradient(0, 0, 0, sh);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, "#7c3aed");

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    
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
      
      // Point glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = primaryColor;
      ctx.fillStyle = primaryColor;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = textColor;
      ctx.font = "bold 10px Inter";
      ctx.fillText(p.date.slice(5), x - 12, sh - 8);
      
      ctx.fillStyle = isDark ? "#fff" : "#000";
      ctx.fillText(p.data[metric].toString(), x - 10, y - 14);
    });
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
/**
 * Opens the New Record form.
 * @param {string|number|null} id - ID of the record to edit, or null for a new one.
 */
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
                    onchange="updateModDisplay(this.parentElement.previousElementSibling, '${an.analyte_id}')">×10³
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

/**
 * Saves the current record from the form state to localStorage.
 * Validates date and panel selection before persisting.
 */
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
          const allowNegative = ["urine_ph"].includes(a.analyte_id);
          if (numV < 0 && !allowNegative) {
            console.warn(`Valor negativo detectado y omitido para ${a.analyte_id}`);
            return;
          }
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
    id: state.editingId || "rec_" + Date.now(),
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
        hr: Number($("#nrHR").value) || null,
        bp: $("#nrBP").value || null,
        chestPain: $("#nrChestPain").checked,
        notes: $("#nrClinicalNotes").value
      }
    };
  }
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
  state.editingId = null; // Reset editing state after save

  // Feedback visual
  $("#btnSaveRecord").textContent = "Guardado...";
  setTimeout(() => {
    $("#btnSaveRecord").textContent = "Guardar";
    openDetail(record.id);
  }, 400);
}

/* ---------- evaluation ---------- */
/**
 * Evaluates a record against catalog rules and clinical thresholds.
 * @param {Object} rec - The record object to evaluate.
 * @returns {Object} Evaluation result containing alerts and panel-specific data.
 */
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
      if (m.metric_id === "anion_gap") { 
        const na = allAnalytes.sodium?.scaled, cl = allAnalytes.chloride?.scaled, hco3 = allAnalytes.bicarb?.scaled; 
        if (na && cl && hco3) {
          val = na - (cl + hco3);
          const alb = allAnalytes.albumin?.scaled; // g/dL
          if (alb && alb < 4.0) {
            val = val + 2.5 * (4.0 - alb);
          }
        }
      }
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
      somnolence: rec.clinical.triage?.somnolence,
      fever: rec.clinical.triage?.fever,
      hr: rec.clinical.triage?.hr,
      bp: rec.clinical.triage?.bp
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

    // Permanent Suspension Check (REMS)
    const history = state.records.filter(r => r.isClozapine && r.id !== rec.id);
    const criticalHistory = history.filter(h => (h.data?.anc !== undefined && h.data.anc < 500));
    const currentCritical = (rec.data?.anc !== undefined && rec.data.anc < 500);

    if (currentCritical && criticalHistory.length > 0) {
      alerts.push({
        type: "critical",
        title: "SUSPENSIÓN PERMANENTE",
        msg: "Segundo registro con ANC < 500 detectado.",
        hint: "Protocolo FDA REMS exige suspensión definitiva de Clozapina."
      });
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

  // Phase 4: Enhanced Clinical Analysis Box for Clozapine
  let clozAnalysisHtml = "";
  if (r.isClozapine) {
    const ancAnalysis = analyzeANC((r.data?.anc || 0)/1000, r.isBEN);
    clozAnalysisHtml = `
      <div class="cloz-analysis-card" style="margin-top:16px; padding:12px; border-radius:8px; border:1px solid var(--m3-outline-variant); background:var(--m3-surface-container-low); margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="margin:0; font-size:16px;">🔬 Análisis Clozapina (REMS 2024)</h3>
          <span class="badge ${ancAnalysis?.status.toLowerCase() || 'ok'}">${ancAnalysis?.status || 'OK'}</span>
        </div>
        <p style="font-size:14px; margin:4px 0;"><strong>ANC:</strong> ${(r.data?.anc/1000 || 0).toFixed(2)} k/µL (${r.data?.anc || 0} /µL)</p>
        <p style="font-size:13px; color:var(--m3-on-surface-variant);">${ancAnalysis?.message || 'Sin datos suficientes.'}</p>
        ${ancAnalysis?.action ? `<p style="font-size:13px; font-weight:bold; color:var(--m3-error); margin-top:8px;">Acción: ${ancAnalysis.action}</p>` : ''}
        
        <div style="margin-top:12px; border-top:1px solid var(--m3-outline-variant); padding-top:8px; font-size:12px; opacity:0.8; display:flex; justify-content:space-between; align-items:center;">
          <p style="margin:2px 0;"><strong>Fuente:</strong> FDA REMS / APA 2024-25</p>
          <button class="btn btn-text btn-sm" onclick="openManualTopic('psych_clozapine_monitoring')" style="padding:0; min-height:0; color:var(--m3-primary);">Ver Protocolo →</button>
        </div>
      </div>
    `;
  }

  const checklists = [];
  Object.values(r.eval.panelEvals).flat().forEach(e => { if (e.status !== 'normal' && e.checklist?.length) checklists.push({ name: e.name, items: e.checklist }); });

  if (checklists.length) {
    $("#detailChecklists").innerHTML = `<h3>Seguimiento sugerido</h3>` + checklists.map(c =>
      `<div class="card" style="font-size:0.9em"><strong>${sanitize(c.name)}:</strong><ul style="margin:5px 0; padding-left:20px;">${c.items.map(i => `<li>${sanitize(i)}</li>`).join("")}</ul></div>`
    ).join("");
  } else { $("#detailChecklists").innerHTML = ""; }

  const w = $("#detailPanels");
  w.innerHTML = clozAnalysisHtml; 
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
          ${(e.status !== 'normal' && e.hints?.length) ? `<div class="hints small muted">${sanitize(e.hints[0])}</div>` : ""}
        </div>`;
    });
    w.appendChild(c);
  });
  show("#viewDetail");
}

/* ---------- export ---------- */
function openExport() {
  const r = state.selected;
  const selector = $("#exportTemplate");
  
  // Populate templates if not done
  if (selector && state.templates && selector.options.length === 0) {
    state.templates.export_templates.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.template_id;
      opt.textContent = t.name;
      selector.appendChild(opt);
    });
    selector.onchange = () => renderExport();
  }

  renderExport();
  show("#viewExport");
}

function renderExport() {
  const r = state.selected;
  const templateId = $("#exportTemplate")?.value || "default";
  
  if (templateId === "default" || !state.templates) {
    // Original hardcoded logic as fallback
    let text = `LABS: ${r.date} | ${r.context || "Sin contexto"}\n`;
    const sexLabel = r.sex === 'male' ? 'M' : r.sex === 'female' ? 'F' : '—';
    text += `Sex: ${sexLabel} | Lab: ${r.labName || "—"}\n`;
    if (r.isClozapine) text += `[CLZ${r.isBEN ? ' / BEN' : ''}]\n`;
    text += '\n';

    const abnormal = [];
    const normal = [];

    Object.values(r.eval.panelEvals).flat().forEach(e => {
      if (e.isDerived) return;
      const v = e.modifier ? e.scaled : e.value;
      const statusChar = e.status === 'high' ? '↑' : e.status === 'low' ? '↓' : e.status === 'critical' ? '‼' : '';
      if (statusChar) abnormal.push(`${e.name}: ${v}${statusChar}`);
      else normal.push(`${e.name}: ${v}`);
    });

    if (abnormal.length) text += `ALTERA.: ${abnormal.join(", ")}\n`;
    if (normal.length) text += `NORMAL: ${normal.join(", ")}\n`;

    const derivedAbnormal = Object.values(r.eval.panelEvals).flat().filter(e => e.isDerived && e.status !== 'normal');
    if (derivedAbnormal.length) {
      text += `METRICAS: ${derivedAbnormal.map(e => `${e.name}: ${e.value}${e.status === 'high' ? '↑' : '↓'}`).join(", ")}\n`;
    }

    if (r.eval.alerts.length) text += `\nALERTAS: ${r.eval.alerts.map(a => a.msg).join(" | ")}\n`;

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
  } else {
    // Use selected template
    const tmpl = state.templates.export_templates.find(t => t.template_id === templateId);
    const panelTmpl = state.templates.export_templates.find(t => t.template_id === "panel_block_v1");
    const lineTmpl = state.templates.export_templates.find(t => t.template_id === "line_v1");

    let panelBlocks = "";
    r.panels.forEach(p => {
      const panelDef = state.catalog.panels.find(pd => pd.panel_id === p.panel_id);
      let lines = "";
      r.eval.panelEvals[p.panel_id].forEach(e => {
        if (e.isDerived) return;
        const v = e.modifier ? e.scaled : e.value;
        // Find ref range for display
        const analyteDef = panelDef.analytes.find(ad => ad.analyte_id === e.analyte_id);
        const refRange = analyteDef?.ref_ranges?.find(rr => rr.sex === r.sex || rr.sex === "any") || (analyteDef?.ref_ranges ? analyteDef.ref_ranges[0] : {});
        
        lines += lineTmpl.body
          .replace("{analyte_name}", e.name)
          .replace("{value}", v)
          .replace("{units}", e.units || "")
          .replace("{ref_low}", refRange.low || "—")
          .replace("{ref_high}", refRange.high || "—")
          .replace("{status}", e.status.toUpperCase());
      });
      panelBlocks += panelTmpl.body
        .replace("{panel_name}", panelDef.name)
        .replace("{lines}", lines);
    });

    let text = tmpl.body
      .replace("{date}", r.date)
      .replace("{context}", r.context || "Sin contexto")
      .replace("{lab_name}", r.labName || "—")
      .replace("{panel_blocks}", panelBlocks)
      .replace("{alerts}", r.eval.alerts.map(a => a.msg).join(" | ") || "Sin alertas");

    $("#exportText").value = text.trim();
  }
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
  
  // Phase 3: Limit size to 2MB to prevent browser freezing
  if (file.size > 2 * 1024 * 1024) {
    alert("Error: El archivo es demasiado grande (máximo 2MB).");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data || typeof data !== 'object') throw new Error("Formato inválido: no es un objeto JSON");
      if (!Array.isArray(data.records)) throw new Error("Formato inválido: falta el arreglo 'records'");
      const invalid = data.records.findIndex(r => !r.id || !r.date || !Array.isArray(r.panels));
      if (invalid !== -1) throw new Error(`Registro inválido en posición ${invalid}: falta id, date o panels`);
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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ records: state.records }));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert("Error: El almacenamiento local está lleno. Por favor, elimina registros antiguos o exporta tus datos.");
    }
  }
}

async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const quota = await navigator.storage.estimate();
    const percent = (quota.usage / quota.quota) * 100;
    if (percent > 90) {
      showSnackbar("Almacenamiento casi lleno (90%+). Exporta tus datos pronto.", "Exportar", () => showTab('lab'));
    }
  }
}

function showSnackbar(text, actionText = null, actionFn = null) {
  const el = $("#globalSnackbar");
  const txt = $("#snackbarText");
  if (!el || !txt) return;

  txt.textContent = text;
  const btn = el.querySelector(".btn-text");
  
  if (actionText && actionFn) {
    btn.textContent = actionText;
    btn.onclick = () => {
      actionFn();
      hideSnackbar();
    };
  } else {
    btn.textContent = "OK";
    btn.onclick = hideSnackbar;
  }

  el.classList.add("show");
  // Auto-hide after 6 seconds if no action
  if (!actionText) {
    setTimeout(hideSnackbar, 6000);
  }
}

function hideSnackbar() {
  const el = $("#globalSnackbar");
  if (el) el.classList.remove("show");
}

/* ── Expose to global scope (required because app.js is type=module) ── */
window.openNew             = openNew;
window.openDetail          = openDetail;
window.deleteRecord        = deleteRecord;
window.showTab             = showTab;
window.openManualClzProtocol = openManualClzProtocol;
window.toggleClozapineFields = toggleClozapineFields;
window.openExport          = openExport;
window.openManualTopic     = openManualTopic;
window.openManualResource  = openManualResource;
window.setTheme           = setTheme;
window.showSnackbar        = showSnackbar;
window.hideSnackbar        = hideSnackbar;
