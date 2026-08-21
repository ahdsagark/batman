/**
 * BATMAN — Deen Module (5 Daily Prayers, Tahajjud, Sunnah Rak'at, Duha/Witr, Adhkar)
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

    window.addEventListener('batman:data-updated', () => {
      this.renderDeen();
    });
  },

  bindEvents() {
    // Tahajjud cycling
    const tahajjudBtn = document.getElementById('tahajjud-toggle-btn');
    if (tahajjudBtn) {
      tahajjudBtn.addEventListener('click', () => this.cycleTahajjud());
    }

    // Duha cycling
    const duhaBtn = document.getElementById('duha-toggle-btn');
    if (duhaBtn) {
      duhaBtn.addEventListener('click', () => this.cycleDuha());
    }

    // Witr cycling
    const witrBtn = document.getElementById('witr-toggle-btn');
    if (witrBtn) {
      witrBtn.addEventListener('click', () => this.cycleWitr());
    }

    // Morning Adhkar toggle
    const morningAdhkarBtn = document.getElementById('adhkar-morning-btn');
    if (morningAdhkarBtn) {
      morningAdhkarBtn.addEventListener('click', () => this.toggleAdhkar('morningAdhkar'));
    }

    // Evening Adhkar toggle
    const eveningAdhkarBtn = document.getElementById('adhkar-evening-btn');
    if (eveningAdhkarBtn) {
      eveningAdhkarBtn.addEventListener('click', () => this.toggleAdhkar('eveningAdhkar'));
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

    // 1. Prayer Times calculation for today
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

    // 2. Render 5 Daily Prayers (Cycling: NOT_RECORDED -> MASJID -> HOME -> QADA -> MISSED -> NOT_RECORDED)
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
        const record = currentPrayers[p.key] || { status: 'NOT_RECORDED' };
        const rawStatus = record.status || 'NOT_RECORDED';

        let statusBtnText = 'NOT RECORDED';
        let statusBtnClass = 'btn-secondary';

        if (rawStatus === 'MASJID' || (rawStatus === 'COMPLETED' && record.location === 'MASJID')) {
          statusBtnText = 'MASJID ✓';
          statusBtnClass = 'btn-success';
        } else if (rawStatus === 'HOME' || (rawStatus === 'COMPLETED' && record.location === 'HOME')) {
          statusBtnText = 'HOME ✓';
          statusBtnClass = 'btn-primary';
        } else if (rawStatus === 'QADA') {
          statusBtnText = 'QADA';
          statusBtnClass = 'btn-warning';
        } else if (rawStatus === 'MISSED') {
          statusBtnText = 'MISSED';
          statusBtnClass = 'btn-danger';
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

    // 3. Render 12 Daily Sunnah Rak'at
    this.renderSunnahRakat(log);

    // 4. Render Tahajjud, Duha & Witr
    this.renderTahajjud(log);
    this.renderDuhaWitr(log);

    // 5. Render Adhkar
    this.renderAdhkar(log);

    // 6. Render Islamic Learning
    const islamicBtn = document.getElementById('islamic-learning-toggle-btn');
    if (islamicBtn) {
      const isDone = log.islamicLearning === 'COMPLETED';
      islamicBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT DONE';
      islamicBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }
  },

  /**
   * Cycle 5 daily prayer states on 1-tap:
   * NOT_RECORDED -> MASJID -> HOME -> QADA -> MISSED -> NOT_RECORDED
   */
  cyclePrayer(prayerKey) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const currentRecord = (log.prayers && log.prayers[prayerKey]) || { status: 'NOT_RECORDED' };
    const currentStatus = currentRecord.status || 'NOT_RECORDED';

    let nextStatus = 'MASJID';
    if (currentStatus === 'NOT_RECORDED') {
      nextStatus = 'MASJID';
    } else if (currentStatus === 'MASJID' || (currentStatus === 'COMPLETED' && currentRecord.location === 'MASJID')) {
      nextStatus = 'HOME';
    } else if (currentStatus === 'HOME' || (currentStatus === 'COMPLETED' && currentRecord.location === 'HOME')) {
      nextStatus = 'QADA';
    } else if (currentStatus === 'QADA') {
      nextStatus = 'MISSED';
    } else if (currentStatus === 'MISSED') {
      nextStatus = 'NOT_RECORDED';
    }

    const updatedPrayers = {
      ...(log.prayers || {}),
      [prayerKey]: {
        status: nextStatus,
        timestamp: (nextStatus === 'MASJID' || nextStatus === 'HOME' || nextStatus === 'QADA') ? DateUtils.getNowISO() : null
      }
    };

    StorageService.saveDayLog(todayISO, { prayers: updatedPrayers });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  /**
   * Tahajjud cycling: NOT_RECORDED -> PRAYED -> MISSED -> NOT_RECORDED
   */
  cycleTahajjud() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const cur = log.tahajjud || 'NOT_RECORDED';

    let next = 'PRAYED';
    if (cur === 'NOT_RECORDED') next = 'PRAYED';
    else if (cur === 'PRAYED' || cur === 'COMPLETED') next = 'MISSED';
    else if (cur === 'MISSED') next = 'NOT_RECORDED';

    StorageService.saveDayLog(todayISO, { tahajjud: next });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  renderTahajjud(log) {
    const tahajjudBtn = document.getElementById('tahajjud-toggle-btn');
    const tahajjudStreakLabel = document.getElementById('tahajjud-streak-label');
    const cur = log.tahajjud || 'NOT_RECORDED';

    if (tahajjudBtn) {
      if (cur === 'PRAYED' || cur === 'COMPLETED') {
        tahajjudBtn.textContent = 'PRAYED ✓';
        tahajjudBtn.className = 'btn btn-success btn-sm';
      } else if (cur === 'MISSED') {
        tahajjudBtn.textContent = 'MISSED';
        tahajjudBtn.className = 'btn btn-danger btn-sm';
      } else {
        tahajjudBtn.textContent = 'NOT RECORDED';
        tahajjudBtn.className = 'btn btn-secondary btn-sm';
      }
    }

    // Calculate Tahajjud streak (strictly counts PRAYED)
    const pastDays = DateUtils.getPastDaysISO(60);
    const allLogs = StorageService.getDayLogs();
    const streak = CalcUtils.calculateStreak(pastDays, (dateStr) => {
      const day = allLogs[dateStr];
      return day && (day.tahajjud === 'PRAYED' || day.tahajjud === 'COMPLETED');
    });
    if (tahajjudStreakLabel) {
      tahajjudStreakLabel.textContent = `Current Streak: ${streak} day${streak === 1 ? '' : 's'}`;
    }
  },

  /**
   * Duha cycling: NOT_RECORDED -> PRAYED -> MISSED -> NOT_RECORDED
   */
  cycleDuha() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const cur = log.duha || 'NOT_RECORDED';

    let next = 'PRAYED';
    if (cur === 'NOT_RECORDED') next = 'PRAYED';
    else if (cur === 'PRAYED') next = 'MISSED';
    else if (cur === 'MISSED') next = 'NOT_RECORDED';

    StorageService.saveDayLog(todayISO, { duha: next });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  /**
   * Witr cycling: NOT_RECORDED -> PRAYED -> MISSED -> NOT_RECORDED
   */
  cycleWitr() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const cur = log.witr || 'NOT_RECORDED';

    let next = 'PRAYED';
    if (cur === 'NOT_RECORDED') next = 'PRAYED';
    else if (cur === 'PRAYED') next = 'MISSED';
    else if (cur === 'MISSED') next = 'NOT_RECORDED';

    StorageService.saveDayLog(todayISO, { witr: next });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  renderDuhaWitr(log) {
    const duhaBtn = document.getElementById('duha-toggle-btn');
    if (duhaBtn) {
      const cur = log.duha || 'NOT_RECORDED';
      if (cur === 'PRAYED') {
        duhaBtn.textContent = 'PRAYED ✓';
        duhaBtn.className = 'btn btn-success btn-sm';
      } else if (cur === 'MISSED') {
        duhaBtn.textContent = 'MISSED';
        duhaBtn.className = 'btn btn-danger btn-sm';
      } else {
        duhaBtn.textContent = 'NOT RECORDED';
        duhaBtn.className = 'btn btn-secondary btn-sm';
      }
    }

    const witrBtn = document.getElementById('witr-toggle-btn');
    if (witrBtn) {
      const cur = log.witr || 'NOT_RECORDED';
      if (cur === 'PRAYED') {
        witrBtn.textContent = 'PRAYED ✓';
        witrBtn.className = 'btn btn-success btn-sm';
      } else if (cur === 'MISSED') {
        witrBtn.textContent = 'MISSED';
        witrBtn.className = 'btn btn-danger btn-sm';
      } else {
        witrBtn.textContent = 'NOT RECORDED';
        witrBtn.className = 'btn btn-secondary btn-sm';
      }
    }
  },

  /**
   * Adhkar toggling (Morning / Evening / Sleep): NOT_RECORDED <-> COMPLETED
   */
  toggleAdhkar(adhkarKey) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const cur = log[adhkarKey] || 'NOT_RECORDED';
    const next = cur === 'COMPLETED' ? 'NOT_RECORDED' : 'COMPLETED';

    StorageService.saveDayLog(todayISO, { [adhkarKey]: next });
    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  },

  renderAdhkar(log) {
    const morningBtn = document.getElementById('adhkar-morning-btn');
    if (morningBtn) {
      const isDone = log.morningAdhkar === 'COMPLETED';
      morningBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT RECORDED';
      morningBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }

    const eveningBtn = document.getElementById('adhkar-evening-btn');
    if (eveningBtn) {
      const isDone = log.eveningAdhkar === 'COMPLETED';
      eveningBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT RECORDED';
      eveningBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }
  },

  /**
   * Render 12 Daily Sunnah Rak'at interactive checklist
   */
  renderSunnahRakat(log) {
    const sunnah = log.sunnahRakat || {};
    const totalRakat = CalcUtils.calculateSunnahTotal(sunnah);

    const badgeEl = document.getElementById('sunnah-total-badge');
    if (badgeEl) {
      badgeEl.textContent = `${totalRakat} / 12 Rak'at`;
      badgeEl.className = totalRakat >= 12 ? 'badge badge-masjid' : (totalRakat > 0 ? 'badge badge-home' : 'badge badge-neutral');
    }

    const container = document.getElementById('sunnah-rakat-list');
    if (!container) return;

    const items = [
      { key: 'beforeFajr', label: '2 Before Fajr', rakat: 2, checked: Boolean(sunnah.beforeFajr) },
      { key: 'beforeDhuhr', label: '4 Before Dhuhr', rakat: 4, checked: Boolean(sunnah.beforeDhuhr) },
      { key: 'afterDhuhr', label: '2 After Dhuhr', rakat: 2, checked: Boolean(sunnah.afterDhuhr) },
      { key: 'afterMaghrib', label: '2 After Maghrib', rakat: 2, checked: Boolean(sunnah.afterMaghrib) },
      { key: 'afterIsha', label: '2 After Isha', rakat: 2, checked: Boolean(sunnah.afterIsha) }
    ];

    container.innerHTML = items.map(item => `
      <div class="prayer-row" style="padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
        <div class="prayer-info" style="flex: 1;">
          <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${item.label}</span>
          <span class="prayer-time">${item.rakat} Rak'at Sunnah Mu'akkadah</span>
        </div>
        <div>
          <button class="btn ${item.checked ? 'btn-success' : 'btn-outline'} btn-sm" style="min-height: 36px; min-width: 90px; font-size: 11px; font-weight: 700;" onclick="DeenModule.toggleSunnah('${item.key}')">
            ${item.checked ? 'DONE ✓' : 'NOT DONE'}
          </button>
        </div>
      </div>
    `).join('');
  },

  toggleSunnah(key) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const sunnah = { ...(log.sunnahRakat || {}) };

    sunnah[key] = !sunnah[key];
    StorageService.saveDayLog(todayISO, { sunnahRakat: sunnah });
    StorageService.syncSunnahRakat(todayISO, sunnah);

    UI.vibrate(10);
    this.renderDeen();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.DeenModule = DeenModule;
}
