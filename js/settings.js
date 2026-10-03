// Settings page: sticky section tabs, theme picker, playback and subtitle options.
import { icon } from './icons.js';
import { esc, footer, toast, modal, closeModal, dropdown, scrollTopButton, mountScrollTop, loginModal } from './components.js';
import { store } from './store.js';
import { auth } from './auth.js';
import { THEMES, resolveTheme, customTheme } from './themes.js';
import { orderedSources, sourceCount } from './player.js';

const TABS = [['account', 'Account', 'user'], ['appearance', 'Appearance', 'palette'], ['playback', 'Playback', 'play'], ['servers', 'Servers', 'server'], ['subtitles', 'Subtitles', 'subtitles'], ['ads', 'Ads', 'megaphone']];
const swatch = t => `background:linear-gradient(135deg, ${t.primary} 50%, ${t.secondary} 50%)`;
const LANGS = [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['ur', 'Urdu'], ['ru', 'Russian'], ['tr', 'Turkish'], ['zh', 'Chinese']];
const onDD = (root, fn) => { const h = e => fn(e.detail.id, e.detail.value); document.addEventListener('dd:select', h); return () => document.removeEventListener('dd:select', h); };

export async function settingsPage(section = '') {
  const s = store.settings; const user = auth.user; const cur = resolveTheme(s);
  const tog = (k, label, desc) => `<div class="setting-row"><div><div class="lbl">${label}</div><div class="desc">${desc}</div></div><div class="ctl"><button class="toggle${s[k] ? ' is-on' : ''}" role="switch" aria-checked="${!!s[k]}" aria-label="${label}" data-action="toggle-setting" data-key="${k}"></button></div></div>`;
  const seg = (k, label, desc, opts) => `<div class="setting-row"><div><div class="lbl">${label}</div><div class="desc">${desc}</div></div><div class="ctl"><div class="segment is-small">${opts.map(([v, l]) => `<button data-action="set-setting" data-key="${k}" data-value="${v}" class="${s[k] === v ? 'is-active' : ''}">${l}</button>`).join('')}</div></div></div>`;
  const themeMenu = `
    <div class="dropdown theme-dd" data-dd="theme">
      <button class="theme-toggle" data-action="toggle-dd" aria-haspopup="listbox"><span class="dot"></span><span class="swatch" style="${swatch(cur)}"></span><span>${esc(cur.label)}</span>${icon('chevronDown', 16, 'class="chev"')}</button>
      <div class="dropdown-menu align-right theme-menu" role="listbox">
        <button data-theme-pick="custom" class="${s.theme === 'custom' ? 'is-selected' : ''}"><span class="plus">${icon('plus', 14)}</span><span>Custom</span>${s.theme === 'custom' ? icon('check', 16) : ''}</button>
        <div class="sep"></div>
        ${THEMES.map(t => `<button role="option" data-theme-pick="${t.id}" class="${s.theme === t.id ? 'is-selected' : ''}"><span class="swatch" style="${swatch(t)}"></span><span>${esc(t.label)}</span>${s.theme === t.id ? icon('check', 16) : ''}</button>`).join('')}
      </div>
    </div>`;
  const sources = orderedSources();
  const sourceList = sources.length
    ? `<div class="order-list" id="order-list">${sources.map((src, i) => `<div class="order-item" draggable="true" data-name="${esc(src.name)}"><span class="grip">${icon('grip', 16)}</span><span class="num">${i + 1}</span><span>${esc(src.name)}</span><span class="moves"><button data-action="order-move" data-i="${i}" data-d="-1" aria-label="Move ${esc(src.name)} up">${icon('chevronUp', 16)}</button><button data-action="order-move" data-i="${i}" data-d="1" aria-label="Move ${esc(src.name)} down">${icon('chevronDown', 16)}</button></span></div>`).join('')}</div>`
    : `<div class="setting-row"><div><div class="lbl">No sources configured</div><div class="desc">Sources are added by the site owner in <code>js/config.js</code>. Once added, they appear here and can be reordered.</div></div></div>`;
  const html = `
    <div class="page-top"><div class="container-narrow" style="max-width:780px">
      <div class="page-head" style="margin-bottom:16px"><div class="h1-row">${icon('gear', 30)}<h1 class="h1">Settings</h1></div></div>
      <div class="settings-tabs-wrap"><div class="settings-tabs hide-scrollbar" id="settings-tabs">${TABS.map(([id, l, ic]) => `<a class="settings-tab${(section || 'account') === id ? ' is-active' : ''}" href="/settings#${id}" data-tab="${id}">${icon(ic, 16)}<span>${l}</span></a>`).join('')}</div></div>

      <section class="glass-panel settings-section" id="account"><h2 class="sec-title">Account</h2><p class="sec-desc">Sign in to sync your settings and watch progress across devices.</p>
        <div class="setting-row"><div><div class="lbl">${user ? `Signed in as ${esc(auth.displayName())}` : 'Not signed in'}</div><div class="desc">${user ? `Account ending in ${esc(user.last4)}. Data stays on this device.` : 'Create an account or sign in to sync your data'}</div></div><div class="ctl"><button class="pill-btn is-primary is-lg keep-white" data-action="login">${user ? 'Manage' : 'Sign In'}</button></div></div>
        <button class="connect-row" data-action="connect" data-name="Trakt"><span class="icon-circle">${icon('check', 18)}</span><span><div class="t">Connect Trakt</div><div class="s">Sync your watchlist, history and progress from Trakt</div></span></button>
        <button class="connect-row" data-action="connect" data-name="Simkl"><span class="icon-circle">${icon('layers', 18)}</span><span><div class="t">Connect Simkl</div><div class="s">Sync your watchlist, history and progress from Simkl</div></span></button>
      </section>

      <section class="glass-panel settings-section" id="appearance"><h2 class="sec-title">Appearance</h2><p class="sec-desc">Change the look of the site to suit your needs.</p>
        <div class="setting-row"><div><div class="lbl">Theme</div><div class="desc">Pick a color palette for the entire interface.</div></div><div class="ctl">${themeMenu}</div></div>
        ${seg('episodeView', 'Episode View Style', 'Choose how episodes appear on series pages.', [['carousel', 'Carousel'], ['grid', 'Grid']])}
        ${seg('detailView', 'Detail View Type', 'Pick between a full page or a compact modal.', [['page', 'Page'], ['modal', 'Modal']])}
        ${tog('imageLogos', 'Use Image Logos', 'Display movie and series titles as image logos.')}
        ${tog('trailers', 'Trailers', 'Show trailers on detail pages.')}
        ${tog('spoilerFree', 'Spoiler-Free Mode', 'Hide information about episodes.')}
        ${tog('reduceMotion', 'Reduce Motion', 'Reduce effects.')}
        ${tog('flatUi', 'Flat UI', 'Replace frosted glass with solid surfaces.')}
      </section>

      <section class="glass-panel settings-section" id="playback"><h2 class="sec-title">Playback</h2><p class="sec-desc">Configure how your player behaves.</p>
        ${tog('autoplay', 'Autoplay', 'Automatically play the next episode when one ends. Videos still start on their own when this is off.')}
        ${tog('autoSkipIntro', 'Auto Skip Intro', 'Jump past the intro on its own, instead of showing the Skip Intro button.')}
        <div class="setting-row"><div><div class="lbl">Player Controls</div><div class="desc">Rearrange the player's buttons, or take the ones you don't use off it.</div></div><div class="ctl"><a class="pill-btn" href="/settings/player"><span>Customize</span>${icon('chevronRight', 14)}</a></div></div>
        <div class="setting-row"><div><div class="lbl">Seek Time</div><div class="desc">Change how far you skip forwards or backwards.</div></div><div class="ctl">${dropdown({ id: 'seekTime', label: 'Seek', value: s.seekTime, options: [5, 10, 15, 30, 60].map(v => ({ value: v, label: `${v} seconds` })), align: 'right' })}</div></div>
        ${tog('autoSubtitles', 'Auto Subtitles', 'Automatically select subtitles in your preferred language when available.')}
        ${s.autoSubtitles ? `<div class="setting-row"><div><div class="lbl">Preferred Language</div><div class="desc">Used when picking subtitle tracks automatically.</div></div><div class="ctl">${dropdown({ id: 'subLang', label: 'Language', value: s.defaultSubtitleLanguage, options: LANGS.map(([v, l]) => ({ value: v, label: l })), align: 'right' })}</div></div>` : ''}
      </section>

      <section class="glass-panel settings-section" id="servers"><h2 class="sec-title">Server Order</h2><p class="sec-desc">Drag to set which sources are tried first when a title loads.</p>${sourceList}</section>

      <section class="glass-panel settings-section" id="subtitles"><h2 class="sec-title">Subtitles</h2><p class="sec-desc">Improve readability and customization for subtitles.</p>
        ${seg('subtitleFont', 'Font', 'Choose your preferred subtitle font.', [['Cinejoy', 'Cinejoy'], ['Classic', 'Classic'], ['Montserrat', 'Montserrat']])}
        <div class="setting-row"><div><div class="lbl">Text Size</div><div class="desc">Adjust subtitle size for your display.</div></div><div class="ctl"><span class="tabular" id="sub-size" style="font-size:13px;color:var(--fg-70);min-width:44px;text-align:right">${s.subtitleSize}%</span><input type="range" min="50" max="200" step="10" value="${s.subtitleSize}" data-action="range-setting" data-key="subtitleSize" aria-label="Text size" /></div></div>
        <div class="setting-row"><div><div class="lbl">Text Color</div><div class="desc">Pick a high-contrast subtitle color.</div></div><div class="ctl"><div class="color-dots">${['#ffffff', '#ffff00', '#00ffff', '#ff00ff'].map(c => `<button class="color-dot${s.subtitleColor === c ? ' is-active' : ''}" style="background:${c}" data-action="set-setting" data-key="subtitleColor" data-value="${c}" aria-label="${c}"></button>`).join('')}</div></div></div>
        ${tog('subtitleBlur', 'Background Blur', 'Improve legibility with a soft glow.')}
        <div class="setting-row"><div><div class="lbl">Preview</div><div class="desc">How subtitles would appear in the player.</div></div><div class="ctl"><span id="sub-preview" style="padding:6px 12px;border-radius:8px;font-weight:600;font-size:${16 * s.subtitleSize / 100}px;color:${s.subtitleColor};${s.subtitleBlur ? 'background:rgba(0,0,0,.55);backdrop-filter:blur(6px)' : 'text-shadow:0 2px 4px #000'};font-family:${s.subtitleFont === 'Montserrat' ? 'Montserrat,Inter' : s.subtitleFont === 'Classic' ? 'Arial,Helvetica' : 'Inter'}">Sample subtitle</span></div></div>
      </section>

      <section class="glass-panel settings-section" id="ads"><h2 class="sec-title">Advertisements</h2><p class="sec-desc">Manage how advertisements are displayed on the site.</p>
        <div class="setting-row"><div><div class="lbl">Enable Advertisements</div><div class="desc">This recreation never loads ads or tracking scripts. The switch only exists so the screen matches the original layout.</div></div><div class="ctl"><button class="toggle${s.ads ? ' is-on' : ''}" role="switch" aria-checked="${!!s.ads}" aria-label="Enable Advertisements" data-action="toggle-setting" data-key="ads"></button></div></div>
      </section>

      <div style="display:flex;justify-content:flex-end;margin-bottom:24px"><button class="pill-btn" data-action="reset-settings">${icon('refresh', 16)}<span>Reset to defaults</span></button></div>
    </div></div>${scrollTopButton()}${footer()}`;
  return {
    title: 'Settings - Cinejoy', html, back: true, ambient: 'aurora',
    mount(root) {
      const cleanups = [mountScrollTop()]; const rerender = () => document.dispatchEvent(new CustomEvent('app:rerender'));
      // scroll-spy for the sticky tab bar
      const tabs = [...root.querySelectorAll('.settings-tab')]; const secs = TABS.map(([id]) => root.querySelector('#' + id));
      const spy = () => { let active = TABS[0][0]; secs.forEach((el, i) => { if (el && el.getBoundingClientRect().top < 170) active = TABS[i][0]; }); if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) active = TABS[TABS.length - 1][0]; tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === active)); const bar = root.querySelector('.settings-tabs-wrap'); bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= 20); const at = tabs.find(t => t.classList.contains('is-active')); if (at && root.querySelector('#settings-tabs').scrollWidth > root.querySelector('#settings-tabs').clientWidth) at.scrollIntoView({ inline: 'center', block: 'nearest' }); };
      window.addEventListener('scroll', spy, { passive: true }); cleanups.push(() => window.removeEventListener('scroll', spy)); spy();
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-action="toggle-setting"]'); if (t) { store.setSetting(t.dataset.key, !store.settings[t.dataset.key]); const on = store.settings[t.dataset.key]; t.classList.toggle('is-on', on); t.setAttribute('aria-checked', on); if (['subtitleBlur', 'autoSubtitles', 'spoilerFree', 'flatUi'].includes(t.dataset.key)) { const y = window.scrollY; rerender(); requestAnimationFrame(() => window.scrollTo(0, y)); } return; }
        const ss = e.target.closest('[data-action="set-setting"]'); if (ss) { store.setSetting(ss.dataset.key, ss.dataset.value); const y = window.scrollY; rerender(); requestAnimationFrame(() => window.scrollTo(0, y)); return; }
        const om = e.target.closest('[data-action="order-move"]'); if (om) { const names = orderedSources().map(x => x.name); const i = Number(om.dataset.i), j = i + Number(om.dataset.d); if (j < 0 || j >= names.length) return; [names[i], names[j]] = [names[j], names[i]]; store.setSetting('serverOrder', names); const y = window.scrollY; rerender(); requestAnimationFrame(() => window.scrollTo(0, y)); return; }
        if (e.target.closest('[data-action="reset-settings"]')) { store.resetSettings(); toast('Settings reset'); rerender(); return; }
        const cn = e.target.closest('[data-action="connect"]'); if (cn) { toast(`${cn.dataset.name} sync is not available in this recreation`, 'info'); return; }
        const tp = e.target.closest('[data-theme-pick]'); if (tp) { e.stopPropagation(); root.querySelector('.theme-dd')?.classList.remove('is-open'); const id = tp.dataset.themePick; if (id === 'custom') customThemeModal(); else { store.setSetting('theme', id); const y = window.scrollY; rerender(); requestAnimationFrame(() => window.scrollTo(0, y)); } return; }
        const tab = e.target.closest('.settings-tab'); if (tab) { e.preventDefault(); const el = root.querySelector('#' + tab.dataset.tab); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' }); history.replaceState({}, '', '/settings#' + tab.dataset.tab); }
      });
      root.addEventListener('input', e => { const r = e.target.closest('[data-action="range-setting"]'); if (r) { store.setSetting(r.dataset.key, Number(r.value)); root.querySelector('#sub-size').textContent = r.value + '%'; root.querySelector('#sub-preview').style.fontSize = (16 * r.value / 100) + 'px'; } });
      // drag to reorder sources
      const list = root.querySelector('#order-list');
      if (list) {
        let dragName = null;
        list.addEventListener('dragstart', e => { const it = e.target.closest('.order-item'); if (!it) return; dragName = it.dataset.name; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragName); it.classList.add('is-dragging'); });
        list.addEventListener('dragend', () => { list.querySelectorAll('.is-dragging,.is-over').forEach(x => x.classList.remove('is-dragging', 'is-over')); });
        list.addEventListener('dragover', e => { const it = e.target.closest('.order-item'); if (!it || !dragName) return; e.preventDefault(); list.querySelectorAll('.is-over').forEach(x => x.classList.remove('is-over')); it.classList.add('is-over'); });
        list.addEventListener('drop', e => { const it = e.target.closest('.order-item'); if (!it || !dragName) return; e.preventDefault(); const names = orderedSources().map(x => x.name).filter(n => n !== dragName); const idx = names.indexOf(it.dataset.name); const r = it.getBoundingClientRect(); names.splice(e.clientY > r.top + r.height / 2 ? idx + 1 : idx, 0, dragName); store.setSetting('serverOrder', names); rerender(); });
      }
      cleanups.push(onDD(root, (id, value) => { if (id === 'seekTime') store.setSetting('seekTime', Number(value)); else if (id === 'subLang') store.setSetting('defaultSubtitleLanguage', value); else return; const y = window.scrollY; rerender(); requestAnimationFrame(() => window.scrollTo(0, y)); }));
      if (section) setTimeout(() => { const el = root.querySelector('#' + section); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96 }); }, 60);
      return () => cleanups.forEach(f => f());
    },
  };
}

