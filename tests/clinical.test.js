import { describe, it, expect } from 'vitest';
import { 
    analyzeANC, 
    auditSideEffects, 
    calculateFIB4, 
    calculateQTc, 
    calculateAnionGap, 
    calculateBunCrRatio, 
    calculateAstAltRatio 
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
