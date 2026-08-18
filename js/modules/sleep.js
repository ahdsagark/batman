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

    const initialBedtime = log.bedtime || '22:30';
    const initialWaketime = log.waketime || '06:00';

    // Calculate initial duration from times
    const initialDuration = CalcUtils.calculateSleepDuration(initialBedtime, initialWaketime);
    const initialHours = log.sleepHours ? parseFloat(log.sleepHours) : (initialDuration ? initialDuration.hours : 7.5);

    const form = document.createElement('div');
    form.innerHTML = `
      <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--border-subtle);">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: var(--space-2); display: flex; justify-content: space-between; align-items: center;">
          <span>Bedtime & Wake Time</span>
          <span style="font-size: 10px; color: var(--accent-primary); font-weight: 600;">Auto-syncs Duration</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="modal-bedtime">Bedtime (Slept)</label>
            <input type="time" id="modal-bedtime" class="form-input" value="${initialBedtime}">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" for="modal-waketime">Wake Time (Woke)</label>
            <input type="time" id="modal-waketime" class="form-input" value="${initialWaketime}">
          </div>
        </div>
        <div id="sleep-calc-preview" style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--accent-primary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
          <span>⏱️ Calculated: <strong>${initialDuration ? initialDuration.display : `${initialHours} hrs`}</strong></span>
        </div>
      </div>

      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label class="form-label" for="modal-sleep-hours" style="margin-bottom: 0;">Total Sleep Duration (Hours)</label>
          <span id="sleep-calc-badge" class="badge badge-masjid" style="font-size: 10px;">Auto-calculated</span>
        </div>
        <input type="number" id="modal-sleep-hours" class="form-input" min="0.5" max="24" step="0.25" value="${initialHours}">
      </div>

      <div class="form-hint" style="margin-bottom: var(--space-4);">
        Transformation target: 7.5 hours of restorative recovery per night. Adjusting Bedtime or Wake Time automatically updates total hours.
      </div>
      <button id="modal-save-sleep-btn" class="btn btn-primary btn-block">Save Sleep Record</button>
    `;

    const bedInput = form.querySelector('#modal-bedtime');
    const wakeInput = form.querySelector('#modal-waketime');
    const hoursInput = form.querySelector('#modal-sleep-hours');
    const previewEl = form.querySelector('#sleep-calc-preview');
    const calcBadge = form.querySelector('#sleep-calc-badge');

    const updateFromTimes = () => {
      const res = CalcUtils.calculateSleepDuration(bedInput.value, wakeInput.value);
      if (res && res.hours > 0) {
        hoursInput.value = res.hours;
        previewEl.innerHTML = `<span>⏱️ Calculated: <strong>${res.display}</strong></span>`;
        calcBadge.textContent = 'Auto-calculated';
        calcBadge.className = 'badge badge-masjid';
      } else if (res && res.hours === 0) {
        previewEl.innerHTML = `<span>⏱️ Same bedtime & waketime (0h)</span>`;
      }
    };

    bedInput.addEventListener('input', updateFromTimes);
    bedInput.addEventListener('change', updateFromTimes);
    wakeInput.addEventListener('input', updateFromTimes);
    wakeInput.addEventListener('change', updateFromTimes);

    hoursInput.addEventListener('input', () => {
      calcBadge.textContent = 'Manual override';
      calcBadge.className = 'badge badge-neutral';
    });

    form.querySelector('#modal-save-sleep-btn').addEventListener('click', () => {
      const hours = parseFloat(hoursInput.value);
      const bedtime = bedInput.value;
      const waketime = wakeInput.value;

      if (isNaN(hours) || hours <= 0) {
        UI.showToast('Please enter a valid sleep duration', 'warning');
        return;
      }

      StorageService.saveDayLog(todayISO, {
        sleepHours: hours,
        bedtime,
        waketime
      });

      UI.closeSheet();
      UI.showToast(`Logged ${hours}h sleep (${bedtime} – ${waketime})`, 'success');
      this.renderSleep();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Record Sleep & Recovery', form);
  }
};

if (typeof window !== 'undefined') {
  window.SleepModule = SleepModule;
}
