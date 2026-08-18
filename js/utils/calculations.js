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
   * - 5 Prayers (15% each = 75%)
   * - Tahajjud (10%)
   * - Quran AM (5%) + Memorization (5%)
   * - Quran PM (5%)
   * Total = 100%
   */
  calculateDeenScore(dayRecord) {
    if (!dayRecord) return 0;
    let score = 0;

    // 5 Prayers (75 points max, 15 per prayer)
    const prayers = dayRecord.prayers || {};
    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    prayerNames.forEach(p => {
      if (prayers[p] && prayers[p].status === 'COMPLETED') {
        score += 15;
      }
    });

    // Tahajjud (10 points)
    if (dayRecord.tahajjud === 'COMPLETED') {
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
   * Calculate sleep duration in hours from bedtime and wake time strings (HH:mm)
   * Automatically handles crossing midnight (e.g., 22:30 to 06:00 = 7.5 hrs).
   * @param {string} bedtimeStr 'HH:mm'
   * @param {string} waketimeStr 'HH:mm'
   * @returns {{ hours: number, diffMin: number, hrsPart: number, minsPart: number, display: string } | null}
   */
  calculateSleepDuration(bedtimeStr, waketimeStr) {
    if (!bedtimeStr || !waketimeStr) return null;
    const bedParts = bedtimeStr.split(':').map(Number);
    const wakeParts = waketimeStr.split(':').map(Number);
    if (bedParts.length < 2 || wakeParts.length < 2) return null;
    const [bH, bM] = bedParts;
    const [wH, wM] = wakeParts;
    if (isNaN(bH) || isNaN(bM) || isNaN(wH) || isNaN(wM)) return null;

    const bTotal = bH * 60 + bM;
    const wTotal = wH * 60 + wM;

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

