const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('media/manifest.json','utf8'));
const currentReview=JSON.parse(fs.readFileSync('qa/exercise-image-review-v4.json','utf8'));
const currentIds=new Set(currentReview.corrections.map(r=>r.id));
const selection=JSON.parse(fs.readFileSync('qa/exercise-image-selection-v5.json','utf8'));
const selectedIds=new Set(selection.selections.map(r=>r.id));
const tuckSelection=JSON.parse(fs.readFileSync('qa/exercise-image-selection-v7.json','utf8'));
const tuck=tuckSelection.selections[0];
const retirements=JSON.parse(fs.readFileSync('qa/exercise-retirements.json','utf8'));
const retiredIds=new Set(retirements.retired.map(r=>r.id));
const context={window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}};vm.createContext(context);
for(const file of ['data.js','exercise-photos.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});

test('all 48 active exercises have distinct compressed local WebP variants with provenance',()=>{
 const exercises=context.window.FORME_DATA.exercises,photos=context.window.FORME_EXERCISE_PHOTOS;
 assert.equal(exercises.length,48);assert.equal(photos.ids.length,48);
 for(const item of exercises){const photo=photos.get(item.id),record=manifest.entries.find(x=>x.kind==='exercise'&&x.id===item.id);
  assert.equal(photo.origin,'ai');assert.ok(record);
  assert.equal(record.tool,selectedIds.has(item.id)||item.id===tuck.id?'Higgsfield / Nano Banana Pro':currentIds.has(item.id)?'Higgsfield / GPT Image 2.6':'OpenAI image generation tool');
  assert.equal(photo.generator,record.tool);
  assert.match(record.usage,currentIds.has(item.id)||item.id===tuck.id?/Higgsfield and model-provider terms/:/OpenAI Terms/);
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
  if(retiredIds.has(record.id)){assert.equal(entry,undefined);assert.equal(photo,null);continue;}
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
  if(record.id===tuck.id){
   assert.equal(record.supersededBy,'qa/exercise-image-selection-v7.json');
   assert.equal(tuck.oldDesktopSha256,record.variants['960'].sha256);
   continue; // Owner selected a later exact candidate; retain this historical review.
  }
  if(currentIds.has(record.id)){
   assert.equal(record.supersededBy,'qa/exercise-image-review-v4.json');
   const replacement=currentReview.corrections.find(r=>r.id===record.id);
   assert.equal(replacement.oldDesktopSha256,record.variants['960'].sha256);
   continue; // The earlier decision is historical, not acceptance of the current file.
  }
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
  if(retiredIds.has(record.id)){assert.equal(entry,undefined);continue;}
  assert.ok(entry);
  if(record.result==='replaced-strict-pass')continue;
  kept++;
  if(currentIds.has(record.id))continue; // Skin_the_Cat is superseded in the current five-image batch.
  assert.equal(entry.variants.desktop.sha256,record.auditedDesktopSha256);
  assert.equal(entry.variants.mobile.sha256,record.auditedVariants.mobile);
  assert.equal(entry.variants.desktop.sha256,record.auditedVariants.desktop);
 }
 assert.equal(kept,38);
});

test('retired defective assets are absent and evicted without prefetching replacements',()=>{
 const review=currentReview;
 const sw=fs.readFileSync('service-worker.js','utf8');
 const refresh=sw.match(/const REFRESHED_MEDIA = (\[[^;]+\]);/)[1];
 const assets=sw.match(/const ASSETS = (\[[^;]+\]);/)[1];
 for(const record of review.corrections)for(const old of record.oldPaths){
  assert.equal(fs.existsSync(old),false);
  assert.ok(refresh.includes(old));
  assert.ok(!assets.includes(`${record.id}-anatomy-v2`));
 }
 assert.match(fs.readFileSync('index.html','utf8'),/exercise-photos\.js\?v=0165/);
 assert.ok(assets.includes('exercise-photos.js?v=0165'));
 assert.match(fs.readFileSync('styles.css','utf8'),/\.photo-visual picture img\{object-fit:contain\}/);
 assert.match(fs.readFileSync('styles.css','utf8'),/\.modal-visual:has\(\.photo-visual\)\{height:auto;aspect-ratio:3\/2\}/);
});

test('five historical Higgsfield corrections retain provenance and the two unselected files remain current',()=>{
 assert.deepEqual([...currentIds].sort(),['Archer_Pushups','Handstand','Handstand_Pushups','Skin_the_Cat','Toes_to_Bar']);
 assert.equal(currentReview.totalGenerationCredits,7.5);
 for(const r of currentReview.corrections){
  const e=manifest.entries.find(e=>e.kind==='exercise'&&e.id===r.id),photo=context.window.FORME_EXERCISE_PHOTOS.get(r.id);
  if(retiredIds.has(r.id)){assert.equal(e,undefined);assert.equal(photo,null);continue;}
  assert.equal(r.revision,'higgsfield-v4');assert.equal(r.status,'accepted-visual');
  assert.deepEqual(r.observedLimbs,{arms:2,hands:2,legs:2,feet:2});
  for(const category of ['anatomy','exactMatch','style','styleLock'])assert.equal(r[category].status,'accepted');
  assert.deepEqual(Object.keys(r.styleLock.criteria).sort(),['background','colorLighting','composition','materials']);
  assert.ok(Object.values(r.styleLock.criteria).every(c=>c.passed&&c.observation.length>30));
  assert.equal(r.generation.platform,'Higgsfield');assert.equal(r.generation.model,'gpt_image_2_6');assert.equal(r.generation.status,'completed');
  assert.match(r.generation.jobId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(r.generation.referenceSha256,r.oldDesktopSha256);assert.equal(r.styleLock.referenceSha256,r.oldDesktopSha256);
  if(selectedIds.has(r.id)){
   assert.equal(r.supersededBy,'qa/exercise-image-selection-v5.json');
   const replacement=selection.selections.find(s=>s.id===r.id);
   assert.equal(replacement.oldDesktopSha256,r.variants['960'].sha256);
   continue; // Owner selection supersedes this historical acceptance, without rewriting it.
  }
  assert.equal(e.review.sourceSha256,r.sourceSha256);assert.equal(e.review.generation,r.generation.jobId);
  assert.equal(photo.created,'2026-11-25');
  const policy=JSON.parse(fs.readFileSync('qa/exercise-image-contracts.json','utf8')).exercises.find(e=>e.id===r.id);
  const actual=context.window.FORME_DATA.exercises.find(e=>e.id===r.id);
  for(const k of ['id','name','level','equip','description','steps','easier','defaultMetric'])assert.equal(r.exactMatch.catalogue[k],actual[k]);
  assert.equal(r.exactMatch.phase,policy.phase);assert.equal(r.exactMatch.observedEquipment,actual.equip);
  assert.deepEqual(Object.keys(r.exactMatch.criteria).sort(),Object.keys(policy.requiredVisible).sort());
  assert.ok(Object.values(r.exactMatch.criteria).every(c=>c.passed&&c.observation.length>20));
  assert.deepEqual(r.reviewedVariants,['source','480','960']);assert.ok(Object.values(r.checks).every(v=>v===true));
  for(const [size,width,path] of [['mobile',480,photo.small],['desktop',960,photo.large]]){
   assert.equal(path,`media/exercises/${r.id}-higgsfield-v4-${width}.webp`);
   assert.equal(e.variants[size].sha256,r.variants[String(width)].sha256);
  }
 }
 assert.equal(currentReview.rejectedCandidates.length,1);
 assert.ok(!currentReview.corrections.some(r=>r.generation.rawOutputSha256===currentReview.rejectedCandidates[0].sourceSha256));
});

test('only the three screenshot-selected originals are published, with exact raw and final hash bindings',()=>{
 assert.equal(selection.publicationDecision.approved,true);
 assert.equal(selection.publicationDecision.date,'2026-11-26');
 assert.equal(selection.additionalGenerationCredits,0);
 assert.deepEqual([...selectedIds].sort(),['Archer_Pushups','Handstand','Skin_the_Cat']);
 const jobs={Archer_Pushups:'376e40ad-d7dd-4885-a2a8-e505a178feca',Handstand:'bdc68ac4-0e09-4698-a2be-9cc6aa8f4530',Skin_the_Cat:'151ef460-43dc-41df-964f-6b68fad491b3'};
 for(const r of selection.selections){
  assert.equal(r.status,'owner-selected');assert.equal(r.generation.jobId,jobs[r.id]);
  assert.equal(r.generation.model,'nano_banana_pro');assert.equal(r.generation.status,'completed');
  assert.match(r.generation.rawOutputSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(r.observedLimbs,{arms:2,hands:2,legs:2,feet:2});
  assert.deepEqual(r.reviewedVariants,['source','480','960']);
  assert.ok(r.internalReview.notes.length>50);
  assert.notEqual(r.internalReview.status,'accepted-exact-reference');
  const e=manifest.entries.find(e=>e.kind==='exercise'&&e.id===r.id),photo=context.window.FORME_EXERCISE_PHOTOS.get(r.id);
  assert.equal(e.review.receipt,'qa/exercise-image-selection-v5.json');
  assert.equal(e.review.generation,r.generation.jobId);assert.equal(e.review.sourceSha256,r.sourceSha256);
  assert.equal(photo.created,'2026-11-26');
  for(const [size,width,path] of [['mobile',480,photo.small],['desktop',960,photo.large]]){
   assert.equal(path,`media/exercises/${r.id}-nano-v5-${width}.webp`);
   assert.equal(e.variants[size].sha256,r.variants[String(width)].sha256);
   const sw=fs.readFileSync('service-worker.js','utf8');
   assert.ok(!sw.match(/const ASSETS = (\[[^;]+\]);/)[1].includes(path));
  }
  for(const path of r.oldPaths){assert.equal(fs.existsSync(path),false);assert.ok(fs.readFileSync('service-worker.js','utf8').includes(path));}
 }
 assert.equal(selection.excludedCandidate.jobId,'053768d7-9c56-4e71-b9a5-331aa7566022');
 assert.equal(selection.excludedCandidate.published,false);
});

test('entries outside the owner selections match the earlier baseline exactly',()=>{
 let kept=0;
 for(const baseline of selection.baselineEntries){
  const e=manifest.entries.find(e=>e.kind===baseline.kind&&e.id===baseline.id);
  if(baseline.kind==='exercise'&&retiredIds.has(baseline.id)){assert.equal(e,undefined);continue;}
  if(baseline.kind==='exercise'&&(selectedIds.has(baseline.id)||baseline.id===tuck.id))continue;
  assert.deepEqual(e,baseline);
  if(baseline.kind==='exercise')kept++;
 }
 assert.equal(kept,44);
 assert.equal(manifest.entries.length,selection.baselineEntries.length-1);
});

test('the other 43 exercise entries are identical to the pre-Higgsfield baseline',()=>{
 assert.equal(currentReview.catalogueAudit.length,49);
 let unchanged=0;
 for(const baseline of currentReview.catalogueAudit){
  const e=manifest.entries.find(e=>e.kind==='exercise'&&e.id===baseline.id);
  if(retiredIds.has(baseline.id)){assert.equal(e,undefined);continue;}
  if(currentIds.has(baseline.id)){
   const r=currentReview.corrections.find(r=>r.id===baseline.id);
   assert.equal(r.oldDesktopSha256,baseline.baselineEntry.variants.desktop.sha256);
   assert.notEqual(e.variants.desktop.sha256,r.oldDesktopSha256);
  }else if(baseline.id===tuck.id){assert.equal(tuck.oldDesktopSha256,baseline.baselineEntry.variants.desktop.sha256);}
  else{assert.deepEqual(e,baseline.baselineEntry);unchanged++;}
 }
 assert.equal(unchanged,43);
});

test('the owner-approved Tuck image binds the selected original and preserves all other 47 exercises and 30 foods',()=>{
 assert.equal(tuckSelection.publicationDecision.approved,true);
 assert.equal(tuckSelection.publicationDecision.date,'2026-11-27');
 assert.equal(tuckSelection.additionalGenerationCredits,0);
 assert.equal(tuckSelection.selections.length,1);assert.equal(tuck.id,'Tuck_Front_Lever');
 assert.equal(tuck.status,'owner-selected');assert.equal(tuck.approval.approved,true);
 assert.equal(tuck.generation.jobId,'0afe6e3d-33e2-473b-b1ad-ffad5bc76600');
 assert.equal(tuck.generation.model,'nano_banana_pro');assert.equal(tuck.generation.status,'completed');
 assert.equal(tuck.generation.rawOutputSha256,'646f6b1f6b8fe804fcbc1b39c2e163b8474cbe07f1c6930f9a45d7e8a1ba9d68');
 assert.equal(tuck.sourceSha256,'ef9c194c557b5f42d55943b4da43fe7e773b2c4603b4e5a666ad28f33e18d5cf');
 assert.deepEqual(tuck.reviewedVariants,['source','480','960']);assert.match(tuck.internalReview.notes,/occlu/i);
 assert.equal(tuck.internalReview.pixelIdenticalBackground,false);
 const entry=manifest.entries.find(e=>e.kind==='exercise'&&e.id===tuck.id),photo=context.window.FORME_EXERCISE_PHOTOS.get(tuck.id);
 assert.equal(entry.review.receipt,'qa/exercise-image-selection-v7.json');assert.equal(entry.review.generation,tuck.generation.jobId);
 assert.equal(entry.review.sourceSha256,tuck.sourceSha256);assert.equal(photo.created,'2026-11-27');
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.FORME_DATA.exercises.find(e=>e.id===tuck.id))),tuck.catalogue);
 const sw=fs.readFileSync('service-worker.js','utf8'),assets=sw.match(/const ASSETS = (\[[^;]+\]);/)[1];
 for(const [size,width,path] of [['mobile',480,photo.small],['desktop',960,photo.large]]){
  assert.equal(path,`media/exercises/Tuck_Front_Lever-nano-v7-${width}.webp`);
  assert.equal(entry.variants[size].sha256,tuck.variants[String(width)].sha256);assert.ok(!assets.includes(path));
 }
 for(const path of tuck.oldPaths){assert.equal(fs.existsSync(path),false);assert.ok(sw.includes('./'+path));}
 let exercises=0,foods=0;
 for(const baseline of tuckSelection.baselineEntries){
  if(baseline.kind==='exercise'&&baseline.id===tuck.id)continue;
  assert.deepEqual(manifest.entries.find(e=>e.kind===baseline.kind&&e.id===baseline.id),baseline);
  if(baseline.kind==='exercise')exercises++;else if(baseline.kind==='food')foods++;
 }
 assert.equal(exercises,47);assert.equal(foods,30);
});
