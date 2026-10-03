// Reusable UI building blocks. Functions return HTML strings; "mount" helpers wire behaviour.
import { icon } from './icons.js';
import { img, hrefFor, watchHref, GENRES } from './data.js';
import { store } from './store.js';
import { auth, digitsOnly, formatNumber } from './auth.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtRating = r => (r == null || r === '' ? null : Number(r).toFixed(1));

// ------------------------------------------------------------ header / nav
const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/movies', label: 'Movies', icon: 'clapper' },
  { href: '/series', label: 'Shows', icon: 'tv' },
  { href: '/lists', label: 'My List', icon: 'bookmark' },
];
export function activeNav(path) {
  if (path === '/' ) return '/';
  if (path.startsWith('/movies') || path.startsWith('/movie/') || path.startsWith('/category/movie')) return '/movies';
  if (path.startsWith('/series') || path.startsWith('/category/tv')) return '/series';
  if (path.startsWith('/lists') || path.startsWith('/list/')) return '/lists';
  if (path.startsWith('/search')) return '/search';
  if (path.startsWith('/settings')) return '/settings';
  return null;
}
export function header(path, { showBack = false } = {}) {
  const active = activeNav(path);
  return `
  <header class="site-header" id="site-header">
    <div class="brand-area">
      ${showBack ? `<button class="back-btn" data-action="back" aria-label="Go back">${icon('arrowLeft', 26)}</button>` : ''}
      <a class="brand-link" href="/" aria-label="Home"><img class="brand-mark" src="/brand/logomark-white.svg" alt="Cinejoy" width="44" height="44" /></a>
    </div>
    <nav class="desktop-nav glass" role="tablist" aria-label="Primary">
      <div class="nav-pill is-hidden" id="nav-pill"></div>
      ${NAV.map(n => `<a class="nav-item${active === n.href ? ' is-active' : ''}" href="${n.href}" role="tab" aria-selected="${active === n.href}">${icon(n.icon, 18)}<span>${n.label}</span></a>`).join('')}
      <span class="nav-divider"></span>
      <a class="nav-item is-icon${active === '/search' ? ' is-active' : ''}" href="/search" aria-label="Search">${icon('search', 20)}</a>
      <div class="profile-wrap"><button class="nav-item is-icon${active === '/settings' ? ' is-active' : ''}" data-action="profile-menu" aria-label="Settings" aria-haspopup="menu">${icon('gear', 20)}</button></div>
    </nav>
  </header>
  <nav class="mobile-nav glass" aria-label="Primary mobile">
    ${NAV.map(n => `<a class="${active === n.href ? 'is-active' : ''}" href="${n.href}" aria-label="${n.label}">${icon(n.icon, 22)}</a>`).join('')}
    <a class="${active === '/search' ? 'is-active' : ''}" href="/search" aria-label="Search">${icon('search', 22)}</a>
    <button class="${active === '/settings' ? 'is-active' : ''}" data-action="profile-menu" aria-label="Settings">${icon('gear', 22)}</button>
  </nav>`;
}
export function mountHeader() {
  const nav = document.querySelector('.desktop-nav'); const pill = document.getElementById('nav-pill');
  const place = (animate = true) => {
    if (!nav || !pill) return;
    const act = nav.querySelector('.nav-item.is-active:not(.is-icon)');
    if (!act) { pill.classList.add('is-hidden'); return; }
    const nr = nav.getBoundingClientRect(); const ar = act.getBoundingClientRect();
    if (!animate) pill.style.transition = 'none';
    pill.style.transform = `translate3d(${ar.left - nr.left}px,0,0)`; pill.style.width = ar.width + 'px'; pill.classList.remove('is-hidden');
    if (!animate) requestAnimationFrame(() => { pill.style.transition = ''; });
  };
  requestAnimationFrame(() => place(false));
  const onScroll = () => { const h = document.getElementById('site-header'); if (h) h.classList.toggle('is-scrolled', window.scrollY > 40); place(false); };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', () => place(false));
  onScroll();
  return () => window.removeEventListener('scroll', onScroll);
}
export function profileMenu(anchor) {
  closeMenus();
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'popover-menu'; el.setAttribute('role', 'menu');
  const name = auth.signedIn ? auth.displayName() : '';
  el.innerHTML = `
    <button role="menuitem" data-action="login">${icon(name ? 'user' : 'login', 18)}<span class="clamp-1">${name ? esc(name) : 'Login'}</span></button>
    <div class="sep"></div>
    <a role="menuitem" href="/settings">${icon('gear', 18)}<span>Settings</span></a>
    <a role="menuitem" href="/continue-watching">${icon('history', 18)}<span>Watch History</span></a>
    <a role="menuitem" href="/shorts">${icon('flame', 18)}<span>Shorts</span></a>`;
  document.getElementById('overlay-root').appendChild(el);
  const mobile = window.innerWidth < 1024;
  if (mobile) { el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; el.style.bottom = (window.innerHeight - r.top + 12) + 'px'; }
  else { el.style.top = (r.bottom + 12) + 'px'; el.style.right = Math.max(8, window.innerWidth - r.right - 8) + 'px'; }
  setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
}
export function closeMenus() { document.querySelectorAll('.popover-menu').forEach(m => m.remove()); document.querySelectorAll('.dropdown.is-open').forEach(d => d.classList.remove('is-open')); }

