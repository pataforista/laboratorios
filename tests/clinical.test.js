import { describe, it, expect } from 'vitest';
import { 
    analyzeANC, 
    auditSideEffects, 
    calculateFIB4, 
    calculateQTc, 
    calculateAnionGap, 
    calculateBunCrRatio, 
    calculateAstAltRatio,
    evaluateRecord
} from '../clinical.js';

describe('Clinical Logic: analyzeANC', () => {
    it('should return OK for normal ANC (>1.5)', () => {
        const result = analyzeANC(1.8);
        expect(result.status).toBe('OK');
    });

    it('should return WARNING for mild neutropenia (1.0 - 1.49)', () => {
        const result = analyzeANC(1.2);
        expect(result.status).toBe('WARNING');
    });

    it('should return DANGER for moderate neutropenia (0.5 - 0.99)', () => {
        const result = analyzeANC(0.8);
        expect(result.status).toBe('DANGER');
    });

    it('should return CRITICAL for agranulocytosis (<0.5)', () => {
        const result = analyzeANC(0.4);
        expect(result.status).toBe('CRITICAL');
    });

    it('should handle BEN/Duffy-null patients correctly', () => {
        const resultNormal = analyzeANC(1.2, false);
        const resultBEN = analyzeANC(1.2, true);
        expect(resultNormal.status).toBe('WARNING');
        expect(resultBEN.status).toBe('OK'); // 1.2 is OK for BEN
    });

    it('should handle null or invalid inputs', () => {
        expect(analyzeANC(null)).toBeNull();
        expect(analyzeANC(undefined)).toBeNull();
        expect(analyzeANC(NaN)).toBeNull();
    });
});

describe('Clinical Logic: auditSideEffects', () => {
    it('should detect constipation risk', () => {
        const effects = { constipation: 4 };
        const alerts = auditSideEffects(effects);
        expect(alerts.some(a => a.type === 'GI_Ileo')).toBe(true);
    });

    it('should detect fever risk', () => {
        const effects = { fever: true };
        const alerts = auditSideEffects(effects);
        expect(alerts.some(a => a.type === 'Infection_Myocarditis')).toBe(true);
    });

    it('should detect tachycardia', () => {
        const effects = { hr: 125 };
        const alerts = auditSideEffects(effects);
        expect(alerts.some(a => a.type === 'Cardio_Myocarditis')).toBe(true);
    });
});

describe('Clinical Logic: calculateFIB4', () => {
    it('should calculate correctly', () => {
        // (age * AST) / (plt * sqrt(ALT))
        // (50 * 40) / (200 * sqrt(36)) = 2000 / (200 * 6) = 2000 / 1200 = 1.666
        const result = calculateFIB4(50, 40, 36, 200);
        expect(result).toBeCloseTo(1.67, 2);
    });

    it('should return null for missing inputs', () => {
        expect(calculateFIB4(50, 40, 36, null)).toBeNull();
    });
});

describe('Clinical Logic: calculateQTc', () => {
    it('should calculate Fridericia correctly', () => {
        // QTc = QT / RR^(1/3)
        // RR = 60/60 = 1s
        // QTc = 400 / 1^(1/3) = 400
        const result = calculateQTc(400, 60, 'fridericia');
        expect(result).toBe(400);
    });

    it('should calculate Bazett correctly', () => {
        // QTc = QT / sqrt(RR)
        // RR = 60/60 = 1s
        const result = calculateQTc(400, 60, 'bazett');
        expect(result).toBe(400);
    });
});

describe('Clinical Logic: calculateAnionGap', () => {
    it('should calculate correctly without albumin correction', () => {
        // Na=140, Cl=100, HCO3=24 => 140 - 124 = 16
        expect(calculateAnionGap(140, 100, 24)).toBe(16);
    });

    it('should apply albumin correction', () => {
        // Na=140, Cl=100, HCO3=24 => AG=16
        // Alb=3.0 => Correction = 2.5 * (4 - 3) = 2.5
        // Total = 16 + 2.5 = 18.5
        expect(calculateAnionGap(140, 100, 24, 3.0)).toBe(18.5);
    });
});

describe('Clinical Logic: calculateBunCrRatio', () => {
    it('should calculate correctly', () => {
        expect(calculateBunCrRatio(20, 1.0)).toBe(20);
    });
    it('should return null if Cr is 0', () => {
        expect(calculateBunCrRatio(20, 0)).toBeNull();
    });
});

describe('Clinical Logic: calculateAstAltRatio', () => {
    it('should calculate correctly', () => {
        expect(calculateAstAltRatio(40, 20)).toBe(2);
    });
});

