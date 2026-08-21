/**
 * BATMAN — Date & Time Utility Functions
 */

const DateUtils = {
  /**
   * Get current local date in YYYY-MM-DD format
   * @param {Date} [d=new Date()]
   * @returns {string} e.g. "2026-08-17"
   */
  getTodayISO(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Get ISO timestamp e.g. "2026-08-17T23:05:00.000Z"
   */
  getNowISO() {
    return new Date().toISOString();
  },

  /**
   * Format date into readable header e.g. "Monday, 17 August 2026"
   * @param {string|Date} dateInput 
   */
  formatHeaderDate(dateInput = new Date()) {
    const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  /**
   * Format date into clean month and day e.g. "18 Aug" or "Aug 18"
   * Handles ISO timestamps, YYYY-MM-DD, or Date objects
   * @param {string|Date|number} dateInput
   * @returns {string} e.g. "Aug 18"
   */
  formatMonthDay(dateInput) {
    if (!dateInput) return '--';
    let d;
    if (typeof dateInput === 'string') {
      const cleanStr = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
        const parts = cleanStr.split('-');
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        d = new Date(cleanStr);
      }
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) {
      return String(dateInput).substring(0, 10);
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  },

  /**
   * Format 24-hour time "13:30" or Date object to 12-hour "1:30 PM"
   * @param {string|Date} time24
   */
  format12Hour(time24) {
    if (!time24) return '--:--';
    const totalMins = this.parseTimeToMinutes(time24);
    const h24 = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const mPadded = String(m).padStart(2, '0');
    return `${h12}:${mPadded} ${ampm}`;
  },

  /**
   * Convert seconds into "2h 35m", "4h", "3h 05m", or "45m"
   * @param {number} totalSeconds 
   */
  formatDurationHoursMins(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);

    if (hours > 0 && mins === 0) {
      return `${hours}h`;
    }
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
    }
    return `${mins}m`;
  },

  /**
   * Convert seconds into digital timer display "00:00:00"
   * @param {number} totalSeconds 
   */
  formatDigitalTimer(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = String(Math.floor(s / 3600)).padStart(2, '0');
    const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const secs = String(s % 60).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  },

  /**
   * Get start of the current week (Monday) in YYYY-MM-DD
   * @param {Date} [d=new Date()]
   */
  getWeekStartISO(d = new Date()) {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sun, 1 is Mon...
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    return this.getTodayISO(date);
  },

  /**
   * Get array of previous N days in ISO format (inclusive of today)
   * @param {number} count 
   */
  getPastDaysISO(count = 7) {
    const days = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(this.getTodayISO(d));
    }
    return days;
  },

  /**
   * Robustly parse minutes from time string (e.g. "13:30", "1:30 PM", ISO Date string, or Date instance)
   * @param {string|Date|number} timeInput
   */
  parseTimeToMinutes(timeInput) {
    if (!timeInput) return 0;
    if (typeof timeInput === 'number') {
      return isNaN(timeInput) ? 0 : Math.max(0, Math.floor(timeInput)) % 1440;
    }

    if (timeInput instanceof Date) {
      return timeInput.getHours() * 60 + timeInput.getMinutes();
    }

    const str = String(timeInput).trim();
    if (!str) return 0;

    // Handle ISO string or full date string e.g. "1899-12-30T21:30:00.000Z"
    const isoMatch = str.match(/T(\d{2}):(\d{2})/);
    if (isoMatch) {
      const h = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      return (h % 24) * 60 + (m % 60);
    }

    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.getHours() * 60 + d.getMinutes();
      }
    }

    const isPM = /pm/i.test(str);
    const isAM = /am/i.test(str);
    const clean = str.replace(/[^0-9:]/g, '');
    const parts = clean.split(':');

    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;

      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;

      return (Math.max(0, h) % 24) * 60 + (Math.max(0, m) % 60);
    }

    return 0;
  },

  /**
   * Convert total minutes from midnight to "HH:MM" 24h string
   * @param {number} totalMinutes
   */
  minutesToHHMM(totalMinutes) {
    const mins = Math.max(0, Math.floor(totalMinutes || 0)) % 1440;
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  },

  /**
   * Get tomorrow in YYYY-MM-DD format
   * @param {Date} [d=new Date()]
   * @returns {string}
   */
  getTomorrowISO(d = new Date()) {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return this.getTodayISO(next);
  },

  /**
   * Get yesterday in YYYY-MM-DD format
   * @param {Date} [d=new Date()]
   * @returns {string}
   */
  getYesterdayISO(d = new Date()) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return this.getTodayISO(prev);
  },

  /**
   * Add or subtract days from a YYYY-MM-DD date string
   * @param {string} dateStr 
   * @param {number} days 
   * @returns {string}
   */
  addDaysISO(dateStr, days) {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    return this.getTodayISO(d);
  },

  /**
   * Get current month in YYYY-MM format
   * @param {Date} [d=new Date()]
   * @returns {string}
   */
  getCurrentMonthISO(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  },

  /**
   * Format YYYY-MM to readable "August 2026"
   * @param {string} monthStr 
   */
  formatMonthYear(monthStr) {
    if (!monthStr) return '--';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
};

if (typeof window !== 'undefined') {
  window.DateUtils = DateUtils;
}
