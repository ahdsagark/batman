/**
 * BATMAN — Local-First Storage Service (LocalStorage Engine)
 * Handles immediate synchronous persistence, day records, active timers, and offline sync queue.
 */

const StorageService = {
  SCHEMA_VERSION: 2,

  KEYS: {
    SETTINGS: 'batman_settings',
    ROUTINES: 'batman_routines',
    DAY_LOGS: 'batman_day_logs',
    WEIGHT_HISTORY: 'batman_weight_history',
    POMODORO: 'batman_pomodoro_sessions',
    MONTHLY_GOALS: 'batman_monthly_goals',
    COMMITMENTS: 'batman_commitments',
    IELTS: 'batman_ielts_records',
    GOALS: 'batman_goals',
    WEEKLY_REVIEWS: 'batman_weekly_reviews',
    SYNC_QUEUE: 'batman_sync_queue',
    ACTIVE_TIMER: 'batman_active_timer',
    DATA_VERSION: 'batman_data_version'
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
   * Initialize LocalStorage with sensible defaults if empty and run versioned migration
   */
  init() {
    if (!localStorage.getItem(this.KEYS.SETTINGS)) {
      const defaultSettings = {
        userName: 'Ahammed',
        userHeight: CONFIG.TARGETS.DEFAULT_HEIGHT_CM,
        targetWeight: CONFIG.TARGETS.DEFAULT_WEIGHT_TARGET,
        currentWeight: 62.0,
        prayerCity: 'Malappuram,India',
        prayerMethod: 'Karachi',
        prayerAsrMethod: 'Shafii',
        activeSurahNumber: 67, // Al-Mulk default
        activeSurahName: 'Al-Mulk',
        activeSurahVerses: 30,
        activeSurahCompletedVerses: 0,
        surahProgress: { 67: 0 },
        gasWebAppUrl: '',
        gasApiToken: 'batman-secret-2026',
        notificationsEnabled: true,
        theme: 'dark',
        pomodoroRetrievalMinutes: 3
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

    if (!localStorage.getItem(this.KEYS.WEIGHT_HISTORY)) {
      this.safeSetItem(this.KEYS.WEIGHT_HISTORY, []);
    }

    if (!localStorage.getItem(this.KEYS.POMODORO)) {
      this.safeSetItem(this.KEYS.POMODORO, []);
    }

    if (!localStorage.getItem(this.KEYS.MONTHLY_GOALS)) {
      this.safeSetItem(this.KEYS.MONTHLY_GOALS, {});
    }

    if (!localStorage.getItem(this.KEYS.COMMITMENTS)) {
      this.safeSetItem(this.KEYS.COMMITMENTS, []);
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

    // Run safe, idempotent migration
    this.runMigration();
  },

  /**
   * Idempotent Data Migration Engine (Runs only when schema version increases)
   */
  runMigration() {
    const rawVersion = localStorage.getItem(this.KEYS.DATA_VERSION);
    const currentVersion = rawVersion ? parseInt(rawVersion, 10) : 1;

    if (currentVersion < this.SCHEMA_VERSION) {
      console.log(`[StorageService] Migrating data schema from v${currentVersion} to v${this.SCHEMA_VERSION}...`);
      const allLogs = this.getDayLogs();
      const weightHistory = this.getWeightHistory();
      let logsModified = false;
      let weightsModified = false;

      Object.keys(allLogs).forEach(dateStr => {
        const log = allLogs[dateStr];
        if (!log) return;

        // 1. Migrate 5 Prayers
        if (log.prayers) {
          ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
            const pObj = log.prayers[p];
            if (pObj && typeof pObj === 'object') {
              if (pObj.status === 'COMPLETED') {
                if (pObj.location === 'MASJID') pObj.status = 'MASJID';
                else if (pObj.location === 'HOME') pObj.status = 'HOME';
                else pObj.status = 'MASJID';
              } else if (pObj.status === 'NOT_COMPLETED' || !pObj.status) {
                pObj.status = 'NOT_RECORDED';
              }
            }
          });
        }

        // 2. Migrate Tahajjud
        if (log.tahajjud === 'COMPLETED') {
          log.tahajjud = 'PRAYED';
        } else if (log.tahajjud === 'NOT_COMPLETED' || !log.tahajjud) {
          log.tahajjud = 'NOT_RECORDED';
        }

        // 3. Migrate Gym Status
        if (log.gymStatus === undefined) {
          if (log.gymAttended === true) {
            log.gymStatus = 'DONE';
          } else {
            log.gymStatus = 'NOT_RECORDED';
          }
        }

        // 4. Default new Deen fields if missing
        if (log.duha === undefined) log.duha = 'NOT_RECORDED';
        if (log.witr === undefined) log.witr = 'NOT_RECORDED';
        if (log.morningAdhkar === undefined) log.morningAdhkar = 'NOT_RECORDED';
        if (log.eveningAdhkar === undefined) log.eveningAdhkar = 'NOT_RECORDED';
        if (log.sleepAdhkar === undefined) log.sleepAdhkar = 'NOT_RECORDED';
        if (!log.sunnahRakat || typeof log.sunnahRakat !== 'object') {
          log.sunnahRakat = {
            beforeFajr: false,
            beforeDhuhr: false,
            afterDhuhr: false,
            afterMaghrib: false,
            afterIsha: false
          };
        }

        // 5. Populate initial WeightHistory from historical logs if missing
        if (log.weightKg && !weightHistory.some(w => w.date === dateStr)) {
          weightHistory.push({
            id: `weight-${dateStr}`,
            date: dateStr,
            weightKg: parseFloat(log.weightKg),
            bmi: log.bmi || null,
            timestamp: log.updatedAt || `${dateStr}T08:00:00.000Z`
          });
          weightsModified = true;
        }

        logsModified = true;
      });

      if (logsModified) {
        this.safeSetItem(this.KEYS.DAY_LOGS, allLogs);
      }
      if (weightsModified) {
        weightHistory.sort((a, b) => (a.date > b.date ? 1 : -1));
        this.safeSetItem(this.KEYS.WEIGHT_HISTORY, weightHistory);
      }

      localStorage.setItem(this.KEYS.DATA_VERSION, this.SCHEMA_VERSION.toString());
      console.log(`[StorageService] Migration to v${this.SCHEMA_VERSION} completed successfully.`);
    }
  },

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------
  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      const parsed = data ? JSON.parse(data) : {};
      if (!parsed.surahProgress || typeof parsed.surahProgress !== 'object') {
        parsed.surahProgress = {};
      }

      // Clean up surahProgress: only keep valid surah numbers 1-114 with positive verse count
      const cleanProgress = {};
      Object.keys(parsed.surahProgress).forEach(key => {
        const sNum = parseInt(key, 10);
        const val = parseInt(parsed.surahProgress[key], 10) || 0;
        if (!isNaN(sNum) && sNum >= 1 && sNum <= 114 && val > 0) {
          cleanProgress[sNum] = val;
        }
      });
      parsed.surahProgress = cleanProgress;

      return parsed;
    } catch (e) {
      console.error('Error parsing settings:', e);
      return { surahProgress: {} };
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const cleanProgress = {};
    const candidateProgress = settings.surahProgress !== undefined ? settings.surahProgress : current.surahProgress;

    if (candidateProgress && typeof candidateProgress === 'object') {
      Object.keys(candidateProgress).forEach(key => {
        const sNum = parseInt(key, 10);
        const val = parseInt(candidateProgress[key], 10) || 0;
        if (!isNaN(sNum) && sNum >= 1 && sNum <= 114 && val > 0) {
          cleanProgress[sNum] = val;
        }
      });
    }

    const updated = { 
      ...current, 
      ...settings, 
      surahProgress: cleanProgress,
      updatedAt: DateUtils.getNowISO() 
    };

    this.safeSetItem(this.KEYS.SETTINGS, updated);
    this.enqueueSync('Settings', 'UPDATE', { id: 'user_settings', ...updated });
    return updated;
  },

  resetQuranProgress() {
    const current = this.getSettings();
    current.activeSurahNumber = 67;
    current.activeSurahName = 'Al-Mulk';
    current.activeSurahVerses = 30;
    current.activeSurahCompletedVerses = 0;
    current.surahProgress = {};
    
    this.safeSetItem(this.KEYS.SETTINGS, current);
    this.enqueueSync('Settings', 'UPDATE', { id: 'user_settings', ...current });

    // Sync reset for all Surahs
    if (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.SURAHS)) {
      CONFIG.SURAHS.forEach(s => {
        this.enqueueSync('QuranMemorization', 'UPSERT', {
          id: `surah-${s.number}`,
          surahNumber: s.number,
          surahName: s.name,
          totalVerses: s.verses,
          versesMemorized: 0,
          todayMemorized: 0,
          status: 'NOT_STARTED',
          date: DateUtils.getTodayISO(),
          timestamp: DateUtils.getNowISO()
        });
      });
    }

    const todayISO = DateUtils.getTodayISO();
    this.saveDayLog(todayISO, { quranMemoCount: 0 });
    return current;
  },

  // -------------------------------------------------------------
  // ROUTINES
  // -------------------------------------------------------------
  // ROUTINES
  // -------------------------------------------------------------
  getRoutines() {
    try {
      const data = localStorage.getItem(this.KEYS.ROUTINES);
      let list = data ? JSON.parse(data) : CONFIG.DEFAULT_ROUTINES;
      if (!Array.isArray(list) || list.length === 0) {
        list = CONFIG.DEFAULT_ROUTINES;
      }
      const formatted = list.map(r => {
        const d = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_ROUTINES)
          ? CONFIG.DEFAULT_ROUTINES.find(def => def.id === r.id)
          : null;
        const rawTime = r.time || (d ? d.time : '05:00');
        const parsedMins = typeof DateUtils !== 'undefined' && DateUtils.parseTimeToMinutes
          ? DateUtils.parseTimeToMinutes(rawTime)
          : 300;
        const cleanTime = typeof DateUtils !== 'undefined' && DateUtils.minutesToHHMM
          ? DateUtils.minutesToHHMM(parsedMins)
          : rawTime;
        let parsedDur = null;
        if (r.duration !== undefined) {
          parsedDur = (r.duration !== null && r.duration !== '' && parseInt(r.duration, 10) > 0)
            ? parseInt(r.duration, 10)
            : null;
        } else if (d && d.duration !== undefined) {
          parsedDur = d.duration;
        }
        return {
          ...r,
          time: cleanTime,
          duration: parsedDur,
          anchor: r.anchor || (d ? d.anchor : 'fixed'),
          isActive: r.isActive !== false && r.active !== false
        };
      });

      // Automatically sort in ascending chronological order of time
      formatted.sort((a, b) => {
        const aMins = typeof DateUtils !== 'undefined' && DateUtils.parseTimeToMinutes
          ? DateUtils.parseTimeToMinutes(a.time)
          : 0;
        const bMins = typeof DateUtils !== 'undefined' && DateUtils.parseTimeToMinutes
          ? DateUtils.parseTimeToMinutes(b.time)
          : 0;
        return aMins - bMins;
      });

      return formatted;
    } catch (e) {
      return CONFIG.DEFAULT_ROUTINES;
    }
  },

  saveRoutines(routinesList) {
    if (Array.isArray(routinesList)) {
      // Automatically sort in ascending chronological order of time
      routinesList.sort((a, b) => {
        const aMins = typeof DateUtils !== 'undefined' && DateUtils.parseTimeToMinutes
          ? DateUtils.parseTimeToMinutes(a.time)
          : 0;
        const bMins = typeof DateUtils !== 'undefined' && DateUtils.parseTimeToMinutes
          ? DateUtils.parseTimeToMinutes(b.time)
          : 0;
        return aMins - bMins;
      });
    }

    this.safeSetItem(this.KEYS.ROUTINES, routinesList);
    // Enqueue each routine with stable ID for cloud synchronization
    routinesList.forEach(r => {
      this.enqueueSync('Routines', 'UPSERT', { id: r.id, ...r });
    });
  },

  deleteRoutine(routineId) {
    const list = this.getRoutines().filter(r => r.id !== routineId);
    this.safeSetItem(this.KEYS.ROUTINES, list);
    this.enqueueSync('Routines', 'DELETE', { id: routineId });
    return list;
  },

  syncSurahMemorization(surahNumber, versesMemorized, todayMemorized = 0) {
    const surah = (typeof CONFIG !== 'undefined' && CONFIG.SURAHS) 
      ? (CONFIG.SURAHS.find(s => s.number === surahNumber) || { number: surahNumber, name: `Surah ${surahNumber}`, verses: 30 })
      : { number: surahNumber, name: `Surah ${surahNumber}`, verses: 30 };
    const isCompleted = versesMemorized >= surah.verses && surah.verses > 0;
    const todayISO = DateUtils.getTodayISO();
    
    this.enqueueSync('QuranMemorization', 'UPSERT', {
      id: `surah-${surahNumber}`,
      surahNumber: surah.number,
      surahName: surah.name,
      totalVerses: surah.verses,
      versesMemorized: versesMemorized,
      todayMemorized: todayMemorized,
      status: isCompleted ? 'COMPLETED (100%)' : (versesMemorized > 0 ? `IN_PROGRESS (${Math.round((versesMemorized / surah.verses) * 100)}%)` : 'NOT_STARTED'),
      date: todayISO,
      timestamp: DateUtils.getNowISO()
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
      // Default blank daily record adhering strictly to V2 canonical schema
      allLogs[dateStr] = {
        date: dateStr,
        prayers: {
          fajr: { status: 'NOT_RECORDED', timestamp: null },
          dhuhr: { status: 'NOT_RECORDED', timestamp: null },
          asr: { status: 'NOT_RECORDED', timestamp: null },
          maghrib: { status: 'NOT_RECORDED', timestamp: null },
          isha: { status: 'NOT_RECORDED', timestamp: null }
        },
        tahajjud: 'NOT_RECORDED',
        duha: 'NOT_RECORDED',
        witr: 'NOT_RECORDED',
        morningAdhkar: 'NOT_RECORDED',
        eveningAdhkar: 'NOT_RECORDED',
        sleepAdhkar: 'NOT_RECORDED',
        sunnahRakat: {
          beforeFajr: false,
          beforeDhuhr: false,
          afterDhuhr: false,
          afterMaghrib: false,
          afterIsha: false
        },
        quranTafsir: 'NOT_COMPLETED',
        quranMemoCount: 0,
        quranRecitation: 'NOT_COMPLETED',
        islamicLearning: 'NOT_COMPLETED',
        adcdAttended: 'NOT_ATTENDED',
        cyberSeconds: 0,
        englishSeconds: 0,
        gymStatus: 'NOT_RECORDED',
        weightKg: null,
        bmi: null,
        sleepHours: null,
        bedtime: null,
        waketime: null,
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
  // COMMITMENTS (Sole Canonical Local Store for Daily Commitments)
  // -------------------------------------------------------------
  getCommitments() {
    try {
      const data = localStorage.getItem(this.KEYS.COMMITMENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  getCommitmentsForDate(targetDate) {
    const commitments = this.getCommitments();
    return commitments.filter(c => c.targetDate === targetDate);
  },

  saveCommitment(commitmentData) {
    const commitments = this.getCommitments();
    const newRecord = {
      id: commitmentData.id || CalcUtils.generateId('commit'),
      createdDate: commitmentData.createdDate || DateUtils.getTodayISO(),
      targetDate: commitmentData.targetDate || DateUtils.getTomorrowISO(),
      text: commitmentData.text || '',
      status: commitmentData.status || 'PENDING', // 'PENDING' | 'COMPLETED' | 'NOT_COMPLETED'
      timestamp: DateUtils.getNowISO()
    };

    const existingIdx = commitments.findIndex(c => c.id === newRecord.id);
    if (existingIdx >= 0) {
      commitments[existingIdx] = newRecord;
    } else {
      commitments.unshift(newRecord);
    }

    this.safeSetItem(this.KEYS.COMMITMENTS, commitments);
    this.enqueueSync('Commitments', 'UPSERT', newRecord);
    return newRecord;
  },

  updateCommitmentStatus(id, newStatus) {
    const commitments = this.getCommitments();
    const target = commitments.find(c => c.id === id);
    if (!target) return null;

    target.status = newStatus;
    target.updatedAt = DateUtils.getNowISO();
    this.safeSetItem(this.KEYS.COMMITMENTS, commitments);
    this.enqueueSync('Commitments', 'UPSERT', target);
    return target;
  },

  // -------------------------------------------------------------
  // WEIGHT HISTORY (Canonical Local Store for Long-Term Body Metrics)
  // -------------------------------------------------------------
  getWeightHistory() {
    try {
      const data = localStorage.getItem(this.KEYS.WEIGHT_HISTORY);
      const list = data ? JSON.parse(data) : [];
      return Array.isArray(list) ? list.sort((a, b) => (a.date > b.date ? 1 : -1)) : [];
    } catch (e) {
      return [];
    }
  },

  saveWeightEntry(weightKg, dateStr = DateUtils.getTodayISO()) {
    const history = this.getWeightHistory();
    const settings = this.getSettings();
    const height = settings.userHeight || 178;
    const bmi = CalcUtils.calculateBMI(weightKg, height);

    const recordId = `weight-${dateStr}`;
    const entry = {
      id: recordId,
      date: dateStr,
      weightKg: parseFloat(weightKg),
      bmi,
      timestamp: DateUtils.getNowISO()
    };

    const idx = history.findIndex(h => h.date === dateStr);
    if (idx >= 0) {
      history[idx] = entry;
    } else {
      history.push(entry);
    }
    history.sort((a, b) => (a.date > b.date ? 1 : -1));

    this.safeSetItem(this.KEYS.WEIGHT_HISTORY, history);
    this.saveSettings({ currentWeight: parseFloat(weightKg) });
    this.saveDayLog(dateStr, { weightKg: parseFloat(weightKg), bmi });
    this.enqueueSync('WeightHistory', 'UPSERT', entry);
    return entry;
  },

  // -------------------------------------------------------------
  // POMODORO SESSIONS (Focus Cycles)
  // -------------------------------------------------------------
  getPomodoroSessions() {
    try {
      const data = localStorage.getItem(this.KEYS.POMODORO);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  savePomodoroSession(sessionData) {
    const sessions = this.getPomodoroSessions();
    const record = {
      id: sessionData.id || CalcUtils.generateId('pomo'),
      date: sessionData.date || DateUtils.getTodayISO(),
      category: sessionData.category || 'CYBERSECURITY',
      focusMinutes: sessionData.focusMinutes || 25,
      retrievalMinutes: sessionData.retrievalMinutes || 3,
      restfulMinutes: sessionData.restfulMinutes || 3,
      status: sessionData.status || 'COMPLETED', // 'COMPLETED' | 'ABANDONED'
      timestamp: DateUtils.getNowISO()
    };

    sessions.unshift(record);
    this.safeSetItem(this.KEYS.POMODORO, sessions);
    this.enqueueSync('Pomodoro', 'INSERT', record);
    return record;
  },

  // -------------------------------------------------------------
  // MONTHLY LEARNING GOALS
  // -------------------------------------------------------------
  getMonthlyGoals() {
    try {
      const data = localStorage.getItem(this.KEYS.MONTHLY_GOALS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  },

  getMonthlyGoal(monthStr) {
    const goals = this.getMonthlyGoals();
    return goals[monthStr] || null;
  },

  saveMonthlyGoal(monthStr, goalData) {
    const goals = this.getMonthlyGoals();
    const recordWithId = {
      id: `monthly-${monthStr}`,
      month: monthStr,
      goal: goalData.goal || '',
      reason: goalData.reason || '',
      successCriteria: goalData.successCriteria || '',
      completed: goalData.completed !== undefined ? goalData.completed : null,
      review: goalData.review || null,
      reviewedAt: goalData.reviewedAt || null,
      createdAt: goalData.createdAt || DateUtils.getNowISO(),
      updatedAt: DateUtils.getNowISO()
    };

    goals[monthStr] = recordWithId;
    this.safeSetItem(this.KEYS.MONTHLY_GOALS, goals);
    this.enqueueSync('MonthlyGoals', 'UPSERT', recordWithId);
    return recordWithId;
  },

  // -------------------------------------------------------------
  // SUNNAH RAK'AT SYNC HELPER
  // -------------------------------------------------------------
  syncSunnahRakat(dateStr, sunnahData) {
    const totalRakat = CalcUtils.calculateSunnahTotal(sunnahData);
    const syncId = `sunnah-${dateStr}`;
    const payload = {
      id: syncId,
      date: dateStr,
      beforeFajr: Boolean(sunnahData.beforeFajr),
      beforeDhuhr: Boolean(sunnahData.beforeDhuhr),
      afterDhuhr: Boolean(sunnahData.afterDhuhr),
      afterMaghrib: Boolean(sunnahData.afterMaghrib),
      afterIsha: Boolean(sunnahData.afterIsha),
      totalRakat,
      timestamp: DateUtils.getNowISO()
    };
    this.enqueueSync('SunnahRakat', 'UPSERT', payload);
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
    let cleanDate = mockData.date || DateUtils.getTodayISO();
    if (typeof cleanDate === 'string' && cleanDate.includes('T')) {
      cleanDate = cleanDate.split('T')[0];
    }
    const recordWithId = {
      id: mockData.id || CalcUtils.generateId('ielts'),
      date: cleanDate,
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
  // WEEKLY REVIEWS (Immutable Historical Snapshots)
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
    const weekEndDate = DateUtils.addDaysISO ? DateUtils.addDaysISO(weekStartDate, 6) : '';
    const reviewWithId = {
      id: `weekly-${weekStartDate}`,
      weekStartDate,
      weekEndDate,
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
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('batman:queue-updated', { detail: { queueLength: queue.length } }));
    }
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
    if (typeof document === 'undefined') return;
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

  /**
   * Intelligently reconcile and merge cloud data into LocalStorage
   * Preserves connection configuration (URL, token) while updating all pillar logs.
   * @param {object} cloudData 
   * @returns {boolean}
   */
  hydrateFromCloud(cloudData) {
    if (!cloudData || typeof cloudData !== 'object') return false;

    try {
      const localSettings = this.getSettings();
      const localDayLogs = this.getDayLogs();
      const localRoutines = this.getRoutines();
      const localGoals = this.getGoals();
      const localIelts = this.getIELTSRecords();
      const localWeeklyReviews = this.getWeeklyReviews();

      // 1. Reconcile Settings
      if (cloudData.settings && typeof cloudData.settings === 'object' && Object.keys(cloudData.settings).length > 0) {
        const mergedSettings = {
          ...localSettings,
          ...cloudData.settings,
          gasWebAppUrl: localSettings.gasWebAppUrl || cloudData.settings.gasWebAppUrl || '',
          gasApiToken: localSettings.gasApiToken || cloudData.settings.gasApiToken || 'batman-secret-2026'
        };

        let mergedSurahProgress = {};
        if (cloudData.settings.surahProgress && typeof cloudData.settings.surahProgress === 'object') {
          mergedSurahProgress = { ...cloudData.settings.surahProgress };
        } else if (localSettings.surahProgress && typeof localSettings.surahProgress === 'object') {
          mergedSurahProgress = { ...localSettings.surahProgress };
        }
        mergedSettings.surahProgress = mergedSurahProgress;
        this.safeSetItem(this.KEYS.SETTINGS, mergedSettings);
      }

      // 2. Reconcile DayLogs
      if (cloudData.dayLogs && typeof cloudData.dayLogs === 'object') {
        const mergedDayLogs = { ...localDayLogs };
        Object.keys(cloudData.dayLogs).forEach(dateStr => {
          const cloudDay = cloudData.dayLogs[dateStr];
          const localDay = localDayLogs[dateStr];

          if (!localDay) {
            mergedDayLogs[dateStr] = cloudDay;
          } else {
            // Intelligent prayer merging: prefer COMPLETED
            const mergedPrayers = {};
            const pNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
            pNames.forEach(pName => {
              const cP = (cloudDay.prayers && cloudDay.prayers[pName]) || {};
              const lP = (localDay.prayers && localDay.prayers[pName]) || {};

              if (cP.status === 'COMPLETED' || lP.status === 'COMPLETED') {
                const winner = (cP.status === 'COMPLETED' && cP.location) ? cP : (lP.status === 'COMPLETED' ? lP : cP);
                mergedPrayers[pName] = {
                  status: 'COMPLETED',
                  location: winner.location || 'HOME',
                  timestamp: winner.timestamp || DateUtils.getNowISO()
                };
              } else {
                mergedPrayers[pName] = {
                  status: 'NOT_COMPLETED',
                  location: '',
                  timestamp: null
                };
              }
            });

            mergedDayLogs[dateStr] = {
              date: dateStr,
              prayers: mergedPrayers,
              tahajjud: (cloudDay.tahajjud === 'COMPLETED' || localDay.tahajjud === 'COMPLETED') ? 'COMPLETED' : (cloudDay.tahajjud || localDay.tahajjud || 'MISSED'),
              quranTafsir: (cloudDay.quranTafsir === 'COMPLETED' || localDay.quranTafsir === 'COMPLETED') ? 'COMPLETED' : 'NOT_COMPLETED',
              quranRecitation: (cloudDay.quranRecitation === 'COMPLETED' || localDay.quranRecitation === 'COMPLETED') ? 'COMPLETED' : 'NOT_COMPLETED',
              quranMemoCount: Math.max(localDay.quranMemoCount || 0, cloudDay.quranMemoCount || 0),
              islamicLearning: (cloudDay.islamicLearning === 'COMPLETED' || localDay.islamicLearning === 'COMPLETED') ? 'COMPLETED' : 'NOT_COMPLETED',
              adcdAttended: (cloudDay.adcdAttended && cloudDay.adcdAttended !== 'NOT_ATTENDED') ? cloudDay.adcdAttended : (localDay.adcdAttended || 'NOT_ATTENDED'),
              cyberSeconds: Math.max(localDay.cyberSeconds || 0, cloudDay.cyberSeconds || 0),
              englishSeconds: Math.max(localDay.englishSeconds || 0, cloudDay.englishSeconds || 0),
              gymAttended: Boolean(cloudDay.gymAttended || localDay.gymAttended),
              weightKg: cloudDay.weightKg || localDay.weightKg || null,
              bmi: cloudDay.bmi || localDay.bmi || null,
              sleepHours: cloudDay.sleepHours || localDay.sleepHours || null,
              bedtime: cloudDay.bedtime || localDay.bedtime || '',
              waketime: cloudDay.waketime || localDay.waketime || '',
              review: cloudDay.review || localDay.review || null
            };
          }
        });
        this.safeSetItem(this.KEYS.DAY_LOGS, mergedDayLogs);
      }

      // 3. Reconcile IELTS
      if (Array.isArray(cloudData.ielts) && cloudData.ielts.length > 0) {
        const mergedIelts = [...localIelts];
        cloudData.ielts.forEach(cItem => {
          const normalizedItem = {
            ...cItem,
            date: typeof cItem.date === 'string' && cItem.date.includes('T') ? cItem.date.split('T')[0] : cItem.date
          };
          if (!mergedIelts.some(lItem => lItem.id === normalizedItem.id || (lItem.date === normalizedItem.date && lItem.overall === normalizedItem.overall))) {
            mergedIelts.push(normalizedItem);
          }
        });
        this.safeSetItem(this.KEYS.IELTS, mergedIelts);
      }

      // 4. Reconcile Goals
      if (Array.isArray(cloudData.goals) && cloudData.goals.length > 0) {
        const mergedGoals = [...localGoals];
        cloudData.goals.forEach(cGoal => {
          const idx = mergedGoals.findIndex(g => g.id === cGoal.id);
          if (idx >= 0) {
            mergedGoals[idx] = { ...mergedGoals[idx], ...cGoal };
          } else {
            mergedGoals.push(cGoal);
          }
        });
        this.safeSetItem(this.KEYS.GOALS, mergedGoals);
      }

      // 5. Reconcile Routines
      if (Array.isArray(cloudData.routines) && cloudData.routines.length > 0) {
        const mergedRoutines = [...localRoutines];
        cloudData.routines.forEach(cRoutine => {
          const idx = mergedRoutines.findIndex(r => r.id === cRoutine.id);
          if (idx >= 0) {
            mergedRoutines[idx] = { ...mergedRoutines[idx], ...cRoutine };
          } else {
            mergedRoutines.push(cRoutine);
          }
        });
        this.safeSetItem(this.KEYS.ROUTINES, mergedRoutines);
      }

      // 6. Reconcile Weekly Reviews
      if (cloudData.weeklyReviews && typeof cloudData.weeklyReviews === 'object') {
        const mergedWeekly = {
          ...cloudData.weeklyReviews,
          ...localWeeklyReviews
        };
        this.safeSetItem(this.KEYS.WEEKLY_REVIEWS, mergedWeekly);
      }

      // 7. Reconcile Quran Memorization
      if (Array.isArray(cloudData.quranMemorization)) {
        const currentSettings = this.getSettings();
        const surahProgress = { ...(currentSettings.surahProgress || {}) };
        cloudData.quranMemorization.forEach(item => {
          const sNum = parseInt(item.surahNumber || item.surah_number, 10);
          const vDone = parseInt(item.versesMemorized || item.verses_memorized || item.memorized_verses, 10) || 0;
          if (!isNaN(sNum) && sNum >= 1 && sNum <= 114) {
            if (vDone > 0) {
              surahProgress[sNum] = vDone;
            } else {
              delete surahProgress[sNum];
            }
          }
        });
        currentSettings.surahProgress = surahProgress;
        this.saveSettings(currentSettings);
      }

      return true;
    } catch (err) {
      console.error('[StorageService] Failed to hydrate from cloud:', err);
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
