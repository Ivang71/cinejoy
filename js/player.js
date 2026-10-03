// Watch page and player. A real HTML5 player with a rearrangeable control bar.
// Playback sources are supplied by the site owner in js/config.js:
//
//   window.CINEJOY_CONFIG.sources = [{
//     name: 'Main',
//     // return null when the title is unavailable; otherwise a playable URL
//     resolve: async ({ type, id, season, episode, title }) =>
//       ({ url: 'https://example.com/video.mp4', subtitles: [{ label: 'English', lang: 'en', src: '/subs/en.vtt' }] }),
//   }];
//
// Nothing is bundled: with no sources configured the player shows its error state.
import { icon } from './icons.js';
import { img, getDetails, getSeason, hrefFor, watchHref, typeFromRoute, keyOf, getCatalog } from './data.js';
import { store } from './store.js';
import { esc, footer, toast, trailerModal } from './components.js';
import { navigate, back } from './router.js';

export const CONTROLS = {
  play: { label: 'Play / Pause', icon: 'play', required: true },
  back: { label: 'Skip back', icon: 'rewind' },
  forward: { label: 'Skip forward', icon: 'forward' },
  volume: { label: 'Volume', icon: 'volumeLow' },
  time: { label: 'Time', icon: 'clock' },
  episodes: { label: 'Episodes', icon: 'stack', tv: true },
  pip: { label: 'Picture in picture', icon: 'pip' },
  sources: { label: 'Sources', icon: 'cloud' },
  subtitles: { label: 'Subtitles', icon: 'subtitles' },
  settings: { label: 'Settings', icon: 'gear' },
  fullscreen: { label: 'Fullscreen', icon: 'maximize' },
  download: { label: 'Download', icon: 'download', action: true },
  next: { label: 'Next episode', icon: 'skipNext', action: true },
};
export const DEFAULT_LAYOUT = { left: ['play', 'back', 'forward', 'volume', 'time'], right: ['episodes', 'pip', 'sources', 'subtitles', 'settings', 'fullscreen'] };
export function getLayout() {
  const raw = store.settings.playerLayout; const seen = new Set();
  const clean = a => (Array.isArray(a) ? a : []).filter(id => CONTROLS[id] && !seen.has(id) && seen.add(id));
  if (!raw || !raw.left || !raw.right) return { left: [...DEFAULT_LAYOUT.left], right: [...DEFAULT_LAYOUT.right] };
  const left = clean(raw.left), right = clean(raw.right);
  if (!seen.has('play')) left.unshift('play');
  return { left, right };
}
export const trayItems = layout => Object.keys(CONTROLS).filter(id => !layout.left.includes(id) && !layout.right.includes(id));