function customThemeModal() {
  const start = store.settings.customPrimary || '#8a7bff'; let color = start;
  const presets = ['#8a7bff', '#ff7a45', '#f5c542', '#3ddc97', '#4cc9f0', '#ff5d8f', '#c77dff', '#9aa5b1'];
  const root = modal(`<h2>Custom theme</h2><p>Pick a base color. The background, accents and highlights are generated from it.</p>
    <div class="ct-preview" id="ct-preview"></div>
    <div class="field"><label for="ct-color">Base color</label><div class="ct-row"><input id="ct-color" type="color" value="${start}" aria-label="Base color" /><input id="ct-hex" type="text" value="${start}" maxlength="7" spellcheck="false" aria-label="Hex value" /></div></div>
    <div class="ct-presets">${presets.map(c => `<button data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
    <div class="acts"><button class="pill-btn" data-action="close-modal">Cancel</button><button class="pill-btn is-primary" data-ct="apply">Apply</button></div>`);
  const paint = () => { const t = customTheme(color); root.querySelector('#ct-preview').style.background = `linear-gradient(135deg, ${t.bg.colors[0]}, ${t.bg.colors[1]} 45%, ${t.bg.colors[2]} 80%, ${t.bg.colors[3]})`; root.querySelector('#ct-color').value = color; root.querySelector('#ct-hex').value = color; };
  paint();
  root.addEventListener('input', e => { if (e.target.id === 'ct-color') { color = e.target.value; paint(); } if (e.target.id === 'ct-hex' && /^#[0-9a-f]{6}$/i.test(e.target.value)) { color = e.target.value.toLowerCase(); paint(); } });
  root.addEventListener('click', e => {
    const p = e.target.closest('[data-c]'); if (p) { color = p.dataset.c; paint(); }
    if (e.target.closest('[data-ct="apply"]')) { store.setSetting('customPrimary', color); store.setSetting('theme', 'custom'); closeModal(); toast('Custom theme applied'); document.dispatchEvent(new CustomEvent('app:rerender')); }
  });
}
