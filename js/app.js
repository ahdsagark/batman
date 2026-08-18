/**
 * BATMAN — Application Orchestrator & Lifecycle Bootstrapper
 */

const App = {
  async init() {
    console.log('[BATMAN] Initializing Personal Transformation Command Center...');

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

    // 4. Initialize Feature Modules
    if (window.SettingsModule) SettingsModule.init();
    if (window.DashboardModule) DashboardModule.init();
    if (window.DeenModule) DeenModule.init();
    if (window.QuranModule) QuranModule.init();
    if (window.CyberModule) CyberModule.init();
    if (window.EnglishModule) EnglishModule.init();
    if (window.FitnessModule) FitnessModule.init();
    if (window.SleepModule) SleepModule.init();
    if (window.GoalsModule) GoalsModule.init();
    if (window.ReviewsModule) ReviewsModule.init();
    if (window.ProgressModule) ProgressModule.init();

    // Set today's date in header
    const dateEl = document.getElementById('today-date-str');
    if (dateEl) {
      dateEl.textContent = DateUtils.formatHeaderDate();
    }

    console.log('[BATMAN] Command Center ready.');
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
        navigator.serviceWorker.register('./service-worker.js')
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

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
