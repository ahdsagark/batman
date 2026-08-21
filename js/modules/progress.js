/**
 * BATMAN — Progress & Transparent Scoring Module
 * Features multi-period filtering (Today, This Week, This Month, 9-Month Overview),
 * discipline streaks, Quran memorization breakdown, centralized life analytics,
 * and responsive SVG charts including Historical Body Weight Progression.
 */

const ProgressModule = {
  activePeriod: 'week', // 'today' | 'week' | 'month' | 'overview'

  init() {
    this.renderProgress();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'progress') this.renderProgress();
    });

    window.addEventListener('batman:data-updated', () => {
      this.renderProgress();
    });
  },

  bindEvents() {
    const periodButtons = document.querySelectorAll('#view-progress .segmented-option');
    periodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        periodButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activePeriod = btn.getAttribute('data-period');
        UI.vibrate(8);
        this.renderProgress();
      });
    });
  },

  renderProgress() {
    const allLogs = StorageService.getDayLogs();
    const todayISO = DateUtils.getTodayISO();
    const todayLog = StorageService.getDayLog(todayISO);

    // Determine evaluation window
    let daysToEvaluate = [];
    if (this.activePeriod === 'today') {
      daysToEvaluate = [todayISO];
    } else if (this.activePeriod === 'week') {
      daysToEvaluate = DateUtils.getPastDaysISO(7).reverse(); // chronological
    } else if (this.activePeriod === 'month') {
      daysToEvaluate = DateUtils.getPastDaysISO(30).reverse();
    } else if (this.activePeriod === 'overview') {
      daysToEvaluate = DateUtils.getPastDaysISO(270).reverse(); // 9-Month transformation
    }

    // Use Centralized Analytics Service
    const metrics = AnalyticsService.getAggregatedMetrics(daysToEvaluate);

    let deenScoreSum = 0;
    let cyberScoreSum = 0;
    let englishScoreSum = 0;
    let fitnessScoreSum = 0;
    let sleepScoreSum = 0;
    let validDays = 0;

    daysToEvaluate.forEach(dateStr => {
      const log = allLogs[dateStr] || (dateStr === todayISO ? todayLog : null);
      if (log) {
        validDays++;
        deenScoreSum += CalcUtils.calculateDeenScore(log);
        cyberScoreSum += CalcUtils.calculateCyberScore(log.cyberSeconds || 0);
        englishScoreSum += CalcUtils.calculateEnglishScore(log.englishSeconds || 0);
        fitnessScoreSum += (log.gymStatus === 'DONE' || log.gymAttended === true) ? 100 : 0;
        sleepScoreSum += CalcUtils.calculateSleepScore(log.sleepHours || 0);
      }
    });

    const divisor = Math.max(1, validDays);
    const avgDeen = validDays > 0 ? Math.round(deenScoreSum / divisor) : 0;
    const avgCyber = validDays > 0 ? Math.round(cyberScoreSum / divisor) : 0;
    const avgEnglish = validDays > 0 ? Math.round(englishScoreSum / divisor) : 0;
    const avgFitness = validDays > 0 ? Math.round(fitnessScoreSum / divisor) : 0;
    const avgSleep = validDays > 0 ? Math.round(sleepScoreSum / divisor) : 0;

    this.updateBar('score-deen-val', 'score-deen-bar', avgDeen);
    this.updateBar('score-cyber-val', 'score-cyber-bar', avgCyber);
    this.updateBar('score-english-val', 'score-english-bar', avgEnglish);
    this.updateBar('score-fitness-val', 'score-fitness-bar', avgFitness);
    this.updateBar('score-sleep-val', 'score-sleep-bar', avgSleep);

    // 2. Streaks
    const pastDaysForStreaks = DateUtils.getPastDaysISO(90);
    const tahajjudStreak = CalcUtils.calculateStreak(pastDaysForStreaks, (d) => allLogs[d] && (allLogs[d].tahajjud === 'PRAYED' || allLogs[d].tahajjud === 'COMPLETED'));
    const cyberStreak = CalcUtils.calculateStreak(pastDaysForStreaks, (d) => allLogs[d] && (allLogs[d].cyberSeconds || 0) >= 3600);
    const englishStreak = CalcUtils.calculateStreak(pastDaysForStreaks, (d) => allLogs[d] && (allLogs[d].englishSeconds || 0) >= 900);
    const quranStreak = CalcUtils.calculateStreak(pastDaysForStreaks, (d) => allLogs[d] && (allLogs[d].quranTafsir === 'COMPLETED' || (allLogs[d].quranMemoCount || 0) > 0 || allLogs[d].quranRecitation === 'COMPLETED'));

    const sTahajjud = document.getElementById('streak-tahajjud');
    const sCyber = document.getElementById('streak-cyber');
    const sEnglish = document.getElementById('streak-english');
    const sQuran = document.getElementById('streak-quran');

    if (sTahajjud) sTahajjud.textContent = `${tahajjudStreak} day${tahajjudStreak === 1 ? '' : 's'}`;
    if (sCyber) sCyber.textContent = `${cyberStreak} day${cyberStreak === 1 ? '' : 's'}`;
    if (sEnglish) sEnglish.textContent = `${englishStreak} day${englishStreak === 1 ? '' : 's'}`;
    if (sQuran) sQuran.textContent = `${quranStreak} day${quranStreak === 1 ? '' : 's'}`;

    // 3. Render Quran Memorization Mastery Card
    this.renderQuranProgress();

    // 4. Render Historical Body Weight Chart & Metrics
    const weightProgression = AnalyticsService.getWeightProgression(30);

    // 5. Render Totals and SVG Charts
    const summaryContainer = document.getElementById('progress-summary-content');
    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="metric-grid" style="margin-bottom: var(--space-4);">
          <div class="metric-box">
            <div class="metric-label">Focused Cyber</div>
            <div class="metric-value">${metrics.totalCyberHoursFormatted}</div>
            <div class="metric-subtext">${validDays} day(s) evaluated</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">English Practice</div>
            <div class="metric-value">${metrics.totalEnglishFormatted}</div>
            <div class="metric-subtext">${validDays} day(s) evaluated</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Gym Workouts</div>
            <div class="metric-value">${metrics.gymDoneCount}</div>
            <div class="metric-subtext">Total attended</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Masjid Prayer Rate</div>
            <div class="metric-value">${metrics.masjidPct}%</div>
            <div class="metric-subtext">${metrics.masjidPrayersCount} prayers in masjid</div>
          </div>
        </div>

        <!-- SVG Micro-Charts -->
        <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
            <span>CYBERSECURITY HOURS</span>
            <span style="color: var(--accent-primary);">Target: 4h / day</span>
          </div>
          ${this.renderBarChartSVG(metrics.timeSeries.cyberHours, 4.0, 'h')}
        </div>

        <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
            <span>SLEEP RESTORATION</span>
            <span style="color: var(--status-success);">Target: 7.5h</span>
          </div>
          ${this.renderLineChartSVG(metrics.timeSeries.sleepHours, 7.5, 'h')}
        </div>

        <!-- Historical Body Weight Chart -->
        <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
            <span>BODY WEIGHT PROGRESSION</span>
            <span style="color: var(--accent-primary);">Target: ${weightProgression.targetWeight} kg</span>
          </div>
          ${this.renderWeightChartSVG(weightProgression.records, weightProgression.targetWeight)}
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            <span>Initial: ${weightProgression.initialWeight} kg</span>
            <span>Current: <strong>${weightProgression.currentWeight} kg</strong></span>
            <span>Delta: <strong style="color: var(--status-success);">+${weightProgression.weightGainKg} kg</strong></span>
          </div>
        </div>
      `;
    }
  },

  renderQuranProgress() {
    const settings = StorageService.getSettings();
    const surahProgress = settings.surahProgress || {};
    const activeNumber = parseInt(settings.activeSurahNumber, 10) || 67;
    const activeSurah = (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.SURAHS))
      ? (CONFIG.SURAHS.find(s => s.number === activeNumber) || { number: 67, name: 'Al-Mulk', verses: 30 })
      : { number: 67, name: 'Al-Mulk', verses: 30 };

    let totalVersesMemorized = 0;
    let completedSurahsCount = 0;
    const completedSurahsList = [];
    const inProgressSurahsList = [];

    if (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.SURAHS)) {
      CONFIG.SURAHS.forEach(s => {
        const rawDone = surahProgress[s.number];
        const done = typeof rawDone === 'number' ? rawDone : (parseInt(rawDone, 10) || 0);
        if (done > 0 && typeof s.verses === 'number' && s.verses > 0) {
          const validDone = Math.min(s.verses, done);
          totalVersesMemorized += validDone;
          if (validDone >= s.verses) {
            completedSurahsCount++;
            completedSurahsList.push(s);
          } else {
            inProgressSurahsList.push({ ...s, done: validDone });
          }
        }
      });
    }

    const badgeEl = document.getElementById('progress-quran-total-verses');
    if (badgeEl) {
      badgeEl.textContent = `${totalVersesMemorized} Verse${totalVersesMemorized === 1 ? '' : 's'}`;
    }

    const container = document.getElementById('progress-quran-memorization-content');
    if (!container) return;

    const rawActiveDone = surahProgress[activeNumber] !== undefined ? surahProgress[activeNumber] : (settings.activeSurahCompletedVerses || 0);
    const activeDone = Math.max(0, Math.min(activeSurah.verses, parseInt(rawActiveDone, 10) || 0));
    const activePct = activeSurah.verses > 0 ? Math.round((activeDone / activeSurah.verses) * 100) : 0;
    const isActiveCompleted = activeDone >= activeSurah.verses && activeSurah.verses > 0;

    container.innerHTML = `
      <!-- Active Surah Progress -->
      <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Active Surah</span>
            <div style="font-size: var(--text-sm); font-weight: 800; color: var(--text-primary);">${activeSurah.number}. ${activeSurah.name}</div>
          </div>
          <span class="badge ${isActiveCompleted ? 'badge-masjid' : 'badge-neutral'}" style="font-size: 11px;">
            ${isActiveCompleted ? '100% Completed ✓' : `${activeDone} / ${activeSurah.verses} (${activePct}%)`}
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${isActiveCompleted ? 'success' : ''}" style="width: ${activePct}%;"></div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="metric-grid" style="margin-bottom: var(--space-3);">
        <div class="metric-box">
          <div class="metric-label">Verses Memorized</div>
          <div class="metric-value">${totalVersesMemorized}</div>
          <div class="metric-subtext">Across all Surahs</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Surahs Completed</div>
          <div class="metric-value" style="color: var(--status-success);">${completedSurahsCount}</div>
          <div class="metric-subtext">${completedSurahsCount === 1 ? 'Surah' : 'Surahs'} 100% Done</div>
        </div>
      </div>

      <!-- Surah Status List / Chips -->
      ${completedSurahsList.length > 0 ? `
        <div style="margin-bottom: var(--space-3);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Completed Surahs (100%)</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${completedSurahsList.map(s => `
              <span class="badge badge-masjid" style="font-size: 11px; padding: 4px 8px;">
                ✓ Surah ${s.name} (${s.verses}v)
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${inProgressSurahsList.length > 0 ? `
        <div style="margin-bottom: var(--space-3);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">In Progress</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${inProgressSurahsList.map(s => `
              <span class="badge badge-neutral" style="font-size: 11px; padding: 4px 8px;">
                ${s.name}: ${s.done}/${s.verses}v (${Math.round((s.done / s.verses) * 100)}%)
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${totalVersesMemorized === 0 ? `
        <div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 6px 0;">
          No memorized verses logged yet. Tap <strong>+</strong> under the Deen tab to start your daily 3 verses!
        </div>
      ` : `
        <div style="text-align: right; margin-top: var(--space-2);">
          <button id="btn-reset-quran-progress" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 2px 8px; color: var(--text-muted);">
            Reset Qur'an Counts
          </button>
        </div>
      `}
    `;

    const resetBtn = container.querySelector('#btn-reset-quran-progress');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset all Quran memorization counts back to 0?')) {
          StorageService.resetQuranProgress();
          UI.showToast('Quran memorization progress reset to 0', 'info');
          this.renderQuranProgress();
          if (window.QuranModule && window.QuranModule.renderQuran) {
            window.QuranModule.renderQuran();
          }
          window.dispatchEvent(new CustomEvent('batman:data-updated'));
        }
      });
    }
  },

  updateBar(valId, barId, percentage) {
    const valEl = document.getElementById(valId);
    const barEl = document.getElementById(barId);
    if (valEl) valEl.textContent = `${percentage}%`;
    if (barEl) {
      barEl.style.width = `${percentage}%`;
      barEl.className = percentage >= 80 ? 'progress-fill success' : 'progress-fill';
    }
  },

  renderBarChartSVG(series, targetVal = 4, unit = '') {
    if (!series || series.length === 0) return '<div class="prayer-time">No data</div>';

    const maxVal = Math.max(targetVal * 1.2, ...series.map(s => s.val || 0), 1);
    const height = 80;
    const width = 360;
    const barWidth = Math.max(6, Math.min(24, Math.floor((width - (series.length * 6)) / series.length)));
    const gap = (width - (series.length * barWidth)) / (series.length + 1);

    const targetY = height - (targetVal / maxVal) * (height - 15);

    let bars = '';
    series.forEach((s, i) => {
      const barH = ((s.val || 0) / maxVal) * (height - 15);
      const x = gap + i * (barWidth + gap);
      const y = height - barH;
      const isTargetMet = (s.val || 0) >= targetVal;

      bars += `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" 
              fill="${isTargetMet ? 'var(--status-success)' : 'var(--accent-primary)'}" opacity="0.9" />
      `;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 80px; overflow: visible;">
        <line x1="0" y1="${targetY}" x2="${width}" y2="${targetY}" stroke="var(--border-strong)" stroke-dasharray="3,3" stroke-width="1.5" />
        ${bars}
      </svg>
    `;
  },

  renderLineChartSVG(series, targetVal = 7.5, unit = '') {
    if (!series || series.length < 2) {
      return '<div class="prayer-time" style="padding: 10px 0;">Log records to see trend line</div>';
    }

    const height = 80;
    const width = 360;
    const padding = 10;
    const maxVal = Math.max(targetVal * 1.25, ...series.map(s => s.val || 0), 1);
    const minVal = Math.min(targetVal * 0.6, ...series.map(s => s.val || 0), 0);

    const points = series.map((s, i) => {
      const x = padding + (i / (series.length - 1)) * (width - 2 * padding);
      const normalized = ((s.val || 0) - minVal) / (maxVal - minVal);
      const y = height - padding - (normalized * (height - 2 * padding));
      return `${x},${y}`;
    }).join(' ');

    const targetY = height - padding - (((targetVal - minVal) / (maxVal - minVal)) * (height - 2 * padding));

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 80px; overflow: visible;">
        <line x1="0" y1="${targetY}" x2="${width}" y2="${targetY}" stroke="var(--status-success)" stroke-dasharray="3,3" stroke-width="1.5" />
        <polyline fill="none" stroke="var(--status-info)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      </svg>
    `;
  },

  /**
   * Generates SVG line graph for Historical Body Weight Progression
   */
  renderWeightChartSVG(records, targetWeight = 70.0) {
    if (!records || records.length === 0) {
      return '<div class="prayer-time" style="padding: 10px 0;">Log weight entries under Fitness to view your transformation curve</div>';
    }

    const height = 90;
    const width = 360;
    const padding = 12;

    const weights = records.map(r => r.weightKg);
    const maxW = Math.max(targetWeight + 2, ...weights);
    const minW = Math.min(58, ...weights);

    const points = records.map((r, i) => {
      const x = records.length === 1 ? width / 2 : padding + (i / (records.length - 1)) * (width - 2 * padding);
      const normalized = (r.weightKg - minW) / (maxW - minW);
      const y = height - padding - (normalized * (height - 2 * padding));
      return `${x},${y}`;
    }).join(' ');

    const targetY = height - padding - (((targetWeight - minW) / (maxW - minW)) * (height - 2 * padding));

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 90px; overflow: visible;">
        <!-- Target 70kg Line -->
        <line x1="0" y1="${targetY}" x2="${width}" y2="${targetY}" stroke="var(--status-success)" stroke-dasharray="4,4" stroke-width="1.5" />
        <text x="${width - 8}" y="${targetY - 4}" fill="var(--status-success)" font-size="10" font-weight="700" text-anchor="end">${targetWeight} kg Target</text>

        <!-- Progression Line & Points -->
        <polyline fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
        ${records.map((r, i) => {
          const x = records.length === 1 ? width / 2 : padding + (i / (records.length - 1)) * (width - 2 * padding);
          const normalized = (r.weightKg - minW) / (maxW - minW);
          const y = height - padding - (normalized * (height - 2 * padding));
          return `
            <circle cx="${x}" cy="${y}" r="4" fill="var(--accent-primary)" />
            <text x="${x}" y="${y - 8}" fill="var(--text-primary)" font-size="9" font-family="var(--font-mono)" font-weight="700" text-anchor="middle">${r.weightKg}k</text>
          `;
        }).join('')}
      </svg>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.ProgressModule = ProgressModule;
}
