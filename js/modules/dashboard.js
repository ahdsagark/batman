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
        startTimeStr = DateUtils.minutesToHHMM(fajrMins - 60);
      } else if (r.anchor === 'after-fajr') {
        const fajrMins = DateUtils.parseTimeToMinutes(prayerTimes.fajr);
        startTimeStr = DateUtils.minutesToHHMM(fajrMins + 30);
      } else if (r.anchor === 'after-maghrib') {
        const maghribMins = DateUtils.parseTimeToMinutes(prayerTimes.maghrib);
        startTimeStr = DateUtils.minutesToHHMM(maghribMins + 25);
      }

      let startMins = DateUtils.parseTimeToMinutes(startTimeStr);
      if (isNaN(startMins) || startMins < 0) startMins = 0;
      const duration = parseInt(r.duration, 10) || 30;
      const endMins = (startMins + duration) % 1440;

      // Determine completion status
      let isCompleted = false;
      const lowerName = (r.name || '').toLowerCase();

      if (lowerName.includes('fajr') && log.prayers && log.prayers.fajr && log.prayers.fajr.status === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('dhuhr') && log.prayers && log.prayers.dhuhr && log.prayers.dhuhr.status === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('asr') && log.prayers && log.prayers.asr && log.prayers.asr.status === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('maghrib') && log.prayers && log.prayers.maghrib && log.prayers.maghrib.status === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('isha') && log.prayers && log.prayers.isha && log.prayers.isha.status === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('tahajjud') && log.tahajjud === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('qur') && (lowerName.includes('morning') || lowerName.includes('tafsir')) && (log.quranTafsir === 'COMPLETED' || (log.quranMemoCount || 0) > 0)) isCompleted = true;
      else if (lowerName.includes('qur') && (lowerName.includes('evening') || lowerName.includes('recitation')) && log.quranRecitation === 'COMPLETED') isCompleted = true;
      else if (lowerName.includes('adcd') && log.adcdAttended === 'ATTENDED') isCompleted = true;
      else if (lowerName.includes('cyber') && (log.cyberSeconds || 0) >= (CONFIG.TARGETS.CYBER_DAILY_SECONDS || 14400)) isCompleted = true;
      else if (lowerName.includes('english') && (log.englishSeconds || 0) >= (CONFIG.TARGETS.ENGLISH_DAILY_SECONDS || 3600)) isCompleted = true;
      else if (lowerName.includes('gym') && log.gymAttended) isCompleted = true;
      else if (lowerName.includes('sleep') && log.sleepHours) isCompleted = true;

      items.push({
        ...r,
        startMins,
        endMins,
        duration,
        startTimeStr: DateUtils.minutesToHHMM(startMins),
        endTimeStr: DateUtils.minutesToHHMM(startMins + duration),
        isCompleted
      });
    });

    return items.sort((a, b) => a.startMins - b.startMins);
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
      heroTime.textContent = `${DateUtils.format12Hour(currentItem.startTimeStr)} – ${DateUtils.format12Hour(currentItem.endTimeStr)}`;

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
      heroTime.textContent = `${DateUtils.format12Hour(nextItem.startTimeStr)} – ${DateUtils.format12Hour(nextItem.endTimeStr)}`;
      
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
      const isPast = currentMins >= item.endMins;

      let statusSymbol = '○';
      let statusClass = 'schedule-upcoming';
      let highlightStyle = '';

      if (item.isCompleted) {
        statusSymbol = '✓';
        statusClass = 'schedule-completed';
      } else if (isCurrent) {
        statusSymbol = '→';
        statusClass = 'schedule-current';
        highlightStyle = 'background-color: var(--bg-surface-elevated); border-left: 3px solid var(--accent-primary); padding-left: 10px; margin: 4px 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;';
      }

      return `
        <div class="prayer-row ${statusClass}" style="padding: 10px 0; ${highlightStyle}">
          <div class="prayer-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-family: var(--font-mono); font-size: var(--text-sm); color: ${item.isCompleted ? 'var(--status-success)' : (isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)')};">${statusSymbol}</span>
              <span style="font-size: var(--text-sm); font-weight: ${isCurrent ? '700' : '600'}; color: ${isCurrent ? 'var(--text-primary)' : (item.isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)')};">${item.name}</span>
            </div>
            <span class="prayer-time" style="margin-left: 20px;">${DateUtils.format12Hour(item.startTimeStr)} – ${DateUtils.format12Hour(item.endTimeStr)}</span>
          </div>
          <span class="badge ${item.isCompleted ? 'badge-completed' : (isCurrent ? 'badge-masjid' : 'badge-neutral')}" style="font-size: 10px;">
            ${item.isCompleted ? 'DONE' : (isCurrent ? 'ACTIVE' : `${item.duration}m`)}
          </span>
        </div>
      `;
    }).join('');
  }
};

if (typeof window !== 'undefined') {
  window.DashboardModule = DashboardModule;
}
