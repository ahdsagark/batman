/**
 * BATMAN — Local-First Storage Service (LocalStorage Engine)
 * Handles immediate synchronous persistence, day records, active timers, and offline sync queue.
 */

const StorageService = {
  KEYS: {
    SETTINGS: 'batman_settings',
    ROUTINES: 'batman_routines',
    DAY_LOGS: 'batman_day_logs',
    IELTS: 'batman_ielts_records',
    GOALS: 'batman_goals',
    WEEKLY_REVIEWS: 'batman_weekly_reviews',
    SYNC_QUEUE: 'batman_sync_queue',
    ACTIVE_TIMER: 'batman_active_timer'
  },

  /**
   * Centralized safe LocalStorage write wrapper with quota exception protection
   */
  safeSetItem(key, value) {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, payload);
      return true;
    } catch (err) {
      console.error(`[StorageService] Failed to write to LocalStorage key "${key}":`, err);
      if (typeof UI !== 'undefined' && UI.showToast) {
        UI.showToast('Storage write error. Storage quota may be full.', 'error', 4000);
      }
      return false;
    }
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
        surahProgress: { 67: 0 },
        gasWebAppUrl: '',
        gasApiToken: 'batman-secret-2026',
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
      this.safeSetItem(this.KEYS.DAY_LOGS, {});
    }

    if (!localStorage.getItem(this.KEYS.IELTS)) {
      this.safeSetItem(this.KEYS.IELTS, []);
    }

    if (!localStorage.getItem(this.KEYS.WEEKLY_REVIEWS)) {
      this.safeSetItem(this.KEYS.WEEKLY_REVIEWS, {});
    }

    if (!localStorage.getItem(this.KEYS.SYNC_QUEUE)) {
      this.safeSetItem(this.KEYS.SYNC_QUEUE, []);
    }
  },

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------
  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      const parsed = data ? JSON.parse(data) : {};
      if (!parsed.surahProgress) {
        parsed.surahProgress = {};
        if (parsed.activeSurahNumber) {
          parsed.surahProgress[parsed.activeSurahNumber] = parsed.activeSurahCompletedVerses || 0;
        }
      }
      return parsed;
    } catch (e) {
      console.error('Error parsing settings:', e);
      return { surahProgress: {} };
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings, updatedAt: DateUtils.getNowISO() };
    this.safeSetItem(this.KEYS.SETTINGS, updated);
    this.enqueueSync('Settings', 'UPDATE', { id: 'user_settings', ...updated });
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
    this.safeSetItem(this.KEYS.ROUTINES, routinesList);
    // Enqueue each routine with stable ID for cloud synchronization
    routinesList.forEach(r => {
      this.enqueueSync('Routines', 'UPSERT', { id: r.id, ...r });
    });
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
        tahajjud: 'MISSED',
        quranTafsir: 'NOT_COMPLETED',
        quranMemoCount: 0,
        quranRecitation: 'NOT_COMPLETED',
        islamicLearning: 'NOT_COMPLETED',
        adcdAttended: 'NOT_ATTENDED',
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
    this.safeSetItem(this.KEYS.DAY_LOGS, allLogs);
    
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
    this.safeSetItem(this.KEYS.IELTS, records);
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
    this.safeSetItem(this.KEYS.GOALS, goalsList);
    goalsList.forEach(g => {
      this.enqueueSync('Goals', 'UPSERT', { id: g.id, ...g });
    });
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
    this.safeSetItem(this.KEYS.WEEKLY_REVIEWS, reviews);
    this.enqueueSync('WeeklyReviews', 'UPSERT', reviewWithId);
    return reviewWithId;
  },

  // -------------------------------------------------------------
  // ACTIVE TIMER PERSISTENCE (Survives App Reboots / Process Kills)
  // -------------------------------------------------------------
  getActiveTimer() {
    try {
      const data = localStorage.getItem(this.KEYS.ACTIVE_TIMER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveActiveTimer(timerState) {
    this.safeSetItem(this.KEYS.ACTIVE_TIMER, timerState);
  },

  clearActiveTimer() {
    localStorage.removeItem(this.KEYS.ACTIVE_TIMER);
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
    const itemId = data.id || (table === 'Settings' ? 'user_settings' : CalcUtils.generateId('sync'));
    
    // Check if an item with this ID or table/date key already exists in queue to deduplicate/coalesce
    const existingIndex = queue.findIndex(q => 
      q && (
        q.id === itemId || 
        (q.table === table && q.id === itemId) ||
        (q.table === table && q.data && q.data.date && data && data.date && q.data.date === data.date)
      )
    );
    
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

    this.safeSetItem(this.KEYS.SYNC_QUEUE, queue);
    this.updateSyncUI();
  },

  removeSyncItem(itemId) {
    let queue = this.getSyncQueue();
    queue = queue.filter(item => item.id !== itemId);
    this.safeSetItem(this.KEYS.SYNC_QUEUE, queue);
    this.updateSyncUI();
  },

  /**
   * Atomically remove ONLY items that were in the synced snapshot AND have not been modified since
   * @param {Array<{id: string, timestamp: string}>} syncedSnapshotItems
   */
  removeSyncedItems(syncedSnapshotItems) {
    if (!Array.isArray(syncedSnapshotItems) || syncedSnapshotItems.length === 0) return;
    
    const currentQueue = this.getSyncQueue();
    
    // Filter out only items that were in the synced snapshot and whose current timestamp <= snapshot timestamp
    const remainingQueue = currentQueue.filter(currentItem => {
      const snapshotMatch = syncedSnapshotItems.find(s => s.id === currentItem.id);
      if (!snapshotMatch) {
        // Item was added while sync was in-flight; keep it!
        return true;
      }
      // If the current item has a newer timestamp than what was sent in the batch, KEEP IT!
      if (currentItem.timestamp && snapshotMatch.timestamp && currentItem.timestamp > snapshotMatch.timestamp) {
        return true;
      }
      // Successfully synced and unmodified during sync; remove it.
      return false;
    });

    this.safeSetItem(this.KEYS.SYNC_QUEUE, remainingQueue);
    this.updateSyncUI();
  },

  clearSyncQueue() {
    this.safeSetItem(this.KEYS.SYNC_QUEUE, []);
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
      if (data.settings) this.safeSetItem(this.KEYS.SETTINGS, data.settings);
      if (data.routines) this.safeSetItem(this.KEYS.ROUTINES, data.routines);
      if (data.dayLogs) this.safeSetItem(this.KEYS.DAY_LOGS, data.dayLogs);
      if (data.ielts) this.safeSetItem(this.KEYS.IELTS, data.ielts);
      if (data.goals) this.safeSetItem(this.KEYS.GOALS, data.goals);
      if (data.weeklyReviews) this.safeSetItem(this.KEYS.WEEKLY_REVIEWS, data.weeklyReviews);
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
    localStorage.removeItem(this.KEYS.ACTIVE_TIMER);
  }
};

if (typeof window !== 'undefined') {
  window.StorageService = StorageService;
}
