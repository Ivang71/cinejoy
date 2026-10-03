#!/usr/bin/env python3
"""Convert captured reference JSON into the clone's catalog format.

Inputs (scratch dir): data-home.json, data-all.json
Outputs: data/catalog.json, data/details/<type>-<id>.json

Only facts are kept: titles, years, ratings, TMDB image paths, cast names,
trailer keys. Images are not downloaded; the UI loads them from TMDB's CDN.
"""
import json, re, sys, os, datetime

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
os.makedirs(os.path.join(OUT, 'details'), exist_ok=True)

home = json.load(open(os.path.join(SRC, 'data-home.json')))
alld = json.load(open(os.path.join(SRC, 'data-all.json'))) if os.path.exists(os.path.join(SRC, 'data-all.json')) else {}

def path_of(url):
    if not url: return None
    m = re.match(r'https?://image\.tmdb\.org/t/p/[^/]+(/.+)$', url)
    return m.group(1) if m else url
def parse_href(href):
    m = re.match(r'^/(movie|series|tv)/((\d+)(?:-(.*))?)$', href or '')
    if not m: return None
    t = 'tv' if m.group(1) in ('series', 'tv') else 'movie'
    return t, int(m.group(3)), m.group(2)
def meta_of(meta):
    rating = year = None
    for t in meta or []:
        t = t.strip()
        if re.fullmatch(r'\d{4}', t): year = int(t)
        elif re.fullmatch(r'\d+(\.\d+)?', t) and float(t) <= 10: rating = float(t)
    return rating, year
def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')
    return s[:60]

items = {}
def add_item(href, title, poster, meta=None, extra=None):
    p = parse_href(href)
    if not p: return None
    t, i, slug = p
    key = f'{t}:{i}'
    rating, year = meta_of(meta)
    it = items.setdefault(key, {'type': t, 'id': i, 'slug': slug, 'title': title or ''})
    if title and not it.get('title'): it['title'] = title
    if poster and not it.get('poster'): it['poster'] = path_of(poster)
    if rating is not None: it['rating'] = rating
    if year is not None: it['year'] = year
    if extra: it.update({k: v for k, v in extra.items() if v is not None})
    return key

# ---- home rows & providers
providers = []
rows = []
provider_catalog = {}
for r in home['rows']:
    title = r['title']
    if title == 'Browse by Provider':
        for it in r['items']:
            pid = int(it['href'].split('/')[-1])
            providers.append({'id': pid, 'name': it['title'], 'logo': path_of(it['img'])})
        continue
    keys = [k for k in (add_item(i['href'], i['title'], i['img'], i['meta']) for i in r['items']) if k]
    rid = slugify(title)
    if title in ('Movies on', 'TV Series on'):
        kind = 'provider-movies' if title == 'Movies on' else 'provider-series'
        rows.append({'id': rid, 'title': title, 'kind': kind, 'items': []})
        pid = next((p['id'] for p in providers if p['name'] == (r.get('ddLabel') or 'Netflix')), 8)
        provider_catalog.setdefault(str(pid), {}).setdefault('movies' if kind == 'provider-movies' else 'series', keys)
        continue
    rows.append({'id': rid, 'title': title, 'viewAll': r.get('viewAll'), 'items': keys})
    if not r.get('viewAll'): rows[-1].pop('viewAll')

# ensure provider rows exist right after the trending rows (default provider: Netflix, id 8)
if not any(r.get('kind') for r in rows):
    idx = next((i for i, r in enumerate(rows) if r['title'] == 'Trending Series'), 1) + 1
    rows[idx:idx] = [{'id': 'movies-on', 'title': 'Movies on', 'kind': 'provider-movies', 'items': []}, {'id': 'tv-series-on', 'title': 'TV Series on', 'kind': 'provider-series', 'items': []}]

# ---- hero slides
def slide_key(s, pool_type='movie'):
    if not s or not s.get('title'): return None
    for k, it in items.items():
        if it['type'] == pool_type and it['title'].strip().lower() == s['title'].strip().lower(): return k
    return None
def apply_slide(s, key):
    it = items[key]
    it['logo'] = path_of(s.get('logo'))
    back = next((b['src'] for b in s.get('backs', []) if (b.get('alt') or '').strip().lower() == s['title'].strip().lower()), None) or (s['backs'][-1]['src'] if s.get('backs') else None)
    it['backdrop'] = path_of(back)
    meta = s.get('meta') or []
    for t in meta:
        m = re.fullmatch(r'(\d+(\.\d+)?)/10', t)
        if m: it['rating'] = float(m.group(1))
        elif re.fullmatch(r'\d{4}', t): it['year'] = int(t)
        elif t not in ('•', '/10') and not re.fullmatch(r'[\d./]+', t): it['genre'] = t
    if s.get('overview'): it['overview'] = s['overview']
