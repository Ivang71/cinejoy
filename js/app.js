// Application bootstrap: routing, global actions, page lifecycle.
import { route, startRouter, onNavigate, navigate, back, currentPath } from './router.js';
import { loadCatalog, getItem, getDetails, hrefFor, watchHref, img } from './data.js';
import { header, mountHeader, profileMenu, closeMenus, setAmbient, setAurora, addToListModal, trailerModal, loginModal, toast, modal, closeModal, esc, fmtRating } from './components.js';
import { store, applySettings } from './store.js';
import { icon } from './icons.js';
import * as pages from './pages.js';

const view = document.getElementById('view');
let cleanup = null; let currentMatch = null; let renderSeq = 0;

route('/', () => pages.homePage());
route('/movies', (p, q) => pages.discoveryPage('movies', q));
route('/series', (p, q) => pages.discoveryPage('series', q));
route('/search', () => pages.searchPage(''));
route('/search/:query', p => pages.searchPage(p.query));
route('/category/:type/:key', p => pages.categoryPage(p.type, p.key));
route('/provider/:id', (p, q) => pages.providerPage(p.id, q));
route('/movie/:slug', p => pages.detailPage('movie', p.slug));
route('/series/:slug', p => pages.detailPage('series', p.slug));
route('/tv/:slug', p => pages.detailPage('series', p.slug));
route('/person/:id', p => pages.personPage(p.id));
route('/lists', () => pages.listsPage());
route('/lists/discover', () => pages.listsDiscoverPage());
route('/list/:slug', p => pages.listPage(p.slug));
route('/continue-watching', () => pages.historyPage());
route('/settings', () => pages.settingsPage((location.hash || '').replace('#', '')));
route('/settings/player', () => pages.playerSettingsPage());
route('/shorts', () => pages.shortsPage());
route('/watch/movie/:id', p => pages.watchPage('movie', p.id));
route('/watch/tv/:id/:season/:episode', p => pages.watchPage('tv', p.id, p.season, p.episode));

async function render(m, path) {
  const seq = ++renderSeq;
  currentMatch = m;
  closeMenus(); closeModal();
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  let page;
  try { page = await (m ? m.route.handler(m.params, m.query) : pages.notFoundPage()); }
  catch (e) { console.error(e); page = { title: 'Error - Cinejoy', html: `<div class="empty-state" style="min-height:70vh"><p>Something went wrong loading this page.</p><a href="/">Back to home</a></div>`, mount() {}, ambient: 'aurora' }; }
  if (seq !== renderSeq) return;
  document.title = page.title || 'Cinejoy';
  const pathname = path.split('?')[0];
  const headerHtml = page.bare ? '' : header(pathname, { showBack: page.back });
  view.innerHTML = headerHtml + `<div class="page-enter">${page.html}</div>`;
  if (page.ambient === 'aurora') setAurora(); else if (page.ambient) setAmbient(page.ambient); else if (!page.bare) setAmbient(null);
  window.scrollTo({ top: 0, behavior: 'instant' });
  const c1 = page.bare ? null : mountHeader();
  const c2 = await page.mount?.(view);
  if (seq !== renderSeq) { c1?.(); c2?.(); return; }
  cleanup = () => { c1?.(); c2?.(); };
}

// ---------------------------------------------------------------- global actions
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (a === 'back') { e.preventDefault(); back(); }
  else if (a === 'profile-menu') { e.preventDefault(); e.stopPropagation(); profileMenu(el); }
  else if (a === 'login') { e.preventDefault(); closeMenus(); loginModal(); }
  else if (a === 'add-list') { e.preventDefault(); const key = el.dataset.key; if (!key) return; const it = getItem(key); addToListModal(key, el.dataset.title || it?.title); }
  else if (a === 'trailer') { e.preventDefault(); trailerModal(el.dataset.yt); }
  else if (a === 'scroll-top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (a === 'toggle-dd') { e.preventDefault(); e.stopPropagation(); const dd = el.closest('.dropdown'); const open = dd.classList.contains('is-open'); closeMenus(); if (!open) { dd.classList.add('is-open'); el.setAttribute('aria-expanded', 'true'); } }
  else if (a === 'dd-select') { e.preventDefault(); const dd = el.closest('.dropdown'); const id = dd.dataset.dd; const value = el.dataset.value; dd.classList.remove('is-open'); document.dispatchEvent(new CustomEvent('dd:select', { detail: { id, value, root: view } })); }
  else if (a === 'noop') { e.preventDefault(); toast('Not available in this recreation', 'info'); }
});
document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.is-open').forEach(d => d.classList.remove('is-open')); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenus(); } if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); navigate('/search'); } });
document.addEventListener('app:rerender', () => { if (currentMatch !== undefined) render(currentMatch, currentPath()); });

// Detail "modal" preference: open a compact preview instead of navigating.
document.addEventListener('click', e => {
  if (store.settings.detailView !== 'modal') return;
  const a = e.target.closest('a.card[data-key]'); if (!a || e.metaKey || e.ctrlKey) return;
  const it = getItem(a.dataset.key); if (!it) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const r = fmtRating(it.rating);
  const root = modal(`<div style="display:flex;gap:16px"><img src="${img(it.poster, 'w342')}" alt="" style="width:120px;border-radius:12px;flex:none" /><div style="min-width:0"><h2>${esc(it.title)}</h2><p>${[it.year, r ? '★ ' + r : null].filter(Boolean).join(' · ')}</p><p id="pv-ov" style="margin-top:10px" class="clamp-3">${esc(it.overview || '')}</p></div></div><div class="acts"><button class="pill-btn is-icon" data-action="add-list" data-key="${esc(it.key)}" aria-label="Add to list">${icon('plus', 18)}</button><a class="pill-btn" href="${hrefFor(it)}" data-action="close-modal-nav">More info</a><a class="pill-btn is-primary" href="${watchHref(it)}" data-action="close-modal-nav">${icon('play', 16)} Play</a></div>`);
  root.addEventListener('click', ev => { if (ev.target.closest('[data-action="close-modal-nav"]')) setTimeout(closeModal, 0); });
  if (!it.overview) getDetails(it.type, it.id).then(d => { const p = root.querySelector('#pv-ov'); if (p && d.overview) p.textContent = d.overview; });
}, true);

// ---------------------------------------------------------------- boot
(async () => {
  applySettings();
  store.subscribe(applySettings);
  view.innerHTML = `<div class="hero"><div class="hero-media skeleton" style="border-radius:0"></div></div>`;
  await loadCatalog();
  onNavigate(render);
  startRouter();
})();
