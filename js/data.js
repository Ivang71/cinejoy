// Data layer. Runs from the bundled snapshot (/data) or, when a TMDB key is
// configured, from the live TMDB API. Both paths produce the same shapes.
import { slugify } from './store.js';

const cfg = () => window.CINEJOY_CONFIG || {};
export const live = () => !!cfg().tmdbApiKey;

export function img(path, size = 'w500') {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  return (cfg().imageBase || 'https://image.tmdb.org/t/p/') + size + path;
}
export const keyOf = (type, id) => `${type}:${id}`;
export const splitKey = key => { const [type, id] = String(key).split(':'); return { type, id: Number(id) }; };
export const idFromSlug = slug => Number(String(slug).match(/^\d+/)?.[0] || 0);
export const slugFor = it => `${it.id}-${slugify(it.title)}${it.year ? '-' + it.year : ''}`;
export const hrefFor = it => `/${it.type === 'tv' ? 'series' : 'movie'}/${slugFor(it)}`;
export const watchHref = (it, s, e) => it.type === 'tv' ? `/watch/tv/${it.id}/${s || 1}/${e || 1}` : `/watch/movie/${it.id}`;
export const typeFromRoute = seg => (seg === 'series' || seg === 'tv') ? 'tv' : 'movie';

export const GENRES = {
  movie: { 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western' },
  tv: { 10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western' },
};
export const SORTS = [
  { id: 'popularity.desc', label: 'Popular' }, { id: 'vote_average.desc', label: 'Top Rated' }, { id: 'primary_release_date.desc', label: 'Newest' }, { id: 'primary_release_date.asc', label: 'Oldest' }, { id: 'revenue.desc', label: 'Box Office' }, { id: 'title.asc', label: 'A–Z' },
];
export const COUNTRIES = [['US', 'United States'], ['GB', 'United Kingdom'], ['KR', 'South Korea'], ['JP', 'Japan'], ['IN', 'India'], ['FR', 'France'], ['DE', 'Germany'], ['ES', 'Spain'], ['IT', 'Italy'], ['CA', 'Canada'], ['AU', 'Australia'], ['BR', 'Brazil'], ['MX', 'Mexico'], ['CN', 'China'], ['HK', 'Hong Kong'], ['TR', 'Turkey'], ['PK', 'Pakistan'], ['NG', 'Nigeria'], ['SE', 'Sweden'], ['DK', 'Denmark'], ['NO', 'Norway'], ['NL', 'Netherlands'], ['IE', 'Ireland'], ['NZ', 'New Zealand'], ['AR', 'Argentina'], ['TH', 'Thailand'], ['PL', 'Poland'], ['RU', 'Russia']];

let catalog = null;
const detailCache = new Map();
const jsonCache = new Map();

async function fetchJSON(url) {
  if (jsonCache.has(url)) return jsonCache.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); });
  jsonCache.set(url, p);
  p.catch(() => jsonCache.delete(url));
  return p;
}

export async function loadCatalog() {
  if (catalog) return catalog;
  try { catalog = await fetchJSON('/data/catalog.json'); }
  catch (e) { console.warn('Catalog missing', e); catalog = { items: {}, hero: { home: [], movies: [], series: [] }, providers: [], rows: [], providerCatalog: {}, categories: {}, discovery: {}, people: {} }; }
  for (const [k, it] of Object.entries(catalog.items)) { it.key = k; it.slug = it.slug || slugFor(it); }
  return catalog;
}
export const getCatalog = () => catalog;
export const getItem = key => catalog?.items?.[key] || null;
export const items = keys => (keys || []).map(getItem).filter(Boolean);
export function allItems(type) { return Object.values(catalog?.items || {}).filter(i => !type || i.type === type); }
export function itemFromSlug(type, slug) {
  const id = idFromSlug(slug);
  return getItem(keyOf(type, id)) || (id ? { key: keyOf(type, id), type, id, title: slug.replace(/^\d+-/, '').replace(/-\d{4}$/, '').replace(/-/g, ' ') } : null);
}
export function mergeItem(it) { if (!catalog) return it; const k = it.key || keyOf(it.type, it.id); const cur = catalog.items[k]; catalog.items[k] = Object.assign(cur || {}, it, { key: k }); catalog.items[k].slug = catalog.items[k].slug || slugFor(catalog.items[k]); return catalog.items[k]; }

