// Page renderers. Each returns { title, html, mount(root) -> cleanup, back, ambient }.
import { icon } from './icons.js';
import { img, hrefFor, watchHref, getHome, getDiscovery, discover, getCategory, getProvider, getDetails, getSeason, getPerson, getProviderRow, search, getTrendingToday, itemFromSlug, getCatalog, items as itemsOf, GENRES, SORTS, COUNTRIES, yearsList, keyOf, live, typeFromRoute } from './data.js';
import { esc, fmtRating, hero, mountHero, row, card, tile, wideCard, skeletonCards, dropdown, footer, scrollTopButton, mountScrollTop, infoPanel, castRow, trailerRow, commentsSection, setAmbient, setAurora, toast, modal, closeModal, trailerModal, initials, mountScrollers } from './components.js';
import { store, DEFAULT_SETTINGS } from './store.js';
import { navigate } from './router.js';

const PROVIDER_IDS = [8, 9, 337, 350, 2, 15, 1899, 2303, 386, 283, 43, 526, 34, 188, 192, 73, 300];
const providerOptions = () => (getCatalog()?.providers || []).map(p => ({ value: p.id, label: p.name, img: p.logo }));
const onDD = (root, fn) => { const h = e => { if (root.contains(e.target) || e.detail?.root === root) fn(e.detail.id, e.detail.value, e); }; document.addEventListener('dd:select', h); return () => document.removeEventListener('dd:select', h); };
const metaSub = it => { const r = fmtRating(it.rating); return [it.year, r ? `★ ${r}` : null].filter(Boolean).join(' · '); };

// ------------------------------------------------------------------ home
export async function homePage() {
  const data = await getHome();
  const provRowState = { movie: '8', tv: '8' };
  const providerRowHtml = (kind, type, list) => {
    const prov = data.providers.find(p => String(p.id) === provRowState[type]) || data.providers[0];
    const dd = dropdown({ id: `prov-${type}`, label: prov?.name || 'Provider', value: prov?.id, options: providerOptions(), small: true });
    return row({ id: kind, title: type === 'movie' ? 'Movies on' : 'TV Series on', items: list, titleExtra: `<span class="inline-dd-wrap">${dd}</span>` });
  };
  const html = `
    ${hero(data.slides)}
    <div class="home-rows" id="home-rows">
      ${data.providers.length ? row({ id: 'providers', title: 'Browse by Provider', kind: 'tiles', items: data.providers }) : ''}
      ${data.rows.map(r => r.kind === 'provider-movies' ? `<div data-prov-row="movie">${providerRowHtml(r.id, 'movie', [])}</div>` : r.kind === 'provider-series' ? `<div data-prov-row="tv">${providerRowHtml(r.id, 'tv', [])}</div>` : row({ id: r.id, title: r.title, viewAll: r.viewAll, items: itemsOf(r.items) })).join('')}
    </div>
    ${footer()}`;
  return {
    title: 'Cinejoy', html, back: false,
    async mount(root) {
      const cleanups = [];
      cleanups.push(mountHero(root, data.slides, s => setAmbient(s.backdrop || s.item?.poster)));
      mountScrollers(root);
      const fill = async type => {
        const wrap = root.querySelector(`[data-prov-row="${type}"]`); if (!wrap) return;
        const list = await getProviderRow(provRowState[type], type);
        wrap.innerHTML = providerRowHtml(type === 'movie' ? 'provider-movies' : 'provider-series', type, list); mountScrollers(wrap);
      };
      await Promise.all([fill('movie'), fill('tv')]);
      cleanups.push(onDD(root, (id, value) => { if (id === 'prov-movie') { provRowState.movie = value; fill('movie'); } if (id === 'prov-tv') { provRowState.tv = value; fill('tv'); } }));
      return () => cleanups.forEach(f => f && f());
    },
  };
}

// ------------------------------------------------------------------ discovery (movies / series)
export async function discoveryPage(kind, query = {}) {
  const data = await getDiscovery(kind);
  const type = data.type; const isMovie = type === 'movie';
  const f = { genre: query.genre || '', year: query.year || '', sort: query.sort || 'popularity.desc', provider: query.provider || '', country: query.country || '' };
  const filtersHtml = () => `
    <div class="filter-bar">
      <button class="random-btn" data-action="random" aria-label="Play Random ${isMovie ? 'Movie' : 'Show'}"><span class="ic">${icon('dice', 18)}</span><span class="lbl">Random</span></button>
      ${dropdown({ id: 'genre', label: 'Genre', value: f.genre, options: [{ value: '', label: 'All Genres' }, ...Object.entries(GENRES[type]).map(([v, l]) => ({ value: v, label: l }))], align: 'right' })}
      ${dropdown({ id: 'year', label: 'Year', value: f.year, options: [{ value: '', label: 'Any Year' }, ...yearsList().map(y => ({ value: y, label: String(y) }))], align: 'right', cols: true })}
      ${dropdown({ id: 'sort', label: 'Sort', value: f.sort, options: SORTS.map(s => ({ value: s.id, label: s.label })), align: 'right', dot: true })}
      ${dropdown({ id: 'provider', label: 'Provider', value: f.provider, options: [{ value: '', label: 'Any Provider' }, ...providerOptions()], align: 'right' })}
      ${dropdown({ id: 'country', label: 'Country', value: f.country, options: [{ value: '', label: 'Any Country' }, ...COUNTRIES.map(([v, l]) => ({ value: v, label: l }))], align: 'right' })}
    </div>`;
  const html = `
    ${hero(data.slides)}
    <div class="discovery-head">
      <h1 class="h1">${isMovie ? 'Movies' : 'Series'}</h1>
      <div id="filters">${filtersHtml()}</div>
    </div>
    <div class="discovery-body">
      ${data.upcoming?.length ? row({ id: 'upcoming', title: data.upcomingTitle, kind: 'wide', items: data.upcoming, minHeight: false }) : ''}
      <div class="results-count" id="results-count"></div>
      <div class="discovery-grid"><div class="grid" id="results">${skeletonCards(12)}</div></div>
      <div class="load-more" id="sentinel"></div>
    </div>
    ${scrollTopButton()}
    ${footer()}`;
  return {
    title: `${isMovie ? 'Movies' : 'Series'} - Cinejoy`, html, back: true,
    async mount(root) {
      const cleanups = [mountHero(root, data.slides, s => setAmbient(s.backdrop || s.item?.poster)), mountScrollTop()];
      mountScrollers(root);
      let page = 1, pages = 1, loading = false, all = [];
      const grid = root.querySelector('#results'); const count = root.querySelector('#results-count');
      const syncUrl = () => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v && !(k === 'sort' && v === 'popularity.desc')) q.set(k, v); const s = q.toString(); history.replaceState({}, '', `/${kind}${s ? '?' + s : ''}`); };
      const load = async (reset = false) => {
        if (loading) return; loading = true;
        if (reset) { page = 1; all = []; grid.innerHTML = skeletonCards(12); }
        try {
          const r = await discover(kind, f, page); pages = r.pages || 1; all = all.concat(r.items);
          grid.innerHTML = all.length ? all.map(it => card(it)).join('') : `<div class="search-empty" style="grid-column:1/-1">Nothing matches these filters yet.</div>`;
          count.textContent = r.total ? `${r.total.toLocaleString()} titles` : '';
        } catch (e) { console.error(e); grid.innerHTML = `<div class="search-empty" style="grid-column:1/-1">Could not load results.</div>`; }
        loading = false;
      };
      await load(true);
      const io = new IntersectionObserver(en => { if (en[0].isIntersecting && page < pages && !loading) { page++; load(); } }, { rootMargin: '600px' });
      io.observe(root.querySelector('#sentinel')); cleanups.push(() => io.disconnect());
      cleanups.push(onDD(root, (id, value) => { if (!(id in f)) return; f[id] = value; root.querySelector('#filters').innerHTML = filtersHtml(); syncUrl(); load(true); }));
      const onClick = e => { if (e.target.closest('[data-action="random"]')) { const pick = all[Math.floor(Math.random() * all.length)]; if (pick) navigate(hrefFor(pick)); else toast('No titles loaded yet', 'info'); } };
      root.addEventListener('click', onClick);
      return () => cleanups.forEach(fn => fn && fn());
    },
  };
}

