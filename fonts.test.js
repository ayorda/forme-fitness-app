const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('media/fonts/manifest.json','utf8'));
const css=fs.readFileSync('styles.css','utf8'),html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('service-worker.js','utf8');

test('all shipped WOFF2 fonts and original OFL notices match their documented bytes',()=>{
 assert.equal(manifest.files.length,5);assert.equal(manifest.licenses.length,2);
 assert.equal(manifest.license,'SIL Open Font License 1.1');
 for(const file of [...manifest.files,...manifest.licenses]){
  const data=fs.readFileSync(file.src);assert.equal(data.length,file.bytes,file.src);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256,file.src);
  if(file.src.endsWith('.woff2')){assert.equal(data.subarray(0,4).toString(),'wOF2');assert.equal(data.readUInt32BE(8),data.length);assert.ok(data.readUInt16BE(12)>0);}
  else{assert.match(data.toString(),/SIL OPEN FONT LICENSE Version 1\.1/);assert.ok(data.toString().startsWith(file.copyright));assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+data.length+'\0'),data])).digest('hex'),file.upstreamBlob);}
 }
 assert.ok(manifest.files.reduce((n,f)=>n+f.bytes,0)<120000);
});

test('font styles preserve families and weights with local URLs, unicode ranges and visible fallback',()=>{
 assert.doesNotMatch(css,/@import|https?:\/\//);
 const faces=[...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];assert.equal(faces.length,5);
 for(const file of manifest.files){
  const face=faces.find(match=>match[1].includes(file.src));assert.ok(face,file.src);
  assert.ok(face[1].includes("font-family: '"+file.family+"'"));assert.ok(face[1].includes('font-weight: '+file.weights));
  assert.ok(face[1].includes('unicode-range: '+file.unicodeRange));assert.match(face[1],/font-display: swap/);
 }
 assert.match(css,/--font:'DM Sans',system-ui,-apple-system,sans-serif/);assert.match(css,/--display:'Space Grotesk',var\(--font\)/);
});

test('initial shell caches all five fonts, preloads only the two Latin faces, and versions CSS for legacy caches',()=>{
 for(const file of manifest.files)assert.ok(sw.includes("'./"+file.src+"'"));
 const preloads=[...html.matchAll(/<link rel="preload" ([^>]+)>/g)];assert.equal(preloads.length,2);
 for(const preload of preloads){assert.match(preload[1],/as="font" type="font\/woff2" crossorigin/);assert.match(preload[1],/-(?:latin)-v\d+\.woff2/);}
 const style=html.match(/rel="stylesheet" href="(styles\.css\?v=\d+)"/);assert.ok(style);assert.ok(sw.includes("'./"+style[1]+"'"));
 assert.doesNotMatch(html,/fonts\.googleapis\.com|fonts\.gstatic\.com/);
});
