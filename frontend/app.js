// מצב האפליקציה (State)
const state = {
    allSeries: [],
    allSongs: [],
    favoriteEpisodes: [],
    filteredSeries: [],
    filteredSongs: [],
    activeFilter: 'all',
    searchQuery: '',
    currentSeries: null,
    currentSeason: null,
    activeEpisodeForVLC: null,
    
    // מעקב צפייה לשאלת סימון נצפה ביציאה
    currentPlayingEpisode: null,
    playbackPlayDuration: 0,
    playbackTimer: null,
};

// אלמנטים מה-DOM
const elements = {
    seriesGrid: document.getElementById('series-grid'),
    songsGrid: document.getElementById('songs-grid'),
    favoritesGrid: document.getElementById('favorites-grid'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterTabs: document.querySelectorAll('.pastel-tab'),

    // תצוגת סדרה מלאה על כל המסך (Fullscreen)
    seriesFullscreenView: document.getElementById('series-fullscreen-view'),
    btnBackToHome: document.getElementById('btn-back-to-home'),
    heroPosterImg: document.getElementById('hero-poster-img'),
    heroSeriesName: document.getElementById('hero-series-name'),
    heroSeasonsCount: document.getElementById('hero-seasons-count'),
    heroEpisodesCount: document.getElementById('hero-episodes-count'),
    heroWatchedProgress: document.getElementById('hero-watched-progress'),
    heroProgressBar: document.getElementById('hero-progress-bar'),
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
    btnSkipBackward: document.getElementById('btn-skip-backward'),
    btnSkipForward: document.getElementById('btn-skip-forward'),
    skipFeedback: document.getElementById('skip-feedback'),

    // מודל שאלת סימון נצפה
    watchedPromptModal: document.getElementById('watched-prompt-modal'),
    btnPromptYes: document.getElementById('btn-prompt-yes'),
    btnPromptNo: document.getElementById('btn-prompt-no'),

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

    // כפתור חזרה מהסדרה לכל הסדרות
    elements.btnBackToHome.addEventListener('click', () => {
        elements.seriesFullscreenView.classList.add('hidden');
        document.body.style.overflow = '';
    });

    // סגירת נגן
    elements.closePlayerModal.addEventListener('click', tryClosePlayerWithPrompt);

    // דילוג 10 שניות קדימה ואחורה
    elements.btnSkipBackward.addEventListener('click', () => skipTime(-10));
    elements.btnSkipForward.addEventListener('click', () => skipTime(10));

    window.addEventListener('keydown', (e) => {
        // קיצורי מקשים בזמן שנגן הווידאו פתוח
        if (!elements.playerModal.classList.contains('hidden')) {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                skipTime(10);
                return;
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                skipTime(-10);
                return;
            } else if (e.key === ' ') {
                e.preventDefault();
                if (elements.html5Player.paused) {
                    elements.html5Player.play();
                } else {
                    elements.html5Player.pause();
                }
                return;
            }
        }

        if (e.key === 'Escape') {
            if (!elements.watchedPromptModal.classList.contains('hidden')) {
                elements.watchedPromptModal.classList.add('hidden');
                return;
            }
            if (!elements.playerModal.classList.contains('hidden')) {
                tryClosePlayerWithPrompt();
                return;
            }
            if (!elements.seriesFullscreenView.classList.contains('hidden')) {
                elements.seriesFullscreenView.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }
    });

    // שאלת סימון נצפה
    elements.btnPromptYes.addEventListener('click', async () => {
        if (state.currentPlayingEpisode) {
            await setEpisodeWatchedExplicit(state.currentPlayingEpisode.id, true);
            showCuteToast('הפרק סומן כנצפה בהצלחה! 💖', 'success');
        }
        elements.watchedPromptModal.classList.add('hidden');
        closePlayer();
        fetchLibraryData();
    });

    elements.btnPromptNo.addEventListener('click', () => {
        elements.watchedPromptModal.classList.add('hidden');
        closePlayer();
    });

    // כפתור VLC מתוך הנגן
    elements.playerOpenVlcBtn.addEventListener('click', () => {
        if (state.activeEpisodeForVLC) {
            openExternalPlayer(state.activeEpisodeForVLC.id, state.activeEpisodeForVLC.path);
        }
    });

    // מעקב סיום וידאו
    elements.html5Player.addEventListener('ended', () => {
        if (state.currentPlayingEpisode && !state.currentPlayingEpisode.watched) {
            elements.watchedPromptModal.classList.remove('hidden');
        }
    });
}

// פונקציות דילוג 10 שניות ואנימציית משוב
let feedbackTimeout = null;
function skipTime(seconds) {
    if (!elements.html5Player) return;
    const cur = elements.html5Player.currentTime || 0;
    const dur = elements.html5Player.duration || Infinity;
    elements.html5Player.currentTime = Math.max(0, Math.min(dur, cur + seconds));
    
    showSkipFeedback(seconds > 0 ? `⏩ +${seconds} שניות` : `⏪ ${seconds} שניות`);
}

function showSkipFeedback(text) {
    if (!elements.skipFeedback) return;
    elements.skipFeedback.textContent = text;
    elements.skipFeedback.classList.remove('hidden');
    elements.skipFeedback.style.animation = 'none';
    elements.skipFeedback.offsetHeight; /* trigger reflow */
    elements.skipFeedback.style.animation = null;
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => {
        elements.skipFeedback.classList.add('hidden');
    }, 450);
}

