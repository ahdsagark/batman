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
   * Format 24-hour time "13:30" to 12-hour "1:30 PM"
   * @param {string} time24 e.g. "13:30"
   */
  format12Hour(time24) {
    if (!time24) return '--:--';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // '0' becomes '12'
    const mPadded = String(m).padStart(2, '0');
    return `${h}:${mPadded} ${ampm}`;
  },

  /**
   * Convert seconds into "2h 35m" or "45m"
   * @param {number} totalSeconds 
   */
  formatDurationHoursMins(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${String(mins).padStart(2, '0')}m`;
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
   * Parse minutes from time string "HH:MM" (from midnight)
   */
  parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
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
  }
};

if (typeof window !== 'undefined') {
  window.DateUtils = DateUtils;
}
