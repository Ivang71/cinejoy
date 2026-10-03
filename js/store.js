// Persistent client state (settings, lists, history) backed by localStorage.
const KEY = 'cinejoy::state::v1';

export const DEFAULT_SETTINGS = {
  theme: 'default',          // default | lime | ocean | rose | amber
  flatUi: false,
  episodeView: 'carousel',   // carousel | grid
  detailView: 'page',        // page | modal
  imageLogos: true,
  trailers: true,
  spoilerFree: false,
  reduceMotion: false,
  autoplay: true,
  autoSkipIntro: false,
  seekTime: 10,
  autoSubtitles: false,
  subtitleFont: 'Cinejoy',
  subtitleSize: 100,
  subtitleColor: '#ffffff',
  subtitleBlur: false,
  ads: true,
  serverOrder: [],
  displayName: '',
  customPrimary: '#8a7bff',
  playerLayout: null,
  volumeBoost: 100,
  videoFitMode: 'contain',
  subtitlePosition: 0,
  defaultSubtitleLanguage: 'en',
};

function safeParse(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } }

const listeners = new Set();
let state = Object.assign(
  { settings: { ...DEFAULT_SETTINGS }, lists: [], history: [], votes: {}, watched: {}, listPrefs: {}, progress: {} },
  safeParse((() => { try { return localStorage.getItem(KEY); } catch { return null; } })()) || {}
);
state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

function persistQuiet() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }

export const store = {
  get state() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // settings
  get settings() { return state.settings; },
  setSetting(k, v) { state.settings = { ...state.settings, [k]: v }; persist(); applySettings(); },
  resetSettings() { state.settings = { ...DEFAULT_SETTINGS }; persist(); applySettings(); },

  // lists
  get lists() { return state.lists; },
  createList(name) {
    const id = 'l' + Math.random().toString(36).slice(2, 9);
    const list = { id, name: name.trim() || 'Untitled list', slug: slugify(name) + '-' + id, items: [], createdAt: Date.now(), public: false };
    state.lists = [...state.lists, list]; persist(); return list;
  },
  renameList(id, name) { state.lists = state.lists.map(l => l.id === id ? { ...l, name } : l); persist(); },
  deleteList(id) { state.lists = state.lists.filter(l => l.id !== id); persist(); },
  getList(idOrSlug) { return state.lists.find(l => l.id === idOrSlug || l.slug === idOrSlug) || null; },
  toggleInList(listId, key) {
    let added = false;
    state.lists = state.lists.map(l => {
      if (l.id !== listId) return l;
      if (l.items.includes(key)) return { ...l, items: l.items.filter(k => k !== key) };
      added = true; return { ...l, items: [key, ...l.items] };
    });
    persist(); return added;
  },
  listsContaining(key) { return state.lists.filter(l => l.items.includes(key)); },
  importLists(json) {
    const arr = Array.isArray(json) ? json : (json && Array.isArray(json.lists) ? json.lists : []);
    const clean = arr.filter(l => l && typeof l.name === 'string' && Array.isArray(l.items)).map(l => ({ id: 'l' + Math.random().toString(36).slice(2, 9), name: l.name, slug: slugify(l.name) + '-' + Math.random().toString(36).slice(2, 6), items: l.items.filter(x => typeof x === 'string'), createdAt: Date.now(), public: false }));
    state.lists = [...state.lists, ...clean]; persist(); return clean.length;
  },
  exportLists() { return JSON.stringify({ exportedAt: new Date().toISOString(), lists: state.lists }, null, 2); },

  // history
  get history() { return state.history; },
  pushHistory(entry) {
    const rest = state.history.filter(h => !(h.key === entry.key && (h.season ?? null) === (entry.season ?? null) && (h.episode ?? null) === (entry.episode ?? null)));
    state.history = [{ ...entry, at: Date.now() }, ...rest].slice(0, 100); persist();
  },
  removeHistory(idx) { state.history = state.history.filter((_, i) => i !== idx); persist(); },
  clearHistory() { state.history = []; persist(); },

  // playback progress (seconds), keyed by "type:id[:season:episode]"
  setProgress(k, t, d) { state.progress = { ...(state.progress || {}), [k]: { t: Math.floor(t), d: Math.floor(d), at: Date.now() } }; persistQuiet(); },
  getProgress(k) { return (state.progress || {})[k] || null; },
  clearProgress(k) { const p = { ...(state.progress || {}) }; delete p[k]; state.progress = p; persistQuiet(); },

  // votes & watched
  vote(key, dir) { const cur = state.votes[key]; state.votes = { ...state.votes, [key]: cur === dir ? null : dir }; persist(); return state.votes[key]; },
  getVote(key) { return state.votes[key] || null; },
  toggleWatched(id) { state.watched = { ...state.watched, [id]: !state.watched[id] }; persist(); return !!state.watched[id]; },
  isWatched(id) { return !!state.watched[id]; },
  setWatchedMany(ids, value) { const w = { ...state.watched }; ids.forEach(i => { w[i] = value; }); state.watched = w; persist(); },
};

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function applySettings() {
  const s = state.settings; const html = document.documentElement;
  html.dataset.flatUi = s.flatUi ? 'on' : 'off';
  html.dataset.reduceMotion = s.reduceMotion ? 'on' : 'off';
}
