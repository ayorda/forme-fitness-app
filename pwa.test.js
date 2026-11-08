const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const sw = fs.readFileSync('service-worker.js','utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
test('HTML links install manifest and registers service worker', () => {
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\.\/service-worker\.js'\)/);
  assert.match(sw, /caches\.open/);
});
test('Mobile header is in Bulgarian', () => {
  assert.match(html, /РАСТИ ВСЕКИ ДЕН/);
  assert.doesNotMatch(html, /YOUR NEXT LEVEL/);
});
test('PWA has valid standalone metadata and icons', () => {
  assert.equal(manifest.lang, 'bg');
  assert.equal(manifest.display, 'standalone');
  for (const i of manifest.icons) assert.ok(fs.existsSync(i.src));
});

test('Mobile navigation is above the main content in document order', () => {
  assert.ok(html.indexOf('id="mobile-nav"') < html.indexOf('id="app"'));
  assert.equal((html.match(/id="mobile-nav"/g) || []).length, 1);
});

test('v0.2.9 keeps app modules offline and caches media as it is viewed',()=>{
 const artPos=html.indexOf('<script src="exercise-art.js"></script>');
 const dataPos=html.indexOf('<script src="data.js"></script>');
 assert.ok(artPos>=0&&artPos<dataPos);
 assert.ok(sw.includes('forme-mobile-v029-i18n2'));
 assert.ok(sw.includes('exercise-art.js'));
 assert.ok(sw.includes('progress.js'));
 assert.ok(sw.includes('programs.js'));
 assert.ok(sw.includes('storage-schema.js'));
 assert.ok(sw.includes('nutrition-journal.js'));
 assert.ok(sw.includes('backup.js'));
 assert.ok(sw.includes('forme-media-v029'));
 assert.ok(sw.includes('cache.put(event.request, response.clone())'));
 assert.ok(fs.existsSync('exercise-art.js'));
});
