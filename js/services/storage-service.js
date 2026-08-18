/**
 * BATMAN — Local-First Storage Service (LocalStorage Engine)
 * Handles immediate synchronous persistence, day records, and offline sync queue.
 */

const StorageService = {
  KEYS: {
    SETTINGS: 'batman_settings',
    ROUTINES: 'batman_routines',
    DAY_LOGS: 'batman_day_logs',
    IELTS: 'batman_ielts_records',
    GOALS: 'batman_goals',
    WEEKLY_REVIEWS: 'batman_weekly_reviews',
    SYNC_QUEUE: 'batman_sync_queue'
  },

  /**
   * Initialize LocalStorage with sensible defaults if empty
   */
  init() {
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      const defaultSettings = {
        userName: 'Ahammed',
        userHeight: CONFIG.TARGETS.DEFAULT_HEIGHT_CM,
        targetWeight: CONFIG.TARGETS.DEFAULT_WEIGHT_TARGET,
        currentWeight: 62.0,
        prayerCity: 'Calicut,India',
        prayerMethod: 'Karachi',
        prayerAsrMethod: 'Shafii',
        activeSurahNumber: 67, // Al-Mulk default
        activeSurahName: 'Al-Mulk',
        activeSurahVerses: 30,
        activeSurahCompletedVerses: 0,
        gasWebAppUrl: '',
        notificationsEnabled: true
      };
      this.saveSettings(defaultSettings);
    }

    if (!localStorage.getItem(this.KEYS.ROUTINES)) {
      this.saveRoutines(CONFIG.DEFAULT_ROUTINES);
    }

    if (!localStorage.getItem(this.KEYS.GOALS)) {
      this.saveGoals(CONFIG.DEFAULT_GOALS);
    }

    if (!localStorage.getItem(this.KEYS.DAY_LOGS)) {
      localStorage.setItem(this.KEYS.DAY_LOGS, JSON.stringify({}));
    }

    if (!localStorage.getItem(this.KEYS.IELTS)) {
      localStorage.setItem(this.KEYS.IELTS, JSON.stringify([]));
    }

    if (!localStorage.getItem(this.KEYS.WEEKLY_REVIEWS)) {
      localStorage.setItem(this.KEYS.WEEKLY_REVIEWS, JSON.stringify({}));
    }

    if (!localStorage.getItem(this.KEYS.SYNC_QUEUE)) {
      localStorage.setItem(this.KEYS.SYNC_QUEUE, JSON.stringify([]));
    }
  },

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------
  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Error parsing settings:', e);
      return {};
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings, updatedAt: DateUtils.getNowISO() };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));
    this.enqueueSync('Settings', 'UPDATE', updated);
    return updated;
  },

  // -------------------------------------------------------------
  // ROUTINES
  // -------------------------------------------------------------
  getRoutines() {
    try {
      const data = localStorage.getItem(this.KEYS.ROUTINES);
      return data ? JSON.parse(data) : CONFIG.DEFAULT_ROUTINES;
    } catch (e) {
      return CONFIG.DEFAULT_ROUTINES;
    }
  },

  saveRoutines(routinesList) {
    localStorage.setItem(this.KEYS.ROUTINES, JSON.stringify(routinesList));
    this.enqueueSync('Routines', 'BATCH_UPDATE', { routines: routinesList });
  },

  // -------------------------------------------------------------
  // DAY LOGS (Single source of truth for date-based records)
  // -------------------------------------------------------------
  getDayLogs() {
    try {
      const data = localStorage.getItem(this.KEYS.DAY_LOGS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  getDayLog(dateStr = DateUtils.getTodayISO()) {
    const allLogs = this.getDayLogs();
    if (!allLogs[dateStr]) {
      // Default blank daily record
      allLogs[dateStr] = {
        date: dateStr,
        prayers: {
          fajr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          dhuhr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          asr: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          maghrib: { status: 'NOT_COMPLETED', location: '', timestamp: null },
          isha: { status: 'NOT_COMPLETED', location: '', timestamp: null }
        },
        tahajjud: 'MISSED', // COMPLETED | MISSED
        quranTafsir: 'NOT_COMPLETED', // COMPLETED | NOT_COMPLETED
        quranMemoCount: 0,
        quranRecitation: 'NOT_COMPLETED', // COMPLETED | NOT_COMPLETED
        islamicLearning: 'NOT_COMPLETED', // COMPLETED | NOT_COMPLETED
        adcdAttended: 'NOT_ATTENDED', // ATTENDED | NOT_ATTENDED
        cyberSeconds: 0,
        englishSeconds: 0,
        gymAttended: false,
        weightKg: null,
        bmi: null,
        sleepHours: null,
        review: null,
        updatedAt: DateUtils.getNowISO()
      };
      this.saveDayLog(dateStr, allLogs[dateStr], false);
    }
    return allLogs[dateStr];
  },

  saveDayLog(dateStr, dayData, enqueue = true) {
    const allLogs = this.getDayLogs();
    allLogs[dateStr] = { ...allLogs[dateStr], ...dayData, date: dateStr, updatedAt: DateUtils.getNowISO() };
    localStorage.setItem(this.KEYS.DAY_LOGS, JSON.stringify(allLogs));
    
    if (enqueue) {
      // Generate a stable record ID for idempotent sync
      const syncId = `day-${dateStr}`;
      this.enqueueSync('DayLogs', 'UPSERT', { id: syncId, ...allLogs[dateStr] });
    }
    return allLogs[dateStr];
  },

  // -------------------------------------------------------------
  // IELTS MOCK RECORDS
  // -------------------------------------------------------------
  getIELTSRecords() {
    try {
      const data = localStorage.getItem(this.KEYS.IELTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveIELTSRecord(mockData) {
    const records = this.getIELTSRecords();
    const recordWithId = {
      id: mockData.id || CalcUtils.generateId('ielts'),
      date: mockData.date || DateUtils.getTodayISO(),
      listening: mockData.listening,
      reading: mockData.reading,
      writing: mockData.writing,
      speaking: mockData.speaking,
      overall: mockData.overall,
      timestamp: DateUtils.getNowISO()
    };
    records.unshift(recordWithId);
    localStorage.setItem(this.KEYS.IELTS, JSON.stringify(records));
    this.enqueueSync('IELTS', 'INSERT', recordWithId);
    return recordWithId;
  },

  // -------------------------------------------------------------
  // GOALS
  // -------------------------------------------------------------
  getGoals() {
    try {
      const data = localStorage.getItem(this.KEYS.GOALS);
      return data ? JSON.parse(data) : CONFIG.DEFAULT_GOALS;
    } catch (e) {
      return CONFIG.DEFAULT_GOALS;
    }
  },

  saveGoals(goalsList) {
    localStorage.setItem(this.KEYS.GOALS, JSON.stringify(goalsList));
    this.enqueueSync('Goals', 'BATCH_UPDATE', { goals: goalsList });
  },

  // -------------------------------------------------------------
  // WEEKLY REVIEWS
  // -------------------------------------------------------------
  getWeeklyReviews() {
    try {
      const data = localStorage.getItem(this.KEYS.WEEKLY_REVIEWS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  saveWeeklyReview(weekStartDate, reviewData) {
    const reviews = this.getWeeklyReviews();
    const reviewWithId = {
      id: `weekly-${weekStartDate}`,
      weekStartDate,
      ...reviewData,
      timestamp: DateUtils.getNowISO()
    };
    reviews[weekStartDate] = reviewWithId;
    localStorage.setItem(this.KEYS.WEEKLY_REVIEWS, JSON.stringify(reviews));
    this.enqueueSync('WeeklyReviews', 'UPSERT', reviewWithId);
    return reviewWithId;
  },

  // -------------------------------------------------------------
  // IDEMPOTENT SYNC QUEUE
  // -------------------------------------------------------------
  getSyncQueue() {
    try {
      const data = localStorage.getItem(this.KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  enqueueSync(table, action, data) {
    const queue = this.getSyncQueue();
    const itemId = data.id || CalcUtils.generateId('sync');
    
    // Check if an item with this ID or table/date key already exists in queue to deduplicate
    const existingIndex = queue.findIndex(q => q.id === itemId || (q.table === table && q.data.date && q.data.date === data.date));
    
    const queueItem = {
      id: itemId,
      table,
      action,
      data: { ...data, id: itemId },
      timestamp: DateUtils.getNowISO()
    };

    if (existingIndex >= 0) {
      // Replace with newer state
      queue[existingIndex] = queueItem;
    } else {
      queue.push(queueItem);
    }

    localStorage.setItem(this.KEYS.SYNC_QUEUE, JSON.stringify(queue));
    this.updateSyncUI();
  },

  removeSyncItem(itemId) {
    let queue = this.getSyncQueue();
    queue = queue.filter(item => item.id !== itemId);
    localStorage.setItem(this.KEYS.SYNC_QUEUE, JSON.stringify(queue));
    this.updateSyncUI();
  },

  clearSyncQueue() {
    localStorage.setItem(this.KEYS.SYNC_QUEUE, JSON.stringify([]));
    this.updateSyncUI();
  },

  updateSyncUI() {
    const queue = this.getSyncQueue();
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-status');
    if (!syncText || !syncIndicator) return;

    if (queue.length > 0) {
      syncText.textContent = `${queue.length} Unsynced`;
      syncIndicator.className = 'sync-indicator has-unsynced';
    } else {
      syncText.textContent = 'Synced';
      syncIndicator.className = 'sync-indicator';
    }
  },

  // -------------------------------------------------------------
  // BACKUP & RESTORE
  // -------------------------------------------------------------
  exportAllData() {
    return {
      version: CONFIG.VERSION,
      exportedAt: DateUtils.getNowISO(),
      settings: this.getSettings(),
      routines: this.getRoutines(),
      dayLogs: this.getDayLogs(),
      ielts: this.getIELTSRecords(),
      goals: this.getGoals(),
      weeklyReviews: this.getWeeklyReviews()
    };
  },

  importData(backupJSON) {
    try {
      const data = typeof backupJSON === 'string' ? JSON.parse(backupJSON) : backupJSON;
      if (data.settings) localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(data.settings));
      if (data.routines) localStorage.setItem(this.KEYS.ROUTINES, JSON.stringify(data.routines));
      if (data.dayLogs) localStorage.setItem(this.KEYS.DAY_LOGS, JSON.stringify(data.dayLogs));
      if (data.ielts) localStorage.setItem(this.KEYS.IELTS, JSON.stringify(data.ielts));
      if (data.goals) localStorage.setItem(this.KEYS.GOALS, JSON.stringify(data.goals));
      if (data.weeklyReviews) localStorage.setItem(this.KEYS.WEEKLY_REVIEWS, JSON.stringify(data.weeklyReviews));
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  },

  clearAllData() {
    localStorage.removeItem(this.KEYS.SETTINGS);
    localStorage.removeItem(this.KEYS.ROUTINES);
    localStorage.removeItem(this.KEYS.DAY_LOGS);
    localStorage.removeItem(this.KEYS.IELTS);
    localStorage.removeItem(this.KEYS.GOALS);
    localStorage.removeItem(this.KEYS.WEEKLY_REVIEWS);
    localStorage.removeItem(this.KEYS.SYNC_QUEUE);
  }
};

if (typeof window !== 'undefined') {
  window.StorageService = StorageService;
}