// ------------------------------------------------------------------ category & provider grids
export async function categoryPage(type, key) {
  type = typeFromRoute(type);
  const first = await getCategory(type, key, 1);
  const html = `
    <div class="page-top page-pad" style="padding-left:calc(var(--pad-x) + 16px);padding-right:calc(var(--pad-x) + 16px)">
      <h1 class="h1" style="margin-bottom:32px">${esc(first.title)}</h1>
      <div class="grid" id="results">${first.items.map(it => card(it)).join('') || `<div class="search-empty" style="grid-column:1/-1">Nothing here yet.</div>`}</div>
      <div class="load-more" id="sentinel"></div>
    </div>${scrollTopButton()}${footer()}`;
  return {
    title: `${first.title} - Cinejoy`, html, back: true, ambient: 'aurora',
    mount(root) {
      const cleanups = [mountScrollTop()]; let page = 1, loading = false;
      const io = new IntersectionObserver(async en => { if (!en[0].isIntersecting || loading || page >= (first.pages || 1)) return; loading = true; page++; const r = await getCategory(type, key, page); root.querySelector('#results').insertAdjacentHTML('beforeend', r.items.map(it => card(it)).join('')); loading = false; }, { rootMargin: '600px' });
      io.observe(root.querySelector('#sentinel')); cleanups.push(() => io.disconnect());
      return () => cleanups.forEach(fn => fn());
    },
  };
}
export async function providerPage(id, query = {}) {
  const { provider, movies, series } = await getProvider(id);
  let tab = query.tab === 'series' ? 'series' : 'movies';
  const gridHtml = () => (tab === 'movies' ? movies : series).map(it => card(it)).join('') || `<div class="search-empty" style="grid-column:1/-1">No titles found.</div>`;
  const html = `
    <div class="page-top page-pad" style="padding-left:calc(var(--pad-x) + 24px);padding-right:calc(var(--pad-x) + 24px)">
      <div class="h1-row" style="margin-bottom:28px">${provider.logo ? `<div class="provider-logo"><img src="${img(provider.logo, 'w154')}" alt="" /></div>` : ''}<h1 class="h1">${esc(provider.name)}</h1></div>
      <div class="segment" id="seg" style="margin-bottom:32px"><button data-tab="movies" class="${tab === 'movies' ? 'is-active' : ''}">Movies</button><button data-tab="series" class="${tab === 'series' ? 'is-active' : ''}">Series</button></div>
      <div class="grid" id="results">${gridHtml()}</div>
    </div>${scrollTopButton()}${footer()}`;
  return {
    title: `${provider.name} - Cinejoy`, html, back: true, ambient: 'aurora',
    mount(root) {
      const c = mountScrollTop();
      root.querySelector('#seg').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; root.querySelectorAll('#seg button').forEach(x => x.classList.toggle('is-active', x === b)); root.querySelector('#results').innerHTML = gridHtml(); history.replaceState({}, '', `/provider/${id}${tab === 'series' ? '?tab=series' : ''}`); });
      return c;
    },
  };
}

