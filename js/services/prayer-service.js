/**
 * BATMAN — Astronomical Prayer Times Calculation Engine
 * Implements standard solar positioning equations for:
 * Fajr, Sunrise, Dhuhr, Asr (Shafi'i & Hanafi), Maghrib, and Isha.
 * 
 * Default Method: University of Islamic Sciences, Karachi (18° Fajr / 18° Isha)
 */

const PrayerService = {
  // Math helpers in Degrees
  dSin: (d) => Math.sin(d * Math.PI / 180),
  dCos: (d) => Math.cos(d * Math.PI / 180),
  dTan: (d) => Math.tan(d * Math.PI / 180),
  dArcSin: (x) => Math.asin(x) * 180 / Math.PI,
  dArcCos: (x) => Math.acos(x) * 180 / Math.PI,
  dArcTan: (x) => Math.atan(x) * 180 / Math.PI,
  dArcTan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI,
  fixAngle: (a) => { a = a - 360.0 * Math.floor(a / 360.0); return a < 0 ? a + 360.0 : a; },
  fixHour: (h) => { h = h - 24.0 * Math.floor(h / 24.0); return h < 0 ? h + 24.0 : h; },

  /**
   * Compute sun coordinates (declination and equation of time) for Julian Day
   */
  sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = this.fixAngle(357.529 + 0.98560028 * D);
    const q = this.fixAngle(280.459 + 0.98564736 * D);
    const L = this.fixAngle(q + 1.915 * this.dSin(g) + 0.020 * this.dSin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const d = this.dArcSin(this.dSin(e) * this.dSin(L));
    let RA = this.dArcTan2(this.dCos(e) * this.dSin(L), this.dCos(L)) / 15;
    RA = this.fixHour(RA);
    const EqT = q / 15 - RA;
    return { declination: d, equation: EqT };
  },

  julianDate(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  },

  computeMidDay(jd, timezone, lng) {
    const sun = this.sunPosition(jd);
    const noon = this.fixHour(12 + timezone - lng / 15 - sun.equation);
    return { noon, declination: sun.declination };
  },

  computeTime(noon, declination, lat, angle, direction = 'ccw') {
    const val = (-this.dSin(angle) - this.dSin(lat) * this.dSin(declination)) / (this.dCos(lat) * this.dCos(declination));
    if (val > 1 || val < -1) return null; // Sun does not reach angle
    const t = (1 / 15) * this.dArcCos(val);
    return noon + (direction === 'ccw' ? -t : t);
  },

  computeAsr(noon, declination, lat, shadowFactor = 1) {
    // shadowFactor = 1 for Shafi'i/standard, 2 for Hanafi
    const d = declination;
    const angle = -this.dArcTan(1 / (shadowFactor + this.dTan(Math.abs(lat - d))));
    const val = (-this.dSin(angle) - this.dSin(lat) * this.dSin(d)) / (this.dCos(lat) * this.dCos(d));
    if (val > 1 || val < -1) return null;
    const t = (1 / 15) * this.dArcCos(val);
    return noon + t;
  },

  /**
   * Convert decimal hours (e.g. 13.5) to HH:MM format ("13:30")
   */
  hoursToHHMM(decHours) {
    if (decHours === null || isNaN(decHours)) return '--:--';
    decHours = this.fixHour(decHours + 0.5 / 60); // round to nearest minute
    const hours = Math.floor(decHours);
    const minutes = Math.floor((decHours - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  },

  /**
   * Calculate all 5 daily prayers + Sunrise for a given date
   * @param {Date} [date=new Date()]
   * @param {string} [cityKey]
   * @param {string} [methodKey]
   * @param {string} [asrMethod]
   */
  getPrayerTimes(date = new Date(), cityKey, methodKey, asrMethod) {
    const settings = StorageService.getSettings();
    const city = CONFIG.CITIES[cityKey || settings.prayerCity] || CONFIG.CITIES['Calicut,India'];
    const method = CONFIG.CALC_METHODS[methodKey || settings.prayerMethod] || CONFIG.CALC_METHODS.Karachi;
    const isHanafi = (asrMethod || settings.prayerAsrMethod) === 'Hanafi';

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const jd = this.julianDate(year, month, day);

    const { noon, declination } = this.computeMidDay(jd, city.tz, city.lng);

    // Standard angles:
    // Sunrise / Sunset: 0.833° depression
    // Fajr: method.fajrAngle
    // Isha: method.ishaAngle
    const fajrHour = this.computeTime(noon, declination, city.lat, method.fajrAngle, 'ccw');
    const sunriseHour = this.computeTime(noon, declination, city.lat, 0.833, 'ccw');
    const dhuhrHour = noon + (2 / 60); // 2 minutes past solar noon
    const asrHour = this.computeAsr(noon, declination, city.lat, isHanafi ? 2 : 1);
    const maghribHour = this.computeTime(noon, declination, city.lat, 0.833, 'cw');
    
    let ishaHour;
    if (method.ishaInterval) {
      ishaHour = maghribHour + (method.ishaInterval / 60);
    } else {
      ishaHour = this.computeTime(noon, declination, city.lat, method.ishaAngle, 'cw');
    }

    return {
      fajr: this.hoursToHHMM(fajrHour),
      sunrise: this.hoursToHHMM(sunriseHour),
      dhuhr: this.hoursToHHMM(dhuhrHour),
      asr: this.hoursToHHMM(asrHour),
      maghrib: this.hoursToHHMM(maghribHour),
      isha: this.hoursToHHMM(ishaHour),
      cityName: city.name,
      methodName: method.name
    };
  }
};

if (typeof window !== 'undefined') {
  window.PrayerService = PrayerService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrayerService;
}
