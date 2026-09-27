// מצב האפליקציה (State)
const state = {
    allSeries: [],
    allSongs: [],
    filteredSeries: [],
    filteredSongs: [],
    activeFilter: 'all',
    searchQuery: '',
    currentSeries: null,
    currentSeason: null,
    activeEpisodeForVLC: null,
};

// אלמנטים מה-DOM
const elements = {
    seriesGrid: document.getElementById('series-grid'),
    songsGrid: document.getElementById('songs-grid'),
    emptyState: document.getElementById('empty-state'),
    contentHeading: document.getElementById('content-heading'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterTabs: document.querySelectorAll('.pastel-tab'),
    visibleSeriesCount: document.getElementById('visible-series-count'),

    // סטטיסטיקות סוכרייה
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
    modalPosterImg: document.getElementById('modal-poster-img'),
    modalSeriesName: document.getElementById('modal-series-name'),
    modalFormatsBadge: document.getElementById('modal-formats-badge'),
    modalSeasonsCount: document.getElementById('modal-seasons-count'),
    modalEpisodesCount: document.getElementById('modal-episodes-count'),
    modalWatchedProgress: document.getElementById('modal-watched-progress'),
    modalProgressBar: document.getElementById('modal-progress-bar'),
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

    // התראות
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

    // כפתורי סינון פסטליים
    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeFilter = tab.dataset.filter;
            applyFilters();
        });
    });

    // סגירת מודלים
    elements.closeSeriesModal.addEventListener('click', () => elements.seriesModal.classList.add('hidden'));
    elements.closePlayerModal.addEventListener('click', closePlayer);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.seriesModal.classList.add('hidden');
            closePlayer();
        }
    });

    // כפתור VLC מתוך הנגן המובנה
    elements.playerOpenVlcBtn.addEventListener('click', () => {
        if (state.activeEpisodeForVLC) {
            openExternalPlayer(state.activeEpisodeForVLC.id, state.activeEpisodeForVLC.path);
        }
    });
}

// קבלת נתונים מהשרת
async function fetchLibraryData() {
    try {
        const [seriesRes, statsRes] = await Promise.all([
            fetch('/api/series'),
            fetch('/api/stats')
        ]);

        const seriesData = await seriesRes.json();
        const statsData = await statsRes.json();

        // סינון סדרות: מוציאים פרקים בודדים מהרשימה הראשית של הסדרות
        state.allSeries = (seriesData.series || []).filter(s => s.name !== 'פרקים בודדים');
        state.allSongs = seriesData.songs || [];

        updateStats(statsData);
        applyFilters();
        updateLastWatchedBanner(statsData.last_watched);
    } catch (err) {
        console.error('Error fetching data:', err);
        showCuteToast('שגיאה בהתחברות לשרת 🌸', 'error');
    }
}

// עדכון סטטיסטיקות
function updateStats(stats) {
    elements.statSeries.textContent = state.allSeries.length;
    
    let totalEps = 0;
    state.allSeries.forEach(s => totalEps += s.total_episodes);
    elements.statEpisodes.textContent = totalEps;
    
    elements.statWatched.textContent = stats.total_watched || 0;
}

