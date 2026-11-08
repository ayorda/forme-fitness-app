const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const isTestFile=name=>name.endsWith('.test.js')||name==='test.js';

const sources=[
 ...fs.readdirSync('.')
  .filter(name=>name.endsWith('.js')&&!isTestFile(name))
  .map(name=>[name,fs.readFileSync(name,'utf8')]),
 ['index.html',fs.readFileSync('index.html','utf8')]
];
assert.ok(sources.length>=20,'sanity: production scripts plus the shell are scanned');

test('production code keeps no debug leftovers',()=>{
 const offenders=[];
 for(const [name,source] of sources)
  for(const m of source.matchAll(/\bconsole\.(?:log|debug|trace)\b|\bdebugger\b/g))
   offenders.push(`${name}: ${m[0]}`);
 assert.deepEqual(offenders,[],
  `remove debug leftovers before shipping: ${offenders.join(', ')}`);
});

test('production code uses no blocking browser dialogs',()=>{
 const offenders=[];
 for(const [name,source] of sources)
  for(const m of source.matchAll(/\b(?:alert|confirm|prompt)\s*\(/g))
   offenders.push(`${name}: ${m[0].trim()}`);
 assert.deepEqual(offenders,[],
  `blocking dialogs break the mobile flow — use the in-app UI instead: ${offenders.join(', ')}`);
});
