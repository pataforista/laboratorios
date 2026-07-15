import { describe, it, expect } from 'vitest';
import { evaluateRecord } from '../clinical.js';

describe('Integration: Record Lifecycle & Serialization', () => {
    const mockCatalog = {
        panels: [
            {
                panel_id: "hemogram",
                name: "Biometría Hemática",
                analytes: [
                    { analyte_id: "anc", name: "Neutrófilos", units: "/µL", ref_ranges: [{ sex: "any", low: 1500, high: 8000 }] }
                ]
            }
        ]
    };

    it('should correctly evaluate, serialize, and deserialize a clinical record', () => {
        // 1. Simulating record creation in UI
        const newRecord = {
            id: "rec_999",
            date: "2026-07-13",
            sex: "female",
            isClozapine: true,
            isBEN: false,
            data: { anc: 1800 },
            panels: [
                {
                    panel_id: "hemogram",
                    results: [{ analyte_id: "anc", value: 1800 }]
                }
            ],
            clinical: {
                triage: { constipation: 0, somnolence: 2, fever: false }
            }
        };

        // 2. Clinical Evaluation
        newRecord.eval = evaluateRecord(newRecord, mockCatalog);
        expect(newRecord.eval.alerts).toHaveLength(0); // Normal ANC and no triage alarms
        expect(newRecord.eval.panelEvals.hemogram[0].status).toBe("normal");

        // 3. Serialize to JSON (Simulating backup/export)
        const jsonExport = JSON.stringify({ records: [newRecord] });
        expect(jsonExport).toContain("rec_999");
        expect(jsonExport).toContain("hemogram");

        // 4. Deserialize and parse (Simulating import)
        const importedData = JSON.parse(jsonExport);
        expect(importedData.records).toHaveLength(1);
        const importedRecord = importedData.records[0];

        // 5. Verify integrity of imported record
        expect(importedRecord.id).toBe(newRecord.id);
        expect(importedRecord.date).toBe(newRecord.date);
        expect(importedRecord.isClozapine).toBe(true);
        expect(importedRecord.data.anc).toBe(1800);
        expect(importedRecord.eval.panelEvals.hemogram[0].name).toBe("Neutrófilos");
    });
});
