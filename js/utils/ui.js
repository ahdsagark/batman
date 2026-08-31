/**
 * BATMAN — UI & Interaction Helpers
 */

const UI = {
  /**
   * Display a lightweight toast message
   * @param {string} message 
   * @param {'info'|'success'|'error'} [type='info'] 
   * @param {number} [durationMs=2800] 
   */
  showToast(message, type = 'info', durationMs = 2800) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, durationMs);
  },

  /**
   * Open dynamic Bottom Sheet Modal
   * @param {string} title 
   * @param {string|HTMLElement} contentHTML 
   */
  openSheet(title, contentHTML) {
    const backdrop = document.getElementById('sheet-backdrop');
    const titleEl = document.getElementById('sheet-title');
    const contentEl = document.getElementById('sheet-content');

    if (!backdrop || !titleEl || !contentEl) return;

    titleEl.textContent = title;
    if (typeof contentHTML === 'string') {
      contentEl.innerHTML = contentHTML;
    } else {
      contentEl.innerHTML = '';
      contentEl.appendChild(contentHTML);
    }

    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  /**
   * Close active Bottom Sheet Modal
   */
  closeSheet() {
    const backdrop = document.getElementById('sheet-backdrop');
    if (!backdrop) return;
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  },

  // Aliases for compatibility
  showBottomSheet(title, contentHTML) {
    this.openSheet(title, contentHTML);
  },

  closeBottomSheet() {
    this.closeSheet();
  },

  /**
   * Switch between primary navigation tabs
   * @param {string} targetViewId 
   */
  switchTab(targetViewId) {
    // Update navigation buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-view') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view sections
    document.querySelectorAll('.app-view').forEach(view => {
      if (view.id === `view-${targetViewId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Scroll viewport to top
    const viewport = document.getElementById('app-viewport');
    if (viewport) viewport.scrollTop = 0;

    // Trigger tab-specific refresh if module listener exists
    window.dispatchEvent(new CustomEvent('batman:tab-switched', { detail: { tab: targetViewId } }));
  },

  /**
   * Light haptic feedback for mobile touches
   */
  vibrate(ms = 12) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // Ignored if device does not support vibration
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.UI = UI;
}
