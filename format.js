/**
 * format.js - Centralized Clinical Format Utilities
 */

/**
 * Formats an ISO Date string (YYYY-MM-DD) to a localized clinical date.
 * @param {string} dateStr
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateStr;
  
  // Format as e.g. "14 jul 2026"
  const formatted = d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  return formatted.replace(/\.$/, ""); // remove trailing dot from month abbreviation
}

/**
 * Formats laboratory analyte value with correct units and scales.
 * @param {string} analyteId
 * @param {number|string} val
 * @param {string|null} [modifier=null]
 * @returns {string} Formatted value with units
 */
export function formatValue(analyteId, val, modifier = null) {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "string" && isNaN(Number(val))) {
    // qualitative or text values
    return val.charAt(0).toUpperCase() + val.slice(1);
  }

  const num = Number(val);
  
  // Highlight absolute cell counts
  if (["anc", "wbc", "alc", "mono_abs", "baso_abs", "eos_abs"].includes(analyteId)) {
    const valueInK = modifier === "x10^3" ? num : num / 1000;
    return `${valueInK.toFixed(2)} k/µL`;
  }
  
  if (analyteId === "plt" || analyteId === "plt_abs") {
    const valueInK = modifier === "x10^3" ? num : num / 1000;
    return `${valueInK.toFixed(0)} k/µL`;
  }

  const formattedNum = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2
  }).format(num);

  return formattedNum;
}
