// מצב האפליקציה (State)
const state = {
    allSeries: [],
    filteredSeries: [],
    activeFilter: 'all',
    searchQuery: '',
    currentSeries: null,
    currentSeason: null,
    activeEpisodeForVLC: null,
};

// אלמנטים מה-DOM
const elements = {
    seriesGrid: document.getElementById('series-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChips: document.querySelectorAll('.chip'),
    visibleSeriesCount: document.getElementById('visible-series-count'),

    // סטטיסטיקות
    statSeries: document.getElementById('stat-series'),
    statEpisodes: document.getElementById('stat-episodes'),
    statWatched: document.getElementById('stat-watched'),

    // באנר המשך צפייה
    lastWatchedSection: document.getElementById('last-watched-section'),
    lwTitle: document.getElementById('lw-title'),
    lwSubtitle: document.getElementById('lw-subtitle'),
    lwPlayBtn: document.getElementById('lw-play-btn'),
    lwVlcBtn: document.getElementById('lw-vlc-btn'),

    // מודל סדרה
    seriesModal: document.getElementById('series-modal'),
    closeSeriesModal: document.getElementById('close-series-modal'),
    modalSeriesName: document.getElementById('modal-series-name'),
    modalFormatsBadge: document.getElementById('modal-formats-badge'),
    modalSeasonsCount: document.getElementById('modal-seasons-count'),
    modalEpisodesCount: document.getElementById('modal-episodes-count'),
    modalWatchedProgress: document.getElementById('modal-watched-progress'),
    seasonsTabs: document.getElementById('seasons-tabs'),
    currentSeasonTitle: document.getElementById('current-season-title'),
    currentSeasonCount: document.getElementById('current-season-count'),
    episodesList: document.getElementById('episodes-list'),

    // מודל נגן
    playerModal: document.getElementById('player-modal'),
    closePlayerModal: document.getElementById('close-player-modal'),
    playerTitle: document.getElementById('player-title'),
    html5Player: document.getElementById('html5-player'),
    playerOpenVlcBtn: document.getElementById('player-open-vlc-btn'),

    // מודל ארגון
    btnOrganize: document.getElementById('btn-organize'),
    organizeModal: document.getElementById('organize-modal'),
    closeOrganizeModal: document.getElementById('close-organize-modal'),
    btnCancelOrganize: document.getElementById('btn-cancel-organize'),
    btnConfirmOrganize: document.getElementById('btn-confirm-organize'),
    organizePreview: document.getElementById('organize-preview'),

    // רענון ספריה
    btnRescan: document.getElementById('btn-rescan'),
    rescanIcon: document.getElementById('rescan-icon'),
    toastContainer: document.getElementById('toast-container'),
};

// טעינה ראשונית
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchLibraryData();
});

function initEventListeners() {
    // חיפוש
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        elements.clearSearch.classList.toggle('hidden', state.searchQuery === '');
        applyFilters();
    });

    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearch.classList.add('hidden');
        applyFilters();
    });

    // כפתורי סינון
    elements.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            elements.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeFilter = chip.dataset.filter;
            applyFilters();
        });
    });

    // רענון ספריה
    elements.btnRescan.addEventListener('click', async () => {
        elements.rescanIcon.style.animation = 'spin 1s linear infinite';
        showToast('סורק את תיקיית ההורדות מחדש...', 'info');
        await fetchLibraryData(true);
        elements.rescanIcon.style.animation = '';
        showToast('הספרייה עודכנה בהצלחה!', 'success');
    });

    // מודל ארגון קבצים
    elements.btnOrganize.addEventListener('click', openOrganizeModal);
    elements.closeOrganizeModal.addEventListener('click', () => elements.organizeModal.classList.add('hidden'));
    elements.btnCancelOrganize.addEventListener('click', () => elements.organizeModal.classList.add('hidden'));
    elements.btnConfirmOrganize.addEventListener('click', executeFileOrganization);

    // סגירת מודלים
    elements.closeSeriesModal.addEventListener('click', () => elements.seriesModal.classList.add('hidden'));
    elements.closePlayerModal.addEventListener('click', closePlayer);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.seriesModal.classList.add('hidden');
            elements.organizeModal.classList.add('hidden');
            closePlayer();
        }
    });

    // כפתור פתיחה ב-VLC מתוך הנגן
    elements.playerOpenVlcBtn.addEventListener('click', () => {
        if (state.activeEpisodeForVLC) {
            openExternalPlayer(state.activeEpisodeForVLC.id, state.activeEpisodeForVLC.path);
        }
    });
}

