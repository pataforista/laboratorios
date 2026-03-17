/**
 * clinical.js - Centralized Clinical Logic
 * Based on 2024-2025 Guidelines for Clozapine and General Labs
 */

export const CLINICAL_RULES = {
    // Neutropenia Thresholds (ANC in x10³/µL)
    ANC: {
        NORMAL: { START: 1.5, WARN: 1.5, CRITICAL: 1.0 },
        BEN: { START: 1.0, WARN: 1.0, CRITICAL: 0.5 }
    },
    // Side Effect Severity Thresholds (0-5 scale)
    SIDE_EFFECTS: {
        CONSTIPATION_MAX: 3, // Above this, risk of Ileus
        SIALORRHEA_MAX: 3,
        SOMNOLENCE_MAX: 4
    },
    // Interaction Factors
    INTERACTIONS: {
        SMOKING_FACTOR: 2.0,
        CAFFEINE_LIMIT: 3,
    }
};

/**
 * Analyzes ANC levels and returns a status object
 */
export function analyzeANC(anc, isBEN = false) {
    if (anc === null || anc === undefined || isNaN(anc)) return null;
    const limits = isBEN ? CLINICAL_RULES.ANC.BEN : CLINICAL_RULES.ANC.NORMAL;

    if (anc < limits.CRITICAL) {
        return {
            status: 'CRITICAL',
            message: 'RIESGO DE AGRANULOCITOSIS. Descontinuar inmediatamente.',
            action: 'Emergencia médica.'
        };
    }

    if (anc < limits.WARN) {
        return {
            status: 'WARNING',
            message: 'Neutropenia detectada.',
            action: 'Monitoreo frecuente requerido.'
        };
    }

    return {
        status: 'OK',
        message: 'Niveles de ANC estables.',
        action: 'Continuar monitoreo.'
    };
}

/**
 * Checks for clinical red flags in side effects
 */
export function auditSideEffects(effects = {}) {
    const alerts = [];

    if (effects.constipation >= CLINICAL_RULES.SIDE_EFFECTS.CONSTIPATION_MAX) {
        alerts.push({
            type: 'GI_Ileo',
            title: 'RIESGO DE ÍLEO',
            severity: 'HIGH',
            message: 'Estreñimiento severo detectado. Riesgo de obstrucción.',
            advice: 'Considerar laxantes. Evitar Psyllium.'
        });
    }

    if (effects.fever) {
        alerts.push({
            type: 'Infection_Myocarditis',
            title: 'ALERTA DE FIEBRE',
            severity: 'CRITICAL',
            message: 'Fiebre detectada durante el tratamiento.',
            advice: 'Descartar infección o Miocarditis. Solicitar ANC y Troponina.'
        });
    }

    if (effects.somnolence >= CLINICAL_RULES.SIDE_EFFECTS.SOMNOLENCE_MAX) {
        alerts.push({
            type: 'Sedation_Risk',
            title: 'SOMNOLENCIA SEVERA',
            severity: 'HIGH',
            message: `Somnolencia ${effects.somnolence}/5. Riesgo de sedación excesiva.`,
            advice: 'Evaluar ajuste de dosis. Evitar conducción/maquinaria. Descartar hipotiroidismo.'
        });
    }

    return alerts;
}
