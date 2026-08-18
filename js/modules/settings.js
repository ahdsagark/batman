/**
 * BATMAN — Settings & Configuration Module
 */

const SettingsModule = {
  init() {
    this.loadSettingsToUI();
    this.bindEvents();
  },

  loadSettingsToUI() {
    const settings = StorageService.getSettings();

    const nameInput = document.getElementById('setting-user-name');
    const heightInput = document.getElementById('setting-user-height');
    const currentWeightInput = document.getElementById('setting-current-weight');
    const weightTargetInput = document.getElementById('setting-target-weight');
    const citySelect = document.getElementById('setting-prayer-city');
    const methodSelect = document.getElementById('setting-prayer-method');
    const asrSelect = document.getElementById('setting-prayer-asr-method');
    const gasUrlInput = document.getElementById('setting-gas-url');
    const gasTokenInput = document.getElementById('setting-gas-token');
    const notifBtn = document.getElementById('btn-enable-notifs');
    const gasStatusBadge = document.getElementById('gas-connection-status');

    if (nameInput && settings.userName) nameInput.value = settings.userName;
    if (heightInput && settings.userHeight) heightInput.value = settings.userHeight;
    if (currentWeightInput && settings.currentWeight) currentWeightInput.value = settings.currentWeight;
    if (weightTargetInput && settings.targetWeight) weightTargetInput.value = settings.targetWeight;
    if (citySelect && settings.prayerCity) citySelect.value = settings.prayerCity;
    if (methodSelect && settings.prayerMethod) methodSelect.value = settings.prayerMethod;
    if (asrSelect && settings.prayerAsrMethod) asrSelect.value = settings.prayerAsrMethod;
    if (gasUrlInput && settings.gasWebAppUrl) gasUrlInput.value = settings.gasWebAppUrl;
    if (gasTokenInput) gasTokenInput.value = settings.gasApiToken || 'batman-secret-2026';

    // Notification permission status
    if (notifBtn) {
      if ('Notification' in window && Notification.permission === 'granted') {
        notifBtn.textContent = 'ALERTS ENABLED ✓';
        notifBtn.className = 'btn btn-success btn-sm';
      } else {
        notifBtn.textContent = 'ENABLE ALERTS';
        notifBtn.className = 'btn btn-primary btn-sm';
      }
    }

    // Individual notification toggles
    this.updateNotifToggleUI('toggle-notif-prayer', settings.notifPrayer !== false);
    this.updateNotifToggleUI('toggle-notif-gym', settings.notifGym !== false);
    this.updateNotifToggleUI('toggle-notif-english', settings.notifEnglish !== false);
    this.updateNotifToggleUI('toggle-notif-sleep', settings.notifSleep !== false);

    // Backend Connection Status Badge
    if (gasStatusBadge) {
      if (settings.gasWebAppUrl) {
        gasStatusBadge.textContent = '● Configured';
        gasStatusBadge.className = 'badge badge-masjid';
      } else {
        gasStatusBadge.textContent = '● Not Connected';
        gasStatusBadge.className = 'badge badge-neutral';
      }
    }
  },

  updateNotifToggleUI(buttonId, isEnabled) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.textContent = isEnabled ? 'ON' : 'OFF';
    btn.className = isEnabled ? 'btn btn-success btn-sm notif-toggle-btn' : 'btn btn-secondary btn-sm notif-toggle-btn';
    btn.style.minWidth = '54px';
    btn.style.fontWeight = '700';
  },

  bindEvents() {
    const inputs = [
      'setting-user-name', 'setting-user-height', 'setting-current-weight', 'setting-target-weight',
      'setting-prayer-city', 'setting-prayer-method', 'setting-prayer-asr-method', 'setting-gas-url', 'setting-gas-token'
    ];

    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => this.saveFromUI());
      }
    });

    // Notification Toggle Buttons
    const notifKeys = [
      { id: 'toggle-notif-prayer', key: 'notifPrayer' },
      { id: 'toggle-notif-gym', key: 'notifGym' },
      { id: 'toggle-notif-english', key: 'notifEnglish' },
      { id: 'toggle-notif-sleep', key: 'notifSleep' }
    ];

    notifKeys.forEach(item => {
      const btn = document.getElementById(item.id);
      if (btn) {
        btn.addEventListener('click', () => {
          const settings = StorageService.getSettings();
          const currentState = settings[item.key] !== false;
          const nextState = !currentState;
          StorageService.saveSettings({ [item.key]: nextState });
          this.updateNotifToggleUI(item.id, nextState);
          UI.vibrate(8);
          UI.showToast(`${item.key.replace('notif', '')} reminders turned ${nextState ? 'ON' : 'OFF'}`, 'info', 1500);
        });
      }
    });

    // Manage Routines Button
    const routinesBtn = document.getElementById('btn-manage-routines');
    if (routinesBtn) {
      routinesBtn.addEventListener('click', () => this.openRoutinesModal());
    }

    // Enable Notifications Button
    const notifBtn = document.getElementById('btn-enable-notifs');
    if (notifBtn) {
      notifBtn.addEventListener('click', async () => {
        const granted = await NotificationService.requestPermission();
        if (granted) {
          notifBtn.textContent = 'ALERTS ENABLED ✓';
          notifBtn.className = 'btn btn-success btn-sm';
          UI.showToast('Strict alerts activated', 'success');
        } else {
          UI.showToast('Notifications permission not granted', 'error');
        }
      });
    }

    // Test Google Apps Script Connection
    const testBtn = document.getElementById('btn-test-gas-connection');
    const gasStatusBadge = document.getElementById('gas-connection-status');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        const gasUrl = document.getElementById('setting-gas-url').value.trim();
        const gasToken = (document.getElementById('setting-gas-token') ? document.getElementById('setting-gas-token').value.trim() : 'batman-secret-2026');
        if (!gasUrl) {
          UI.showToast('Please enter an Apps Script URL first', 'error');
          return;
        }

        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;

        try {
          const res = await ApiService.testConnection(gasUrl, gasToken);
          if (res.success) {
            UI.showToast('Connection successful!', 'success');
            if (gasStatusBadge) {
              gasStatusBadge.textContent = '● Connected';
              gasStatusBadge.className = 'badge badge-masjid';
            }
            this.saveFromUI();
          } else {
            UI.showToast(`Error: ${res.error}`, 'error');
            if (gasStatusBadge) {
              gasStatusBadge.textContent = '● Error';
              gasStatusBadge.className = 'badge badge-missed';
            }
          }
        } catch (err) {
          UI.showToast(`Connection failed: ${err.message}`, 'error', 4000);
          if (gasStatusBadge) {
            gasStatusBadge.textContent = '● Offline / Error';
            gasStatusBadge.className = 'badge badge-missed';
          }
        } finally {
          testBtn.textContent = 'Test Connection';
          testBtn.disabled = false;
        }
      });
    }

    // Force Sync
    const syncBtn = document.getElementById('btn-force-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.saveFromUI();
        SyncService.syncNow(true);
      });
    }

    // GPS One-time city detector
    const gpsBtn = document.getElementById('btn-detect-gps-city');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => this.detectCityOnceGPS());
    }

    // Export Data
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const data = StorageService.exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batman-backup-${DateUtils.getTodayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('Data exported successfully', 'success');
      });
    }

    // Import Data
    const importBtn = document.getElementById('btn-import-json');
    const importInput = document.getElementById('input-import-file');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const success = StorageService.importData(event.target.result);
          if (success) {
            UI.showToast('Backup restored successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
          } else {
            UI.showToast('Invalid backup file format', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // Clear / Reset Data with Modal Confirmation
    const resetBtn = document.getElementById('btn-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.openClearDataConfirmationModal();
      });
    }
  },

  openClearDataConfirmationModal() {
    const html = `
      <div style="text-align: center; padding: var(--space-3) 0;">
        <div style="font-size: 2.2rem; margin-bottom: var(--space-2);">⚠️</div>
        <div style="font-size: var(--text-lg); font-weight: 800; color: var(--status-danger); margin-bottom: var(--space-2);">
          CLEAR LOCAL DATA?
        </div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-4);">
          This will permanently remove all BATMAN transformation data, daily logs, and streaks stored on this device.
        </div>
        <div style="display: flex; gap: var(--space-3);">
          <button id="modal-cancel-clear-btn" class="btn btn-secondary" style="flex: 1; min-height: 44px;">CANCEL</button>
          <button id="modal-confirm-clear-btn" class="btn btn-danger" style="flex: 1; min-height: 44px;">CLEAR DATA</button>
        </div>
      </div>
    `;

    UI.showBottomSheet('Confirm Data Reset', html);

    setTimeout(() => {
      const cancelBtn = document.getElementById('modal-cancel-clear-btn');
      const confirmBtn = document.getElementById('modal-confirm-clear-btn');

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => UI.closeBottomSheet());
      }
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          UI.closeBottomSheet();
          StorageService.clearAllData();
          UI.showToast('Local data cleared', 'info');
          setTimeout(() => window.location.reload(), 600);
        });
      }
    }, 50);
  },

  saveFromUI() {
    const updated = {
      userName: document.getElementById('setting-user-name').value.trim(),
      userHeight: parseFloat(document.getElementById('setting-user-height').value) || 178,
      currentWeight: parseFloat(document.getElementById('setting-current-weight').value) || 62.0,
      targetWeight: parseFloat(document.getElementById('setting-target-weight').value) || 70,
      prayerCity: document.getElementById('setting-prayer-city').value,
      prayerMethod: document.getElementById('setting-prayer-method').value,
      prayerAsrMethod: document.getElementById('setting-prayer-asr-method').value,
      gasWebAppUrl: document.getElementById('setting-gas-url').value.trim(),
      gasApiToken: document.getElementById('setting-gas-token') ? document.getElementById('setting-gas-token').value.trim() : 'batman-secret-2026'
    };
    StorageService.saveSettings(updated);
    UI.showToast('Settings saved', 'success', 1500);
    window.dispatchEvent(new CustomEvent('batman:settings-updated'));
  },

  openRoutinesModal() {
    const routines = StorageService.getRoutines();
    const container = document.createElement('div');

    container.innerHTML = `
      <div style="max-height: 60vh; overflow-y: auto; margin-bottom: var(--space-4);">
        ${routines.map(r => `
          <div class="prayer-row" style="padding: 10px 0;">
            <div class="prayer-info" style="flex: 1; margin-right: var(--space-2);">
              <span style="font-weight: 700; color: var(--text-primary); font-size: var(--text-sm);">${r.name}</span>
              <span class="prayer-time">${DateUtils.format12Hour(r.time)} • ${r.duration}m • ${r.anchor}</span>
            </div>
            <button class="btn ${r.isActive ? 'btn-success' : 'btn-secondary'} btn-sm" style="min-height: 38px; min-width: 80px;" onclick="SettingsModule.toggleRoutine('${r.id}')">
              ${r.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        `).join('')}
      </div>
      <button id="modal-add-routine-btn" class="btn btn-outline btn-block" style="min-height: 44px;">+ Add Custom Routine Block</button>
    `;

    container.querySelector('#modal-add-routine-btn').addEventListener('click', () => {
      const name = prompt('Routine Name:');
      if (!name) return;
      const time = prompt('Scheduled Time (24h format HH:MM e.g. 14:30):', '14:30');
      const duration = parseInt(prompt('Duration (minutes):', '30'), 10) || 30;

      const newRoutine = {
        id: CalcUtils.generateId('routine'),
        name: ValidationUtils.sanitizeText(name),
        time: time || '12:00',
        duration,
        days: [0, 1, 2, 3, 4, 5, 6],
        anchor: 'fixed',
        isActive: true
      };

      const current = StorageService.getRoutines();
      current.push(newRoutine);
      StorageService.saveRoutines(current);
      UI.showToast('Routine block added', 'success');
      this.openRoutinesModal();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Daily Schedule Routines', container);
  },

  toggleRoutine(routineId) {
    const routines = StorageService.getRoutines();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    routine.isActive = !routine.isActive;
    StorageService.saveRoutines(routines);
    UI.vibrate(10);
    this.openRoutinesModal();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  detectCityOnceGPS() {
    if (!('geolocation' in navigator)) {
      UI.showToast('Geolocation is not supported on this device', 'error');
      return;
    }

    UI.showToast('Checking location once...', 'info', 2000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        let closestCityKey = 'Calicut,India';
        let minDistance = Infinity;

        for (const [key, city] of Object.entries(CONFIG.CITIES)) {
          const d = Math.hypot(city.lat - userLat, city.lng - userLng);
          if (d < minDistance) {
            minDistance = d;
            closestCityKey = key;
          }
        }

        const citySelect = document.getElementById('setting-prayer-city');
        if (citySelect) {
          citySelect.value = closestCityKey;
          this.saveFromUI();
          UI.showToast(`Nearest city set to: ${CONFIG.CITIES[closestCityKey].name}`, 'success', 3000);
        }
      },
      (err) => {
        UI.showToast('Location permission denied or unavailable', 'error', 3000);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }
};

if (typeof window !== 'undefined') {
  window.SettingsModule = SettingsModule;
}
