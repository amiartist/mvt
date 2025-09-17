// Basic multi-viewer for YouTube, Twitch & VK Video
(function () {
    // Cycling text in h1 span
    const cyclingSpan = document.querySelector('.brand span');
    const texts = ['YouTube', 'Twitch', 'VK Video Live'];
    let currentIndex = 0;

    function cycleText() {
        cyclingSpan.textContent = texts[currentIndex];
        currentIndex = (currentIndex + 1) % texts.length;
    }

    // Start cycling every 3 seconds
    cycleText(); // Set initial text
    setInterval(cycleText, 3000);

    const grid = document.getElementById('grid');
    const urlInput = document.getElementById('urlInput');
    const clearInput = document.getElementById('clearInput');
    const addBtn = document.getElementById('addBtn');
    const layoutBtns = document.querySelectorAll('.layout-btn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    document.body.classList.add('l1');

    const slots = new Map();

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
        let playerContent = slotEl.querySelector('.player-content');
        if (!playerContent) {
            playerContent = document.createElement('div');
            playerContent.className = 'player-content';
            slotEl.appendChild(playerContent);
        }
        playerContent.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.allow = 'autoplay; encrypted-media; web-share; clipboard-write';
        iframe.src = 'https://www.youtube.com/embed/' + id + '?autoplay=0&mute=1&playsinline=1&rel=0';
        iframe.allowFullscreen = 'allowFullscreen';
        playerContent.appendChild(iframe);
        slotEl.querySelector('.cell-bar').classList.add('active');
        return iframe;
    }

    function mountTwitch(slotEl, channel) {
        let playerContent = slotEl.querySelector('.player-content');
        if (!playerContent) {
            playerContent = document.createElement('div');
            playerContent.className = 'player-content';
            slotEl.appendChild(playerContent);
        }
        playerContent.innerHTML = '';
        const container = document.createElement('div');
        const id = 'tw-' + Math.random().toString(36).slice(2);
        container.id = id;
        container.className = 'twitch-embed';
        playerContent.appendChild(container);
        const player = new Twitch.Player(id, { width: '100%', height: '100%', channel, autoplay: false, muted: true, parent: [location.hostname], chat: false });
        slotEl.querySelector('.cell-bar').classList.add('active');
        return player;
    }

    function mountVKVideo(slotEl, params) {
        let playerContent = slotEl.querySelector('.player-content');
        if (!playerContent) {
            playerContent = document.createElement('div');
            playerContent.className = 'player-content';
            slotEl.appendChild(playerContent);
        }
        playerContent.innerHTML = '';
        const iframe = document.createElement('iframe');
        let src;
        if (params.channel) {
            // For live.vkvideo.ru channels, we need to construct the embed URL
            // This might require additional API calls or different handling
            src = 'https://live.vkvideo.ru/app/embed/' + params.channel + '?autoplay=false&muted=true&stream_btn=false';
        } else if (params.oid && params.id) {
            // For regular VK videos
            src = 'https://vk.com/video_ext.php?oid=' + params.oid + '&id=' + params.id + '&autoplay=0&muted=true&stream_btn=false';
        }
        iframe.src = src;
        iframe.allowFullscreen = 'allowfullscreen';
        playerContent.appendChild(iframe);
        slotEl.querySelector('.cell-bar').classList.add('active');
        return iframe;
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
        const cellName = outer.querySelector('.cell-name');
        if (parsed.type === 'youtube') {
            cellName.textContent = 'YouTube'; // + parsed.id
        } else if (parsed.type === 'twitch') {
            cellName.textContent = 'Twitch: ' + parsed.channel;
        } else if (parsed.type === 'vkvideo') {
            cellName.textContent = 'VK: ' + (parsed.channel || (parsed.oid + '_' + parsed.id));
        }
        urlInput.value = ''; // Очищаем поле ввода после успешного добавления
    }

    function moveSlot(from, direction) {
        const to = from + direction;
        if (to < 1 || to > 6) return;
        if (!slots.has(from)) return;
        const fromData = slots.get(from);
        let toData = null;
        if (slots.has(to)) {
            toData = slots.get(to);
        }
        slots.set(to, fromData);
        if (toData) {
            slots.set(from, toData);
        } else {
            slots.delete(from);
        }
        const fromCell = grid.querySelector('[data-slot="' + from + '"]');
        const toCell = grid.querySelector('[data-slot="' + to + '"]');
        let fromContent = fromCell.querySelector('.player-content');
        if (!fromContent) {
            fromContent = document.createElement('div');
            fromContent.className = 'player-content';
            fromCell.appendChild(fromContent);
        }
        let toContent = toCell.querySelector('.player-content');
        if (!toContent) {
            toContent = document.createElement('div');
            toContent.className = 'player-content';
            toCell.appendChild(toContent);
        }
        const tempHTML = fromContent.innerHTML;
        fromContent.innerHTML = toContent.innerHTML;
        toContent.innerHTML = tempHTML;
        const fromBar = fromCell.querySelector('.cell-bar');
        const toBar = toCell.querySelector('.cell-bar');
        if (toData) {
            fromBar.classList.add('active');
            toBar.classList.add('active');
        } else {
            fromBar.classList.remove('active');
            toBar.classList.add('active');
        }
        const fromName = fromCell.querySelector('.cell-name');
        const toName = toCell.querySelector('.cell-name');
        const tempName = fromName.textContent;
        fromName.textContent = toName.textContent;
        toName.textContent = tempName;
    }

    function removeSlot(slot) {
        if (!slots.has(slot)) return;
        const data = slots.get(slot);
        try { if (data.api && typeof data.api.destroy === 'function') data.api.destroy(); } catch { }
        slots.delete(slot);
        const cell = grid.querySelector('[data-slot="' + slot + '"]');
        const content = cell.querySelector('.player-content');
        if (content) content.innerHTML = '';
        const name = cell.querySelector('.cell-name');
        name.textContent = '';
        cell.querySelector('.cell-bar').classList.remove('active');
    }

    function clearAll() {
        for (let i = 1; i <= 6; i++) {
            removeSlot(i);
        }
    }

    // Events
    addBtn.addEventListener('click', () => { if (urlInput.value.trim()) addByUrl(urlInput.value.trim()); });
    clearInput.addEventListener('click', () => { urlInput.value = ''; urlInput.focus(); });
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { addBtn.click(); } });
    clearAllBtn.addEventListener('click', clearAll);

    layoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all layout buttons
            layoutBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Switch layout
            document.body.classList.remove('l1', 'l2', 'l3');
            document.body.classList.add(btn.dataset.layout);
        });
    });

    document.querySelectorAll('.cell-btn-group button').forEach(btn => {
        if (btn.textContent === '←') {
            btn.addEventListener('click', () => {
                const cell = btn.closest('.cell');
                const slot = parseInt(cell.dataset.slot);
                moveSlot(slot, -1);
            });
        } else if (btn.textContent === '→') {
            btn.addEventListener('click', () => {
                const cell = btn.closest('.cell');
                const slot = parseInt(cell.dataset.slot);
                moveSlot(slot, 1);
            });
        } else if (btn.textContent === 'Remove') {
            btn.addEventListener('click', () => {
                const cell = btn.closest('.cell');
                const slot = parseInt(cell.dataset.slot);
                removeSlot(slot);
            });
        }
    });

    // Help popup functionality
    const helpBtn = document.getElementById('helpBtn');
    const helpPopup = document.getElementById('helpPopup');
    const closePopup = document.getElementById('closePopup');

    helpBtn.addEventListener('click', () => {
        helpPopup.style.display = 'flex';
    });

    closePopup.addEventListener('click', () => {
        helpPopup.style.display = 'none';
    });

    // Close popup when clicking outside
    helpPopup.addEventListener('click', (e) => {
        if (e.target === helpPopup) {
            helpPopup.style.display = 'none';
        }
    });
})();
