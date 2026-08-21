/**
 * BATMAN V2 — Comprehensive DOM & Module Integration Verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Read index.html to build realistic DOM environment
const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Mock a lightweight simulated DOM environment
const elementsMap = {};

function createMockElement(id, tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    className: '',
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    style: {},
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k] || null; },
    removeAttribute(k) { delete this.attributes[k]; },
    listeners: {},
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    click() {
      if (this.listeners['click']) {
        this.listeners['click'].forEach(fn => fn({ target: this }));
      }
    },
    appendChild(child) { return child; },
    removeChild(child) { return child; },
    remove() { return true; },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; }
  };
}

global.document = {
  documentElement: createMockElement('html', 'html'),
  getElementById(id) {
    if (!elementsMap[id]) {
      elementsMap[id] = createMockElement(id);
    }
    return elementsMap[id];
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return null;
  },
  querySelectorAll(sel) {
    return [];
  },
  createElement(tag) {
    const el = createMockElement(`dyn-${Date.now()}-${Math.random()}`, tag);
    el.querySelector = function(s) {
      if (s.startsWith('#')) return global.document.getElementById(s.slice(1));
      return createMockElement('mock-sub');
    };
    el.querySelectorAll = function(s) {
      return [createMockElement('mock-btn'), createMockElement('mock-btn2')];
    };
    return el;
  }
};

const storageMap = {};
global.localStorage = {
  getItem: (k) => (storageMap[k] !== undefined ? storageMap[k] : null),
  setItem: (k, v) => { storageMap[k] = typeof v === 'string' ? v : JSON.stringify(v); },
  removeItem: (k) => { delete storageMap[k]; },
  clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
};

global.window = global;
global.window.dispatchEvent = () => {};
global.window.addEventListener = () => {};
global.CustomEvent = function(name, opts) { this.name = name; this.opts = opts; };
global.matchMedia = () => ({ matches: true, addEventListener: () => {} });
global.navigator = { geolocation: { getCurrentPosition: () => {} } };

global.UI = {
  vibrate: () => {},
  showToast: () => {},
  openSheet: () => {},
  closeSheet: () => {},
  switchTab: () => {}
};

function loadScript(relPath) {
  const code = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  eval(code);
}

loadScript('js/config.js');
loadScript('js/utils/dates.js');
loadScript('js/utils/calculations.js');
loadScript('js/utils/validation.js');
loadScript('js/utils/ui.js');
loadScript('js/services/storage-service.js');
loadScript('js/services/prayer-service.js');
loadScript('js/services/notification-service.js');
loadScript('js/services/analytics-service.js');
loadScript('js/modules/dashboard.js');
loadScript('js/modules/deen.js');
loadScript('js/modules/cybersecurity.js');
loadScript('js/modules/english.js');
loadScript('js/modules/pomodoro.js');
loadScript('js/modules/fitness.js');
loadScript('js/modules/sleep.js');
loadScript('js/modules/reviews.js');
loadScript('js/modules/progress.js');
loadScript('js/modules/settings.js');

console.log('=== RUNNING DOM & LIFECYCLE INTEGRATION TESTS ===\n');

StorageService.init();

// TEST 1: Deen Prayer Cycling
console.log('Test 1: Deen Prayer 5-state cycling...');
const todayISO = DateUtils.getTodayISO();
let day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'NOT_RECORDED');

DeenModule.cyclePrayer('fajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'MASJID');

DeenModule.cyclePrayer('fajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'HOME');

DeenModule.cyclePrayer('fajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'QADA');

DeenModule.cyclePrayer('fajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'MISSED');

DeenModule.cyclePrayer('fajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.prayers.fajr.status, 'NOT_RECORDED');
console.log('✓ Test 1 passed: Fajr cycled NOT_RECORDED -> MASJID -> HOME -> QADA -> MISSED -> NOT_RECORDED.');

// TEST 2: Tahajjud Cycling
console.log('\nTest 2: Tahajjud 3-state cycling...');
assert.strictEqual(day.tahajjud, 'NOT_RECORDED');
DeenModule.cycleTahajjud();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.tahajjud, 'PRAYED');
DeenModule.cycleTahajjud();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.tahajjud, 'MISSED');
DeenModule.cycleTahajjud();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.tahajjud, 'NOT_RECORDED');
console.log('✓ Test 2 passed: Tahajjud cycled NOT_RECORDED -> PRAYED -> MISSED -> NOT_RECORDED.');

// TEST 3: Gym Status Cycling
console.log('\nTest 3: Gym 4-state cycling...');
FitnessModule.cycleGym();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.gymStatus, 'DONE');
assert.strictEqual(day.gymAttended, true);

FitnessModule.cycleGym();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.gymStatus, 'REST');
assert.strictEqual(day.gymAttended, false);

FitnessModule.cycleGym();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.gymStatus, 'MISSED');
assert.strictEqual(day.gymAttended, false);

FitnessModule.cycleGym();
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.gymStatus, 'NOT_RECORDED');
assert.strictEqual(day.gymAttended, false);
console.log('✓ Test 3 passed: Gym cycled NOT_RECORDED -> DONE -> REST -> MISSED -> NOT_RECORDED.');

// TEST 4: Sunnah 12 Rak'at Toggle & Sync
console.log('\nTest 4: Sunnah Rak\'at checklist toggles...');
DeenModule.toggleSunnah('beforeFajr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.sunnahRakat.beforeFajr, true);
assert.strictEqual(CalcUtils.calculateSunnahTotal(day.sunnahRakat), 2);

DeenModule.toggleSunnah('beforeDhuhr');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.sunnahRakat.beforeDhuhr, true);
assert.strictEqual(CalcUtils.calculateSunnahTotal(day.sunnahRakat), 6);
console.log('✓ Test 4 passed: Sunnah Rak\'at toggled dynamically to 6 Rak\'at.');

// TEST 5: Cybersecurity Timer RESET without affecting accumulated total
console.log('\nTest 5: Cybersecurity timer RESET preserves daily accumulated seconds...');
StorageService.saveDayLog(todayISO, { cyberSeconds: 7200 }); // 2h accumulated
CyberModule.sessionElapsedSeconds = 1800; // 30m current unsaved session
CyberModule.timerState = 'PAUSED';

CyberModule.resetTimer();
assert.strictEqual(CyberModule.sessionElapsedSeconds, 0);
assert.strictEqual(CyberModule.timerState, 'STOPPED');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.cyberSeconds, 7200, 'Accumulated 2h (7200s) must remain completely untouched on reset!');
console.log('✓ Test 5 passed: Timer RESET discarded session and preserved 7200s day total.');

// TEST 6: English Timer RESET
console.log('\nTest 6: English timer RESET...');
StorageService.saveDayLog(todayISO, { englishSeconds: 900 });
EnglishModule.sessionElapsedSeconds = 600;
EnglishModule.timerState = 'RUNNING';

EnglishModule.resetTimer();
assert.strictEqual(EnglishModule.sessionElapsedSeconds, 0);
assert.strictEqual(EnglishModule.timerState, 'STOPPED');
day = StorageService.getDayLog(todayISO);
assert.strictEqual(day.englishSeconds, 900);
console.log('✓ Test 6 passed: English timer RESET verified.');

// TEST 7: Pomodoro Full 3-Phase Cycle Execution
console.log('\nTest 7: Pomodoro Engine 3-Phase Cycle...');
PomodoroModule.category = 'CYBERSECURITY';
PomodoroModule.retrievalDurationMinutes = 3;
const preCyberSecs = StorageService.getDayLog(todayISO).cyberSeconds || 0;

// Trigger full cycle completion
PomodoroModule.completeFullCycle();
const postCyberSecs = StorageService.getDayLog(todayISO).cyberSeconds;
assert.strictEqual(postCyberSecs, preCyberSecs + 1500, 'Pomodoro completion must add strictly 25m (+1500s) to Cyber');

const pomoHistory = StorageService.getPomodoroSessions();
assert.strictEqual(pomoHistory.length, 1);
assert.strictEqual(pomoHistory[0].status, 'COMPLETED');
assert.strictEqual(pomoHistory[0].category, 'CYBERSECURITY');
console.log('✓ Test 7 passed: Full Pomodoro cycle correctly contributed +25m to Cyber and logged session.');

// TEST 8: Appearance / Theme switching
console.log('\nTest 8: Theme mode application (Dark, Light, System)...');
StorageService.saveSettings({ theme: 'light' });
SettingsModule.applyCurrentTheme();
assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'light');

StorageService.saveSettings({ theme: 'dark' });
SettingsModule.applyCurrentTheme();
assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'dark');
console.log('✓ Test 8 passed: Theme modes verified.');

console.log('\n======================================================');
console.log('🎉 ALL 8 DOM & MODULE INTEGRATION TESTS PASSED 100%!');
console.log('======================================================');