hero_home = []
for s in home['slides']:
    k = slide_key(s, 'movie')
    if k: apply_slide(s, k); hero_home.append(k)
hero_series = []
for s in (alld.get('discovery', {}).get('series', {}) or {}).get('slides', []) or []:
    for i in (alld['discovery']['series'].get('grid') or []): add_item(i['href'], i['title'], i['img'], i['meta'])
    k = slide_key(s, 'tv')
    if k: apply_slide(s, k); hero_series.append(k)

# ---- discovery
discovery = {}
for kind in ('movies', 'series'):
    d = (alld.get('discovery') or {}).get(kind)
    if not d: continue
    t = 'tv' if kind == 'series' else 'movie'
    up = []; up_title = None; extra_rows = []
    for r in d.get('rows', []):
        if r['title'] in ('Upcoming', 'New Seasons Airing') or any('Coming Soon' in x or 'Airing' in x for i in r['items'][:1] for x in i.get('texts', [])):
            up_title = r['title']
            for i in r['items']:
                p = parse_href(i['href'])
                if not p: continue
                texts = i.get('texts', [])
                date = next((x for x in texts if re.fullmatch(r'[A-Z][a-z]{2} \d{1,2}(, \d{4})?', x)), None)
                badge = next((x for x in texts if x in ('Coming Soon', 'Airing', 'New Season', 'Now Airing') or 'Season' in x and len(x) < 20), None)
                key = add_item(i['href'], i['title'], None)
                iso = None
                if date:
                    try:
                        dt = datetime.datetime.strptime(date if ',' in date else f'{date}, {datetime.date.today().year}', '%b %d, %Y')
                        iso = dt.strftime('%Y-%m-%d')
                    except Exception: iso = None
                up.append({'key': key, 'title': i['title'], 'backdrop': path_of(i['img']), 'date': iso, 'badge': badge, 'href': i['href']})
        else:
            keys = [k for k in (add_item(i['href'], i['title'], i['img'], None) for i in r['items']) if k]
            extra_rows.append({'id': slugify(r['title']), 'title': r['title'], 'items': keys})
    grid = [k for k in (add_item(i['href'], i['title'], i['img'], i['meta']) for i in d.get('grid', [])) if k]
    discovery[kind] = {'upcoming': up, 'upcomingTitle': up_title or ('Upcoming' if t == 'movie' else 'New Seasons Airing'), 'rows': extra_rows, 'grid': grid}

# ---- providers
for pid, p in (alld.get('providers') or {}).items():
    if not any(str(x['id']) == str(pid) for x in providers):
        providers.append({'id': int(pid), 'name': p['name'], 'logo': path_of(p['logo'])})
    provider_catalog[str(pid)] = {
        'movies': [k for k in (add_item(i['href'], i['title'], i['img'], i['meta']) for i in p.get('movies', [])) if k],
        'series': [k for k in (add_item(i['href'], i['title'], i['img'], i['meta']) for i in p.get('series', [])) if k],
    }

# ---- categories
categories = {}
for path, c in (alld.get('categories') or {}).items():
    m = re.match(r'^/category/(movie|tv)/(.+)$', path)
    if not m: continue
    categories[f'{m.group(1)}/{m.group(2)}'] = {'title': c.get('h1') or '', 'items': [k for k in (add_item(i['href'], i['title'], i['img'], i['meta']) for i in c.get('items', [])) if k]}

# ---- details
def runtime_minutes(label):
    if not label: return None
    h = re.search(r'(\d+)\s*h', label); m = re.search(r'(\d+)\s*m', label)
    return (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0) or None
