const CACHE = 'forme-mobile-v041-sets1';
const MEDIA_CACHE = 'forme-media-v029-optimized';
const REFRESHED_MEDIA = ['./media/foods/banana-480.webp', './media/foods/banana-960.webp', './media/foods/banana-v2-480.webp', './media/foods/banana-v2-960.webp'];
const ASSETS = ['./', './index.html', './styles.css', './app.js', './workout-audio.js', './data.js', './exercise-art.js', './exercise-photos.js', './core.js', './food-art.js', './food-photos.js', './i18n.js', './interface-translations.js', './exercise-translations.js', './food-translations.js', './workout-translations.js', './locale-content.js', './storage-schema.js', './state-normalizer.js', './progress.js', './programs.js', './nutrition-journal.js', './backup.js', './favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(path, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('forme-') && key !== CACHE && key !== MEDIA_CACHE).map(key => caches.delete(key)))),
    caches.open(MEDIA_CACHE).then(cache => Promise.all(REFRESHED_MEDIA.map(path => cache.delete(new URL(path, self.registration.scope).href))))
  ]).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async res => (res && res.ok === false) ? ((await caches.match('./index.html')) || res) : res).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.pathname.includes('/media/') && /\.webp$/i.test(url.pathname)) {
    event.respondWith(caches.open(MEDIA_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request, {cache: 'reload'});
        if (response && response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        return typeof Response !== 'undefined' ? Response.error() : undefined;
      }
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
