const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const translations = fs.readFileSync('interface-translations.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const demo = fs.readFileSync('DEMO.md', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');

function appVersion() {
  const row = translations.match(/'shell\.version':\[([^\]]+)\]/);
  assert.ok(row, 'shell.version row exists in interface-translations.js');
  const found = [...row[1].matchAll(/v\d+\.\d+\.\d+/g)].map(m => m[0]);
  assert.equal(found.length, 3, 'each of the three languages states the version');
  assert.equal(new Set(found).size, 1, 'all three languages agree on the version');
  return found[0];
}

test('all three languages of shell.version state the same version', () => {
  appVersion();
});

test('README, DEMO and the index.html fallback match shell.version', () => {
  const version = appVersion();
  const escaped = version.replace(/\./g, '\\.');
  assert.match(readme, new RegExp(`Публична версия:\\*\\* ${escaped}`), 'README public version');
  assert.match(demo, new RegExp(`\\*\\*Версия:\\*\\* ${escaped}`), 'DEMO header version');
  const fallback = html.match(/data-i18n="shell\.version">([^<]*)</);
  assert.ok(fallback, 'index.html sidebar renders shell.version');
  assert.ok(fallback[1].startsWith(version), `inline fallback "${fallback[1]}" starts with ${version}`);
});

test('the shell cache name carries the current version segment', () => {
  const version = appVersion();
  const segment = 'v' + version.slice(1).replace(/\./g, ''); // v0.3.1 -> v031
  const cache = sw.match(/const CACHE = '([^']+)'/);
  assert.ok(cache, 'service worker declares CACHE');
  assert.ok(
    cache[1].includes(segment),
    `cache name "${cache[1]}" contains the version segment "${segment}" so installed PWAs receive version updates`
  );
});