written = 0
for href, d in (alld.get('details') or {}).items():
    p = parse_href(href)
    if not p or not d: continue
    t, i, slug = p
    key = f'{t}:{i}'
    it = items.setdefault(key, {'type': t, 'id': i, 'slug': slug, 'title': d.get('title') or ''})
    if d.get('title'): it['title'] = d['title']
    det = {'key': key, 'type': t, 'id': i, 'title': d.get('title') or it['title']}
    det['backdrop'] = path_of(d.get('backdrop')); det['logo'] = path_of(d.get('logo'))
    det['genres'] = [g for g in d.get('genres', []) if g]
    meta = d.get('metaTexts') or []
    for mt in meta:
        if re.fullmatch(r'\d{4}', mt): det['year'] = int(mt)
        elif re.fullmatch(r'\d{4}\s*[–-]\s*(\d{4})?', mt): det['yearRange'] = mt.replace(' ', ''); det['year'] = int(mt[:4])
        elif re.search(r'\d+\s*h|\d+\s*m$', mt) and len(mt) < 12: det['runtimeLabel'] = mt; det['runtime'] = runtime_minutes(mt)
    if d.get('cert'): det['cert'] = d['cert']
    if d.get('rating'):
        try: det['rating'] = float(d['rating'])
        except ValueError: pass
    v = d.get('votes') or []
    if len(v) >= 2:
        try: det['votes'] = {'up': int(v[0]), 'down': int(v[1])}
        except ValueError: pass
    if d.get('creditLabel'):
        det['credit'] = {'label': d['creditLabel'].rstrip(':'), 'people': [{'name': x['name'], 'id': int(x['href'].split('/')[-1]) if x.get('href') else None} for x in d.get('creditPeople', [])]}
    if d.get('overview'): det['overview'] = d['overview']
    info = []
    for r in d.get('info', []):
        k = r.get('k'); val = r.get('v') or ''
        if not k: continue
        if k == 'Runtime':
            val = re.sub(r'\s*•\s*Ends.*$', '', val)
        info.append({'k': k, 'v': val})
    det['info'] = info
    det['networks'] = [{'name': n.get('name'), 'logo': path_of(n.get('src'))} for n in d.get('networks', []) if n.get('src')]
    det['cast'] = [{'name': c.get('name'), 'character': c.get('character'), 'photo': path_of(c.get('img'))} for c in d.get('cast', []) if c.get('name')]
    trailers = []
    for tr in d.get('trailers', []):
        m = re.search(r'youtube\.com/vi/([^/]+)/', tr.get('img') or '')
        if m: trailers.append({'title': tr.get('title') or 'Trailer', 'type': tr.get('type') or 'Trailer', 'youtubeKey': m.group(1)})
    det['trailers'] = trailers
    if t == 'tv':
        season_label = d.get('season') or 'Season 1'
        sm = re.search(r'(\d+)', season_label)
        det['seasonNumber'] = int(sm.group(1)) if sm else 1
        names = []
        for s in d.get('seasons', []) or []:
            if re.fullmatch(r'(Season|Specials?)\s*\d*', s.strip()) and s.strip() not in names: names.append(s.strip())
        if not names: names = [season_label]
        det['seasons'] = [{'number': int(re.search(r'\d+', n).group(0)) if re.search(r'\d+', n) else 0, 'name': n} for n in names]
        eps = []
        for c in d.get('epCards', []) or []:
            hm = re.match(r'^/watch/tv/\d+/(\d+)/(\d+)$', c.get('href') or '')
            if not hm: continue
            texts = c.get('texts', [])
            num = int(hm.group(2))
            badge = f'E{num}'
            rt = next((x for x in texts if re.fullmatch(r'\d+h( \d+m)?|\d+m', x)), None)
            rest = [x for x in texts if x not in (badge, rt)]
            title = rest[0] if rest else f'Episode {num}'
            overview = rest[1] if len(rest) > 1 else ''
            eps.append({'num': num, 'season': int(hm.group(1)), 'title': title, 'overview': overview, 'still': path_of(c.get('img')), 'runtimeLabel': rt, 'runtime': runtime_minutes(rt)})
        det['episodes'] = eps
    # back-fill item summary
    for k in ('year', 'rating', 'backdrop', 'logo', 'overview'):
        if det.get(k) is not None: it[k] = det[k]
    if det['genres']: it['genres'] = det['genres']; it['genre'] = det['genres'][0]
    json.dump(det, open(os.path.join(OUT, 'details', f'{t}-{i}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    written += 1

# ---- people
people = {}
for pid, p in (alld.get('people') or {}).items():
    name = p.get('name')
    if not name: continue
    photo = next((x['src'] for x in p.get('imgs', []) if (x.get('alt') or '') == name), None)
    texts = p.get('texts', [])
    bio = max((x for x in texts if len(x) > 160), key=len, default=None)
    known = [k for k in (add_item(l.get('href'), l.get('title'), l.get('img'), None) for l in p.get('links', [])) if k]
    facts = {}
    for x in texts:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', x): facts['birthday'] = x
    dept = next((x for x in texts if x in ('Acting', 'Directing', 'Writing', 'Production')), None)
    people[str(pid)] = {'id': int(pid), 'name': name, 'photo': path_of(photo), 'bio': bio, 'department': dept, 'known': list(dict.fromkeys(known)), **facts}

catalog = {
    'generatedAt': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'source': 'TMDB metadata snapshot',
    'items': items, 'hero': {'home': hero_home, 'movies': hero_home, 'series': hero_series},
    'providers': providers, 'rows': rows, 'providerCatalog': provider_catalog, 'categories': categories, 'discovery': discovery, 'people': people,
}
json.dump(catalog, open(os.path.join(OUT, 'catalog.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'items={len(items)} rows={len(rows)} providers={len(providers)} providerCatalog={len(provider_catalog)} categories={len(categories)} details={written} people={len(people)} heroHome={len(hero_home)} heroSeries={len(hero_series)}')
print('catalog bytes', os.path.getsize(os.path.join(OUT, 'catalog.json')))
