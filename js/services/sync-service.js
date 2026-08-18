/**
 * BATMAN — Background Synchronization Service
 * Manages idempotent synchronization from LocalStorage queue to Google Apps Script.
 */

const SyncService = {
  isSyncing: false,

  init() {
    // Listen for online events to auto-trigger synchronization
    window.addEventListener('online', () => {
      UI.showToast('Online: Synchronizing...', 'info', 2000);
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.updateOfflineUI();
    });

    // Wire sync status pill click
    const syncStatusPill = document.getElementById('sync-status');
    if (syncStatusPill) {
      syncStatusPill.addEventListener('click', () => {
        this.openSyncStatusModal();
      });
    }

    // Check initial status
    if (!navigator.onLine) {
      this.updateOfflineUI();
    } else {
      StorageService.updateSyncUI();
    }
  },

  updateOfflineUI() {
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-status');
    if (!syncText || !syncIndicator) return;
    syncText.textContent = 'Offline';
    syncIndicator.className = 'sync-indicator offline';
  },

  openSyncStatusModal() {
    const queue = StorageService.getSyncQueue();
    const settings = StorageService.getSettings();
    const isConfigured = Boolean(settings.gasWebAppUrl);
    const count = queue.length;

    let html = `
      <div style="text-align: center; padding: var(--space-3) 0;">
        <div style="font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary); margin-bottom: var(--space-2);">
          ${count === 0 ? 'ALL DATA SYNCED' : 'SYNC STATUS'}
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
          ${count === 0 
            ? 'All local records are synchronized with your Google Sheets database.' 
            : `<strong>${count}</strong> record${count === 1 ? '' : 's'} waiting to sync to Google Sheets.`}
        </div>
        ${!isConfigured ? `
          <div class="warning-box" style="text-align: left; margin-bottom: var(--space-4);">
            <span>ℹ️</span>
            <span>Google Apps Script URL is not set. You can set it in <strong>More &gt; Google Apps Script Sync</strong>.</span>
          </div>
        ` : ''}
        <div style="display: flex; gap: var(--space-3); margin-top: var(--space-3);">
          <button id="modal-sync-now-btn" class="btn btn-primary" style="flex: 1; min-height: 44px;" ${this.isSyncing ? 'disabled' : ''}>
            ${this.isSyncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
        </div>
      </div>
    `;

    UI.showBottomSheet('Sync Status', html);

    setTimeout(() => {
      const btn = document.getElementById('modal-sync-now-btn');
      if (btn) {
        btn.addEventListener('click', async () => {
          UI.closeBottomSheet();
          await this.syncNow(true);
        });
      }
    }, 50);
  },

  /**
   * Process all pending items in sync queue using chunked batching
   * @param {boolean} [showToasts=false] 
   */
  async syncNow(showToasts = false) {
    if (this.isSyncing) return;

    const settings = StorageService.getSettings();
    const gasUrl = settings.gasWebAppUrl;

    if (!gasUrl) {
      if (showToasts) {
        UI.showToast('Configure Google Apps Script URL in More tab to sync', 'info', 3500);
      }
      StorageService.updateSyncUI();
      return;
    }

    if (!navigator.onLine) {
      if (showToasts) UI.showToast('Device is offline. Changes are saved locally.', 'info');
      this.updateOfflineUI();
      return;
    }

    const currentQueue = StorageService.getSyncQueue();
    if (currentQueue.length === 0) {
      if (showToasts) UI.showToast('All data is already synced ✓', 'success');
      StorageService.updateSyncUI();
      return;
    }

    this.isSyncing = true;
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-status');
    if (syncIndicator) syncIndicator.className = 'sync-indicator syncing';

    const CHUNK_SIZE = 15;
    const apiToken = settings.gasApiToken || 'batman-secret-2026';
    let totalSynced = 0;
    let hasError = false;
    let lastErrorMsg = '';

    try {
      while (true) {
        const queueSnapshot = StorageService.getSyncQueue();
        if (queueSnapshot.length === 0) break;

        const chunk = queueSnapshot.slice(0, CHUNK_SIZE).map(item => ({
          id: item.id,
          timestamp: item.timestamp,
          table: item.table,
          action: item.action,
          data: item.data
        }));

        if (chunk.length === 0) break;

        const remaining = queueSnapshot.length;
        if (syncText) syncText.textContent = `Syncing (${remaining})...`;

        // Send chunk snapshot to Apps Script with extended 45s timeout
        const result = await ApiService.syncBatch(gasUrl, chunk, apiToken);

        if (result && result.success) {
          // Atomically remove ONLY the items that were in this batch and unmodified since
          StorageService.removeSyncedItems(chunk);
          totalSynced += chunk.length;
          StorageService.updateSyncUI();
        } else {
          hasError = true;
          lastErrorMsg = (result && result.error) ? result.error : 'Sync failed';
          break;
        }
      }

      if (!hasError && totalSynced > 0) {
        if (showToasts) UI.showToast(`Synced ${totalSynced} record(s) to Google Sheets ✓`, 'success', 3500);
      } else if (hasError) {
        throw new Error(lastErrorMsg || 'Sync failed');
      }
    } catch (err) {
      console.warn('[Sync] Sync failed:', err.message);
      if (showToasts) UI.showToast(`Sync error: ${err.message}`, 'error', 5000);
    } finally {
      this.isSyncing = false;
      StorageService.updateSyncUI();
    }
  }
};

if (typeof window !== 'undefined') {
  window.SyncService = SyncService;
}
