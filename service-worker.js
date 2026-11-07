const CACHE = 'forme-mobile-v028-nutrition';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './data.js', './exercise-art.js', './exercise-photos.js', './core.js', './food-art.js', './food-photos.js', './i18n.js', './interface-translations.js', './exercise-translations.js', './food-translations.js', './workout-translations.js', './locale-content.js', './storage-schema.js', './progress.js', './programs.js', './nutrition-journal.js', './backup.js', './favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('forme-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
