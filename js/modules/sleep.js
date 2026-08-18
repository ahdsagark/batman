/**
 * BATMAN — Sleep & Recovery Module (7.5h Target, 7-Day Average, Deficit Warning)
 */

const SleepModule = {
  init() {
    this.renderSleep();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'growth') this.renderSleep();
    });
  },

  bindEvents() {
    const sleepBtn = document.getElementById('sleep-log-btn');
    if (sleepBtn) {
      sleepBtn.addEventListener('click', () => this.openSleepModal());
    }
  },

  renderSleep() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const allLogs = StorageService.getDayLogs();

    // 1. Last Night Logged
    const loggedValEl = document.getElementById('sleep-logged-val');
    if (loggedValEl) {
      loggedValEl.textContent = log.sleepHours ? `${parseFloat(log.sleepHours).toFixed(1)} hrs` : '-- hrs';
    }

    // 2. 7-Day Average Calculation
    const past7Days = DateUtils.getPastDaysISO(7);
    let totalSleep = 0;
    let daysRecorded = 0;

    past7Days.forEach(d => {
      if (allLogs[d] && allLogs[d].sleepHours) {
        totalSleep += parseFloat(allLogs[d].sleepHours);
        daysRecorded++;
      }
    });

    const avgEl = document.getElementById('sleep-avg-val');
    const deficitStatusEl = document.getElementById('sleep-deficit-status');
    const warningBox = document.getElementById('sleep-recovery-warning');
    const warningText = document.getElementById('sleep-warning-text');

    if (daysRecorded > 0) {
      const avg = totalSleep / daysRecorded;
      if (avgEl) avgEl.textContent = `${avg.toFixed(1)} hrs`;

      if (avg < CONFIG.TARGETS.SLEEP_DAILY_HOURS) {
        if (deficitStatusEl) {
          deficitStatusEl.textContent = 'Below Target ⚠️';
          deficitStatusEl.style.color = 'var(--status-warning)';
        }
        if (warningBox) warningBox.style.display = 'flex';
        if (warningText) {
          warningText.textContent = `Your 7-day average sleep (${avg.toFixed(1)}h) is below the 7.5h target. Prioritize an early bedtime or take a 20m afternoon nap.`;
        }
      } else {
        if (deficitStatusEl) {
          deficitStatusEl.textContent = 'Optimal ✓';
          deficitStatusEl.style.color = 'var(--status-success)';
        }
        if (warningBox) warningBox.style.display = 'none';
      }
    } else {
      if (avgEl) avgEl.textContent = '-- hrs';
      if (deficitStatusEl) deficitStatusEl.textContent = 'Unlogged';
      if (warningBox) warningBox.style.display = 'none';
    }
  },

  openSleepModal() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);

    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Total Sleep Duration (Hours)</label>
        <input type="number" id="modal-sleep-hours" class="form-input" min="1" max="16" step="0.25" value="${log.sleepHours || 7.5}">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
        <div>
          <label class="form-label">Bedtime</label>
          <input type="time" id="modal-bedtime" class="form-input" value="${log.bedtime || '22:00'}">
        </div>
        <div>
          <label class="form-label">Wake Time</label>
          <input type="time" id="modal-waketime" class="form-input" value="${log.waketime || '05:30'}">
        </div>
      </div>
      <div class="form-hint" style="margin-bottom: var(--space-4);">
        Transformation target: 7.5 hours of restorative recovery per night.
      </div>
      <button id="modal-save-sleep-btn" class="btn btn-primary btn-block">Save Sleep Record</button>
    `;

    form.querySelector('#modal-save-sleep-btn').addEventListener('click', () => {
      const hours = parseFloat(form.querySelector('#modal-sleep-hours').value);
      const bedtime = form.querySelector('#modal-bedtime').value;
      const waketime = form.querySelector('#modal-waketime').value;

      if (!hours || hours <= 0) return;

      StorageService.saveDayLog(todayISO, {
        sleepHours: hours,
        bedtime,
        waketime
      });

      UI.closeSheet();
      UI.showToast(`Logged ${hours}h sleep`, 'success');
      this.renderSleep();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Record Sleep & Recovery', form);
  }
};

if (typeof window !== 'undefined') {
  window.SleepModule = SleepModule;
}