// קבלת נתונים מהשרת
async function fetchLibraryData(forceRescan = false) {
    try {
        if (forceRescan) {
            await fetch('/api/rescan', { method: 'POST' });
        }

        const [seriesRes, statsRes] = await Promise.all([
            fetch('/api/series'),
            fetch('/api/stats')
        ]);

        const seriesData = await seriesRes.json();
        const statsData = await statsRes.json();

        state.allSeries = seriesData.series || [];
        updateStats(statsData);
        applyFilters();
        updateLastWatchedBanner(statsData.last_watched);
    } catch (err) {
        console.error('Error fetching data:', err);
        showToast('שגיאה בחיבור לשרת המקומי', 'error');
    }
}

// עדכון נתוני סטטיסטיקה
function updateStats(stats) {
    elements.statSeries.textContent = stats.total_series || 0;
    elements.statEpisodes.textContent = stats.total_episodes || 0;
    elements.statWatched.textContent = stats.total_watched || 0;
}

// עדכון באנר המשך צפייה
function updateLastWatchedBanner(lastWatched) {
    if (!lastWatched) {
        elements.lastWatchedSection.classList.add('hidden');
        return;
    }

    elements.lwTitle.textContent = lastWatched.series;
    elements.lwSubtitle.textContent = `עונה ${lastWatched.season} · פרק ${lastWatched.episode}`;
    elements.lastWatchedSection.classList.remove('hidden');

    elements.lwPlayBtn.onclick = () => {
        openSeriesModal(lastWatched.series, lastWatched.season);
    };

    elements.lwVlcBtn.onclick = () => {
        openExternalPlayer(lastWatched.id);
    };
}

// החלת סינונים וחיפוש
function applyFilters() {
    let result = [...state.allSeries];

    // סינון חיפוש
    if (state.searchQuery) {
        result = result.filter(s => s.name.toLowerCase().includes(state.searchQuery));
    }

    // סינון קטגוריות
    if (state.activeFilter === 'unwatched') {
        result = result.filter(s => s.watched_episodes === 0);
    } else if (state.activeFilter === 'in-progress') {
        result = result.filter(s => s.watched_episodes > 0 && s.watched_episodes < s.total_episodes);
    } else if (state.activeFilter === 'completed') {
        result = result.filter(s => s.watched_episodes === s.total_episodes && s.total_episodes > 0);
    }

    state.filteredSeries = result;
    renderSeriesGrid();
}