// עדכון באנר המשך צפייה
function updateLastWatchedBanner(lastWatched) {
    if (!lastWatched || !lastWatched.series) {
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

// החלת סינונים
function applyFilters() {
    if (state.activeFilter === 'songs') {
        elements.contentHeading.textContent = 'שירים ויצירות אישיות 🎵';
        elements.seriesGrid.classList.add('hidden');
        elements.songsGrid.classList.remove('hidden');

        let songs = [...state.allSongs];
        if (state.searchQuery) {
            songs = songs.filter(s => s.title.toLowerCase().includes(state.searchQuery));
        }
        state.filteredSongs = songs;
        renderSongsGrid();
        return;
    }

    // תצוגת סדרות רגילה
    elements.songsGrid.classList.add('hidden');
    elements.seriesGrid.classList.remove('hidden');
    elements.contentHeading.textContent = 'כל הסדרות המתוקות שלך 🍿';

    let result = [...state.allSeries];

    if (state.searchQuery) {
        result = result.filter(s => s.name.toLowerCase().includes(state.searchQuery));
    }

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

// רינדור גריד הסדרות עם פוסטרים אמיתיים
function renderSeriesGrid() {
    elements.seriesGrid.innerHTML = '';
    elements.visibleSeriesCount.textContent = `${state.filteredSeries.length} סדרות`;

    if (state.filteredSeries.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    state.filteredSeries.forEach(series => {
        const card = createCuteCard(series);
        elements.seriesGrid.appendChild(card);
    });
}

// יצירת כרטיסיית סדרה פסטלית
function createCuteCard(series) {
    const card = document.createElement('div');
    card.className = 'cute-card';

    const progressPercent = series.total_episodes > 0 
        ? Math.round((series.watched_episodes / series.total_episodes) * 100) 
        : 0;

    const formatsStr = series.formats.join(', ');
    const isCompleted = progressPercent === 100 && series.total_episodes > 0;

    // פוסטר אמיתי מהאינטרנט שנשמר מקומית
    let posterHtml = '';
    if (series.poster) {
        posterHtml = `
            <img class="poster-img" src="${series.poster}" alt="${escapeHtml(series.name)}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'poster-fallback\\'>🎬</div>';">
        `;
    } else {
        posterHtml = `<div class="poster-fallback">🎬</div>`;
    }

    card.innerHTML = `
        <div class="poster-box">
            ${posterHtml}
            <div class="format-candy-pill">${formatsStr}</div>
        </div>
        <div class="card-text">
            <h3 class="card-series-name" title="${escapeHtml(series.name)}">${escapeHtml(series.name)}</h3>
            <div class="card-series-meta">
                <span>${series.seasons_count} עונות</span>
                <span class="meta-dot">·</span>
                <span>${series.total_episodes} פרקים</span>
            </div>
            <div class="candy-progress-wrap">
                <div class="candy-progress-info">
                    <span>${isCompleted ? 'הושלם במלואו ✨' : `נצפו: ${series.watched_episodes}/${series.total_episodes}`}</span>
                    <span>${progressPercent}%</span>
                </div>
                <div class="candy-track">
                    <div class="candy-bar ${isCompleted ? 'complete' : ''}" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openSeriesModal(series.name));
    return card;
}

// רינדור שירים ויצירות AI
function renderSongsGrid() {
    elements.songsGrid.innerHTML = '';
    elements.visibleSeriesCount.textContent = `${state.filteredSongs.length} יצירות`;

    if (state.filteredSongs.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    state.filteredSongs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';

        card.innerHTML = `
            <div class="song-info">
                <div class="song-avatar">🎵</div>
                <div class="song-details">
                    <h4>${escapeHtml(song.title)}</h4>
                    <span>${song.format} · ${song.size_mb} MB</span>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                ${song.is_playable_in_browser ? `
                    <button class="btn-bubble btn-bubble-primary btn-play-song">נגן 🎧</button>
                ` : ''}
                <button class="btn-bubble btn-bubble-soft btn-vlc-song">פתח במחשב</button>
            </div>
        `;

        const playBtn = card.querySelector('.btn-play-song');
        if (playBtn) {
            playBtn.onclick = () => {
                openInBrowserPlayer({
                    id: song.id,
                    series: 'שיר / יצירה אישית',
                    season: 1,
                    episode: song.title
                });
            };
        }

        const vlcBtn = card.querySelector('.btn-vlc-song');
        if (vlcBtn) {
            vlcBtn.onclick = () => openExternalPlayer(song.id, song.path);
        }

        elements.songsGrid.appendChild(card);
    });
}

// פתיחת מודל סדרה
async function openSeriesModal(seriesName, targetSeason = null) {
    try {
        const res = await fetch(`/api/series/${encodeURIComponent(seriesName)}`);
        if (!res.ok) throw new Error('Failed to load series');
        const data = await res.json();

        state.currentSeries = data;
        elements.modalSeriesName.textContent = data.name;
        elements.modalFormatsBadge.textContent = 'סדרת טלוויזיה ✨';
        elements.modalEpisodesCount.textContent = `${data.total_episodes} פרקים`;

        if (data.poster) {
            elements.modalPosterImg.src = data.poster;
            elements.modalPosterImg.classList.remove('hidden');
        } else {
            elements.modalPosterImg.classList.add('hidden');
        }

        const seasonKeys = Object.keys(data.seasons).sort((a, b) => Number(a) - Number(b));
        elements.modalSeasonsCount.textContent = `${seasonKeys.length} עונות`;

        let totalWatched = 0;
        seasonKeys.forEach(sNum => {
            totalWatched += data.seasons[sNum].filter(e => e.watched).length;
        });
        const percent = data.total_episodes > 0 ? Math.round((totalWatched / data.total_episodes) * 100) : 0;
        elements.modalWatchedProgress.textContent = `${percent}% נצפו`;
        elements.modalProgressBar.style.width = `${percent}%`;

        // רינדור טאבים של עונות
        elements.seasonsTabs.innerHTML = '';
        seasonKeys.forEach((sNum, index) => {
            const btn = document.createElement('button');
            btn.className = `season-btn-pill ${((targetSeason && Number(sNum) === Number(targetSeason)) || (!targetSeason && index === 0)) ? 'active' : ''}`;
            btn.textContent = `עונה ${sNum} (${data.seasons[sNum].length})`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.season-btn-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderSeasonEpisodes(sNum);
            });
            elements.seasonsTabs.appendChild(btn);
        });

        const initialSeason = targetSeason && seasonKeys.includes(String(targetSeason)) ? String(targetSeason) : seasonKeys[0];
        renderSeasonEpisodes(initialSeason);

        elements.seriesModal.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        showCuteToast('שגיאה בטעינת הסדרה 🌸', 'error');
    }
}

// רינדור פרקים (בדיוק ללא גלילה כפולה!)
function renderSeasonEpisodes(seasonNum) {
    state.currentSeason = seasonNum;
    const episodes = state.currentSeries.seasons[seasonNum] || [];

    elements.currentSeasonTitle.textContent = `עונה ${seasonNum}`;
    elements.currentSeasonCount.textContent = `${episodes.length} פרקים 🍿`;
    elements.episodesList.innerHTML = '';

    episodes.forEach(ep => {
        const row = document.createElement('div');
        row.className = `episode-item ${ep.watched ? 'watched' : ''}`;

        row.innerHTML = `
            <div class="ep-left">
                <div class="ep-bubble-num">${ep.episode}</div>
                <div class="ep-text">
                    <h4>פרק ${ep.episode}</h4>
                    <div class="ep-text-meta">
                        <span class="ep-format-tag">${ep.format}</span>
                        <span>${ep.size_mb} MB</span>
                    </div>
                </div>
            </div>
            <div class="ep-actions">
                ${ep.is_playable_in_browser ? `
                    <button class="btn-bubble btn-bubble-primary btn-ep-play">צפי עכשיו ✨</button>
                ` : ''}
                <button class="btn-bubble btn-bubble-soft btn-ep-vlc">נגן במחשב (VLC)</button>
                <button class="btn-fav-watch ${ep.watched ? 'watched' : ''}" title="${ep.watched ? 'סמן כלא נצפה' : 'סמן כנצפה'}">
                    ${ep.watched ? '💖' : '🤍'}
                </button>
            </div>
        `;

        // כפתור ניגון בדפדפן
        const playBtn = row.querySelector('.btn-ep-play');
        if (playBtn) {
            playBtn.onclick = () => openInBrowserPlayer(ep);
        }

        // כפתור נגן מקומי
        const vlcBtn = row.querySelector('.btn-ep-vlc');
        if (vlcBtn) {
            vlcBtn.onclick = () => openExternalPlayer(ep.id, ep.path);
        }

        // סימון נצפה
        const heartBtn = row.querySelector('.btn-fav-watch');
        heartBtn.onclick = async () => {
            const isWatched = await toggleEpisodeWatched(ep.id);
            ep.watched = isWatched;
            row.classList.toggle('watched', isWatched);
            heartBtn.classList.toggle('watched', isWatched);
            heartBtn.textContent = isWatched ? '💖' : '🤍';
            showCuteToast(isWatched ? 'סומן כנצפה! 💖' : 'הוסר מנצפה 🌸', 'info');
            fetchLibraryData();
        };

        elements.episodesList.appendChild(row);
    });
}

// נגן וידאו מובנה ומהיר באיכות מקסימלית
function openInBrowserPlayer(ep) {
    state.activeEpisodeForVLC = ep;
    elements.playerTitle.textContent = `${ep.series} - עונה ${ep.season} פרק ${ep.episode}`;
    elements.html5Player.src = `/api/stream/${ep.id}`;
    elements.playerModal.classList.remove('hidden');
    elements.html5Player.play().catch(e => console.log('Autoplay prevented:', e));

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

// פתיחה בנגן שולחני
async function openExternalPlayer(id, path = null) {
    try {
        showCuteToast('פותח בנגן המדיה המקומי... 🎬', 'info');
        const res = await fetch('/api/open-external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, path })
        });
        const data = await res.json();
        if (res.ok) {
            showCuteToast('הפרק נפתח במחשב בהצלחה! 🍿', 'success');
        } else {
            showCuteToast(data.detail || 'שגיאה בפתיחת הנגן', 'error');
        }
    } catch (err) {
        console.error(err);
        showCuteToast('שגיאה בהתחברות לשרת', 'error');
    }
}

// סימון נצפה
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

// התראות סוכרייה מתוקות
function showCuteToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `candy-toast toast-${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(14px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
