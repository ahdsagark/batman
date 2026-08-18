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
  },

  bindEvents() {
    // Gym Attendance Toggle
    const gymBtn = document.getElementById('gym-toggle-btn');
    if (gymBtn) {
      gymBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextState = !log.gymAttended;
        StorageService.saveDayLog(todayISO, { gymAttended: nextState });
        UI.vibrate(10);
        this.renderFitness();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }

    // Log Weight Button
    const weightBtn = document.getElementById('fitness-log-weight-btn');
    if (weightBtn) {
      weightBtn.addEventListener('click', () => this.openWeightModal());
    }
  },

  renderFitness() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();

    // 1. Gym Button & Weekly Sessions Count
    const gymBtn = document.getElementById('gym-toggle-btn');
    const gymWeeklyCount = document.getElementById('gym-weekly-count');

    if (gymBtn) {
      gymBtn.textContent = log.gymAttended ? 'ATTENDED ✓' : 'UNLOGGED';
      gymBtn.className = log.gymAttended ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }

    const past7Days = DateUtils.getPastDaysISO(7);
    const allLogs = StorageService.getDayLogs();
    let weeklyGym = 0;
    past7Days.forEach(d => {
      if (allLogs[d] && allLogs[d].gymAttended) weeklyGym++;
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
      const height = settings.userHeight || 178;
      const bmi = CalcUtils.calculateBMI(weightVal, height);

      StorageService.saveDayLog(todayISO, { weightKg: weightVal, bmi });
      StorageService.saveSettings({ currentWeight: weightVal });

      UI.closeSheet();
      UI.showToast(`Logged ${weightVal} kg (BMI ${bmi})`, 'success');
      this.renderFitness();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Record Body Weight', form);
  }
};

if (typeof window !== 'undefined') {
  window.FitnessModule = FitnessModule;
}
