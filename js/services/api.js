/**
 * BATMAN — Google Apps Script API Client
 * Facilitates asynchronous, resilient HTTP communication with Google Apps Script Web App.
 */

const ApiService = {
  /**
   * Send JSON request to Google Apps Script Web App with Application Token
   * @param {string} endpointUrl 
   * @param {string} action 
   * @param {object} payload 
   * @param {number} [timeoutMs=10000] 
   * @param {string} [apiToken='batman-secret-2026']
   */
  async request(endpointUrl, action, payload = {}, timeoutMs = 45000, apiToken = 'batman-secret-2026') {
    if (!endpointUrl || !endpointUrl.startsWith('http')) {
      throw new Error('Google Apps Script URL is not configured.');
    }

    if (!navigator.onLine) {
      throw new Error('Device is currently offline.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          token: apiToken,
          action,
          payload,
          timestamp: DateUtils.getNowISO()
        }),
        redirect: 'follow',
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
        throw new Error('Network request timed out. Please check your Google Apps Script Web App URL and connectivity.');
      }
      throw err;
    }
  },

  /**
   * Test connection to Google Apps Script Web App
   * @param {string} endpointUrl 
   * @param {string} [apiToken='batman-secret-2026']
   */
  async testConnection(endpointUrl, apiToken = 'batman-secret-2026') {
    return this.request(endpointUrl, 'ping', { clientTime: DateUtils.getNowISO() }, 20000, apiToken);
  },

  /**
   * Send batch of items to Google Apps Script for idempotent upsert
   * @param {string} endpointUrl 
   * @param {Array<object>} items 
   * @param {string} [apiToken='batman-secret-2026']
   */
  async syncBatch(endpointUrl, items, apiToken = 'batman-secret-2026') {
    return this.request(endpointUrl, 'syncBatch', { items }, 45000, apiToken);
  }
};

if (typeof window !== 'undefined') {
  window.ApiService = ApiService;
}