// ------------------------------------------------------------------ detail (movie / series)
export async function detailPage(routeType, slug) {
  const type = typeFromRoute(routeType);
  const base = itemFromSlug(type, slug);
  if (!base) return notFoundPage();
  const d = await getDetails(type, base.id);
  const isTv = type === 'tv';
  const s = store.settings;
  const r = fmtRating(d.rating);
  const vote = store.getVote(d.key);
  const endsAt = () => { const m = d.runtime || parseRuntime(d.runtimeLabel || d.info?.find(x => x.k === 'Runtime')?.v); if (!m) return null; const t = new Date(Date.now() + m * 60000); return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  const infoRows = (d.info || []).map(x => x.k === 'Runtime' ? { ...x, ends: true, endsAt: endsAt() } : x);
  const credit = d.credit?.people?.length ? `<div class="detail-credit"><span class="lbl">${esc(d.credit.label)}:</span>${d.credit.people.map(p => p.id ? `<a href="/person/${p.id}">${esc(p.name)}</a>` : `<span>${esc(p.name)}</span>`).join(', ')}</div>` : '';
  const yearLabel = isTv ? (d.yearRange || (d.year ? `${d.year}–` : '')) : (d.year || '');
  const runtimeLabel = d.runtimeLabel || (!isTv ? d.info?.find(x => x.k === 'Runtime')?.v : null);
  const sidePanel = `${infoRows.length ? infoPanel(infoRows) : ''}${d.networks?.length ? `<div class="network-logos">${d.networks.map(n => `<div class="n">${n.logo ? `<img src="${img(n.logo, 'w300')}" alt="${esc(n.name)}" title="${esc(n.name)}" />` : `<span class="n-text">${esc(n.name)}</span>`}</div>`).join('')}</div>` : ''}`;
  const inLists = store.listsContaining(d.key).length > 0;
  const seasons = d.seasons?.length ? d.seasons : (isTv ? [{ number: d.seasonNumber || 1, name: d.season || 'Season 1' }] : []);
  let seasonNo = Number((seasons[0]?.number) || d.seasonNumber || 1);
  let epSort = 'asc'; let showRatings = false;
  const html = `
    <div class="detail-backdrop">${d.backdrop || d.poster ? `<img src="${img(d.backdrop || d.poster, d.backdrop ? 'original' : 'w780')}" alt="${esc(d.title)}" fetchpriority="high" />` : ''}</div>
    <div class="detail-head">
      <div class="detail-main">
        ${s.imageLogos && d.logo ? `<img class="detail-logo" src="${img(d.logo, 'w500')}" alt="${esc(d.title)}" />` : `<h1 class="detail-title">${esc(d.title)}</h1>`}
        ${d.genres?.length ? `<div class="detail-genres">${d.genres.map(g => `<span>${esc(g)}</span>`).join('<span class="dot">•</span>')}</div>` : ''}
        <div class="detail-actions">
          <a class="pill-btn is-primary is-lg" href="${isTv ? watchHref(d, seasonNo, 1) : watchHref(d)}">${icon('play', 18)}<span>Play</span></a>
          <button class="pill-btn is-lg is-icon${inLists ? ' is-active' : ''}" data-action="add-list" data-key="${esc(d.key)}" data-title="${esc(d.title)}" aria-label="Add to list">${icon(inLists ? 'check' : 'plus', 20)}</button>
          <button class="pill-btn is-lg is-icon" data-action="download" aria-label="Download">${icon('download', 20)}</button>
          ${!isTv ? `<button class="pill-btn is-lg is-icon${store.isWatched(d.key) ? ' is-active' : ''}" data-action="toggle-watched-title" data-key="${esc(d.key)}" aria-label="Mark as watched">${icon(store.isWatched(d.key) ? 'eye' : 'eyeOff', 20)}</button>` : ''}
        </div>
        <div class="detail-meta">
          ${yearLabel ? `<span>${esc(yearLabel)}</span>` : ''}
          ${runtimeLabel ? `<span>${esc(runtimeLabel)}</span>` : ''}
          ${d.cert ? `<span class="cert">${esc(d.cert)}</span>` : ''}
          ${r ? `<span class="rating-star"><span class="star">★</span>${r}</span>` : ''}
          <span class="vote-split" id="vote-split">
            <button data-action="vote" data-dir="up" class="${vote === 'up' ? 'is-on' : ''}" aria-label="Upvote">${icon('upvote', 16)}<span class="tabular">${(d.votes?.up || 0) + (vote === 'up' ? 1 : 0)}</span></button>
            <button data-action="vote" data-dir="down" class="${vote === 'down' ? 'is-on' : ''}" aria-label="Downvote">${icon('downvote', 16)}<span class="tabular">${(d.votes?.down || 0) + (vote === 'down' ? 1 : 0)}</span></button>
          </span>
        </div>
        ${credit}
        ${d.overview ? `<div class="detail-overview"><p class="clamp-3" id="overview">${esc(d.overview)}</p>${d.overview.length > 180 ? `<button class="read-more" data-action="read-more">Read More</button>` : ''}</div>` : ''}
        <div class="detail-side-mobile">${sidePanel}</div>
      </div>
      <aside class="detail-side">${sidePanel}</aside>
    </div>
    <div class="detail-sections">
      ${isTv ? `<section class="section" id="episodes-section">
        <div class="section-head">
          <h2 class="section-title">Episodes</h2>
          <div class="episode-controls">
            <button class="pill-btn" data-action="ep-ratings" aria-label="View episode ratings">${icon('ratings', 16)}<span class="hide-sm">Ratings</span></button>
            <button class="pill-btn" data-action="ep-sort" aria-label="Sort episodes">${icon('sort', 16)}<span id="ep-sort-label">Oldest</span></button>
            <button class="pill-btn" data-action="ep-mark-season" aria-label="Mark season as watched">${icon('eye', 16)}<span>Mark watched</span></button>
            <span id="season-dd">${dropdown({ id: 'season', label: 'Season', value: seasonNo, options: seasons.map(sn => ({ value: sn.number ?? sn.name, label: sn.name || `Season ${sn.number}` })), align: 'right' })}</span>
          </div>
        </div>
        <div class="row-body scroll-wrap" id="episodes"><div class="episode-scroller hide-scrollbar">${Array.from({ length: 4 }, () => `<div class="episode-card"><div class="still skeleton"></div></div>`).join('')}</div></div>
      </section>` : ''}
      ${castRow(d.cast)}
      ${s.trailers ? trailerRow(d.trailers) : ''}
      ${commentsSection(0)}
    </div>
    ${scrollTopButton()}
    ${footer()}`;
  return {
    title: `${d.title}${d.year ? ` (${d.year})` : ''} - Cinejoy`, html, back: true, ambient: d.backdrop || d.poster || null,
    async mount(root) {
      const cleanups = [mountScrollTop()]; mountScrollers(root);
      root.addEventListener('click', e => {
        const rm = e.target.closest('[data-action="read-more"]'); if (rm) { const p = root.querySelector('#overview'); const open = p.classList.toggle('clamp-3'); rm.textContent = open ? 'Read More' : 'Read Less'; }
        const v = e.target.closest('[data-action="vote"]'); if (v) { const now = store.vote(d.key, v.dataset.dir); root.querySelectorAll('#vote-split button').forEach(b => { const on = b.dataset.dir === now; b.classList.toggle('is-on', on); b.querySelector('span').textContent = (d.votes?.[b.dataset.dir] || 0) + (on ? 1 : 0); }); }
        const dl = e.target.closest('[data-action="download"]'); if (dl) toast('Downloads are not available in this recreation', 'info');
        const tw = e.target.closest('[data-action="toggle-watched-title"]'); if (tw) { const on = store.toggleWatched(d.key); tw.classList.toggle('is-active', on); tw.innerHTML = icon(on ? 'eye' : 'eyeOff', 20); toast(on ? 'Marked as watched' : 'Marked as unwatched'); }
        if (e.target.closest('[data-action="ep-sort"]')) { epSort = epSort === 'asc' ? 'desc' : 'asc'; root.querySelector('#ep-sort-label').textContent = epSort === 'asc' ? 'Oldest' : 'Newest'; renderEpisodes(); }
        if (e.target.closest('[data-action="ep-ratings"]')) { showRatings = !showRatings; e.target.closest('button').classList.toggle('is-active', showRatings); renderEpisodes(); }
        if (e.target.closest('[data-action="ep-mark-season"]')) { const ids = (eps || []).map(ep => `${d.key}:${seasonNo}:${ep.num}`); const allOn = ids.every(i => store.isWatched(i)); store.setWatchedMany(ids, !allOn); toast(allOn ? 'Season marked unwatched' : 'Season marked watched'); renderEpisodes(); }
        const ew = e.target.closest('[data-action="toggle-ep-watched"]'); if (ew) { e.preventDefault(); const on = store.toggleWatched(ew.dataset.id); ew.classList.toggle('is-on', on); }
      });
      let eps = null;
      const renderEpisodes = async () => {
        if (!isTv) return; const wrap = root.querySelector('#episodes'); if (!wrap) return;
        if (!eps) eps = await getSeason(d.id, seasonNo);
        const list = [...(eps || [])].sort((a, b) => epSort === 'asc' ? a.num - b.num : b.num - a.num);
        const spoiler = store.settings.spoilerFree;
        const cards = list.map(ep => {
          const wid = `${d.key}:${seasonNo}:${ep.num}`;
          return `<a class="episode-card" href="/watch/tv/${d.id}/${seasonNo}/${ep.num}">
            <div class="still">${ep.still ? `<img class="${spoiler ? 'spoiler-blur' : ''}" src="${img(ep.still, 'w500')}" alt="${esc(ep.title)}" loading="lazy" />` : `<div class="still-fallback">${icon('film', 28)}</div>`}
              <span class="ep-badge is-num">E${ep.num}</span>
              <button class="ep-watched${store.isWatched(wid) ? ' is-on' : ''}" data-action="toggle-ep-watched" data-id="${wid}" aria-label="Mark episode as watched">${icon('eye', 16)}</button>
              ${ep.runtimeLabel || ep.runtime ? `<span class="ep-badge is-time">${esc(ep.runtimeLabel || (ep.runtime + 'm'))}</span>` : ''}
            </div>
            <div class="ep-text"><h3 class="clamp-1 ${spoiler ? 'spoiler-blur' : ''}">${esc(ep.title || `Episode ${ep.num}`)}</h3>${showRatings && ep.rating ? `<span class="ep-rating">${icon('star', 12)}${fmtRating(ep.rating)}</span>` : ''}${ep.overview ? `<p class="clamp-2 ${spoiler ? 'spoiler-blur' : ''}">${esc(ep.overview)}</p>` : ''}</div>
          </a>`;
        }).join('');
        const grid = store.settings.episodeView === 'grid';
        wrap.innerHTML = grid ? `<div class="episode-grid">${cards || '<p class="search-empty">No episodes listed for this season.</p>'}</div>` : `<button class="scroll-btn is-left" data-action="scroll-left" aria-label="Scroll left">${icon('chevronLeft', 30)}</button><button class="scroll-btn is-right" data-action="scroll-right" aria-label="Scroll right">${icon('chevronRight', 30)}</button><div class="episode-scroller hide-scrollbar">${cards || '<p class="search-empty">No episodes listed for this season.</p>'}</div>`;
        if (!grid) mountScrollers(wrap);
      };
      await renderEpisodes();
      cleanups.push(onDD(root, async (id, value) => { if (id !== 'season') return; seasonNo = Number(value) || value; eps = null; root.querySelector('#season-dd').innerHTML = dropdown({ id: 'season', label: 'Season', value: seasonNo, options: seasons.map(sn => ({ value: sn.number ?? sn.name, label: sn.name || `Season ${sn.number}` })), align: 'right' }); root.querySelector('.detail-actions .pill-btn.is-primary')?.setAttribute('href', watchHref(d, seasonNo, 1)); await renderEpisodes(); }));
      return () => cleanups.forEach(fn => fn && fn());
    },
  };
}
function parseRuntime(label) { if (!label) return 0; const h = /(\d+)\s*h/.exec(label), m = /(\d+)\s*m/.exec(label); return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0); }

