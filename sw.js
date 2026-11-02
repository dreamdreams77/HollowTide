// Service worker: keeps the game available offline without pinning visitors to stale releases.
// tools/build.mjs stamps a content hash and precache list into the published copy.

const BUILD = '__BUILD__';
const SHELL = `hollow-tide-shell-${BUILD}`;
const FONTS = 'hollow-tide-fonts-v1';
const PRECACHE = __PRECACHE__;
const FONT_CSS = '__FONT_CSS__';

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
    // Offline during install, or fonts blocked: the game falls back to system fonts.
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => warmFonts())
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('hollow-tide-shell-') && k !== SHELL) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // HTML is network-first: a new Pages release must be visible on the next visit.
    // The versioned shell remains the offline fallback.
    if (req.mode === 'navigate' || req.destination === 'document') {
      e.respondWith((async () => {
        const cache = await caches.open(SHELL);
        try {
          const fresh = await fetch(req);
          if (fresh.ok) await cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await cache.match(req, { ignoreSearch: true })
            || await cache.match(new URL('./index.html', self.registration.scope).href);
          if (cached) return cached;
          throw err;
        }
      })());
      return;
    }

    // Non-document same-origin resources are scoped to this release's cache only.
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh.ok) await cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
        return r;
      }).catch(() => hit);
      return hit || net;
    })());
  }
});
