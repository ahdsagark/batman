/**
 * BATMAN — Settings & Configuration Module
 */

const SettingsModule = {
  init() {
    this.applyCurrentTheme();
    this.loadSettingsToUI();
    this.bindEvents();

    // Listen for OS color scheme changes if system theme selected
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const settings = StorageService.getSettings();
        if (settings.theme === 'system') {
          this.applyCurrentTheme();
        }
      });
    }
  },

  applyCurrentTheme() {
    const settings = StorageService.getSettings();
    const theme = settings.theme || 'dark';

    if (theme === 'system') {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  loadSettingsToUI() {
    const settings = StorageService.getSettings();

    const nameInput = document.getElementById('setting-user-name');
    const heightInput = document.getElementById('setting-user-height');
    const currentWeightInput = document.getElementById('setting-current-weight');
    const weightTargetInput = document.getElementById('setting-target-weight');
    const themeSelect = document.getElementById('setting-theme-select');
    const pomodoroRetSelect = document.getElementById('setting-pomo-retrieval');
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
    if (themeSelect) themeSelect.value = settings.theme || 'dark';
    if (pomodoroRetSelect) pomodoroRetSelect.value = settings.pomodoroRetrievalMinutes || 3;
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
      'setting-theme-select', 'setting-pomo-retrieval',
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

    // Force Push Sync
    const syncBtn = document.getElementById('btn-force-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        this.saveFromUI();
        await SyncService.syncNow(true);
        await SyncService.pullFromCloud(false);
      });
    }

    // Pull from Cloud
    const pullBtn = document.getElementById('btn-pull-cloud');
    if (pullBtn) {
      pullBtn.addEventListener('click', async () => {
        this.saveFromUI();
        await SyncService.pullFromCloud(true);
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
      theme: document.getElementById('setting-theme-select') ? document.getElementById('setting-theme-select').value : 'dark',
      pomodoroRetrievalMinutes: document.getElementById('setting-pomo-retrieval') ? parseInt(document.getElementById('setting-pomo-retrieval').value, 10) : 3,
      prayerCity: document.getElementById('setting-prayer-city').value,
      prayerMethod: document.getElementById('setting-prayer-method').value,
      prayerAsrMethod: document.getElementById('setting-prayer-asr-method').value,
      gasWebAppUrl: document.getElementById('setting-gas-url').value.trim(),
      gasApiToken: (document.getElementById('setting-gas-token') && document.getElementById('setting-gas-token').value.trim()) ? document.getElementById('setting-gas-token').value.trim() : 'batman-secret-2026'
    };
    StorageService.saveSettings(updated);
    this.applyCurrentTheme();
    UI.showToast('Settings saved', 'success', 1500);
    window.dispatchEvent(new CustomEvent('batman:settings-updated'));
  },

  openRoutinesModal() {
    const routines = StorageService.getRoutines();
    const container = document.createElement('div');

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formatDays = (days) => {
      if (!Array.isArray(days) || days.length === 7 || days.length === 0) return 'Daily';
      if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Mon–Fri';
      if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Sat–Sun';
      return days.map(d => dayLabels[d] || d).join(', ');
    };

    const formatAnchor = (anchor) => {
      const map = {
        'fixed': 'Fixed Clock',
        'prayer-fajr': '⚡ Fajr Anchor',
        'prayer-dhuhr': '⚡ Dhuhr Anchor',
        'prayer-asr': '⚡ Asr Anchor',
        'prayer-maghrib': '⚡ Maghrib Anchor',
        'prayer-isha': '⚡ Isha Anchor',
        'relative-pre-fajr': '⚡ Pre-Fajr',
        'after-fajr': '⚡ After Fajr',
        'after-maghrib': '⚡ After Maghrib'
      };
      return map[anchor] || anchor || 'Fixed';
    };

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: var(--text-xs); font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.08em;">
            ${routines.length} SCHEDULED BLOCKS
          </span>
        </div>
        <button id="modal-top-add-routine-btn" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 4px 14px; font-size: 11px; height: 32px; border-radius: var(--radius-sm);">
          + Add Routine
        </button>
      </div>

      <div style="max-height: 60vh; overflow-y: auto; margin-bottom: var(--space-3); padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
        ${routines.length === 0 ? `
          <div style="padding: var(--space-6); text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
            No routines configured. Click "Reset Defaults" below.
          </div>
        ` : routines.map((r, idx) => {
          const isPaused = r.isActive === false;
          return `
            <div class="card" style="margin-bottom: 0; padding: 12px 14px; background-color: var(--bg-surface-elevated); border: 1px solid ${isPaused ? 'var(--border-subtle)' : 'var(--border-medium)'}; opacity: ${isPaused ? '0.6' : '1'}; transition: all 0.2s ease;">
              <!-- Header Row: Index + Title on Left, Single Unified Action Row on Right -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                  <span style="font-size: 10.5px; font-weight: 800; color: var(--accent-primary); font-family: var(--font-mono); background: rgba(0, 229, 255, 0.1); padding: 2px 6px; border-radius: var(--radius-xs); flex-shrink: 0;">#${idx + 1}</span>
                  <span style="font-weight: 700; color: var(--text-primary); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.name}</span>
                </div>

                <!-- Unified Horizontal Action Row -->
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                  <button class="routine-toggle-active-btn" data-id="${r.id}" title="Toggle Active / Paused" style="background: ${r.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)'}; color: ${r.isActive ? '#10b981' : '#94a3b8'}; border: 1px solid ${r.isActive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.25)'}; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; height: 26px;">
                    <span style="font-size: 8px;">${r.isActive ? '●' : '○'}</span> ${r.isActive ? 'ACTIVE' : 'PAUSED'}
                  </button>

                  <button class="btn btn-secondary btn-sm routine-edit-btn" data-id="${r.id}" title="Edit Routine" style="min-height: 26px; height: 26px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-xs);">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>

                  <button class="btn btn-outline btn-sm routine-delete-btn" data-id="${r.id}" title="Delete Routine" style="min-height: 26px; height: 26px; width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-xs); color: var(--status-danger); border-color: rgba(239, 68, 68, 0.3);">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>

              <!-- Metadata Line: Time, Duration, Anchor & Days -->
              <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px;">
                <span style="background: rgba(255, 255, 255, 0.06); color: #ffffff; font-family: var(--font-mono); font-weight: 700; padding: 2px 7px; border-radius: var(--radius-xs); border: 1px solid rgba(255, 255, 255, 0.08);">
                  ${DateUtils.format12Hour(r.time)}
                </span>
                ${r.duration && r.duration > 0 ? `
                  <span style="color: var(--text-secondary); background: rgba(255, 255, 255, 0.04); padding: 2px 7px; border-radius: var(--radius-xs); font-weight: 600;">
                    ⏳ ${r.duration}m
                  </span>
                ` : ''}
                <span class="badge ${r.anchor && r.anchor !== 'fixed' ? 'badge-masjid' : 'badge-neutral'}" style="font-size: 10px; padding: 2px 6px;">
                  ${formatAnchor(r.anchor)}
                </span>
                <span style="color: var(--text-muted); font-size: 10.5px; margin-left: auto; font-weight: 500;">
                  ${formatDays(r.days)}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Clean Sticky Bottom Actions -->
      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--space-2); border-top: 1px solid var(--border-subtle); padding-top: var(--space-3);">
        <button id="modal-bottom-add-routine-btn" class="btn btn-primary" style="font-weight: 700; font-size: var(--text-sm);">+ Add Routine</button>
        <button id="modal-reset-routines-btn" class="btn btn-outline" style="font-size: 11.5px; color: var(--text-secondary);">↺ Reset Defaults</button>
      </div>
    `;

    // Event Listeners
    const handleAdd = () => this.openRoutineEditModal(null);
    container.querySelector('#modal-top-add-routine-btn').addEventListener('click', handleAdd);
    container.querySelector('#modal-bottom-add-routine-btn').addEventListener('click', handleAdd);

    container.querySelector('#modal-reset-routines-btn').addEventListener('click', () => {
      if (confirm('Reset all schedule routines back to the default 17 transformation routines?')) {
        StorageService.saveRoutines(CONFIG.DEFAULT_ROUTINES);
        UI.showToast('Reset to default 17 routines ✓', 'success');
        this.openRoutinesModal();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      }
    });

    container.querySelectorAll('.routine-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openRoutineEditModal(id);
      });
    });

    container.querySelectorAll('.routine-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.deleteRoutine(id);
      });
    });

    container.querySelectorAll('.routine-toggle-active-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.toggleRoutine(id);
      });
    });

    UI.openSheet('Routines & Schedule Manager', container);
  },

  openRoutineEditModal(routineId = null) {
    const isEdit = Boolean(routineId);
    const routines = StorageService.getRoutines();
    const existing = isEdit ? routines.find(r => r.id === routineId) : null;

    const routine = existing || {
      id: `routine-custom-${Date.now()}`,
      name: '',
      time: '08:00',
      duration: null,
      days: [0, 1, 2, 3, 4, 5, 6],
      anchor: 'fixed',
      isActive: true
    };

    const container = document.createElement('div');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeDays = Array.isArray(routine.days) ? routine.days : [0, 1, 2, 3, 4, 5, 6];
    const isFixed = !routine.anchor || routine.anchor === 'fixed';

    container.innerHTML = `
      <form id="routine-edit-form" style="display: flex; flex-direction: column; gap: var(--space-3);" onsubmit="event.preventDefault();">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Routine Name *</label>
          <input type="text" id="edit-routine-name" class="form-input" required placeholder="e.g. Cybersecurity Deep Work, Gym Session" value="${routine.name || ''}">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Anchor Rule (Dynamic Timing)</label>
          <select id="edit-routine-anchor" class="form-select">
            <option value="fixed" ${routine.anchor === 'fixed' ? 'selected' : ''}>Fixed Clock Time</option>
            <option value="prayer-fajr" ${routine.anchor === 'prayer-fajr' ? 'selected' : ''}>Fajr Prayer Time</option>
            <option value="prayer-dhuhr" ${routine.anchor === 'prayer-dhuhr' ? 'selected' : ''}>Dhuhr Prayer Time</option>
            <option value="prayer-asr" ${routine.anchor === 'prayer-asr' ? 'selected' : ''}>Asr Prayer Time</option>
            <option value="prayer-maghrib" ${routine.anchor === 'prayer-maghrib' ? 'selected' : ''}>Maghrib Prayer Time</option>
            <option value="prayer-isha" ${routine.anchor === 'prayer-isha' ? 'selected' : ''}>Isha Prayer Time</option>
            <option value="relative-pre-fajr" ${routine.anchor === 'relative-pre-fajr' ? 'selected' : ''}>Pre-Fajr (30 Mins Before Fajr / Tahajjud)</option>
            <option value="after-fajr" ${routine.anchor === 'after-fajr' ? 'selected' : ''}>After Fajr (30 Mins After Fajr)</option>
            <option value="after-maghrib" ${routine.anchor === 'after-maghrib' ? 'selected' : ''}>After Maghrib (25 Mins After Maghrib)</option>
          </select>
        </div>

        <!-- Start Time Input (Only shown for Fixed Clock) -->
        <div id="group-routine-time" class="form-group" style="display: ${isFixed ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">Start Time (24h) *</label>
          <input type="time" id="edit-routine-time" class="form-input" value="${routine.time || '08:00'}">
        </div>

        <!-- Dynamic Anchor Info Notice (Only shown when dynamic anchor selected) -->
        <div id="group-anchor-notice" style="display: ${isFixed ? 'none' : 'block'}; background: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 11.5px; color: var(--accent-primary);">
          ⚡ <strong>Dynamic Timing Enabled</strong>: Start time is automatically calculated from daily astronomical prayer times for your selected city. No manual time entry required.
        </div>

        <!-- Duration Input (Optional) -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Duration in Minutes <span style="font-weight: 400; color: var(--text-muted);">(Optional)</span></label>
          <input type="number" id="edit-routine-duration" class="form-input" min="1" max="480" step="5" placeholder="Optional (leave blank if none)" value="${routine.duration || ''}">
          <div class="form-hint">Leave blank to display just the start time without a duration badge.</div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Active Days</label>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${dayNames.map((name, dayIndex) => {
              const isSelected = activeDays.includes(dayIndex);
              return `
                <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm day-chip-btn" data-day="${dayIndex}" style="min-width: 44px; padding: 6px 8px; font-size: 11px; font-weight: 700;">
                  ${name}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <div>
            <div style="font-weight: 700; font-size: var(--text-sm); color: var(--text-primary);">Enable Routine</div>
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Include in daily schedule and timeline</div>
          </div>
          <input type="checkbox" id="edit-routine-active" ${routine.isActive !== false ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--accent-primary);">
        </div>

        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
          <button type="button" id="edit-routine-cancel-btn" class="btn btn-secondary" style="flex: 1;">Cancel</button>
          <button type="button" id="edit-routine-save-btn" class="btn btn-primary" style="flex: 2; font-weight: 700;">
            ${isEdit ? 'Save Changes ✓' : 'Add Routine Block ✓'}
          </button>
        </div>
      </form>
    `;

    // Anchor toggle: Hide/Show Start Time based on Anchor selection
    const anchorSelect = container.querySelector('#edit-routine-anchor');
    const timeGroup = container.querySelector('#group-routine-time');
    const noticeGroup = container.querySelector('#group-anchor-notice');

    anchorSelect.addEventListener('change', () => {
      const isFixedNow = anchorSelect.value === 'fixed';
      timeGroup.style.display = isFixedNow ? 'block' : 'none';
      noticeGroup.style.display = isFixedNow ? 'none' : 'block';
    });

    // Day chip toggles
    container.querySelectorAll('.day-chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const isSelected = chip.classList.contains('btn-primary');
        if (isSelected) {
          chip.classList.remove('btn-primary');
          chip.classList.add('btn-secondary');
        } else {
          chip.classList.remove('btn-secondary');
          chip.classList.add('btn-primary');
        }
      });
    });

    // Cancel Button
    container.querySelector('#edit-routine-cancel-btn').addEventListener('click', () => {
      this.openRoutinesModal();
    });

    // Save Button
    container.querySelector('#edit-routine-save-btn').addEventListener('click', () => {
      const nameInput = container.querySelector('#edit-routine-name').value.trim();
      if (!nameInput) {
        UI.showToast('Please enter a routine name', 'error');
        return;
      }

      const anchorInput = container.querySelector('#edit-routine-anchor').value || 'fixed';
      let timeInput = container.querySelector('#edit-routine-time').value;

      // If dynamic anchor, compute the reference start time from prayer engine
      if (anchorInput !== 'fixed') {
        const prayerTimes = (typeof PrayerService !== 'undefined') ? PrayerService.getPrayerTimes(new Date()) : null;
        if (prayerTimes) {
          if (anchorInput === 'prayer-fajr') timeInput = prayerTimes.fajr;
          else if (anchorInput === 'prayer-dhuhr') timeInput = prayerTimes.dhuhr;
          else if (anchorInput === 'prayer-asr') timeInput = prayerTimes.asr;
          else if (anchorInput === 'prayer-maghrib') timeInput = prayerTimes.maghrib;
          else if (anchorInput === 'prayer-isha') timeInput = prayerTimes.isha;
          else if (anchorInput === 'relative-pre-fajr') {
            const fMins = DateUtils.parseTimeToMinutes(prayerTimes.fajr);
            timeInput = DateUtils.minutesToHHMM(fMins - 30);
          } else if (anchorInput === 'after-fajr') {
            const fMins = DateUtils.parseTimeToMinutes(prayerTimes.fajr);
            timeInput = DateUtils.minutesToHHMM(fMins + 30);
          } else if (anchorInput === 'after-maghrib') {
            const mMins = DateUtils.parseTimeToMinutes(prayerTimes.maghrib);
            timeInput = DateUtils.minutesToHHMM(mMins + 25);
          }
        }
        if (!timeInput) timeInput = '05:00';
      } else {
        if (!timeInput) timeInput = '08:00';
      }

      const durRaw = container.querySelector('#edit-routine-duration').value.trim();
      const durationInput = (durRaw !== '' && !isNaN(parseInt(durRaw, 10)) && parseInt(durRaw, 10) > 0)
        ? parseInt(durRaw, 10)
        : null;

      const isActiveInput = container.querySelector('#edit-routine-active').checked;

      const selectedDays = [];
      container.querySelectorAll('.day-chip-btn').forEach(chip => {
        if (chip.classList.contains('btn-primary')) {
          selectedDays.push(parseInt(chip.getAttribute('data-day'), 10));
        }
      });

      const updatedRoutine = {
        id: routine.id,
        name: ValidationUtils.sanitizeText(nameInput),
        time: timeInput,
        duration: durationInput,
        anchor: anchorInput,
        days: selectedDays.length > 0 ? selectedDays : [0, 1, 2, 3, 4, 5, 6],
        isActive: isActiveInput,
        updatedAt: DateUtils.getNowISO()
      };

      const allRoutines = StorageService.getRoutines();
      const existingIdx = allRoutines.findIndex(r => r.id === routine.id);

      if (existingIdx >= 0) {
        allRoutines[existingIdx] = updatedRoutine;
      } else {
        allRoutines.push(updatedRoutine);
      }

      StorageService.saveRoutines(allRoutines);
      UI.vibrate(10);
      UI.showToast(`Routine "${updatedRoutine.name}" saved ✓`, 'success');
      this.openRoutinesModal();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet(isEdit ? `Edit Routine` : `New Routine Block`, container);
  },

  deleteRoutine(routineId) {
    const routines = StorageService.getRoutines();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    if (confirm(`Delete routine "${routine.name}"?`)) {
      StorageService.deleteRoutine(routineId);
      UI.vibrate(12);
      UI.showToast(`Routine "${routine.name}" deleted`, 'info');
      this.openRoutinesModal();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    }
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
