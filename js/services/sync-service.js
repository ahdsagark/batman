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
   * Process all pending items in sync queue
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

    const queue = StorageService.getSyncQueue();
    if (queue.length === 0) {
      if (showToasts) UI.showToast('All data is already synced', 'success');
      StorageService.updateSyncUI();
      return;
    }

    this.isSyncing = true;
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-status');
    if (syncText && syncIndicator) {
      syncText.textContent = 'Syncing...';
      syncIndicator.className = 'sync-indicator syncing';
    }

    try {
      // Send entire batch with stable IDs for idempotent upsert
      const result = await ApiService.syncBatch(gasUrl, queue);

      if (result && result.success) {
        // Clear all synced items
        StorageService.clearSyncQueue();
        if (showToasts) UI.showToast(`Synced ${queue.length} record(s) to Sheets`, 'success');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      console.warn('[Sync] Sync failed:', err.message);
      if (showToasts) UI.showToast(`Sync error: ${err.message}`, 'error', 4000);
      StorageService.updateSyncUI();
    } finally {
      this.isSyncing = false;
      StorageService.updateSyncUI();
    }
  }
};

if (typeof window !== 'undefined') {
  window.SyncService = SyncService;
}
