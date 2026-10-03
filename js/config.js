// Runtime configuration. Edit this file (or define window.CINEJOY_CONFIG before
// app.js loads) to change how the recreation behaves.
window.CINEJOY_CONFIG = Object.assign(
  {
    // TMDB v3 API key. Leave empty to run from the bundled metadata snapshot in /data.
    // With a key, trending, discover, search, people and season data are fetched live.
    tmdbApiKey: "",
    imageBase: "https://image.tmdb.org/t/p/",
    siteName: "Cinejoy",
    contactEmail: "",

    // Playback sources. NONE are bundled: the player shows its error screen until you
    // add at least one source you are entitled to use (your own files, a licensed CDN).
    // Each source resolves a title to a playable URL (mp4, webm or .m3u8 HLS) and,
    // optionally, subtitle tracks. Return null when the title is not available.
    //
    // sources: [
    //   {
    //     name: "Main",
    //     resolve: async ({ type, id, season, episode, title, year }) => ({
    //       url: "https://cdn.example.com/video.m3u8",
    //       subtitles: [{ label: "English", lang: "en", src: "/subs/en.vtt" }],
    //     }),
    //   },
    // ],
    sources: [],
  },
  window.CINEJOY_CONFIG || {}
);
