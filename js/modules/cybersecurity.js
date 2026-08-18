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
    const stopBtn = document.getElementById('cyber-timer-stop-btn');

    if (startBtn) startBtn.addEventListener('click', () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTimer());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopTimer());
  },

  renderCyber() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const allLogs = StorageService.getDayLogs();

    // 1. Date-Aware ADCD Display
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const adcdContainer = document.getElementById('adcd-container');
    
    if (adcdContainer) {
      if (isWeekend) {
        adcdContainer.innerHTML = `
          <div class="prayer-info">
            <span class="prayer-name" style="font-weight: 700; font-size: var(--text-base);">ADCD</span>
            <span class="prayer-time">No class today (Weekend)</span>
          </div>
          <div class="prayer-actions">
            <span class="badge badge-neutral">OFF</span>
          </div>
        `;
      } else {
        const isAttended = log.adcdAttended === 'ATTENDED';
        adcdContainer.innerHTML = `
          <div class="prayer-info">
            <span class="prayer-name" style="font-weight: 700; font-size: var(--text-base);">ADCD Class (09:30 – 11:30 AM)</span>
            <span id="adcd-status-desc" class="prayer-time">Mon – Fri Attendance</span>
          </div>
          <div class="prayer-actions">
            <button id="adcd-toggle-btn" class="btn ${isAttended ? 'btn-success' : 'btn-secondary'} btn-sm" style="min-height: 44px; min-width: 125px; font-weight: 700;">
              ${isAttended ? 'ATTENDED ✓' : 'NOT ATTENDED'}
            </button>
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

    // 2. Cyber Logged Time Display & Aggregations
    const loggedEl = document.getElementById('cyber-today-logged');
    const totalSecsToday = log.cyberSeconds || 0;

    // Calculate Weekly, Monthly, and 9-Month Aggregations
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

    if (loggedEl) {
      loggedEl.innerHTML = `
        <div style="font-size: var(--text-xs); color: var(--text-primary); font-weight: 600; margin-bottom: 2px;">
          Today: ${DateUtils.formatDurationHoursMins(totalSecsToday)} / 4h Target
        </div>
        <div style="font-size: 11px; color: var(--text-muted);">
          Week: ${(weeklySecs / 3600).toFixed(1)}h • Month: ${(monthlySecs / 3600).toFixed(1)}h • 9M Total: ${(total9MSecs / 3600).toFixed(1)}h
        </div>
      `;
    }

    // 3. Update Timer Display & Controls UI
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
    const stopBtn = document.getElementById('cyber-timer-stop-btn');

    if (!startBtn || !pauseBtn || !stopBtn) return;

    if (this.timerState === 'RUNNING') {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      pauseBtn.textContent = 'PAUSE';
      stopBtn.style.display = 'inline-flex';
    } else if (this.timerState === 'PAUSED') {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'RESUME';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
    } else {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'START SESSION';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
    }
  }
};

if (typeof window !== 'undefined') {
  window.CyberModule = CyberModule;
}
