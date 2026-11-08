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