// ------------------------------------------------------------ ambient
let ambientTimer = null;
export function setAmbient(backdrop) {
  const root = document.getElementById('ambient'); if (!root) return;
  root.classList.remove('is-aurora');
  const src = img(backdrop, 'w300'); if (!src) { root.querySelectorAll('img').forEach(i => i.classList.remove('is-visible')); return; }
  const cur = root.querySelector('img.is-visible'); if (cur && cur.dataset.src === src) return;
  const el = document.createElement('img'); el.src = src; el.alt = ''; el.dataset.src = src; el.setAttribute('aria-hidden', 'true');
  root.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));
  root.querySelectorAll('img').forEach(i => { if (i !== el) i.classList.remove('is-visible'); });
  clearTimeout(ambientTimer); ambientTimer = setTimeout(() => root.querySelectorAll('img:not(.is-visible)').forEach(i => i.remove()), 1200);
}
export function setAurora() { const root = document.getElementById('ambient'); if (!root) return; root.querySelectorAll('img').forEach(i => i.classList.remove('is-visible')); root.classList.add('is-aurora'); clearTimeout(ambientTimer); ambientTimer = setTimeout(() => root.querySelectorAll('img').forEach(i => i.remove()), 1200); }

// ------------------------------------------------------------ hero
export function hero(slides, { interval = 8000 } = {}) {
  if (!slides?.length) return `<section class="hero"><div class="hero-media"></div></section>`;
  const useLogos = store.settings.imageLogos;
  return `
  <section class="hero" id="hero" style="--hero-interval:${interval}ms" data-interval="${interval}">
    <div class="hero-media">
      ${slides.map((s, i) => `<div class="hero-slide${i === 0 ? ' is-active' : ''}" data-i="${i}">${s.backdrop ? `<img src="${img(s.backdrop, 'w1280')}" alt="${esc(s.title)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} />` : ''}</div>`).join('')}
    </div>
    <div class="hero-content">
      <div class="hero-inner">
        ${slides.map((s, i) => heroBlock(s, i === 0, useLogos)).join('')}
      </div>
    </div>
    <div class="hero-dots" role="tablist" aria-label="Featured titles">
      ${slides.map((_, i) => `<button class="${i === 0 ? 'is-active' : ''}" data-action="hero-go" data-i="${i}" aria-label="Go to slide ${i + 1}"><span></span></button>`).join('')}
    </div>
  </section>`;
}
function heroBlock(s, active, useLogos) {
  const it = s.item || {}; const href = it.id ? hrefFor({ ...it, title: s.title }) : '#';
  const meta = [
    s.rating ? `<div class="meta-item">${icon('star', 16)}<b>${fmtRating(s.rating)}</b><span>/10</span></div>` : '',
    s.year ? `<div class="meta-item">${icon('calendar', 16)}<span>${s.year}</span></div>` : '',
    s.genre ? `<div class="meta-item">${icon('tag', 16)}<span>${esc(s.genre)}</span></div>` : '',
  ].filter(Boolean).join('<span class="dot">•</span>');
  return `
  <div class="hero-block" data-slide="${esc(s.key || '')}" ${active ? '' : 'hidden'}>
    <a class="hero-title" href="${href}" aria-label="${esc(s.title)}">
      ${useLogos && s.logo ? `<img class="hero-title-img" src="${img(s.logo, 'w500')}" alt="${esc(s.title)}" />` : `<h1 class="hero-title-text">${esc(s.title)}</h1>`}
    </a>
    <div class="hero-meta">${meta}</div>
    ${s.overview ? `<p class="hero-overview is-desktop clamp-3">${esc(s.overview)}</p><p class="hero-overview is-mobile clamp-2">${esc(s.overview)}</p>` : ''}
    <div class="hero-actions">
      <a class="btn-play" href="${it.id ? watchHref(it) : '#'}">${icon('play', 20)}<span>Play</span></a>
      <div class="action-pill">
        <button data-action="add-list" data-key="${esc(s.key || '')}" aria-label="Add to list">${icon('plus', 22)}</button>
        <span class="sep"></span>
        <a href="${href}" aria-label="More Info" role="button">${icon('info', 22)}</a>
      </div>
    </div>
  </div>`;
}
export function mountHero(root, slides, onChange) {
  const hero = root.querySelector('#hero'); if (!hero || !slides?.length) return () => {};
  let i = 0; let timer = null; const interval = Number(hero.dataset.interval) || 8000;
  const show = n => {
    i = (n + slides.length) % slides.length;
    hero.querySelectorAll('.hero-slide').forEach(el => el.classList.toggle('is-active', Number(el.dataset.i) === i));
    hero.querySelectorAll('.hero-block').forEach((el, k) => { el.hidden = k !== i; });
    hero.querySelectorAll('.hero-dots button').forEach((b, k) => { b.classList.toggle('is-active', k === i); if (k === i) { const s = b.querySelector('span'); s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; } });
    onChange?.(slides[i], i);
  };
  const start = () => { stop(); if (slides.length > 1 && !store.settings.reduceMotion) timer = setInterval(() => show(i + 1), interval); };
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  hero.addEventListener('click', e => { const b = e.target.closest('[data-action="hero-go"]'); if (b) { show(Number(b.dataset.i)); start(); } });
  hero.addEventListener('mouseenter', () => { stop(); hero.querySelector('.hero-dots button.is-active')?.classList.add('is-paused'); });
  hero.addEventListener('mouseleave', () => { hero.querySelector('.hero-dots button.is-active')?.classList.remove('is-paused'); start(); });
  const onVis = () => document.hidden ? stop() : start();
  document.addEventListener('visibilitychange', onVis);
  // swipe
  let x0 = null; hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true }); hero.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { show(i + (dx < 0 ? 1 : -1)); start(); } x0 = null; });
  onChange?.(slides[0], 0); start();
  return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
}

