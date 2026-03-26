# Lab Notes (PWA)

**Lab Notes** is a specialized clinical laboratory record management tool, designed with an "offline-first" approach for healthcare professionals. It features advanced monitoring for Clozapine treatment and general laboratory data visualization.

## Key Features
- **Clozapine Monitoring**: Automatic calculation of Absolute Neutrophil Count (ANC) and clinical triage (fever, constipation, etc.) based on 2024-2025 guidelines.
- **Offline-First**: All data is stored locally in the browser (`localStorage`), ensuring functionality without an internet connection.
- **Material Design 3**: Modern, responsive interface with Dark/Light mode support.
- **OmniSearch**: Quickly find lab records, clinical protocols, and printable resources.
- **Export/Import**: Standardized text summary for clinical notes and JSON backup/restore.

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3.
- **Patterns**: Functional UI updates, state-driven rendering.
- **Storage**: Browser `localStorage` with versioned migration support.
- **No Backend**: Privacy by design—clinical data never leaves the device.

## Installation
As a Progressive Web App (PWA), Lab Notes can be installed on any device:
1. Open the app in a supported browser (Chrome, Edge, Safari).
2. Click the "Install" icon in the address bar or select "Add to Home Screen" from the menu.

## Clinical Safety Notice
> [!IMPORTANT]
> This tool is intended for use by healthcare professionals as a decision-support aid. Clinical decisions should always be based on direct laboratory reports and institutional guidelines. The authors are not responsible for clinical outcomes.

## Development & Contribution
- **Setup**: No build step required. Simply serve the root directory.
- **Testing**: Vitest is used for clinical logic verification (see `tests/` directory - *Coming soon in Phase 2*).
- **Guidelines**: Follow Material Design 3 principles for UI additions.

---
*Developed for the clinical psychiatry and laboratory community.*
