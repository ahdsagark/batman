/**
 * BATMAN — Fitness & Body Transformation Module (Gym, Weight & Auto-BMI)
 */

const FitnessModule = {
  init() {
    this.renderFitness();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'growth') this.renderFitness();
    });

    window.addEventListener('batman:data-updated', () => {
      this.renderFitness();
    });
  },

  bindEvents() {
    // Gym Attendance Cycling
    const gymBtn = document.getElementById('gym-toggle-btn');
    if (gymBtn) {
      gymBtn.addEventListener('click', () => this.cycleGym());
    }

    // Log Weight Button
    const weightBtn = document.getElementById('fitness-log-weight-btn');
    if (weightBtn) {
      weightBtn.addEventListener('click', () => this.openWeightModal());
    }
  },

  cycleGym() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const cur = log.gymStatus || (log.gymAttended ? 'DONE' : 'NOT_RECORDED');

    let next = 'DONE';
    if (cur === 'NOT_RECORDED') next = 'DONE';
    else if (cur === 'DONE') next = 'REST';
    else if (cur === 'REST') next = 'MISSED';
    else if (cur === 'MISSED') next = 'NOT_RECORDED';

    StorageService.saveDayLog(todayISO, {
      gymStatus: next,
      gymAttended: (next === 'DONE')
    });

    UI.vibrate(10);
    this.renderFitness();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  renderFitness() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();
    const curGym = log.gymStatus || (log.gymAttended ? 'DONE' : 'NOT_RECORDED');

    // 1. Gym Button & Weekly Sessions Count
    const gymBtn = document.getElementById('gym-toggle-btn');
    const gymWeeklyCount = document.getElementById('gym-weekly-count');

    if (gymBtn) {
      if (curGym === 'DONE') {
        gymBtn.textContent = 'DONE ✓';
        gymBtn.className = 'btn btn-success btn-sm';
      } else if (curGym === 'REST') {
        gymBtn.textContent = 'REST DAY';
        gymBtn.className = 'btn btn-primary btn-sm';
      } else if (curGym === 'MISSED') {
        gymBtn.textContent = 'MISSED';
        gymBtn.className = 'btn btn-danger btn-sm';
      } else {
        gymBtn.textContent = 'NOT RECORDED';
        gymBtn.className = 'btn btn-secondary btn-sm';
      }
    }

    const past7Days = DateUtils.getPastDaysISO(7);
    const allLogs = StorageService.getDayLogs();
    let weeklyGym = 0;
    past7Days.forEach(d => {
      if (allLogs[d] && (allLogs[d].gymStatus === 'DONE' || allLogs[d].gymAttended === true)) weeklyGym++;
    });

    if (gymWeeklyCount) {
      gymWeeklyCount.textContent = `This week: ${weeklyGym} / ${CONFIG.TARGETS.GYM_WEEKLY_SESSIONS} sessions`;
    }

    // 2. Body Weight & BMI
    const currentWeightEl = document.getElementById('fitness-current-weight');
    const targetWeightEl = document.getElementById('fitness-target-weight');
    const bmiEl = document.getElementById('fitness-current-bmi');

    const activeWeight = log.weightKg || settings.currentWeight || 62.0;
    const heightCm = settings.userHeight || CONFIG.TARGETS.DEFAULT_HEIGHT_CM;
    const bmi = CalcUtils.calculateBMI(activeWeight, heightCm);

    if (currentWeightEl) currentWeightEl.textContent = `${activeWeight.toFixed(1)} kg`;
    if (targetWeightEl) targetWeightEl.textContent = `Target: ${(settings.targetWeight || 70).toFixed(1)} kg`;
    if (bmiEl) bmiEl.textContent = bmi.toFixed(2);
  },

  openWeightModal() {
    const settings = StorageService.getSettings();
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Body Weight (kg)</label>
        <input type="number" id="modal-weight-input" class="form-input" step="0.1" value="${settings.currentWeight || 62.0}">
      </div>
      <div class="form-hint" style="margin-bottom: var(--space-4);">
        Height: ${settings.userHeight || 178} cm. Target: ${settings.targetWeight || 70} kg.
      </div>
      <button id="modal-save-weight-btn" class="btn btn-primary btn-block">Save Weight Entry</button>
    `;

    form.querySelector('#modal-save-weight-btn').addEventListener('click', () => {
      const weightVal = parseFloat(form.querySelector('#modal-weight-input').value);
      if (!weightVal || weightVal <= 0) return;

      const todayISO = DateUtils.getTodayISO();
      const entry = StorageService.saveWeightEntry(weightVal, todayISO);

      UI.closeSheet();
      UI.showToast(`Logged ${weightVal} kg (BMI ${entry.bmi})`, 'success');
      this.renderFitness();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Record Body Weight', form);
  }
};

if (typeof window !== 'undefined') {
  window.FitnessModule = FitnessModule;
}