// ------------------------------------------------------------------ person
export async function personPage(id) {
  const p = await getPerson(id);
  const html = `
    <div class="page-top"><div class="container-narrow" style="max-width:1200px">
      <div class="person-head">
        <div class="person-photo">${p.photo ? `<img src="${img(p.photo, 'h632')}" alt="${esc(p.name)}" />` : `<div class="initials">${esc(initials(p.name))}</div>`}</div>
        <div>
          <h1 class="h1">${esc(p.name)}</h1>
          <div class="person-facts">${p.department ? `<span><b>${esc(p.department)}</b></span>` : ''}${p.birthday ? `<span>Born <b>${esc(p.birthday)}</b></span>` : ''}${p.place ? `<span>${esc(p.place)}</span>` : ''}</div>
          ${p.bio ? `<p class="person-bio clamp-3" id="bio">${esc(p.bio)}</p><button class="read-more" data-action="bio-more">Read More</button>` : ''}
        </div>
      </div>
      ${p.known?.length ? `<h2 class="section-title" style="margin:40px 0 20px">Known For</h2><div class="grid">${p.known.map(it => card(it)).join('')}</div>` : '<p class="search-empty">No credits available in this snapshot.</p>'}
    </div></div>${scrollTopButton()}${footer()}`;
  return { title: `${p.name} - Cinejoy`, html, back: true, ambient: 'aurora', mount(root) { root.addEventListener('click', e => { const b = e.target.closest('[data-action="bio-more"]'); if (b) { const open = root.querySelector('#bio').classList.toggle('clamp-3'); b.textContent = open ? 'Read More' : 'Read Less'; } }); return mountScrollTop(); } };
}

// ------------------------------------------------------------------ search
const SEARCH_HEADINGS = ['What would you like to watch?', 'Discover something new', 'Find your next favorite'];
export async function searchPage(query = '') {
  const heading = SEARCH_HEADINGS[Math.floor(Math.random() * SEARCH_HEADINGS.length)];
  const html = `
    <div class="search-page">
      <div class="search-hero">
        <h1>${heading}</h1>
        <div class="search-box"><div class="search-field">${icon('search', 20)}<input id="q" type="text" value="${esc(query)}" placeholder="Search movies, TV shows & people..." autocomplete="off" spellcheck="false" aria-label="Search" />${query ? `<button class="clear" data-action="clear-search" aria-label="Clear">${icon('x', 18)}</button>` : ''}</div></div>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>${footer()}`;
  return {
    title: `${query ? esc(query) + ' - ' : ''}Search - Cinejoy`, html, back: true, ambient: 'aurora',
    async mount(root) {
      const input = root.querySelector('#q'); const out = root.querySelector('#search-results');
      let timer = null; let seq = 0;
      const render = async q => {
        const my = ++seq;
        if (!q.trim()) {
          out.innerHTML = `<div style="text-align:center"><h2 class="is-center">Trending Today</h2></div><div class="grid is-search">${skeletonCards(10)}</div>`;
          const tr = await getTrendingToday(); if (my !== seq) return;
          out.innerHTML = `<div style="text-align:center"><h2 class="is-center">Trending Today</h2></div><div class="grid is-search">${tr.slice(0, 20).map(it => card(it)).join('')}</div>`;
          return;
        }
        const r = await search(q); if (my !== seq) return;
        out.innerHTML = `
          ${r.people.length ? `<div><h2>People</h2><div class="people-row hide-scrollbar">${r.people.map(p => `<a class="person-chip" href="/person/${p.id}" aria-label="${esc(p.name)}"><div class="avatar">${p.photo ? `<img src="${img(p.photo, 'w185')}" alt="" loading="lazy" />` : `<div class="initials">${esc(initials(p.name))}</div>`}</div><span class="clamp-1">${esc(p.name)}</span></a>`).join('')}</div></div>` : ''}
          <div><h2>Movies & TV</h2>${r.media.length ? `<div class="grid is-search" style="margin-top:16px">${r.media.map(it => card(it)).join('')}</div>` : `<p class="search-empty">No results for “${esc(q)}”.</p>`}</div>`;
      };
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { const q = input.value; history.replaceState({}, '', q.trim() ? `/search/${encodeURIComponent(q.trim())}` : '/search'); document.title = `${q.trim() ? q.trim() + ' - ' : ''}Search - Cinejoy`; render(q); const sf = root.querySelector('.search-field'); const clr = sf.querySelector('.clear'); if (q && !clr) sf.insertAdjacentHTML('beforeend', `<button class="clear" data-action="clear-search" aria-label="Clear">${icon('x', 18)}</button>`); if (!q && clr) clr.remove(); }, 220); });
      root.addEventListener('click', e => { if (e.target.closest('[data-action="clear-search"]')) { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); } });
      if (!query) setTimeout(() => input.focus(), 50);
      await render(query);
      return () => clearTimeout(timer);
    },
  };
}

