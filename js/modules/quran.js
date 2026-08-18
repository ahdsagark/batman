/**
 * BATMAN — Qur'an Module (Tafsir, 3-Verse Memorization, Any-Order Surah Tracker, Evening Recitation)
 */

const QuranModule = {
  init() {
    this.renderQuran();
    this.bindEvents();

    window.addEventListener('batman:tab-switched', (e) => {
      if (e.detail.tab === 'deen') this.renderQuran();
    });
  },

  bindEvents() {
    // Tafsir Toggle
    const tafsirBtn = document.getElementById('quran-tafsir-toggle-btn');
    if (tafsirBtn) {
      tafsirBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextStatus = log.quranTafsir === 'COMPLETED' ? 'NOT_COMPLETED' : 'COMPLETED';
        StorageService.saveDayLog(todayISO, { quranTafsir: nextStatus });
        UI.vibrate(10);
        this.renderQuran();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }

    // Evening Recitation Toggle
    const recitBtn = document.getElementById('quran-recitation-toggle-btn');
    if (recitBtn) {
      recitBtn.addEventListener('click', () => {
        const todayISO = DateUtils.getTodayISO();
        const log = StorageService.getDayLog(todayISO);
        const nextStatus = log.quranRecitation === 'COMPLETED' ? 'NOT_COMPLETED' : 'COMPLETED';
        StorageService.saveDayLog(todayISO, { quranRecitation: nextStatus });
        UI.vibrate(10);
        this.renderQuran();
        window.dispatchEvent(new CustomEvent('batman:data-updated'));
      });
    }

    // Memorization Counter Buttons (+ / -)
    const plusBtn = document.getElementById('quran-memo-plus');
    const minusBtn = document.getElementById('quran-memo-minus');

    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        this.incrementMemorization(1);
      });
    }

    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        this.incrementMemorization(-1);
      });
    }

    // Select Surah Button
    const selectSurahBtn = document.getElementById('quran-select-surah-btn');
    if (selectSurahBtn) {
      selectSurahBtn.addEventListener('click', () => {
        this.openSurahSelectorModal();
      });
    }
  },

  renderQuran() {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();

    // 1. Morning Tafsir Status
    const tafsirBtn = document.getElementById('quran-tafsir-toggle-btn');
    if (tafsirBtn) {
      const isDone = log.quranTafsir === 'COMPLETED';
      tafsirBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT DONE';
      tafsirBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }

    // 2. Evening Recitation Status
    const recitBtn = document.getElementById('quran-recitation-toggle-btn');
    if (recitBtn) {
      const isDone = log.quranRecitation === 'COMPLETED';
      recitBtn.textContent = isDone ? 'COMPLETED ✓' : 'NOT DONE';
      recitBtn.className = isDone ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    }

    // 3. Active Surah & Memorization Progress
    const surahNameEl = document.getElementById('quran-active-surah-name');
    const surahProgressTxt = document.getElementById('quran-surah-progress-txt');
    const surahProgressBar = document.getElementById('quran-surah-progress-bar');
    const todayCountEl = document.getElementById('quran-today-memo-count');
    const selectBtn = document.getElementById('quran-select-surah-btn');

    const hasActiveSurah = Boolean(settings.activeSurahNumber);
    const totalVerses = settings.activeSurahVerses || 30;
    const completedVerses = Math.min(totalVerses, settings.activeSurahCompletedVerses || 0);
    const remainingVerses = Math.max(0, totalVerses - completedVerses);
    const pct = Math.round((completedVerses / totalVerses) * 100);
    const isSurahCompleted = completedVerses >= totalVerses;
    const todayMemo = log.quranMemoCount || 0;

    if (surahNameEl) {
      surahNameEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">${settings.activeSurahName || 'Al-Mulk'}</span>
            ${isSurahCompleted ? '<span class="badge badge-masjid">COMPLETED ✓</span>' : ''}
          </div>
          <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">${totalVerses} verses</span>
        </div>
      `;
    }

    if (surahProgressTxt) {
      surahProgressTxt.textContent = `${completedVerses} / ${totalVerses} (${pct}%) • ${remainingVerses} left`;
    }

    if (surahProgressBar) {
      surahProgressBar.style.width = `${pct}%`;
      surahProgressBar.className = isSurahCompleted ? 'progress-fill success' : 'progress-fill';
    }

    if (todayCountEl) {
      todayCountEl.textContent = todayMemo;
    }

    // Determine correct button text
    if (selectBtn) {
      if (isSurahCompleted) {
        selectBtn.textContent = 'SELECT NEXT SURAH';
        selectBtn.className = 'btn btn-primary btn-sm';
      } else if (hasActiveSurah) {
        selectBtn.textContent = 'CHANGE SURAH';
        selectBtn.className = 'btn btn-outline btn-sm';
      } else {
        selectBtn.textContent = 'SELECT SURAH';
        selectBtn.className = 'btn btn-outline btn-sm';
      }
    }
  },

  incrementMemorization(delta) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();

    const currentToday = log.quranMemoCount || 0;
    const nextToday = Math.max(0, currentToday + delta);

    if (nextToday === currentToday) return;

    // Update Surah overall progress
    const totalVerses = settings.activeSurahVerses || 30;
    const currentCompleted = settings.activeSurahCompletedVerses || 0;
    const nextCompleted = Math.max(0, Math.min(totalVerses, currentCompleted + delta));

    StorageService.saveDayLog(todayISO, { quranMemoCount: nextToday });
    StorageService.saveSettings({ activeSurahCompletedVerses: nextCompleted });

    UI.vibrate(10);
    this.renderQuran();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));

    // Check for Surah completion
    if (nextCompleted >= totalVerses) {
      setTimeout(() => {
        UI.showToast(`Surah ${settings.activeSurahName} Completed (100%)! Choose your next Surah.`, 'success', 4500);
        this.openSurahSelectorModal();
      }, 400);
    }
  },

  openSurahSelectorModal() {
    const settings = StorageService.getSettings();
    const container = document.createElement('div');

    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.className = 'form-input';
    searchBox.placeholder = 'Search Surah by name or number...';
    searchBox.style.marginBottom = 'var(--space-3)';

    const listEl = document.createElement('div');
    listEl.style.maxHeight = '55vh';
    listEl.style.overflowY = 'auto';

    const renderList = (filter = '') => {
      const q = filter.toLowerCase().trim();
      const filtered = CONFIG.SURAHS.filter(s => 
        s.number.toString().includes(q) || s.name.toLowerCase().includes(q)
      );

      listEl.innerHTML = filtered.map(s => `
        <div class="prayer-row" style="cursor: pointer; padding: 10px 0;" onclick="QuranModule.selectSurah(${s.number})">
          <div class="prayer-info">
            <span style="font-weight: 700; color: var(--text-primary);">${s.number}. ${s.name}</span>
            <span class="prayer-time">${s.verses} Verses</span>
          </div>
          ${s.number === settings.activeSurahNumber ? '<span class="badge badge-masjid">Active</span>' : '<button class="btn btn-outline btn-sm">Select</button>'}
        </div>
      `).join('');
    };

    searchBox.addEventListener('input', (e) => renderList(e.target.value));

    container.appendChild(searchBox);
    container.appendChild(listEl);
    renderList();

    UI.openSheet('Select Any Surah to Memorize', container);
  },

  selectSurah(surahNumber) {
    const surah = CONFIG.SURAHS.find(s => s.number === surahNumber);
    if (!surah) return;

    StorageService.saveSettings({
      activeSurahNumber: surah.number,
      activeSurahName: surah.name,
      activeSurahVerses: surah.verses,
      activeSurahCompletedVerses: 0
    });

    UI.closeSheet();
    UI.showToast(`Active Surah set to: ${surah.name} (${surah.verses} verses)`, 'success');
    this.renderQuran();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.QuranModule = QuranModule;
}
