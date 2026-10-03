// Runtime configuration. Edit this file (or define window.CINEJOY_CONFIG before
// app.js loads) to point the clone at live data.
//
// tmdbApiKey: leave empty to run from the bundled snapshot in /data. Provide a
// TMDB v3 API key to fetch live trending / discover / search / detail data.
window.CINEJOY_CONFIG = Object.assign(
  {
    tmdbApiKey: "",
    imageBase: "https://image.tmdb.org/t/p/",
    siteName: "Cinejoy",
    contactEmail: "",
  },
  window.CINEJOY_CONFIG || {}
);