// ------------------------------------------------------------------ lists
export async function listsPage() {
  const lists = store.lists;
  const html = `
    <div class="page-top"><div class="container-narrow">
      <div class="page-head">
        <div class="h1-row">${icon('list', 30)}<h1 class="h1">My Lists</h1></div>
        <div style="display:flex;gap:8px">
          <button class="pill-btn is-lg" data-action="new-list" aria-label="New list">${icon('plus', 18)}<span class="hide-sm">New List</span></button>
          <button class="pill-btn is-lg is-icon" data-action="import-lists" aria-label="Import lists from file">${icon('upload', 18)}</button>
          ${lists.length ? `<button class="pill-btn is-lg is-icon" data-action="export-lists" aria-label="Export lists">${icon('download', 18)}</button>` : ''}
        </div>
      </div>
      <a class="discover-row glass-panel" href="/lists/discover"><span class="icon-circle">${icon('compass', 20)}</span><span><span class="t">Discover public lists</span><span class="s">See what other people are collecting</span></span>${icon('chevronRight', 18, 'class="chev"')}</a>
      ${lists.length ? `<div class="lists-stack">${lists.map(l => listCard(l)).join('')}</div>` : `<div class="glass-panel empty-panel"><span class="icon-circle">${icon('list', 24)}</span><h2>No lists yet</h2><p>Create a list to start organizing your movies and shows, or import a list file you exported earlier.</p></div>`}
      <input type="file" id="list-file" accept="application/json" hidden />
    </div></div>${footer()}`;
  return {
    title: 'My Lists - Cinejoy', html, back: true, ambient: 'aurora',
    mount(root) {
      root.addEventListener('click', e => {
        if (e.target.closest('[data-action="new-list"]')) newListModal();
        if (e.target.closest('[data-action="import-lists"]')) root.querySelector('#list-file').click();
        if (e.target.closest('[data-action="export-lists"]')) { const blob = new Blob([store.exportLists()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cinejoy-lists.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
      });
      root.querySelector('#list-file').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const n = store.importLists(JSON.parse(await f.text())); toast(`Imported ${n} list${n === 1 ? '' : 's'}`); document.dispatchEvent(new CustomEvent('app:rerender')); } catch { toast('That file could not be read', 'x'); } });
      return () => {};
    },
  };
}
function listCard(l, href) {
  const its = itemsOf(l.items).slice(0, 4);
  return `<a class="list-card glass-panel" href="${href || `/list/${l.slug}`}"><span class="stack">${its.length ? its.map(it => it.poster ? `<img src="${img(it.poster, 'w92')}" alt="" loading="lazy" />` : `<span class="ph"></span>`).join('') : '<span class="ph"></span>'}</span><span><span class="t">${esc(l.name)}</span><br/><span class="s">${l.items.length} title${l.items.length === 1 ? '' : 's'}${l.by ? ` · by ${esc(l.by)}` : ''}</span></span>${icon('chevronRight', 18, 'class="chev"')}</a>`;
}
function newListModal() {
  const root = modal(`<h2>New list</h2><p>Give your list a name. You can add titles from any poster or hero banner.</p><div class="field"><label for="ln">Name</label><input id="ln" type="text" placeholder="e.g. Rainy day comfort" /></div><div class="acts"><button class="pill-btn" data-action="close-modal">Cancel</button><button class="pill-btn is-primary" data-action="create">Create</button></div>`);
  const inp = root.querySelector('#ln'); setTimeout(() => inp.focus(), 30);
  const go = () => { const name = inp.value.trim(); if (!name) { inp.focus(); return; } store.createList(name); closeModal(); toast(`Created “${name}”`); document.dispatchEvent(new CustomEvent('app:rerender')); };
  root.addEventListener('click', e => { if (e.target.closest('[data-action="create"]')) go(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
export async function listsDiscoverPage() {
  const c = getCatalog();
  const pub = (c?.rows || []).filter(r => !r.kind && !r.viewAll && r.items?.length).map(r => ({ id: r.id, name: r.title, slug: 'c-' + r.id, items: r.items, by: 'Cinejoy editors' }));
  const html = `
    <div class="page-top"><div class="container-narrow">
      <div class="page-head"><div class="h1-row">${icon('compass', 30)}<h1 class="h1">Public Lists</h1></div></div>
      ${pub.length ? `<div class="lists-stack">${pub.map(l => listCard(l, `/list/${l.slug}`)).join('')}</div>` : `<div class="glass-panel empty-panel"><span class="icon-circle">${icon('compass', 24)}</span><h2>Nothing shared yet</h2><p>Public lists appear here once other people start collecting.</p></div>`}
    </div></div>${footer()}`;
  return { title: 'Discover Lists - Cinejoy', html, back: true, ambient: 'aurora', mount() { return () => {}; } };
}
export async function listPage(slug) {
  const c = getCatalog();
  let list = store.getList(slug); let curated = false;
  if (!list && slug.startsWith('c-')) { const r = (c?.rows || []).find(x => x.id === slug.slice(2)); if (r) { list = { id: r.id, name: r.title, slug, items: r.items, by: 'Cinejoy editors' }; curated = true; } }
  if (!list) return notFoundPage();
  const its = itemsOf(list.items);
  const html = `
    <div class="page-top page-pad">
      <div class="page-head" style="align-items:flex-start">
        <div><div class="h1-row">${icon('list', 30)}<h1 class="h1">${esc(list.name)}</h1></div><p style="color:var(--fg-50);font-size:14px;margin-top:8px">${its.length} title${its.length === 1 ? '' : 's'}${list.by ? ` · curated by ${esc(list.by)}` : ''}</p></div>
        ${curated ? `<button class="pill-btn is-lg" data-action="clone-list">${icon('plus', 18)}<span>Save a copy</span></button>` : `<div style="display:flex;gap:8px"><button class="pill-btn is-lg" data-action="rename-list">Rename</button><button class="pill-btn is-lg is-icon" data-action="delete-list" aria-label="Delete list">${icon('trash', 18)}</button></div>`}
      </div>
      ${its.length ? `<div class="grid" style="margin-top:24px">${its.map(it => card(it)).join('')}</div>` : `<div class="glass-panel empty-panel"><span class="icon-circle">${icon('bookmark', 24)}</span><h2>This list is empty</h2><p>Use the + button on any title to add it here.</p></div>`}
    </div>${scrollTopButton()}${footer()}`;
  return {
    title: `${list.name} - Cinejoy`, html, back: true, ambient: 'aurora',
    mount(root) {
      const c2 = mountScrollTop();
      root.addEventListener('click', e => {
        if (e.target.closest('[data-action="clone-list"]')) { const l = store.createList(list.name); list.items.forEach(k => store.toggleInList(l.id, k)); toast('Saved to your lists'); navigate(`/list/${l.slug}`); }
        if (e.target.closest('[data-action="delete-list"]')) { if (confirm(`Delete “${list.name}”?`)) { store.deleteList(list.id); toast('List deleted'); navigate('/lists'); } }
        if (e.target.closest('[data-action="rename-list"]')) { const n = prompt('List name', list.name); if (n && n.trim()) { store.renameList(list.id, n.trim()); document.dispatchEvent(new CustomEvent('app:rerender')); } }
      });
      return c2;
    },
  };
}

// ------------------------------------------------------------------ history
export async function historyPage() {
  const h = store.history.map(e => ({ ...e, item: getCatalog()?.items?.[e.key] })).filter(e => e.item);
  const html = `
    <div class="page-top page-pad">
      <div class="page-head"><div class="h1-row">${icon('history', 30)}<h1 class="h1">Watch History</h1></div>${h.length ? `<button class="pill-btn is-lg" data-action="clear-history">Clear all</button>` : ''}</div>
      ${h.length ? `<div class="grid" style="margin-top:24px">${h.map(e => card(e.item)).join('')}</div>` : `<div class="empty-state"><p>No watch history found.</p><a href="/">Start watching something!</a></div>`}
    </div>${footer()}`;
  return { title: 'Watch History - Cinejoy', html, back: true, ambient: 'aurora', mount(root) { root.addEventListener('click', e => { if (e.target.closest('[data-action="clear-history"]')) { store.clearHistory(); document.dispatchEvent(new CustomEvent('app:rerender')); } }); return () => {}; } };
}

// ------------------------------------------------------------------ settings
const SETTINGS_TABS = [['account', 'Account', 'user'], ['appearance', 'Appearance', 'palette'], ['playback', 'Playback', 'play'], ['servers', 'Servers', 'server'], ['subtitles', 'Subtitles', 'subtitles'], ['ads', 'Ads', 'megaphone']];
export async function settingsPage(section = '') {
  const s = store.settings;
  const tog = (k, label, desc) => `<div class="setting-row"><div><div class="lbl">${label}</div><div class="desc">${desc}</div></div><div class="ctl"><button class="toggle${s[k] ? ' is-on' : ''}" role="switch" aria-checked="${!!s[k]}" aria-label="${label}" data-action="toggle-setting" data-key="${k}"></button></div></div>`;
  const seg = (k, label, desc, opts) => `<div class="setting-row"><div><div class="lbl">${label}</div><div class="desc">${desc}</div></div><div class="ctl"><div class="segment is-small">${opts.map(([v, l]) => `<button data-action="set-setting" data-key="${k}" data-value="${v}" class="${s[k] === v ? 'is-active' : ''}">${l}</button>`).join('')}</div></div></div>`;
  const themes = [['default', 'Default', '#ffffff'], ['lime', 'Lime', '#95ff50'], ['ocean', 'Ocean', '#5ac8ff'], ['rose', 'Rose', '#ff6b9d'], ['amber', 'Amber', '#ffb547']];
  const html = `
    <div class="page-top"><div class="container-narrow">
      <div class="page-head"><div class="h1-row">${icon('gear', 30)}<h1 class="h1">Settings</h1></div></div>
      <div class="settings-tabs hide-scrollbar">${SETTINGS_TABS.map(([id, l, ic]) => `<a class="settings-tab${(section || 'account') === id ? ' is-active' : ''}" href="/settings#${id}" data-tab="${id}">${icon(ic, 16)}${l}</a>`).join('')}</div>

      <section class="glass-panel settings-section" id="account"><h2 class="sec-title">Account</h2><p class="sec-desc">Sign in to sync your settings and watch progress across devices.</p>
        <div class="setting-row"><div><div class="lbl">${s.displayName ? `Signed in as ${esc(s.displayName)}` : 'Not signed in'}</div><div class="desc">${s.displayName ? 'Your preferences are stored on this device.' : 'Create an account or sign in to sync your data'}</div></div><div class="ctl"><button class="pill-btn is-primary" data-action="login">${s.displayName ? 'Manage' : 'Sign In'}</button></div></div>
        <button class="connect-row" data-action="connect" data-name="Trakt"><span class="icon-circle">${icon('check', 18)}</span><span><div class="t">Connect Trakt</div><div class="s">Sync your watchlist, history and progress from Trakt</div></span></button>
        <button class="connect-row" data-action="connect" data-name="Simkl"><span class="icon-circle">${icon('layers', 18)}</span><span><div class="t">Connect Simkl</div><div class="s">Sync your watchlist, history and progress from Simkl</div></span></button>
      </section>

      <section class="glass-panel settings-section" id="appearance"><h2 class="sec-title">Appearance</h2><p class="sec-desc">Change the look of the site to suit your needs.</p>
        <div class="setting-row"><div><div class="lbl">Theme</div><div class="desc">Pick a color palette for the entire interface.</div></div><div class="ctl">${dropdown({ id: 'theme', label: 'Theme', value: s.theme, options: themes.map(([v, l]) => ({ value: v, label: l })), align: 'right', dot: true })}</div></div>
        ${seg('episodeView', 'Episode View Style', 'Choose how episodes appear on series pages.', [['carousel', 'Carousel'], ['grid', 'Grid']])}
        ${seg('detailView', 'Detail View Type', 'Pick between a full page or a compact modal.', [['page', 'Page'], ['modal', 'Modal']])}
        ${tog('imageLogos', 'Use Image Logos', 'Display movie and series titles as image logos.')}
        ${tog('trailers', 'Trailers', 'Show trailers on detail pages.')}
        ${tog('spoilerFree', 'Spoiler-Free Mode', 'Hide information about episodes.')}
        ${tog('reduceMotion', 'Reduce Motion', 'Reduce effects.')}
        ${tog('flatUi', 'Flat UI', 'Replace frosted glass with solid surfaces.')}
      </section>

      <section class="glass-panel settings-section" id="playback"><h2 class="sec-title">Playback</h2><p class="sec-desc">Configure how your player behaves.</p>
        ${tog('autoplay', 'Autoplay', 'Automatically play the next episode when one ends.')}
        ${tog('autoSkipIntro', 'Auto Skip Intro', 'Jump past the intro on its own, instead of showing the Skip Intro button.')}
        <div class="setting-row"><div><div class="lbl">Player Controls</div><div class="desc">Rearrange the player's buttons, or take the ones you don't use off it.</div></div><div class="ctl"><a class="pill-btn" href="/settings/player">Customize</a></div></div>
        <div class="setting-row"><div><div class="lbl">Seek Time</div><div class="desc">Change how far you skip forwards or backwards.</div></div><div class="ctl">${dropdown({ id: 'seekTime', label: 'Seek', value: s.seekTime, options: [5, 10, 15, 30, 60].map(v => ({ value: v, label: `${v} seconds` })), align: 'right' })}</div></div>
        ${tog('autoSubtitles', 'Auto Subtitles', 'Automatically select subtitles in your preferred language when available.')}
      </section>

      <section class="glass-panel settings-section" id="servers"><h2 class="sec-title">Server Order</h2><p class="sec-desc">Set which sources would be tried first when a title loads. This recreation ships without any playback sources, so the order is cosmetic.</p>
        <div class="order-list" id="order-list">${s.serverOrder.map((n, i) => `<div class="order-item"><span class="grip">${icon('grip', 16)}</span><span class="num">${i + 1}</span><span>${esc(n)}</span><span class="moves"><button data-action="order-move" data-i="${i}" data-d="-1" aria-label="Move up">${icon('chevronUp', 16)}</button><button data-action="order-move" data-i="${i}" data-d="1" aria-label="Move down">${icon('chevronDown', 16)}</button></span></div>`).join('')}</div>
      </section>

      <section class="glass-panel settings-section" id="subtitles"><h2 class="sec-title">Subtitles</h2><p class="sec-desc">Improve readability and customization for subtitles.</p>
        ${seg('subtitleFont', 'Font', 'Choose your preferred subtitle font.', [['Cinejoy', 'Cinejoy'], ['Classic', 'Classic'], ['Montserrat', 'Montserrat']])}
        <div class="setting-row"><div><div class="lbl">Text Size</div><div class="desc">Adjust subtitle size for your display.</div></div><div class="ctl"><span class="tabular" id="sub-size" style="font-size:14px;color:var(--fg-70);min-width:44px;text-align:right">${s.subtitleSize}%</span><input type="range" min="50" max="200" step="10" value="${s.subtitleSize}" data-action="range-setting" data-key="subtitleSize" aria-label="Text size" /></div></div>
        <div class="setting-row"><div><div class="lbl">Text Color</div><div class="desc">Pick a high-contrast subtitle color.</div></div><div class="ctl"><div class="color-dots">${['#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#95ff50'].map(c => `<button class="color-dot${s.subtitleColor === c ? ' is-active' : ''}" style="background:${c}" data-action="set-setting" data-key="subtitleColor" data-value="${c}" aria-label="${c}"></button>`).join('')}</div></div></div>
        ${tog('subtitleBlur', 'Background Blur', 'Blur the area behind subtitles for readability.')}
        <div class="setting-row"><div><div class="lbl">Preview</div><div class="desc">How subtitles would appear in the player.</div></div><div class="ctl"><span id="sub-preview" style="padding:6px 12px;border-radius:8px;font-weight:600;font-size:${16 * s.subtitleSize / 100}px;color:${s.subtitleColor};${s.subtitleBlur ? 'background:rgba(0,0,0,.5);backdrop-filter:blur(6px)' : 'text-shadow:0 2px 4px #000'};font-family:${s.subtitleFont === 'Montserrat' ? 'Montserrat,Inter' : s.subtitleFont === 'Classic' ? 'Arial,Helvetica' : 'Inter'}">Sample subtitle</span></div></div>
      </section>

      <section class="glass-panel settings-section" id="ads"><h2 class="sec-title">Ads</h2><p class="sec-desc">This recreation never loads advertising or tracking scripts. The switch is kept for interface parity.</p>
        ${tog('ads', 'Show Ads', 'Allow sponsored placements in the interface.')}
      </section>

      <div style="display:flex;justify-content:flex-end;margin-bottom:24px"><button class="pill-btn" data-action="reset-settings">${icon('refresh', 16)}<span>Reset to defaults</span></button></div>
    </div></div>${footer()}`;
  return {
    title: 'Settings - Cinejoy', html, back: true, ambient: 'aurora',
    mount(root) {
      const rerender = () => document.dispatchEvent(new CustomEvent('app:rerender'));
      root.addEventListener('click', e => {
        const t = e.target.closest('[data-action="toggle-setting"]'); if (t) { store.setSetting(t.dataset.key, !store.settings[t.dataset.key]); const on = store.settings[t.dataset.key]; t.classList.toggle('is-on', on); t.setAttribute('aria-checked', on); if (t.dataset.key === 'subtitleBlur') rerender(); return; }
        const ss = e.target.closest('[data-action="set-setting"]'); if (ss) { const v = ss.dataset.value; store.setSetting(ss.dataset.key, isNaN(Number(v)) || v === '' ? v : (ss.dataset.key === 'subtitleColor' ? v : Number(v))); rerender(); return; }
        const om = e.target.closest('[data-action="order-move"]'); if (om) { const i = Number(om.dataset.i), d = Number(om.dataset.d), arr = [...store.settings.serverOrder]; const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; store.setSetting('serverOrder', arr); rerender(); return; }
        if (e.target.closest('[data-action="reset-settings"]')) { store.resetSettings(); toast('Settings reset'); rerender(); return; }
        const cn = e.target.closest('[data-action="connect"]'); if (cn) toast(`${cn.dataset.name} sync is not available in this recreation`, 'info');
        const tab = e.target.closest('.settings-tab'); if (tab) { e.preventDefault(); root.querySelectorAll('.settings-tab').forEach(x => x.classList.toggle('is-active', x === tab)); root.querySelector('#' + tab.dataset.tab)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState({}, '', '/settings#' + tab.dataset.tab); }
      });
      root.addEventListener('input', e => { const r = e.target.closest('[data-action="range-setting"]'); if (r) { store.setSetting(r.dataset.key, Number(r.value)); root.querySelector('#sub-size').textContent = r.value + '%'; root.querySelector('#sub-preview').style.fontSize = (16 * r.value / 100) + 'px'; } });
      const off = onDD(root, (id, value) => { if (id === 'theme') { store.setSetting('theme', value); rerender(); } if (id === 'seekTime') { store.setSetting('seekTime', Number(value)); rerender(); } });
      if (section) setTimeout(() => root.querySelector('#' + section)?.scrollIntoView({ block: 'start' }), 50);
      return off;
    },
  };
}
export async function playerSettingsPage() {
  const html = `<div class="page-top"><div class="container-narrow"><div class="page-head"><div class="h1-row">${icon('settingsSliders', 30)}<h1 class="h1">Player Controls</h1></div></div>
    <section class="glass-panel settings-section"><h2 class="sec-title">Control layout</h2><p class="sec-desc">Toggle which controls appear on the player bar.</p>
      ${['Play / Pause', 'Seek backward', 'Seek forward', 'Volume', 'Subtitles', 'Playback speed', 'Picture in picture', 'Fullscreen'].map((n, i) => `<div class="setting-row"><div><div class="lbl">${n}</div></div><div class="ctl"><button class="toggle is-on" role="switch" aria-checked="true" data-action="demo-toggle"></button></div></div>`).join('')}
    </section></div></div>${footer()}`;
  return { title: 'Player Controls - Cinejoy', html, back: true, ambient: 'aurora', mount(root) { root.addEventListener('click', e => { const t = e.target.closest('[data-action="demo-toggle"]'); if (t) { const on = !t.classList.contains('is-on'); t.classList.toggle('is-on', on); t.setAttribute('aria-checked', on); } }); return () => {}; } };
}

// ------------------------------------------------------------------ shorts
export async function shortsPage() {
  const tr = await getTrendingToday();
  const feed = [];
  for (const it of tr.slice(0, 12)) { try { const d = await getDetails(it.type, it.id); const t = d.trailers?.[0]; if (t) feed.push({ it: d, yt: t.youtubeKey }); } catch { /* skip */ } if (feed.length >= 8) break; }
  let i = 0; let muted = true;
  const slide = () => { const f = feed[i]; if (!f) return `<div class="shorts-card"><div class="glow"></div><div class="watch-msg" style="height:100%;justify-content:center"><h2>No trailers available</h2><p>Trailers appear here when the snapshot or live data includes them.</p></div></div>`; const it = f.it; const r = fmtRating(it.rating); return `
    <div class="shorts-card"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(f.yt)}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&rel=0&playsinline=1&loop=1&playlist=${encodeURIComponent(f.yt)}" title="${esc(it.title)} trailer" allow="autoplay; encrypted-media" allowfullscreen></iframe><div class="glow"></div>
      <div class="meta"><h2>${esc(it.title)}</h2><div class="sub">${it.year ? `<span>${it.year}</span>` : ''}${r ? `<span>${icon('star', 14)} ${r}</span>` : ''}</div>${it.overview ? `<p class="clamp-2">${esc(it.overview)}</p>` : ''}</div></div>
    <div class="shorts-side"><a href="${hrefFor(it)}">${it.poster ? `<img src="${img(it.poster, 'w92')}" alt="" />` : ''}</a>
      <a class="act" href="${watchHref(it)}"><span class="b">${icon('play', 20)}</span>Watch</a>
      <button class="act" data-action="add-list" data-key="${esc(it.key)}" data-title="${esc(it.title)}"><span class="b">${icon('plus', 20)}</span>List</button>
      <button class="act" data-action="shorts-audio"><span class="b">${icon('volume', 20)}</span>Audio</button></div>`; };
  const html = `<div class="shorts-page" id="shorts"><button class="shorts-back" data-action="back" aria-label="Go back">${icon('arrowLeft', 20)}</button><div class="shorts-nav"><button data-action="shorts-prev" aria-label="Previous">${icon('chevronUp', 20)}</button><button data-action="shorts-next" aria-label="Next">${icon('chevronDown', 20)}</button></div><div id="shorts-stage" style="display:contents">${slide()}</div></div>`;
  return {
    title: 'Shorts - Cinejoy', html, back: true, bare: true,
    mount(root) {
      const re = () => { root.querySelector('#shorts-stage').innerHTML = slide(); };
      root.addEventListener('click', e => { if (e.target.closest('[data-action="shorts-next"]')) { i = (i + 1) % Math.max(1, feed.length); re(); } if (e.target.closest('[data-action="shorts-prev"]')) { i = (i - 1 + feed.length) % Math.max(1, feed.length); re(); } if (e.target.closest('[data-action="shorts-audio"]')) { muted = !muted; re(); toast(muted ? 'Muted' : 'Sound on', 'volume'); } });
      const key = e => { if (e.key === 'ArrowDown') { i = (i + 1) % Math.max(1, feed.length); re(); } if (e.key === 'ArrowUp') { i = (i - 1 + feed.length) % Math.max(1, feed.length); re(); } };
      document.addEventListener('keydown', key); let y0 = null; root.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > 30) { i = (i + (e.deltaY > 0 ? 1 : -1) + feed.length) % Math.max(1, feed.length); re(); } }, { passive: true });
      root.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true }); root.addEventListener('touchend', e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; if (Math.abs(dy) > 60) { i = (i + (dy < 0 ? 1 : -1) + feed.length) % Math.max(1, feed.length); re(); } y0 = null; });
      return () => document.removeEventListener('keydown', key);
    },
  };
}