// רינדור גריד הסדרות
function renderSeriesGrid() {
    elements.seriesGrid.innerHTML = '';
    elements.visibleSeriesCount.textContent = `${state.filteredSeries.length} סדרות`;

    if (state.filteredSeries.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    state.filteredSeries.forEach(series => {
        const card = createSeriesCard(series);
        elements.seriesGrid.appendChild(card);
    });
}

// יצירת כרטיסיית סדרה מעוצבת
function createSeriesCard(series) {
    const card = document.createElement('div');
    card.className = 'series-card';

    const p = series.palette;
    const progressPercent = series.total_episodes > 0 
        ? Math.round((series.watched_episodes / series.total_episodes) * 100) 
        : 0;

    const formatsStr = series.formats.join(', ');
    const isCompleted = progressPercent === 100 && series.total_episodes > 0;

    // אייקון אות ראשונה של הסדרה
    const firstLetter = series.name.replace(/[^א-תa-zA-Z]/g, '').charAt(0) || '🎬';

    card.innerHTML = `
        <div class="card-banner">
            <div class="card-banner-bg" style="background: linear-gradient(135deg, ${p.from}, ${p.to});"></div>
            <div class="card-icon-art">${firstLetter}</div>
            <div class="card-format-tag">${formatsStr}</div>
        </div>
        <div class="card-body">
            <h3 class="card-title">${escapeHtml(series.name)}</h3>
            <div class="card-meta">
                <span>${series.seasons_count} עונות</span>
                <span>·</span>
                <span>${series.total_episodes} פרקים</span>
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-info">
                    <span>${isCompleted ? 'הושלם במלואו ✨' : `נצפו: ${series.watched_episodes}/${series.total_episodes}`}</span>
                    <span>${progressPercent}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${isCompleted ? 'complete' : ''}" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openSeriesModal(series.name));
    return card;
}

// פתיחת מודל פירוט סדרה ועונות
async function openSeriesModal(seriesName, targetSeason = null) {
    try {
        const res = await fetch(`/api/series/${encodeURIComponent(seriesName)}`);
        if (!res.ok) throw new Error('Failed to load series');
        const data = await res.json();

        state.currentSeries = data;
        elements.modalSeriesName.textContent = data.name;
        elements.modalFormatsBadge.textContent = data.palette ? 'HD Series' : 'Series';
        elements.modalEpisodesCount.textContent = `${data.total_episodes} פרקים`;

        const seasonKeys = Object.keys(data.seasons).sort((a, b) => Number(a) - Number(b));
        elements.modalSeasonsCount.textContent = `${seasonKeys.length} עונות`;

        // חישוב אחוז צפייה לסדרה
        let totalWatched = 0;
        seasonKeys.forEach(sNum => {
            totalWatched += data.seasons[sNum].filter(e => e.watched).length;
        });
        const percent = data.total_episodes > 0 ? Math.round((totalWatched / data.total_episodes) * 100) : 0;
        elements.modalWatchedProgress.textContent = `${percent}% נצפו`;

        // רינדור טאבים של עונות
        elements.seasonsTabs.innerHTML = '';
        seasonKeys.forEach((sNum, index) => {
            const tab = document.createElement('button');
            tab.className = `season-tab ${((targetSeason && Number(sNum) === Number(targetSeason)) || (!targetSeason && index === 0)) ? 'active' : ''}`;
            tab.textContent = `עונה ${sNum} (${data.seasons[sNum].length})`;
            tab.addEventListener('click', () => {
                document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderSeasonEpisodes(sNum);
            });
            elements.seasonsTabs.appendChild(tab);
        });

        // הצגת עונה ראשונה או נבחרת
        const initialSeason = targetSeason && seasonKeys.includes(String(targetSeason)) ? String(targetSeason) : seasonKeys[0];
        renderSeasonEpisodes(initialSeason);

        elements.seriesModal.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showToast('שגיאה בטעינת נתוני הסדרה', 'error');
    }
}

// רינדור רשימת פרקים לעונה נבחרת
function renderSeasonEpisodes(seasonNum) {
    state.currentSeason = seasonNum;
    const episodes = state.currentSeries.seasons[seasonNum] || [];

    elements.currentSeasonTitle.textContent = `עונה ${seasonNum}`;
    elements.currentSeasonCount.textContent = `${episodes.length} פרקים`;
    elements.episodesList.innerHTML = '';

    episodes.forEach(ep => {
        const row = document.createElement('div');
        row.className = `episode-row ${ep.watched ? 'watched' : ''}`;

        const formatClass = ep.format === 'MP4' ? 'format-mp4' : (ep.format === 'MKV' ? 'format-mkv' : 'format-avi');

        row.innerHTML = `
            <div class="episode-left">
                <div class="ep-num-badge">${ep.episode}</div>
                <div class="episode-details">
                    <h4>פרק ${ep.episode}</h4>
                    <div class="ep-sub">
                        <span class="format-pill ${formatClass}">${ep.format}</span>
                        <span>${ep.size_mb} MB</span>
                    </div>
                </div>
            </div>
            <div class="episode-actions">
                ${ep.is_playable_in_browser ? `
                    <button class="btn btn-sm btn-primary btn-play-browser" title="נגן ישירות בדפדפן">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <span>נגן</span>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-glass btn-play-vlc" title="פתח בנגן שולחני (VLC / Windows)">
                    <span>נגן מקומי</span>
                </button>
                <button class="btn-watch-toggle ${ep.watched ? 'watched' : ''}" title="${ep.watched ? 'סמן כלא נצפה' : 'סמן כנצפה'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
            </div>
        `;

        // כפתור ניגון בדפדפן
        const playBrowserBtn = row.querySelector('.btn-play-browser');
        if (playBrowserBtn) {
            playBrowserBtn.addEventListener('click', () => {
                openInBrowserPlayer(ep);
            });
        }

        // כפתור ניגון מקומי ב-VLC
        const playVlcBtn = row.querySelector('.btn-play-vlc');
        if (playVlcBtn) {
            playVlcBtn.addEventListener('click', () => {
                openExternalPlayer(ep.id, ep.path);
            });
        }

        // כפתור מעקב צפייה
        const watchToggleBtn = row.querySelector('.btn-watch-toggle');
        watchToggleBtn.addEventListener('click', async () => {
            const isWatched = await toggleEpisodeWatched(ep.id);
            ep.watched = isWatched;
            row.classList.toggle('watched', isWatched);
            watchToggleBtn.classList.toggle('watched', isWatched);
            watchToggleBtn.title = isWatched ? 'סמן כלא נצפה' : 'סמן כנצפה';
            
            // עדכון מונה צפייה בסדרה המקומית
            fetchLibraryData();
        });

        elements.episodesList.appendChild(row);
    });
}

