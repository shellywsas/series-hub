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
    videoContainer: document.getElementById('video-container'),
    html5Player: document.getElementById('html5-player'),
    playerOpenVlcBtn: document.getElementById('player-open-vlc-btn'),
    playerFullscreenBtn: document.getElementById('player-fullscreen-btn'),
    btnSkipBackward: document.getElementById('btn-skip-backward'),
    btnSkipForward: document.getElementById('btn-skip-forward'),
    btnSkipFullscreen: document.getElementById('btn-skip-fullscreen'),
    onVideoControls: document.getElementById('on-video-controls'),
    skipFeedback: document.getElementById('skip-feedback'),

    // מודל מעבר אוטומטי לפרק הבא (רעיון 1)
    nextEpOverlay: document.getElementById('next-ep-overlay'),
    nextEpTitle: document.getElementById('next-ep-title'),
    countdownNum: document.getElementById('countdown-num'),
    btnNextNow: document.getElementById('btn-next-now'),
    btnNextCancel: document.getElementById('btn-next-cancel'),

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

    // מסך מלא (Fullscreen) – כפתור עליון וכפתור על הווידאו
    if (elements.playerFullscreenBtn) {
        elements.playerFullscreenBtn.addEventListener('click', toggleContainerFullscreen);
    }
    if (elements.btnSkipFullscreen) {
        elements.btnSkipFullscreen.addEventListener('click', toggleContainerFullscreen);
    }

    // דאבל קליק על מיכל הווידאו למסך מלא
    if (elements.videoContainer) {
        elements.videoContainer.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            toggleContainerFullscreen();
        });

        // הצגת כפתורי הדילוג בתנועת עכבר והסתרתם בחוסר פעילות
        let controlsHideTimeout = null;
        elements.videoContainer.addEventListener('mousemove', () => {
            if (elements.onVideoControls) {
                elements.onVideoControls.classList.add('visible');
                clearTimeout(controlsHideTimeout);
                controlsHideTimeout = setTimeout(() => {
                    if (!elements.html5Player.paused) {
                        elements.onVideoControls.classList.remove('visible');
                    }
                }, 2200);
            }
        });
        elements.videoContainer.addEventListener('mouseleave', () => {
            if (elements.onVideoControls && !elements.html5Player.paused) {
                elements.onVideoControls.classList.remove('visible');
            }
        });
    }

    // אם הדפדפן נכנס למסך מלא רק על הווידאו, נעביר אותו למיכל השלם כדי שכל הכפתורים יישארו על המסך
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === elements.html5Player) {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => {
                    elements.videoContainer.requestFullscreen().catch(() => {});
                }).catch(() => {});
            }
        }
    });

    // ביטול מוחלט של התנהגות החצים המובנית של הדפדפן על נגן הווידאו למניעת דילוג כפול (יותר מ-10 שניות)
    elements.html5Player.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    });

    // דילוג 10 שניות קדימה ואחורה בלחיצה על הכפתורים
    elements.btnSkipBackward.addEventListener('click', (e) => {
        e.stopPropagation();
        skipTime(-10);
    });
    elements.btnSkipForward.addEventListener('click', (e) => {
        e.stopPropagation();
        skipTime(10);
    });

    // כפתורי מעבר לפרק הבא (רעיון 1)
    if (elements.btnNextNow) {
        elements.btnNextNow.addEventListener('click', (e) => {
            e.stopPropagation();
            playNextEpisodeNow();
        });
    }
    if (elements.btnNextCancel) {
        elements.btnNextCancel.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelNextEpisodeCountdown();
        });
    }

    // מעקב התקדמות שוטף: שמירת שנייה מדויקת + בדיקה אם להציע את הפרק הבא
    elements.html5Player.addEventListener('timeupdate', () => {
        handleProgressSaving();
        checkForNextEpisodePrompt();
    });

    // מעקב סיום וידאו
    elements.html5Player.addEventListener('ended', () => {
        handleEpisodeEnded();
    });

    // לכידת מקשים גלובלית במצב Capture כדי לתפוס בדיוק 10 שניות בלי התערבות הדפדפן
    window.addEventListener('keydown', handleGlobalKeyControls, true);

    // שאלת סימון נצפה
    elements.btnPromptYes.addEventListener('click', async () => {
        if (state.currentPlayingEpisode) {
            await setEpisodeWatchedExplicit(state.currentPlayingEpisode.id, true);
            showCuteToast('הפרק סומן כנצפה בהצלחה! 💖', 'success');
        }
        elements.watchedPromptModal.classList.add('hidden');
        closePlayer();
        fetchLibraryData(true);
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

    // סנכרון אוטומטי ברקע של סדרות ופרקים חדשים שהורדו למחשב כל 20 שניות
    setInterval(() => {
        if (elements.playerModal.classList.contains('hidden')) {
            fetchLibraryData(true);
        }
    }, 20000);

    window.addEventListener('focus', () => {
        if (elements.playerModal.classList.contains('hidden')) {
            fetchLibraryData(true);
        }
    });
}

// לכידת מקשים מדויקת
function handleGlobalKeyControls(e) {
    // קיצורי מקשים כשהנגן פתוח (עובד גם במסך מלא!)
    if (!elements.playerModal.classList.contains('hidden')) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            skipTime(10);
            return false;
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            skipTime(-10);
            return false;
        } else if (e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            togglePlayPause();
            return false;
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            e.stopPropagation();
            toggleContainerFullscreen();
            return false;
        } else if (e.key === 'Escape') {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                // הדפדפן ייצא ממסך מלא לבד
                return;
            }
            if (!elements.watchedPromptModal.classList.contains('hidden')) {
                elements.watchedPromptModal.classList.add('hidden');
                return false;
            }
            tryClosePlayerWithPrompt();
            return false;
        }
    }

    if (e.key === 'Escape') {
        if (!elements.watchedPromptModal.classList.contains('hidden')) {
            elements.watchedPromptModal.classList.add('hidden');
            return;
        }
        if (!elements.seriesFullscreenView.classList.contains('hidden')) {
            elements.seriesFullscreenView.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
}

// מעבר למסך מלא (על כל המיכל כולל הכפתורים)
function toggleContainerFullscreen() {
    const vc = elements.videoContainer;
    if (!vc) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (vc.requestFullscreen) {
            vc.requestFullscreen().catch(() => {});
        } else if (vc.webkitRequestFullscreen) {
            vc.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function togglePlayPause() {
    if (!elements.html5Player) return;
    if (elements.html5Player.paused) {
        elements.html5Player.play().catch(() => {});
    } else {
        elements.html5Player.pause();
    }
}

// פונקציות דילוג 10 שניות בדיוק ואנימציית משוב
let feedbackTimeout = null;
function skipTime(seconds) {
    if (!elements.html5Player) return;
    const cur = elements.html5Player.currentTime || 0;
    const dur = elements.html5Player.duration;
    
    let target = cur + seconds;
    if (dur && !isNaN(dur) && dur > 0) {
        target = Math.max(0, Math.min(dur, target));
    } else {
        target = Math.max(0, target);
    }

    elements.html5Player.currentTime = target;
    showSkipFeedback(seconds > 0 ? `⏩ +10 שניות` : `⏪ 10- שניות`);
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

        const hasResume = ep.timestamp && ep.timestamp > 15 && !ep.watched;
        const resumeMins = hasResume ? Math.floor(ep.timestamp / 60) : 0;
        const resumeSecs = hasResume ? ('0' + Math.floor(ep.timestamp % 60)).slice(-2) : '00';

        card.innerHTML = `
            <div class="ep-card-top">
                <div class="ep-title-clean">
                    פרק ${ep.episode}
                    ${hasResume ? `<span class="ep-resume-badge" title="עצרת בדקה ${resumeMins}:${resumeSecs}">⏱️ ${resumeMins}:${resumeSecs}</span>` : ''}
                </div>
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
                    <button class="btn-bubble btn-bubble-primary btn-play-browser">${hasResume ? 'המשך צפייה ⏱️' : 'צפי עכשיו ✨'}</button>
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
            fetchLibraryData(true);
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
            fetchLibraryData(true);
        };

        elements.episodesList.appendChild(card);
    });
}

let nextEpCountdownTimer = null;
let nextEpisodeTarget = null;
let hasShownNextEpPrompt = false;
let lastSavedProgress = 0;

// נגן וידאו מובנה ומהיר באיכות מקורית מלאה (עם המשך צפייה ומעבר לפרק הבא)
function openInBrowserPlayer(ep) {
    state.activeEpisodeForVLC = ep;
    state.currentPlayingEpisode = ep;
    state.playbackPlayDuration = 0;
    hasShownNextEpPrompt = false;
    nextEpisodeTarget = null;
    lastSavedProgress = 0;
    cancelNextEpisodeCountdown();

    clearInterval(state.playbackTimer);
    state.playbackTimer = setInterval(() => {
        if (!elements.html5Player.paused) {
            state.playbackPlayDuration += 1;
        }
    }, 1000);

    elements.playerTitle.textContent = `${ep.series} - פרק ${ep.episode}`;
    elements.html5Player.src = `/api/stream/${ep.id}`;
    elements.playerModal.classList.remove('hidden');

    // רעיון 2: המשך צפייה מהשנייה המדויקת שנשמרה
    const savedTime = ep.timestamp || 0;
    const onLoadedMetadata = () => {
        const dur = elements.html5Player.duration || 0;
        if (savedTime > 8 && (!dur || savedTime < dur - 15)) {
            elements.html5Player.currentTime = savedTime;
            const mins = Math.floor(savedTime / 60);
            const secs = ('0' + Math.floor(savedTime % 60)).slice(-2);
            showCuteToast(`ממשיך מאיפה שעצרת (דקה ${mins}:${secs}) ⏱️`, 'info');
        }
    };
    elements.html5Player.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

    elements.html5Player.play().catch(e => console.log('Autoplay:', e));
}

// שמירת מיקום צפייה מדויק בזמן אמת (רעיון 2)
function handleProgressSaving() {
    if (!elements.html5Player || elements.html5Player.paused || !state.currentPlayingEpisode) return;
    const cur = elements.html5Player.currentTime || 0;
    const dur = elements.html5Player.duration || 0;

    // שומר כל ~3.5 שניות אם עברנו 5 שניות מתחילת הפרק
    if (cur > 5 && Math.abs(cur - lastSavedProgress) >= 3.5) {
        if (!dur || cur < dur - 15) {
            lastSavedProgress = cur;
            state.currentPlayingEpisode.timestamp = cur;
            fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: state.currentPlayingEpisode.id, timestamp: cur })
            }).catch(() => {});
        }
    }
}

// מציאת הפרק הבא בסדרה (עונה נוכחית או עונה הבאה)
function getNextEpisode(currentEp) {
    if (!state.currentSeries || !state.currentSeries.seasons || !currentEp) return null;
    const currentSeason = currentEp.season;
    const seasonEps = state.currentSeries.seasons[currentSeason] || [];

    const currentIndex = seasonEps.findIndex(e => String(e.id) === String(currentEp.id));
    if (currentIndex !== -1 && currentIndex + 1 < seasonEps.length) {
        return seasonEps[currentIndex + 1];
    }

    // אם זה הפרק האחרון בעונה, נבדוק עונה הבאה
    const allSeasons = Object.keys(state.currentSeries.seasons).map(Number).sort((a, b) => a - b);
    const nextSeasonIdx = allSeasons.indexOf(Number(currentSeason)) + 1;
    if (nextSeasonIdx > 0 && nextSeasonIdx < allSeasons.length) {
        const nextSeasonNum = allSeasons[nextSeasonIdx];
        const nextSeasonEps = state.currentSeries.seasons[nextSeasonNum];
        if (nextSeasonEps && nextSeasonEps.length > 0) {
            return nextSeasonEps[0];
        }
    }
    return null;
}

// בדיקה אם להציע מעבר לפרק הבא כשהסוף מתקרב (רעיון 1)
function checkForNextEpisodePrompt() {
    if (!elements.html5Player || !state.currentPlayingEpisode) return;
    if (hasShownNextEpPrompt) return;

    const dur = elements.html5Player.duration || 0;
    const cur = elements.html5Player.currentTime || 0;

    // הופעת חלון מעבר לפרק הבא כשיש 20 שניות או פחות לסוף הפרק
    if (dur > 30 && cur >= dur - 20) {
        triggerNextEpisodeCountdown();
    }
}

function triggerNextEpisodeCountdown() {
    if (hasShownNextEpPrompt) return;
    const nextEp = getNextEpisode(state.currentPlayingEpisode);
    if (!nextEp) return;

    hasShownNextEpPrompt = true;
    nextEpisodeTarget = nextEp;

    elements.nextEpTitle.textContent = `${nextEp.series} - עונה ${nextEp.season} פרק ${nextEp.episode}`;
    elements.nextEpOverlay.classList.remove('hidden');

    let secondsLeft = 5;
    elements.countdownNum.textContent = secondsLeft;

    clearInterval(nextEpCountdownTimer);
    nextEpCountdownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft > 0) {
            elements.countdownNum.textContent = secondsLeft;
        } else {
            clearInterval(nextEpCountdownTimer);
            playNextEpisodeNow();
        }
    }, 1000);
}

function playNextEpisodeNow() {
    clearInterval(nextEpCountdownTimer);
    elements.nextEpOverlay.classList.add('hidden');

    if (state.currentPlayingEpisode) {
        // סימון הפרק הנוכחי כנצפה אוטומטית ואיפוס התקדמות
        setEpisodeWatchedExplicit(state.currentPlayingEpisode.id, true);
        fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: state.currentPlayingEpisode.id, timestamp: 0 })
        }).catch(() => {});
    }

    if (nextEpisodeTarget) {
        const next = nextEpisodeTarget;
        nextEpisodeTarget = null;
        hasShownNextEpPrompt = false;
        openInBrowserPlayer(next);
        fetchLibraryData(true);
    }
}

function cancelNextEpisodeCountdown() {
    clearInterval(nextEpCountdownTimer);
    if (elements.nextEpOverlay) {
        elements.nextEpOverlay.classList.add('hidden');
    }
}

function handleEpisodeEnded() {
    const nextEp = getNextEpisode(state.currentPlayingEpisode);
    if (nextEp && !hasShownNextEpPrompt) {
        triggerNextEpisodeCountdown();
    } else if (!nextEp) {
        if (state.currentPlayingEpisode && !state.currentPlayingEpisode.watched) {
            elements.watchedPromptModal.classList.remove('hidden');
        }
    }
}

// סגירת נגן עם שאלה אם לסמן כנצפה
function tryClosePlayerWithPrompt() {
    elements.html5Player.pause();
    clearInterval(state.playbackTimer);
    cancelNextEpisodeCountdown();

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
    cancelNextEpisodeCountdown();
    elements.html5Player.removeAttribute('src');
    elements.html5Player.load();
    elements.playerModal.classList.add('hidden');
    clearInterval(state.playbackTimer);
    state.currentPlayingEpisode = null;
    hasShownNextEpPrompt = false;
    nextEpisodeTarget = null;
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

        const hasResume = ep.timestamp && ep.timestamp > 15 && !ep.watched;
        const resumeMins = hasResume ? Math.floor(ep.timestamp / 60) : 0;
        const resumeSecs = hasResume ? ('0' + Math.floor(ep.timestamp % 60)).slice(-2) : '00';

        card.innerHTML = `
            <div class="ep-card-top">
                <div>
                    <h3 style="font-size: 18px; font-weight: 900;">${escapeHtml(ep.series)}</h3>
                    <div style="font-size: 14px; color: var(--pastel-rose); font-weight: 800; display: flex; align-items: center; gap: 8px;">
                        עונה ${ep.season} · פרק ${ep.episode}
                        ${hasResume ? `<span class="ep-resume-badge" title="עצרת בדקה ${resumeMins}:${resumeSecs}">⏱️ ${resumeMins}:${resumeSecs}</span>` : ''}
                    </div>
                </div>
                <button class="icon-btn fav-btn active" title="הסר ממועדפים">⭐</button>
            </div>
            <div class="ep-card-buttons">
                ${ep.is_playable_in_browser ? `
                    <button class="btn-bubble btn-bubble-primary btn-fav-play">${hasResume ? 'המשך צפייה ⏱️' : 'צפי עכשיו ✨'}</button>
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
