/**
 * BATMAN — Notification Service
 * Manages browser notifications and active scheduling for:
 * - 5 Daily Prayers
 * - Gym Workouts
 * - English Practice
 * - Sleep Wind-Down
 */

const NotificationService = {
  checkInterval: null,
  notifiedToday: {}, // Tracks keys already notified today to prevent spam

  init() {
    this.startScheduler();
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      UI.showToast('Notifications not supported in this browser', 'info');
      return false;
    }

    if (Notification.permission === 'granted') {
      UI.showToast('Notifications are already active', 'success');
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        UI.showToast('Notifications enabled successfully', 'success');
        this.notify('BATMAN Command Center', 'Strict discipline notifications are now active.');
        return true;
      } else {
        UI.showToast('Notification permission denied', 'info');
        return false;
      }
    } catch (e) {
      console.warn('[Notification] Permission error:', e);
      return false;
    }
  },

  /**
   * Schedule interval check every 30 seconds
   */
  startScheduler() {
    if (this.checkInterval) clearInterval(this.checkInterval);

    this.checkInterval = setInterval(() => {
      this.checkScheduledAlerts();
    }, 30000); // Check every 30s
  },

  checkScheduledAlerts() {
    const settings = StorageService.getSettings();
    if (settings.notificationsEnabled === false) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const todayISO = DateUtils.getTodayISO(now);
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dayOfWeek = now.getDay();

    // 1. Prayer Notifications
    const prayerTimes = PrayerService.getPrayerTimes(now);
    const prayerList = [
      { key: 'fajr', name: 'Fajr', time: prayerTimes.fajr },
      { key: 'dhuhr', name: 'Dhuhr', time: prayerTimes.dhuhr },
      { key: 'asr', name: 'Asr', time: prayerTimes.asr },
      { key: 'maghrib', name: 'Maghrib', time: prayerTimes.maghrib },
      { key: 'isha', name: 'Isha', time: prayerTimes.isha }
    ];

    prayerList.forEach(p => {
      const notifKey = `${todayISO}-prayer-${p.key}`;
      if (currentHHMM === p.time && !this.notifiedToday[notifKey]) {
        this.notifiedToday[notifKey] = true;
        this.notify(`${p.name.toUpperCase()} PRAYER`, `It is now time for ${p.name} (${DateUtils.format12Hour(p.time)}). Pray on time.`);
      }
    });

    // 2. Routine Notifications (Gym, English, Sleep)
    const routines = StorageService.getRoutines();
    routines.forEach(r => {
      if (!r.isActive || (r.days && !r.days.includes(dayOfWeek))) return;

      let scheduleTime = r.time;
      if (r.anchor === 'prayer-fajr') scheduleTime = prayerTimes.fajr;
      else if (r.anchor === 'prayer-dhuhr') scheduleTime = prayerTimes.dhuhr;
      else if (r.anchor === 'prayer-asr') scheduleTime = prayerTimes.asr;
      else if (r.anchor === 'prayer-maghrib') scheduleTime = prayerTimes.maghrib;
      else if (r.anchor === 'prayer-isha') scheduleTime = prayerTimes.isha;

      const notifKey = `${todayISO}-routine-${r.id}`;
      if (currentHHMM === scheduleTime && !this.notifiedToday[notifKey]) {
        this.notifiedToday[notifKey] = true;

        if (r.id.includes('gym')) {
          this.notify('GYM', 'Scheduled now. Build a stronger body.');
        } else if (r.id.includes('english')) {
          this.notify('ENGLISH', 'Scheduled now. 30 minutes of communication practice.');
        } else if (r.id.includes('sleep') || r.id.includes('review')) {
          this.notify('SLEEP', 'Begin winding down. Aim for 7.5 hours of recovery.');
        } else {
          this.notify('SCHEDULED ACTIVITY', `${r.name} starts now (${DateUtils.format12Hour(scheduleTime)}).`);
        }
      }
    });
  },

  /**
   * Display notification via ServiceWorker or Notification API
   */
  async notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(`BATMAN: ${title}`, {
          body,
          icon: 'assets/icons/icon.svg',
          badge: 'assets/icons/icon.svg',
          vibrate: [200, 100, 200],
          tag: title
        });
      } else {
        new Notification(`BATMAN: ${title}`, {
          body,
          icon: 'assets/icons/icon.svg'
        });
      }
    } catch (e) {
      console.warn('[Notification] Failed to display notification:', e);
    }
  }
};

if (typeof window !== 'undefined') {
  window.NotificationService = NotificationService;
}
