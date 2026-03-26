# Plan de Mejora — Lab Notes

## Resumen del Proyecto

**Lab Notes** es una PWA offline-first para gestión de registros de laboratorio clínico con monitoreo especializado de Clozapina. Stack: Vanilla JS + HTML5 + CSS3 (Material Design 3), sin backend, datos en localStorage.

---

## Fallas y Huecos Identificados

### Críticos

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Sin tests** — cero cobertura para lógica clínica crítica | Alto |
| 2 | **Sin README.md** — docs/ vacío, sin guía de uso ni despliegue | Alto |
| 3 | **Sin manejo de errores robusto** — no hay try/catch en inicialización, fallos silenciosos en fetch | Alto |
| 4 | **Sin validación de esquema** de datos en localStorage — corrupción silenciosa posible | Alto |

### Importantes

| # | Problema | Impacto |
|---|----------|---------|
| 5 | **localStorage sin estrategia de migración** — cambios de estructura romperán datos existentes | Medio |
| 6 | **Sin límite de cuota** en localStorage — falla silenciosa si se llena | Medio |
| 7 | **Canvas chart** asume `offsetWidth > 0` — falla en elementos ocultos | Medio |
| 8 | **`state.editingId` no se resetea** tras guardar — puede causar estado inconsistente | Medio |
| 9 | **Valores negativos aceptados** en la mayoría de campos numéricos | Medio |
| 10 | **Export templates** definidas en JSON pero no expuestas en la UI | Medio |
| 11 | **Inconsistencia de unidades** — ANC guardado en /µL pero umbral en k/µL | Medio |

### Menores

| # | Problema | Impacto |
|---|----------|---------|
| 12 | Sin paginación en lista de registros (virtual scrolling) | Bajo |
| 13 | Sin polyfills — no funciona en browsers antiguos | Bajo |
| 14 | Accesibilidad parcial — algunos botones sin aria-label, modals no usan `<dialog>` | Bajo |
| 15 | Sin memoización en charts (redibuja completo en cada selección) | Bajo |
| 16 | Sin límite de tamaño en importación JSON | Bajo |

---

## Plan de Mejora

### Fase 1 — Estabilidad y Seguridad

1. **Crear README.md** con descripción, instalación, uso y guía de contribución
2. **Agregar manejo de errores** en inicialización, fetch de catálogo y operaciones de localStorage
3. **Validación de esquema** al leer registros desde localStorage (schema mínimo por campo)
4. **Estrategia de migración** para localStorage (versión `labnotes_records_v2` con migrador automático)
5. **Corregir bugs identificados:**
   - Reset de `state.editingId` tras guardar
   - Validación de valores negativos en campos numéricos
   - Protección ante `offsetWidth = 0` en canvas

### Fase 2 — Calidad y Tests

6. **Configurar Vitest** como framework de tests
7. **Tests unitarios** para `clinical.js`:
   - `evaluateRecord()` — valores críticos, warnings, normales
   - `evaluateANC()` — perfil normal vs BEN/Duffy-null
   - `calcAnionGap()`, `calcBunCr()`, `calcAstAlt()` — casos límite
8. **Tests de integración** para flujos críticos:
   - Crear → guardar → recuperar registro
   - Exportar JSON → importar → verificar integridad
   - Buscar registros

### Fase 3 — Funcionalidades Pendientes

9. **Exponer Export Templates en la UI** — selector de plantilla antes de exportar
10. **Agregar límite y manejo de cuota** en localStorage con notificación al usuario
11. **Limitar tamaño** de archivo en importación JSON
12. **Mejorar accesibilidad:**
    - Migrar modals a `<dialog>` nativo
    - Agregar aria-labels faltantes
    - Etiquetas accesibles en range sliders

### Fase 4 — Documentación Clínica

13. **Documentar fuentes de umbrales clínicos** en `clinical.js` con referencias (guías APA, REMS, etc.)
14. **JSDoc completo** para funciones públicas de `app.js` y `clinical.js`
15. **Guía de usuario** dentro del Manual (sección "Cómo usar Lab Notes")
