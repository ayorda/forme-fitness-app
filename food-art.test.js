const {test}=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const vm=require('node:vm');
const context={window:{}}; vm.createContext(context); vm.runInContext(fs.readFileSync('data.js','utf8'),context);vm.runInContext(fs.readFileSync('food-art.js','utf8'),context);
const {foods}=context.window.FORME_DATA, art=context.window.FORME_FOOD_ART;
test('30 foods have a precise USDA FDC reference and condition',()=>{
 assert.equal(foods.length,30); assert.equal(new Set(foods.map(f=>f.fdcId)).size,30);
 foods.forEach(f=>{assert.match(f.source, /query=\d{6,}/);assert.match(f.sourceDetails,/foods\/\d{6,}/);assert.ok(f.state&&f.fdcId);});
});
test('30 individual, accessible original vector illustrations',()=>{
 assert.equal(art.ids.length,30);
 foods.forEach(f=>{const svg=art.render(f);assert.match(svg,/^<svg/);assert.match(svg,/<\/svg>$/);assert.match(svg,/role="img"/);assert.match(svg,/aria-label=/);assert.ok(svg.length>250);});
});
test('reference chicken and cooked rice meal total remains 435 kcal',()=>{
 const chicken=foods.find(f=>f.id==='chicken'),rice=foods.find(f=>f.id==='rice');
 assert.equal(chicken.kcal*2+rice.kcal*1.5,435); assert.match(rice.state,/сварен/);
});
test('static plank illustration displays a correct forearm plank instead of starting kneel',()=>{
 const p=context.window.FORME_DATA.exercises.find(x=>x.id==='Plank');
 assert.ok(p.photo.endsWith('/Plank/1.jpg'));assert.ok(p.photo2.endsWith('/Plank/1.jpg'));
});