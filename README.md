# Cinejoy — interface recreation

A static, dependency-free front-end that recreates the look and interaction model of the
Cinejoy streaming interface: floating glass navigation, an auto-advancing hero carousel with
title logos, provider tiles, horizontally scrolling poster rows with hover reveals, discovery
pages with filter dropdowns and infinite scroll, rich movie / series detail pages (cast,
trailers, episodes, info panel), search, lists, watch history, settings, shorts and a player shell.

Everything in this repository was written from scratch for this recreation: markup, styles,
scripts, and the logo. No code, stylesheets or brand assets were copied from the original site.

## What it is not

- It ships **no media sources**. The player is a complete HTML5 player (HLS, subtitles, speed,
  fit, volume boost, picture in picture, resume, next episode, rearrangeable controls), but it
  has nothing to play until the site owner adds sources they are entitled to use in
  `js/config.js`. With none configured it shows its error screen and offers the official trailer.
- It ships **no ads, analytics or tracking**, and no third-party stream integrations.
- Accounts, comments, votes and lists are **local to the browser**. There is no server, so
  nothing is shared between devices or users.
- Poster, backdrop and logo artwork is **not stored in this repo**. Images load at runtime from
  The Movie Database (TMDB) image CDN. This product uses the TMDB API but is not endorsed or
  certified by TMDB.

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
js/store.js             localStorage-backed settings, lists, history, progress
js/auth.js              local 16-digit account flow
js/comments.js          local comment threads
js/player.js            watch page, player, controls editor
js/settings.js          settings page and theme picker
js/themes.js            theme palettes and custom theme generator
js/liquid.js            WebGL / CSS / canvas backgrounds
js/router.js            history router with hash fallback for file://
js/icons.js             inline SVG icon set
brand/                  logomark (original design)
data/                   metadata snapshot
scripts/                dev server and data build script
```

## Themes and backgrounds

Eleven themes (Default, Surface, Aero, Blue, Teal, Forest, Mocha, Red, Pink, Dark, AMOLED) plus a
Custom theme generated from any base colour. Backgrounds are drawn with original code: a WebGL
domain-warped noise shader for the liquid themes, layered CSS for Aero, and a canvas starfield for
AMOLED. "Reduce Motion" freezes them.

## Accounts

Sign in uses a random 16-digit account number, like the original flow. Register generates one,
shows it once, and stores only a SHA-256 hash in localStorage. Comments, replies and votes on
detail pages are stored per title in the browser and require being signed in.

## Player

`js/player.js`. Keyboard: Space/K play, J/L or arrows seek, Up/Down volume, M mute, F fullscreen,
C cycle subtitles, N next episode, 0-9 jump, Esc back. `/settings/player` lets you drag controls
between the bar and a tray; the layout is saved and applied to the player.

## Client-side features

- Settings persist locally: theme accent, flat UI, episode carousel/grid, detail page/modal,
  image logos, trailers, spoiler-free mode, reduced motion, playback and subtitle options.
- Lists are stored locally, can be exported/imported as JSON, and curated "public lists" are
  derived from the catalog's editorial rows.
- Watch history is recorded when a watch route is opened.
- Keyboard: `/` jumps to search, `Esc` closes menus, arrows navigate shorts.
