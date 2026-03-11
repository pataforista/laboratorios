(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))a(e);new MutationObserver(e=>{for(const o of e)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function n(e){const o={};return e.integrity&&(o.integrity=e.integrity),e.referrerPolicy&&(o.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?o.credentials="include":e.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(e){if(e.ep)return;e.ep=!0;const o=n(e);fetch(e.href,o)}})();const C="modulepreload",L=function(i,t){return new URL(i,t).href},I={},S=function(t,n,a){let e=Promise.resolve();if(n&&n.length>0){const l=document.getElementsByTagName("link"),s=document.querySelector("meta[property=csp-nonce]"),r=(s==null?void 0:s.nonce)||(s==null?void 0:s.getAttribute("nonce"));e=Promise.allSettled(n.map(c=>{if(c=L(c,a),c in I)return;I[c]=!0;const f=c.endsWith(".css"),p=f?'[rel="stylesheet"]':"";if(!!a)for(let v=l.length-1;v>=0;v--){const g=l[v];if(g.href===c&&(!f||g.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${p}`))return;const m=document.createElement("link");if(m.rel=f?"stylesheet":C,f||(m.as="script"),m.crossOrigin="",m.href=c,r&&m.setAttribute("nonce",r),document.head.appendChild(m),f)return new Promise((v,g)=>{m.addEventListener("load",v),m.addEventListener("error",()=>g(new Error(`Unable to preload CSS for ${c}`)))})}))}function o(l){const s=new Event("vite:preloadError",{cancelable:!0});if(s.payload=l,window.dispatchEvent(s),!s.defaultPrevented)throw l}return e.then(l=>{for(const s of l||[])s.status==="rejected"&&o(s.reason);return t().catch(o)})},T="./dataset/manifest.json";function R(i){if(!i||typeof i!="object")return{ok:!1,error:"Topic no es objeto"};if(!i.id||!i.title)return{ok:!1,error:"Topic sin id/título"};if(!Array.isArray(i.blocks))return{ok:!1,error:"Topic sin blocks"};for(const t of i.blocks){if(!t||typeof t!="object")return{ok:!1,error:"Bloque inválido"};if(!t.type)return{ok:!1,error:"Bloque sin type"};if(!t.id)return{ok:!1,error:"Bloque sin id (campo obligatorio para trazabilidad)"}}return{ok:!0}}async function B(){const i=await fetch(T).then(a=>a.json());if(!i||!i.topics)throw new Error("Manifest inválido");const t={};for(const a of i.topics){const e=await fetch(`./${a.path}`).then(l=>l.json()),o=R(e);if(!o.ok)throw console.error(a.id,o.error,e),new Error(`Topic inválido: ${a.id} (${o.error})`);t[e.id]=e}const n={};for(const a of i.printables||[])try{const e=await fetch(`./${a.path}`).then(o=>o.json());n[e.id]=e}catch(e){console.warn("Error cargando printable explícito:",a.path,e)}try{const a=await fetch("./dataset/printables/generated_index.json").then(e=>e.json());a&&a.printables&&a.printables.forEach(e=>{n[e.id]=e})}catch{console.log("No se encontró índice generado de printables o está vacío.")}return{manifest:i,topicsById:t,printablesById:n}}function _(i,t,n){return(t.blocks||[]).filter(e=>{const o=e.audience||"both";return n==="patient"?o==="patient"||o==="both":!0}).map(e=>k(i,e,n)).join("")}function u(i){return String(i??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}function j(i){const t=String(i||"info").toLowerCase();return t==="critical"||t==="danger"?"danger":t==="warning"||t==="caution"?"warning":"pearl"}function P(i,t){const n=i||[],a=t||[];return`<div style="overflow:auto;">
    <table>
      <thead><tr>${n.map(e=>`<th>${u(e)}</th>`).join("")}</tr></thead>
      <tbody>
        ${a.map(e=>{let o=Array.isArray(e)?e:e&&typeof e=="object"?Object.values(e):[String(e)];return n.length&&(o.length<n.length&&(o=o.concat(Array(n.length-o.length).fill(""))),o.length>n.length&&(o=o.slice(0,n.length))),`<tr>${o.map(l=>`<td>${u(l)}</td>`).join("")}</tr>`}).join("")}
      </tbody>
    </table>
  </div>`}function N(i){return`<table>
    <tbody>
      ${(i&&typeof i=="object"?Object.entries(i):[]).map(([n,a])=>`<tr>
        <td style="width:40%; font-weight:600;"><small>${u(n)}</small></td>
        <td>${u(a)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`}function U(i){var t;return(t=i.share_variant)!=null&&t.content?`<button class="btn no-print" style="margin-top:10px" data-share="1" data-share-title="${u(i.share_variant.title||"Para paciente")}" data-share-content="${u(i.share_variant.content)}">👤 Ver para paciente</button>`:""}function z(i,t,n){return(t||[]).filter(e=>{const o=e.audience||"both";return n==="patient"?o==="patient"||o==="both":!0}).map(e=>k(i,e,n)).join("")}function k(i,t,n){const a=t.type,e=t.title?`<h3 style="margin-top:0; font-size:1.1rem; color:var(--primary-deep)">${u(t.title)}</h3>`:"",o=U(t);let l="";if(t.didactic_level&&(l=`<span class="badge" style="background:var(--text-main); color:var(--bg-clinical); border:none; border-radius:1px; margin-bottom:8px; display:inline-block;">${{1:"L1_PRACTICO",2:"L2_RAZONAMIENTO",3:"L3_EVIDENCIA"}[t.didactic_level]||`LVL_${t.didactic_level}`}</span><br>`),a==="text"||a==="summary")return`<div class="card" style="text-align:left; align-items:flex-start;">${l}${e}<p style="margin:0;">${u(t.content||"").replaceAll(`
`,"<br>")}</p>${o}</div>`;if(a==="checklist"||a==="list"){const r=(t.items||[]).map(c=>`<li style="margin-bottom:8px; display:flex; gap:10px;"><span style="color:var(--primary-spirit)">${a==="checklist"?"☑":"•"}</span><span>${u(c)}</span></li>`).join("");return`
      <div class="card" style="text-align:left; align-items:flex-start;">
        ${l}${e}
        <ul style="list-style:none; padding:0; margin:0; width:100%;">${r}</ul>
        ${o}
      </div>`}if(a==="table")return`<div class="card" style="text-align:left; align-items:flex-start; padding:15px; overflow-x:auto;">${l}${e}${P(t.headers,t.rows)}</div>`;if(a==="warning"||a==="alert"||a==="danger"||a==="pearl"){const s=a==="pearl"?"pearl":j(t.level||(a==="danger"?"danger":"warning")),c={danger:"🚩 BANDERA_ROJA",warning:"⚠️ ADVERTENCIA",pearl:"💡 PERLA_CLINICA"}[s]||"INFO_LOG",f=t.items||[],p=f.length?`<ul style="margin:10px 0 0; padding-left:20px;">${f.map(y=>`<li>${u(y)}</li>`).join("")}</ul>`:"";return`<div class="clinical-box ${s}">
      <span class="box-title">${c}</span>
      ${t.title?`<strong>${u(t.title)}</strong><br>`:""}
      <p style="margin:5px 0 0;">${u(t.content||"").replaceAll(`
`,"<br>")}</p>
      ${p}
      ${o}
    </div>`}if(a==="calculator"){const s=(t.inputs||[]).map(r=>`
      <div style="flex:1; min-width:120px;">
        <label style="font-family:var(--font-mono); font-size:11px;">
          <span style="font-weight:700; opacity:0.8;">${u(r.label).toUpperCase()}</span><br>
          <input class="search-input" style="padding:10px; border-width:1px; margin-top:4px; font-size:14px;" data-key="${u(r.key)}" type="number" min="${r.min??""}" max="${r.max??""}" step="${r.step??"any"}">
        </label>
      </div>
    `).join("");return`<div class="card" style="text-align:left; align-items:flex-start; background:var(--success-bg); border-color:var(--primary-spirit);">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px; color:var(--text-main)">
        <span style="font-size:24px;">⚙️</span>
        <h3 style="margin:0; font-size:1rem; font-family:var(--font-mono); font-weight:800;">CALC_${u(t.title||"TRIAL").toUpperCase()}</h3>
      </div>
      <form data-calc="${u(t.fn)}" style="display:flex; flex-wrap:wrap; gap:15px; width:100%;">
        ${s}
        <div style="width:100%; padding:20px; background:var(--bg-paper); border:2px solid var(--text-main); margin-top:10px;">
          <small style="text-transform:uppercase; font-weight:800; opacity:0.6; font-family:var(--font-mono);">SYSTEM_OUTPUT</small>
          <div data-output style="padding:5px 0; font-size:1.5rem; font-weight:800; font-family:var(--font-mono);">—</div>
        </div>
      </form>
      ${o}
    </div>`}if(a==="section"){const s=t.content?`<p>${u(t.content).replaceAll(`
`,"<br>")}</p>`:"",r=t.sub_blocks?`<div style="margin-top:15px; width:100%;">${z(i,t.sub_blocks,n)}</div>`:"";return`<div style="margin:25px 0;">${e}${s}${r}</div>`}if(a==="key_value")return`<div class="card" style="text-align:left; align-items:flex-start;">${e}${N(t.data)}</div>`;if(a==="accordion"){const s=t.items||[];return`<div style="margin:15px 0;">
      ${e}
      ${s.map(r=>`<details class="card" style="margin:8px 0; display:block; text-align:left; align-items:flex-start;">
        <summary style="font-weight:700; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center;">
          <span>${u(r.title||"Detalle")}</span>
          <span style="font-size:12px; opacity:0.5;">▼</span>
        </summary>
        <div style="padding-top:15px; border-top:1px solid var(--border-light); margin-top:10px;">
          ${u(r.content||"").replaceAll(`
`,"<br>")}
        </div>
      </details>`).join("")}
    </div>`}if(a==="flowchart"){const s=t.steps||[];return`<div style="margin:20px 0;">
      ${e}
      <div class="flowchart">
        ${s.map((r,c)=>`<div class="flow-step">
          <div class="flow-index">${c+1}</div>
          <div style="flex:1">
            <div style="font-weight:700; color:var(--primary-deep);">${u(r.title||`Paso ${c+1}`)}</div>
            <p style="margin:4px 0 0; font-size:0.9rem; color:var(--text-muted);">${u(r.content||"")}</p>
          </div>
        </div>`).join("")}
      </div>
    </div>`}if(a==="resource_link"){const s=t.link_id;return s&&i.printablesById[s]?`<div class="card clickable" data-nav="print" data-id="${u(s)}" style="flex-direction:row; justify-content:space-between; align-items:center; text-align:left;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="font-size:24px;">📄</div>
          <div>
            <div style="font-weight:700;">${u(t.label||i.printablesById[s].title)}</div>
            <small style="color:var(--text-muted);">Recurso imprimible</small>
          </div>
        </div>
        <div style="font-size:18px; color:var(--primary-blue);">→</div>
      </div>`:""}return`<div class="card"><p>Bloque no soportado: ${u(a)}</p></div>`}function M(i,t,n={}){var l;const a=((l=i.manifest)==null?void 0:l.topics)||[],{urgencyOnly:e=!1,filterFavorites:o=!1}=n;return`
    <header>
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:24px;">🎐</span>
        <h1 style="color:var(--text-main)">Manual Clínico 2026</h1>
      </div>
      <button id="modeToggle" class="btn" style="padding: 4px 12px; font-size:10px;">
        ${t==="clinician"?"MED_MODE_INIT":"PAT_MODE_AUTH"}
      </button>
    </header>

    <div class="search-hero no-print">
      <div class="search-container">
        <input type="search" id="topicSearch" placeholder="BUSCAR_PROTOCOLO..." class="search-input" aria-label="Buscar temas">
      </div>
      <div style="margin-top:20px; display:flex; justify-content:center; gap:12px;">
        <button class="btn ${e?"primary":""}" id="btnUrgencias">
          🚨 URGENCIA
        </button>
        <button class="btn ${o?"primary":""}" id="btnFavoritos">
          ⭐ FAVORITO
        </button>
      </div>
    </div>

    <main>
      <div id="btnResume" class="card clickable" style="display:none; flex-direction:row; align-items:center; gap:15px; border-style:dashed; padding:15px; margin-bottom:24px;">
        <span style="font-size:24px;">🕒</span>
        <div style="flex:1">
            <small style="font-family:var(--font-mono); font-weight:700; opacity:0.7;">MEMORIA_SISTEMA</small>
            <span style="display:block; font-weight:700; font-size:1.1rem; line-height:1.2;">—</span>
        </div>
      </div>

      <div class="grid-menu">
        ${a.map(s=>{const r=i.topicsById[s.id];if(!r||t==="patient"&&r.audience==="clinician")return"";const c=(r.tags||[]).includes("urgencia")||(r.tags||[]).includes("crisis")||(r.tags||[]).includes("urgencias"),f=r.icon||(c?"🏮":"📜");return`
          <button class="card clickable topic-card" data-nav="topic" data-id="${s.id}" type="button" aria-label="${r.title}" data-id="${s.id}">
            <div class="topic-icon">${f}</div>
            <h2 style="font-family:var(--font-main)">${r.title}</h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:auto;">
                ${c?'<span class="badge urgency">KRISIS</span>':""}
                ${(r.tags||[]).slice(0,2).map(p=>`<span class="badge">${p.toUpperCase()}</span>`).join("")}
            </div>
            ${(n.favorites||[]).includes(s.id)?'<span style="position:absolute; top:8px; right:8px; font-size:12px;">✦</span>':""}
          </button>
          `}).join("")}
      </div>

      <div id="topicSearchEmpty" class="card" style="display:none; text-align:center; padding:40px; border-style:dashed;">
        <span style="font-size:40px; display:block; margin-bottom:15px;">🔍</span>
        <h3>No se encontraron resultados</h3>
        <p style="color:var(--text-muted)">Intente con otros términos o revise la ortografía.</p>
      </div>
    </main>

    <div class="nav-bottom no-print">
      <button class="nav-item active" data-nav="home">
        <span>🏠</span>
        <span>Inicio</span>
      </button>
      <button class="nav-item" onclick="document.getElementById('topicSearch').focus()">
        <span>🔍</span>
        <span>Buscar</span>
      </button>
      <button class="nav-item" data-nav="printables">
        <span>📚</span>
        <span>Recursos</span>
      </button>
      <button class="nav-item" id="btnSettings">
        <span>⚙️</span>
        <span>Ajustes</span>
      </button>
    </div>
    
    <div id="shareOverlay" class="overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center; padding:20px;">
      <div class="overlay-content" style="background:var(--bg-paper); padding:25px; border-radius:var(--radius-lg); max-width:500px; width:100%; box-shadow:var(--shadow-hover);">
        <h2 style="margin-top:0; color:var(--primary-deep)">Educación al Paciente</h2>
        <div id="shareBody" style="background:var(--bg-clinical); padding:15px; border-radius:var(--radius-md); margin-bottom:20px; max-height:60vh; overflow-y:auto; border:1px solid var(--border-light);"></div>
        <div style="display:flex; gap:10px;">
            <button id="shareClose" class="btn primary" style="flex:1">Cerrar</button>
            <button class="btn" style="flex:1" onclick="window.print()">🖨️ Imprimir</button>
        </div>
      </div>
    </div>
  `}function F(i,t,n,a=!1){var o;const e=i.topicsById[t];return e?`
    <header>
      <button class="btn" data-nav="home" style="border:none; font-size:20px;">◂</button>
      <h1 style="flex:1; margin-left:12px; font-size:1.1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.title.toUpperCase()}</h1>
      <div style="display:flex; gap:8px;">
          <button class="btn" id="favToggle" title="Favorito" style="font-size:18px; border:none;">${a?"✦":"✧"}</button>
          <button class="btn" onclick="window.print()" style="border:none; font-size:18px;">📜</button>
      </div>
    </header>
    <main>
      <div style="margin-bottom:24px; display:flex; gap:8px; flex-wrap:wrap">
        ${(e.tags||[]).map(l=>`<span class="badge" style="background:var(--text-main); color:var(--bg-clinical);">${l.toUpperCase()}</span>`).join("")}
      </div>
      
      ${_(i,e,n)}
      
      <div style="margin-top:40px; padding:30px 20px; border-top:var(--border-ink); text-align:center; color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; letter-spacing:0.5px;">
        <p><strong>FUERZA_EVIDENCIA:</strong> ${((o=e.meta)==null?void 0:o.source)||"NUCLEO_INTERNO"} (REF_2026)</p>
        <p>ESTE DOCUMENTO ES DE CARÁCTER CLÍNICO. REQUIERE CRITERIO PROFESIONAL PARA SU EJECUCIÓN.</p>
      </div>
    </main>

    <div class="nav-bottom no-print">
      <button class="nav-item" data-nav="home">
        <span>🎐</span>
        <span>INICIO</span>
      </button>
      <button class="nav-item active">
        <span>📜</span>
        <span>CONTENIDO</span>
      </button>
      <button class="nav-item" id="btnTopicSettings">
        <span>⚙️</span>
        <span>OPCIONES</span>
      </button>
    </div>
  `:'<main><div class="clinical-box danger"><span class="box-title">SISTEMA_ERROR</span>Tema no encontrado en la base de datos local.</div><button class="btn" data-nav="home">◂ VOLVER_INICIO</button></main>'}function q(i){const t=Object.values(i.printablesById||{});return`
    <header>
      <button class="btn" data-nav="home" style="border:none; font-size:20px;">◂</button>
      <h1 style="flex:1; margin-left:12px; font-size:1.1rem; color:var(--text-main)">BIBLIOTECA_RECURSOS</h1>
    </header>
    <main>
      <div style="margin-bottom:24px;">
        <h2 style="font-family:var(--font-mono); font-size:0.9rem; opacity:0.7;">DOCUMENTOS_Y_GUIAS</h2>
      </div>
      
      <div class="grid-menu">
        ${t.map(n=>{var o;const a=n.template==="pdf"||((o=n.url)==null?void 0:o.toLowerCase().endsWith(".pdf")),e=a?"📄":"🖼️";return`
            <button class="card clickable" data-nav="print" data-id="${n.id}">
              <div class="topic-icon">${e}</div>
              <h2 style="font-family:var(--font-main); font-size:0.95rem;">${n.title}</h2>
              <div style="margin-top:auto;">
                <span class="badge">${a?"PDF":"IMG"}</span>
              </div>
            </button>
          `}).join("")}
      </div>

      ${t.length===0?`
        <div class="card" style="text-align:center; padding:40px; border-style:dashed;">
          <p>No hay recursos disponibles en este momento.</p>
        </div>
      `:""}
    </main>

    <div class="nav-bottom no-print">
      <button class="nav-item" data-nav="home">
        <span>🎐</span>
        <span>INICIO</span>
      </button>
      <button class="nav-item active" data-nav="printables">
        <span>📚</span>
        <span>RECURSOS</span>
      </button>
      <button class="nav-item" id="btnSettings">
        <span>⚙️</span>
        <span>OPCIONES</span>
      </button>
    </div>
  `}function D(i,t){var a,e;const n=(a=i.printablesById)==null?void 0:a[t];return n?n.template==="pdf"||(e=n.url)!=null&&e.toLowerCase().endsWith(".pdf")?`
      <div style="height:100vh; display:flex; flex-direction:column;">
        <header class="no-print">
            <button class="btn" data-nav="home">← Volver</button>
            <h1 style="flex:1; text-align:center;">${n.title}</h1>
            <button class="btn primary" onclick="document.getElementById('pdfFrame').contentWindow.print()">🖨️</button>
        </header>
        <iframe id="pdfFrame" src="${n.url}" style="flex:1; border:none; width:100%;"></iframe>
      </div>
     `:n.template==="image"?`
      <div class="infographic-viewer" style="min-height:100vh; display:flex; flex-direction:column; background:var(--bg-clinical);">
        <header class="no-print">
            <button class="btn" data-nav="home">←</button>
            <h1 style="flex:1; text-align:center;">${n.title}</h1>
            <button class="btn primary" onclick="window.print()">🖨️</button>
        </header>
        <main style="flex:1; display:flex; align-items:flex-start; justify-content:center; padding:20px;">
            <img src="${n.url}" alt="${n.title}" style="max-width:100%; height:auto; border-radius:var(--radius-md); box-shadow:var(--shadow-hover); background:white;">
        </main>
      </div>
    `:"<main>Formato de impresión no optimizado para esta vista.</main>":"<main>Recurso no encontrado</main>"}function H(){let i;const t=document.querySelector("header"),n=document.createElement("button");n.textContent="Instalar App",n.className="btn primary",n.style.display="none",n.style.marginLeft="auto",n.id="installBtn",t?(t.querySelector(".row")||t).appendChild(n):document.body.prepend(n),window.addEventListener("beforeinstallprompt",a=>{a.preventDefault(),i=a,n.style.display="inline-block",console.log("Install prompt captured"),n.onclick=async()=>{n.style.display="none",i.prompt();const{outcome:e}=await i.userChoice;console.log(`User response to the install prompt: ${e}`),i=null}}),window.addEventListener("appinstalled",()=>{n.style.display="none",i=null,console.log("PWA was installed")})}const h=document.getElementById("app"),d={mode:localStorage.getItem("mode")||"clinician",dataset:null,urgencyOnly:!1,favorites:JSON.parse(localStorage.getItem("favorites")||"[]"),filterFavorites:!1};H();function V(i){d.mode=i,localStorage.setItem("mode",i),b()}function W(i){const t=d.favorites.indexOf(i);t>-1?d.favorites.splice(t,1):d.favorites.push(i),localStorage.setItem("favorites",JSON.stringify(d.favorites)),b()}function b(){if(!d.dataset)return;const i=new URL(location.href),t=i.searchParams.get("view")||"home",n=i.searchParams.get("id");if(t==="topic"&&n&&localStorage.setItem("lastTopic",n),window.scrollTo(0,0),t==="topic"&&n)h.innerHTML=F(d.dataset,n,d.mode,d.favorites.includes(n));else if(t==="print"&&n)h.innerHTML=D(d.dataset,n);else if(t==="printables")h.innerHTML=q(d.dataset);else{h.innerHTML=M(d.dataset,d.mode,d);const a=localStorage.getItem("lastTopic");if(a&&d.dataset.topicsById[a]){const e=document.getElementById("btnResume");e&&(e.style.display="flex",e.onclick=()=>O("topic",a),e.querySelector("span:last-child").textContent=d.dataset.topicsById[a].title)}}G(),document.querySelectorAll(".nav-bottom .nav-item").forEach(a=>{a.dataset.nav===t?a.classList.add("active"):a.classList.remove("active")})}function O(i,t){const n=new URL(location.href);n.searchParams.set("view",i),t?n.searchParams.set("id",t):n.searchParams.delete("id"),history.pushState({},"",n),b()}function G(){document.querySelectorAll("[data-nav]").forEach(o=>{o.onclick=l=>{l.stopPropagation(),O(o.dataset.nav,o.dataset.id||null)}});const i=document.getElementById("modeToggle");i&&(i.onclick=()=>{V(d.mode==="clinician"?"patient":"clinician")});const t=document.getElementById("topicSearch");if(t){const o=Array.from(document.querySelectorAll(".grid-menu .topic-card")),l=()=>{const c=t.value.trim().toLowerCase();let f=0;o.forEach(y=>{var $,E;const m=y.dataset.id,v=((E=($=y.querySelector("h2"))==null?void 0:$.textContent)==null?void 0:E.toLowerCase())||"",g=Array.from(y.querySelectorAll(".badge")).map(w=>w.textContent.toLowerCase()),A=y.querySelector(".urgency");let x=!c||v.includes(c)||g.some(w=>w.includes(c));d.urgencyOnly&&!A&&(x=!1),d.filterFavorites&&!d.favorites.includes(m)&&(x=!1),y.style.display=x?"flex":"none",x&&(f+=1)});const p=document.getElementById("topicSearchEmpty");p&&(p.style.display=f===0?"block":"none")};t.oninput=l;const s=document.getElementById("btnUrgencias");s&&(s.onclick=()=>{d.urgencyOnly=!d.urgencyOnly,s.style.background=d.urgencyOnly?"var(--danger-bg)":"rgba(255,255,255,0.1)",s.style.color=d.urgencyOnly?"var(--danger)":"white",l()});const r=document.getElementById("btnFavoritos");r&&(r.onclick=()=>{d.filterFavorites=!d.filterFavorites,r.style.background=d.filterFavorites?"var(--info-bg)":"rgba(255,255,255,0.1)",r.style.color=d.filterFavorites?"var(--info-blue)":"white",l()}),l()}const n=document.getElementById("favToggle");n&&(n.onclick=()=>{const o=new URL(location.href).searchParams.get("id");W(o)});const a=document.getElementById("btnSettings")||document.getElementById("btnTopicSettings");a&&(a.onclick=()=>alert("Ajustes: Próximamente podrá personalizar las fuentes y el tamaño de texto.")),document.querySelectorAll("[data-share]").forEach(o=>{o.onclick=()=>{const l=document.getElementById("shareOverlay"),s=document.getElementById("shareBody"),r=o.dataset.shareTitle,c=o.dataset.shareContent;l.querySelector("h2").textContent=r,s.innerHTML=c.replaceAll(`
`,"<br>"),l.style.display="flex"}});const e=document.getElementById("shareClose");e&&(e.onclick=()=>document.getElementById("shareOverlay").style.display="none"),document.querySelectorAll("form[data-calc]").forEach(o=>{o.oninput=()=>{const l=o.dataset.calc,s={};o.querySelectorAll("input").forEach(r=>s[r.dataset.key]=parseFloat(r.value)),S(()=>import("./calculators-D7PrFXkI.js"),[],import.meta.url).then(r=>{const c=r.runCalculator(l,s),f=o.querySelector("[data-output]");c.ok?f.innerHTML=`<span style="color:var(--primary-blue)">${c.text}</span>`:f.innerHTML=`<span style="color:#999; font-size:0.9rem">${c.error||"Formato incompleto..."}</span>`}).catch(r=>console.log("Calculadora no cargada aún",r))}})}window.addEventListener("popstate",b);(async function(){try{d.dataset=await B(),b()}catch(t){h.innerHTML=`<div class="clinical-box danger" style="margin:20px"><span class="box-title">ERROR DE SISTEMA</span>${t.message}</div>`}})();function J(i={}){const{immediate:t=!1,onNeedRefresh:n,onOfflineReady:a,onRegistered:e,onRegisteredSW:o,onRegisterError:l}=i;let s,r;const c=async(p=!0)=>{await r};async function f(){if("serviceWorker"in navigator){if(s=await S(async()=>{const{Workbox:p}=await import("./workbox-window.prod.es5-vqzQaGvo.js");return{Workbox:p}},[],import.meta.url).then(({Workbox:p})=>new p("./sw.js",{scope:"./",type:"classic"})).catch(p=>{l==null||l(p)}),!s)return;s.addEventListener("activated",p=>{(p.isUpdate||p.isExternal)&&window.location.reload()}),s.addEventListener("installed",p=>{p.isUpdate||a==null||a()}),s.register({immediate:t}).then(p=>{o?o("./sw.js",p):e==null||e(p)}).catch(p=>{l==null||l(p)})}}return r=f(),c}const K=J({onNeedRefresh(){confirm("Hay una nueva versión disponible. ¿Recargar?")&&K(!0)},onOfflineReady(){console.log("App lista para trabajar offline")}});
