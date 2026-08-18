/**
 * BATMAN — Reviews Module (Daily Reflection & Weekly Summary with Trend Detection)
 */

const ReviewsModule = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const dailyBtn = document.getElementById('open-daily-review-btn');
    const weeklyBtn = document.getElementById('open-weekly-review-btn');

    if (dailyBtn) dailyBtn.addEventListener('click', () => this.openDailyReviewModal());
    if (weeklyBtn) weeklyBtn.addEventListener('click', () => this.openWeeklyReviewModal());
  },

  openDailyReviewModal() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const existing = log.review || {};

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
          Daily Pillar Ratings (1 - 5)
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4);">
          <div>
            <span class="form-label" style="margin-bottom: 4px;">Deen & Islamic Practice</span>
            <div class="rating-group" data-field="deenRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${existing.deenRating === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">Cybersecurity Focus</span>
            <div class="rating-group" data-field="cyberRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${existing.cyberRating === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">English Practice</span>
            <div class="rating-group" data-field="englishRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${existing.englishRating === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">Fitness & Body</span>
            <div class="rating-group" data-field="fitnessRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${existing.fitnessRating === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">Energy & Discipline</span>
            <div class="rating-group" data-field="energyRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${existing.energyRating === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">What went well today?</label>
          <textarea id="rev-went-well" class="form-textarea" placeholder="Wins and disciplined execution...">${existing.whatWentWell || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">What went wrong / friction?</label>
          <textarea id="rev-went-wrong" class="form-textarea" placeholder="Distractions or missed targets...">${existing.whatWentWrong || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">What will I improve tomorrow?</label>
          <textarea id="rev-improve" class="form-textarea" placeholder="Concrete single adjustment...">${existing.whatToImprove || ''}</textarea>
        </div>

        <button id="save-daily-review-btn" class="btn btn-primary btn-block">Save Daily Review</button>
      </div>
    `;

    // Handle rating button taps
    container.querySelectorAll('.rating-group').forEach(group => {
      group.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          UI.vibrate(8);
        });
      });
    });

    container.querySelector('#save-daily-review-btn').addEventListener('click', () => {
      const getRating = (field) => {
        const active = container.querySelector(`.rating-group[data-field="${field}"] .rating-btn.active`);
        return active ? parseInt(active.getAttribute('data-val'), 10) : 3;
      };

      const reviewData = {
        deenRating: getRating('deenRating'),
        cyberRating: getRating('cyberRating'),
        englishRating: getRating('englishRating'),
        fitnessRating: getRating('fitnessRating'),
        energyRating: getRating('energyRating'),
        whatWentWell: ValidationUtils.sanitizeText(container.querySelector('#rev-went-well').value),
        whatWentWrong: ValidationUtils.sanitizeText(container.querySelector('#rev-went-wrong').value),
        whatToImprove: ValidationUtils.sanitizeText(container.querySelector('#rev-improve').value),
        completedAt: DateUtils.getNowISO()
      };

      StorageService.saveDayLog(todayISO, { review: reviewData });
      UI.closeSheet();
      UI.showToast('Daily Review Saved', 'success');
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('End-of-Day Review', container);
  },

  openWeeklyReviewModal() {
    const weekStart = DateUtils.getWeekStartISO();
    const past7Days = DateUtils.getPastDaysISO(7);
    const allLogs = StorageService.getDayLogs();

    let totalCyberSecs = 0;
    let totalEnglishSecs = 0;
    let totalGymSessions = 0;
    let totalSleepSum = 0;
    let sleepDaysCount = 0;
    let totalMasjidPrayers = 0;
    let totalPrayersCompleted = 0;

    past7Days.forEach(d => {
      const log = allLogs[d];
      if (log) {
        totalCyberSecs += (log.cyberSeconds || 0);
        totalEnglishSecs += (log.englishSeconds || 0);
        if (log.gymAttended) totalGymSessions++;
        if (log.sleepHours) {
          totalSleepSum += parseFloat(log.sleepHours);
          sleepDaysCount++;
        }
        if (log.prayers) {
          ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
            if (log.prayers[p] && log.prayers[p].status === 'COMPLETED') {
              totalPrayersCompleted++;
              if (log.prayers[p].location === 'MASJID') totalMasjidPrayers++;
            }
          });
        }
      }
    });

    const cyberHours = (totalCyberSecs / 3600).toFixed(1);
    const englishHours = (totalEnglishSecs / 3600).toFixed(1);
    const avgSleep = sleepDaysCount > 0 ? (totalSleepSum / sleepDaysCount).toFixed(1) : '--';
    const masjidPct = totalPrayersCompleted > 0 ? Math.round((totalMasjidPrayers / totalPrayersCompleted) * 100) : 0;

    // Automated simple trend detection
    const trends = [];
    if (parseFloat(cyberHours) >= 20) {
      trends.push('✅ Cybersecurity deep work hit strong weekly target (>20h).');
    } else if (parseFloat(cyberHours) < 14) {
      trends.push('⚠️ Cybersecurity volume is below weekly target.');
    }

    if (sleepDaysCount > 0 && parseFloat(avgSleep) < 7.0) {
      trends.push('⚠️ 7-Day sleep average is below 7h — recovery warning active.');
    }

    if (totalGymSessions >= 4) {
      trends.push('✅ Gym target achieved (4/4 sessions).');
    }

    const reviews = StorageService.getWeeklyReviews();
    const existing = reviews[weekStart] || {};

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div class="metric-grid" style="margin-bottom: var(--space-3);">
          <div class="metric-box">
            <div class="metric-label">Cyber Total</div>
            <div class="metric-value">${cyberHours}h</div>
            <div class="metric-subtext">Target: 28h</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">English Total</div>
            <div class="metric-value">${englishHours}h</div>
            <div class="metric-subtext">Target: 3.5h</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Gym Sessions</div>
            <div class="metric-value">${totalGymSessions} / 4</div>
            <div class="metric-subtext">Weekly Target</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Masjid Rate</div>
            <div class="metric-value">${masjidPct}%</div>
            <div class="metric-subtext">${totalMasjidPrayers} of ${totalPrayersCompleted}</div>
          </div>
        </div>

        ${trends.length > 0 ? `
          <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3);">
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">AUTOMATED TREND INSIGHTS</div>
            ${trends.map(t => `<div style="font-size: var(--text-xs); margin-bottom: 2px;">${t}</div>`).join('')}
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">Biggest Win This Week</label>
          <textarea id="week-win" class="form-textarea" placeholder="Top milestone or victory...">${existing.biggestWin || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Biggest Problem / Bottleneck</label>
          <textarea id="week-problem" class="form-textarea" placeholder="Primary obstacle encountered...">${existing.biggestProblem || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Next Week's #1 Priority</label>
          <input type="text" id="week-priority" class="form-input" placeholder="Primary focus objective..." value="${existing.nextPriority || ''}">
        </div>

        <button id="save-weekly-review-btn" class="btn btn-primary btn-block">Save Weekly Review</button>
      </div>
    `;

    container.querySelector('#save-weekly-review-btn').addEventListener('click', () => {
      const reviewData = {
        cyberHours,
        englishHours,
        gymCount: totalGymSessions,
        avgSleep,
        masjidPct,
        biggestWin: ValidationUtils.sanitizeText(container.querySelector('#week-win').value),
        biggestProblem: ValidationUtils.sanitizeText(container.querySelector('#week-problem').value),
        nextPriority: ValidationUtils.sanitizeText(container.querySelector('#week-priority').value)
      };

      StorageService.saveWeeklyReview(weekStart, reviewData);
      UI.closeSheet();
      UI.showToast('Weekly Review Saved', 'success');
    });

    UI.openSheet('Weekly Summary & Reflection', container);
  }
};

if (typeof window !== 'undefined') {
  window.ReviewsModule = ReviewsModule;
}
