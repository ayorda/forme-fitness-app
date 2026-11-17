const CACHE = 'forme-mobile-v0152-modal1';
const AUDIO_CACHE = 'forme-audio-v0150-original1';
const AUDIO_ASSETS = ['calm', 'flow', 'breath', 'relax'].map(id => './media/yoga-music/' + id + '-v1.m4a');
// Recordings are fetched in full by Web Audio only when selected. Never precache.
async function audioResponse(request) {
  let cache;
  try {
    cache = await caches.open(AUDIO_CACHE);
    const saved = await cache.match(request.url);
    if (saved?.status === 200) return saved;
  } catch { /* Network playback still works if local storage is unavailable. */ }
  const response = await fetch(request);
  if (response?.status === 200) try { await cache?.put(request.url, response.clone()); } catch {}
  return response;
}
const MEDIA_CACHE = 'forme-media-v029-optimized';
const VIDEO_CACHE = 'forme-video-v0143-dips2';
// Explicit, versioned public clips only. Full bodies are cached on first playback,
// never during installation; partial 206 responses must never enter CacheStorage.
const VIDEO_ASSETS = ['./media/exercise-videos/parallel-bar-dips-v2.mp4', './media/exercise-videos/parallel-bar-dips-v2-poster.jpg'];
const RETIRED_VIDEO_ASSETS = ['./media/exercise-videos/parallel-bar-dips-v1.webm', './media/exercise-videos/parallel-bar-dips-v1.mp4', './media/exercise-videos/parallel-bar-dips-v1-poster.jpg'];
async function migrateVideoCache() {
  let legacy;
  try { legacy = await caches.open(MEDIA_CACHE); } catch { return; }
  for (const path of VIDEO_ASSETS) {
    const key = new URL(path, self.registration.scope).href;
    try {
      const full = await legacy.match(key);
      if (full?.status !== 200) continue;
      const current = await caches.open(VIDEO_CACHE);
      await current.put(key, full);
      await legacy.delete(key);
    } catch { /* Keep the old complete body when a migration hits quota. */ }
  }
  await Promise.all(RETIRED_VIDEO_ASSETS.map(path => legacy.delete(new URL(path, self.registration.scope).href).catch(() => false)));
}
async function videoResponse(request) {
  let cache, full;
  const key = request.url;
  try { cache = await caches.open(VIDEO_CACHE); full = await cache.match(key); } catch {}
  // A failed upgrade copy must not break a previously viewed clip offline.
  if (!full || full.status !== 200) {
    try { full = await (await caches.open(MEDIA_CACHE)).match(key); } catch {}
  }
  if (!full || full.status !== 200) {
    const headers = new Headers(request.headers);
    headers.delete('Range'); headers.delete('If-Range');
    full = await fetch(new Request(request, {headers}));
    if (!full || full.status !== 200) return full;
    try { if (cache) await cache.put(key, full.clone()); } catch { /* Playback survives quota/cache failure. */ }
  }
  const range = request.headers.get('Range');
  const ifRange = request.headers.get('If-Range');
  if (!range || (ifRange && (ifRange.startsWith('W/') || (ifRange !== full.headers.get('ETag') && ifRange !== full.headers.get('Last-Modified'))))) return full;
  const body = await full.arrayBuffer(), length = body.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : length - 1;
  if (match && !match[1] && match[2]) { start = Math.max(0, length - end); end = length - 1; }
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || start > end || (!match[1] && Number(match[2]) === 0)) {
    return new Response(null, {status:416, headers:{'Content-Range':`bytes */${length}`}});
  }
  end = Math.min(end, length - 1);
  const headers = new Headers(full.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), {status:206, headers});
}
const REFRESHED_MEDIA = ['./media/foods/banana-480.webp', './media/foods/banana-960.webp', './media/foods/banana-v2-480.webp', './media/foods/banana-v2-960.webp'];
const ASSETS = ['./', './index.html', './styles.css?v=0151', './app.js?v=0152', './auth.js', './firebase-client.js', './cloud-sync.js', './access.js', './services.js', './workspaces.js', './sync-records.js', './auto-sync.js', './bootstrap.js', './pwa-register.js', './modal-accessibility.js', './local-copies.js', './auth-config.js', './vendor/firebase-auth-13.3.0.js', './workout-audio.js?v=0150', './skill-trees.js', './data.js', './exercise-art.js', './exercise-photos.js', './core.js', './food-art.js', './food-photos.js', './i18n.js', './interface-translations.js?v=0152', './exercise-translations.js', './food-translations.js', './workout-translations.js', './locale-content.js', './storage-schema.js', './state-normalizer.js', './progress.js', './programs.js', './nutrition-journal.js', './backup.js?v=0150', './recovery.js','./personalization.js', './favicon.svg', './manifest.webmanifest', './icon-192.png', './icon-512.png', './media/fonts/dm-sans-latin-ext-v17.woff2', './media/fonts/dm-sans-latin-v17.woff2', './media/fonts/space-grotesk-vietnamese-v22.woff2', './media/fonts/space-grotesk-latin-ext-v22.woff2', './media/fonts/space-grotesk-latin-v22.woff2'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(path, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('forme-') && key !== CACHE && key !== MEDIA_CACHE && key !== VIDEO_CACHE && key !== AUDIO_CACHE).map(key => caches.delete(key)))),
    migrateVideoCache(),
    caches.open(MEDIA_CACHE).then(cache => Promise.all(REFRESHED_MEDIA.map(path => cache.delete(new URL(path, self.registration.scope).href))))
  ]).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (AUDIO_ASSETS.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(audioResponse(event.request));
    return;
  }
  if (VIDEO_ASSETS.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(videoResponse(event.request));
    return;
  }
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
