/**
 * BATMAN — Background Synchronization Service
 * Manages idempotent synchronization from LocalStorage queue to Google Apps Script.
 */

const SyncService = {
  isSyncing: false,
  debounceTimer: null,

  init() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      // 1. Auto-sync on data & queue mutations (triggered on every prayer, timer, weight, surah update)
      window.addEventListener('batman:queue-updated', () => {
        this.scheduleDebouncedSync(2000);
      });

      window.addEventListener('batman:data-updated', () => {
        this.scheduleDebouncedSync(2500);
      });

      // 2. Auto-sync when internet reconnects
      window.addEventListener('online', () => {
        this.scheduleDebouncedSync(1000);
      });

      window.addEventListener('offline', () => {
        this.updateOfflineUI();
      });

      window.addEventListener('focus', () => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          this.scheduleDebouncedSync(1000);
        }
      });
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      // 3. Auto-sync when user returns/focuses the app on mobile or desktop
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && typeof navigator !== 'undefined' && navigator.onLine) {
          this.scheduleDebouncedSync(1000);
        }
      });
    }

    // 4. Wire header sync pill click
    const syncStatusPill = document.getElementById('sync-status');
    if (syncStatusPill) {
      syncStatusPill.addEventListener('click', () => {
        this.openSyncStatusModal();
      });
    }

    // 5. Periodic background heartbeat check (every 30 seconds)
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        const queue = StorageService.getSyncQueue();
        if (queue.length > 0) {
          this.syncNow(false);
        }
      }
    }, 30000);

    // 6. Initial app boot sync check (1.2s delay): push pending, then pull latest cloud state
    setTimeout(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
        const queue = StorageService.getSyncQueue();
        if (queue.length > 0) {
          await this.syncNow(false);
        }
        await this.pullFromCloud(false);
      } else {
        StorageService.updateSyncUI();
      }
    }, 1200);
  },

  scheduleDebouncedSync(delayMs = 2000) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const settings = StorageService.getSettings();
      if (settings.gasWebAppUrl && navigator.onLine && !this.isSyncing) {
        const queue = StorageService.getSyncQueue();
        if (queue.length > 0) {
          await this.syncNow(false);
        }
      }
    }, delayMs);
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
        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
          <button id="modal-sync-now-btn" class="btn btn-primary" style="flex: 1; min-height: 44px;" ${this.isSyncing ? 'disabled' : ''}>
            ${this.isSyncing ? 'SYNCING...' : 'SYNC NOW (PUSH)'}
          </button>
          <button id="modal-pull-now-btn" class="btn btn-outline" style="flex: 1; min-height: 44px;" ${this.isSyncing ? 'disabled' : ''}>
            PULL FROM CLOUD
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
          await this.pullFromCloud(false);
        });
      }

      const pullBtn = document.getElementById('modal-pull-now-btn');
      if (pullBtn) {
        pullBtn.addEventListener('click', async () => {
          UI.closeBottomSheet();
          await this.pullFromCloud(true);
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
  },

  /**
   * Pull complete consolidated database from Google Sheets to hydrate current device
   * @param {boolean} [showToasts=false]
   */
  async pullFromCloud(showToasts = false) {
    if (this.isSyncing) return;

    const settings = StorageService.getSettings();
    const gasUrl = settings.gasWebAppUrl;

    if (!gasUrl) {
      if (showToasts) UI.showToast('Configure Google Apps Script URL in More tab first', 'info', 3500);
      return;
    }

    if (!navigator.onLine) {
      if (showToasts) UI.showToast('Device is offline', 'info');
      this.updateOfflineUI();
      return;
    }

    this.isSyncing = true;
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-status');
    if (syncIndicator) syncIndicator.className = 'sync-indicator syncing';
    if (syncText) syncText.textContent = 'Updating...';

    try {
      const apiToken = settings.gasApiToken || 'batman-secret-2026';
      const result = await ApiService.pullAllData(gasUrl, apiToken);

      if (result && result.success && result.data) {
        console.log('[Sync] Pulled from Google Sheets:', result.data);
        const dayCount = Object.keys(result.data.dayLogs || {}).length;
        const hydrated = StorageService.hydrateFromCloud(result.data);
        if (hydrated) {
          this.refreshAllModules();
          if (showToasts) {
            if (dayCount > 0) {
              UI.showToast(`Loaded ${dayCount} day(s) from Google Sheets ✓`, 'success', 3500);
            } else {
              UI.showToast('Connected to Google Sheets, but no logged days found yet. Please tap "Push Sync" on your mobile phone.', 'info', 4500);
            }
          }
        }
      } else {
        throw new Error(result.error || 'Failed to pull cloud data');
      }
    } catch (err) {
      console.warn('[Sync] Pull from cloud failed:', err.message);
      if (showToasts) UI.showToast(`Pull error: ${err.message}`, 'error', 4500);
    } finally {
      this.isSyncing = false;
      StorageService.updateSyncUI();
    }
  },

  /**
   * Re-render all views and modules after cloud data hydration
   */
  refreshAllModules() {
    if (window.DashboardModule && window.DashboardModule.renderDashboard) window.DashboardModule.renderDashboard();
    if (window.DeenModule && window.DeenModule.renderDeen) window.DeenModule.renderDeen();
    if (window.QuranModule && window.QuranModule.renderQuran) window.QuranModule.renderQuran();
    if (window.CyberModule && window.CyberModule.renderCyber) window.CyberModule.renderCyber();
    if (window.EnglishModule && window.EnglishModule.renderEnglish) window.EnglishModule.renderEnglish();
    if (window.FitnessModule && window.FitnessModule.renderFitness) window.FitnessModule.renderFitness();
    if (window.SleepModule && window.SleepModule.renderSleep) window.SleepModule.renderSleep();
    if (window.GoalsModule && window.GoalsModule.renderGoals) window.GoalsModule.renderGoals();
    if (window.ProgressModule && window.ProgressModule.renderProgress) window.ProgressModule.renderProgress();
    if (window.SettingsModule && window.SettingsModule.loadSettingsToUI) window.SettingsModule.loadSettingsToUI();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.SyncService = SyncService;
}
