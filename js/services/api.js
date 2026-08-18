/**
 * BATMAN — Google Apps Script API Client
 * Facilitates asynchronous, resilient HTTP communication with Google Apps Script Web App.
 */

const ApiService = {
  /**
   * Send JSON request to Google Apps Script Web App
   * @param {string} endpointUrl 
   * @param {string} action 
   * @param {object} payload 
   * @param {number} [timeoutMs=10000] 
   */
  async request(endpointUrl, action, payload = {}, timeoutMs = 10000) {
    if (!endpointUrl || !endpointUrl.startsWith('http')) {
      throw new Error('Google Apps Script URL is not configured.');
    }

    if (!navigator.onLine) {
      throw new Error('Device is currently offline.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use text/plain or no-cors considerations typical for Google Apps Script redirects
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action,
          payload,
          timestamp: DateUtils.getNowISO()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown server error');
      }

      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Network request timed out');
      }
      throw err;
    }
  },

  /**
   * Test connection to Google Apps Script Web App
   * @param {string} endpointUrl 
   */
  async testConnection(endpointUrl) {
    return this.request(endpointUrl, 'ping', { clientTime: DateUtils.getNowISO() }, 8000);
  },

  /**
   * Send batch of items to Google Apps Script for idempotent upsert
   * @param {string} endpointUrl 
   * @param {Array<object>} items 
   */
  async syncBatch(endpointUrl, items) {
    return this.request(endpointUrl, 'syncBatch', { items });
  }
};

if (typeof window !== 'undefined') {
  window.ApiService = ApiService;
}
