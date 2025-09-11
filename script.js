// Basic multi-viewer for YouTube, Twitch & VK Video
(function () {
    const grid = document.getElementById('grid');
    const urlInput = document.getElementById('urlInput');
    const clearInput = document.getElementById('clearInput');
    const addBtn = document.getElementById('addBtn');
    const layoutBtns = document.querySelectorAll('.layout-btn');
    const muteBtn = document.getElementById('muteBtn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    document.body.classList.add('l1');

    const slots = new Map();
    let isMuted = false; // Track mute state

    function nextEmptySlot() {
        for (let i = 1; i <= 6; i++) {
            if (!slots.has(i)) return i;
        }
        return null;
    }

    function parseService(url) {
        try { url = new URL(url); } catch { return null; }
        const host = url.hostname.replace('www.', '');
        // YouTube: watch?v=, youtu.be/ID, /live/
        if (host.includes('youtube.com') || host.includes('youtu.be')) {
            let id = null;
            if (host === 'youtu.be') { id = url.pathname.slice(1); }
            if (!id) { id = url.searchParams.get('v'); }
            if (!id && url.pathname.includes('/live/')) {
                id = url.pathname.split('/live/')[1]?.split(/[?/]/)[0];
            }
            if (id) { return { type: 'youtube', id }; }
        }
        // Twitch: channel or video
        if (host.includes('twitch.tv')) {
            const path = url.pathname.replace(/^\//, '');
            if (path) {
                return { type: 'twitch', channel: path.split('/')[0] };
            }
        }
        // VK Video: live.vkvideo.ru or vk.com/video
        if (host.includes('vkvideo.ru') || host.includes('vk.com')) {
            if (host === 'live.vkvideo.ru') {
                const path = url.pathname.replace(/^\//, '');
                if (path) {
                    return { type: 'vkvideo', channel: path };
                }
            } else if (host.includes('vk.com')) {
                const path = url.pathname;
                if (path.includes('/video')) {
                    const match = path.match(/\/video(-?\d+)_(\d+)/);
                    if (match) {
                        return { type: 'vkvideo', oid: match[1], id: match[2] };
                    }
                }
            }
        }
        return null;
    }

    function mountYouTube(slotEl, id) {
        const iframe = document.createElement('iframe');
        iframe.allow = 'autoplay; encrypted-media';
        iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=0&mute=1&playsinline=1';
        slotEl.innerHTML = '';
        slotEl.appendChild(iframe);
        return {
            play() { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*'); },
            pause() { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*'); },
            mute() { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'mute' }), '*'); },
            unmute() { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'unMute' }), '*'); },
            destroy() { iframe.remove(); }
        };
    }

    function mountTwitch(slotEl, channel) {
        const container = document.createElement('div');
        const id = 'tw-' + Math.random().toString(36).slice(2);
        container.id = id;
        container.className = 'twitch-embed';
        slotEl.innerHTML = '';
        slotEl.appendChild(container);
        const player = new Twitch.Player(id, { width: '100%', height: '100%', channel, autoplay: false, muted: true, parent: [location.hostname], chat: false });
        return {
            play() { try { player.getPlayer().play(); } catch { } },
            pause() { try { player.getPlayer().pause(); } catch { } },
            mute() { try { player.getPlayer().setMuted(true); } catch { } },
            unmute() { try { player.getPlayer().setMuted(false); } catch { } },
            destroy() { container.remove(); }
        };
    }

    function mountVKVideo(slotEl, params) {
        const iframe = document.createElement('iframe');
        iframe.allow = 'autoplay; encrypted-media';
        let src;
        if (params.channel) {
            // For live.vkvideo.ru channels, we need to construct the embed URL
            // This might require additional API calls or different handling
            src = 'https://live.vkvideo.ru/embed/' + params.channel + '?autoplay=true&muted=true';
        } else if (params.oid && params.id) {
            // For regular VK videos
            src = 'https://vk.com/video_ext.php?oid=' + params.oid + '&id=' + params.id + '&autoplay=0&mute=1';
        }
        iframe.src = src;
        slotEl.innerHTML = '';
        slotEl.appendChild(iframe);
        return {
            play() { /* VK Video iframe doesn't support postMessage like YouTube */ },
            pause() { /* VK Video iframe doesn't support postMessage like YouTube */ },
            mute() { /* VK Video iframe doesn't support postMessage like YouTube */ },
            unmute() { /* VK Video iframe doesn't support postMessage like YouTube */ },
            destroy() { iframe.remove(); }
        };
    }

    function addByUrl(url) {
        const parsed = parseService(url);
        if (!parsed) { alert('Не удалось распознать ссылку. Поддерживаются YouTube, Twitch и VK Video.'); return; }
        const slotNum = nextEmptySlot();
        if (!slotNum) { alert('Все слоты заняты'); return; }
        const outer = grid.querySelector('[data-slot="' + slotNum + '"]');
        let api;
        if (parsed.type === 'youtube') api = mountYouTube(outer, parsed.id);
        if (parsed.type === 'twitch') api = mountTwitch(outer, parsed.channel);
        if (parsed.type === 'vkvideo') api = mountVKVideo(outer, parsed);
        slots.set(slotNum, { type: parsed.type, api });
        urlInput.value = ''; // Очищаем поле ввода после успешного добавления
    }

    function clearAll() {
        slots.forEach((v, k) => { try { v.api.destroy(); } catch { } });
        slots.clear();
        grid.querySelectorAll('.cell').forEach(cell => {
            const num = cell.getAttribute('data-slot');
            cell.innerHTML = '<div class="placeholder">' + num + '</div>';
        });
    }

    function setMuted(muted) {
        slots.forEach(({ api }) => { try { muted ? api.mute() : api.unmute(); } catch { } });
    }
    function setPlaying(playing) {
        slots.forEach(({ api }) => { try { playing ? api.play() : api.pause(); } catch { } });
    }

    // Events
    addBtn.addEventListener('click', () => { if (urlInput.value.trim()) addByUrl(urlInput.value.trim()); });
    clearInput.addEventListener('click', () => { urlInput.value = ''; urlInput.focus(); });
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addBtn.click(); } });
    clearAllBtn.addEventListener('click', clearAll);
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        setMuted(isMuted);
        muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
    });
    playPauseBtn.addEventListener('click', () => { setPlaying(false); setTimeout(() => setPlaying(true), 50); });
    layoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.classList.remove('l1', 'l2', 'l3');
            document.body.classList.add(btn.dataset.layout);
        });
    });
})();
