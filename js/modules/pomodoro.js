/**
 * BATMAN — Pomodoro Engine (25m Focus -> 2-5m Retrieval -> 3m Restful Wakefulness)
 * Single Source of Truth: Contributes +25m to Cyber/English ONLY upon full 3-phase cycle completion.
 */

const PomodoroModule = {
  timerInterval: null,
  state: 'STOPPED', // 'STOPPED' | 'FOCUS' | 'RETRIEVAL' | 'REST' | 'PAUSED'
  currentPhase: 'FOCUS', // 'FOCUS' | 'RETRIEVAL' | 'REST'
  category: 'CYBERSECURITY', // 'CYBERSECURITY' | 'ENGLISH' | 'OTHERS'
  phaseElapsedSeconds: 0,
  phaseTargetSeconds: 25 * 60,
  retrievalDurationMinutes: 3,

  init() {
    const settings = StorageService.getSettings();
    this.retrievalDurationMinutes = settings.pomodoroRetrievalMinutes || 3;
    this.renderPomodoro();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'growth' || e.detail.tab === 'home') this.renderPomodoro();
    });

    window.addEventListener('batman:data-updated', () => {
      this.renderPomodoro();
    });
  },

  bindEvents() {
    const startBtn = document.getElementById('pomo-start-btn');
    const pauseBtn = document.getElementById('pomo-pause-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const catSelect = document.getElementById('pomo-category-select');

    if (startBtn) startBtn.addEventListener('click', () => this.startPhase());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pausePhase());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetPomodoro());
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        if (this.state === 'STOPPED') {
          this.category = e.target.value;
          this.renderPomodoro();
        }
      });
    }
  },

  renderPomodoro() {
    const todayISO = DateUtils.getTodayISO();
    const allSessions = StorageService.getPomodoroSessions();
    const todayCompleted = allSessions.filter(s => s.date === todayISO && s.status === 'COMPLETED');

    // 1. Update Today's Cycle Count Badge
    const countBadge = document.getElementById('pomo-today-count-badge');
    if (countBadge) {
      countBadge.textContent = `${todayCompleted.length} Cycle${todayCompleted.length === 1 ? '' : 's'} Done`;
      countBadge.className = todayCompleted.length > 0 ? 'badge badge-masjid' : 'badge badge-neutral';
    }

    // 2. Update Phase Badges
    const phaseFocusEl = document.getElementById('pomo-phase-focus');
    const phaseRetEl = document.getElementById('pomo-phase-retrieval');
    const phaseRestEl = document.getElementById('pomo-phase-rest');

    if (phaseFocusEl) {
      phaseFocusEl.className = this.currentPhase === 'FOCUS' && this.state !== 'STOPPED' ? 'badge badge-masjid' : 'badge badge-neutral';
    }
    if (phaseRetEl) {
      phaseRetEl.className = this.currentPhase === 'RETRIEVAL' ? 'badge badge-warning' : 'badge badge-neutral';
      phaseRetEl.textContent = `2. Retrieval (${this.retrievalDurationMinutes}m)`;
    }
    if (phaseRestEl) {
      phaseRestEl.className = this.currentPhase === 'REST' ? 'badge badge-home' : 'badge badge-neutral';
    }

    // 3. Update Timer Display & Phase Title
    const displayEl = document.getElementById('pomo-timer-display');
    const titleEl = document.getElementById('pomo-phase-title');
    const remainingSecs = Math.max(0, this.phaseTargetSeconds - this.phaseElapsedSeconds);

    if (displayEl) {
      displayEl.textContent = DateUtils.formatDigitalTimer(remainingSecs);
    }
    if (titleEl) {
      if (this.state === 'STOPPED') {
        titleEl.textContent = 'Ready to Focus (25m)';
      } else if (this.currentPhase === 'FOCUS') {
        titleEl.textContent = `Phase 1: Deep Focus (${this.category})`;
      } else if (this.currentPhase === 'RETRIEVAL') {
        titleEl.textContent = `Phase 2: Active Retrieval (${this.retrievalDurationMinutes}m)`;
      } else if (this.currentPhase === 'REST') {
        titleEl.textContent = 'Phase 3: Restful Wakefulness (3m)';
      }
    }

    // 4. Update Progress Bar
    const progBar = document.getElementById('pomo-progress-bar');
    if (progBar) {
      const pct = this.phaseTargetSeconds > 0 ? Math.min(100, Math.round((this.phaseElapsedSeconds / this.phaseTargetSeconds) * 100)) : 0;
      progBar.style.width = `${pct}%`;
    }

    this.updateControlsUI();
  },

  startPhase() {
    if (this.state === 'FOCUS' || this.state === 'RETRIEVAL' || this.state === 'REST') return;

    if (this.state === 'STOPPED') {
      this.currentPhase = 'FOCUS';
      this.phaseTargetSeconds = 25 * 60;
      this.phaseElapsedSeconds = 0;
    }

    this.state = this.currentPhase;
    this.timerInterval = setInterval(() => {
      this.phaseElapsedSeconds++;
      if (this.phaseElapsedSeconds >= this.phaseTargetSeconds) {
        this.advancePhase();
      } else {
        const displayEl = document.getElementById('pomo-timer-display');
        const remainingSecs = Math.max(0, this.phaseTargetSeconds - this.phaseElapsedSeconds);
        if (displayEl) displayEl.textContent = DateUtils.formatDigitalTimer(remainingSecs);
        
        const progBar = document.getElementById('pomo-progress-bar');
        if (progBar) {
          const pct = Math.min(100, Math.round((this.phaseElapsedSeconds / this.phaseTargetSeconds) * 100));
          progBar.style.width = `${pct}%`;
        }
      }
    }, 1000);

    UI.vibrate(12);
    UI.showToast(`Pomodoro ${this.currentPhase} started`, 'info');
    this.renderPomodoro();
  },

  pausePhase() {
    if (this.state === 'STOPPED' || this.state === 'PAUSED') return;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.state = 'PAUSED';

    UI.vibrate(10);
    UI.showToast('Pomodoro paused', 'info');
    this.renderPomodoro();
  },

  /**
   * Phase progression: FOCUS (25m) -> RETRIEVAL (2-5m) -> REST (3m) -> FULL CYCLE COMPLETION
   */
  advancePhase() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    if (this.currentPhase === 'FOCUS') {
      UI.vibrate([20, 100, 20]);
      UI.showToast('Focus completed! Now do 2-5m Active Retrieval without looking at notes.', 'success', 5000);
      this.currentPhase = 'RETRIEVAL';
      this.phaseTargetSeconds = this.retrievalDurationMinutes * 60;
      this.phaseElapsedSeconds = 0;
      this.startPhase();
    } else if (this.currentPhase === 'RETRIEVAL') {
      UI.vibrate([20, 100, 20]);
      UI.showToast('Retrieval completed! Now do 3m Restful Wakefulness (eyes closed / relax).', 'info', 5000);
      this.currentPhase = 'REST';
      this.phaseTargetSeconds = 3 * 60;
      this.phaseElapsedSeconds = 0;
      this.startPhase();
    } else if (this.currentPhase === 'REST') {
      // FULL CYCLE COMPLETED!
      this.completeFullCycle();
    }
  },

  /**
   * Fully completed 3-phase cycle execution
   */
  completeFullCycle() {
    this.state = 'STOPPED';
    this.currentPhase = 'FOCUS';
    this.phaseElapsedSeconds = 0;
    this.phaseTargetSeconds = 25 * 60;

    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);

    // Single source of truth: contribute 25m (+1500s) to Cyber or English
    if (this.category === 'CYBERSECURITY') {
      const newCyber = (log.cyberSeconds || 0) + (25 * 60);
      StorageService.saveDayLog(todayISO, { cyberSeconds: newCyber });
    } else if (this.category === 'ENGLISH') {
      const newEnglish = (log.englishSeconds || 0) + (25 * 60);
      StorageService.saveDayLog(todayISO, { englishSeconds: newEnglish });
    }

    // Save persistent Pomodoro record
    StorageService.savePomodoroSession({
      date: todayISO,
      category: this.category,
      focusMinutes: 25,
      retrievalMinutes: this.retrievalDurationMinutes,
      restfulMinutes: 3,
      status: 'COMPLETED'
    });

    UI.vibrate([30, 100, 30, 100, 30]);
    UI.showToast(`🎉 Full Pomodoro Cycle Completed! +25m added to ${this.category}.`, 'success', 5000);
    this.renderPomodoro();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  resetPomodoro() {
    if (this.state !== 'STOPPED') {
      // Record abandoned session if stopped during an active cycle
      const todayISO = DateUtils.getTodayISO();
      StorageService.savePomodoroSession({
        date: todayISO,
        category: this.category,
        focusMinutes: 25,
        retrievalMinutes: this.retrievalDurationMinutes,
        restfulMinutes: 3,
        status: 'ABANDONED'
      });
    }

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.state = 'STOPPED';
    this.currentPhase = 'FOCUS';
    this.phaseElapsedSeconds = 0;
    this.phaseTargetSeconds = 25 * 60;

    UI.vibrate(10);
    UI.showToast('Pomodoro cycle reset', 'info');
    this.renderPomodoro();
  },

  updateControlsUI() {
    const startBtn = document.getElementById('pomo-start-btn');
    const pauseBtn = document.getElementById('pomo-pause-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const catSelect = document.getElementById('pomo-category-select');

    if (!startBtn || !pauseBtn || !resetBtn) return;

    if (this.state === 'FOCUS' || this.state === 'RETRIEVAL' || this.state === 'REST') {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      resetBtn.style.display = 'inline-flex';
      if (catSelect) catSelect.disabled = true;
    } else if (this.state === 'PAUSED') {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'RESUME';
      pauseBtn.style.display = 'none';
      resetBtn.style.display = 'inline-flex';
      if (catSelect) catSelect.disabled = true;
    } else {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'START POMODORO';
      pauseBtn.style.display = 'none';
      resetBtn.style.display = 'none';
      if (catSelect) catSelect.disabled = false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.PomodoroModule = PomodoroModule;
}