// ---------------------------------------------------------------- sources
const cfgSources = () => ((window.CINEJOY_CONFIG || {}).sources || []).filter(s => s && s.name && typeof s.resolve === 'function');
export function orderedSources() {
  const order = store.settings.serverOrder || []; const list = cfgSources();
  return [...list].sort((a, b) => { const ia = order.indexOf(a.name), ib = order.indexOf(b.name); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
}
export const sourceCount = () => cfgSources().length;

const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(x).padStart(2, '0'); };
let hlsPromise = null;
const loadHls = () => hlsPromise || (hlsPromise = import('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.mjs').then(m => m.default).catch(() => null));

function controlHtml(id, ctx) {
  const c = CONTROLS[id]; if (!c) return '';
  if (c.tv && ctx.type !== 'tv') return '';
  if (id === 'next' && !ctx.hasNext) return '';
  if (id === 'time') return `<span class="pl-time tabular" data-pl="time">0:00 / 0:00</span>`;
  if (id === 'volume') return `<span class="pl-vol"><button class="pl-btn" data-pl="mute" aria-label="Mute">${icon('volumeLow', 24)}</button><input class="pl-vol-range" type="range" min="0" max="1" step="0.02" value="1" aria-label="Volume" /></span>`;
  if (id === 'play') return `<button class="pl-btn is-play" data-pl="play" aria-label="Play">${icon('play', 26)}</button>`;
  if (id === 'back') return `<button class="pl-btn" data-pl="back" aria-label="Skip back">${icon('rewind', 26)}</button>`;
  if (id === 'forward') return `<button class="pl-btn" data-pl="forward" aria-label="Skip forward">${icon('forward', 26)}</button>`;
  if (c.action) return `<button class="pl-pill" data-pl="${id}">${icon(c.icon, 18)}<span>${c.label}</span></button>`;
  return `<button class="pl-btn" data-pl="${id}" aria-label="${c.label}" aria-haspopup="${['sources', 'subtitles', 'settings', 'episodes'].includes(id) ? 'true' : 'false'}">${icon(c.icon, 24)}</button>`;
}

// ---------------------------------------------------------------- watch page
export async function watchPage(routeType, idStr, seasonStr, episodeStr) {
  const type = typeFromRoute(routeType); const id = Number(idStr);
  const season = Number(seasonStr || 1), episode = Number(episodeStr || 1);
  const d = await getDetails(type, id);
  let eps = []; let epInfo = null;
  if (type === 'tv') { try { eps = await getSeason(id, season); epInfo = eps.find(e => e.num === episode) || null; } catch { eps = []; } }
  const pkey = type === 'tv' ? `${d.key}:${season}:${episode}` : d.key;
  const sub = type === 'tv' ? `S${season} · E${episode}${epInfo?.title ? ` · ${epInfo.title}` : ''}` : (d.year || '');
  const trailer = d.trailers?.[0];
  const layout = getLayout();
  const ctx = { type, hasNext: false };
  const bar = ids => ids.map(i => controlHtml(i, ctx)).join('');
  const html = `
  <div class="player is-loading" id="player" data-controls="show" tabindex="-1">
    ${d.backdrop || epInfo?.still ? `<img class="player-bg" src="${img(epInfo?.still || d.backdrop, 'w1280')}" alt="" />` : ''}
    <video id="pv" playsinline preload="auto"></video>
    <div class="player-top">
      <button class="pl-btn" data-pl="exit" aria-label="Go back">${icon('arrowLeft', 26)}</button>
      <div class="player-title"><b class="clamp-1">${esc(d.title)}</b><span class="clamp-1">${esc(sub)}</span></div>
      <button class="pl-btn" data-pl="cast" aria-label="Cast" hidden>${icon('cast', 24)}</button>
    </div>
    <div class="player-center" id="pl-center"></div>
    <div class="player-tap" id="pl-tap"></div>
    <div class="player-bottom">
      <div class="pl-seek" id="pl-seek" role="slider" aria-label="Seek" tabindex="0"><div class="pl-track"><i class="pl-buf"></i><i class="pl-fill"></i></div><span class="pl-thumb"></span><span class="pl-tip">0:00</span></div>
      <div class="pl-bar"><div class="pl-left" id="pl-left">${bar(layout.left)}</div><div class="pl-right" id="pl-right">${bar(layout.right)}</div></div>
    </div>
    <div class="pl-panel" id="pl-panel" hidden></div>
    <div class="pl-upnext" id="pl-upnext" hidden></div>
  </div>`;
  return {
    title: `${d.title} - Cinejoy`, html, back: true, bare: true,
    async mount(root) {
      const player = root.querySelector('#player'); const video = root.querySelector('#pv'); const center = root.querySelector('#pl-center');
      const panel = root.querySelector('#pl-panel'); const seek = root.querySelector('#pl-seek');
      const disposers = []; const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); disposers.push(() => t.removeEventListener(ev, fn, o)); };
      const q = s => root.querySelector(s);
      const sources = orderedSources(); let srcIdx = 0; let hls = null; let tried = 0; let startAt = 0; let nextEp = null; let hideTimer = 0; let saveTimer = 0; let upnextTimer = 0; let destroyed = false;
      const seekStep = () => Number(store.settings.seekTime) || 10;

      // ---- state helpers
      const setState = s => { player.classList.toggle('is-loading', s === 'loading'); player.classList.toggle('is-error', s === 'error'); player.classList.toggle('is-ready', s === 'ready'); };
      const showControls = () => { player.dataset.controls = 'show'; clearTimeout(hideTimer); if (!video.paused && panel.hidden) hideTimer = setTimeout(() => { if (!video.paused && panel.hidden) player.dataset.controls = 'hide'; }, 3000); };
      const sync = () => {
        const t = video.currentTime || 0, du = video.duration || 0;
        q('.pl-fill').style.transform = `scaleX(${du ? t / du : 0})`; q('.pl-thumb').style.left = `${du ? t / du * 100 : 0}%`;
        const b = video.buffered; q('.pl-buf').style.transform = `scaleX(${du && b.length ? b.end(b.length - 1) / du : 0})`;
        const tm = q('[data-pl="time"]'); if (tm) tm.textContent = `${fmt(t)} / ${fmt(du)}`;
        const pb = q('[data-pl="play"]'); if (pb) { pb.innerHTML = icon(video.paused ? 'play' : 'pause', 26); pb.setAttribute('aria-label', video.paused ? 'Play' : 'Pause'); }
        seek.setAttribute('aria-valuenow', Math.round(t)); seek.setAttribute('aria-valuemax', Math.round(du));
        const fs = q('[data-pl="fullscreen"]'); if (fs) fs.innerHTML = icon(document.fullscreenElement ? 'minimize' : 'maximize', 24);
        const mu = q('[data-pl="mute"]'); if (mu) mu.innerHTML = icon(video.muted || video.volume === 0 ? 'volumeMute' : 'volumeLow', 24);
        if (type === 'tv' && nextEp && du && du - t < Math.min(25, du * 0.1) && !upnextTimer && store.settings.autoplay && !video.paused) showUpNext();
      };
      const saveProgress = () => { if (video.duration && video.currentTime > 5) { store.setProgress(pkey, video.currentTime, video.duration); if (video.currentTime / video.duration > 0.92) store.setWatchedMany([pkey], true); } };

      // ---- loading
      const errorScreen = (code, hint) => {
        setState('error');
        center.innerHTML = `<div class="pl-error"><img class="pl-error-mark" src="/brand/logomark-white.svg" alt="" width="104" height="104" /><h2>Oops! We couldn't find this</h2><p class="code"><span>Code:</span> ${esc(code)}</p><p class="hint">${esc(hint)}</p>
          <div class="pl-error-acts"><button class="pill-btn is-lg" data-pl="exit">Go Back</button><button class="pill-btn is-primary is-lg" data-pl="retry">Try Again</button>${trailer ? `<button class="pill-btn is-lg" data-pl="trailer">${icon('play', 16)}<span>Trailer</span></button>` : ''}</div></div>`;
      };
      const teardownMedia = () => { if (hls) { try { hls.destroy(); } catch { /* ignore */ } hls = null; } video.removeAttribute('src'); video.querySelectorAll('track').forEach(t => t.remove()); try { video.load(); } catch { /* ignore */ } };
      const attach = async res => {
        teardownMedia();
        const url = res.url; const isHls = res.type === 'hls' || /\.m3u8(\?|$)/.test(url);
        if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
          const Hls = await loadHls(); if (!Hls || !Hls.isSupported()) throw new Error('HLS is not supported in this browser');
          hls = new Hls({ enableWorker: true }); hls.loadSource(url); hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) onFail(new Error(data.details)); });
        } else video.src = url;
        for (const t of res.subtitles || []) { const tr = document.createElement('track'); tr.kind = 'subtitles'; tr.label = t.label || t.lang || 'Subtitles'; tr.srclang = t.lang || 'en'; tr.src = t.src; video.appendChild(tr); }
        [...video.textTracks].forEach(t => { t.mode = 'disabled'; });
        if (store.settings.autoSubtitles) { const pref = store.settings.defaultSubtitleLanguage || 'en'; const tt = [...video.textTracks].find(t => (t.language || '').startsWith(pref)); if (tt) tt.mode = 'showing'; }
      };
      const onFail = err => { if (destroyed) return; console.warn('[player]', err?.message || err); tried++; if (tried < sources.length) { srcIdx = (srcIdx + 1) % sources.length; toast(`Trying ${sources[srcIdx].name}…`, 'refresh'); load(video.currentTime || startAt); } else errorScreen('Playback failed on every source', 'Check the source URLs in js/config.js, then try again.'); };
      const load = async (at = 0) => {
        startAt = at; setState('loading'); center.innerHTML = `<div class="pl-spinner" aria-label="Loading"></div>`;
        if (!sources.length) { errorScreen('No playback source configured', 'Add a source in js/config.js, or watch the trailer instead.'); return; }
        const src = sources[srcIdx];
        try {
          const res = await src.resolve({ type, id, season, episode, title: d.title, year: d.year });
          if (destroyed) return; if (!res || !res.url) throw new Error(`${src.name} has nothing for this title`);
          await attach(res);
          const resume = store.getProgress(pkey); if (!at && resume && resume.t > 10 && resume.d - resume.t > 30) startAt = resume.t; else startAt = at;
          try { await video.play(); } catch { /* autoplay blocked: user can press play */ }
        } catch (e) { onFail(e); }
      };
      video.addEventListener('loadedmetadata', () => { if (startAt) { try { video.currentTime = startAt; } catch { /* ignore */ } } applyFit(); applyBoost(); });
      for (const ev of ['canplay', 'playing']) video.addEventListener(ev, () => { setState('ready'); center.innerHTML = ''; });
      video.addEventListener('waiting', () => { if (!video.paused) center.innerHTML = `<div class="pl-spinner" aria-label="Buffering"></div>`; });
      video.addEventListener('error', () => onFail(new Error(video.error?.message || 'media error')));
      for (const ev of ['timeupdate', 'play', 'pause', 'progress', 'durationchange', 'volumechange']) video.addEventListener(ev, sync);
      video.addEventListener('play', () => { showControls(); store.pushHistory({ key: d.key, season: type === 'tv' ? season : null, episode: type === 'tv' ? episode : null, title: d.title }); });
      video.addEventListener('pause', () => { player.dataset.controls = 'show'; saveProgress(); });
      video.addEventListener('ended', () => { saveProgress(); if (nextEp && store.settings.autoplay) goNext(); else { player.dataset.controls = 'show'; } });
      saveTimer = setInterval(saveProgress, 5000);

      // ---- fit, boost, speed
      const applyFit = () => { video.style.objectFit = store.settings.videoFitMode || 'contain'; };
      let audio = null;
      const applyBoost = () => {
        const boost = Number(store.settings.volumeBoost) || 100; if (boost <= 100 && !audio) return;
        try { if (!audio) { const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(); const src = ac.createMediaElementSource(video); const gain = ac.createGain(); src.connect(gain); gain.connect(ac.destination); audio = { ac, gain }; } audio.gain.gain.value = boost / 100; if (audio.ac.state === 'suspended') audio.ac.resume(); } catch { /* cross-origin media cannot be boosted */ }
      };
      const applySubtitleStyle = () => { const s = store.settings; player.style.setProperty('--sub-size', (s.subtitleSize || 100) / 100); player.style.setProperty('--sub-color', s.subtitleColor || '#fff'); player.style.setProperty('--sub-bg', s.subtitleBlur ? '0.55' : '0'); player.style.setProperty('--sub-shadow', s.subtitleBlur ? 'none' : '0 2px 4px #000'); player.style.setProperty('--sub-font', s.subtitleFont === 'Montserrat' ? "Montserrat, Inter, sans-serif" : s.subtitleFont === 'Classic' ? 'Arial, Helvetica, sans-serif' : 'Inter, sans-serif'); };
      applyFit(); applySubtitleStyle();

      // ---- actions
      const toggle = () => { if (video.paused) video.play().catch(() => {}); else video.pause(); showControls(); };
      const skip = dir => { video.currentTime = Math.min(Math.max(0, video.currentTime + dir * seekStep()), video.duration || 1e9); showControls(); flash(dir > 0 ? `+${seekStep()}s` : `−${seekStep()}s`); };
      let flashTimer = 0; const flash = text => { let f = q('.pl-flash'); if (!f) { f = document.createElement('div'); f.className = 'pl-flash'; player.appendChild(f); } f.textContent = text; f.classList.add('is-on'); clearTimeout(flashTimer); flashTimer = setTimeout(() => f.classList.remove('is-on'), 600); };
      const goNext = () => { if (!nextEp) return; saveProgress(); navigate(`/watch/tv/${id}/${nextEp.season}/${nextEp.episode}`); };
      const showUpNext = () => {
        const box = q('#pl-upnext'); let n = 8; box.hidden = false;
        const paint = () => { box.innerHTML = `<div><small>Up next</small><b class="clamp-1">${esc(nextEp.title || `Episode ${nextEp.episode}`)}</b></div><button class="pill-btn is-primary" data-pl="next">Play now · ${n}</button><button class="pill-btn" data-pl="cancel-next">Cancel</button>`; };
        paint(); upnextTimer = setInterval(() => { n--; if (n <= 0) { clearInterval(upnextTimer); goNext(); } else paint(); }, 1000);
      };
      const hideUpNext = () => { clearInterval(upnextTimer); upnextTimer = -1; q('#pl-upnext').hidden = true; };
      const closePanel = () => { panel.hidden = true; panel.innerHTML = ''; showControls(); };
      const openPanel = (kind, anchorBtn) => {
        if (!panel.hidden && panel.dataset.kind === kind) { closePanel(); return; }
        panel.dataset.kind = kind; panel.hidden = false; player.dataset.controls = 'show';
        const track = video.textTracks; const tracks = [...track];
        let body = '';
        if (kind === 'settings') {
          const sp = video.playbackRate; const fit = store.settings.videoFitMode || 'contain'; const boost = Number(store.settings.volumeBoost) || 100; const lv = hls?.levels || [];
          body = `<h3>Settings</h3>
            <div class="pl-group"><span>Speed</span><div class="pl-chips">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(v => `<button data-pl="speed" data-v="${v}" class="${sp === v ? 'is-on' : ''}">${v}×</button>`).join('')}</div></div>
            <div class="pl-group"><span>Video fit</span><div class="pl-chips">${[['contain', 'Fit'], ['cover', 'Fill'], ['fill', 'Stretch']].map(([v, l]) => `<button data-pl="fit" data-v="${v}" class="${fit === v ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="pl-group"><span>Volume boost</span><div class="pl-chips">${[100, 150, 200, 300].map(v => `<button data-pl="boost" data-v="${v}" class="${boost === v ? 'is-on' : ''}">${v}%</button>`).join('')}</div></div>
            ${lv.length ? `<div class="pl-group"><span>Quality</span><div class="pl-chips"><button data-pl="quality" data-v="-1" class="${hls.currentLevel === -1 ? 'is-on' : ''}">Auto</button>${lv.map((l, i) => `<button data-pl="quality" data-v="${i}" class="${hls.currentLevel === i ? 'is-on' : ''}">${l.height || l.bitrate}p</button>`).join('')}</div></div>` : ''}
            <a class="pl-link" href="/settings/player">${icon('settingsSliders', 16)}<span>Customize controls</span></a>`;
        } else if (kind === 'sources') {
          body = `<h3>Sources</h3>${sources.length ? `<div class="pl-list">${sources.map((s, i) => `<button data-pl="pick-source" data-i="${i}" class="${i === srcIdx ? 'is-on' : ''}"><span>${esc(s.name)}</span>${i === srcIdx ? icon('check', 16) : ''}</button>`).join('')}</div>` : `<p class="pl-empty">No sources are configured.</p>`}`;
        } else if (kind === 'subtitles') {
          const cur = tracks.find(t => t.mode === 'showing');
          body = `<h3>Subtitles</h3><div class="pl-list"><button data-pl="sub" data-i="-1" class="${!cur ? 'is-on' : ''}"><span>Off</span>${!cur ? icon('check', 16) : ''}</button>${tracks.map((t, i) => `<button data-pl="sub" data-i="${i}" class="${t === cur ? 'is-on' : ''}"><span>${esc(t.label || t.language)}</span>${t === cur ? icon('check', 16) : ''}</button>`).join('')}</div>${tracks.length ? '' : `<p class="pl-empty">This source has no subtitle tracks.</p>`}<a class="pl-link" href="/settings#subtitles">${icon('subtitles', 16)}<span>Subtitle appearance</span></a>`;
        } else if (kind === 'episodes') {
          const ss = d.seasons?.length ? d.seasons : [{ number: season, name: `Season ${season}` }];
          body = `<h3>Episodes</h3><div class="pl-chips seasons">${ss.map(s => `<a class="${Number(s.number) === season ? 'is-on' : ''}" href="/watch/tv/${id}/${s.number}/1">${esc(s.name || 'Season ' + s.number)}</a>`).join('')}</div>
            <div class="pl-eps">${eps.map(e => `<a href="/watch/tv/${id}/${season}/${e.num}" class="${e.num === episode ? 'is-on' : ''}"><span class="n">${e.num}</span><span class="t clamp-2">${esc(e.title || 'Episode ' + e.num)}</span>${e.runtimeLabel ? `<span class="r">${esc(e.runtimeLabel)}</span>` : ''}</a>`).join('') || '<p class="pl-empty">No episodes listed.</p>'}</div>`;
        }
        panel.innerHTML = body;
      };

      // ---- events
      on(root, 'click', async e => {
        const t = e.target.closest('[data-pl]'); if (!t) { if (!panel.hidden && !e.target.closest('#pl-panel')) closePanel(); return; }
        const act = t.dataset.pl;
        if (act === 'exit') { back(); }
        else if (act === 'play') toggle();
        else if (act === 'back') skip(-1);
        else if (act === 'forward') skip(1);
        else if (act === 'mute') { video.muted = !video.muted; }
        else if (act === 'fullscreen') { if (document.fullscreenElement) document.exitFullscreen(); else player.requestFullscreen?.().catch(() => {}); }
        else if (act === 'pip') { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch { toast('Picture in picture is not available', 'info'); } }
        else if (act === 'cast') { try { await video.remote.prompt(); } catch { toast('No cast devices found', 'info'); } }
        else if (['settings', 'sources', 'subtitles', 'episodes'].includes(act)) openPanel(act, t);
        else if (act === 'speed') { video.playbackRate = Number(t.dataset.v); openPanel('settings'); openPanel('settings'); }
        else if (act === 'fit') { store.setSetting('videoFitMode', t.dataset.v); applyFit(); panel.hidden = true; openPanel('settings'); }
        else if (act === 'boost') { store.setSetting('volumeBoost', Number(t.dataset.v)); applyBoost(); panel.hidden = true; openPanel('settings'); }
        else if (act === 'quality') { if (hls) hls.currentLevel = Number(t.dataset.v); panel.hidden = true; openPanel('settings'); }
        else if (act === 'pick-source') { srcIdx = Number(t.dataset.i); tried = 0; closePanel(); load(video.currentTime || 0); }
        else if (act === 'sub') { const i = Number(t.dataset.i); [...video.textTracks].forEach((tr, k) => { tr.mode = k === i ? 'showing' : 'disabled'; }); panel.hidden = true; openPanel('subtitles'); }
        else if (act === 'download') { document.dispatchEvent(new CustomEvent('player:download', { detail: d })); toast('Downloads are not available in this recreation', 'info'); }
        else if (act === 'next') { hideUpNext(); goNext(); }
        else if (act === 'cancel-next') hideUpNext();
        else if (act === 'retry') { tried = 0; srcIdx = 0; load(0); }
        else if (act === 'trailer') trailerModal(trailer.youtubeKey);
      });
      on(player, 'pointermove', showControls); on(player, 'pointerdown', showControls);
      on(root.querySelector('#pl-tap'), 'click', e => { if (!panel.hidden) { closePanel(); return; } if (e.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches) { player.dataset.controls = player.dataset.controls === 'show' ? 'hide' : 'show'; return; } toggle(); });
      on(root.querySelector('#pl-tap'), 'dblclick', e => { const r = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; if (x < 0.33) skip(-1); else if (x > 0.67) skip(1); else { if (document.fullscreenElement) document.exitFullscreen(); else player.requestFullscreen?.().catch(() => {}); } });
      function bindVolume() { const r = q('.pl-vol-range'); if (r) { r.value = video.muted ? 0 : video.volume; r.oninput = () => { video.muted = false; video.volume = Number(r.value); }; } }
      bindVolume(); on(video, 'volumechange', () => { const r = q('.pl-vol-range'); if (r) r.value = video.muted ? 0 : video.volume; });
      // seek bar
      let dragging = false; const seekTo = clientX => { const r = seek.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width)); if (video.duration) video.currentTime = p * video.duration; return p; };
      on(seek, 'pointerdown', e => { dragging = true; seek.setPointerCapture(e.pointerId); seekTo(e.clientX); });
      on(seek, 'pointermove', e => { const r = seek.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); const tip = q('.pl-tip'); tip.style.left = `${p * 100}%`; tip.textContent = fmt((video.duration || 0) * p); if (dragging) seekTo(e.clientX); });
      on(seek, 'pointerup', () => { dragging = false; });
      on(seek, 'keydown', e => { if (e.key === 'ArrowLeft') { skip(-1); e.preventDefault(); } if (e.key === 'ArrowRight') { skip(1); e.preventDefault(); } });
      // keyboard
      on(document, 'keydown', e => {
        if (/input|textarea|select/i.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
        else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); skip(-1); }
        else if (k === 'arrowright' || k === 'l') { e.preventDefault(); skip(1); }
        else if (k === 'arrowup') { e.preventDefault(); video.volume = Math.min(1, video.volume + 0.05); video.muted = false; showControls(); }
        else if (k === 'arrowdown') { e.preventDefault(); video.volume = Math.max(0, video.volume - 0.05); showControls(); }
        else if (k === 'm') { video.muted = !video.muted; showControls(); }
        else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else player.requestFullscreen?.().catch(() => {}); }
        else if (k === 'c') { const tr = [...video.textTracks]; if (tr.length) { const cur = tr.findIndex(t => t.mode === 'showing'); tr.forEach((t, i) => { t.mode = i === (cur + 1) % (tr.length + 1) ? 'showing' : 'disabled'; }); } }
        else if (k === 'n' && nextEp) goNext();
        else if (k === 'escape') { if (!panel.hidden) closePanel(); else if (!document.fullscreenElement) back(); }
        else if (/^[0-9]$/.test(k) && video.duration) { video.currentTime = video.duration * Number(k) / 10; showControls(); }
      });
      on(document, 'fullscreenchange', sync);
      if ('remote' in HTMLMediaElement.prototype) q('[data-pl="cast"]').hidden = false;
      // ---- next episode lookup
      (async () => {
        if (type !== 'tv') return;
        try {
          const i = eps.findIndex(e => e.num === episode);
          if (i >= 0 && eps[i + 1]) nextEp = { season, episode: eps[i + 1].num, title: eps[i + 1].title };
          else { const ss = d.seasons || []; const k = ss.findIndex(s => Number(s.number) === season); const ns = ss[k + 1]; if (ns) { const e2 = await getSeason(id, ns.number); if (e2[0]) nextEp = { season: Number(ns.number), episode: e2[0].num, title: e2[0].title }; } }
        } catch { /* no next */ }
        ctx.hasNext = !!nextEp; if (nextEp) { q('#pl-left').innerHTML = bar(layout.left); q('#pl-right').innerHTML = bar(layout.right); bindVolume(); sync(); }
      })();

      load(0); showControls();
      return () => { destroyed = true; saveProgress(); clearInterval(saveTimer); clearInterval(upnextTimer); clearTimeout(hideTimer); disposers.forEach(f => f()); teardownMedia(); try { audio?.ac.close(); } catch { /* ignore */ } if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    },
  };
}

// ---------------------------------------------------------------- player controls settings
export async function playerSettingsPage() {
  const cat = getCatalog(); const first = (cat?.hero?.home || [])[0]; const still = first ? cat.items[first]?.backdrop : null;
  const render = () => {
    const layout = getLayout(); const tray = trayItems(layout);
    const item = id => { const c = CONTROLS[id]; const inner = id === 'time' ? `<span class="tabular">12:04 / 48:20</span>` : id === 'volume' ? `${icon('volumeLow', 24)}` : icon(c.icon, id === 'play' || id === 'back' || id === 'forward' ? 26 : 24); return `<button class="pc-item${c.required ? ' is-required' : ''}" draggable="${c.required ? 'false' : 'true'}" data-id="${id}" aria-label="${c.label}${c.required ? ' (required)' : ''}" title="${c.label}">${inner}</button>`; };
    return `
    <section class="glass-panel pc-card">
      <div class="pc-card-head"><h2>Your player</h2><button class="pill-btn is-small" data-pc="reset">${icon('refresh', 14)}<span>Reset</span></button></div>
      <div class="pc-preview" style="${still ? `background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url(${img(still, 'w780')})` : ''}">
        <div class="pc-top"><span>${icon('arrowLeft', 20)}</span><span class="pc-title">Title</span><span>${icon('cast', 20)}</span></div>
        <div class="pc-bottom">
          <div class="pl-track pc-track"><i class="pl-fill" style="transform:scaleX(.42)"></i></div>
          <div class="pc-bar"><div class="pc-zone" data-zone="left">${layout.left.map(item).join('')}</div><div class="pc-zone is-right" data-zone="right">${layout.right.map(item).join('')}</div></div>
        </div>
      </div>
      <p class="pc-hint">Drag controls to rearrange them, or click one to move it to the tray. Keyboard: focus a control and press Enter.</p>
    </section>
    <section class="glass-panel pc-card"><div class="pc-card-head"><h2>Available Actions</h2></div>
      <div class="pc-tray" data-zone="tray">${tray.length ? tray.map(id => { const c = CONTROLS[id]; return `<button class="pc-chip" draggable="true" data-id="${id}">${icon(c.icon, 18)}<span>${c.label}</span></button>`; }).join('') : '<span class="pc-empty">Every control is on the player.</span>'}</div>
    </section>`;
  };
  const html = `<div class="page-top"><div class="container-narrow" style="max-width:900px"><div class="page-head"><div class="h1-row">${icon('settingsSliders', 30)}<h1 class="h1">Player Controls</h1></div></div><div id="pc-root">${render()}</div></div></div>${footer()}`;
  return {
    title: 'Player Controls - Cinejoy', html, back: true, ambient: 'aurora',
    mount(root) {
      const host = root.querySelector('#pc-root'); let dragId = null;
      const redraw = () => { host.innerHTML = render(); };
      const move = (id, zone, index) => {
        const l = getLayout(); l.left = l.left.filter(x => x !== id); l.right = l.right.filter(x => x !== id);
        if (zone === 'left' || zone === 'right') { const arr = l[zone]; const i = index == null ? arr.length : Math.min(index, arr.length); arr.splice(i, 0, id); }
        if (!l.left.includes('play') && !l.right.includes('play')) l.left.unshift('play');
        store.setSetting('playerLayout', l); redraw();
      };
      host.addEventListener('click', e => {
        if (e.target.closest('[data-pc="reset"]')) { store.setSetting('playerLayout', null); redraw(); toast('Controls reset'); return; }
        const it = e.target.closest('[data-id]'); if (!it) return; const id = it.dataset.id; if (CONTROLS[id].required) { toast('Play / Pause can’t be removed', 'info'); return; }
        const l = getLayout(); if (l.left.includes(id) || l.right.includes(id)) move(id, 'tray'); else move(id, ['play', 'back', 'forward', 'volume', 'time'].includes(id) ? 'left' : 'right');
      });
      host.addEventListener('dragstart', e => { const it = e.target.closest('[data-id]'); if (!it) return; dragId = it.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; it.classList.add('is-dragging'); });
      host.addEventListener('dragend', () => { dragId = null; host.querySelectorAll('.is-dragging, .is-over').forEach(x => x.classList.remove('is-dragging', 'is-over')); });
      host.addEventListener('dragover', e => { const z = e.target.closest('[data-zone]'); if (!z || !dragId) return; e.preventDefault(); host.querySelectorAll('.is-over').forEach(x => x.classList.remove('is-over')); z.classList.add('is-over'); });
      host.addEventListener('drop', e => {
        const z = e.target.closest('[data-zone]'); if (!z || !dragId) return; e.preventDefault();
        const zone = z.dataset.zone; let idx = null;
        if (zone !== 'tray') { const kids = [...z.querySelectorAll('.pc-item')].filter(k => k.dataset.id !== dragId); idx = kids.findIndex(k => { const r = k.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; }); if (idx < 0) idx = kids.length; }
        move(dragId, zone, idx);
      });
      host.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) { e.preventDefault(); e.target.click(); } });
      return () => {};
    },
  };
}
