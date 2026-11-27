document.addEventListener('DOMContentLoaded', async function () {
    const cfg = window.GAME_CONFIG || {};
    const root = document.documentElement;

    function stripQuotes(str) {
        return str.trim().replace(/^["']+|["']+$/g, '').trim();
    }

    // 1. Parse Hex Color, Luminance (> #808080 check), and Contrasting Hues
    function hexToHsl(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), r, g, b };
    }

    const bgHex = cfg['photo.background'] || '#2967d8';
    const hsl = hexToHsl(bgHex);

    const brightness = (hsl.r * 299 + hsl.g * 587 + hsl.b * 114) / 1000;
    const isLightBg = brightness > 0.5;
    const textColor = isLightBg ? '#111111' : '#ffffff';

    const songHue = (hsl.h + 145) % 360;
    const btnHue = (hsl.h + 215) % 360;
    const songColor = isLightBg ? `hsl(${songHue}, 85%, 30%)` : `hsl(${songHue}, 95%, 72%)`;
    const btnColor = `hsl(${btnHue}, 85%, 52%)`;

    root.style.setProperty('--bg-color', bgHex);
    root.style.setProperty('--text-color', textColor);
    root.style.setProperty('--song-color', songColor);
    root.style.setProperty('--btn-color', btnColor);
    root.style.setProperty('--btn-text-color', '#ffffff');

    // 2. Grab title and genre from the .info file and remove any quotes
    let titleText = stripQuotes(cfg.title || 'Untitled Game');
    let genreText = stripQuotes(cfg['main.genre'] || 'Retro');

    if (cfg.infoFile) {
        try {
            const res = await fetch(cfg.infoFile);
            if (res.ok) {
                const infoContent = await res.text();
                const titleMatch = infoContent.match(/^title\s*=\s*(.+)$/mi);
                const genreMatch = infoContent.match(/^genre\s*=\s*(.+)$/mi);
                if (titleMatch) titleText = stripQuotes(titleMatch[1]);
                if (genreMatch) genreText = stripQuotes(genreMatch[1]);
            }
        } catch (err) {
            console.warn('Could not load .info file, using fallback values:', err);
        }
    }

    document.title = `${titleText} - Project School Stash`;

    // 3. Inject the 6x6 Quadrant Layout into <body>
    const photoSrc = cfg['game.photo'] || 'favicon.png';
    const descriptionText = cfg.description || '';
    const songTitle = stripQuotes(cfg['song.title'] || '');
    const songLink = cfg['song.link'] || '#';

    document.body.innerHTML = `
        <audio id="myAudio" autoplay loop preload="auto">
            <source src="music.opus" type="audio/ogg; codecs=opus">
            <source src="music.mp3" type="audio/mpeg">
        </audio>

        <main class="pss-stage">
            <nav class="pss-home-nav">
                <button class="pss-home-btn" onclick="window.location.href='/project-school-stash/';">← Home</button>
            </nav>

            <div class="pss-audio-controls">
                <button id="muteBtn" aria-label="Toggle Mute">🔊</button>
                <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.65" aria-label="Music Volume">
            </div>

            <section class="pss-left-col">
                <p class="pss-genre">A ${genreText} game!</p>
                <img class="pss-photo" src="${photoSrc}" alt="${titleText}">
                <button class="pss-play-btn" onclick="window.location.href='game.html';">Play Now!</button>
            </section>

            <section class="pss-right-col">
                <a id="songBanner" class="pss-song-link" href="${songLink}" target="_blank" rel="noopener">
                    You are now hearing: "${songTitle}"
                </a>
                <h1 id="gameTitle" class="pss-title">${titleText}</h1>
                <p class="pss-description">${descriptionText}</p>
            </section>
        </main>
    `;

    // Auto-shrink title font-size if a very long title exceeds its container width
    const titleEl = document.getElementById('gameTitle');
    function fitTitleToOneLine() {
        titleEl.style.fontSize = '';
        let currentSize = parseFloat(window.getComputedStyle(titleEl).fontSize);
        while (titleEl.scrollWidth > titleEl.parentElement.clientWidth && currentSize > 14) {
            currentSize -= 1;
            titleEl.style.fontSize = `${currentSize}px`;
        }
    }
    fitTitleToOneLine();
    window.addEventListener('resize', fitTitleToOneLine);

    // 4. Persistent Volume Control + Muted-Start Autoplay Trick
    const audio = document.getElementById('myAudio');
    const volumeSlider = document.getElementById('volumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    const songBanner = document.getElementById('songBanner');

    const VOLUME_KEY = 'pss_music_volume';
    const MUTED_KEY = 'pss_music_muted';

    const savedVolume = localStorage.getItem(VOLUME_KEY);
    const userPrefersMuted = localStorage.getItem(MUTED_KEY) === 'true';

    // Default to 0.65 (matching your homepage) unless the user previously adjusted the slider
    const targetVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.65;
    audio.volume = targetVolume;
    volumeSlider.value = userPrefersMuted ? 0 : targetVolume;

    function syncAudioUI() {
        const isSilent = audio.paused || audio.muted || audio.volume === 0;
        if (audio.muted || audio.volume === 0) {
            muteBtn.textContent = '🔇';
        } else if (audio.volume < 0.5) {
            muteBtn.textContent = '🔉';
        } else {
            muteBtn.textContent = '🔊';
        }

        if (!isSilent && songTitle) {
            songBanner.classList.add('is-playing');
        } else {
            songBanner.classList.remove('is-playing');
        }
    }

    audio.addEventListener('play', syncAudioUI);
    audio.addEventListener('playing', syncAudioUI);
    audio.addEventListener('pause', syncAudioUI);
    audio.addEventListener('volumechange', syncAudioUI);

    volumeSlider.addEventListener('input', function () {
        const newVol = parseFloat(this.value);
        audio.volume = newVol;
        audio.muted = (newVol === 0);
        if (newVol > 0 && audio.paused) audio.play().catch(() => {});

        localStorage.setItem(VOLUME_KEY, newVol);
        localStorage.setItem(MUTED_KEY, audio.muted);
        syncAudioUI();
    });

    muteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        audio.muted = !audio.muted;
        localStorage.setItem(MUTED_KEY, audio.muted);

        if (audio.muted) {
            volumeSlider.value = 0;
        } else {
            const restoreVol = audio.volume > 0 ? audio.volume : 0.65;
            audio.volume = restoreVol;
            volumeSlider.value = restoreVol;
            localStorage.setItem(VOLUME_KEY, restoreVol);
            if (audio.paused) audio.play().catch(() => {});
        }
        syncAudioUI();
    });

    // Fallback unlock on first interaction if a strict browser pauses after unmuting
    const unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'click'];
    function unlockOnInteraction() {
        audio.muted = userPrefersMuted;
        audio.play().then(() => {
            syncAudioUI();
            unlockEvents.forEach(evt => window.removeEventListener(evt, unlockOnInteraction, true));
        }).catch(() => {});
    }
    unlockEvents.forEach(evt => window.addEventListener(evt, unlockOnInteraction, true));

    // Muted-start autoplay trick: start muted to bypass restriction, then unmute immediately
    audio.muted = true;
    audio.play().then(function () {
        audio.muted = userPrefersMuted;
        syncAudioUI();
        if (!audio.paused) {
            unlockEvents.forEach(evt => window.removeEventListener(evt, unlockOnInteraction, true));
        }
    }).catch(function () {
        audio.muted = userPrefersMuted;
        syncAudioUI();
    });
});