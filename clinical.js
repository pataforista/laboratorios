/**
 * clinical.js - Centralized Clinical Logic
 * Based on:
 * - 2024-2025 APA Practice Guidelines for Schizophrenia.
 * - FDA Clozapine REMS Program (v3.0).
 * - Consensus on Clozapine-Induced Gastrointestinal Hypomotility (CIGH).
 */

/**
 * Clinical rules and thresholds for laboratory values and side effects.
 * @type {Object}
 */
export const CLINICAL_RULES = {
    // Neutropenia Thresholds (ANC in x10³/µL)
    // Ref: Clozapine REMS (US FDA)
    ANC: {
        NORMAL: { START: 1.5, WARN: 1.5, CRITICAL: 1.0 },
        BEN: { START: 1.0, WARN: 1.0, CRITICAL: 0.5 }
    },
    // Side Effect Severity Thresholds (0-5 scale)
    // Ref: Porcelli et al. (2020) - Gastric Hypomotility in Clozapine
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
 * Analyzes Absolute Neutrophil Count (ANC) levels.
 * @param {number} anc - ANC value in k/µL (x10³/µL).
 * @param {boolean} [isBEN=false] - Whether the patient has Benign Ethnic Neutropenia.
 * @returns {Object|null} Status object with status, message, and action.
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
 * Audits clinical side effects for red flags.
 * @param {Object} effects - Map of effects (constipation, fever, somnolence).
 * @returns {Array<Object>} List of clinical alerts.
 */
export function auditSideEffects(effects = {}) {
    const alerts = [];

    if (effects.constipation >= CLINICAL_RULES.SIDE_EFFECTS.CONSTIPATION_MAX) {
        alerts.push({
            type: 'GI_Ileo',
            title: 'RIESGO DE ÍLEO',
            severity: 'HIGH',
            message: 'Estreñimiento severo detectado. Riesgo de obstrucción.',
            advice: 'Considerar laxantes. Evitar Psyllium. (Ref: CIGH Guidelines)'
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
            advice: 'Evaluar ajuste de dosis. Evitar conducción/maquinaria.'
        });
    }

    return alerts;
}
