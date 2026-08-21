/**
 * BATMAN — Dashboard Module ("What Should I Be Doing Now?" Command Center)
 * Features single-source-of-truth timeline cycling, morning sleep logging card,
 * 21:30 Daily Review indicator, and Sunday Weekly Review indicator.
 */

const DashboardModule = {
  init() {
    this.renderDashboard();
    this.bindEvents();

    // Refresh every 30 seconds for live schedule detection & time thresholds
    setInterval(() => {
      this.updateActiveActivity();
      this.renderPriorityBanners();
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
          if (window.SleepModule) SleepModule.openSleepModal();
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

    // 2. Update Deen Status (0 / 5) -> Evaluates On-Time Prayers (MASJID or HOME)
    let completedPrayers = 0;
    if (log.prayers) {
      ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        const pObj = log.prayers[p];
        if (pObj && (pObj.status === 'MASJID' || pObj.status === 'HOME' || pObj.status === 'COMPLETED')) {
          completedPrayers++;
        }
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

    // 3. Update Cyber Deep Work Progress (Evaluates 4h Independent Target)
    const cyberSecs = log.cyberSeconds || 0;
    const cyberStatEl = document.getElementById('home-cyber-stat');
    const cyberBarEl = document.getElementById('home-cyber-bar');
    if (cyberStatEl) cyberStatEl.textContent = `${DateUtils.formatDurationHoursMins(cyberSecs)} / 4h`;
    if (cyberBarEl) {
      const pct = Math.min(100, Math.round((cyberSecs / CONFIG.TARGETS.CYBER_DAILY_SECONDS) * 100));
      cyberBarEl.style.width = `${pct}%`;
      cyberBarEl.className = pct >= 100 ? 'progress-fill success' : 'progress-fill';
    }

    // 4. Update English Practice Progress (30m Target)
    const englishSecs = log.englishSeconds || 0;
    const englishStatEl = document.getElementById('home-english-stat');
    const englishBarEl = document.getElementById('home-english-bar');
    if (englishStatEl) englishStatEl.textContent = `${DateUtils.formatDurationHoursMins(englishSecs)} / 30m`;
    if (englishBarEl) {
      const pct = Math.min(100, Math.round((englishSecs / CONFIG.TARGETS.ENGLISH_DAILY_SECONDS) * 100));
      englishBarEl.style.width = `${pct}%`;
      englishBarEl.className = pct >= 100 ? 'progress-fill success' : 'progress-fill';
    }

    // 5. Update Gym Status & Weekly Counter
    const gymStatusEl = document.getElementById('home-gym-status');
    const gymWeeklyEl = document.getElementById('home-gym-weekly');
    const curGym = log.gymStatus || 'NOT_RECORDED';

    if (gymStatusEl) {
      if (curGym === 'DONE') {
        gymStatusEl.textContent = 'Done ✓';
        gymStatusEl.style.color = 'var(--status-success)';
      } else if (curGym === 'REST') {
        gymStatusEl.textContent = 'Rest Day';
        gymStatusEl.style.color = 'var(--accent-primary)';
      } else if (curGym === 'MISSED') {
        gymStatusEl.textContent = 'Missed';
        gymStatusEl.style.color = 'var(--status-danger)';
      } else {
        gymStatusEl.textContent = 'Not Recorded';
        gymStatusEl.style.color = 'var(--text-secondary)';
      }
    }

    const past7Days = DateUtils.getPastDaysISO(7);
    const allLogs = StorageService.getDayLogs();
    let weeklyGym = 0;
    past7Days.forEach(d => {
      if (allLogs[d] && (allLogs[d].gymStatus === 'DONE' || allLogs[d].gymAttended === true)) weeklyGym++;
    });
    if (gymWeeklyEl) gymWeeklyEl.textContent = `Weekly: ${weeklyGym} / ${CONFIG.TARGETS.GYM_WEEKLY_SESSIONS} this week`;

    // 6. Update Sleep Card
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

    // 7. Render Morning Sleep Card & Evening Priority Banners
    this.renderPriorityBanners();

    // 8. Update Next Activity & Schedule Timeline
    this.updateActiveActivity();
    this.renderScheduleTimeline();
  },

  /**
   * High-Priority Persistent Banners:
   * - Morning Sleep Logging Card (if sleep is not logged for today)
   * - Evening 21:30 Daily Review indicator (if current time >= 21:30 and review uncompleted)
   * - Sunday 20:00 Weekly Review indicator
   */
  renderPriorityBanners() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dayOfWeek = now.getDay();

    // 1. Morning Sleep Banner
    const morningSleepContainer = document.getElementById('home-morning-sleep-card');
    if (morningSleepContainer) {
      if (!log.sleepHours) {
        morningSleepContainer.style.display = 'block';
        morningSleepContainer.innerHTML = `
          <div class="card" style="border: 1px solid var(--accent-primary); background: rgba(217, 119, 6, 0.08); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 800; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.5px;">GOOD MORNING</span>
              <span class="badge badge-warning" style="font-size: 10px;">Pending</span>
            </div>
            <div style="font-size: var(--text-base); font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">Sleep not logged</div>
            <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-3);">Log yesterday's sleep before starting your day.</div>
            <button id="home-log-sleep-action-btn" class="btn btn-primary btn-block" style="min-height: 40px; font-weight: 700;">LOG SLEEP</button>
          </div>
        `;
        const sleepBtn = morningSleepContainer.querySelector('#home-log-sleep-action-btn');
        if (sleepBtn) {
          sleepBtn.addEventListener('click', () => {
            if (window.SleepModule) SleepModule.openSleepModal();
          });
        }
      } else {
        morningSleepContainer.style.display = 'none';
      }
    }

    // 2. Evening 21:30 Daily Review Banner
    const reviewBannerContainer = document.getElementById('home-daily-review-banner');
    if (reviewBannerContainer) {
      const isPastReviewTime = currentHHMM >= '21:30';
      const isReviewDone = Boolean(log.review);

      if (isPastReviewTime && !isReviewDone) {
        reviewBannerContainer.style.display = 'block';
        reviewBannerContainer.innerHTML = `
          <div class="card" style="border: 1px solid var(--status-warning); background: rgba(245, 158, 11, 0.08); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: var(--text-sm); font-weight: 800; color: var(--status-warning);">DAILY REVIEW NOT COMPLETED</div>
                <div style="font-size: var(--text-xs); color: var(--text-secondary);">Reflect on today's execution and set tomorrow's commitments.</div>
              </div>
              <button id="home-start-review-action-btn" class="btn btn-primary btn-sm" style="min-height: 38px; font-weight: 700; white-space: nowrap;">START REVIEW</button>
            </div>
          </div>
        `;
        const startRevBtn = reviewBannerContainer.querySelector('#home-start-review-action-btn');
        if (startRevBtn) {
          startRevBtn.addEventListener('click', () => {
            if (window.ReviewsModule) ReviewsModule.openDailyReviewModal();
          });
        }
      } else {
        reviewBannerContainer.style.display = 'none';
      }
    }

    // 3. Sunday 20:00 Weekly Review Banner
    const weeklyBannerContainer = document.getElementById('home-weekly-review-banner');
    if (weeklyBannerContainer) {
      const isSunday = (dayOfWeek === 0);
      const isPastWeeklyTime = currentHHMM >= '20:00';
      const weekStart = DateUtils.getWeekStartISO();
      const weeklyReviews = StorageService.getWeeklyReviews();
      const isWeeklyDone = Boolean(weeklyReviews[weekStart]);

      if (isSunday && isPastWeeklyTime && !isWeeklyDone) {
        weeklyBannerContainer.style.display = 'block';
        weeklyBannerContainer.innerHTML = `
          <div class="card" style="border: 1px solid var(--status-info); background: rgba(14, 165, 233, 0.08); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: var(--text-sm); font-weight: 800; color: var(--status-info);">WEEKLY REVIEW READY</div>
                <div style="font-size: var(--text-xs); color: var(--text-secondary);">Compare week-over-week discipline metrics and set next week's commitments.</div>
              </div>
              <button id="home-start-weekly-action-btn" class="btn btn-secondary btn-sm" style="min-height: 38px; font-weight: 700; white-space: nowrap;">WEEKLY REVIEW</button>
            </div>
          </div>
        `;
        const startWeeklyBtn = weeklyBannerContainer.querySelector('#home-start-weekly-action-btn');
        if (startWeeklyBtn) {
          startWeeklyBtn.addEventListener('click', () => {
            if (window.ReviewsModule) ReviewsModule.openWeeklyReviewModal();
          });
        }
      } else {
        weeklyBannerContainer.style.display = 'none';
      }
    }
  },

  /**
   * Builds chronological schedule items from routines and calculates dynamic prayer anchors
   */
  getChronologicalSchedule() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const routines = StorageService.getRoutines();
    const prayerTimes = PrayerService.getPrayerTimes(now);

    const items = [];

    routines.forEach(r => {
      if (r.isActive === false || r.active === false) return;
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
      let isTimeBased = false;
      let progressText = '';

      // 1. 5 Daily Prayers
      if (r.id === 'routine-fajr' || r.id === 'routine-dhuhr' || r.id === 'routine-asr' || r.id === 'routine-maghrib' || r.id === 'routine-isha') {
        const pKey = r.id.replace('routine-', '');
        const pRec = (log.prayers && log.prayers[pKey]) || { status: 'NOT_RECORDED' };
        const rawStatus = pRec.status || 'NOT_RECORDED';

        if (rawStatus === 'MASJID' || (rawStatus === 'COMPLETED' && pRec.location === 'MASJID')) {
          isCompleted = true;
          buttonText = 'MASJID ✓';
          buttonClass = 'btn-success';
        } else if (rawStatus === 'HOME' || (rawStatus === 'COMPLETED' && pRec.location === 'HOME')) {
          isCompleted = true;
          buttonText = 'HOME ✓';
          buttonClass = 'btn-primary';
        } else if (rawStatus === 'QADA') {
          buttonText = 'QADA';
          buttonClass = 'btn-warning';
        } else if (rawStatus === 'MISSED') {
          buttonText = 'MISSED';
          buttonClass = 'btn-danger';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      } 
      // 2. Tahajjud
      else if (r.id === 'routine-tahajjud') {
        const cur = log.tahajjud || 'NOT_RECORDED';
        if (cur === 'PRAYED' || cur === 'COMPLETED') {
          isCompleted = true;
          buttonText = 'PRAYED ✓';
          buttonClass = 'btn-success';
        } else if (cur === 'MISSED') {
          buttonText = 'MISSED';
          buttonClass = 'btn-danger';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 3. Duha
      else if (r.id === 'routine-duha') {
        const cur = log.duha || 'NOT_RECORDED';
        if (cur === 'PRAYED') {
          isCompleted = true;
          buttonText = 'PRAYED ✓';
          buttonClass = 'btn-success';
        } else if (cur === 'MISSED') {
          buttonText = 'MISSED';
          buttonClass = 'btn-danger';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 4. Witr
      else if (r.id === 'routine-witr') {
        const cur = log.witr || 'NOT_RECORDED';
        if (cur === 'PRAYED') {
          isCompleted = true;
          buttonText = 'PRAYED ✓';
          buttonClass = 'btn-success';
        } else if (cur === 'MISSED') {
          buttonText = 'MISSED';
          buttonClass = 'btn-danger';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 5. Morning Adhkar
      else if (r.id === 'routine-morning-adhkar' || r.name.toLowerCase().includes('morning adhkar')) {
        if (log.morningAdhkar === 'COMPLETED') {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 6. Evening Adhkar
      else if (r.id === 'routine-evening-adhkar' || r.name.toLowerCase().includes('evening adhkar')) {
        if (log.eveningAdhkar === 'COMPLETED') {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 7. 12 Sunnah Rak'at
      else if (r.id === 'routine-sunnah' || r.name.toLowerCase().includes('sunnah')) {
        const totalSunnah = CalcUtils.calculateSunnahTotal(log.sunnahRakat);
        isCompleted = totalSunnah >= 12;
        buttonText = `${totalSunnah}/12 RAK'AT`;
        buttonClass = isCompleted ? 'btn-success' : (totalSunnah > 0 ? 'btn-secondary' : 'btn-outline');
      }
      // 8. Morning Qur’an Tafsir & Memorization
      else if (r.id === 'routine-quran-am') {
        if (log.quranTafsir === 'COMPLETED' || (log.quranMemoCount || 0) > 0 || (log.customRoutines && log.customRoutines.includes('routine-quran-am'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 9. Evening Qur’an Recitation
      else if (r.id === 'routine-quran-pm') {
        if (log.quranRecitation === 'COMPLETED' || (log.customRoutines && log.customRoutines.includes('routine-quran-pm'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 10. ADCD Offensive Security Class
      else if (r.id === 'routine-adcd') {
        if (log.adcdAttended === 'ATTENDED') {
          isCompleted = true;
          buttonText = 'ATTENDED ✓';
          buttonClass = 'btn-success';
        }
      }
      // 11. Gym Workout Session
      else if (r.id === 'routine-gym') {
        const cur = log.gymStatus || (log.gymAttended ? 'DONE' : 'NOT_RECORDED');
        if (cur === 'DONE') {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        } else if (cur === 'REST') {
          buttonText = 'REST';
          buttonClass = 'btn-secondary';
        } else if (cur === 'MISSED') {
          buttonText = 'MISSED';
          buttonClass = 'btn-danger';
        } else {
          buttonText = 'NOT RECORDED';
          buttonClass = 'btn-secondary';
        }
      }
      // 12. Cyber Deep Work (Time-based: 4h target)
      else if (r.id === 'routine-cyber-work') {
        isTimeBased = true;
        const cyberSecs = log.cyberSeconds || 0;
        const targetSecs = CONFIG.TARGETS.CYBER_DAILY_SECONDS || 14400;
        isCompleted = cyberSecs >= targetSecs;
        buttonText = 'LOG TIME';
        buttonClass = isCompleted ? 'btn-success' : (cyberSecs > 0 ? 'btn-secondary' : 'btn-outline');
        progressText = `${DateUtils.formatDurationHoursMins(cyberSecs)} / 4h${isCompleted ? ' ✓' : ''}`;
      }
      // 13. English Practice (Time-based: 30m target)
      else if (r.id === 'routine-english') {
        isTimeBased = true;
        const englishSecs = log.englishSeconds || 0;
        const targetSecs = CONFIG.TARGETS.ENGLISH_DAILY_SECONDS || 1800;
        isCompleted = englishSecs >= targetSecs;
        buttonText = 'LOG TIME';
        buttonClass = isCompleted ? 'btn-success' : (englishSecs > 0 ? 'btn-secondary' : 'btn-outline');
        progressText = `${DateUtils.formatDurationHoursMins(englishSecs)} / 30m${isCompleted ? ' ✓' : ''}`;
      }
      // 14. Daily Review & Sleep Wind Down
      else if (r.id === 'routine-review-sleep') {
        if (log.review || log.sleepHours || (log.customRoutines && log.customRoutines.includes('routine-review-sleep'))) {
          isCompleted = true;
          buttonText = 'DONE ✓';
          buttonClass = 'btn-success';
        }
      }
      // 15. General / Custom Routines
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
        buttonClass,
        isTimeBased,
        progressText
      });
    });

    return items.sort((a, b) => a.startMins - b.startMins);
  },

  /**
   * 1-Tap Rapid Cycling & Action Execution for any schedule item
   */
  toggleRoutineCompleted(routineId) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const routines = StorageService.getRoutines();
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    // Time-based quick-actions open the dedicated time logging prompt
    if (routineId === 'routine-cyber-work') {
      this.openTimeLogModal('CYBER');
      return;
    }
    if (routineId === 'routine-english') {
      this.openTimeLogModal('ENGLISH');
      return;
    }

    const updates = {};
    let customRoutines = Array.isArray(log.customRoutines) ? [...log.customRoutines] : [];

    // 1. 5 Daily Prayers (5-State Cycling)
    if (routineId === 'routine-fajr' || routineId === 'routine-dhuhr' || routineId === 'routine-asr' || routineId === 'routine-maghrib' || routineId === 'routine-isha') {
      const prayerKey = routineId.replace('routine-', '');
      if (window.DeenModule) {
        DeenModule.cyclePrayer(prayerKey);
        this.renderDashboard();
        return;
      }
    }
    // 2. Tahajjud
    else if (routineId === 'routine-tahajjud') {
      if (window.DeenModule) {
        DeenModule.cycleTahajjud();
        this.renderDashboard();
        return;
      }
    }
    // 3. Duha
    else if (routineId === 'routine-duha') {
      if (window.DeenModule) {
        DeenModule.cycleDuha();
        this.renderDashboard();
        return;
      }
    }
    // 4. Witr
    else if (routineId === 'routine-witr') {
      if (window.DeenModule) {
        DeenModule.cycleWitr();
        this.renderDashboard();
        return;
      }
    }
    // 5. Morning Adhkar
    else if (routineId === 'routine-morning-adhkar' || routine.name.toLowerCase().includes('morning adhkar')) {
      const isDone = log.morningAdhkar === 'COMPLETED';
      updates.morningAdhkar = isDone ? 'NOT_RECORDED' : 'COMPLETED';
      UI.showToast(`Morning Adhkar ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 6. Evening Adhkar
    else if (routineId === 'routine-evening-adhkar' || routine.name.toLowerCase().includes('evening adhkar')) {
      const isDone = log.eveningAdhkar === 'COMPLETED';
      updates.eveningAdhkar = isDone ? 'NOT_RECORDED' : 'COMPLETED';
      UI.showToast(`Evening Adhkar ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 7. Sunnah Rak'at -> switch to Deen
    else if (routineId === 'routine-sunnah' || routine.name.toLowerCase().includes('sunnah')) {
      UI.switchTab('deen');
      return;
    }
    // 8. Gym (Cycling: NOT_RECORDED -> DONE -> REST -> MISSED -> NOT_RECORDED)
    else if (routineId === 'routine-gym') {
      const cur = log.gymStatus || (log.gymAttended ? 'DONE' : 'NOT_RECORDED');
      let next = 'DONE';
      if (cur === 'NOT_RECORDED') next = 'DONE';
      else if (cur === 'DONE') next = 'REST';
      else if (cur === 'REST') next = 'MISSED';
      else if (cur === 'MISSED') next = 'NOT_RECORDED';

      updates.gymStatus = next;
      updates.gymAttended = (next === 'DONE');
      UI.showToast(`Gym status set to: ${next}`, next === 'DONE' ? 'success' : 'info', 2000);
    }
    // 9. Morning Qur’an Tafsir
    else if (routineId === 'routine-quran-am') {
      const isDone = log.quranTafsir === 'COMPLETED';
      updates.quranTafsir = isDone ? 'NOT_COMPLETED' : 'COMPLETED';
      UI.showToast(`Morning Qur’an Tafsir ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 10. Evening Qur’an Recitation
    else if (routineId === 'routine-quran-pm') {
      const isDone = log.quranRecitation === 'COMPLETED';
      updates.quranRecitation = isDone ? 'NOT_COMPLETED' : 'COMPLETED';
      UI.showToast(`Evening Qur’an Recitation ${isDone ? 'marked incomplete' : 'completed ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 11. ADCD Attendance
    else if (routineId === 'routine-adcd') {
      const isDone = log.adcdAttended === 'ATTENDED';
      updates.adcdAttended = isDone ? 'NOT_ATTENDED' : 'ATTENDED';
      UI.showToast(`ADCD Class ${isDone ? 'marked not attended' : 'attended ✓'}`, isDone ? 'info' : 'success', 2000);
    }
    // 12. Daily Review & Sleep Wind Down
    else if (routineId === 'routine-review-sleep') {
      if (window.ReviewsModule) {
        ReviewsModule.openDailyReviewModal();
        return;
      }
    }
    // 13. General / Custom Routines
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

  /**
   * Home Quick-Action Time Logging Modal for Cybersecurity & English Practice
   * Manually sets the final completed total for TODAY.
   */
  openTimeLogModal(type) {
    const isCyber = type === 'CYBER';
    const activeTimer = StorageService.getActiveTimer();

    // Prevent manual entry while a timer is actively ticking
    if (activeTimer && activeTimer.type === type && activeTimer.state === 'RUNNING') {
      UI.vibrate([15, 50, 15]);
      UI.showToast("Stop the active timer before manually setting today's total.", 'warning', 4000);
      return;
    }

    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const currentSecs = isCyber ? (log.cyberSeconds || 0) : (log.englishSeconds || 0);
    const title = isCyber ? 'LOG CYBERSECURITY TIME' : 'LOG ENGLISH PRACTICE';
    const targetText = isCyber ? '4h Target' : '30m Target';

    const currentHours = Math.floor(currentSecs / 3600);
    const currentMins = Math.floor((currentSecs % 3600) / 60);

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-3); line-height: 1.4;">
          How much did you complete today? <span style="font-size: var(--text-xs); color: var(--accent-primary); font-weight: 700;">(${targetText})</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: var(--text-xs);">Hours (0–24)</label>
            <input type="number" id="timelog-hours" class="form-input" min="0" max="24" step="1" placeholder="0" value="${currentHours > 0 ? currentHours : ''}" style="text-align: center; font-size: var(--text-xl); font-family: var(--font-mono); font-weight: 800; height: 48px;">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: var(--text-xs);">Minutes (0–59)</label>
            <input type="number" id="timelog-minutes" class="form-input" min="0" max="59" step="1" placeholder="0" value="${currentMins > 0 ? currentMins : ''}" style="text-align: center; font-size: var(--text-xl); font-family: var(--font-mono); font-weight: 800; height: 48px;">
          </div>
        </div>

        <div style="background-color: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); margin-bottom: 6px;">
            <span style="color: var(--text-muted); font-weight: 600;">Currently logged today:</span>
            <span style="font-family: var(--font-mono); font-weight: 800; color: var(--text-primary);">${DateUtils.formatDurationHoursMins(currentSecs)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); border-top: 1px solid var(--border-subtle); padding-top: 6px;">
            <span style="color: var(--text-muted); font-weight: 600;">New daily total will become:</span>
            <span id="timelog-preview-total" style="font-family: var(--font-mono); font-weight: 800; color: var(--accent-primary); font-size: var(--text-sm);">${DateUtils.formatDurationHoursMins(currentSecs)}</span>
          </div>
        </div>

        <button id="timelog-save-btn" class="btn btn-primary btn-block" style="min-height: 48px; font-weight: 700; font-size: var(--text-base);">SET TOTAL FOR TODAY</button>
      </div>
    `;

    const hoursInput = container.querySelector('#timelog-hours');
    const minsInput = container.querySelector('#timelog-minutes');
    const previewEl = container.querySelector('#timelog-preview-total');
    const saveBtn = container.querySelector('#timelog-save-btn');

    const updatePreview = () => {
      const h = parseInt(hoursInput.value, 10) || 0;
      const m = parseInt(minsInput.value, 10) || 0;
      const totalS = (Math.max(0, Math.min(24, h)) * 3600) + (Math.max(0, Math.min(59, m)) * 60);
      previewEl.textContent = DateUtils.formatDurationHoursMins(totalS);
    };

    hoursInput.addEventListener('input', updatePreview);
    minsInput.addEventListener('input', updatePreview);

    saveBtn.addEventListener('click', () => {
      const h = parseInt(hoursInput.value, 10) || 0;
      const m = parseInt(minsInput.value, 10) || 0;
      const newTotalSeconds = (Math.max(0, Math.min(24, h)) * 3600) + (Math.max(0, Math.min(59, m)) * 60);

      const applySave = () => {
        if (isCyber) {
          StorageService.saveDayLog(todayISO, { cyberSeconds: newTotalSeconds });
        } else {
          StorageService.saveDayLog(todayISO, { englishSeconds: newTotalSeconds });
        }

        UI.closeSheet();
        UI.vibrate(12);
        UI.showToast(`Set today's ${isCyber ? 'Cybersecurity' : 'English'} total to ${DateUtils.formatDurationHoursMins(newTotalSeconds)}`, 'success');
        this.renderDashboard();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      };

      if (newTotalSeconds < currentSecs && currentSecs > 0) {
        if (confirm(`You entered ${DateUtils.formatDurationHoursMins(newTotalSeconds)}, which is LESS than what was already logged (${DateUtils.formatDurationHoursMins(currentSecs)}). Overwrite today's total?`)) {
          applySave();
        }
      } else {
        applySave();
      }
    });

    UI.openSheet(title, container);
  },

  updateActiveActivity() {
    const items = this.getChronologicalSchedule();
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let activeItem = items.find(item => currentMins >= item.startMins && currentMins < item.endMins);
    if (!activeItem) {
      activeItem = items.find(item => item.startMins > currentMins) || items[0];
    }

    const titleEl = document.getElementById('hero-activity-title');
    const timeEl = document.getElementById('hero-activity-time');
    const descEl = document.getElementById('hero-activity-desc');
    const btnEl = document.getElementById('hero-action-btn');

    if (activeItem && titleEl) {
      titleEl.textContent = activeItem.name;
      if (timeEl) {
        timeEl.textContent = activeItem.duration ? `${DateUtils.format12Hour(activeItem.startTimeStr)} • ${activeItem.duration}m` : DateUtils.format12Hour(activeItem.startTimeStr);
      }

      if (btnEl) {
        if (activeItem.id === 'routine-cyber-work' || activeItem.id === 'routine-cyber-rev') {
          btnEl.setAttribute('data-action', 'cyber');
          btnEl.textContent = 'START FOCUS';
        } else if (activeItem.id === 'routine-english') {
          btnEl.setAttribute('data-action', 'english');
          btnEl.textContent = 'START PRACTICE';
        } else if (activeItem.id.includes('prayer') || activeItem.id.includes('quran') || activeItem.id.includes('tahajjud')) {
          btnEl.setAttribute('data-action', 'deen');
          btnEl.textContent = 'OPEN DEEN';
        } else {
          btnEl.setAttribute('data-action', 'routine');
          btnEl.textContent = 'VIEW SCHEDULE';
        }
      }
    }
  },

  renderScheduleTimeline() {
    const container = document.getElementById('schedule-timeline-container');
    if (!container) return;

    const items = this.getChronologicalSchedule();
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    container.innerHTML = items.map(item => {
      const isCurrent = (currentMins >= item.startMins && currentMins < item.endMins);

      return `
        <div class="schedule-item ${isCurrent ? 'active' : ''} ${item.isCompleted ? 'completed' : ''}" style="padding: 12px; margin-bottom: 8px; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid ${isCurrent ? 'var(--accent-primary)' : 'var(--border-subtle)'}; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div style="font-family: var(--font-mono); font-size: var(--text-xs); color: ${isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)'}; font-weight: 700; min-width: 60px;">
              ${DateUtils.format12Hour(item.startTimeStr)}
            </div>
            <div>
              <div style="font-size: var(--text-sm); font-weight: 700; color: ${item.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${item.isCompleted ? 'line-through' : 'none'};">
                ${item.name}
              </div>
              <div style="font-size: 11px; color: var(--text-secondary);">
                ${item.duration ? `${item.duration} mins` : 'Flexible window'} ${item.progressText ? `• ${item.progressText}` : ''}
              </div>
            </div>
          </div>
          <div>
            <button class="btn ${item.buttonClass} btn-sm" style="min-height: 38px; min-width: 100px; font-size: 11px; font-weight: 700;" onclick="DashboardModule.toggleRoutineCompleted('${item.id}')">
              ${item.buttonText}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
};

if (typeof window !== 'undefined') {
  window.DashboardModule = DashboardModule;
}