// קבלת נתונים מהשרת
async function fetchLibraryData() {
    try {
        const res = await fetch('/api/series');
        const data = await res.json();

        state.allSeries = (data.series || []).filter(s => s.name !== 'פרקים בודדים');
        state.allSongs = data.songs || [];
        state.favoriteEpisodes = data.favorites || [];

        applyFilters();

        // אם תצוגת סדרה פתוחה, רענן את נתוניה
        if (state.currentSeries && !elements.seriesFullscreenView.classList.contains('hidden')) {
            openSeriesFullscreen(state.currentSeries.name, state.currentSeason);
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        showCuteToast('שגיאה בהתחברות לשרת 🌸', 'error');
    }
}

// החלת סינונים
function applyFilters() {
    // 1. טאב שירים
    if (state.activeFilter === 'songs') {
        elements.seriesGrid.classList.add('hidden');
        elements.favoritesGrid.classList.add('hidden');
        elements.songsGrid.classList.remove('hidden');

        let songs = [...state.allSongs];
        if (state.searchQuery) {
            songs = songs.filter(s => s.title.toLowerCase().includes(state.searchQuery));
        }
        state.filteredSongs = songs;
        renderSongsGrid();
        return;
    }

    // 2. טאב מועדפים
    if (state.activeFilter === 'favorites') {
        elements.seriesGrid.classList.add('hidden');
        elements.songsGrid.classList.add('hidden');
        elements.favoritesGrid.classList.remove('hidden');

        let favs = [...state.favoriteEpisodes];
        if (state.searchQuery) {
            favs = favs.filter(e => (e.series || '').toLowerCase().includes(state.searchQuery));
        }
        renderFavoritesGrid(favs);
        return;
    }

    // 3. תצוגת סדרות רגילה
    elements.songsGrid.classList.add('hidden');
    elements.favoritesGrid.classList.add('hidden');
    elements.seriesGrid.classList.remove('hidden');

    let result = [...state.allSeries];

    if (state.searchQuery) {
        result = result.filter(s => s.name.toLowerCase().includes(state.searchQuery));
    }

    if (state.activeFilter === 'unwatched') {
        result = result.filter(s => s.watched_episodes === 0);
    } else if (state.activeFilter === 'completed') {
        result = result.filter(s => s.watched_episodes === s.total_episodes && s.total_episodes > 0);
    }

    state.filteredSeries = result;
    renderSeriesGrid();
}

// רינדור גריד סדרות
function renderSeriesGrid() {
    elements.seriesGrid.innerHTML = '';

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

// כרטיסיית סדרה – פוסטר שלם ולא חתוך!
function createCuteCard(series) {
    const card = document.createElement('div');
    card.className = 'cute-card';

    const progressPercent = series.total_episodes > 0 
        ? Math.round((series.watched_episodes / series.total_episodes) * 100) 
        : 0;

    const isCompleted = progressPercent === 100 && series.total_episodes > 0;

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

    card.addEventListener('click', () => openSeriesFullscreen(series.name));
    return card;
}

// פתיחת מסך סדרה מלא (Full Screen Netflix-Style)
async function openSeriesFullscreen(seriesName, targetSeason = null) {
    try {
        const res = await fetch(`/api/series/${encodeURIComponent(seriesName)}`);
        if (!res.ok) throw new Error('Failed to load series');
        const data = await res.json();

        state.currentSeries = data;
        elements.heroSeriesName.textContent = data.name;
        elements.heroEpisodesCount.textContent = `${data.total_episodes} פרקים`;

        if (data.poster) {
            elements.heroPosterImg.src = data.poster;
            elements.heroPosterImg.classList.remove('hidden');
        } else {
            elements.heroPosterImg.classList.add('hidden');
        }

        const seasonKeys = Object.keys(data.seasons).sort((a, b) => Number(a) - Number(b));
        elements.heroSeasonsCount.textContent = `${seasonKeys.length} עונות`;

        let totalWatched = 0;
        seasonKeys.forEach(sNum => {
            totalWatched += data.seasons[sNum].filter(e => e.watched).length;
        });
        const percent = data.total_episodes > 0 ? Math.round((totalWatched / data.total_episodes) * 100) : 0;
        elements.heroWatchedProgress.textContent = `${percent}% נצפו`;
        elements.heroProgressBar.style.width = `${percent}%`;

        // רינדור טאבים של עונות
        elements.seasonsTabs.innerHTML = '';
        seasonKeys.forEach((sNum, index) => {
            const btn = document.createElement('button');
            btn.className = `season-btn-pill ${((targetSeason && Number(sNum) === Number(targetSeason)) || (!targetSeason && index === 0)) ? 'active' : ''}`;
            btn.textContent = `עונה ${sNum} (${data.seasons[sNum].length})`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.season-btn-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderCleanEpisodes(sNum);
            });
            elements.seasonsTabs.appendChild(btn);
        });

        const initialSeason = targetSeason && seasonKeys.includes(String(targetSeason)) ? String(targetSeason) : seasonKeys[0];
        renderCleanEpisodes(initialSeason);

        elements.seriesFullscreenView.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error(err);
        showCuteToast('שגיאה בטעינת הסדרה 🌸', 'error');
    }
}

