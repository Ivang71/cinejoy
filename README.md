# Cinejoy — interface recreation

A static, dependency-free front-end that recreates the look and interaction model of the
Cinejoy streaming interface: floating glass navigation, an auto-advancing hero carousel with
title logos, provider tiles, horizontally scrolling poster rows with hover reveals, discovery
pages with filter dropdowns and infinite scroll, rich movie / series detail pages (cast,
trailers, episodes, info panel), search, lists, watch history, settings, shorts and a player shell.

Everything in this repository was written from scratch for this recreation: markup, styles,
scripts, and the logo. No code, stylesheets or brand assets were copied from the original site.

## What it is not

- It does **not** stream or host any video. The Play button opens a player shell that explains
  there is no playback source, and offers the official trailer where one exists.
- It ships **no ads, analytics or tracking**.
- Poster, backdrop and logo artwork is **not stored in this repo**. Images are loaded at runtime
  from The Movie Database (TMDB) image CDN. This product uses the TMDB API but is not endorsed
  or certified by TMDB.

## Running it

```bash
node scripts/serve.mjs          # http://localhost:4173
# or any static server with SPA fallback, e.g.
npx serve -s .
```

Open `http://localhost:4173`. Routes mirror the original (`/`, `/movies`, `/series`,
`/search/:query`, `/category/:type/:key`, `/provider/:id`, `/movie/:slug`, `/series/:slug`,
`/person/:id`, `/lists`, `/list/:slug`, `/continue-watching`, `/settings`, `/shorts`,
`/watch/movie/:id`, `/watch/tv/:id/:season/:episode`). `404.html` is a copy of `index.html` so
deep links work on GitHub Pages and similar hosts.

## Data

The interface runs from a snapshot in `data/` (`catalog.json` plus one JSON per title in
`data/details/`). The snapshot holds TMDB metadata only: titles, years, ratings, genres,
overviews, cast names, YouTube trailer keys and TMDB image paths.

To run against live data instead, put a TMDB v3 API key in `js/config.js`:

```js
window.CINEJOY_CONFIG = { tmdbApiKey: "YOUR_KEY" };
```

With a key set, trending, top-rated, discover filters, search, people and season data are
fetched from TMDB on demand. Without a key the same screens are populated from the snapshot.

`scripts/build-data.py` regenerates the snapshot from captured reference JSON.

## Project layout

```
index.html / 404.html   app shell
css/app.css             all styling (design tokens at the top)
js/app.js               routes, global actions, page lifecycle
js/pages.js             page renderers
js/components.js        header, hero, rows, cards, dropdowns, modals
js/data.js              snapshot + live TMDB data layer
js/store.js             localStorage-backed settings, lists, history
js/router.js            history router with hash fallback for file://
js/icons.js             inline SVG icon set
brand/                  logomark (original design)
data/                   metadata snapshot
scripts/                dev server and data build script
```

## Client-side features

- Settings persist locally: theme accent, flat UI, episode carousel/grid, detail page/modal,
  image logos, trailers, spoiler-free mode, reduced motion, playback and subtitle options.
- Lists are stored locally, can be exported/imported as JSON, and curated "public lists" are
  derived from the catalog's editorial rows.
- Watch history is recorded when a watch route is opened.
- Keyboard: `/` jumps to search, `Esc` closes menus, arrows navigate shorts.
