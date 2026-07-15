# Plan de Rediseño Estético y Funcional — Lab Notes

> Revisión realizada el 2026-07-15 sobre la rama `main`, con la app corriendo en Chromium
> (viewport móvil 390×844 y escritorio 1280×860, temas claro y oscuro, con datos de prueba
> que incluyen un registro de Clozapina con neutropenia y triage CIGH positivo).
> Cada hallazgo de este documento fue verificado visualmente o en el código.

---

## 1. Diagnóstico general

La app es sólida en su **lógica clínica** (motor de evaluación, REMS, BEN, triage CIGH, tests),
pero la **capa visual está incompleta y rota en puntos clave**, y varios flujos generan fricción
innecesaria. La sensación de "anticuada y poco intuitiva" tiene causas concretas y corregibles:

1. **`styles.css` está truncado**: en la reparación anterior se reconstruyó el archivo pero se
   perdió el bloque final (~250 líneas). Hoy **no existe CSS** para clases que el HTML y el JS
   usan activamente: `omnisearch-*`, `tab-header`, `manual-header`, `manual-grid`, `m-chip`,
   `clz-stats-row`, `onboarding-card`, `card-hero`, `display-lg`, `label-md`, `theme-selector`,
   `toast`, `footer`, `btn-icon`, `btn-coffee`, `chart-tooltip`. Gran parte del aspecto "roto"
   viene de aquí, no de un mal diseño.
2. **Iconografía 100% emoji** (🧬🔍⚙🩺📖🧪☕): se renderiza distinto en cada sistema operativo,
   no respeta el color del tema y es lo que más contribuye al aspecto amateur/anticuado.
3. **Tipografía nunca llega a cargarse offline**: la PWA depende de Google Fonts (no precacheadas
   por el Service Worker) y además hay doble carga inconsistente — `index.html` pide *Inter* y
   `styles.css` importa *Outfit*. Sin red, la app cae a la fuente del sistema.
4. **Densidad y jerarquía**: exceso de estilos inline (más de 80 `style="..."` en `index.html` y
   otros tantos en `app.js`), textos largos, tarjetas muy grandes y datos crudos sin formatear.

---

## 2. Hallazgos verificados (con evidencia)

### 2.1 Roturas visuales (bloqueantes para la percepción de calidad)