// נגן וידאו מובנה בדפדפן
function openInBrowserPlayer(ep) {
    state.activeEpisodeForVLC = ep;
    elements.playerTitle.textContent = `${ep.series} - עונה ${ep.season} פרק ${ep.episode}`;
    elements.html5Player.src = `/api/stream/${ep.id}`;
    elements.playerModal.classList.remove('hidden');
    elements.html5Player.play().catch(e => console.log('Autoplay prevented:', e));

    // סימון אוטומטי כנצפה לאחר שהפרק הגיע ל-80%
    elements.html5Player.ontimeupdate = () => {
        if (elements.html5Player.duration > 0) {
            const ratio = elements.html5Player.currentTime / elements.html5Player.duration;
            if (ratio >= 0.8 && !ep.watched) {
                ep.watched = true;
                toggleEpisodeWatched(ep.id);
            }
        }
    };
}

function closePlayer() {
    elements.html5Player.pause();
    elements.html5Player.src = '';
    elements.playerModal.classList.add('hidden');
}

// פתיחה בנגן שולחני חיצוני (VLC וכו')
async function openExternalPlayer(id, path = null) {
    try {
        showToast('פותח את הקובץ בנגן המדיה המקומי... 🎬', 'info');
        const res = await fetch('/api/open-external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, path })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('הקובץ נפתח בהצלחה!', 'success');
        } else {
            showToast(data.detail || 'שגיאה בפתיחת הנגן המקומי', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('שגיאה בחיבור לשרת', 'error');
    }
}

// סימון פרק כנצפה
async function toggleEpisodeWatched(id) {
    try {
        const res = await fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        return data.watched;
    } catch (err) {
        console.error(err);
        return false;
    }
}

// מודל ארגון קבצים בטוח
async function openOrganizeModal() {
    elements.organizePreview.innerHTML = '<div class="loading-spinner">טוען תצוגה מקדימה של הקבצים...</div>';
    elements.organizeModal.classList.remove('hidden');

    try {
        const res = await fetch('/api/organize/preview');
        const plan = await res.json();

        let html = `
            <div style="margin-bottom: 12px; font-weight: 700; color: var(--neon-cyan);">
                נמצאו ${plan.total_moves} קבצי סדרות המוכנים לסידור בתיקיות מסודרות
            </div>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
        `;

        plan.moves.slice(0, 10).forEach(m => {
            html += `
                <li style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                    <span style="direction: ltr; font-size: 12px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(m.filename)}</span>
                    <span style="color: var(--neon-purple); font-weight: 700;">➔ ${escapeHtml(m.series)} / עונה ${m.season}</span>
                </li>
            `;
        });

        if (plan.moves.length > 10) {
            html += `<li style="text-align: center; color: var(--text-muted); padding-top: 6px;">ועוד ${plan.moves.length - 10} קבצים נוספים...</li>`;
        }
        html += `</ul>`;

        elements.organizePreview.innerHTML = html;
    } catch (err) {
        elements.organizePreview.innerHTML = '<div style="color: var(--neon-rose);">שגיאה בטעינת תצוגה מקדימה</div>';
    }
}

async function executeFileOrganization() {
    elements.btnConfirmOrganize.disabled = true;
    elements.btnConfirmOrganize.innerHTML = '<span>מארגן קבצים... אנא המתן</span>';

    try {
        const res = await fetch('/api/organize/execute', { method: 'POST' });
        const result = await res.json();

        if (res.ok) {
            showToast(`הארגון הושלם! ${result.total_executed} קבצים סודרו בבטחה בתיקיית סדרות 🎉`, 'success');
            elements.organizeModal.classList.add('hidden');
            fetchLibraryData();
        } else {
            showToast('אירעה שגיאה בעת ארגון הקבצים', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('שגיאה בחיבור לשרת', 'error');
    } finally {
        elements.btnConfirmOrganize.disabled = false;
        elements.btnConfirmOrganize.innerHTML = '<span>בצע ארגון עכשיו</span>';
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
