/**
 * BATMAN — Reviews & Commitments Module
 * Handles End-of-Day Review (21:30), Tomorrow's Commitments,
 * Sunday Weekly Review (20:00) with Week-over-Week comparative metrics & immutable historical snapshots,
 * and Monthly Learning Goals.
 */

const ReviewsModule = {
  init() {
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'more') this.renderMoreTabReviews();
    });
  },

  bindEvents() {
    const dailyBtn = document.getElementById('open-daily-review-btn');
    const weeklyBtn = document.getElementById('open-weekly-review-btn');
    const monthlyGoalBtn = document.getElementById('open-monthly-goal-btn');
    const historyWeeklyBtn = document.getElementById('open-weekly-history-btn');

    if (dailyBtn) dailyBtn.addEventListener('click', () => this.openDailyReviewModal());
    if (weeklyBtn) weeklyBtn.addEventListener('click', () => this.openWeeklyReviewModal());
    if (monthlyGoalBtn) monthlyGoalBtn.addEventListener('click', () => this.openMonthlyGoalModal());
    if (historyWeeklyBtn) historyWeeklyBtn.addEventListener('click', () => this.openWeeklyHistoryModal());
  },

  renderMoreTabReviews() {
    // Check if current month goal is set
    const currentMonth = DateUtils.getCurrentMonthISO();
    const monthGoal = StorageService.getMonthlyGoal(currentMonth);
    const monthGoalPreview = document.getElementById('monthly-goal-preview-text');

    if (monthGoalPreview) {
      if (monthGoal && monthGoal.goal) {
        monthGoalPreview.textContent = `${DateUtils.formatMonthYear(currentMonth)}: ${monthGoal.goal}`;
      } else {
        monthGoalPreview.textContent = `${DateUtils.formatMonthYear(currentMonth)}: No goal set yet. Tap to set.`;
      }
    }
  },

  // -------------------------------------------------------------
  // DAILY REVIEW & COMMITMENTS (9:30 PM / 21:30 Threshold)
  // -------------------------------------------------------------
  openDailyReviewModal() {
    const todayISO = DateUtils.getTodayISO();
    const tomorrowISO = DateUtils.getTomorrowISO();
    const log = StorageService.getDayLog(todayISO);
    const existing = log.review || {};

    // 1. Fetch Yesterday's Commitments (due today)
    const dueTodayCommitments = StorageService.getCommitmentsForDate(todayISO);

    // 2. Fetch Tomorrow's Commitments already planned
    const tomorrowCommitments = StorageService.getCommitmentsForDate(tomorrowISO);

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <!-- Yesterday's Commitments Evaluation Section -->
        ${dueTodayCommitments.length > 0 ? `
          <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-4); border: 1px solid var(--border-subtle);">
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--accent-primary); text-transform: uppercase; margin-bottom: var(--space-2); letter-spacing: 0.5px;">
              YESTERDAY'S COMMITMENTS (EVALUATION)
            </div>
            <div id="eval-commitments-list">
              ${dueTodayCommitments.map(c => {
                const isCompleted = c.status === 'COMPLETED';
                const isNotCompleted = c.status === 'NOT_COMPLETED';

                // Intelligent Suggestion Check (Non-automatic)
                let suggestion = '';
                const lowerText = c.text.toLowerCase();
                if ((lowerText.includes('cyber') || lowerText.includes('4h')) && (log.cyberSeconds || 0) >= 14400) {
                  suggestion = 'Cybersecurity tracker shows 4h completed. Mark completed?';
                } else if (lowerText.includes('gym') && log.gymStatus === 'DONE') {
                  suggestion = 'Gym tracker shows workout completed. Mark completed?';
                } else if ((lowerText.includes('english') || lowerText.includes('30m')) && (log.englishSeconds || 0) >= 1800) {
                  suggestion = 'English tracker shows 30m completed. Mark completed?';
                } else if (lowerText.includes('verse') && (log.quranMemoCount || 0) >= 3) {
                  suggestion = `Qur'an tracker shows ${log.quranMemoCount} verses memorized. Mark completed?`;
                }

                return `
                  <div style="padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: var(--text-sm); font-weight: 700; color: var(--text-primary);">${c.text}</span>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn ${isCompleted ? 'btn-success' : 'btn-outline'} btn-sm" style="min-height: 32px; padding: 0 8px; font-size: 11px;" onclick="ReviewsModule.setCommitmentStatus('${c.id}', 'COMPLETED')">✓ DONE</button>
                        <button class="btn ${isNotCompleted ? 'btn-danger' : 'btn-outline'} btn-sm" style="min-height: 32px; padding: 0 8px; font-size: 11px;" onclick="ReviewsModule.setCommitmentStatus('${c.id}', 'NOT_COMPLETED')">✗ MISSED</button>
                      </div>
                    </div>
                    ${suggestion && c.status === 'PENDING' ? `
                      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(217, 119, 6, 0.1); padding: 4px 8px; border-radius: var(--radius-sm); margin-top: 4px;">
                        <span style="font-size: 11px; color: var(--accent-primary); font-weight: 600;">💡 ${suggestion}</span>
                        <button class="btn btn-secondary btn-sm" style="font-size: 10px; padding: 2px 6px; min-height: 24px;" onclick="ReviewsModule.setCommitmentStatus('${c.id}', 'COMPLETED')">Accept</button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 5 Pillar Ratings -->
        <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: var(--space-2);">
          Daily Pillar Ratings (1 - 5)
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4);">
          <div>
            <span class="form-label" style="margin-bottom: 4px;">1. Deen & Islamic Practice</span>
            <div class="rating-group" data-field="deenRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${(existing.deenRating || 5) === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">2. Cybersecurity Focus & Deep Work</span>
            <div class="rating-group" data-field="cyberRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${(existing.cyberRating || 5) === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">3. English & Communication</span>
            <div class="rating-group" data-field="englishRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${(existing.englishRating || 5) === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">4. Fitness & Physical Discipline</span>
            <div class="rating-group" data-field="fitnessRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${(existing.fitnessRating || 5) === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>

          <div>
            <span class="form-label" style="margin-bottom: 4px;">5. Energy & Self-Discipline</span>
            <div class="rating-group" data-field="energyRating">
              ${[1, 2, 3, 4, 5].map(n => `<button class="rating-btn ${(existing.energyRating || 5) === n ? 'active' : ''}" data-val="${n}">${n}</button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Before-Sleep Adhkar Toggle (Separate state) -->
        <div class="prayer-row" style="background: var(--bg-surface-elevated); padding: 10px 12px; border-radius: var(--radius-sm); margin-bottom: var(--space-4);">
          <div class="prayer-info">
            <span style="font-weight: 700; color: var(--text-primary);">Before-Sleep Adhkar</span>
            <span class="prayer-time">Night routine completion</span>
          </div>
          <button id="modal-sleep-adhkar-btn" class="btn ${log.sleepAdhkar === 'COMPLETED' ? 'btn-success' : 'btn-secondary'} btn-sm" style="min-height: 36px; min-width: 100px;">
            ${log.sleepAdhkar === 'COMPLETED' ? 'DONE ✓' : 'NOT DONE'}
          </button>
        </div>

        <!-- Written Reflections -->
        <div class="form-group">
          <label class="form-label">What went well today?</label>
          <textarea id="rev-went-well" class="form-textarea" placeholder="Wins and disciplined execution...">${existing.whatWentWell || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">What went wrong / friction?</label>
          <textarea id="rev-went-wrong" class="form-textarea" placeholder="Distractions or missed targets...">${existing.whatWentWrong || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">What should I improve?</label>
          <textarea id="rev-improve" class="form-textarea" placeholder="Concrete single adjustment...">${existing.whatToImprove || ''}</textarea>
        </div>

        <!-- Tomorrow's Commitments Section -->
        <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-4); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <span style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary); text-transform: uppercase;">TOMORROW'S COMMITMENTS</span>
            <span class="prayer-time">${DateUtils.formatMonthDay(tomorrowISO)}</span>
          </div>

          <div id="tomorrow-commitments-list" style="margin-bottom: var(--space-2);">
            ${tomorrowCommitments.map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-subtle); font-size: var(--text-xs);">
                <span style="color: var(--text-primary); font-weight: 600;">• ${c.text}</span>
                <button class="btn btn-outline btn-sm" style="padding: 0 6px; min-height: 24px; font-size: 10px;" onclick="ReviewsModule.removeCommitment('${c.id}')">✕</button>
              </div>
            `).join('')}
          </div>

          <div style="display: flex; gap: 6px;">
            <input type="text" id="new-commitment-input" class="form-input" placeholder="e.g. Complete 4h cyber deep work, attend gym..." style="flex: 1; height: 38px; font-size: var(--text-xs);">
            <button id="add-commitment-btn" class="btn btn-secondary btn-sm" style="min-height: 38px; font-weight: 700; font-size: var(--text-xs); white-space: nowrap;">+ ADD</button>
          </div>
        </div>

        <button id="save-daily-review-btn" class="btn btn-primary btn-block" style="min-height: 48px; font-weight: 700; font-size: var(--text-base);">SAVE DAILY REVIEW</button>
      </div>
    `;

    // Handle ratings
    container.querySelectorAll('.rating-group').forEach(group => {
      group.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          UI.vibrate(8);
        });
      });
    });

    // Handle Before-Sleep Adhkar toggle
    const sleepAdhkarBtn = container.querySelector('#modal-sleep-adhkar-btn');
    if (sleepAdhkarBtn) {
      sleepAdhkarBtn.addEventListener('click', () => {
        const curLog = StorageService.getDayLog(todayISO);
        const next = curLog.sleepAdhkar === 'COMPLETED' ? 'NOT_RECORDED' : 'COMPLETED';
        StorageService.saveDayLog(todayISO, { sleepAdhkar: next });
        sleepAdhkarBtn.textContent = next === 'COMPLETED' ? 'DONE ✓' : 'NOT DONE';
        sleepAdhkarBtn.className = next === 'COMPLETED' ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
        UI.vibrate(10);
      });
    }

    // Handle Add Tomorrow's Commitment
    const addCommitBtn = container.querySelector('#add-commitment-btn');
    const commitInput = container.querySelector('#new-commitment-input');
    if (addCommitBtn && commitInput) {
      addCommitBtn.addEventListener('click', () => {
        const txt = commitInput.value.trim();
        if (!txt) return;
        StorageService.saveCommitment({
          createdDate: todayISO,
          targetDate: tomorrowISO,
          text: txt,
          status: 'PENDING'
        });
        commitInput.value = '';
        UI.showToast('Commitment added for tomorrow', 'success');
        this.openDailyReviewModal();
      });
    }

    // Handle Save Daily Review
    container.querySelector('#save-daily-review-btn').addEventListener('click', () => {
      const getRating = (field) => {
        const active = container.querySelector(`.rating-group[data-field="${field}"] .rating-btn.active`);
        return active ? parseInt(active.getAttribute('data-val'), 10) : 5;
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

    UI.openSheet('Daily Review & Commitments', container);
  },

  setCommitmentStatus(id, status) {
    StorageService.updateCommitmentStatus(id, status);
    UI.showToast(`Commitment marked ${status}`, 'success');
    this.openDailyReviewModal();
  },

  removeCommitment(id) {
    const commitments = StorageService.getCommitments().filter(c => c.id !== id);
    StorageService.safeSetItem(StorageService.KEYS.COMMITMENTS, commitments);
    StorageService.enqueueSync('Commitments', 'DELETE', { id });
    UI.showToast('Commitment removed', 'info');
    this.openDailyReviewModal();
  },

  // -------------------------------------------------------------
  // WEEKLY REVIEW & IMMUTABLE HISTORICAL SNAPSHOTS (Sunday 20:00)
  // -------------------------------------------------------------
  openWeeklyReviewModal() {
    const weekStart = DateUtils.getWeekStartISO();
    const weekEnd = DateUtils.addDaysISO(weekStart, 6);
    const past7Days = DateUtils.getPastDaysISO(7);
    const prior7Days = [];
    const today = new Date();
    for (let i = 7; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      prior7Days.push(DateUtils.getTodayISO(d));
    }

    const allLogs = StorageService.getDayLogs();

    // 1. Current Week Aggregations
    let thisCyber = 0, thisEnglish = 0, thisGym = 0, thisSleepSum = 0, thisSleepDays = 0, thisMasjid = 0, thisPrayers = 0;
    past7Days.forEach(d => {
      const l = allLogs[d];
      if (l) {
        thisCyber += (l.cyberSeconds || 0);
        thisEnglish += (l.englishSeconds || 0);
        if (l.gymStatus === 'DONE' || l.gymAttended === true) thisGym++;
        if (l.sleepHours) { thisSleepSum += parseFloat(l.sleepHours); thisSleepDays++; }
        if (l.prayers) {
          ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
            if (l.prayers[p] && (l.prayers[p].status === 'MASJID' || (l.prayers[p].status === 'COMPLETED' && l.prayers[p].location === 'MASJID'))) {
              thisMasjid++;
              thisPrayers++;
            } else if (l.prayers[p] && (l.prayers[p].status === 'HOME' || l.prayers[p].status === 'COMPLETED')) {
              thisPrayers++;
            }
          });
        }
      }
    });

    // 2. Previous Week Aggregations
    let prevCyber = 0, prevEnglish = 0, prevGym = 0, prevSleepSum = 0, prevSleepDays = 0;
    prior7Days.forEach(d => {
      const l = allLogs[d];
      if (l) {
        prevCyber += (l.cyberSeconds || 0);
        prevEnglish += (l.englishSeconds || 0);
        if (l.gymStatus === 'DONE' || l.gymAttended === true) prevGym++;
        if (l.sleepHours) { prevSleepSum += parseFloat(l.sleepHours); prevSleepDays++; }
      }
    });

    const thisCyberHours = (thisCyber / 3600).toFixed(1);
    const prevCyberHours = (prevCyber / 3600).toFixed(1);
    const cyberDiff = (parseFloat(thisCyberHours) - parseFloat(prevCyberHours)).toFixed(1);

    const thisEngHours = (thisEnglish / 3600).toFixed(1);
    const prevEngHours = (prevEnglish / 3600).toFixed(1);
    const engDiff = (parseFloat(thisEngHours) - parseFloat(prevEngHours)).toFixed(1);

    const thisAvgSleep = thisSleepDays > 0 ? (thisSleepSum / thisSleepDays).toFixed(1) : '--';
    const prevAvgSleep = prevSleepDays > 0 ? (prevSleepSum / prevSleepDays).toFixed(1) : '--';

    const reviews = StorageService.getWeeklyReviews();
    const existing = reviews[weekStart] || {};

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-3); font-weight: 700;">
          WEEK: ${DateUtils.formatMonthDay(weekStart)} – ${DateUtils.formatMonthDay(weekEnd)}
        </div>

        <!-- Week-over-Week Comparison Grid -->
        <div class="metric-grid" style="margin-bottom: var(--space-3);">
          <div class="metric-box">
            <div class="metric-label">Cyber Deep Work</div>
            <div class="metric-value">${thisCyberHours}h</div>
            <div class="metric-subtext" style="color: ${parseFloat(cyberDiff) >= 0 ? 'var(--status-success)' : 'var(--status-danger)'};">
              ${parseFloat(cyberDiff) >= 0 ? `+${cyberDiff}h` : `${cyberDiff}h`} vs prev (${prevCyberHours}h)
            </div>
          </div>

          <div class="metric-box">
            <div class="metric-label">English Practice</div>
            <div class="metric-value">${thisEngHours}h</div>
            <div class="metric-subtext" style="color: ${parseFloat(engDiff) >= 0 ? 'var(--status-success)' : 'var(--status-danger)'};">
              ${parseFloat(engDiff) >= 0 ? `+${engDiff}h` : `${engDiff}h`} vs prev (${prevEngHours}h)
            </div>
          </div>

          <div class="metric-box">
            <div class="metric-label">Gym Sessions</div>
            <div class="metric-value">${thisGym} / 4</div>
            <div class="metric-subtext">${thisGym - prevGym >= 0 ? `+${thisGym - prevGym}` : `${thisGym - prevGym}`} vs prev (${prevGym})</div>
          </div>

          <div class="metric-box">
            <div class="metric-label">Sleep 7d Avg</div>
            <div class="metric-value">${thisAvgSleep}h</div>
            <div class="metric-subtext">Prev: ${prevAvgSleep}h</div>
          </div>
        </div>

        <!-- Written Weekly Reflections -->
        <div class="form-group">
          <label class="form-label">WHAT WENT WELL?</label>
          <textarea id="week-went-well" class="form-textarea" placeholder="Key executions and victories...">${existing.whatWentWell || existing.biggestWin || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">WHAT WENT WRONG / BOTTLENECKS?</label>
          <textarea id="week-went-wrong" class="form-textarea" placeholder="Friction and missed objectives...">${existing.whatWentWrong || existing.biggestProblem || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">BIGGEST ACHIEVEMENT</label>
          <input type="text" id="week-achievement" class="form-input" placeholder="Primary milestone..." value="${existing.biggestAchievement || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">BIGGEST WEAKNESS</label>
          <input type="text" id="week-weakness" class="form-input" placeholder="Habit or trap to eliminate..." value="${existing.biggestWeakness || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">WHAT SHOULD CHANGE NEXT WEEK?</label>
          <textarea id="week-changes" class="form-textarea" placeholder="Concrete systemic adjustments...">${existing.whatToChange || existing.nextPriority || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">NEXT WEEK'S COMMITMENTS</label>
          <textarea id="week-commitments" class="form-textarea" placeholder="e.g. 20h independent cyber, 4 gym sessions, 21 verses...">${existing.nextWeekCommitments || ''}</textarea>
        </div>

        <button id="save-weekly-snapshot-btn" class="btn btn-primary btn-block" style="min-height: 48px; font-weight: 700;">SAVE WEEKLY REVIEW (SNAPSHOT)</button>
      </div>
    `;

    container.querySelector('#save-weekly-snapshot-btn').addEventListener('click', () => {
      const snapshot = {
        cyberHours: thisCyberHours,
        prevCyberHours,
        englishHours: thisEngHours,
        prevEnglishHours,
        gymCount: thisGym,
        prevGymCount: prevGym,
        avgSleep: thisAvgSleep,
        prevAvgSleep,
        masjidPrayers: thisMasjid,
        totalPrayers: thisPrayers,
        whatWentWell: ValidationUtils.sanitizeText(container.querySelector('#week-went-well').value),
        whatWentWrong: ValidationUtils.sanitizeText(container.querySelector('#week-went-wrong').value),
        biggestAchievement: ValidationUtils.sanitizeText(container.querySelector('#week-achievement').value),
        biggestWeakness: ValidationUtils.sanitizeText(container.querySelector('#week-weakness').value),
        whatToChange: ValidationUtils.sanitizeText(container.querySelector('#week-changes').value),
        nextWeekCommitments: ValidationUtils.sanitizeText(container.querySelector('#week-commitments').value)
      };

      StorageService.saveWeeklyReview(weekStart, snapshot);
      UI.closeSheet();
      UI.showToast('Weekly Review Snapshot Saved', 'success');
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Weekly Summary & Snapshot', container);
  },

  // Historical Browser for Past Weekly Reviews
  openWeeklyHistoryModal() {
    const reviews = StorageService.getWeeklyReviews();
    const keys = Object.keys(reviews).sort().reverse();

    const container = document.createElement('div');
    if (keys.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: var(--space-4);">No weekly reviews saved yet.</div>`;
    } else {
      container.innerHTML = `
        <div style="max-height: 60vh; overflow-y: auto;">
          ${keys.map((k, idx) => {
            const r = reviews[k];
            return `
              <div class="card" style="margin-bottom: var(--space-3); border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">Week ${keys.length - idx}</span>
                  <span class="prayer-time">${DateUtils.formatMonthDay(r.weekStartDate)} – ${DateUtils.formatMonthDay(r.weekEndDate || r.weekStartDate)}</span>
                </div>
                <div class="metric-grid" style="margin-bottom: var(--space-2);">
                  <div class="metric-box"><div class="metric-label">Cyber</div><div class="metric-value" style="font-size: var(--text-sm);">${r.cyberHours || 0}h</div></div>
                  <div class="metric-box"><div class="metric-label">English</div><div class="metric-value" style="font-size: var(--text-sm);">${r.englishHours || 0}h</div></div>
                  <div class="metric-box"><div class="metric-label">Gym</div><div class="metric-value" style="font-size: var(--text-sm);">${r.gymCount || 0}/4</div></div>
                  <div class="metric-box"><div class="metric-label">Sleep</div><div class="metric-value" style="font-size: var(--text-sm);">${r.avgSleep || '--'}h</div></div>
                </div>
                ${r.biggestAchievement ? `<div style="font-size: 11px; color: var(--text-primary); margin-bottom: 2px;">🏆 <strong>Win:</strong> ${r.biggestAchievement}</div>` : ''}
                ${r.nextWeekCommitments ? `<div style="font-size: 11px; color: var(--accent-primary);">📌 <strong>Commitments:</strong> ${r.nextWeekCommitments}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    UI.openSheet('Past Weekly Reviews', container);
  },

  // -------------------------------------------------------------
  // MONTHLY LEARNING GOALS & REVIEWS (monthly-YYYY-MM)
  // -------------------------------------------------------------
  openMonthlyGoalModal() {
    const currentMonth = DateUtils.getCurrentMonthISO();
    const existing = StorageService.getMonthlyGoal(currentMonth) || {};

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="margin-bottom: var(--space-4);">
        <div style="font-size: var(--text-xs); color: var(--accent-primary); font-weight: 800; text-transform: uppercase; margin-bottom: var(--space-3);">
          MONTH: ${DateUtils.formatMonthYear(currentMonth)}
        </div>

        <div class="form-group">
          <label class="form-label">What will I learn this month?</label>
          <textarea id="month-goal" class="form-textarea" placeholder="e.g. Active Directory Penetration Testing & Kerberos Exploitation...">${existing.goal || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Why is this important?</label>
          <textarea id="month-reason" class="form-textarea" placeholder="Direct connection to 9-month transformation...">${existing.reason || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">What should I be able to do by the end of the month?</label>
          <textarea id="month-criteria" class="form-textarea" placeholder="Concrete observable capabilities...">${existing.successCriteria || ''}</textarea>
        </div>

        ${existing.goal ? `
          <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-3); margin-top: var(--space-3);">
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); margin-bottom: var(--space-2);">END-OF-MONTH REVIEW</div>
            <div class="form-group">
              <label class="form-label">Month Completion Status</label>
              <select id="month-completed-select" class="form-input">
                <option value="" ${existing.completed === null || existing.completed === undefined ? 'selected' : ''}>In Progress</option>
                <option value="true" ${existing.completed === true ? 'selected' : ''}>Completed ✓</option>
                <option value="false" ${existing.completed === false ? 'selected' : ''}>Not Completed</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">What did I learn / Review?</label>
              <textarea id="month-review" class="form-textarea" placeholder="End of month assessment...">${existing.review || ''}</textarea>
            </div>
          </div>
        ` : ''}

        <button id="save-monthly-goal-btn" class="btn btn-primary btn-block" style="min-height: 48px; font-weight: 700;">SAVE MONTHLY GOAL</button>
      </div>
    `;

    container.querySelector('#save-monthly-goal-btn').addEventListener('click', () => {
      const compSelect = container.querySelector('#month-completed-select');
      let completedVal = null;
      if (compSelect && compSelect.value === 'true') completedVal = true;
      else if (compSelect && compSelect.value === 'false') completedVal = false;

      const reviewInput = container.querySelector('#month-review');

      const data = {
        goal: ValidationUtils.sanitizeText(container.querySelector('#month-goal').value),
        reason: ValidationUtils.sanitizeText(container.querySelector('#month-reason').value),
        successCriteria: ValidationUtils.sanitizeText(container.querySelector('#month-criteria').value),
        completed: completedVal,
        review: reviewInput ? ValidationUtils.sanitizeText(reviewInput.value) : (existing.review || null),
        reviewedAt: completedVal !== null ? DateUtils.getNowISO() : (existing.reviewedAt || null)
      };

      StorageService.saveMonthlyGoal(currentMonth, data);
      UI.closeSheet();
      UI.showToast(`Monthly Goal for ${DateUtils.formatMonthYear(currentMonth)} Saved`, 'success');
      this.renderMoreTabReviews();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    });

    UI.openSheet('Monthly Learning Goal', container);
  }
};

if (typeof window !== 'undefined') {
  window.ReviewsModule = ReviewsModule;
}
