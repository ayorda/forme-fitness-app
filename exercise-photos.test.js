const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('media/manifest.json','utf8'));
const context={window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}};vm.createContext(context);
for(const file of ['data.js','exercise-photos.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});

test('all 49 exercises have distinct compressed local WebP variants with provenance',()=>{
 const exercises=context.window.FORME_DATA.exercises,photos=context.window.FORME_EXERCISE_PHOTOS;
 assert.equal(exercises.length,49);assert.equal(photos.ids.length,49);
 for(const item of exercises){const photo=photos.get(item.id),record=manifest.entries.find(x=>x.kind==='exercise'&&x.id===item.id);
  assert.equal(photo.origin,'ai');assert.ok(record);assert.equal(record.tool,'OpenAI image generation tool');assert.match(record.usage,/OpenAI Terms/);
  for(const [size,path] of [['mobile',photo.small],['desktop',photo.large]]){const bytes=fs.readFileSync(path);assert.match(path,/\.webp$/);assert.ok(bytes.length<150_000,`${item.id} ${size} exceeds budget`);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.variants[size].sha256);assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt16LE(26)&0x3fff,size==='mobile'?480:960);assert.equal(bytes.readUInt16LE(28)&0x3fff,size==='mobile'?320:640);}
 }
 assert.equal(photos.get('constructor'),null);
});

test('eleven replacements bind the accepted source, final bytes and individual pose review',()=>{
 const review=JSON.parse(fs.readFileSync('qa/exercise-image-review-v3.json','utf8'));
 assert.equal(review.corrections.length,11);
 for(const record of review.corrections){
  const entry=manifest.entries.find(e=>e.kind==='exercise'&&e.id===record.id);
  const photo=context.window.FORME_EXERCISE_PHOTOS.get(record.id);
  assert.equal(record.status,'accepted-visual');
  for(const category of ['anatomy','exactMatch','style'])assert.equal(record[category].status,'accepted');
  const exercise=context.window.FORME_DATA.exercises.find(e=>e.id===record.id);
  const actual=Object.fromEntries(['id','name','level','equip','description','steps','easier','defaultMetric'].map(k=>[k,exercise[k]]));
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),record.exactMatch.catalogue);
  const policy=JSON.parse(fs.readFileSync('qa/exercise-image-contracts.json','utf8')).exercises.find(e=>e.id===record.id);
  assert.equal(record.exactMatch.phase,policy.phase);assert.equal(record.exactMatch.observedEquipment,exercise.equip);
  assert.deepEqual(Object.keys(record.exactMatch.criteria).sort(),Object.keys(policy.requiredVisible).sort());
  assert.ok(Object.values(record.exactMatch.criteria).every(c=>c.passed===true&&c.observation.length>20));
  assert.deepEqual(record.observedLimbs,{arms:2,hands:2,legs:2,feet:2});
  assert.equal(Object.keys(record.checks).length,9);
  assert.ok(Object.values(record.checks).every(v=>v===true));
  assert.ok(record.poseNotes.length>80);
  assert.equal(entry.review.sourceSha256,record.sourceSha256);
  assert.match(record.sourceSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(entry.variants.desktop.sha256,record.oldDesktopSha256);
  assert.equal(photo.created,'2026-11-17');
  for(const [size,width,path] of [['mobile',480,photo.small],['desktop',960,photo.large]]){
   assert.equal(path,`media/exercises/${record.id}-anatomy-v3-${width}.webp`);
   assert.equal(entry.variants[size].sha256,record.variants[String(width)].sha256);
  }
 }
 assert.equal(review.rejectedCandidates.length,2);
 for(const rejected of review.rejectedCandidates){
  assert.ok(!review.corrections.some(r=>r.sourceSha256===rejected.sourceSha256));
  assert.ok(rejected.reason.length>20);
 }
});

test('all 49 entries were audited and the other 38 images stay unchanged',()=>{
 const review=JSON.parse(fs.readFileSync('qa/exercise-image-review-v3.json','utf8'));
 assert.equal(review.catalogueAudit.length,49);
 assert.equal(new Set(review.catalogueAudit.map(r=>r.id)).size,49);
 let kept=0;
 for(const record of review.catalogueAudit){
  const entry=manifest.entries.find(e=>e.kind==='exercise'&&e.id===record.id);
  assert.ok(entry);
  if(record.result==='replaced-strict-pass')continue;
  kept++;
  assert.equal(entry.variants.desktop.sha256,record.auditedDesktopSha256);
  assert.equal(entry.variants.mobile.sha256,record.auditedVariants.mobile);
  assert.equal(entry.variants.desktop.sha256,record.auditedVariants.desktop);
 }
 assert.equal(kept,38);
});

test('retired defective assets are absent and evicted without prefetching replacements',()=>{
 const review=JSON.parse(fs.readFileSync('qa/exercise-image-review-v3.json','utf8'));
 const sw=fs.readFileSync('service-worker.js','utf8');
 const refresh=sw.match(/const REFRESHED_MEDIA = (\[[^;]+\]);/)[1];
 const assets=sw.match(/const ASSETS = (\[[^;]+\]);/)[1];
 for(const record of review.corrections)for(const old of record.oldPaths){
  assert.equal(fs.existsSync(old),false);
  assert.ok(refresh.includes(old));
  assert.ok(!assets.includes(`${record.id}-anatomy-v2`));
 }
 assert.match(fs.readFileSync('index.html','utf8'),/exercise-photos\.js\?v=0155/);
 assert.ok(assets.includes('exercise-photos.js?v=0155'));
 assert.match(fs.readFileSync('styles.css','utf8'),/\.photo-visual picture img\{object-fit:contain\}/);
 assert.match(fs.readFileSync('styles.css','utf8'),/\.modal-visual:has\(\.photo-visual\)\{height:auto;aspect-ratio:3\/2\}/);
});
