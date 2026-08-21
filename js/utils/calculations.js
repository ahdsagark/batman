/**
 * BATMAN — Calculation Engine
 * Contains transparent formulas for BMI, IELTS rounding, Streaks, and Pillar Scoring.
 */

const CalcUtils = {
  /**
   * Generates a stable unique ID for idempotent sync across client and Google Sheets
   * Format: e.g. "rec-1723901234567-a8f9c1"
   * @param {string} [prefix='rec']
   */
  generateId(prefix = 'rec') {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `${prefix}-${timestamp}-${randomPart}`;
  },

  /**
   * Calculate Body Mass Index (BMI)
   * Formula: BMI = weight (kg) / (height (m))²
   * @param {number} weightKg 
   * @param {number} heightCm 
   * @returns {number}
   */
  calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0) return 0;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round(bmi * 100) / 100;
  },

  /**
   * Official IELTS Overall Band Score Calculator
   * Official IELTS Rule:
   * 1. Compute arithmetic mean of Listening, Reading, Writing, Speaking.
   * 2. If fractional part is < 0.25, round down to whole band (.0).
   * 3. If fractional part is >= 0.25 and < 0.75, round to half band (.5).
   * 4. If fractional part is >= 0.75, round up to next whole band (.0).
   * 
   * Examples:
   * - (6.5 + 6.5 + 6.0 + 6.0)/4 = 6.25 -> 6.5
   * - (6.5 + 6.5 + 6.5 + 7.0)/4 = 6.625 -> 6.5
   * - (6.5 + 7.0 + 7.0 + 7.0)/4 = 6.875 -> 7.0
   * - (6.5 + 6.0 + 6.0 + 6.0)/4 = 6.125 -> 6.0
   * 
   * @param {number} listening 
   * @param {number} reading 
   * @param {number} writing 
   * @param {number} speaking 
   * @returns {number}
   */
  calculateIELTSOverall(listening, reading, writing, speaking) {
    const l = parseFloat(listening) || 0;
    const r = parseFloat(reading) || 0;
    const w = parseFloat(writing) || 0;
    const s = parseFloat(speaking) || 0;

    if (!l || !r || !w || !s) return 0;

    const mean = (l + r + w + s) / 4;
    const whole = Math.floor(mean);
    const fraction = mean - whole;

    if (fraction < 0.25) {
      return whole;
    } else if (fraction < 0.75) {
      return whole + 0.5;
    } else {
      return whole + 1.0;
    }
  },

  /**
   * Calculate consecutive day streak for any predicate test
   * @param {Array<string>} pastDatesList List of ISO date strings sorted newest to oldest
   * @param {Function} isCompletedFn (dateStr) => boolean
   * @returns {number}
   */
  calculateStreak(pastDatesList, isCompletedFn) {
    let streak = 0;
    for (const dateStr of pastDatesList) {
      if (isCompletedFn(dateStr)) {
        streak++;
      } else {
        // If today is not yet completed, don't break immediately if yesterday was completed
        if (streak === 0 && dateStr === pastDatesList[0]) {
          continue;
        }
        break;
      }
    }
    return streak;
  },

  /**
   * Calculate Transparent Deen Score for a given date
   * Weight breakdown:
   * - 5 Prayers (15% each = 75%) -> Counts MASJID or HOME
   * - Tahajjud (10%) -> Counts PRAYED
   * - Quran AM (5%) + Memorization (5%)
   * - Quran PM (5%)
   * Total = 100%
   */
  calculateDeenScore(dayRecord) {
    if (!dayRecord) return 0;
    let score = 0;

    // 5 Prayers (75 points max, 15 per on-time prayer)
    const prayers = dayRecord.prayers || {};
    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    prayerNames.forEach(p => {
      const pObj = prayers[p];
      if (pObj && (pObj.status === 'MASJID' || pObj.status === 'HOME' || pObj.status === 'COMPLETED')) {
        score += 15;
      }
    });

    // Tahajjud (10 points)
    if (dayRecord.tahajjud === 'PRAYED' || dayRecord.tahajjud === 'COMPLETED') {
      score += 10;
    }

    // Quran AM Tafsir (5 points)
    if (dayRecord.quranTafsir === 'COMPLETED') {
      score += 5;
    }

    // Quran Memorization (5 points if target >= 3 or at least 1 verse)
    const memo = dayRecord.quranMemoCount || 0;
    if (memo >= 3) {
      score += 5;
    } else if (memo > 0) {
      score += Math.round((memo / 3) * 5);
    }

    // Quran PM Recitation (5 points)
    if (dayRecord.quranRecitation === 'COMPLETED') {
      score += 5;
    }

    return Math.min(100, Math.round(score));
  },

  /**
   * Pure dynamic derivation of 12 Daily Sunnah Rak'at total
   * @param {Object} sunnahData { beforeFajr, beforeDhuhr, afterDhuhr, afterMaghrib, afterIsha }
   * @returns {number} 0 to 12
   */
  calculateSunnahTotal(sunnahData) {
    if (!sunnahData || typeof sunnahData !== 'object') return 0;
    let total = 0;
    if (sunnahData.beforeFajr) total += 2;
    if (sunnahData.beforeDhuhr) total += 4;
    if (sunnahData.afterDhuhr) total += 2;
    if (sunnahData.afterMaghrib) total += 2;
    if (sunnahData.afterIsha) total += 2;
    return Math.min(12, Math.max(0, total));
  },

  /**
   * Pure derivation of Cybersecurity Total Investment
   * Independent Deep Work + ADCD (2h = 7200s if attended)
   */
  calculateCyberTotalInvestment(cyberSeconds, adcdAttended = 'NOT_ATTENDED') {
    const independentSecs = Math.max(0, Math.floor(cyberSeconds || 0));
    const adcdSecs = (adcdAttended === 'ATTENDED') ? 7200 : 0;
    const totalSecs = independentSecs + adcdSecs;
    const target = (typeof CONFIG !== 'undefined' && CONFIG.TARGETS && CONFIG.TARGETS.CYBER_DAILY_SECONDS) ? CONFIG.TARGETS.CYBER_DAILY_SECONDS : 14400;

    return {
      independentSeconds: independentSecs,
      adcdSeconds: adcdSecs,
      totalSeconds: totalSecs,
      independentFormatted: DateUtils.formatDurationHoursMins(independentSecs),
      adcdFormatted: DateUtils.formatDurationHoursMins(adcdSecs),
      totalFormatted: DateUtils.formatDurationHoursMins(totalSecs),
      independentTargetPct: Math.min(100, Math.round((independentSecs / target) * 100))
    };
  },

  /**
   * Calculate Cyber Deep Work Score (4 hours target = 100%)
   */
  calculateCyberScore(totalSeconds, adcdAttended = false) {
    const target = CONFIG.TARGETS.CYBER_DAILY_SECONDS; // 14400s (4h)
    const workPercent = Math.min(100, Math.round((totalSeconds / target) * 100));
    return workPercent;
  },

  /**
   * Calculate English Score (30 mins target = 100%)
   */
  calculateEnglishScore(totalSeconds) {
    const target = CONFIG.TARGETS.ENGLISH_DAILY_SECONDS; // 1800s (30m)
    return Math.min(100, Math.round((totalSeconds / target) * 100));
  },

  /**
   * Calculate Sleep Recovery Score (7.5 hours = 100%)
   */
  calculateSleepScore(durationHours) {
    if (!durationHours) return 0;
    const target = CONFIG.TARGETS.SLEEP_DAILY_HOURS;
    return Math.min(100, Math.round((durationHours / target) * 100));
  },

  /**
   * Helper to parse any time string ('HH:mm', 'HH:mm:ss', '10:30 PM', '6:00 am') to total minutes from 00:00
   * @param {string} timeStr 
   * @returns {number|null}
   */
  parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const clean = timeStr.trim().toLowerCase();
    const isPM = clean.includes('pm');
    const isAM = clean.includes('am');
    const timeOnly = clean.replace(/[apm\s]/g, '');
    const parts = timeOnly.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

    let hours = parts[0];
    const minutes = parts[1];
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    return hours * 60 + minutes;
  },

  /**
   * Calculate sleep duration in hours from bedtime and wake time strings (HH:mm)
   * Automatically handles crossing midnight (e.g., 22:30 to 06:00 = 7.5 hrs).
   * @param {string} bedtimeStr 'HH:mm'
   * @param {string} waketimeStr 'HH:mm'
   * @returns {{ hours: number, diffMin: number, hrsPart: number, minsPart: number, display: string } | null}
   */
  calculateSleepDuration(bedtimeStr, waketimeStr) {
    const bTotal = this.parseTimeToMinutes(bedtimeStr);
    const wTotal = this.parseTimeToMinutes(waketimeStr);
    if (bTotal === null || wTotal === null) return null;

    let diffMin = 0;
    if (wTotal < bTotal) {
      // Overnight sleep crossing midnight (e.g. 22:30 -> 06:00)
      diffMin = (1440 - bTotal) + wTotal;
    } else if (wTotal === bTotal) {
      diffMin = 0;
    } else {
      diffMin = wTotal - bTotal;
    }

    const hours = Math.round((diffMin / 60) * 100) / 100;
    const hrsPart = Math.floor(diffMin / 60);
    const minsPart = diffMin % 60;
    const display = `${hrsPart}h ${minsPart.toString().padStart(2, '0')}m (${hours} hrs)`;

    return { hours, diffMin, hrsPart, minsPart, display };
  }
};

if (typeof window !== 'undefined') {
  window.CalcUtils = CalcUtils;
}

