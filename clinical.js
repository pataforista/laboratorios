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

/**
 * Standard unit conversion factors and target SI units for laboratory analytes.
 * @type {Object}
 */
export const CONVERSIONS = {
    glucose_fasting: { factor: 1 / 18.01, unit: "mmol/L" },
    creatinine: { factor: 88.4, unit: "µmol/L" },
    bun: { factor: 1 / 2.8, unit: "mmol/L" },
    chol_total: { factor: 1 / 38.67, unit: "mmol/L" },
    ldl: { factor: 1 / 38.67, unit: "mmol/L" },
    hdl: { factor: 1 / 38.67, unit: "mmol/L" },
    triglycerides: { factor: 1 / 88.57, unit: "mmol/L" },
    bili_total: { factor: 17.1, unit: "µmol/L" },
    bili_direct: { factor: 17.1, unit: "µmol/L" }
};

/**
 * Scales a raw input value based on a modifier (e.g. "x10^3").
 * @param {number|string} v - The raw value.
 * @param {string|null} mod - The modifier.
 * @returns {number|undefined} The scaled numeric value or undefined if empty.
 */
export function getActualValue(v, mod) {
    if (v === "" || v === undefined || v === null) return undefined;
    return mod === "x10^3" ? Number(v) * 1000 : Number(v);
}

/**
 * Evaluates a patient record against clinical catalog thresholds and rules.
 * @param {Object} rec - The record to evaluate.
 * @param {Object} catalog - The lab catalog.
 * @param {Array<Object>} [history=[]] - List of previous patient records.
 * @returns {Object} Evaluation results containing alerts and panel-specific data.
 */