// ---------------------------------------------------------------- TMDB live
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('api_key', cfg().tmdbApiKey); u.searchParams.set('language', 'en-US'); u.searchParams.set('include_adult', 'false');
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  return fetchJSON(u.toString());
}
export function mapTmdb(r, forceType) {
  const type = forceType || (r.media_type === 'tv' || r.first_air_date != null || r.name != null && r.title == null ? 'tv' : 'movie');
  const date = r.release_date || r.first_air_date || '';
  const it = { type, id: r.id, title: r.title || r.name || '', poster: r.poster_path || null, backdrop: r.backdrop_path || null, year: date ? Number(date.slice(0, 4)) : null, rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null, overview: r.overview || '', genreIds: r.genre_ids || (r.genres || []).map(g => g.id), date };
  it.key = keyOf(type, r.id); it.slug = slugFor(it);
  return mergeItem(it);
}
const fmtRuntime = m => m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m}m`) : null;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
const fmtDateLong = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
function pickLogo(images) { const logos = images?.logos || []; const en = logos.filter(l => l.iso_639_1 === 'en' || !l.iso_639_1); const pool = en.length ? en : logos; return pool.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0]?.file_path || null; }

async function liveDetails(type, id) {
  if (type === 'movie') {
    const d = await tmdb(`/movie/${id}`, { append_to_response: 'credits,videos,images,release_dates', include_image_language: 'en,null' });
    const base = mapTmdb(d, 'movie');
    const us = (d.release_dates?.results || []).find(r => r.iso_3166_1 === 'US');
    const cert = us?.release_dates?.map(x => x.certification).find(Boolean) || null;
    const director = (d.credits?.crew || []).filter(c => c.job === 'Director').map(c => ({ name: c.name, id: c.id }));
    return Object.assign(base, {
      logo: pickLogo(d.images), genres: (d.genres || []).map(g => g.name), runtime: d.runtime || null, runtimeLabel: fmtRuntime(d.runtime), cert, tagline: d.tagline,
      credit: { label: 'Director', people: director },
      info: [{ k: 'Runtime', v: fmtRuntime(d.runtime), ends: true }, { k: 'Language', v: (d.original_language || '').toUpperCase() }, { k: 'Release Date', v: fmtDate(d.release_date) }].filter(r => r.v),
      networks: (d.production_companies || []).filter(c => c.logo_path).slice(0, 2).map(c => ({ name: c.name, logo: c.logo_path })),
      cast: (d.credits?.cast || []).slice(0, 20).map(c => ({ name: c.name, character: c.character, photo: c.profile_path, id: c.id })),
      trailers: (d.videos?.results || []).filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser', 'Clip'].includes(v.type)).slice(0, 8).map(v => ({ title: v.name, type: v.type, youtubeKey: v.key })),
    });
  }
  const d = await tmdb(`/tv/${id}`, { append_to_response: 'credits,videos,images,content_ratings', include_image_language: 'en,null' });
  const base = mapTmdb(d, 'tv');
  const us = (d.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US');
  const seasons = (d.seasons || []).filter(s => s.season_number > 0).map(s => ({ number: s.season_number, name: s.name, episodes: s.episode_count, poster: s.poster_path }));
  return Object.assign(base, {
    logo: pickLogo(d.images), genres: (d.genres || []).map(g => g.name), cert: us?.rating || null, tagline: d.tagline,
    yearRange: `${base.year || ''}${d.in_production ? '–' : (d.last_air_date && d.last_air_date.slice(0, 4) !== String(base.year) ? '–' + d.last_air_date.slice(0, 4) : '')}`,
    credit: { label: 'Creator', people: (d.created_by || []).map(c => ({ name: c.name, id: c.id })) },
    info: [{ k: 'Status', v: d.status }, { k: 'Language', v: (d.original_language || '').toUpperCase() }, { k: 'First Aired', v: fmtDateLong(d.first_air_date) }, { k: 'Last Aired', v: fmtDateLong(d.last_air_date) }, { k: 'Seasons', v: String(seasons.length) }, { k: 'Episodes', v: String(d.number_of_episodes || '') }].filter(r => r.v),
    networks: (d.networks || []).filter(n => n.logo_path).slice(0, 2).map(n => ({ name: n.name, logo: n.logo_path })),
    cast: (d.credits?.cast || []).slice(0, 20).map(c => ({ name: c.name, character: c.character, photo: c.profile_path, id: c.id })),
    trailers: (d.videos?.results || []).filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser', 'Clip'].includes(v.type)).slice(0, 8).map(v => ({ title: v.name, type: v.type, youtubeKey: v.key })),
    seasons, episodes: null,
  });
}

export async function getDetails(type, id) {
  const key = keyOf(type, id);
  if (detailCache.has(key)) return detailCache.get(key);
  const p = (async () => {
    let d = null;
    if (live()) { try { d = await liveDetails(type, id); } catch (e) { console.warn(e); } }
    if (!d) { try { d = await fetchJSON(`/data/details/${type}-${id}.json`); } catch { d = null; } }
    const base = getItem(key) || { key, type, id };
    const merged = Object.assign({}, base, d || {}, { key, type, id: Number(id) });
    if (!merged.title) merged.title = base.title || '';
    mergeItem(merged);
    return merged;
  })();
  detailCache.set(key, p); return p;
}

export async function getSeason(tvId, season) {
  if (live()) {
    try { const s = await tmdb(`/tv/${tvId}/season/${season}`); return (s.episodes || []).map(e => ({ num: e.episode_number, season: e.season_number, title: e.name, overview: e.overview, still: e.still_path, runtime: e.runtime, runtimeLabel: fmtRuntime(e.runtime), rating: e.vote_average ? Math.round(e.vote_average * 10) / 10 : null, air: e.air_date })); } catch { /* fall through */ }
  }
  const d = await getDetails('tv', tvId);
  if (d.episodes && (d.seasonNumber == null || Number(d.seasonNumber) === Number(season))) return d.episodes;
  return (d.episodesBySeason || {})[season] || [];
}

// ---------------------------------------------------------------- Home
export async function getHome() {
  const c = await loadCatalog();
  if (live()) {
    const [tm, tt, trm, trt] = await Promise.all([tmdb('/trending/movie/day'), tmdb('/trending/tv/day'), tmdb('/movie/top_rated'), tmdb('/tv/top_rated')]);
    const trendingMovies = tm.results.map(r => mapTmdb(r, 'movie')); const trendingTv = tt.results.map(r => mapTmdb(r, 'tv'));
    const slides = await Promise.all(trendingMovies.slice(0, 7).map(async it => { const d = await getDetails('movie', it.id); return slideFrom(d); }));
    const rows = [
      { id: 'trending-movies', title: 'Trending Movies', viewAll: '/category/movie/trending', items: trendingMovies.map(i => i.key) },
      { id: 'trending-series', title: 'Trending Series', viewAll: '/category/tv/trending', items: trendingTv.map(i => i.key) },
      { id: 'provider-movies', title: 'Movies on', kind: 'provider-movies', items: [] },
      { id: 'provider-series', title: 'TV Series on', kind: 'provider-series', items: [] },
      { id: 'top-movies', title: 'Top Rated Movies', viewAll: '/category/movie/top_rated', items: trm.results.map(r => mapTmdb(r, 'movie').key) },
      { id: 'top-series', title: 'Top Rated Series', viewAll: '/category/tv/top_rated', items: trt.results.map(r => mapTmdb(r, 'tv').key) },
      ...(c.rows || []).filter(r => !r.kind && !/trending|top rated/i.test(r.title)),
    ];
    return { slides, providers: c.providers, rows };
  }
  const slides = (c.hero?.home || []).map(k => slideFrom(getItem(k))).filter(Boolean);
  return { slides, providers: c.providers || [], rows: c.rows || [] };
}
export function slideFrom(it) {
  if (!it) return null;
  return { key: it.key, item: it, title: it.title, logo: it.logo || null, backdrop: it.backdrop || null, rating: it.rating, year: it.year, genre: it.genre || it.genres?.[0] || (it.genreIds || []).map(g => GENRES[it.type]?.[g]).find(Boolean) || null, overview: it.overview || '' };
}

export async function getProviderRow(providerId, type) {
  const c = await loadCatalog();
  if (live()) {
    const r = await tmdb(`/discover/${type}`, { with_watch_providers: providerId, watch_region: 'US', sort_by: 'popularity.desc' });
    return r.results.map(x => mapTmdb(x, type));
  }
  const pc = c.providerCatalog?.[providerId];
  return items(type === 'tv' ? pc?.series : pc?.movies);
}

// ---------------------------------------------------------------- Discovery
export async function getDiscovery(kind) {
  const c = await loadCatalog();
  const type = kind === 'series' ? 'tv' : 'movie';
  const d = c.discovery?.[kind] || {};
  const slides = (c.hero?.[kind]?.length ? c.hero[kind] : c.hero?.home || []).map(k => slideFrom(getItem(k))).filter(Boolean);
  if (live()) {
    const [up, tr] = await Promise.all([type === 'movie' ? tmdb('/movie/upcoming') : tmdb('/tv/on_the_air'), tmdb(`/trending/${type}/day`)]);
    const upcoming = up.results.slice(0, 20).map(r => { const it = mapTmdb(r, type); return { key: it.key, title: it.title, backdrop: it.backdrop, date: it.date, badge: type === 'movie' ? 'Coming Soon' : 'Airing' }; });
    const liveSlides = await Promise.all(tr.results.slice(0, 7).map(async it => slideFrom(await getDetails(type, it.id))));
    return { type, slides: liveSlides, upcoming, upcomingTitle: type === 'movie' ? 'Upcoming' : 'New Seasons Airing', rows: [] };
  }
  return { type, slides, upcoming: d.upcoming || [], upcomingTitle: d.upcomingTitle || (type === 'movie' ? 'Upcoming' : 'New Seasons Airing'), rows: d.rows || [] };
}

export async function discover(kind, f = {}, page = 1) {
  const type = kind === 'series' ? 'tv' : 'movie';
  if (live()) {
    const params = { sort_by: f.sort || 'popularity.desc', page, 'vote_count.gte': f.sort === 'vote_average.desc' ? 300 : 0 };
    if (f.genre) params.with_genres = f.genre;
    if (f.year) { if (type === 'movie') params.primary_release_year = f.year; else params.first_air_date_year = f.year; }
    if (f.provider) { params.with_watch_providers = f.provider; params.watch_region = 'US'; }
    if (f.country) params.with_origin_country = f.country;
    if (type === 'tv' && params.sort_by.startsWith('primary_release_date')) params.sort_by = params.sort_by.replace('primary_release_date', 'first_air_date');
    if (type === 'tv' && params.sort_by === 'title.asc') params.sort_by = 'name.asc';
    const r = await tmdb(`/discover/${type}`, params);
    return { items: r.results.map(x => mapTmdb(x, type)), total: r.total_results, pages: r.total_pages, page };
  }
  const c = await loadCatalog();
  let pool = allItems(type);
  const gridKeys = c.discovery?.[kind]?.grid || [];
  const order = new Map(gridKeys.map((k, i) => [k, i]));
  if (f.genre) { const name = GENRES[type][f.genre]; pool = pool.filter(i => (i.genres || [i.genre]).filter(Boolean).includes(name) || (i.genreIds || []).includes(Number(f.genre))); }
  if (f.year) pool = pool.filter(i => String(i.year) === String(f.year));
  if (f.provider) { const pc = c.providerCatalog?.[f.provider]; const set = new Set([...(pc?.movies || []), ...(pc?.series || [])]); pool = pool.filter(i => set.has(i.key)); }
  if (f.country) pool = pool.filter(i => i.country === f.country);
  const sort = f.sort || 'popularity.desc';
  pool.sort((a, b) => {
    if (sort === 'vote_average.desc') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'primary_release_date.desc') return (b.year || 0) - (a.year || 0);
    if (sort === 'primary_release_date.asc') return (a.year || 0) - (b.year || 0);
    if (sort === 'title.asc') return a.title.localeCompare(b.title);
    const ia = order.has(a.key) ? order.get(a.key) : 1e6 + (a.popularityRank || 0); const ib = order.has(b.key) ? order.get(b.key) : 1e6 + (b.popularityRank || 0);
    return ia - ib;
  });
  const per = 30;
  return { items: pool.slice((page - 1) * per, page * per), total: pool.length, pages: Math.ceil(pool.length / per), page };
}

export async function getCategory(type, key, page = 1) {
  const c = await loadCatalog();
  const titles = { trending: 'Trending', top_rated: 'Top Rated', popular: 'Popular', upcoming: 'Upcoming', now_playing: 'Now Playing', on_the_air: 'On The Air', airing_today: 'Airing Today' };
  const title = `${titles[key] || key.replace(/_/g, ' ')} ${type === 'tv' ? 'Series' : 'Movies'}`;
  if (live()) {
    const r = key === 'trending' ? await tmdb(`/trending/${type}/day`, { page }) : await tmdb(`/${type}/${key}`, { page });
    return { title, items: r.results.map(x => mapTmdb(x, type)), pages: r.total_pages, page };
  }
  const cat = c.categories?.[`${type}/${key}`];
  const per = 30; const list = items(cat?.items || []);
  return { title: cat?.title || title, items: list.slice((page - 1) * per, page * per), pages: Math.ceil(list.length / per), page };
}

export async function getProvider(id) {
  const c = await loadCatalog();
  const provider = (c.providers || []).find(p => String(p.id) === String(id)) || { id, name: 'Provider', logo: null };
  const [movies, series] = await Promise.all([getProviderRow(id, 'movie'), getProviderRow(id, 'tv')]);
  return { provider, movies, series };
}

export async function search(q) {
  q = (q || '').trim();
  if (!q) return { people: [], media: [] };
  if (live()) {
    const r = await tmdb('/search/multi', { query: q });
    const people = r.results.filter(x => x.media_type === 'person').slice(0, 10).map(p => ({ id: p.id, name: p.name, photo: p.profile_path }));
    const media = r.results.filter(x => x.media_type === 'movie' || x.media_type === 'tv').map(x => mapTmdb(x));
    return { people, media };
  }
  const c = await loadCatalog();
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q); const words = nq.split(/\s+/).filter(Boolean);
  const score = t => { const nt = norm(t); if (nt === nq) return 100; if (nt.startsWith(nq)) return 80; if (nt.includes(nq)) return 60; const hit = words.filter(w => nt.includes(w)).length; return hit === words.length ? 40 : hit ? 10 * hit : 0; };
  const media = allItems().map(i => ({ i, s: score(i.title) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || (b.i.rating || 0) - (a.i.rating || 0)).slice(0, 40).map(x => x.i);
  const people = Object.values(c.people || {}).map(p => ({ p, s: score(p.name) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 10).map(x => x.p);
  return { people, media };
}

export async function getPerson(id) {
  const c = await loadCatalog();
  if (live()) {
    try {
      const p = await tmdb(`/person/${id}`, { append_to_response: 'combined_credits' });
      const credits = (p.combined_credits?.cast || []).concat(p.combined_credits?.crew || []).filter(x => x.poster_path);
      const seen = new Set(); const known = [];
      for (const x of credits.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))) { const it = mapTmdb(x); if (seen.has(it.key)) continue; seen.add(it.key); known.push(it); }
      return { id: p.id, name: p.name, photo: p.profile_path, bio: p.biography, birthday: p.birthday, place: p.place_of_birth, department: p.known_for_department, known };
    } catch { /* fall through */ }
  }
  const p = c.people?.[id];
  if (p) return { ...p, known: items(p.known || []) };
  return { id, name: 'Unknown person', known: [] };
}

export async function getTrendingToday() {
  const c = await loadCatalog();
  if (live()) { const r = await tmdb('/trending/all/day'); return r.results.filter(x => x.media_type !== 'person').map(x => mapTmdb(x)); }
  const row = (c.rows || []).find(r => /trending movies/i.test(r.title)); const row2 = (c.rows || []).find(r => /trending series/i.test(r.title));
  const a = items(row?.items || []), b = items(row2?.items || []); const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}

export function yearsList() { const y = new Date().getFullYear() + 1; return Array.from({ length: 60 }, (_, i) => y - i); }
