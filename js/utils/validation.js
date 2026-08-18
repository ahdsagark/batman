/**
 * BATMAN — Input Validation & Sanitization Utilities
 */

const ValidationUtils = {
  /**
   * Sanitize string against XSS and excessive spacing
   */
  sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .trim();
  },

  /**
   * Validate number within specified range
   */
  validateNumber(value, min = 0, max = Infinity, defaultVal = 0) {
    const n = parseFloat(value);
    if (isNaN(n)) return defaultVal;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  },

  /**
   * Validate IELTS band score (0.0 to 9.0 in 0.5 steps)
   */
  validateIeltsBand(band) {
    const b = parseFloat(band);
    if (isNaN(b) || b < 0 || b > 9.0) return 0;
    return Math.round(b * 2) / 2; // enforce 0.5 intervals
  },

  /**
   * Validate ISO date string (YYYY-MM-DD)
   */
  isValidISODate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const reg = /^\d{4}-\d{2}-\d{2}$/;
    if (!reg.test(dateStr)) return false;
    const d = new Date(dateStr + 'T00:00:00');
    return !isNaN(d.getTime());
  }
};

if (typeof window !== 'undefined') {
  window.ValidationUtils = ValidationUtils;
}