describe('Clinical Logic: evaluateRecord', () => {
    const mockCatalog = {
        panels: [
            {
                panel_id: "hemogram",
                name: "Hemograma completo",
                analytes: [
                    { analyte_id: "wbc", name: "Leucocitos", units: "/µL", ref_ranges: [{ sex: "any", low: 4000, high: 10000 }] },
                    { analyte_id: "anc", name: "Neutrófilos", units: "/µL", ref_ranges: [{ sex: "any", low: 1500, high: 8000 }] }
                ]
            },
            {
                panel_id: "renal",
                name: "Función renal",
                analytes: [
                    { analyte_id: "sodium", name: "Sodio", units: "mEq/L", ref_ranges: [{ sex: "any", low: 135, high: 145 }] },
                    { analyte_id: "chloride", name: "Cloro", units: "mEq/L", ref_ranges: [{ sex: "any", low: 96, high: 106 }] },
                    { analyte_id: "bicarb", name: "Bicarbonato", units: "mEq/L", ref_ranges: [{ sex: "any", low: 22, high: 29 }] },
                    { analyte_id: "albumin", name: "Albúmina", units: "g/dL", ref_ranges: [{ sex: "any", low: 3.5, high: 5.0 }] }
                ],
                derived_metrics: [
                    {
                        metric_id: "anion_gap",
                        name: "Brecha aniónica (Anion Gap)",
                        units: "mEq/L",
                        ref_range: { low: 8, high: 16 }
                    }
                ]
            }
        ]
    };

    it('should evaluate normal records with no alerts', () => {
        const record = {
            id: "rec_1",
            date: "2026-07-13",
            sex: "male",
            isClozapine: false,
            isBEN: false,
            data: { wbc: 5000, anc: 2000 },
            panels: [
                {
                    panel_id: "hemogram",
                    results: [
                        { analyte_id: "wbc", value: 5000 },
                        { analyte_id: "anc", value: 2000 }
                    ]
                }
            ]
        };

        const result = evaluateRecord(record, mockCatalog);
        expect(result.alerts).toHaveLength(0);
        expect(result.panelEvals.hemogram).toHaveLength(2);
        expect(result.panelEvals.hemogram[0].status).toBe("normal");
    });

    it('should raise alert for agranulocytosis in Clozapine patients', () => {
        const record = {
            id: "rec_2",
            date: "2026-07-13",
            sex: "male",
            isClozapine: true,
            isBEN: false,
            data: { anc: 400 },
            panels: [
                {
                    panel_id: "hemogram",
                    results: [
                        { analyte_id: "anc", value: 400 }
                    ]
                }
            ]
        };

        const result = evaluateRecord(record, mockCatalog);
        expect(result.alerts.some(a => a.title === "ALERTA ANC (CLZ)" && a.type === "danger")).toBe(true);
    });

    it('should check permanent suspension REMS alert based on history', () => {
        const record = {
            id: "rec_current",
            date: "2026-07-13",
            sex: "male",
            isClozapine: true,
            isBEN: false,
            data: { anc: 400 },
            panels: [
                {
                    panel_id: "hemogram",
                    results: [{ analyte_id: "anc", value: 400 }]
                }
            ]
        };

        const history = [
            {
                id: "rec_old",
                date: "2026-06-13",
                sex: "male",
                isClozapine: true,
                isBEN: false,
                data: { anc: 350 },
                panels: [
                    {
                        panel_id: "hemogram",
                        results: [{ analyte_id: "anc", value: 350 }]
                    }
                ]
            }
        ];

        const result = evaluateRecord(record, mockCatalog, history);
        expect(result.alerts.some(a => a.title === "SUSPENSIÓN PERMANENTE")).toBe(true);
    });

    it('should detect constipation and fever triage alerts', () => {
        const record = {
            id: "rec_triage",
            date: "2026-07-13",
            sex: "male",
            isClozapine: true,
            isBEN: false,
            panels: [],
            clinical: {
                triage: {
                    constipation: 4,
                    somnolence: 1,
                    fever: true
                }
            }
        };

        const result = evaluateRecord(record, mockCatalog);
        expect(result.alerts.some(a => a.title === "RIESGO DE ÍLEO")).toBe(true);
        expect(result.alerts.some(a => a.title === "ALERTA DE FIEBRE")).toBe(true);
    });

    it('should calculate and evaluate derived metrics like Anion Gap', () => {
        const record = {
            id: "rec_derived",
            date: "2026-07-13",
            sex: "male",
            isClozapine: false,
            isBEN: false,
            panels: [
                {
                    panel_id: "renal",
                    results: [
                        { analyte_id: "sodium", value: 140 },
                        { analyte_id: "chloride", value: 100 },
                        { analyte_id: "bicarb", value: 20 },
                        { analyte_id: "albumin", value: 3.0 }
                    ]
                }
            ]
        };

        const result = evaluateRecord(record, mockCatalog);
        // AG = 140 - (100 + 20) = 20
        // albumin correction: 20 + 2.5 * (4.0 - 3.0) = 22.5
        // normal AG is 8-16, so 22.5 is high/abnormal
        const agResult = result.panelEvals.renal.find(e => e.isDerived);
        expect(agResult).toBeDefined();
        expect(agResult.scaled).toBe(22.5);
        expect(agResult.status).toBe("high");
    });
});
