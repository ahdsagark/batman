/**
 * BATMAN — Centralized Analytics Engine
 * Aggregates multi-period time series data for Deen, Cybersecurity, English,
 * Gym, Sleep, and Historical Weight (reading solely from batman_weight_history).
 */

const AnalyticsService = {
  /**
   * Get comprehensive metrics aggregated across a given list of ISO date strings
   * @param {string[]} dateList Array of YYYY-MM-DD
   */
  getAggregatedMetrics(dateList) {
    const allLogs = StorageService.getDayLogs();
    const totalDays = dateList.length;
    let loggedDaysCount = 0;

    let deenScoreSum = 0;
    let totalCyberSeconds = 0;
    let totalEnglishSeconds = 0;
    let gymDoneCount = 0;
    let sleepSumHours = 0;
    let sleepLoggedCount = 0;
    let masjidPrayersCount = 0;
    let totalPrayersLogged = 0;

    const timeSeries = {
      dates: [],
      deenScores: [],
      cyberHours: [],
      englishHours: [],
      sleepHours: [],
      gymStatuses: []
    };

    dateList.forEach(dateStr => {
      const log = allLogs[dateStr];
      timeSeries.dates.push(dateStr);

      if (log) {
        loggedDaysCount++;
        const deenScore = CalcUtils.calculateDeenScore(log);
        deenScoreSum += deenScore;
        timeSeries.deenScores.push({ date: dateStr, val: deenScore });

        const cSecs = log.cyberSeconds || 0;
        totalCyberSeconds += cSecs;
        timeSeries.cyberHours.push({ date: dateStr, val: Math.round((cSecs / 3600) * 10) / 10 });

        const eSecs = log.englishSeconds || 0;
        totalEnglishSeconds += eSecs;
        timeSeries.englishHours.push({ date: dateStr, val: Math.round((eSecs / 60) * 10) / 10 });

        if (log.gymStatus === 'DONE' || log.gymAttended === true) {
          gymDoneCount++;
          timeSeries.gymStatuses.push({ date: dateStr, status: 'DONE' });
        } else {
          timeSeries.gymStatuses.push({ date: dateStr, status: log.gymStatus || 'NOT_RECORDED' });
        }

        if (log.sleepHours) {
          const sH = parseFloat(log.sleepHours);
          sleepSumHours += sH;
          sleepLoggedCount++;
          timeSeries.sleepHours.push({ date: dateStr, val: sH });
        } else {
          timeSeries.sleepHours.push({ date: dateStr, val: 0 });
        }

        if (log.prayers) {
          ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
            const pObj = log.prayers[p];
            if (pObj) {
              if (pObj.status === 'MASJID' || (pObj.status === 'COMPLETED' && pObj.location === 'MASJID')) {
                masjidPrayersCount++;
                totalPrayersLogged++;
              } else if (pObj.status === 'HOME' || pObj.status === 'COMPLETED' || pObj.status === 'QADA') {
                totalPrayersLogged++;
              }
            }
          });
        }
      } else {
        timeSeries.deenScores.push({ date: dateStr, val: 0 });
        timeSeries.cyberHours.push({ date: dateStr, val: 0 });
        timeSeries.englishHours.push({ date: dateStr, val: 0 });
        timeSeries.sleepHours.push({ date: dateStr, val: 0 });
        timeSeries.gymStatuses.push({ date: dateStr, status: 'NOT_RECORDED' });
      }
    });

    const divisor = Math.max(1, loggedDaysCount);
    const avgDeen = loggedDaysCount > 0 ? Math.round(deenScoreSum / divisor) : 0;
    const avgCyberDailyHours = (totalCyberSeconds / divisor / 3600).toFixed(1);
    const avgEnglishDailyMins = Math.round(totalEnglishSeconds / divisor / 60);
    const avgSleepHours = sleepLoggedCount > 0 ? (sleepSumHours / sleepLoggedCount).toFixed(1) : '--';
    const masjidPct = totalPrayersLogged > 0 ? Math.round((masjidPrayersCount / totalPrayersLogged) * 100) : 0;

    return {
      totalDays,
      loggedDaysCount,
      avgDeen,
      totalCyberSeconds,
      totalCyberHoursFormatted: DateUtils.formatDurationHoursMins(totalCyberSeconds),
      avgCyberDailyHours,
      totalEnglishSeconds,
      totalEnglishFormatted: DateUtils.formatDurationHoursMins(totalEnglishSeconds),
      avgEnglishDailyMins,
      gymDoneCount,
      avgSleepHours,
      masjidPrayersCount,
      masjidPct,
      timeSeries
    };
  },

  /**
   * Get historical weight series reading SOLELY from batman_weight_history
   * @param {number} [limit=30]
   */
  getWeightProgression(limit = 30) {
    const history = StorageService.getWeightHistory();
    const settings = StorageService.getSettings();
    const targetWeight = settings.targetWeight || 70.0;
    const currentWeight = settings.currentWeight || 62.0;

    const sorted = [...history].sort((a, b) => (a.date > b.date ? 1 : -1));
    const recent = sorted.slice(-limit);

    return {
      records: recent,
      initialWeight: sorted.length > 0 ? sorted[0].weightKg : currentWeight,
      currentWeight: sorted.length > 0 ? sorted[sorted.length - 1].weightKg : currentWeight,
      targetWeight,
      weightGainKg: sorted.length > 0 ? (sorted[sorted.length - 1].weightKg - sorted[0].weightKg).toFixed(1) : '0.0',
      totalEntries: sorted.length
    };
  }
};

if (typeof window !== 'undefined') {
  window.AnalyticsService = AnalyticsService;
}