// ------------------------------------------------------------------ watch
export async function watchPage(type, id, season, episode) {
  type = typeFromRoute(type);
  const d = await getDetails(type, Number(id));
  let ep = null; if (type === 'tv') { try { ep = (await getSeason(d.id, Number(season))).find(e => e.num === Number(episode)) || null; } catch { ep = null; } }
  const sub = type === 'tv' ? `S${season} · E${episode}${ep?.title ? ` · ${ep.title}` : ''}` : (d.year || '');
  const trailer = d.trailers?.[0];
  const html = `
    <div class="watch-page" id="watch">
      <div class="watch-top"><button class="back-btn" data-action="back" aria-label="Go back">${icon('arrowLeft', 26)}</button><div><div class="t">${esc(d.title)}</div><div class="s">${esc(sub)}</div></div></div>
      <div class="watch-stage" id="stage">
        ${d.backdrop || ep?.still ? `<img class="bg" src="${img(ep?.still || d.backdrop, 'w1280')}" alt="" />` : ''}
        <div class="watch-msg"><span class="big">${icon('film', 30)}</span><h2>No playback source configured</h2><p>This interface recreation does not include any streaming servers or media files. ${trailer ? 'You can watch the official trailer instead.' : ''}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${trailer ? `<button class="pill-btn is-primary is-lg" data-action="watch-trailer" data-yt="${esc(trailer.youtubeKey)}">${icon('play', 18)}<span>Play trailer</span></button>` : ''}<a class="pill-btn is-lg" href="${hrefFor(d)}">${icon('info', 18)}<span>Title details</span></a></div></div>
      </div>
      <div class="watch-controls"><div class="bar"><span id="bar"></span></div><div class="btns"><button aria-label="Play">${icon('play', 20)}</button><button aria-label="Seek back">${icon('chevronLeft', 20)}</button><button aria-label="Seek forward">${icon('chevronRight', 20)}</button><button aria-label="Volume">${icon('volume', 20)}</button><span class="time">0:00 / ${esc(d.runtimeLabel || ep?.runtimeLabel || '--:--')}</span><span class="spacer"></span><button aria-label="Subtitles">${icon('subtitles', 20)}</button><button aria-label="Settings">${icon('gear', 20)}</button><button aria-label="Fullscreen">${icon('maximize', 20)}</button></div></div>
    </div>`;
  return {
    title: `${d.title} - Cinejoy`, html, back: true, bare: true,
    mount(root) {
      store.pushHistory({ key: d.key, season: type === 'tv' ? Number(season) : null, episode: type === 'tv' ? Number(episode) : null, title: d.title });
      root.addEventListener('click', e => { const b = e.target.closest('[data-action="watch-trailer"]'); if (b) { root.querySelector('#stage').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.dataset.yt)}?autoplay=1&rel=0" title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`; root.querySelector('.watch-controls').style.display = 'none'; } });
      return () => {};
    },
  };
}

// ------------------------------------------------------------------ 404
export async function notFoundPage() {
  return { title: 'Not found - Cinejoy', html: `<div class="empty-state" style="min-height:70vh"><h1 class="h1">404</h1><p>We couldn't find that page.</p><a href="/">Back to home</a></div>${footer()}`, back: true, ambient: 'aurora', mount() { return () => {}; } };
}