// רינדור פרקים נקי לחלוטין (כמו נטפליקס - ללא כיתובים טכניים!)
function renderCleanEpisodes(seasonNum) {
    state.currentSeason = seasonNum;
    const episodes = state.currentSeries.seasons[seasonNum] || [];

    elements.currentSeasonTitle.textContent = `עונה ${seasonNum}`;
    elements.currentSeasonCount.textContent = `${episodes.length} פרקים`;
    elements.episodesList.innerHTML = '';

    episodes.forEach(ep => {
        const card = document.createElement('div');
        card.className = `clean-episode-card ${ep.watched ? 'watched' : ''}`;

        card.innerHTML = `
            <div class="ep-card-top">
                <div class="ep-title-clean">פרק ${ep.episode}</div>
                <div class="ep-card-icons">
                    <button class="icon-btn fav-btn ${ep.favorite ? 'active' : ''}" title="${ep.favorite ? 'הסר ממועדפים' : 'שמור במועדפים שאהבתי'}">
                        ⭐
                    </button>
                    <button class="icon-btn watch-btn ${ep.watched ? 'active' : ''}" title="${ep.watched ? 'סמן כלא נצפה' : 'סמן כנצפה'}">
                        ${ep.watched ? '💖' : '🤍'}
                    </button>
                </div>
            </div>
            <div class="ep-card-buttons">
                ${ep.is_playable_in_browser ? `
                    <button class="btn-bubble btn-bubble-primary btn-play-browser">צפי עכשיו ✨</button>
                ` : ''}
                <button class="btn-bubble btn-bubble-soft btn-play-vlc">נגן במחשב (VLC)</button>
            </div>
        `;

        // ניגון בדפדפן
        const playBtn = card.querySelector('.btn-play-browser');
        if (playBtn) {
            playBtn.onclick = () => openInBrowserPlayer(ep);
        }

        // נגן מקומי
        const vlcBtn = card.querySelector('.btn-play-vlc');
        if (vlcBtn) {
            vlcBtn.onclick = () => openExternalPlayer(ep.id, ep.path);
        }

        // כפתור מועדפים ⭐
        const favBtn = card.querySelector('.fav-btn');
        favBtn.onclick = async () => {
            const isFav = await toggleFavoriteStatus(ep.id);
            ep.favorite = isFav;
            favBtn.classList.toggle('active', isFav);
            showCuteToast(isFav ? 'נוסף למועדפים שאהבת! ⭐' : 'הוסר מהמועדפים 🌸', 'info');
            fetchLibraryData();
        };

        // כפתור נצפה 💖
        const watchBtn = card.querySelector('.watch-btn');
        watchBtn.onclick = async () => {
            const isWatched = await toggleWatchedStatus(ep.id);
            ep.watched = isWatched;
            card.classList.toggle('watched', isWatched);
            watchBtn.classList.toggle('active', isWatched);
            watchBtn.textContent = isWatched ? '💖' : '🤍';
            showCuteToast(isWatched ? 'סומן כנצפה! 💖' : 'הוסר מנצפה 🌸', 'info');
            fetchLibraryData();
        };

        elements.episodesList.appendChild(card);
    });
}

