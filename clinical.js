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
    // Ref: Clozapine REMS (US FDA v3.0)
    ANC: {
        NORMAL: { START: 1.5, WARN: 1.5, MODERATE: 1.0, CRITICAL: 0.5 },
        BEN: { START: 1.0, WARN: 1.0, MODERATE: 0.5, CRITICAL: 0.5 }
    },
    // Side Effect Severity Thresholds (0-5 scale)
    // Ref: Porcelli et al. (2020) - Gastric Hypomotility in Clozapine
    SIDE_EFFECTS: {
        CONSTIPATION_MAX: 3, // Above this, risk of Ileus
        SIALORRHEA_MAX: 3,
        SOMNOLENCE_MAX: 4,
        HEART_RATE_MAX: 120, // Red flag for Myocarditis
        TEMP_MAX: 38.0
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
            message: 'AGRANULOCITOSIS (<500). Descontinuar inmediatamente.',
            action: 'Suspensión permanente probable.'
        };
    }

    if (anc < limits.MODERATE) {
        return {
            status: 'DANGER',
            message: 'Neutropenia MODERADA.',
            action: 'Monitoreo diario. Consultar hematología.'
        };
    }

    if (anc < limits.WARN) {
        return {
            status: 'WARNING',
            message: 'Neutropenia LEVE (1000-1499).',
            action: 'Monitoreo 3 veces por semana.'
        };
    }

    return {
        status: 'OK',
        message: 'Niveles de ANC estables.',
        action: 'Continuar monitoreo semanal.'
    };
}

/**
 * Audits clinical side effects for red flags.
 * @param {Object} effects - Map of effects (constipation, fever, somnolence, hr, bp).
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

    if (effects.fever || (effects.temp && effects.temp >= CLINICAL_RULES.SIDE_EFFECTS.TEMP_MAX)) {
        alerts.push({
            type: 'Infection_Myocarditis',
            title: 'ALERTA DE FIEBRE',
            severity: 'CRITICAL',
            message: 'Fiebre detectada durante el tratamiento.',
            advice: 'Descartar infección o Miocarditis. Solicitar ANC, Troponina y PCR.'
        });
    }

    if (effects.hr && effects.hr >= CLINICAL_RULES.SIDE_EFFECTS.HEART_RATE_MAX) {
        alerts.push({
            type: 'Cardio_Myocarditis',
            title: 'TAQUICARDIA SEVERA',
            severity: 'CRITICAL',
            message: `FC ${effects.hr} lpm detectada.`,
            advice: 'Riesgo alto de miocarditis/insuficiencia. Solicitar ECG y Troponina.'
        });
    }

    if (effects.somnolence >= CLINICAL_RULES.SIDE_EFFECTS.SOMNOLENCE_MAX) {
        alerts.push({
            type: 'Sedation_Risk',
            title: 'SOMNOLENCIA SEVERA',
            severity: 'HIGH',
            message: `Somnolencia ${effects.somnolence}/5. Riesgo de sedación excesiva.`,
            advice: 'Evaluar ajuste de dosis. Consultar guía de reducción en Manual.'
        });
    }

    return alerts;
}

/**
 * Calculates FIB-4 score for liver fibrosis.
 * Formula: (age * AST) / (platelets * sqrt(ALT))
 * @param {number} age
 * @param {number} ast
 * @param {number} alt
 * @param {number} plt - Platelets in k/µL
 * @returns {number|null}
 */
export function calculateFIB4(age, ast, alt, plt) {
    if (!age || !ast || !alt || !plt) return null;
    return (age * ast) / (plt * Math.sqrt(alt));
}

/**
 * Calculates QTc using Fridericia or Bazett formula.
 * @param {number} qt - QT interval in ms.
 * @param {number} hr - Heart rate in bpm.
 * @param {string} [formula='fridericia']
 * @returns {number|null}
 */
export function calculateQTc(qt, hr, formula = 'fridericia') {
    if (!qt || !hr) return null;
    const rr = 60 / hr;
    if (formula === 'bazett') return qt / Math.sqrt(rr);
    return qt / Math.pow(rr, 1/3); // Fridericia
}
/**
 * Calculates Anion Gap, optionally corrected for albumin.
 * Formula: Na - (Cl + HCO3)
 * Correction: AG + 2.5 * (4.0 - Albumin) if Albumin < 4.0
 * @param {number} na
 * @param {number} cl
 * @param {number} hco3
 * @param {number} [alb] - Albumin in g/dL
 * @returns {number|null}
 */
export function calculateAnionGap(na, cl, hco3, alb = null) {
    if (!na || !cl || !hco3) return null;
    let ag = na - (cl + hco3);
    if (alb !== null && alb < 4.0) {
        ag = ag + 2.5 * (4.0 - alb);
    }
    return ag;
}

/**
 * Calculates BUN/Creatinine ratio.
 * @param {number} bun
 * @param {number} cr
 * @returns {number|null}
 */
export function calculateBunCrRatio(bun, cr) {
    if (!bun || !cr || cr === 0) return null;
    return bun / cr;
}

/**
 * Calculates AST/ALT ratio (De Ritis).
 * @param {number} ast
 * @param {number} alt
 * @returns {number|null}
 */
export function calculateAstAltRatio(ast, alt) {
    if (!ast || !alt || alt === 0) return null;
    return ast / alt;
}
