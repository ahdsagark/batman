/**
 * BATMAN — Progress & Transparent Scoring Module
 * Features period filtering (Today, This Week, This Month, 9-Month Overview),
 * discipline streaks, score breakdowns, and responsive SVG micro-charts.
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

    let deenScoreSum = 0;
    let cyberScoreSum = 0;
    let englishScoreSum = 0;
    let fitnessScoreSum = 0;
    let sleepScoreSum = 0;
    let validDays = 0;

    let totalCyberSeconds = 0;
    let totalEnglishSeconds = 0;
    let totalGymCount = 0;

    // Series arrays for SVG charts
    const cyberSeries = [];
    const englishSeries = [];
    const weightSeries = [];
    const sleepSeries = [];

    daysToEvaluate.forEach(dateStr => {
      const log = allLogs[dateStr] || (dateStr === todayISO ? todayLog : null);
      const cSecs = log ? (log.cyberSeconds || 0) : 0;
      const eSecs = log ? (log.englishSeconds || 0) : 0;
      const wKg = log && log.weightKg ? log.weightKg : null;
      const sHours = log && log.sleepHours ? parseFloat(log.sleepHours) : null;

      cyberSeries.push({ date: dateStr, val: Math.round((cSecs / 3600) * 10) / 10 });
      englishSeries.push({ date: dateStr, val: Math.round(eSecs / 60) });
      if (wKg) weightSeries.push({ date: dateStr, val: wKg });
      if (sHours) sleepSeries.push({ date: dateStr, val: sHours });

      if (log) {
        validDays++;
        deenScoreSum += CalcUtils.calculateDeenScore(log);
        cyberScoreSum += CalcUtils.calculateCyberScore(log.cyberSeconds || 0);
        englishScoreSum += CalcUtils.calculateEnglishScore(log.englishSeconds || 0);
        fitnessScoreSum += log.gymAttended ? 100 : 0;
        sleepScoreSum += CalcUtils.calculateSleepScore(log.sleepHours || 0);

        totalCyberSeconds += cSecs;
        totalEnglishSeconds += eSecs;
        if (log.gymAttended) totalGymCount++;
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
    const tahajjudStreak = CalcUtils.calculateStreak(pastDaysForStreaks, (d) => allLogs[d] && allLogs[d].tahajjud === 'COMPLETED');
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

    // 3. Render Totals and SVG Micro-Charts
    const summaryContainer = document.getElementById('progress-summary-content');
    if (summaryContainer) {
      const hasAnyData = validDays > 0 && (totalCyberSeconds > 0 || totalEnglishSeconds > 0 || totalGymCount > 0 || sleepScoreSum > 0 || deenScoreSum > 0);

      if (!hasAnyData) {
        summaryContainer.innerHTML = `
          <div style="padding: var(--space-4) 0; text-align: center;">
            <div style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No data yet.</div>
            <div style="font-size: var(--text-xs); color: var(--text-muted);">Your trends and micro-charts will appear after you begin tracking sessions.</div>
          </div>
        `;
      } else {
        summaryContainer.innerHTML = `
          <div class="metric-grid" style="margin-bottom: var(--space-4);">
            <div class="metric-box">
              <div class="metric-label">Focused Cyber</div>
              <div class="metric-value">${DateUtils.formatDurationHoursMins(totalCyberSeconds)}</div>
              <div class="metric-subtext">${validDays} day(s) evaluated</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">English Practice</div>
              <div class="metric-value">${DateUtils.formatDurationHoursMins(totalEnglishSeconds)}</div>
              <div class="metric-subtext">${validDays} day(s) evaluated</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Gym Sessions</div>
              <div class="metric-value">${totalGymCount}</div>
              <div class="metric-subtext">Total attended</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Discipline Index</div>
              <div class="metric-value">${Math.round((avgDeen + avgCyber + avgEnglish + avgFitness + avgSleep) / 5)}%</div>
              <div class="metric-subtext">Balanced Mean</div>
            </div>
          </div>

          <!-- SVG Micro-Charts -->
          <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-3);">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
              <span>CYBERSECURITY HOURS</span>
              <span style="color: var(--accent-primary);">Target: 4h / day</span>
            </div>
            ${this.renderBarChartSVG(cyberSeries, 4.0, 'h')}
          </div>

          <div style="background-color: var(--bg-surface-elevated); padding: var(--space-3); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
              <span>SLEEP RESTORATION</span>
              <span style="color: var(--status-success);">Target: 7.5h</span>
            </div>
            ${this.renderLineChartSVG(sleepSeries, 7.5, 'h')}
          </div>
        `;
      }
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

  /**
   * Generates clean SVG bar chart for mobile
   */
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
        <!-- Target Line -->
        <line x1="0" y1="${targetY}" x2="${width}" y2="${targetY}" stroke="var(--border-strong)" stroke-dasharray="3,3" stroke-width="1.5" />
        ${bars}
      </svg>
    `;
  },

  /**
   * Generates clean SVG line chart for mobile
   */
  renderLineChartSVG(series, targetVal = 7.5, unit = '') {
    if (!series || series.length < 2) {
      return '<div class="prayer-time" style="padding: 10px 0;">Log sleep records to see trend line</div>';
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
  }
};

if (typeof window !== 'undefined') {
  window.ProgressModule = ProgressModule;
}
