/**
 * BATMAN — Application Orchestrator & Lifecycle Bootstrapper
 */

const App = {
  currentAppDate: '',

  async init() {
    console.log('[BATMAN] Initializing Personal Transformation Command Center...');

    this.currentAppDate = DateUtils.getTodayISO();

    // 1. Initialize Storage Engine
    StorageService.init();

    // 2. Initialize Background Sync Service
    SyncService.init();

    // 3. Initialize Notification Scheduler
    if (window.NotificationService) NotificationService.init();

    // 4. Setup Navigation & Core UI Event Listeners
    this.setupNavigation();
    this.setupHeader();
    this.setupServiceWorker();
    this.setupDateRolloverWatcher();

    // 5. Initialize Feature Modules
    if (window.SettingsModule) SettingsModule.init();
    if (window.DashboardModule) DashboardModule.init();
    if (window.DeenModule) DeenModule.init();
    if (window.QuranModule) QuranModule.init();
    if (window.CyberModule) CyberModule.init();
    if (window.EnglishModule) EnglishModule.init();
    if (window.PomodoroModule) PomodoroModule.init();
    if (window.FitnessModule) FitnessModule.init();
    if (window.SleepModule) SleepModule.init();
    if (window.GoalsModule) GoalsModule.init();
    if (window.ReviewsModule) ReviewsModule.init();
    if (window.ProgressModule) ProgressModule.init();

    // Set today's date in header
    this.updateHeaderDate();

    console.log('[BATMAN] Command Center ready.');
  },

  updateHeaderDate() {
    const dateEl = document.getElementById('today-date-str');
    if (dateEl) {
      dateEl.textContent = DateUtils.formatHeaderDate();
    }
  },

  setupDateRolloverWatcher() {
    // Lightweight check every 30 seconds for midnight rollover
    setInterval(() => {
      const today = DateUtils.getTodayISO();
      if (today !== this.currentAppDate) {
        console.log(`[BATMAN] Midnight Rollover detected: ${this.currentAppDate} -> ${today}`);
        this.currentAppDate = today;
        this.updateHeaderDate();

        // Refresh all day-specific calculations and displays
        if (window.DashboardModule) DashboardModule.renderDashboard();
        if (window.DeenModule) DeenModule.renderDeen();
        if (window.CyberModule) CyberModule.renderCyber();
        if (window.ProgressModule) ProgressModule.renderProgress();

        window.dispatchEvent(new CustomEvent('batman:date-rolled-over', { detail: { date: today } }));
        UI.showToast(`New day: ${DateUtils.formatHeaderDate()}`, 'info', 3500);
      }
    }, 30000);
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.getAttribute('data-view');
        if (view) {
          UI.vibrate(10);
          UI.switchTab(view);
        }
      });
    });

    // Close bottom sheet modal handlers
    const closeBtn = document.getElementById('sheet-close-btn');
    const backdrop = document.getElementById('sheet-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', () => UI.closeSheet());
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) UI.closeSheet();
      });
    }
  },

  setupHeader() {
    const syncStatusEl = document.getElementById('sync-status');
    if (syncStatusEl) {
      syncStatusEl.addEventListener('click', () => {
        SyncService.syncNow(true);
      });
    }
  },

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
          .then(reg => {
            console.log('[SW] ServiceWorker registered successfully:', reg.scope);
          })
          .catch(err => {
            console.warn('[SW] ServiceWorker registration failed:', err);
          });
      });
    }
  }
};

if (typeof window !== 'undefined') {
  window.App = App;
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
