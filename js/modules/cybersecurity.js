/**
 * BATMAN — Cybersecurity Module (ADCD Attendance & 4h Deep Work Focus Timer)
 */

const CyberModule = {
  timerInterval: null,
  timerState: 'STOPPED', // 'RUNNING' | 'PAUSED' | 'STOPPED'
  sessionStartTimestamp: null,
  sessionElapsedSeconds: 0,

  init() {
    this.restoreActiveTimer();
    this.renderCyber();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'growth') this.renderCyber();
    });

    window.addEventListener('batman:data-updated', () => {
      this.renderCyber();
    });
  },

  restoreActiveTimer() {
    const saved = StorageService.getActiveTimer();
    if (!saved || saved.type !== 'CYBER') return;

    if (saved.state === 'RUNNING') {
      this.timerState = 'RUNNING';
      this.sessionStartTimestamp = saved.startTimestamp;
      this.sessionElapsedSeconds = Math.max(0, Math.floor((Date.now() - this.sessionStartTimestamp) / 1000));
      
      this.timerInterval = setInterval(() => {
        this.sessionElapsedSeconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000);
        const displayEl = document.getElementById('cyber-timer-display');
        if (displayEl) {
          displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
        }
      }, 1000);
    } else if (saved.state === 'PAUSED') {
      this.timerState = 'PAUSED';
      this.sessionElapsedSeconds = saved.elapsedSeconds || 0;
      const displayEl = document.getElementById('cyber-timer-display');
      if (displayEl) {
        displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
      }
    }
  },

  bindEvents() {
    // ADCD Attendance Toggle
    const adcdBtn = document.getElementById('adcd-toggle-btn');
    if (adcdBtn) {
      adcdBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextStatus = log.adcdAttended === 'ATTENDED' ? 'NOT_ATTENDED' : 'ATTENDED';
        StorageService.saveDayLog(todayISO, { adcdAttended: nextStatus });
        UI.vibrate(10);
        this.renderCyber();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }

    // Timer Controls
    const startBtn = document.getElementById('cyber-timer-start-btn');
    const pauseBtn = document.getElementById('cyber-timer-pause-btn');
    const resetBtn = document.getElementById('cyber-timer-reset-btn');
    const stopBtn = document.getElementById('cyber-timer-stop-btn');

    if (startBtn) startBtn.addEventListener('click', () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTimer());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetTimer());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopTimer());
  },

  renderCyber() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const allLogs = StorageService.getDayLogs();
    const totalSecsToday = log.cyberSeconds || 0;
    const invest = CalcUtils.calculateCyberTotalInvestment(totalSecsToday, log.adcdAttended);

    // 1. Header Badge (Independent Deep Work)
    const headerBadge = document.getElementById('cyber-header-badge');
    if (headerBadge) {
      const isMet = totalSecsToday >= 14400;
      headerBadge.textContent = `${DateUtils.formatDurationHoursMins(totalSecsToday)} / 4h${isMet ? ' ✓' : ''}`;
      headerBadge.className = isMet ? 'badge badge-masjid' : (totalSecsToday > 0 ? 'badge badge-home' : 'badge badge-neutral');
    }

    // 2. Date-Aware ADCD Display
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const adcdContainer = document.getElementById('adcd-container');
    
    if (adcdContainer) {
      if (isWeekend) {
        adcdContainer.innerHTML = `
          <div class="prayer-row" style="margin-bottom: var(--space-3);">
            <div class="prayer-info">
              <span class="prayer-name">ADCD Class (09:30 – 11:30 AM)</span>
              <span class="prayer-time">No class today (Weekend)</span>
            </div>
            <div class="prayer-actions">
              <span class="badge badge-neutral">OFF</span>
            </div>
          </div>
        `;
      } else {
        const isAttended = log.adcdAttended === 'ATTENDED';
        adcdContainer.innerHTML = `
          <div class="prayer-row" style="margin-bottom: var(--space-3);">
            <div class="prayer-info">
              <span class="prayer-name">ADCD Class (09:30 – 11:30 AM)</span>
              <span id="adcd-status-desc" class="prayer-time">Mon – Fri Attendance (+2h)</span>
            </div>
            <div class="prayer-actions">
              <button id="adcd-toggle-btn" class="btn ${isAttended ? 'btn-success' : 'btn-secondary'} btn-sm" style="min-height: 44px; min-width: 125px; font-weight: 700;">
                ${isAttended ? 'ATTENDED ✓' : 'NOT ATTENDED'}
              </button>
            </div>
          </div>
        `;
        const btn = document.getElementById('adcd-toggle-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            const nextStatus = log.adcdAttended === 'ATTENDED' ? 'NOT_ATTENDED' : 'ATTENDED';
            StorageService.saveDayLog(todayISO, { adcdAttended: nextStatus });
            UI.vibrate(10);
            this.renderCyber();
            window.dispatchEvent(new CustomEvent('batman:data-updated'));
          });
        }
      }
    }

    // 3. Deep Work Progress Bar & Percent (Evaluates Independent Target 4h strictly)
    const pct = invest.independentTargetPct;
    const progTextEl = document.getElementById('cyber-progress-percentage');
    const progBarEl = document.getElementById('cyber-progress-bar');
    if (progTextEl) {
      progTextEl.textContent = `${pct}%${totalSecsToday >= 14400 ? ' (Target Achieved ✓)' : ''}`;
      progTextEl.style.color = totalSecsToday >= 14400 ? 'var(--status-success)' : 'var(--accent-primary)';
    }
    if (progBarEl) {
      progBarEl.style.width = `${pct}%`;
      if (totalSecsToday >= 14400) progBarEl.classList.add('success');
      else progBarEl.classList.remove('success');
    }

    // 4. Timer Status Badge
    const timerBadge = document.getElementById('cyber-timer-status-badge');
    if (timerBadge) {
      if (this.timerState === 'RUNNING') {
        timerBadge.textContent = '● FOCUSING';
        timerBadge.className = 'badge badge-masjid';
      } else if (this.timerState === 'PAUSED') {
        timerBadge.textContent = '● PAUSED';
        timerBadge.className = 'badge badge-home';
      } else {
        timerBadge.textContent = 'READY';
        timerBadge.className = 'badge badge-neutral';
      }
    }

    // 5. Total Cybersecurity Investment Breakdown
    const totalInvestEl = document.getElementById('cyber-total-investment-val');
    const totalInvestSubEl = document.getElementById('cyber-total-investment-sub');
    if (totalInvestEl) {
      totalInvestEl.textContent = invest.totalFormatted;
    }
    if (totalInvestSubEl) {
      totalInvestSubEl.textContent = `${invest.independentFormatted} Independent + ${invest.adcdFormatted} ADCD`;
    }

    // 6. Calculate Weekly, Monthly, and 9-Month Aggregations
    let weeklySecs = 0;
    let monthlySecs = 0;
    let total9MSecs = 0;

    const past7 = DateUtils.getPastDaysISO(7);
    const past30 = DateUtils.getPastDaysISO(30);

    Object.keys(allLogs).forEach(dateStr => {
      const daySecs = allLogs[dateStr].cyberSeconds || 0;
      total9MSecs += daySecs;
      if (past7.includes(dateStr)) weeklySecs += daySecs;
      if (past30.includes(dateStr)) monthlySecs += daySecs;
    });

    const statToday = document.getElementById('cyber-stat-today');
    const statTodaySub = document.getElementById('cyber-stat-today-sub');
    const statWeek = document.getElementById('cyber-stat-week');
    const statMonth = document.getElementById('cyber-stat-month');
    const stat9m = document.getElementById('cyber-stat-9m');

    if (statToday) statToday.textContent = DateUtils.formatDurationHoursMins(totalSecsToday);
    if (statTodaySub) statTodaySub.textContent = `Target: 4.0h ${totalSecsToday >= 14400 ? '✓' : ''}`;
    if (statWeek) statWeek.textContent = `${(weeklySecs / 3600).toFixed(1)}h`;
    if (statMonth) statMonth.textContent = `${(monthlySecs / 3600).toFixed(1)}h`;
    if (stat9m) stat9m.textContent = `${(total9MSecs / 3600).toFixed(1)}h`;

    // 7. Update Timer Display & Controls UI
    const displayEl = document.getElementById('cyber-timer-display');
    if (displayEl) {
      displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
    }
    this.updateControlsUI();
  },

  startTimer() {
    if (this.timerState === 'RUNNING') return;

    this.timerState = 'RUNNING';
    this.sessionStartTimestamp = Date.now() - (this.sessionElapsedSeconds * 1000);

    StorageService.saveActiveTimer({
      type: 'CYBER',
      state: 'RUNNING',
      startTimestamp: this.sessionStartTimestamp
    });

    this.timerInterval = setInterval(() => {
      this.sessionElapsedSeconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000);
      const displayEl = document.getElementById('cyber-timer-display');
      if (displayEl) {
        displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
      }
    }, 1000);

    UI.vibrate(12);
    UI.showToast('Cybersecurity session started', 'info');
    this.updateControlsUI();
  },

  pauseTimer() {
    if (this.timerState !== 'RUNNING') return;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.timerState = 'PAUSED';

    StorageService.saveActiveTimer({
      type: 'CYBER',
      state: 'PAUSED',
      elapsedSeconds: this.sessionElapsedSeconds
    });

    UI.vibrate(10);
    UI.showToast('Session paused', 'info');
    this.updateControlsUI();
  },

  /**
   * RESET Timer: Discards ONLY the current active/paused session.
   * Keeps today's accumulated total completely untouched!
   */
  resetTimer() {
    if (this.timerState === 'STOPPED' && this.sessionElapsedSeconds === 0) return;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.timerState = 'STOPPED';
    this.sessionElapsedSeconds = 0;

    StorageService.clearActiveTimer();

    const displayEl = document.getElementById('cyber-timer-display');
    if (displayEl) displayEl.textContent = '00:00:00';

    UI.vibrate(10);
    UI.showToast('Current session discarded (today total preserved)', 'info');
    this.updateControlsUI();
    this.renderCyber();
  },

  stopTimer() {
    if (this.timerState === 'STOPPED') return;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.timerState = 'STOPPED';

    StorageService.clearActiveTimer();

    const recordedSeconds = this.sessionElapsedSeconds;
    this.sessionElapsedSeconds = 0;

    const displayEl = document.getElementById('cyber-timer-display');
    if (displayEl) displayEl.textContent = '00:00:00';

    if (recordedSeconds > 5) {
      const todayISO = DateUtils.getTodayISO();
      const log = StorageService.getDayLog(todayISO);
      const newTotal = (log.cyberSeconds || 0) + recordedSeconds;

      StorageService.saveDayLog(todayISO, { cyberSeconds: newTotal });
      UI.showToast(`Logged ${DateUtils.formatDurationHoursMins(recordedSeconds)} of Deep Work`, 'success');
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    } else {
      UI.showToast('Session discarded (< 5s)', 'info');
    }

    this.renderCyber();
  },

  updateControlsUI() {
    const startBtn = document.getElementById('cyber-timer-start-btn');
    const pauseBtn = document.getElementById('cyber-timer-pause-btn');
    const resetBtn = document.getElementById('cyber-timer-reset-btn');
    const stopBtn = document.getElementById('cyber-timer-stop-btn');

    if (!startBtn || !pauseBtn || !stopBtn) return;

    if (this.timerState === 'RUNNING') {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      pauseBtn.textContent = 'PAUSE';
      if (resetBtn) resetBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
    } else if (this.timerState === 'PAUSED') {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'RESUME';
      pauseBtn.style.display = 'none';
      if (resetBtn) resetBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
    } else {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'START SESSION';
      pauseBtn.style.display = 'none';
      if (resetBtn) resetBtn.style.display = 'none';
      stopBtn.style.display = 'none';
    }
  }
};

if (typeof window !== 'undefined') {
  window.CyberModule = CyberModule;
}