export function evaluateRecord(rec, catalog, history = []) {
    const alerts = [];
    const panelEvals = {};
    const allAnalytes = {};
    const alertedAnalytes = new Set();

    if (!catalog || !catalog.panels) {
        return { alerts, panelEvals };
    }

    rec.panels.forEach(p => {
        const panelDef = catalog.panels.find(x => x.panel_id === p.panel_id);
        if (!panelDef) return;

        panelEvals[p.panel_id] = p.results.map(r => {
            const a = panelDef.analytes.find(x => x.analyte_id === r.analyte_id);
            if (!a) return { ...r, status: "normal", statusLabel: "" };

            const v = (a.units === "qual" || a.units === "text") ? r.value : getActualValue(r.value, r.modifier);

            let status = "normal";
            let statusLabel = "";

            if (a.critical && typeof v === 'number') {
                const crit = a.critical.find(c => (c.op === "<" && v < c.value) || (c.op === ">" && v > c.value));
                if (crit) {
                    status = "critical";
                    statusLabel = crit.label;
                    if (!alertedAnalytes.has(r.analyte_id)) {
                        alerts.push({ type: 'critical', msg: `${a.name}: CRÍTICO (${v} ${a.units})` });
                        alertedAnalytes.add(r.analyte_id);
                    }
                }
            }

            if (status !== 'critical' && a.flags && typeof v === 'number') {
                const flag = a.flags.find(f => (f.op === "<" && v < f.value) || (f.op === "<=" && v <= f.value) || (f.op === ">" && v > f.value) || (f.op === ">=" && v >= f.value));
                if (flag) {
                    status = "warn";
                    statusLabel = flag.label;
                    if (!alertedAnalytes.has(r.analyte_id)) {
                        alerts.push({ type: 'warn', msg: `${a.name}: ${flag.label.replace(/_/g, ' ')}` });
                        alertedAnalytes.add(r.analyte_id);
                    }
                }
            }

            if (status === "normal" && a.ref_ranges) {
                let ref = a.ref_ranges.find(x => x.sex === rec.sex) || a.ref_ranges.find(x => x.sex === "any") || a.ref_ranges[0];
                if (a.units === "qual") { 
                    if (v !== ref.qualitative_normal) status = "warn"; 
                } else if (typeof v === 'number') {
                    if (ref.low !== undefined && v < ref.low) status = "low";
                    if (ref.high !== undefined && v > ref.high) status = "high";
                }
            }

            const evalResult = {
                ...r, 
                scaled: v, 
                name: a.name, 
                units: a.units, 
                status, 
                statusLabel,
                hints: a.interpretation_hints || [], 
                checklist: a.follow_up_checklist || [],
                conv: CONVERSIONS[r.analyte_id] ? { 
                    val: (v * CONVERSIONS[r.analyte_id].factor).toFixed(2), 
                    unit: CONVERSIONS[r.analyte_id].unit 
                } : null
            };
            allAnalytes[r.analyte_id] = evalResult;
            return evalResult;
        });
    });

    // Derived Metrics (Anion Gap, BUN/Cr, AST/ALT)
    rec.panels.forEach(p => {
        const panelDef = catalog.panels.find(x => x.panel_id === p.panel_id);
        if (!panelDef || !panelDef.derived_metrics) return;
        
        panelDef.derived_metrics.forEach(m => {
            let val = null;
            if (m.metric_id === "anion_gap") { 
                const na = allAnalytes.sodium?.scaled, cl = allAnalytes.chloride?.scaled, hco3 = allAnalytes.bicarb?.scaled; 
                if (na !== undefined && cl !== undefined && hco3 !== undefined) {
                    val = na - (cl + hco3);
                    const alb = allAnalytes.albumin?.scaled; // g/dL
                    if (alb !== undefined && alb < 4.0) {
                        val = val + 2.5 * (4.0 - alb);
                    }
                }
            } else if (m.metric_id === "bun_cr_ratio") { 
                const bun = allAnalytes.bun?.scaled, cr = allAnalytes.creatinine?.scaled; 
                if (bun !== undefined && cr !== undefined && cr > 0) {
                    val = bun / cr; 
                }
            } else if (m.metric_id === "ast_alt_ratio") { 
                const ast = allAnalytes.ast?.scaled, alt = allAnalytes.alt?.scaled; 
                if (ast !== undefined && alt !== undefined && alt > 0) {
                    val = ast / alt; 
                }
            }

            if (val !== null) {
                let status = "normal";
                if (m.ref_range) { 
                    if (val < m.ref_range.low) status = "low"; 
                    if (val > m.ref_range.high) status = "high"; 
                }
                if (!panelEvals[p.panel_id]) panelEvals[p.panel_id] = [];
                panelEvals[p.panel_id].push({ 
                    name: `(Calc) ${m.name}`, 
                    value: val.toFixed(1), 
                    scaled: val, 
                    units: m.units || "", 
                    status, 
                    isDerived: true, 
                    hints: m.interpretation_hints || [] 
                });
                if (status !== "normal") {
                    alerts.push({ type: 'info', msg: `Métrica: ${m.name} fuera de rango (${val.toFixed(1)})` });
                }
            }
        });
    });

    // Clinical alerts (if Clozapine)
    if (rec.isClozapine) {
        if (rec.clinical) {
            const sideAlerts = auditSideEffects({
                constipation: rec.clinical.triage?.constipation,
                somnolence: rec.clinical.triage?.somnolence,
                fever: rec.clinical.triage?.fever,
                hr: rec.clinical.triage?.hr,
                bp: rec.clinical.triage?.bp
            });
            sideAlerts.forEach(a => {
                alerts.push({
                    type: "danger",
                    title: a.title,
                    msg: a.message,
                    hint: a.advice
                });
            });
        }

        const ancVal = rec.data ? rec.data["anc"] : undefined; // stored as /µL (e.g. 1800)
        if (ancVal !== undefined && !isNaN(ancVal) && ancVal !== null) {
            // analyzeANC expects k/µL, so divide by 1000
            const ancK = ancVal / 1000;
            const ancAnalysis = analyzeANC(ancK, rec.isBEN);
            if (ancAnalysis && ancAnalysis.status !== "OK") {
                alerts.push({
                    type: ancAnalysis.status === "CRITICAL" ? "danger" : "warning",
                    title: "ALERTA ANC (CLZ)",
                    msg: `ANC: ${ancK.toFixed(2)} k/µL — ${ancAnalysis.message}`,
                    hint: ancAnalysis.action
                });
            }
        }

        // Permanent Suspension Check (REMS)
        const histRecords = history.filter(r => r.isClozapine && r.id !== rec.id);
        const criticalHistory = histRecords.filter(h => (h.data?.anc !== undefined && h.data.anc < 500));
        const currentCritical = (rec.data?.anc !== undefined && rec.data.anc < 500);

        if (currentCritical && criticalHistory.length > 0) {
            alerts.push({
                type: "critical",
                title: "SUSPENSIÓN PERMANENTE",
                msg: "Segundo registro con ANC < 500 detectado.",
                hint: "Protocolo FDA REMS exige suspensión definitiva de Clozapina."
            });
        }
    }

    return { alerts, panelEvals };
}
