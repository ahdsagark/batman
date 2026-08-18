/**
 * BATMAN — Goals Module (9-Month Transformation Goals & Milestones)
 */

const GoalsModule = {
  init() {
    this.renderGoals();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'more') this.renderGoals();
    });
  },

  bindEvents() {
    const manageBtn = document.getElementById('open-goals-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.openGoalsModal());
    }
  },

  renderGoals() {
    const container = document.getElementById('goals-preview-list');
    if (!container) return;

    const goals = StorageService.getGoals();
    const activeGoals = goals.filter(g => g.status === 'IN_PROGRESS' || g.status === 'NOT_STARTED').slice(0, 4);

    container.innerHTML = activeGoals.map(g => `
      <div class="prayer-row" style="padding: 8px 0;">
        <div class="prayer-info">
          <span style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary);">${g.title}</span>
          <span class="prayer-time">${g.pillar} • ${g.targetDate}</span>
        </div>
        <span class="badge ${g.status === 'IN_PROGRESS' ? 'badge-home' : 'badge-neutral'}" style="font-size: 10px;">
          ${g.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending'}
        </span>
      </div>
    `).join('');
  },

  openGoalsModal() {
    const goals = StorageService.getGoals();
    const container = document.createElement('div');

    container.innerHTML = `
      <div style="max-height: 60vh; overflow-y: auto; margin-bottom: var(--space-4);">
        ${goals.map((g, idx) => `
          <div class="prayer-row" style="padding: 10px 0;">
            <div class="prayer-info" style="flex: 1; margin-right: var(--space-2);">
              <span style="font-weight: 700; color: var(--text-primary); font-size: var(--text-sm);">${idx + 1}. ${g.title}</span>
              <span class="prayer-time">${g.pillar} • ${g.targetDate}</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="GoalsModule.cycleStatus('${g.id}')">
              ${g.status}
            </button>
          </div>
        `).join('')}
      </div>
      <button id="modal-add-goal-btn" class="btn btn-outline btn-block">+ Add Custom Milestone</button>
    `;

    container.querySelector('#modal-add-goal-btn').addEventListener('click', () => {
      const title = prompt('Enter Milestone Goal:');
      if (!title) return;
      const pillar = prompt('Pillar (Cybersecurity, English, Fitness, Deen, Discipline):', 'Cybersecurity');
      const targetDate = prompt('Target Date / Month:', 'Month 3');

      const newGoal = {
        id: CalcUtils.generateId('goal'),
        title: ValidationUtils.sanitizeText(title),
        pillar: pillar || 'General',
        status: 'IN_PROGRESS',
        targetDate: targetDate || 'Milestone'
      };

      const current = StorageService.getGoals();
      current.push(newGoal);
      StorageService.saveGoals(current);
      UI.showToast('Goal added', 'success');
      this.openGoalsModal();
      this.renderGoals();
    });

    UI.openSheet('9-Month Transformation Goals', container);
  },

  cycleStatus(goalId) {
    const goals = StorageService.getGoals();
    const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED'];
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const currentIdx = statuses.indexOf(goal.status);
    goal.status = statuses[(currentIdx + 1) % statuses.length];

    StorageService.saveGoals(goals);
    UI.vibrate(10);
    this.openGoalsModal();
    this.renderGoals();
  }
};

if (typeof window !== 'undefined') {
  window.GoalsModule = GoalsModule;
}