| # | Hallazgo | Dónde se ve | Causa |
|---|----------|-------------|-------|
| V1 | **Topbar rota en móvil**: la lupa flota suelta, el input de búsqueda queda sin contenedor, la marca "Lab Notes" se parte en dos líneas y los botones ◐/⚙ quedan desalineados. Peor aún: **los resultados de OmniSearch se pintan transparentes encima del dashboard** (sin fondo ni posicionamiento), quedando ilegibles y mezclados con las tarjetas | Todas las vistas móviles; al escribir en el buscador | Faltan las reglas `.omnisearch-wrap/.omnisearch-bar/.omnisearch-icon/.omnisearch-results/.btn-icon` en `styles.css` |
| V2 | **Stats de Clozapina en texto plano apilado** ("2.31 k/µL / ANC (2310) / 4.20 k/µL…") en lugar de tarjetas | Pestaña Clozapina | Falta `.clz-stats-row` y estilos de sus tarjetas |
| V3 | **Filtros del Manual sin estilo** (botones nativos del navegador con borde gris) y grid de temas renderizado como lista de texto | Pestaña Manual | Faltan `.m-chip`, `.manual-grid`, `.manual-header`, `.manual-search-box` |
| V4 | **Topbar del detalle colapsada en móvil**: "← Registros", "✏ Editar" y "📋 Exportar" se encima­n/desbordan en 390 px | Vista Detalle | `.view-topbar` no gestiona overflow; botones con texto largo |
| V5 | **Inputs sin estilo** (fondo blanco sobre tema oscuro) en "Contexto clínico" y "Laboratorio" | Paso 1 del wizard | Los `<input>` no llevan `type="text"` y el selector CSS es `input[type="text"]` — no matchea |
| V6 | **La última tarjeta y el footer quedan tapados** por la bottom-nav flotante; se ve texto cortado ("1 ALERTAS") asomando detrás | Dashboard móvil | `padding-bottom` del contenedor insuficiente (100 px vs nav de 66 px + 16 px + FAB) |
| V7 | **El FAB tapa contenido** de las tarjetas de registro | Dashboard y Clozapina móvil | FAB fijo sin reserva de espacio ni auto-ocultado al hacer scroll |
| V8 | **Selector de plantilla de exportación truncado** ("Re… ▾") | Vista Exportar móvil | Tres elementos compitiendo en una topbar de ancho fijo |
| V9 | **Alertas del detalle inconsistentes**: la primera alerta (ANC) aparece como texto plano sin chip, las siguientes sí llevan badge; además muestra "K/ML" (mayúsculas de CSS) donde debería decir "k/µL" | Vista Detalle | Clases de badge no aplicadas de forma uniforme + `text-transform: uppercase` sobre unidades |
| V10 | **Tema claro con contraste pobre**: chips de estado (verde #2e7d32 sobre lila), placeholders casi invisibles, y el hero degradado pierde legibilidad | Dashboard claro | Colores hardcodeados que no forman parte de los tokens del tema |

### 2.2 Fricción funcional / UX

| # | Hallazgo | Impacto |
|---|----------|---------|
| F1 | **Textos que prometen lo que la app no es**: el hero dice "Estado de Pacientes" pero la app es la bitácora personal del médico (decisión de producto confirmada: no habrá gestión de pacientes). Los textos deben reflejarlo — "Resumen de controles", "Mis registros" — para no generar expectativas de multi-paciente | Medio |
| F2 | **Datos crudos sin formato**: `PLT: 210000`, fechas ISO `2026-07-01`, sin unidades en los snippets de tarjeta | Medio |
| F3 | **Captura de BH interminable**: cada analito ocupa ~180 px de alto (input + checkbox ×10³ + caja "Calc. desde %" + hint); una biometría completa exige un scroll enorme y el botón Guardar queda al final sin ser sticky | Alto |
| F4 | **El checkbox ×10³ es un concepto técnico** que el usuario debe entender para no guardar valores mil veces menores; la app debería inferir la escala o pedir la unidad de forma explícita | Alto |
| F5 | **Confirmaciones destructivas con `confirm()`/`alert()` nativos** ("¿Borrar todo?") — rompen el lenguaje visual y no permiten deshacer | Medio |
| F6 | **Borrar registro (✕) visible en cada tarjeta**, misma jerarquía visual que abrir el registro; invita al error | Medio |
| F7 | **El wizard no indica qué falta**: si no seleccionas panel te lo dice un `alert` al final, no una validación en el paso | Medio |
| F8 | **OmniSearch y búsqueda del Manual duplicadas** (dos cajas de búsqueda con estilos distintos, resultados distintos) | Medio |
| F9 | **Sin estados de carga/esqueleto**: al abrir, el dashboard aparece de golpe; si `lab_catalog.json` falla solo hay un `alert` | Bajo |
| F10 | **Accesibilidad**: iconos emoji sin `aria-hidden` consistente, foco visible solo por defecto del navegador, contraste AA no auditado, `<h2>` de sección seguido de `<h3>` primario en color de marca de baja legibilidad | Medio |

### 2.3 Deuda técnica que bloquea el rediseño

| # | Hallazgo | Impacto |
|---|----------|---------|
| T1 | ~80 estilos inline en `index.html` + HTML generado con estilos inline en `app.js`: cualquier cambio de diseño exige tocar tres sitios | Alto |
| T2 | Doble fuente de tipografías (Inter en HTML, Outfit en CSS) vía Google Fonts, sin precache en `sw.js` → offline pierde la tipografía; además `@import` en CSS bloquea el primer render | Medio |
| T3 | Handlers inline `onclick="..."` que obligan a mantener `'unsafe-inline'` en la CSP | Medio |
| T4 | `node_modules/` versionado (binarios Windows) y copias muertas en `data/` — ya señalado en PLAN_MEJORA.md, sigue pendiente | Medio |

---

## 3. Propuesta de diseño

### 3.1 Sistema de diseño (base de todo lo demás)

- **Completar y consolidar `styles.css`**: restaurar/escribir las ~15 familias de clases perdidas
  (V1–V3) y **migrar todos los estilos inline a clases** con los tokens ya existentes. El sistema
  de tokens M3 actual (HSL + surface containers) es bueno; el problema es que la mitad de la UI
  no lo usa.
- **Iconografía SVG**: sustituir todos los emojis por un set único de iconos SVG inline
  (Material Symbols o Lucide, embebidos como sprite local — sin CDN, compatible con la CSP y el
  modo offline). Un solo cambio que moderniza toda la app: navegación, topbar, chips, badges,
  vacíos y botones.
- **Tipografía offline-first**: elegir una sola familia (p. ej. Inter variable + JetBrains Mono
  para cifras), **servirlas como archivos locales** (`/fonts/*.woff2`) precacheados por el SW, y
  eliminar Google Fonts del HTML, del CSS y de la CSP.
- **Escala tipográfica y de espaciado documentada**: `display / title / body / label` + spacing
  en múltiplos de 4 px; eliminar los tamaños sueltos (`font-size:11px/12px/13px/15px` inline).
- **Formateadores centralizados**: un módulo `format.js` con `formatDate()` (localizada, "1 jul
  2026"), `formatValue(analyte, v)` (separador de miles, unidad correcta: `210 000 /µL` o
  `210 k/µL`) y `formatANC()`. Se usa en tarjetas, detalle, export y gráficas. Resuelve F2 y V9.

### 3.2 Rediseño por pantalla

**Dashboard (Laboratorios)**
- Hero compacto tipo "stat strip": 3 tarjetas pequeñas (Registros · Clozapina · Alertas) en vez
  del bloque de texto con degradado; la de Alertas actúa como filtro al tocarla (sustituye a la
  fila de pills, que hoy ocupa dos líneas).
- Tarjeta de registro rediseñada: fecha formateada + contexto en una línea, chips de estado a la
  derecha, snippet de valores con unidades y color semáforo (`ANC 1.17 k/µL 🡓` en ámbar).
  El borrado sale de la tarjeta y pasa al detalle (o a un swipe/menú ⋮), resolviendo F6.
- Bottom-nav: mantener el dock flotante pero añadir `scroll-margin`/padding correcto (V6),
  auto-ocultar el FAB al hacer scroll hacia abajo (V7) y darle etiqueta al FAB ("+ Registro").

**Wizard Nuevo Registro**
- Paso 3 rediseñado como **filas compactas de captura**: `nombre | input | unidad` en una línea
  de ~56 px, con el cálculo desde % como acción secundaria plegada (icono %) en vez de caja
  dashed permanente. Reduce el alto de una BH de ~15 pantallas a ~3 (F3).
- Sustituir el checkbox ×10³ por un **selector de unidad explícito** en los analitos que lo
  necesitan (`/µL ↔ k/µL`) con conversión visible en el hint (F4).
- Barra inferior sticky dentro del diálogo con `← Anterior · Guardar` siempre visible; el botón
  del paso muestra qué falta ("Selecciona al menos 1 estudio") en línea, no con `alert` (F7).
- En móvil el diálogo pasa a **pantalla completa** (media query sobre `dialog.view-dialog`):
  hoy el modal flotante desperdicia ~10% del ancho en un teléfono.

**Detalle**
- Topbar del diálogo con truncado correcto: "←" solo icono, acciones "Editar/Exportar" como
  iconos con menú en <420 px (V4).
- Alertas unificadas: toda alerta se renderiza con el mismo componente chip (severidad → color),
  unidades fuera del `text-transform` (V9).
- Sección "Seguimiento sugerido" en acordeón cerrado por defecto — hoy empuja los resultados de
  panel fuera de pantalla.

**Clozapina**
- Restaurar las stat-cards (V2) y añadir al widget "Próximo control" un botón de acción directa
  ("Registrar control de hoy" → abre wizard con CLZ preseleccionado).
- Semáforo ANC visible como banda de color en la gráfica de tendencia (zonas verde/ámbar/roja
  según perfil estándar o BEN).

**Manual**
- Restaurar grid de tarjetas y chips (V3); unificar su buscador con OmniSearch (una sola caja,
  con ámbitos "Registros / Manual / Recursos") — resuelve F8.
- Al abrir un tema, ocultar la cabecera de búsqueda/chips del índice: hoy queda visible con un
  gran espacio muerto encima del contenido del tema.

**Ajustes / Exportar**
- Theme-selector como segmented control con estado activo visible (hoy no se distingue el tema
  seleccionado).
- Exportar: plantilla como fila propia bajo la topbar (V8) y vista previa con botón "Copiar"
  flotante.
- Sustituir `confirm()/alert()` por el snackbar existente + diálogo de confirmación propio con
  "Deshacer" para borrados (F5).

### 3.3 Modelo de producto (decisión tomada)

**La app es la herramienta de trabajo del médico, sin entidad paciente.** Todo el registro,
seguimiento y exportación lo controla el profesional. Consecuencias para el diseño:

- Renombrar todo texto que sugiera multi-paciente: "Estado de Pacientes" → **"Resumen de
  controles"**; "Monitoreos Clozapina" → "Controles Clozapina". El campo libre "Contexto
  clínico" sigue siendo el lugar donde el médico anota a qué caso corresponde cada registro.
- Reforzar ese campo como eje de organización ligera: **autocompletado con los contextos ya
  usados** (datalist) y filtro por contexto en el dashboard. Da el 80% del beneficio de separar
  casos sin añadir gestión de pacientes.
- Las gráficas de tendencia deben indicar sobre qué subconjunto se calculan (el filtro activo),
  para que el médico decida qué está comparando.

### 3.4 Referencias de navegación: qué hacen las apps que los médicos ya usan

Para que la navegación resulte familiar desde el primer uso, el rediseño adopta patrones de las
apps médicas más utilizadas y de las apps de consumo masivo que definen los hábitos de todos:

| Patrón | Referencia | Aplicación en Lab Notes |
|--------|-----------|--------------------------|
| **Bottom nav de 3–5 destinos con iconos + etiqueta siempre visible** | WhatsApp, Instagram, Google (Material 3), Epocrates | Mantener las 3 pestañas actuales (Laboratorios · Clozapina · Manual), pero con iconos SVG con estado activo de relleno, no emojis. Es el patrón correcto; solo está mal ejecutado |
| **Lista → detalle con búsqueda arriba** | Medscape, UpToDate, correo/notas | El dashboard ya lo hace; falta que la búsqueda sea una sola, siempre en el mismo sitio, con resultados en panel opaco (V1) |
| **Calculadoras como catálogo buscable con favoritos y entradas recientes** | **MDCalc** (estándar de facto entre médicos) | Sacar FIB-4 y QTc del fondo del Manual: una entrada "Calculadoras" visible (chip en el dashboard o cuarta pestaña), lista buscable, resultado con interpretación semaforizada y botón "copiar al portapapeles" como MDCalc |
| **Captura numérica rápida en una pantalla** | MDCalc, Glucose Buddy, apps bancarias (montos) | Paso 3 del wizard: filas compactas, `inputmode="decimal"` para teclado numérico directo, salto automático al siguiente campo con Enter/Next, unidad visible dentro del campo |
| **Documentos de referencia con lectura limpia** | UpToDate, Medscape | Vista de tema del Manual sin la cabecera de búsqueda del índice (espacio muerto actual), con tipografía de lectura, índice de secciones colapsable y botón flotante "volver arriba" |
| **Acción primaria como FAB etiquetado** | Gmail ("Redactar"), Google Keep | FAB con texto "+ Registro" que se contrae a icono al hacer scroll; los médicos identifican la acción sin adivinar |
| **Deshacer en lugar de confirmar** | Gmail, Google Photos | Borrado de registro → snackbar "Registro eliminado · DESHACER" (5 s), en vez de `confirm()` nativo |
| **Semáforos y estados glanceables** | Monitores clínicos, Apple Health (anillos), MDCalc (rangos de riesgo) | Chips de severidad con color + icono + texto (no solo color, por accesibilidad), banda verde/ámbar/roja en la gráfica ANC |
| **Exportar/compartir como hoja de acciones** | iOS/Android share sheet | "Exportar" abre opciones (plantilla, copiar, descargar JSON) en un bottom sheet, patrón que cualquier usuario de móvil ya conoce |

### 3.5 Accesibilidad y ergonomía clínica

Pensada para el contexto real de uso de un médico (consulta con poca luz o guardia nocturna,
uso a una mano entre pacientes, prisa):

- **Objetivos táctiles ≥ 48×48 px** en toda acción (hoy el ✕ de borrar y los chips quedan cortos).
- **Contraste WCAG AA en ambos temas**, auditado (el tema claro actual falla en chips y
  placeholders); modo oscuro real para guardias, sin grises intermedios ilegibles.
- **Teclado numérico directo** (`inputmode="decimal"`) en todos los campos de captura; en
  escritorio, navegación completa con Tab/Enter para capturar una biometría sin tocar el ratón.
- **Texto escalable**: usar `rem` en lugar de los `px` fijos actuales para respetar el ajuste
  de tamaño de fuente del sistema (médicos +45 suben la fuente del teléfono; hoy la app lo ignora).
- **Nunca color solo**: toda severidad lleva icono + texto ("⚠ Crítico"), pensando en daltonismo
  (8% de los hombres).
- **`aria-live` en alertas clínicas** y foco gestionado al abrir/cerrar diálogos (hoy el foco
  se pierde y el anillo de foco aparece en sitios aleatorios, como se ve en la vista Detalle).

---

## 4. Roadmap propuesto

### Fase A — Reparación visual (1 sesión, sin cambios de comportamiento)
1. Restaurar las clases CSS perdidas (V1, V2, V3, V10) usando los tokens existentes.
2. Corregir `type="text"` faltantes (V5), padding inferior del contenedor (V6), topbars de
   diálogo en móvil (V4, V8).
3. Añadir `verify` visual: script de capturas Playwright (ya existe la base en esta revisión)
   como prueba de humo para que el CSS no vuelva a romperse sin que se note.

**Criterio de aceptación**: cero elementos sin estilo en las 8 vistas, capturas móvil/desktop ×
claro/oscuro revisadas.

### Fase B — Modernización estética (1–2 sesiones)
4. Sprite SVG de iconos y sustitución de todos los emojis.
5. Tipografías locales + precache en SW; eliminar Google Fonts y `@import`.
6. Migración de estilos inline → clases; escala tipográfica/espaciado documentada al inicio de
   `styles.css`.
7. Formateadores de fecha/valor/unidad y aplicación en tarjetas, detalle, export y charts.

**Criterio de aceptación**: `index.html` sin atributos `style`, app idéntica online/offline,
auditoría rápida de contraste AA en ambos temas.

### Fase C — Flujos (2 sesiones)
8. Wizard: captura compacta, selector de unidad, footer sticky, validación en línea, diálogo
   fullscreen en móvil.
9. Dashboard: stat strip, tarjeta rediseñada, borrado con confirmación propia + deshacer.
10. Detalle: alertas unificadas, acordeones; Export: selector de plantilla en fila propia.
11. Unificación de búsqueda (OmniSearch con ámbitos).

**Criterio de aceptación**: capturar una BH completa en < 90 s en móvil; ninguna acción
destructiva sin confirmación con deshacer; `npm test` verde.

### Fase D — Producto (herramienta del médico)
12. Renombrar textos multi-paciente (F1) y añadir autocompletado + filtro por "Contexto clínico"
    como organización ligera de casos (§3.3).
13. **Calculadoras al estilo MDCalc**: sección propia y visible (fuera del fondo del Manual),
    lista buscable, resultado con interpretación semaforizada y copiar al portapapeles (§3.4).
14. Semáforo ANC en gráficas + acción rápida "Registrar control de hoy".
15. Limpieza de deuda: `.gitignore` para `node_modules`, borrar `data/` muerto, quitar handlers
    inline y endurecer la CSP.

---

## 5. Quick wins (se pueden hacer hoy mismo)

| Acción | Esfuerzo | Resuelve |
|--------|----------|----------|
| Añadir `type="text"` a `#nrContext` y `#nrLabName` | 1 min | V5 |
| Subir `padding-bottom` del `.container` a ~140 px | 1 min | V6 |
| Restaurar bloque CSS perdido | 1–2 h | V1, V2, V3 |
| `Intl.NumberFormat`/`Intl.DateTimeFormat` en tarjetas | 30 min | F2 |
| "← " solo icono + botones icónicos en topbar de detalle móvil | 20 min | V4 |
| Renombrar hero a "Resumen de controles" (la app es la bitácora del médico) | 5 min | F1 |
| `inputmode="decimal"` en campos numéricos de captura | 15 min | §3.5 |

---

*Documento generado a partir de revisión de código (`app.js`, `styles.css`, `index.html`,
`clinical.js`, `sw.js`) y prueba visual en Chromium con datos sembrados. Las capturas de la
sesión de revisión muestran cada hallazgo V1–V10.*
