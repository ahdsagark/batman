/**
 * BATMAN — English & IELTS Module (30m Focus Timer & IELTS Mock Test Tracker)
 */

const EnglishModule = {
  timerInterval: null,
  timerState: 'STOPPED', // 'RUNNING' | 'PAUSED' | 'STOPPED'
  sessionStartTimestamp: null,
  sessionElapsedSeconds: 0,

  init() {
    this.restoreActiveTimer();
    this.renderEnglish();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'growth') this.renderEnglish();
    });
  },

  restoreActiveTimer() {
    const saved = StorageService.getActiveTimer();
    if (!saved || saved.type !== 'ENGLISH') return;

    if (saved.state === 'RUNNING') {
      this.timerState = 'RUNNING';
      this.sessionStartTimestamp = saved.startTimestamp;
      this.sessionElapsedSeconds = Math.max(0, Math.floor((Date.now() - this.sessionStartTimestamp) / 1000));
      
      this.timerInterval = setInterval(() => {
        this.sessionElapsedSeconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000);
        const displayEl = document.getElementById('english-timer-display');
        if (displayEl) {
          displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
        }
      }, 1000);
    } else if (saved.state === 'PAUSED') {
      this.timerState = 'PAUSED';
      this.sessionElapsedSeconds = saved.elapsedSeconds || 0;
      const displayEl = document.getElementById('english-timer-display');
      if (displayEl) {
        displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
      }
    }
  },

  bindEvents() {
    // Timer Controls
    const startBtn = document.getElementById('english-timer-start-btn');
    const pauseBtn = document.getElementById('english-timer-pause-btn');
    const stopBtn = document.getElementById('english-timer-stop-btn');

    if (startBtn) startBtn.addEventListener('click', () => this.startTimer());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTimer());
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopTimer());

    // IELTS Mock Test Button
    const mockBtn = document.getElementById('ielts-log-mock-btn');
    if (mockBtn) mockBtn.addEventListener('click', () => this.openIELTSModal());
  },

  renderEnglish() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const allLogs = StorageService.getDayLogs();
    const totalSecsToday = log.englishSeconds || 0;

    // 1. Header Badge
    const headerBadge = document.getElementById('english-header-badge');
    if (headerBadge) {
      const isMet = totalSecsToday >= 1800;
      headerBadge.textContent = `${DateUtils.formatDurationHoursMins(totalSecsToday)} / 30m${isMet ? ' ✓' : ''}`;
      headerBadge.className = isMet ? 'badge badge-masjid' : (totalSecsToday > 0 ? 'badge badge-home' : 'badge badge-neutral');
    }

    // 2. Progress Bar & Percent
    const pct = Math.min(100, Math.round((totalSecsToday / 1800) * 100));
    const progTextEl = document.getElementById('english-progress-percentage');
    const progBarEl = document.getElementById('english-progress-bar');
    if (progTextEl) {
      progTextEl.textContent = `${pct}%${totalSecsToday >= 1800 ? ' (Target Achieved ✓)' : ''}`;
      progTextEl.style.color = totalSecsToday >= 1800 ? 'var(--status-success)' : 'var(--accent-primary)';
    }
    if (progBarEl) {
      progBarEl.style.width = `${pct}%`;
      if (totalSecsToday >= 1800) progBarEl.classList.add('success');
      else progBarEl.classList.remove('success');
    }

    // 3. Timer Status Badge
    const timerBadge = document.getElementById('english-timer-status-badge');
    if (timerBadge) {
      if (this.timerState === 'RUNNING') {
        timerBadge.textContent = '● PRACTICING';
        timerBadge.className = 'badge badge-masjid';
      } else if (this.timerState === 'PAUSED') {
        timerBadge.textContent = '● PAUSED';
        timerBadge.className = 'badge badge-home';
      } else {
        timerBadge.textContent = 'READY';
        timerBadge.className = 'badge badge-neutral';
      }
    }

    // 4. Aggregations (Week & Streak)
    const past7 = DateUtils.getPastDaysISO(7);
    const past30 = DateUtils.getPastDaysISO(30);
    let weeklySecs = 0;

    past7.forEach(d => {
      if (allLogs[d]) weeklySecs += (allLogs[d].englishSeconds || 0);
    });

    const streak = CalcUtils.calculateStreak(past30, (d) => {
      return allLogs[d] && (allLogs[d].englishSeconds || 0) >= 1200; // at least 20m for streak
    });

    const statToday = document.getElementById('english-stat-today');
    const statWeek = document.getElementById('english-stat-week');
    const statStreak = document.getElementById('english-stat-streak');

    if (statToday) statToday.textContent = DateUtils.formatDurationHoursMins(totalSecsToday);
    if (statWeek) statWeek.textContent = `${(weeklySecs / 3600).toFixed(1)}h`;
    if (statStreak) statStreak.textContent = `${streak}d`;

    // 5. Render IELTS Mock Scoreboard
    const historyContainer = document.getElementById('ielts-history-container');
    if (historyContainer) {
      const mocks = StorageService.getIELTSRecords();
      if (!mocks || mocks.length === 0) {
        historyContainer.innerHTML = `
          <div style="text-align: center; padding: var(--space-4) var(--space-2); background: rgba(0,0,0,0.15); border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
            <div style="font-size: 1.8rem; margin-bottom: var(--space-1);">🎯</div>
            <div style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">No Mock Exams Recorded</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: var(--space-3);">Take Cambridge IELTS mock tests and record your 4-module band scores here.</div>
            <button class="btn btn-outline btn-sm" onclick="EnglishModule.openIELTSModal()" style="font-weight: 700; min-height: 36px;">+ Record First Mock Test</button>
          </div>
        `;
      } else {
        const latest = mocks[0];
        const isTargetMet = parseFloat(latest.overall) >= 7.5;
        
        let historyHTML = `
          <!-- Latest Mock Hero Banner -->
          <div style="background: linear-gradient(135deg, var(--bg-surface), var(--bg-surface-elevated)); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 14px; margin-bottom: var(--space-3); box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">LATEST MOCK EXAM (${latest.date})</span>
              <span class="badge ${isTargetMet ? 'badge-masjid' : 'badge-home'}" style="font-size: 12px; font-weight: 800; padding: 4px 10px;">
                OVERALL ${latest.overall} ${isTargetMet ? '✓' : ''}
              </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
              <div style="background: rgba(0,0,0,0.25); padding: 8px 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">🎧 LISTEN</div>
                <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: ${parseFloat(latest.listening) >= 7.0 ? 'var(--status-success)' : 'var(--text-primary)'};">${latest.listening}</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">📖 READ</div>
                <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: ${parseFloat(latest.reading) >= 7.0 ? 'var(--status-success)' : 'var(--text-primary)'};">${latest.reading}</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">✍️ WRITE</div>
                <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: ${parseFloat(latest.writing) >= 7.0 ? 'var(--status-success)' : 'var(--text-primary)'};">${latest.writing}</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 8px 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">🗣️ SPEAK</div>
                <div style="font-size: 1.15rem; font-weight: 800; font-family: var(--font-mono); color: ${parseFloat(latest.speaking) >= 7.0 ? 'var(--status-success)' : 'var(--text-primary)'};">${latest.speaking}</div>
              </div>
            </div>
          </div>
        `;

        if (mocks.length > 1) {
          historyHTML += `
            <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: var(--space-3) 0 var(--space-2) 0;">
              Past Test History
            </div>
            ${mocks.slice(1, 5).map(m => `
              <div class="prayer-row" style="padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
                <div class="prayer-info">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge ${parseFloat(m.overall) >= 7.5 ? 'badge-masjid' : 'badge-home'}" style="font-size: 11px; font-weight: 800;">
                      Band ${m.overall}
                    </span>
                    <span class="prayer-time" style="font-size: 11px;">${m.date}</span>
                  </div>
                  <div style="font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary); margin-top: 4px;">
                    L: <strong style="color: var(--text-primary);">${m.listening}</strong> • R: <strong style="color: var(--text-primary);">${m.reading}</strong> • W: <strong style="color: var(--text-primary);">${m.writing}</strong> • S: <strong style="color: var(--text-primary);">${m.speaking}</strong>
                  </div>
                </div>
              </div>
            `).join('')}
          `;
        }

        historyContainer.innerHTML = historyHTML;
      }
    }

    // 6. Update Timer Display & Controls UI
    const displayEl = document.getElementById('english-timer-display');
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
      type: 'ENGLISH',
      state: 'RUNNING',
      startTimestamp: this.sessionStartTimestamp
    });

    this.timerInterval = setInterval(() => {
      this.sessionElapsedSeconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000);
      const displayEl = document.getElementById('english-timer-display');
      if (displayEl) {
        displayEl.textContent = DateUtils.formatDigitalTimer(this.sessionElapsedSeconds);
      }
    }, 1000);

    UI.vibrate(12);
    UI.showToast('English practice started', 'info');
    this.updateControlsUI();
  },

  pauseTimer() {
    if (this.timerState !== 'RUNNING') return;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.timerState = 'PAUSED';

    StorageService.saveActiveTimer({
      type: 'ENGLISH',
      state: 'PAUSED',
      elapsedSeconds: this.sessionElapsedSeconds
    });

    UI.vibrate(10);
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

    const displayEl = document.getElementById('english-timer-display');
    if (displayEl) displayEl.textContent = '00:00:00';

    if (recordedSeconds > 10) {
      const todayISO = DateUtils.getTodayISO();
      const log = StorageService.getDayLog(todayISO);
      const newTotal = (log.englishSeconds || 0) + recordedSeconds;

      StorageService.saveDayLog(todayISO, { englishSeconds: newTotal });
      UI.showToast(`Logged ${DateUtils.formatDurationHoursMins(recordedSeconds)} of English practice`, 'success');
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    }

    this.renderEnglish();
  },

  updateControlsUI() {
    const startBtn = document.getElementById('english-timer-start-btn');
    const pauseBtn = document.getElementById('english-timer-pause-btn');
    const stopBtn = document.getElementById('english-timer-stop-btn');

    if (!startBtn || !pauseBtn || !stopBtn) return;

    if (this.timerState === 'RUNNING') {
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
    } else if (this.timerState === 'PAUSED') {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'RESUME';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'inline-flex';
    } else {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'START PRACTICE';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
    }
  },

  openIELTSModal() {
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group">
        <label class="form-label">Mock Test Date</label>
        <input type="date" id="mock-date" class="form-input" value="${DateUtils.getTodayISO()}">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
        <div>
          <label class="form-label">Listening</label>
          <input type="number" id="mock-l" class="form-input" min="0" max="9" step="0.5" value="7.5">
        </div>
        <div>
          <label class="form-label">Reading</label>
          <input type="number" id="mock-r" class="form-input" min="0" max="9" step="0.5" value="7.5">
        </div>
        <div>
          <label class="form-label">Writing</label>
          <input type="number" id="mock-w" class="form-input" min="0" max="9" step="0.5" value="7.0">
        </div>
        <div>
          <label class="form-label">Speaking</label>
          <input type="number" id="mock-s" class="form-input" min="0" max="9" step="0.5" value="7.5">
        </div>
      </div>
      <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-4); text-align: center;">
        <span class="form-label" style="margin-bottom: 2px;">Calculated Overall Band</span>
        <span id="mock-calculated-overall" style="font-size: var(--text-2xl); font-weight: 800; color: var(--accent-primary);">7.5</span>
      </div>
      <button id="mock-submit-btn" class="btn btn-primary btn-block">Save IELTS Mock Test</button>
    `;

    const updateCalculatedOverall = () => {
      const l = parseFloat(form.querySelector('#mock-l').value) || 0;
      const r = parseFloat(form.querySelector('#mock-r').value) || 0;
      const w = parseFloat(form.querySelector('#mock-w').value) || 0;
      const s = parseFloat(form.querySelector('#mock-s').value) || 0;
      const overall = CalcUtils.calculateIELTSOverall(l, r, w, s);
      form.querySelector('#mock-calculated-overall').textContent = overall.toFixed(1);
    };

    form.querySelectorAll('input[type="number"]').forEach(inp => {
      inp.addEventListener('input', updateCalculatedOverall);
    });

    form.querySelector('#mock-submit-btn').addEventListener('click', () => {
      const date = form.querySelector('#mock-date').value;
      const l = parseFloat(form.querySelector('#mock-l').value) || 0;
      const r = parseFloat(form.querySelector('#mock-r').value) || 0;
      const w = parseFloat(form.querySelector('#mock-w').value) || 0;
      const s = parseFloat(form.querySelector('#mock-s').value) || 0;
      const overall = CalcUtils.calculateIELTSOverall(l, r, w, s);

      StorageService.saveIELTSRecord({
        date,
        listening: l,
        reading: r,
        writing: w,
        speaking: s,
        overall
      });

      UI.closeSheet();
      UI.showToast(`IELTS Mock Saved (Overall ${overall})`, 'success');
      this.renderEnglish();
    });

    UI.openSheet('Log IELTS Mock Test', form);
  }
};

if (typeof window !== 'undefined') {
  window.EnglishModule = EnglishModule;
}
