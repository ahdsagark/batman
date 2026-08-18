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
    const surahProgress = settings.surahProgress || {};

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
    const todayTargetTxt = document.getElementById('quran-today-target-txt');
    const todayTargetBar = document.getElementById('quran-today-target-bar');
    const verseDescEl = document.getElementById('quran-verse-number-desc');
    const todayCountEl = document.getElementById('quran-today-memo-count');
    const selectBtn = document.getElementById('quran-select-surah-btn');

    const activeNumber = settings.activeSurahNumber || 67;
    const activeSurah = CONFIG.SURAHS.find(s => s.number === activeNumber) || { number: 67, name: 'Al-Mulk', verses: 30 };
    const totalVerses = activeSurah.verses;
    const completedVerses = Math.max(0, Math.min(totalVerses, surahProgress[activeNumber] ?? settings.activeSurahCompletedVerses ?? 0));
    const remainingVerses = Math.max(0, totalVerses - completedVerses);
    const pct = Math.round((completedVerses / totalVerses) * 100);
    const isSurahCompleted = completedVerses >= totalVerses;
    const todayMemo = log.quranMemoCount || 0;
    const todayTargetPct = Math.min(100, Math.round((todayMemo / 3) * 100));

    if (surahNameEl) {
      surahNameEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: var(--text-lg); font-weight: 800; color: var(--text-primary);">${activeSurah.name}</span>
            ${isSurahCompleted ? '<span class="badge badge-masjid" style="font-size: 10px;">100% COMPLETED ✓</span>' : ''}
          </div>
          <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 600;">Surah ${activeSurah.number} • ${totalVerses} verses total</span>
        </div>
      `;
    }

    // 3a. Overall Surah Progress
    if (surahProgressTxt) {
      if (isSurahCompleted) {
        surahProgressTxt.textContent = `${totalVerses} / ${totalVerses} (100%) • Completed ✓`;
      } else {
        surahProgressTxt.textContent = `${completedVerses} / ${totalVerses} (${pct}%) • ${remainingVerses} left`;
      }
    }

    if (surahProgressBar) {
      surahProgressBar.style.width = `${pct}%`;
      surahProgressBar.className = isSurahCompleted ? 'progress-fill success' : 'progress-fill';
    }

    // 3b. Today's 3-Verse Target Progress
    if (todayTargetTxt) {
      todayTargetTxt.textContent = `${todayMemo} / 3 Verses (${todayTargetPct}%)${todayMemo >= 3 ? ' • Target Met ✓' : ''}`;
    }

    if (todayTargetBar) {
      todayTargetBar.style.width = `${todayTargetPct}%`;
      todayTargetBar.className = todayMemo >= 3 ? 'progress-fill success' : 'progress-fill';
    }

    // 3c. Verse Stepper (Active Surah Verse Number)
    if (verseDescEl) {
      if (isSurahCompleted) {
        verseDescEl.textContent = `All ${totalVerses} Verses Memorized ✓`;
      } else if (completedVerses === 0) {
        verseDescEl.textContent = `Ready to memorize Verse 1 of ${totalVerses}`;
      } else {
        verseDescEl.textContent = `Memorized up to Verse ${completedVerses} of ${totalVerses}`;
      }
    }

    if (todayCountEl) {
      todayCountEl.textContent = completedVerses;
    }

    // Disable minus button when current surah is already at 0 verses
    const minusBtn = document.getElementById('quran-memo-minus');
    if (minusBtn) {
      const isZero = completedVerses <= 0;
      minusBtn.disabled = isZero;
      minusBtn.style.opacity = isZero ? '0.4' : '1';
      minusBtn.style.cursor = isZero ? 'not-allowed' : 'pointer';
    }

    // Determine correct button text
    if (selectBtn) {
      if (isSurahCompleted) {
        selectBtn.textContent = 'SELECT NEXT SURAH';
        selectBtn.className = 'btn btn-primary btn-sm';
      } else {
        selectBtn.textContent = 'CHANGE SURAH';
        selectBtn.className = 'btn btn-outline btn-sm';
      }
    }
  },

  incrementMemorization(delta) {
    const todayISO = DateUtils.getTodayISO();
    const log = StorageService.getDayLog(todayISO);
    const settings = StorageService.getSettings();
    const surahProgress = { ...(settings.surahProgress || {}) };

    const activeNumber = settings.activeSurahNumber || 67;
    const activeSurah = CONFIG.SURAHS.find(s => s.number === activeNumber) || { number: 67, name: 'Al-Mulk', verses: 30 };
    const totalVerses = activeSurah.verses;
    const currentCompleted = Math.max(0, Math.min(totalVerses, surahProgress[activeNumber] ?? settings.activeSurahCompletedVerses ?? 0));
    const currentToday = log.quranMemoCount || 0;

    if (delta > 0) {
      // If already at 100%, prevent increasing count and prompt for next surah
      if (currentCompleted >= totalVerses) {
        UI.vibrate([15, 50, 15]);
        UI.showToast(`Surah ${activeSurah.name} is already 100% completed (${totalVerses}/${totalVerses} verses). Please select your next Surah!`, 'warning', 3500);
        this.openSurahSelectorModal();
        return;
      }

      const nextCompleted = currentCompleted + 1;
      const nextToday = currentToday + 1;
      surahProgress[activeNumber] = nextCompleted;

      StorageService.saveSettings({
        activeSurahCompletedVerses: nextCompleted,
        surahProgress
      });
      StorageService.saveDayLog(todayISO, { quranMemoCount: nextToday });
      StorageService.syncSurahMemorization(activeNumber, nextCompleted, nextToday);

      UI.vibrate(10);
      this.renderQuran();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));

      // Check if this tap just completed the Surah
      if (nextCompleted >= totalVerses) {
        setTimeout(() => {
          UI.vibrate([20, 100, 20]);
          UI.showToast(`🎉 Masha'Allah! Surah ${activeSurah.name} Completed (100%)! Choose your next Surah.`, 'success', 4500);
          this.openSurahSelectorModal();
        }, 350);
      }
    } else if (delta < 0) {
      if (currentCompleted <= 0) {
        UI.vibrate(10);
        UI.showToast(`Surah ${activeSurah.name} is already at 0 verses`, 'info', 1500);
        return;
      }

      const nextCompleted = Math.max(0, currentCompleted - 1);
      const nextToday = Math.max(0, currentToday - 1);

      if (nextCompleted > 0) {
        surahProgress[activeNumber] = nextCompleted;
      } else {
        delete surahProgress[activeNumber];
      }

      StorageService.saveSettings({
        activeSurahCompletedVerses: nextCompleted,
        surahProgress
      });
      StorageService.saveDayLog(todayISO, { quranMemoCount: nextToday });
      StorageService.syncSurahMemorization(activeNumber, nextCompleted, nextToday);

      UI.vibrate(10);
      this.renderQuran();
      window.dispatchEvent(new CustomEvent('batman:data-updated'));
    }
  },

  openSurahSelectorModal() {
    const settings = StorageService.getSettings();
    const surahProgress = settings.surahProgress || {};
    const activeNumber = settings.activeSurahNumber || 67;

    const container = document.createElement('div');

    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.className = 'form-input';
    searchBox.placeholder = 'Search Surah by name or number (e.g. Al-Kahf, 18)...';
    searchBox.style.marginBottom = 'var(--space-3)';

    const listEl = document.createElement('div');
    listEl.style.maxHeight = '55vh';
    listEl.style.overflowY = 'auto';

    const renderList = (filter = '') => {
      const q = filter.toLowerCase().trim();
      const filtered = CONFIG.SURAHS.filter(s => 
        s.number.toString().includes(q) || s.name.toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: var(--space-4);">No Surah found matching "${filter}"</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(s => {
        const versesDone = surahProgress[s.number] || 0;
        const isDone = versesDone >= s.verses;
        const isActive = s.number === activeNumber;
        const inProgress = versesDone > 0 && !isDone;

        let statusBadge = '';
        if (isActive && isDone) {
          statusBadge = '<span class="badge badge-masjid">Active • Done ✓</span>';
        } else if (isActive) {
          statusBadge = '<span class="badge badge-masjid">Active</span>';
        } else if (isDone) {
          statusBadge = '<span class="badge badge-success">Done ✓</span>';
        } else if (inProgress) {
          statusBadge = `<span class="badge badge-neutral">${versesDone}/${s.verses}</span>`;
        }

        return `
          <div class="prayer-row" style="cursor: pointer; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);" onclick="QuranModule.selectSurah(${s.number})">
            <div class="prayer-info">
              <span style="font-weight: 700; color: var(--text-primary);">${s.number}. ${s.name}</span>
              <span class="prayer-time">${s.verses} Verses ${versesDone > 0 ? `(${versesDone}/${s.verses} memorized)` : ''}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${statusBadge}
              <button class="btn ${isActive ? 'btn-secondary' : 'btn-outline'} btn-sm" style="min-height: 36px; padding: 0 12px;">${isActive ? 'Active' : (versesDone > 0 ? 'Resume' : 'Select')}</button>
            </div>
          </div>
        `;
      }).join('');
    };

    searchBox.addEventListener('input', (e) => renderList(e.target.value));

    container.appendChild(searchBox);
    container.appendChild(listEl);
    renderList();

    UI.openSheet('Select Surah to Memorize', container);
    setTimeout(() => { if (typeof searchBox.focus === 'function') searchBox.focus(); }, 150);
  },

  selectSurah(surahNumber) {
    const surah = CONFIG.SURAHS.find(s => s.number === surahNumber);
    if (!surah) return;

    const settings = StorageService.getSettings();
    const surahProgress = settings.surahProgress || {};
    const existingProgress = Math.max(0, Math.min(surah.verses, surahProgress[surah.number] || 0));

    StorageService.saveSettings({
      activeSurahNumber: surah.number,
      activeSurahName: surah.name,
      activeSurahVerses: surah.verses,
      activeSurahCompletedVerses: existingProgress,
      surahProgress: { ...surahProgress, [surah.number]: existingProgress }
    });
    StorageService.syncSurahMemorization(surah.number, existingProgress, 0);

    UI.closeSheet();
    UI.showToast(`Active Surah set to: ${surah.name} (${existingProgress}/${surah.verses} verses)`, 'success');
    this.renderQuran();
    window.dispatchEvent(new CustomEvent('batman:data-updated'));
  }
};

if (typeof window !== 'undefined') {
  window.QuranModule = QuranModule;
}

