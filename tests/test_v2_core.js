/**
 * BATMAN V2 — Core Architecture & Logic Verification Suite
 */

const assert = require('assert');

// Mock browser environment for Node.js
const fs = require('fs');
const path = require('path');

const storageMap = {};
global.localStorage = {
  getItem: (k) => (storageMap[k] !== undefined ? storageMap[k] : null),
  setItem: (k, v) => { storageMap[k] = typeof v === 'string' ? v : JSON.stringify(v); },
  removeItem: (k) => { delete storageMap[k]; },
  clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
};

global.window = global;
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
global.CustomEvent = function(name, opts) { this.name = name; this.opts = opts; };
global.matchMedia = () => ({ matches: true, addEventListener: () => {} });
global.navigator = { geolocation: { getCurrentPosition: () => {} } };

function loadScript(relPath) {
  const code = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  eval(code);
}

loadScript('js/config.js');
loadScript('js/utils/dates.js');
loadScript('js/utils/calculations.js');
loadScript('js/utils/validation.js');
loadScript('js/services/storage-service.js');
loadScript('js/services/analytics-service.js');

console.log('=== RUNNING BATMAN V2 CORE ARCHITECTURE TESTS ===\n');

// TEST 1: Sunnah Derived Total
console.log('Test 1: 12 Daily Sunnah Rak\'at derived total...');
const sunnahFull = { beforeFajr: true, beforeDhuhr: true, afterDhuhr: true, afterMaghrib: true, afterIsha: true };
assert.strictEqual(CalcUtils.calculateSunnahTotal(sunnahFull), 12, 'Full Sunnah must equal 12 Rak\'at');

const sunnahPartial = { beforeFajr: true, beforeDhuhr: false, afterDhuhr: true, afterMaghrib: false, afterIsha: true };
assert.strictEqual(CalcUtils.calculateSunnahTotal(sunnahPartial), 6, '2 + 0 + 2 + 0 + 2 must equal 6');
console.log('✓ Test 1 passed.');

// TEST 2: Cybersecurity Total Investment Pure Function
console.log('\nTest 2: Cybersecurity Investment derivation...');
const investAttended = CalcUtils.calculateCyberTotalInvestment(14400, 'ATTENDED'); // 4h independent + 2h ADCD
assert.strictEqual(investAttended.independentSeconds, 14400);
assert.strictEqual(investAttended.adcdSeconds, 7200);
assert.strictEqual(investAttended.totalSeconds, 21600);
assert.strictEqual(investAttended.independentFormatted, '4h');
assert.strictEqual(investAttended.adcdFormatted, '2h');
assert.strictEqual(investAttended.totalFormatted, '6h');
assert.strictEqual(investAttended.independentTargetPct, 100);

const investNotAttended = CalcUtils.calculateCyberTotalInvestment(7200, 'NOT_ATTENDED');
assert.strictEqual(investNotAttended.adcdSeconds, 0);
assert.strictEqual(investNotAttended.totalSeconds, 7200);
assert.strictEqual(investNotAttended.totalFormatted, '2h');
assert.strictEqual(investNotAttended.independentTargetPct, 50);
console.log('✓ Test 2 passed.');

// TEST 3: Deen Score Transparent Calculation
console.log('\nTest 3: Deen Score calculation with V2 prayer statuses...');
const dayLogFull = {
  prayers: {
    fajr: { status: 'MASJID' },
    dhuhr: { status: 'HOME' },
    asr: { status: 'MASJID' },
    maghrib: { status: 'MASJID' },
    isha: { status: 'HOME' }
  },
  tahajjud: 'PRAYED',
  quranTafsir: 'COMPLETED',
  quranMemoCount: 3,
  quranRecitation: 'COMPLETED'
};
assert.strictEqual(CalcUtils.calculateDeenScore(dayLogFull), 100, 'All on-time prayers and Quran must equal 100%');

const dayLogMissed = {
  prayers: {
    fajr: { status: 'QADA' }, // Qada does not give full on-time points
    dhuhr: { status: 'MASJID' },
    asr: { status: 'MISSED' },
    maghrib: { status: 'HOME' },
    isha: { status: 'NOT_RECORDED' }
  },
  tahajjud: 'MISSED',
  quranTafsir: 'NOT_COMPLETED',
  quranMemoCount: 0,
  quranRecitation: 'NOT_COMPLETED'
};
// 2 on-time prayers (dhuhr, maghrib) = 30 pts
assert.strictEqual(CalcUtils.calculateDeenScore(dayLogMissed), 30);
console.log('✓ Test 3 passed.');

// TEST 4: Date Utilities
console.log('\nTest 4: Date utility helpers...');
assert.strictEqual(DateUtils.addDaysISO('2026-08-17', 1), '2026-08-18');
assert.strictEqual(DateUtils.addDaysISO('2026-08-17', -1), '2026-08-16');
assert.strictEqual(DateUtils.addDaysISO('2026-08-31', 1), '2026-09-01');
assert.strictEqual(DateUtils.formatMonthDay('2026-08-17'), 'Aug 17');
assert.strictEqual(DateUtils.formatMonthYear('2026-08'), 'August 2026');
console.log('✓ Test 4 passed.');

