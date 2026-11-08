const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('media/manifest.json','utf8'));
const context={window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}};vm.createContext(context);
for(const file of ['data.js','food-photos.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});

test('all 30 foods have separate compact WebP images and documented preparation state',()=>{
 const foods=context.window.FORME_DATA.foods,photos=context.window.FORME_FOOD_PHOTOS;
 assert.equal(foods.length,30);assert.equal(photos.ids.length,30);
 for(const food of foods){const photo=photos.get(food.id),record=manifest.entries.find(x=>x.kind==='food'&&x.id===food.id);assert.ok(record);assert.equal(record.state,food.state);assert.equal(photo.origin,'ai');
  for(const [size,path] of [['mobile',photo.small],['desktop',photo.large]]){const bytes=fs.readFileSync(path);assert.match(path,/\.webp$/);assert.ok(bytes.length<150_000,`${food.id} ${size} exceeds budget`);assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt16LE(26)&0x3fff,size==='mobile'?480:960);assert.equal(bytes.readUInt16LE(28)&0x3fff,size==='mobile'?320:640);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.variants[size].sha256);}
 }
 assert.equal(photos.get('constructor'),null);
});