// נגן וידאו מובנה ומהיר באיכות מקורית מלאה
function openInBrowserPlayer(ep) {
    state.activeEpisodeForVLC = ep;
    state.currentPlayingEpisode = ep;
    state.playbackPlayDuration = 0;

    clearInterval(state.playbackTimer);
    state.playbackTimer = setInterval(() => {
        if (!elements.html5Player.paused) {
            state.playbackPlayDuration += 1;
        }
    }, 1000);

    elements.playerTitle.textContent = `${ep.series} - פרק ${ep.episode}`;
    elements.html5Player.src = `/api/stream/${ep.id}`;
    elements.playerModal.classList.remove('hidden');
    elements.html5Player.play().catch(e => console.log('Autoplay:', e));
}

// סגירת נגן עם שאלה אם לסמן כנצפה
function tryClosePlayerWithPrompt() {
    elements.html5Player.pause();
    clearInterval(state.playbackTimer);

    const ep = state.currentPlayingEpisode;
    if (ep && !ep.watched) {
        const duration = elements.html5Player.duration || 0;
        const currentTime = elements.html5Player.currentTime || 0;
        const ratio = duration > 0 ? (currentTime / duration) : 0;

        // אם צפה בלמעלה מ-35% מהפרק או שהיה יותר מ-45 שניות בצפייה
        if (ratio >= 0.35 || state.playbackPlayDuration >= 45) {
            elements.watchedPromptModal.classList.remove('hidden');
            return;
        }
    }

    closePlayer();
}

function closePlayer() {
    elements.html5Player.pause();
    elements.html5Player.removeAttribute('src');
    elements.html5Player.load();
    elements.playerModal.classList.add('hidden');
    clearInterval(state.playbackTimer);
    state.currentPlayingEpisode = null;
}

// רינדור פרקים מועדפים
function renderFavoritesGrid(favs) {
    elements.favoritesGrid.innerHTML = '';
    if (favs.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }
    elements.emptyState.classList.add('hidden');

    favs.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'clean-episode-card';
        card.innerHTML = `
            <div class="ep-card-top">
                <div>
                    <h3 style="font-size: 18px; font-weight: 900;">${escapeHtml(ep.series)}</h3>
                    <div style="font-size: 14px; color: var(--pastel-rose); font-weight: 800;">עונה ${ep.season} · פרק ${ep.episode}</div>
                </div>
                <button class="icon-btn fav-btn active" title="הסר ממועדפים">⭐</button>
            </div>
            <div class="ep-card-buttons">
                ${ep.is_playable_in_browser ? `
                    <button class="btn-bubble btn-bubble-primary btn-fav-play">צפי עכשיו ✨</button>
                ` : ''}
                <button class="btn-bubble btn-bubble-soft btn-fav-vlc">נגן במחשב (VLC)</button>
            </div>
        `;

        const playBtn = card.querySelector('.btn-fav-play');
        if (playBtn) playBtn.onclick = () => openInBrowserPlayer(ep);

        const vlcBtn = card.querySelector('.btn-fav-vlc');
        if (vlcBtn) vlcBtn.onclick = () => openExternalPlayer(ep.id, ep.path);

        const starBtn = card.querySelector('.fav-btn');
        starBtn.onclick = async () => {
            await toggleFavoriteStatus(ep.id);
            showCuteToast('הוסר מהמועדפים 🌸', 'info');
            fetchLibraryData();
        };

        elements.favoritesGrid.appendChild(card);
    });
}

// רינדור שירים
function renderSongsGrid() {
    elements.songsGrid.innerHTML = '';
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
                    series: 'שיר אישי',
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

// API קריאות
async function openExternalPlayer(id, path = null) {
    try {
        showCuteToast('פותח בנגן המדיה במחשב... 🎬', 'info');
        const res = await fetch('/api/open-external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, path })
        });
        const data = await res.json();
        if (res.ok) {
            showCuteToast('הפרק נפתח בהצלחה! 🍿', 'success');
        } else {
            showCuteToast(data.detail || 'שגיאה בפתיחת הנגן', 'error');
        }
    } catch (err) {
        showCuteToast('שגיאה בהתחברות לשרת', 'error');
    }
}

async function toggleWatchedStatus(id) {
    try {
        const res = await fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        return data.watched;
    } catch (err) {
        return false;
    }
}

async function setEpisodeWatchedExplicit(id, val) {
    try {
        await fetch('/api/watched', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, watched: val })
        });
    } catch (err) {}
}

async function toggleFavoriteStatus(id) {
    try {
        const res = await fetch('/api/favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        return data.favorite;
    } catch (err) {
        return false;
    }
}

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