// TEST 5: StorageService Migration & Schema V2
console.log('\nTest 5: StorageService schema v2 initialization & migration...');
// Simulate legacy V1 data
storageMap['batman_day_logs'] = JSON.stringify({
  '2026-08-17': {
    date: '2026-08-17',
    prayers: {
      fajr: { status: 'COMPLETED', location: 'MASJID' },
      dhuhr: { status: 'COMPLETED', location: 'HOME' },
      asr: { status: 'NOT_COMPLETED', location: '' },
      maghrib: { status: 'NOT_COMPLETED', location: '' },
      isha: { status: 'NOT_COMPLETED', location: '' }
    },
    tahajjud: 'COMPLETED',
    gymAttended: true,
    weightKg: 62.5
  }
});
storageMap['batman_data_version'] = '1';

StorageService.init();

const migratedLog = StorageService.getDayLog('2026-08-17');
assert.strictEqual(migratedLog.prayers.fajr.status, 'MASJID', 'Migrated Fajr must become MASJID');
assert.strictEqual(migratedLog.prayers.dhuhr.status, 'HOME', 'Migrated Dhuhr must become HOME');
assert.strictEqual(migratedLog.prayers.asr.status, 'NOT_RECORDED', 'Migrated Asr must become NOT_RECORDED');
assert.strictEqual(migratedLog.tahajjud, 'PRAYED', 'Migrated Tahajjud must become PRAYED');
assert.strictEqual(migratedLog.gymStatus, 'DONE', 'Migrated Gym must become DONE');
assert.strictEqual(migratedLog.duha, 'NOT_RECORDED');
assert.strictEqual(migratedLog.morningAdhkar, 'NOT_RECORDED');

const weightHist = StorageService.getWeightHistory();
assert.strictEqual(weightHist.length >= 1, true, 'WeightHistory must be seeded during migration');
assert.strictEqual(weightHist.some(w => w.date === '2026-08-17' && w.weightKg === 62.5), true);
console.log('✓ Test 5 passed.');

// TEST 6: Commitments Single Source of Truth
console.log('\nTest 6: Commitments store (Single Source of Truth)...');
const c1 = StorageService.saveCommitment({
  createdDate: '2026-08-17',
  targetDate: '2026-08-18',
  text: 'Complete 4h Cybersecurity Deep Work',
  status: 'PENDING'
});
assert.strictEqual(c1.status, 'PENDING');
assert.strictEqual(c1.targetDate, '2026-08-18');

const forTomorrow = StorageService.getCommitmentsForDate('2026-08-18');
assert.strictEqual(forTomorrow.length, 1);
assert.strictEqual(forTomorrow[0].text, 'Complete 4h Cybersecurity Deep Work');

StorageService.updateCommitmentStatus(c1.id, 'COMPLETED');
const updated = StorageService.getCommitments().find(c => c.id === c1.id);
assert.strictEqual(updated.status, 'COMPLETED');
console.log('✓ Test 6 passed.');

// TEST 7: Weekly Review Immutable Historical Snapshots
console.log('\nTest 7: Weekly Review snapshots with weekStartDate & weekEndDate...');
const wReview = StorageService.saveWeeklyReview('2026-08-17', {
  cyberHours: '28.0',
  englishHours: '3.5',
  gymCount: 4,
  avgSleep: '7.6',
  whatWentWell: 'Consistent execution'
});
assert.strictEqual(wReview.weekStartDate, '2026-08-17');
assert.strictEqual(wReview.weekEndDate, '2026-08-23');

const allWeekly = StorageService.getWeeklyReviews();
assert.strictEqual(allWeekly['2026-08-17'].cyberHours, '28.0');
console.log('✓ Test 7 passed.');

// TEST 8: Monthly Goals
console.log('\nTest 8: Monthly Learning Goals keyed by YYYY-MM...');
const mGoal = StorageService.saveMonthlyGoal('2026-08', {
  goal: 'Active Directory Attacks & Kerberos Mastery',
  reason: 'Core requirement for Red Team offensive certification',
  successCriteria: 'Build home AD lab and execute Golden Ticket attack'
});
assert.strictEqual(mGoal.month, '2026-08');
assert.strictEqual(StorageService.getMonthlyGoal('2026-08').goal, 'Active Directory Attacks & Kerberos Mastery');
console.log('✓ Test 8 passed.');

// TEST 9: Analytics Service
console.log('\nTest 9: AnalyticsService time-series & weight progression...');
const wProg = AnalyticsService.getWeightProgression(30);
assert.strictEqual(Array.isArray(wProg.records), true);
assert.strictEqual(wProg.targetWeight, 70);

const metrics = AnalyticsService.getAggregatedMetrics(['2026-08-17']);
assert.strictEqual(metrics.totalDays, 1);
assert.strictEqual(metrics.loggedDaysCount, 1);
console.log('✓ Test 9 passed.');

console.log('\n=============================================');
console.log('🎉 ALL 9 CORE ARCHITECTURAL TESTS PASSED 100%!');
console.log('=============================================');
