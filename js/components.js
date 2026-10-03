// Reusable UI building blocks. Functions return HTML strings; "mount" helpers wire behaviour.
import { icon } from './icons.js';
import { img, hrefFor, watchHref, GENRES } from './data.js';
import { store } from './store.js';

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
  const name = store.settings.displayName;
  el.innerHTML = `
    <button role="menuitem" data-action="login">${icon(name ? 'user' : 'login', 18)}<span>${name ? esc(name) : 'Login'}</span></button>
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
export function card(it, { lazy = true } = {}) {
  if (!it) return '';
  const r = fmtRating(it.rating);
  const sub = `${it.year ? `<span>${it.year}</span>` : ''}${r ? `<span class="rt">${icon('star', 12)}${r}</span>` : ''}`;
  return `
  <a class="card" href="${hrefFor(it)}" aria-label="${esc(it.title)}" data-key="${esc(it.key)}">
    <div class="card-poster">
      ${it.poster ? `<img src="${img(it.poster, 'w500')}" alt="${esc(it.title)}" ${lazy ? 'loading="lazy"' : ''} decoding="async" />` : `<div class="poster-fallback">${esc(it.title)}</div>`}
      <div class="veil"></div>
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
      <a class="wordmark" href="/" aria-label="Home"><img src="/brand/logomark-white.svg" alt="" width="34" height="34" /><span>Cinejoy</span></a>
      <p class="footer-note">This is an independent front-end recreation of a streaming interface, built for design study. It does not host, store, or distribute any media files. Title artwork and metadata are served from The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
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
export function addToListModal(key, title) {
  const render = () => {
    const lists = store.lists;
    return `
      <h2>Add to list</h2><p>${esc(title || 'Choose a list for this title.')}</p>
      <div class="choice-list">
        ${lists.length ? lists.map(l => `<button data-action="toggle-list-item" data-list="${l.id}" data-key="${esc(key)}" class="${l.items.includes(key) ? 'is-in' : ''}"><span>${esc(l.name)} <small style="color:var(--fg-40)">· ${l.items.length}</small></span>${l.items.includes(key) ? icon('check', 18) : icon('plus', 18)}</button>`).join('') : `<p style="margin:0">You have no lists yet.</p>`}
      </div>
      <div class="field"><label for="new-list-name">New list</label><input id="new-list-name" type="text" placeholder="e.g. Weekend watchlist" /></div>
      <div class="acts"><button class="pill-btn" data-action="close-modal">Done</button><button class="pill-btn is-primary" data-action="create-list-and-add" data-key="${esc(key)}">Create & add</button></div>`;
  };
  const root = modal(render());
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-action="toggle-list-item"]');
    if (t) { const added = store.toggleInList(t.dataset.list, t.dataset.key); toast(added ? 'Added to list' : 'Removed from list', added ? 'check' : 'x'); root.querySelector('.modal').innerHTML = render(); return; }
    const c = e.target.closest('[data-action="create-list-and-add"]');
    if (c) { const inp = root.querySelector('#new-list-name'); const name = inp.value.trim(); if (!name) { inp.focus(); return; } const l = store.createList(name); store.toggleInList(l.id, c.dataset.key); toast(`Added to “${l.name}”`); root.querySelector('.modal').innerHTML = render(); }
  });
}
export function loginModal() {
  const root = modal(`
    <h2>${store.settings.displayName ? 'Your profile' : 'Sign in'}</h2>
    <p>This recreation has no backend. Set a display name to personalise the interface on this device.</p>
    <div class="field"><label for="dn">Display name</label><input id="dn" type="text" value="${esc(store.settings.displayName)}" placeholder="Your name" /></div>
    <div class="acts">${store.settings.displayName ? `<button class="pill-btn" data-action="sign-out">Sign out</button>` : ''}<button class="pill-btn" data-action="close-modal">Cancel</button><button class="pill-btn is-primary" data-action="save-name">Continue</button></div>`);
  root.addEventListener('click', e => {
    if (e.target.closest('[data-action="save-name"]')) { store.setSetting('displayName', root.querySelector('#dn').value.trim()); closeModal(); toast('Profile updated'); document.dispatchEvent(new CustomEvent('app:rerender')); }
    if (e.target.closest('[data-action="sign-out"]')) { store.setSetting('displayName', ''); closeModal(); toast('Signed out'); document.dispatchEvent(new CustomEvent('app:rerender')); }
  });
}
export function genreName(type, id) { return GENRES[type]?.[id] || null; }
