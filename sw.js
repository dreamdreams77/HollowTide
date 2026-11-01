// Service worker: makes the installed game work offline.
// tools/build.mjs stamps a content hash, the precache file list and the font stylesheet URL into the copy in
// dist/ (the three double-underscore placeholders below), so every release gets its own cache and old ones are deleted. The source file is a template; it is only
// registered by the built page, never by `npm start` (so development never serves stale files).

const BUILD = '__BUILD__';
const SHELL = `hollow-tide-shell-${BUILD}`;
const FONTS = 'hollow-tide-fonts-v1';
const PRECACHE = __PRECACHE__;
const FONT_CSS = '__FONT_CSS__';

// Fonts live on Google's servers; fetch them once at install so the first offline launch still has them.
async function warmFonts() {
  if (!FONT_CSS.startsWith('https://')) return;
  try {
    const cache = await caches.open(FONTS);
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    await cache.put(FONT_CSS, res.clone());
    const css = await res.text();
    const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null)));
  } catch {
    // offline during install, or fonts blocked: the game falls back to system fonts
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => warmFonts())
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k.startsWith('hollow-tide-shell-') && k !== SHELL) await caches.delete(k);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        try {
          return await fetch(req);
        } catch (err) {
          // offline and not cached: a page navigation still gets the game
          if (req.mode === 'navigate') {
            const shell = await caches.match(new URL('./index.html', self.registration.scope).href);
            if (shell) return shell;
          }
          throw err;
        }
      })(),
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      (async () => {
        const cache = await caches.open(FONTS);
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((r) => {
            if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
            return r;
          })
          .catch(() => hit);
        return hit || net;
      })(),
    );
  }
});