// ------------------------------------------------------------ cards / rows
export function card(it, { lazy = true, href = null, progress = null, badge = '' } = {}) {
  if (!it) return '';
  const r = fmtRating(it.rating);
  const sub = `${it.year ? `<span>${it.year}</span>` : ''}${r ? `<span class="rt">${icon('star', 12)}${r}</span>` : ''}`;
  return `
  <a class="card" href="${href || hrefFor(it)}" aria-label="${esc(it.title)}" data-key="${esc(it.key)}"${href ? ' data-no-modal' : ''}>
    <div class="card-poster">
      ${it.poster ? `<img src="${img(it.poster, 'w500')}" alt="${esc(it.title)}" ${lazy ? 'loading="lazy"' : ''} decoding="async" />` : `<div class="poster-fallback">${esc(it.title)}</div>`}
      <div class="veil"></div>
      ${badge ? `<span class="card-badge">${esc(badge)}</span>` : ''}${progress != null && progress > 0 ? `<div class="card-progress"><i style="width:${Math.max(3, Math.min(100, progress * 100)).toFixed(1)}%"></i></div>` : ''}
      <div class="card-overlay"><span class="play-chip">${icon('play', 22)}</span><div><h3 class="clamp-2">${esc(it.title)}</h3><div class="sub">${sub}</div></div></div>
    </div>
    <div class="card-caption"><h3 class="clamp-1">${esc(it.title)}</h3><div class="sub">${r ? `<span class="rt">${icon('star', 10)}${r}</span>` : ''}${it.year ? `<span>${it.year}</span>` : ''}</div></div>
  </a>`;
}
export function skeletonCards(n = 8) { return Array.from({ length: n }, () => `<div class="card"><div class="card-poster skeleton"></div></div>`).join(''); }
export function tile(p) {
  return `<a class="tile" href="/provider/${p.id}" aria-label="${esc(p.name)}"><div class="tile-logo">${p.logo ? `<img src="${img(p.logo, 'w154')}" alt="${esc(p.name)}" loading="lazy" />` : ''}</div><span class="clamp-2">${esc(p.name)}</span></a>`;
}
export function wideCard(u) {
  const date = u.date ? new Date(u.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const href = u.href || (u.key ? hrefFor({ type: u.key.split(':')[0], id: Number(u.key.split(':')[1]), title: u.title, year: u.year }) : '#');
  return `
  <a class="wide-card" href="${href}" aria-label="${esc(u.title)}">
    <div class="thumb">
      ${u.backdrop ? `<img src="${img(u.backdrop, 'w780')}" alt="${esc(u.title)}" loading="lazy" />` : `<div class="poster-fallback">${esc(u.title)}</div>`}
      <div class="card-overlay"><div><h3 class="clamp-2">${esc(u.title)}</h3>${date ? `<p>${icon('calendar', 12)} ${date}</p>` : ''}</div></div>
      ${u.badge ? `<span class="badge-float">${esc(u.badge)}</span>` : ''}
    </div>
    <div class="cap clamp-1">${esc(u.title)}</div>${date ? `<div class="cap-sub">${date}</div>` : ''}
  </a>`;
}
export function row({ id, title, viewAll, items, kind = 'poster', titleExtra = '', minHeight = true }) {
  const body = kind === 'tiles' ? items.map(tile).join('') : kind === 'wide' ? items.map(wideCard).join('') : items.map(it => card(it)).join('');
  return `
  <section class="row" data-row="${esc(id || '')}">
    <div class="row-head"><h2 class="row-title">${esc(title)}${titleExtra}</h2>${viewAll ? `<a class="view-all" href="${viewAll}"><span>View All</span>${icon('arrowRight', 16)}</a>` : ''}</div>
    <div class="row-body">
      <button class="scroll-btn is-left" data-action="scroll-left" aria-label="Scroll left">${icon('chevronLeft', 30)}</button>
      <button class="scroll-btn is-right" data-action="scroll-right" aria-label="Scroll right">${icon('chevronRight', 30)}</button>
      <div class="scroller hide-scrollbar${kind === 'tiles' ? ' is-tiles' : ''}" ${minHeight && kind === 'poster' ? 'style="min-height:310px"' : ''}>${body}</div>
    </div>
  </section>`;
}
export function mountScrollers(root) {
  root.querySelectorAll('.row-body, .scroll-wrap').forEach(body => {
    const sc = body.querySelector('.scroller, .cast-scroller, .episode-scroller, .trailer-scroller'); if (!sc) return;
    const l = body.querySelector('.scroll-btn.is-left'), r = body.querySelector('.scroll-btn.is-right');
    const upd = () => { if (l) l.classList.toggle('is-disabled', sc.scrollLeft <= 4); if (r) r.classList.toggle('is-disabled', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4); };
    sc.addEventListener('scroll', upd, { passive: true }); upd();
    body.addEventListener('click', e => { const b = e.target.closest('[data-action^="scroll-"]'); if (!b) return; e.preventDefault(); const dir = b.dataset.action === 'scroll-left' ? -1 : 1; sc.scrollBy({ left: dir * Math.round(sc.clientWidth * 0.8), behavior: 'smooth' }); });
  });
}

// ------------------------------------------------------------ dropdown
export function dropdown({ id, label, value, options, align = 'left', dot = false, cols = false, small = false }) {
  const sel = options.find(o => String(o.value) === String(value));
  return `
  <div class="dropdown" data-dd="${esc(id)}">
    <button class="dropdown-toggle${small ? ' is-small' : ''}" data-action="toggle-dd" aria-haspopup="listbox" aria-expanded="false">
      <span class="label">${dot && sel && sel.value !== '' ? '<span class="active-dot"></span>' : ''}${sel?.img ? `<img class="dd-img" src="${img(sel.img, 'w92')}" alt="" />` : ''}<span>${esc(sel ? sel.label : label)}</span></span>
      ${icon('chevronDown', 16, 'class="chev"')}
    </button>
    <div class="dropdown-menu${align === 'right' ? ' align-right' : ''}" role="listbox">
      <div class="${cols ? 'dd-cols' : ''}">${options.map(o => `<button role="option" data-action="dd-select" data-value="${esc(o.value)}" class="${String(o.value) === String(value) ? 'is-selected' : ''}" aria-selected="${String(o.value) === String(value)}">${o.img ? `<img class="dd-img" src="${img(o.img, 'w92')}" alt="" loading="lazy" />` : ''}<span>${esc(o.label)}</span>${String(o.value) === String(value) ? icon('check', 16) : ''}</button>`).join('')}</div>
    </div>
  </div>`;
}

// ------------------------------------------------------------ misc blocks
export function footer() {
  const email = (window.CINEJOY_CONFIG || {}).contactEmail;
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <a class="wordmark" href="/" aria-label="Home"><img src="/brand/logomark-accent.svg" alt="" width="34" height="34" /><span class="wm-text">CINE<b>JOY</b></span></a>
      <p class="footer-note">This is an independent recreation of a streaming interface. It does not host, store, or distribute any media files. Titles, artwork and metadata are provided by TMDB, and this product is not endorsed or certified by TMDB.</p>
      ${email ? `<a class="footer-link" href="mailto:${esc(email)}">${esc(email)}</a>` : ''}
    </div>
  </footer>`;
}
export function scrollTopButton() { return `<button class="scroll-top" id="scroll-top" data-action="scroll-top" aria-label="Back to top">${icon('arrowUp', 20)}</button>`; }
export function mountScrollTop() {
  const b = document.getElementById('scroll-top'); if (!b) return () => {};
  const on = () => b.classList.toggle('is-visible', window.scrollY > 600); window.addEventListener('scroll', on, { passive: true }); on();
  return () => window.removeEventListener('scroll', on);
}
export function infoPanel(rows) {
  return `<div class="info-panel">${rows.map(r => `<div class="row-kv"><span class="k">${esc(r.k)}</span><span class="v">${esc(r.v)}${r.ends && r.endsAt ? `<span class="dot">•</span><span class="muted">Ends ${esc(r.endsAt)}</span>` : ''}</span></div>`).join('')}</div>`;
}
export function castRow(cast) {
  if (!cast?.length) return '';
  return `
  <section class="section"><h2 class="section-title" style="padding:0 8px">Cast</h2>
    <div class="row-body scroll-wrap">
      <button class="scroll-btn is-left" data-action="scroll-left" aria-label="Scroll left">${icon('chevronLeft', 30)}</button>
      <button class="scroll-btn is-right" data-action="scroll-right" aria-label="Scroll right">${icon('chevronRight', 30)}</button>
      <div class="cast-scroller hide-scrollbar">${cast.map(c => `<a class="cast-item" href="${c.id ? `/person/${c.id}` : '#'}"><div class="cast-avatar">${c.photo ? `<img src="${img(c.photo, 'w185')}" alt="${esc(c.name)}" loading="lazy" />` : `<div class="initials">${esc(initials(c.name))}</div>`}</div><div><p class="name clamp-1">${esc(c.name)}</p>${c.character ? `<p class="role clamp-1">${esc(c.character)}</p>` : ''}</div></a>`).join('')}</div>
    </div>
  </section>`;
}
export const initials = n => String(n || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
export function trailerRow(trailers) {
  if (!trailers?.length) return '';
  return `
  <section class="section"><h2 class="section-title" style="padding:0 8px">Trailers</h2>
    <div class="trailer-scroller hide-scrollbar">${trailers.map(t => `<button class="trailer-card" data-action="trailer" data-yt="${esc(t.youtubeKey)}" aria-label="Play ${esc(t.title)}"><div class="frame"><img src="https://img.youtube.com/vi/${esc(t.youtubeKey)}/mqdefault.jpg" alt="${esc(t.title)}" loading="lazy" /><div class="shade"></div><div class="cap"><p class="clamp-1">${esc(t.title)}</p><p>${esc(t.type || 'Trailer')}</p></div></div></button>`).join('')}</div>
  </section>`;
}
export function commentsSection(count = 0) {
  return `
  <section class="section comments" id="comments" aria-label="Comments">
    <div class="section-head"><h2 class="section-title">Comments <span class="count tabular">(${count})</span></h2><button class="comments-sort" data-action="noop">Newest ${icon('chevronDown', 14)}</button></div>
    <button class="composer" data-action="login"><span>${store.settings.displayName ? 'Write a comment…' : 'Login to leave a comment.'}</span></button>
    <div class="comments-empty"><span>No comments yet. Be the first to start the conversation.</span></div>
  </section>`;
}

// ------------------------------------------------------------ overlays
let toastTimer = null;
export function toast(msg, ic = 'check') {
  const t = document.getElementById('toast'); if (!t) return;
  t.innerHTML = `${icon(ic, 18)}<span>${esc(msg)}</span>`; t.classList.add('is-visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2400);
}
export function modal(html, { wide = false, onClose } = {}) {
  closeModal();
  const root = document.createElement('div'); root.className = 'modal-root'; root.id = 'modal-root';
  root.innerHTML = `<div class="modal${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  root.addEventListener('click', e => { if (e.target === root || e.target.closest('[data-action="close-modal"]')) { closeModal(); onClose?.(); } });
  document.getElementById('overlay-root').appendChild(root);
  const esc_ = e => { if (e.key === 'Escape') { closeModal(); onClose?.(); document.removeEventListener('keydown', esc_); } };
  document.addEventListener('keydown', esc_);
  return root;
}
export function closeModal() { document.getElementById('modal-root')?.remove(); }
export function trailerModal(ytKey) {
  modal(`<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytKey)}?autoplay=1&rel=0" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`, { wide: true });
}
// ---- add to list popover ------------------------------------------------
export function addToListPopover(anchor, key, title) {
  closeMenus();
  const el = document.createElement('div'); el.className = 'popover-menu list-popover'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Add to list');
  let creating = false;
  const render = () => {
    const lists = store.lists;
    el.innerHTML = `
      <div class="lp-head">Add to List</div>
      <div class="lp-body">${lists.length ? lists.map(l => `<button class="lp-row${l.items.includes(key) ? ' is-in' : ''}" data-lp="toggle" data-list="${l.id}"><span class="lp-name clamp-1">${esc(l.name)}</span><span class="lp-count">${l.items.length}</span><span class="lp-check">${l.items.includes(key) ? icon('check', 16) : ''}</span></button>`).join('') : `<p class="lp-empty">No lists yet. Create one below!</p>`}</div>
      <div class="lp-foot">${creating ? `<form class="lp-create" data-lp="form"><input id="lp-name" type="text" maxlength="60" placeholder="List name" autocomplete="off" aria-label="List name" /><button class="pill-btn is-primary" type="submit">Add</button></form>` : `<button class="lp-new" data-lp="new">${icon('plus', 16)}<span>Create New List</span></button>`}</div>`;
    if (creating) setTimeout(() => el.querySelector('#lp-name')?.focus(), 10);
  };
  render();
  document.getElementById('overlay-root').appendChild(el);
  const place = () => {
    const r = anchor.getBoundingClientRect(); const w = 256; const mobile = window.innerWidth < 640;
    el.style.width = w + 'px';
    if (mobile) { el.style.left = Math.max(8, (window.innerWidth - w) / 2) + 'px'; el.style.top = Math.min(r.bottom + 10, window.innerHeight - el.offsetHeight - 90) + 'px'; }
    else { el.style.left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8) + 'px'; el.style.top = Math.min(r.bottom + 8, window.innerHeight - el.offsetHeight - 12) + 'px'; }
  };
  place();
  el.addEventListener('click', e => {
    e.stopPropagation();
    const t = e.target.closest('[data-lp]'); if (!t) return;
    if (t.dataset.lp === 'toggle') { const added = store.toggleInList(t.dataset.list, key); toast(added ? 'Added to list' : 'Removed from list', added ? 'check' : 'x'); render(); place(); syncAddButtons(key); }
    else if (t.dataset.lp === 'new') { creating = true; render(); place(); }
  });
  el.addEventListener('submit', e => {
    e.preventDefault(); const inp = el.querySelector('#lp-name'); const name = inp.value.trim(); if (!name) { inp.focus(); return; }
    const l = store.createList(name); store.toggleInList(l.id, key); toast(`Added to “${l.name}”`); creating = false; render(); place(); syncAddButtons(key);
  });
  const off = e => { if (!el.contains(e.target)) { close(); } };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { el.remove(); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', onKey); };
  setTimeout(() => { document.addEventListener('mousedown', off, true); document.addEventListener('keydown', onKey); }, 0);
}
function syncAddButtons(key) {
  const inList = store.listsContaining(key).length > 0;
  document.querySelectorAll(`[data-action="add-list"][data-key="${CSS.escape(key)}"].pill-btn`).forEach(b => { b.classList.toggle('is-active', inList); b.innerHTML = icon(inList ? 'check' : 'plus', 20); });
}

// ---- sign in / register -------------------------------------------------
export function loginModal(initialTab = 'signin') {
  closeModal();
  let tab = initialTab; let reveal = false; let value = ''; let error = ''; let busy = false; let generated = null; let saved = false;
  const root = document.createElement('div'); root.className = 'modal-root is-sheet'; root.id = 'modal-root';
  document.getElementById('overlay-root').appendChild(root);
  const user = auth.user;
  const mark = `<img class="auth-mark" src="/brand/logomark-white.svg" alt="" width="64" height="64" />`;

  const render = () => {
      const tabs = `<div class="auth-tabs" role="tablist"><button role="tab" data-au="tab" data-t="signin" class="${tab === 'signin' ? 'is-active' : ''}" aria-selected="${tab === 'signin'}">Sign In</button><button role="tab" data-au="tab" data-t="register" class="${tab === 'register' ? 'is-active' : ''}" aria-selected="${tab === 'register'}">Register</button></div>`;
    let body;
    if (user) {
      body = `${mark}<h2>Signed in</h2><p class="auth-sub">Account ending in <b>${esc(user.last4)}</b></p>
        <div class="auth-field"><label for="au-name">Display name</label><div class="auth-input"><input id="au-name" type="text" maxlength="32" value="${esc(user.name || '')}" placeholder="user-${esc(user.last4)}" autocomplete="off" /></div></div>
        <button class="auth-primary" data-au="save-name">Save</button><button class="auth-secondary" data-au="signout">Sign out</button>`;
    } else if (tab === 'signin') {
      const n = formatNumber(value); const ok = digitsOnly(value).length === 16;
      body = `${mark}<h2>Welcome back</h2><p class="auth-sub">Enter your 16-digit account number</p>${tabs}
        <div class="auth-input${error ? ' has-error' : ''}"><input id="au-num" type="${reveal ? 'text' : 'password'}" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="19" value="${esc(n)}" placeholder="Enter your account number" aria-label="Account number" /><button class="auth-eye" data-au="eye" aria-label="${reveal ? 'Hide' : 'Show'} number">${icon(reveal ? 'eyeOff' : 'eye', 20)}</button></div>
        ${error ? `<p class="auth-error" role="alert">${esc(error)}</p>` : ''}
        <button class="auth-primary" data-au="signin" ${ok && !busy ? '' : 'disabled'}>${busy ? 'Signing in…' : 'Sign In'}</button>`;
    } else if (!generated) {
      body = `${mark}<h2>Create your account</h2><p class="auth-sub">Create your 16-digit account number</p>${tabs}
        <div class="auth-keyicon">${icon('key', 22)}</div>
        <p class="auth-note">We’ll make you a random <b>16-digit number</b>. That’s your only login, so keep it somewhere safe.</p>
        <button class="auth-primary" data-au="generate" ${busy ? 'disabled' : ''}>${busy ? 'Generating…' : 'Generate my key'}</button>`;
    } else {
      body = `${mark}<h2>Your account number</h2><p class="auth-sub">Save it now. It can’t be recovered.</p>
        <div class="auth-number" aria-live="polite"><span>${esc(formatNumber(generated))}</span><button data-au="copy" aria-label="Copy number">${icon('copy', 18)}</button></div>
        <label class="auth-check"><input type="checkbox" id="au-saved" ${saved ? 'checked' : ''} /><span>I’ve saved my number somewhere safe</span></label>
        <button class="auth-primary" data-au="finish" ${saved ? '' : 'disabled'}>Continue</button>`;
    }
    root.innerHTML = `<div class="modal auth-modal" role="dialog" aria-modal="true" aria-label="Account"><button class="auth-close" data-action="close-modal" aria-label="Close">${icon('x', 18)}</button>${body}</div>`;
    const inp = root.querySelector('#au-num') || root.querySelector('#au-name');
    if (inp) { inp.focus(); const L = inp.value.length; try { inp.setSelectionRange(L, L); } catch { /* ignore */ } }
  };
  const doSignIn = async () => { if (busy || digitsOnly(value).length !== 16) return; busy = true; error = ''; render(); const r = await auth.signIn(value); busy = false; if (r.ok) { closeModal(); toast('Signed in'); document.dispatchEvent(new CustomEvent('app:rerender')); } else { error = r.error; render(); } };
  root.addEventListener('click', async e => {
    if (e.target === root || e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
    const t = e.target.closest('[data-au]'); if (!t) return; const act = t.dataset.au;
    if (act === 'tab') { tab = t.dataset.t; error = ''; value = ''; generated = null; saved = false; render(); }
    else if (act === 'eye') { reveal = !reveal; render(); }
    else if (act === 'signin') doSignIn();
    else if (act === 'generate') { busy = true; render(); generated = await auth.register(); busy = false; render(); }
    else if (act === 'copy') { try { await navigator.clipboard.writeText(digitsOnly(generated)); toast('Copied to clipboard', 'copy'); } catch { toast('Select and copy the number manually', 'info'); } }
    else if (act === 'finish') { await auth.completeRegistration(generated); closeModal(); toast('Account created'); document.dispatchEvent(new CustomEvent('app:rerender')); }
    else if (act === 'save-name') { auth.setName(root.querySelector('#au-name').value); closeModal(); toast('Profile updated'); document.dispatchEvent(new CustomEvent('app:rerender')); }
    else if (act === 'signout') { auth.signOut(); closeModal(); toast('Signed out'); document.dispatchEvent(new CustomEvent('app:rerender')); }
  });
  root.addEventListener('input', e => {
    if (e.target.id === 'au-num') { const raw = digitsOnly(e.target.value).slice(0, 16); value = raw; error = ''; const f = formatNumber(raw); e.target.value = f; const btn = root.querySelector('[data-au="signin"]'); if (btn) btn.disabled = raw.length !== 16; root.querySelector('.auth-error')?.remove(); root.querySelector('.auth-input')?.classList.remove('has-error'); }
    if (e.target.id === 'au-saved') { saved = e.target.checked; root.querySelector('[data-au="finish"]').disabled = !saved; }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'au-num') doSignIn(); if (e.key === 'Escape') closeModal(); });
  render();
}

// ---- downloads ------------------------------------------------------------
export function downloadModal(title) {
  const root = modal('', {}); root.classList.add('is-center');
  const render = () => {
    root.querySelector('.modal').className = 'modal download-modal';
    root.querySelector('.modal').innerHTML = `<div class="dl-head"><h2 class="clamp-1">Downloads for ${esc(title || 'this title')}</h2><button class="auth-close is-inline" data-action="close-modal" aria-label="Close">${icon('x', 18)}</button></div>
      <div class="dl-body"><span class="dl-icon">${icon('download', 36)}</span><p>No downloads are available. This recreation has no media sources configured.</p><button class="pill-btn is-small" data-dl="retry">${icon('refresh', 14)}<span>Try again</span></button></div>`;
  };
  render();
  root.addEventListener('click', e => { if (e.target.closest('[data-dl="retry"]')) { const b = e.target.closest('button'); b.disabled = true; b.querySelector('span').textContent = 'Checking…'; setTimeout(render, 700); } });
}
export function genreName(type, id) { return GENRES[type]?.[id] || null; }
