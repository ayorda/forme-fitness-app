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
  assert.match(sw, /new Request\(path, \{cache:'reload'\}\)/);
});
test('Mobile header is in Bulgarian', () => {
  assert.match(html, /РАСТИ ВСЕКИ ДЕН/);
  assert.doesNotMatch(html, /YOUR NEXT LEVEL/);
});
test('PWA has valid standalone metadata and icons', () => {
  assert.equal(manifest.lang, 'bg');
  assert.equal(manifest.display, 'standalone');
  for (const i of manifest.icons) assert.ok(fs.existsSync(i.src));
  assert.equal(manifest.shortcuts.length, 4);
  for (const s of manifest.shortcuts) {
    assert.match(s.url, /^\.\/index\.html#(sessions|nutrition|plan|progress)$/);
    for (const ic of s.icons) assert.ok(fs.existsSync(ic.src));
  }
});

test('Mobile navigation is above the main content in document order', () => {
  assert.ok(html.indexOf('id="mobile-nav"') < html.indexOf('id="app"'));
  assert.equal((html.match(/id="mobile-nav"/g) || []).length, 1);
});

test('every app module stays cached offline and viewed media is saved for reuse',()=>{
 const artPos=html.indexOf('<script src="exercise-art.js"></script>');
 const dataPos=html.indexOf('<script src="data.js"></script>');
 assert.ok(artPos>=0&&artPos<dataPos);
  assert.ok(sw.includes('forme-mobile-v0384-home6'));
 assert.ok(sw.includes('exercise-art.js'));
 assert.ok(sw.includes('progress.js'));
 assert.ok(sw.includes('programs.js'));
 assert.ok(sw.includes('storage-schema.js'));
 assert.ok(sw.includes('state-normalizer.js'));
 assert.ok(html.includes('<script src="state-normalizer.js"></script>'));
 assert.ok(sw.includes('nutrition-journal.js'));
 assert.ok(sw.includes('backup.js'));
 assert.ok(sw.includes('forme-media-v029-optimized'));
 assert.ok(sw.includes('banana-v2-480.webp')&&sw.includes('banana-v2-960.webp'));
 assert.ok(sw.includes('cache.put(event.request, response.clone())'));
 assert.ok(fs.existsSync('exercise-art.js'));
});

test('every local resource referenced by index.html or the manifest is precached', () => {
  const refs = [...html.matchAll(/<(?:script src|link rel="stylesheet" href|link rel="manifest" href|link rel="icon" href|link rel="apple-touch-icon" href)="([^"]+)"/g)].map(m => m[1]);
  for (const icon of manifest.icons) refs.push(icon.src);
  assert.ok(refs.length >= 23, `found ${refs.length} shell references`);
  for (const raw of refs) {
    const ref = raw.replace(/^\.\//, '');
    assert.ok(!ref.startsWith('http'), `local resource expected: ${ref}`);
    assert.ok(sw.includes(`'./${ref}'`), `${ref} referenced by the shell but missing from service worker ASSETS`);
  }
});

test('shell includes WCAG skip link and matches manifest theme_color', () => {
  assert.match(html, /<a class="skip-link" href="#app" data-i18n="shell\.skip">/);
  const metaTheme = html.match(/<meta name="theme-color" content="([^"]+)">/);
  assert.ok(metaTheme, 'index.html declares meta theme-color');
  assert.equal(metaTheme[1], manifest.theme_color);
});

test('stylesheet provides clean @media print rules hiding navigation chrome', () => {
  const css = fs.readFileSync('styles.css', 'utf8');
  assert.match(css, /@media print\{[\s\S]*\.sidebar,\.topbar,\.mobile-nav,\.skip-link,\.toast\{display:none!important\}/);
});
