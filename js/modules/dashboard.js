/**
 * BATMAN — Dashboard Module ("What Should I Be Doing Now?" Command Center)
 */

const DashboardModule = {
  init() {
    this.renderDashboard();
    this.bindEvents();

    // Refresh every minute for schedule detection
    setInterval(() => {
      this.updateActiveActivity();
    }, 30000);

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'home') this.renderDashboard();
    });

    window.addEventListener('batman:data-updated', () => {
      this.renderDashboard();
    });
  },

  bindEvents() {
    const heroBtn = document.getElementById('hero-action-btn');
    if (heroBtn) {
      heroBtn.addEventListener('click', () => {
        const actionType = heroBtn.getAttribute('data-action');
        if (actionType === 'cyber') {
          UI.switchTab('growth');
          if (window.CyberModule) CyberModule.startTimer();
        } else if (actionType === 'english') {
          UI.switchTab('growth');
          if (window.EnglishModule) EnglishModule.startTimer();
        } else if (actionType === 'deen') {
          UI.switchTab('deen');
        } else if (actionType === 'sleep') {
          UI.switchTab('growth');
          const sleepBtn = document.getElementById('sleep-log-btn');
          if (sleepBtn) sleepBtn.click();
        } else if (actionType === 'progress') {
          UI.switchTab('progress');
        } else {
          UI.showToast('Ready for scheduled activity', 'info');
        }
      });
    }
  },

  renderDashboard() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);

    // 1. Update Today Header
    const dateEl = document.getElementById('today-date-str');
    if (dateEl) dateEl.textContent = DateUtils.formatHeaderDate();

    // 2. Update Deen Status (0 / 5)
    let completedPrayers = 0;
    if (log.prayers) {
      ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        if (log.prayers[p] && log.prayers[p].status === 'COMPLETED') completedPrayers++;
      });
    }
    const deenStatEl = document.getElementById('home-deen-stat');
    const deenBarEl = document.getElementById('home-deen-bar');
    if (deenStatEl) deenStatEl.textContent = `${completedPrayers} / 5`;
    if (deenBarEl) {
      const pct = (completedPrayers / 5) * 100;
      deenBarEl.style.width = `${pct}%`;
      deenBarEl.className = pct === 100 ? 'progress-fill success' : 'progress-fill';
    }

    // 3. Update Cyber Deep Work Progress
    const cyberSecs = log.cyberSeconds || 0;
    const cyberStatEl = document.getElementById('home-cyber-stat');
    const cyberBarEl = document.getElementById('home-cyber-bar');
    if (cyberStatEl) cyberStatEl.textContent = `${DateUtils.formatDurationHoursMins(cyberSecs)} / 4h`;
    if (cyberBarEl) {
      const pct = Math.min(100, Math.round((cyberSecs / CONFIG.TARGETS.CYBER_DAILY_SECONDS) * 100));
      cyberBarEl.style.width = `${pct}%`;
      cyberBarEl.className = pct >= 100 ? 'progress-fill success' : 'progress-fill';
    }

    // 4. Update English Practice Progress
    const englishSecs = log.englishSeconds || 0;
    const englishStatEl = document.getElementById('home-english-stat');
    const englishBarEl = document.getElementById('home-english-bar');
    if (englishStatEl) englishStatEl.textContent = `${DateUtils.formatDurationHoursMins(englishSecs)} / 30m`;
    if (englishBarEl) {
      const pct = Math.min(100, Math.round((englishSecs / CONFIG.TARGETS.ENGLISH_DAILY_SECONDS) * 100));
      englishBarEl.style.width = `${pct}%`;
      englishBarEl.className = pct >= 100 ? 'progress-fill success' : 'progress-fill';
    }

    // 5. Update Gym & Sleep Cards
    const gymStatusEl = document.getElementById('home-gym-status');
    const gymWeeklyEl = document.getElementById('home-gym-weekly');
    if (gymStatusEl) {
      gymStatusEl.textContent = log.gymAttended ? 'Attended ✓' : 'Rest / Unlogged';
      gymStatusEl.style.color = log.gymAttended ? 'var(--status-success)' : 'var(--text-primary)';
    }

    // Calculate weekly gym count
    const past7Days = DateUtils.getPastDaysISO(7);
    const allLogs = StorageService.getDayLogs();
    let weeklyGym = 0;
    past7Days.forEach(d => {
      if (allLogs[d] && allLogs[d].gymAttended) weeklyGym++;
    });
    if (gymWeeklyEl) gymWeeklyEl.textContent = `Weekly: ${weeklyGym} / ${CONFIG.TARGETS.GYM_WEEKLY_SESSIONS} this week`;

    // Sleep
    const sleepStatusEl = document.getElementById('home-sleep-status');
    const sleepAvgEl = document.getElementById('home-sleep-avg');
    if (sleepStatusEl) {
      sleepStatusEl.textContent = log.sleepHours ? `${parseFloat(log.sleepHours).toFixed(1)}h / 7.5h` : '-- / 7.5h';
    }

    let sleepSum = 0;
    let sleepDaysCount = 0;
    past7Days.forEach(d => {
      if (allLogs[d] && allLogs[d].sleepHours) {
        sleepSum += parseFloat(allLogs[d].sleepHours);
        sleepDaysCount++;
      }
    });
    const avgSleep = sleepDaysCount > 0 ? (sleepSum / sleepDaysCount).toFixed(1) : '--';
    if (sleepAvgEl) sleepAvgEl.textContent = `7d Avg: ${avgSleep}h`;

    // 6. Update Next Activity & Schedule Timeline
    this.updateActiveActivity();
    this.renderScheduleTimeline();
  },

  getChronologicalSchedule() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const routines = StorageService.getRoutines();
    const prayerTimes = PrayerService.getPrayerTimes(now);

    const items = [];

    routines.forEach(r => {
      if (r.isActive === false || r.active === false) return;
      // Skip weekend routines if configured
      if (r.days && Array.isArray(r.days) && r.days.length > 0 && !r.days.includes(dayOfWeek)) return;
      if (r.id === 'routine-adcd' && isWeekend) return;

      let startTimeStr = r.time;
      if (r.anchor === 'prayer-fajr') startTimeStr = prayerTimes.fajr;
      else if (r.anchor === 'prayer-dhuhr') startTimeStr = prayerTimes.dhuhr;
      else if (r.anchor === 'prayer-asr') startTimeStr = prayerTimes.asr;
      else if (r.anchor === 'prayer-maghrib') startTimeStr = prayerTimes.maghrib;
      else if (r.anchor === 'prayer-isha') startTimeStr = prayerTimes.isha;
      else if (r.anchor === 'relative-pre-fajr') {
        const fajrMins = DateUtils.parseTimeToMinutes(prayerTimes.fajr);
        startTimeStr = DateUtils.minutesToHHMM(fajrMins - 30);
      } else if (r.anchor === 'after-fajr') {
        const fajrMins = DateUtils.parseTimeToMinutes(prayerTimes.fajr);
        startTimeStr = DateUtils.minutesToHHMM(fajrMins + 30);
      } else if (r.anchor === 'after-maghrib') {
        const maghribMins = DateUtils.parseTimeToMinutes(prayerTimes.maghrib);
        startTimeStr = DateUtils.minutesToHHMM(maghribMins + 25);
      }

      let startMins = DateUtils.parseTimeToMinutes(startTimeStr);
      if (isNaN(startMins) || startMins < 0) startMins = 0;
      const rawDur = (r.duration !== undefined && r.duration !== null && r.duration !== '') ? parseInt(r.duration, 10) : null;
      const duration = (rawDur !== null && !isNaN(rawDur) && rawDur > 0) ? rawDur : null;
      const activeWindowMins = duration !== null ? duration : 20;
      const endMins = (startMins + activeWindowMins) % 1440;

      let isCompleted = false;
      let buttonText = 'COMPLETE';
      let buttonClass = 'btn-outline';

      // 1. Check 5 Prayers by ID
      if (r.id === 'routine-fajr' || r.id === 'routine-dhuhr' || r.id === 'routine-asr' || r.id === 'routine-maghrib' || r.id === 'routine-isha') {
        const pKey = r.id.replace('routine-', '');
        const pRec = (log.prayers && log.prayers[pKey]) || { status: 'NOT_COMPLETED', location: '' };
        if (pRec.status === 'COMPLETED') {
          isCompleted = true;
          if (pRec.location === 'MASJID') {
            buttonText = 'MASJID ✓';
            buttonClass = 'btn-success';
          } else if (pRec.location === 'HOME') {
            buttonText = 'HOME ✓';
            buttonClass = 'btn-primary';
          } else {
            buttonText = 'DONE ✓';
            buttonClass = 'btn-success';
          }
        }
      } 
      // 2. Tahajjud
      else if (r.id === 'routine-tahajjud') {
        if (log.tahajjud === 'COMPLETED') {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 3. Morning Qur’an Tafsir & Memorization
      else if (r.id === 'routine-quran-am') {
        if (log.quranTafsir === 'COMPLETED' || (log.quranMemoCount || 0) > 0 || (log.customRoutines && log.customRoutines.includes('routine-quran-am'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 4. Evening Qur’an Recitation
      else if (r.id === 'routine-quran-pm') {
        if (log.quranRecitation === 'COMPLETED' || (log.customRoutines && log.customRoutines.includes('routine-quran-pm'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 5. ADCD Offensive Security Class
      else if (r.id === 'routine-adcd') {
        if (log.adcdAttended === 'ATTENDED') {
          isCompleted = true;
          buttonText = 'ATTENDED ✓';
          buttonClass = 'btn-success';
        }
      }
      // 6. Gym Workout Session
      else if (r.id === 'routine-gym') {
        if (log.gymAttended) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 7. Cyber Deep Work
      else if (r.id === 'routine-cyber-work') {
        if ((log.cyberSeconds || 0) >= (CONFIG.TARGETS.CYBER_DAILY_SECONDS || 14400)) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 8. English Communication
      else if (r.id === 'routine-english') {
        if ((log.englishSeconds || 0) >= (CONFIG.TARGETS.ENGLISH_DAILY_SECONDS || 3600)) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 9. Daily Review & Sleep Wind Down
      else if (r.id === 'routine-review-sleep') {
        if (log.sleepHours || (log.customRoutines && log.customRoutines.includes('routine-review-sleep'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 10. General / Custom Routines (Breakfast, Commute In, Commute Out, Cyber Rev, etc.)
      else if (log.customRoutines && Array.isArray(log.customRoutines) && log.customRoutines.includes(r.id)) {
        isCompleted = true;
        buttonText = 'DONE ✓';
        buttonClass = 'btn-success';
      }

      items.push({
        ...r,
        startMins,
        endMins,
        duration,
        startTimeStr: DateUtils.minutesToHHMM(startMins),
        endTimeStr: duration !== null ? DateUtils.minutesToHHMM((startMins + duration) % 1440) : '',
        isCompleted,
        buttonText,
        buttonClass
      });
    });

    return items.sort((a, b) => a.startMins - b.startMins);
  },

  /**
   * 1-Tap Quick Action to Toggle Any Schedule Item directly from the Home Dashboard
   */
  toggleRoutineCompleted(routineId) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const routines = StorageService.getRoutines();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    const updates = {};
    let customRoutines = Array.isArray(log.customRoutines) ? [...log.customRoutines] : [];

    // 1. 5 Daily Prayers (3-state cycle: NOT_COMPLETED -> MASJID -> HOME -> NOT_COMPLETED)
    if (routineId === 'routine-fajr' || routineId === 'routine-dhuhr' || routineId === 'routine-asr' || routineId === 'routine-maghrib' || routineId === 'routine-isha') {
      const prayerKey = routineId.replace('routine-', '');
      const current = (log.prayers && log.prayers[prayerKey]) || { status: 'NOT_COMPLETED', location: '' };

      let nextStatus = 'COMPLETED';
      let nextLocation = 'MASJID';

      if (current.status === 'COMPLETED' && current.location === 'MASJID') {
        nextLocation = 'HOME';
      } else if (current.status === 'COMPLETED' && current.location === 'HOME') {
        nextStatus = 'NOT_COMPLETED';
        nextLocation = '';
      }

      const pLabel = prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1);
      const locLabel = nextLocation ? ` (${nextLocation === 'MASJID' ? 'Masjid' : 'Home'})` : '';
      UI.showToast(`${pLabel} marked ${nextStatus === 'COMPLETED' ? 'completed' + locLabel + ' ✓' : 'incomplete'}`, nextStatus === 'COMPLETED' ? 'success' : 'info', 2000);

      updates.prayers = {
        ...(log.prayers || {}),
        [prayerKey]: {
          status: nextStatus,
          location: nextLocation,
          timestamp: nextStatus === 'COMPLETED' ? DateUtils.getNowISO() : null
        }
      };
    }
    // 2. Tahajjud
    else if (routineId === 'routine-tahajjud') {
      const isDone = log.tahajjud === 'COMPLETED';
      updates.tahajjud = isDone ? 'MISSED' : 'COMPLETED';
      UI.showToast(`Tahajjud ${isDone ? 'marked missed' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 3. Morning Qur’an Tafsir & Memorization
    else if (routineId === 'routine-quran-am') {
      const isDone = log.quranTafsir === 'COMPLETED';
      updates.quranTafsir = isDone ? 'NOT_COMPLETED' : 'COMPLETED';
      UI.showToast(`Morning Qur’an Tafsir ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 4. Evening Qur’an Recitation
    else if (routineId === 'routine-quran-pm') {
      const isDone = log.quranRecitation === 'COMPLETED';
      updates.quranRecitation = isDone ? 'NOT_COMPLETED' : 'COMPLETED';
      UI.showToast(`Evening Qur’an Recitation ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 5. ADCD Offensive Security Class
    else if (routineId === 'routine-adcd') {
      const isDone = log.adcdAttended === 'ATTENDED';
      updates.adcdAttended = isDone ? 'NOT_ATTENDED' : 'ATTENDED';
      UI.showToast(`ADCD Class ${isDone ? 'marked not attended' : 'attended ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 6. Gym Workout Session
    else if (routineId === 'routine-gym') {
      const isDone = Boolean(log.gymAttended);
      updates.gymAttended = !isDone;
      UI.showToast(`Gym Workout ${isDone ? 'marked unattended' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 7. Cyber Deep Work (Toggles 4h completed target)
    else if (routineId === 'routine-cyber-work') {
      const targetSecs = CONFIG.TARGETS.CYBER_DAILY_SECONDS || 14400;
      const isDone = (log.cyberSeconds || 0) >= targetSecs;
      updates.cyberSeconds = isDone ? 0 : targetSecs;
      UI.showToast(`Cyber Deep Work ${isDone ? 'reset to 0h' : 'completed (4h) ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 8. English Communication & Practice (Toggles 1h target)
    else if (routineId === 'routine-english') {
      const targetSecs = CONFIG.TARGETS.ENGLISH_DAILY_SECONDS || 3600;
      const isDone = (log.englishSeconds || 0) >= targetSecs;
      updates.englishSeconds = isDone ? 0 : targetSecs;
      UI.showToast(`English Practice ${isDone ? 'reset to 0m' : 'completed (1h) ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 9. Daily Review & Sleep Wind Down
    else if (routineId === 'routine-review-sleep') {
      const isDone = customRoutines.includes('routine-review-sleep') || Boolean(log.sleepHours);
      if (isDone) {
        customRoutines = customRoutines.filter(id => id !== 'routine-review-sleep');
        UI.showToast('Daily Review & Sleep Wind Down marked incomplete', 'info', 2000);
      } else {
        customRoutines.push('routine-review-sleep');
        UI.showToast('Daily Review & Sleep Wind Down completed ✓', 'success', 2000);
      }
      updates.customRoutines = customRoutines;
    }
    // 10. General / Custom Routines (Commute In, Commute Out, Breakfast, Cyber Rev, etc.)
    else {
      if (customRoutines.includes(routineId)) {
        customRoutines = customRoutines.filter(id => id !== routineId);
        UI.showToast(`${routine.name} marked incomplete`, 'info', 2000);
      } else {
        customRoutines.push(routineId);
        UI.showToast(`${routine.name} marked completed ✓`, 'success', 2000);
      }
      updates.customRoutines = customRoutines;
    }

    StorageService.saveDayLog(todayISO, updates);
    UI.vibrate(10);
    this.renderDashboard();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  updateActiveActivity() {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const fullTimeline = this.getChronologicalSchedule();

    const nowTimeEl = document.getElementById('schedule-now-time');
    if (nowTimeEl) nowTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Find active routine or next upcoming routine
    let currentItem = fullTimeline.find(item => currentMins >= item.startMins && currentMins < item.endMins);
    let nextItem = fullTimeline.find(item => item.startMins > currentMins && !item.isCompleted);

    const heroContainer = document.getElementById('hero-schedule-container');
    const heroTitle = document.getElementById('hero-activity-title');
    const heroTime = document.getElementById('hero-activity-time');
    const heroBtn = document.getElementById('hero-action-btn');

    if (!heroContainer || !heroTitle || !heroTime || !heroBtn) return;

    if (currentItem) {
      heroContainer.querySelector('.hero-tag').textContent = currentItem.isCompleted ? 'CURRENT (DONE ✓)' : 'ACTIVE NOW';
      heroTitle.textContent = currentItem.name;
      heroTime.textContent = currentItem.duration 
        ? `${DateUtils.format12Hour(currentItem.startTimeStr)} – ${DateUtils.format12Hour(currentItem.endTimeStr)}`
        : DateUtils.format12Hour(currentItem.startTimeStr);

      const lower = currentItem.name.toLowerCase();
      if (lower.includes('cyber')) {
        heroBtn.textContent = 'START SESSION';
        heroBtn.setAttribute('data-action', 'cyber');
      } else if (lower.includes('english')) {
        heroBtn.textContent = 'START PRACTICE';
        heroBtn.setAttribute('data-action', 'english');
      } else if (lower.includes('prayer') || lower.includes('qur') || lower.includes('fajr') || lower.includes('dhuhr') || lower.includes('asr') || lower.includes('maghrib') || lower.includes('isha')) {
        heroBtn.textContent = 'VIEW DEEN TRACKER';
        heroBtn.setAttribute('data-action', 'deen');
      } else if (lower.includes('gym')) {
        heroBtn.textContent = 'VIEW FITNESS';
        heroBtn.setAttribute('data-action', 'growth');
      } else if (lower.includes('sleep')) {
        heroBtn.textContent = 'LOG SLEEP';
        heroBtn.setAttribute('data-action', 'sleep');
      } else {
        heroBtn.textContent = 'CONFIRM ACTIVITY';
        heroBtn.setAttribute('data-action', 'general');
      }
    } else if (nextItem) {
      heroContainer.querySelector('.hero-tag').textContent = 'NEXT UP';
      heroTitle.textContent = nextItem.name;
      heroTime.textContent = nextItem.duration 
        ? `${DateUtils.format12Hour(nextItem.startTimeStr)} – ${DateUtils.format12Hour(nextItem.endTimeStr)}`
        : DateUtils.format12Hour(nextItem.startTimeStr);
      
      const lower = nextItem.name.toLowerCase();
      if (lower.includes('cyber')) {
        heroBtn.textContent = 'START SESSION';
        heroBtn.setAttribute('data-action', 'cyber');
      } else if (lower.includes('english')) {
        heroBtn.textContent = 'START PRACTICE';
        heroBtn.setAttribute('data-action', 'english');
      } else {
        heroBtn.textContent = 'START';
        heroBtn.setAttribute('data-action', 'general');
      }
    } else {
      heroContainer.querySelector('.hero-tag').textContent = 'NEXT UP';
      heroTitle.textContent = 'No scheduled activity';
      heroTime.textContent = 'Free / Recovery period';
      heroBtn.textContent = 'VIEW PROGRESS';
      heroBtn.setAttribute('data-action', 'progress');
    }
  },

  renderScheduleTimeline() {
    const container = document.getElementById('home-schedule-timeline');
    if (!container) return;

    const timeline = this.getChronologicalSchedule();
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (timeline.length === 0) {
      container.innerHTML = `
        <div style="padding: var(--space-4); text-align: center; color: var(--text-muted); font-size: var(--text-sm);">
          Free / Unscheduled
        </div>
      `;
      return;
    }

    container.innerHTML = timeline.map(item => {
      const isCurrent = currentMins >= item.startMins && currentMins < item.endMins;
      const statusSymbol = item.isCompleted ? '✓' : (isCurrent ? '→' : '○');
      const statusClass = item.isCompleted ? 'schedule-completed' : (isCurrent ? 'schedule-current' : 'schedule-upcoming');
      const highlightStyle = isCurrent ? 'background-color: var(--bg-surface-elevated); border-left: 3px solid var(--accent-primary); padding-left: 10px; margin: 4px 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;' : '';

      let btnLabel = item.buttonText;
      let btnClass = item.buttonClass;
      if (!item.isCompleted && isCurrent) {
        btnLabel = 'MARK DONE';
        btnClass = 'btn-primary';
      }

      return `
        <div class="prayer-row ${statusClass}" style="padding: 10px 0; ${highlightStyle} display: flex; align-items: center; justify-content: space-between;">
          <div class="prayer-info" style="flex: 1; cursor: pointer; padding-right: 8px;" data-action="toggle-routine" data-routine-id="${item.id}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-family: var(--font-mono); font-size: var(--text-sm); color: ${item.isCompleted ? 'var(--status-success)' : (isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)')};">${statusSymbol}</span>
              <span style="font-size: var(--text-sm); font-weight: ${isCurrent ? '700' : '600'}; color: ${isCurrent ? 'var(--text-primary)' : (item.isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)')}; text-decoration: ${item.isCompleted ? 'line-through' : 'none'};">${item.name}</span>
            </div>
            <span class="prayer-time" style="margin-left: 20px;">${DateUtils.format12Hour(item.startTimeStr)}${item.duration ? ` – ${DateUtils.format12Hour(item.endTimeStr)}` : ''}</span>
          </div>
          <button class="btn ${btnClass} routine-toggle-btn" 
                  data-routine-id="${item.id}">
            ${btnLabel}
          </button>
        </div>
      `;
    }).join('');

    // Bind 1-tap quick complete action to both the button and row click
    container.querySelectorAll('.routine-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const routineId = btn.getAttribute('data-routine-id');
        this.toggleRoutineCompleted(routineId);
      });
    });

    container.querySelectorAll('[data-action="toggle-routine"]').forEach(row => {
      row.addEventListener('click', () => {
        const routineId = row.getAttribute('data-routine-id');
        this.toggleRoutineCompleted(routineId);
      });
    });
  }
};

if (typeof window !== 'undefined') {
  window.DashboardModule = DashboardModule;
}
