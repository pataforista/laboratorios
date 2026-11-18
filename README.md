# Lab Notes (PWA)

**Lab Notes** es una aplicación web progresiva (PWA) de registro de laboratorios clínicos y monitoreo activo de seguridad para pacientes en tratamiento con Clozapina. Diseñada bajo un enfoque *offline-first*, la aplicación garantiza que ningún dato de salud salga del dispositivo del profesional, protegiendo al máximo la privacidad del paciente.

---

## 🚀 Características Clave

- **Monitoreo de Clozapina**: Cálculo automático del recuento absoluto de neutrófilos (ANC) y triage clínico de efectos secundarios críticos basados en las guías REMS.
- **Doble Perfil de Neutropenia**: Configuración para pacientes con Neutropenia Étnica Benigna (BEN/Duffy-null) y perfiles estándar.
- **Offline-First**: Funcionalidad total sin internet gracias a Service Workers y almacenamiento local persistente (`localStorage`).
- **OmniSearch**: Motor de búsqueda unificado para registros de pacientes, protocolos clínicos y manuales en PDF.
- **Exportación en Texto Plano**: Generación instantánea de notas clínicas estructuradas para copiar y pegar en cualquier Expediente Clínico Electrónico (ECE/EMR).
- **Calculadoras Clínicas Integradas**: Evaluaciones rápidas para FIB-4 (fibrosis hepática) y QTc Fridericia (seguridad cardiaca).

---

## 🛠️ Stack Tecnológico

- **Núcleo**: HTML5, Vanilla JavaScript (ES6+ Módulos).
- **Estilos**: CSS3 moderno con variables dinámicas, adaptado a Material Design 3.
- **Almacenamiento**: `localStorage` nativo con manejo transaccional de cuotas y migración automática de esquemas.
- **Framework de Pruebas**: [Vitest](https://vitest.dev/) para aseguramiento de calidad del motor clínico y flujos de integración.

---

## 📚 Referencias Clínicas y Umbrales

La lógica clínica de esta aplicación está alineada con:
1. **Consenso Delphi global 2025** (Siskind et al., *Lancet Psychiatry*; [DOI 10.1016/S2215-0366(25)00098-7](https://doi.org/10.1016/S2215-0366(25)00098-7)):
   - *General*: considerar suspensión con ANC < 1.0 ×10⁹/L. Severa (agranulocitosis): ANC < 0.5.
   - *Duffy-null (BEN/DARC)*: umbral de suspensión < 0.5.
   - Monitoreo rutinario de ANC: se puede suspender tras 2 años.
2. **FDA 2025**: el programa REMS de clozapina se retiró el 13 de junio de 2025. El monitoreo de ANC sigue recomendado y el aviso de neutropenia grave (Boxed Warning) se mantiene. Referencia de inicio: ANC ≥ 1.5 (ficha técnica).
3. **CERSI-PGx 2026, Reino Unido** (ADAN/Duffy-null; [DOI 10.1002/bcp.70576](https://doi.org/10.1002/bcp.70576)): genotipado para umbrales de ADAN. La valoración hematológica se pide con fiebre sostenida ≥ 38 °C y ANC < 1.0.
4. **Guías APA 2024-2025** para el tratamiento de la Esquizofrenia.
5. **Consenso sobre Hipomotilidad Gastrointestinal Inducida por Clozapina (CIGH)**: Detección y alerta temprana ante un grado de estreñimiento $\ge 3/5$ para mitigar riesgos de íleo paralítico.

---

## 📦 Instalación y Uso Local

### Como PWA en Dispositivos Móviles y Escritorio
1. Acceda al enlace de la aplicación en Chrome, Edge o Safari.
2. Haga clic en el botón de instalación en la barra de direcciones o elija "Agregar a la pantalla de inicio".
3. La aplicación estará disponible en su cajón de aplicaciones y funcionará al 100% sin conexión.

### Desarrollo Local
Para levantar el servidor de desarrollo y realizar modificaciones:
1. Clone este repositorio.
2. Inicie un servidor web estático en el directorio raíz. Por ejemplo, usando Python:
   ```bash
   python -m http.server 8000
   ```
3. Abra `http://localhost:8000` en su navegador.

---

## 🧪 Pruebas Unitarias e Integración

El motor clínico de la aplicación se valida de forma automatizada. Para ejecutar las pruebas:

1. Instale las dependencias de desarrollo:
   ```bash
   npm install
   ```
2. Ejecute las pruebas con Vitest:
   ```bash
   npm test
   ```

El set de pruebas cubre:
- El análisis correcto de niveles de ANC y asignación de semáforos clínicos.
- Las alertas clínicas por efectos secundarios de triage (CIGH, Taquicardia, Fiebre, Sedación).
- Fórmulas de calculadoras (FIB-4, QTc Fridericia/Bazett, Anion Gap corregido, AST/ALT, BUN/Cr).
- La pureza de la función de evaluación y la integridad de serialización/deserialización de importación JSON.

---

## ⚖️ Aviso de Seguridad y Responsabilidad Clínica

> [!IMPORTANT]
> Esta herramienta está destinada exclusivamente como un asistente de decisión clínica para profesionales de la salud. Las sugerencias y alertas emitidas deben contrastarse con los informes oficiales de laboratorio y las guías institucionales vigentes. El uso de esta aplicación no reemplaza el juicio clínico del médico tratante.
