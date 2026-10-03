// Tiny history-based router with hash fallback for file:// usage.
const useHash = location.protocol === 'file:';
const routes = [];
let current = null;
const subs = new Set();

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([^/]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }).replace(/\*/g, '.*') + '/?$');
  routes.push({ pattern, re, keys, handler });
}

export function currentPath() {
  if (useHash) return (location.hash.replace(/^#/, '') || '/');
  return location.pathname + location.search;
}

export function match(path) {
  const [pathname, search = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  for (const r of routes) {
    const m = pathname.match(r.re);
    if (m) {
      const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1] || ''); });
      return { route: r, params, query, pathname };
    }
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  if (path === currentPath()) { dispatch(); return; }
  if (useHash) { if (replace) location.replace('#' + path); else location.hash = path; return; }
  if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
  dispatch();
}

export function back() { if (history.length > 1) history.back(); else navigate('/'); }
export function onNavigate(fn) { subs.add(fn); return () => subs.delete(fn); }

function dispatch() {
  const path = currentPath();
  const m = match(path);
  current = m;
  subs.forEach(fn => fn(m, path));
}

export function startRouter() {
  window.addEventListener(useHash ? 'hashchange' : 'popstate', dispatch);
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noRouter != null) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    navigate(href);
  });
  dispatch();
}

export function hrefFor(path) { return useHash ? '#' + path : path; }
export { useHash };
