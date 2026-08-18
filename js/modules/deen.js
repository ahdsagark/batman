/**
 * BATMAN — Deen Module (5 Daily Prayers, Tahajjud, Islamic Learning)
 */

const DeenModule = {
  init() {
    this.renderDeen();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'deen') this.renderDeen();
    });

    window.addEventListener('batman:settings-updated', () => {
      this.renderDeen();
    });
  },

  bindEvents() {
    // Tahajjud toggle
    const tahajjudBtn = document.getElementById('tahajjud-toggle-btn');
    if (tahajjudBtn) {
      tahajjudBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextStatus = log.tahajjud === 'COMPLETED' ? 'MISSED' : 'COMPLETED';
        StorageService.saveDayLog(todayISO, { tahajjud: nextStatus });
        UI.vibrate(10);
        this.renderDeen();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }

    // Islamic Learning toggle
    const islamicBtn = document.getElementById('islamic-learning-toggle-btn');
    if (islamicBtn) {
      islamicBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextStatus = log.islamicLearning === 'COMPLETED' ? 'NOT_COMPLETED' : 'COMPLETED';
        StorageService.saveDayLog(todayISO, { islamicLearning: nextStatus });
        UI.vibrate(10);
        this.renderDeen();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }
  },

  renderDeen() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();

    // 1. Prayer Times calculation for today & clear location/method separation
    const prayerTimes = PrayerService.getPrayerTimes(new Date());
    const locEl = document.getElementById('deen-location-name');
    const methodEl = document.getElementById('deen-calc-method');
    
    if (locEl) {
      locEl.textContent = settings.prayerCity === 'Calicut,India' ? 'Calicut (Kozhikode), India' : prayerTimes.cityName;
    }
    if (methodEl) {
      const cleanMethod = (settings.prayerMethod || 'Karachi').split('(')[0].trim();
      methodEl.textContent = `Calculation: ${cleanMethod}`;
    }

    // 2. Render 5 Prayers list directly
    const container = document.getElementById('prayers-list-container');
    if (container) {
      const prayers = [
        { key: 'fajr', label: 'Fajr', time: prayerTimes.fajr },
        { key: 'dhuhr', label: 'Dhuhr', time: prayerTimes.dhuhr },
        { key: 'asr', label: 'Asr', time: prayerTimes.asr },
        { key: 'maghrib', label: 'Maghrib', time: prayerTimes.maghrib },
        { key: 'isha', label: 'Isha', time: prayerTimes.isha }
      ];

      const currentPrayers = log.prayers || {};

      container.innerHTML = prayers.map(p => {
        const record = currentPrayers[p.key] || { status: 'NOT_COMPLETED', location: '' };
        const isCompleted = record.status === 'COMPLETED';
        const loc = record.location || '';

        let statusBtnText = 'NOT RECORDED';
        let statusBtnClass = 'btn-secondary';

        if (isCompleted && loc === 'MASJID') {
          statusBtnText = 'MASJID ✓';
          statusBtnClass = 'btn-success';
        } else if (isCompleted && loc === 'HOME') {
          statusBtnText = 'HOME ✓';
          statusBtnClass = 'btn-primary';
        }

        return `
          <div class="prayer-row" style="padding: 12px 0;">
            <div class="prayer-info">
              <span class="prayer-name" style="font-size: var(--text-base); font-weight: 700;">${p.label}</span>
              <span class="prayer-time" style="font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary);">${DateUtils.format12Hour(p.time)}</span>
            </div>
            <div class="prayer-actions" style="display: flex; gap: 6px;">
              <button class="btn ${statusBtnClass} btn-sm" style="min-height: 44px; min-width: 130px; font-size: var(--text-xs); font-weight: 700;" onclick="DeenModule.cyclePrayer('${p.key}')">
                ${statusBtnText}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Render Tahajjud & Streak
    const tahajjudBtn = document.getElementById('tahajjud-toggle-btn');
    const tahajjudStreakLabel = document.getElementById('tahajjud-streak-label');
    if (tahajjudBtn) {
      const isCompleted = log.tahajjud === 'COMPLETED';
      tahajjudBtn.textContent = isCompleted ? 'COMPLETED ✓' : 'MISSED';
      tahajjudBtn.className = isCompleted ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }

    // Calculate Tahajjud streak
    const pastDays = DateUtils.getPastDaysISO(30);
    const allLogs = StorageService.getDayLogs();
    const streak = CalcUtils.calculateStreak(pastDays, (dateStr) => {
      return allLogs[dateStr] && allLogs[dateStr].tahajjud === 'COMPLETED';
    });
    if (tahajjudStreakLabel) {
      tahajjudStreakLabel.textContent = `Current Streak: ${streak} day${streak === 1 ? '' : 's'}`;
    }

    // 4. Render Islamic Learning
    const islamicBtn = document.getElementById('islamic-learning-toggle-btn');
    if (islamicBtn) {
      const isDone = log.islamicLearning === 'COMPLETED';
      islamicBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT DONE';
      islamicBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }
  },

  /**
   * Cycle prayer states on 1-tap: NOT_COMPLETED -> MASJID -> HOME -> NOT_COMPLETED
   */
  cyclePrayer(prayerKey) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const current = (log.prayers && log.prayers[prayerKey]) || { status: 'NOT_COMPLETED', location: '' };

    let nextStatus = 'COMPLETED';
    let nextLocation = 'MASJID';

    if (current.status === 'COMPLETED' && current.location === 'MASJID') {
      nextLocation = 'HOME';
    } else if (current.status === 'COMPLETED' && current.location === 'HOME') {
      nextStatus = 'NOT_COMPLETED';
      nextLocation = '';
    }

    const updatedPrayers = {
      ...(log.prayers || {}),
      [prayerKey]: {
        status: nextStatus,
        location: nextLocation,
        timestamp: nextStatus === 'COMPLETED' ? DateUtils.getNowISO() : null
      }
    };

    StorageService.saveDayLog(todayISO, { prayers: updatedPrayers });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.DeenModule = DeenModule;
}
