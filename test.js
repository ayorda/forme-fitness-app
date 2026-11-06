const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./core.js');
const foods=[{id:'rice',kcal:130,protein:2.7,carbs:28.2,fat:.3,fiber:.4},{id:'egg',kcal:143,protein:12.56,carbs:.72,fat:9.51,fiber:0}];
test('100g gives reference values',()=>assert.equal(C.calculateForGrams(foods[0],100).kcal,130));
test('250g scales linearly',()=>assert.equal(C.calculateForGrams(foods[0],250).kcal,325));
test('meal combines values',()=>{const s=C.sumMeal([{id:'rice',grams:'200'},{id:'egg',grams:'50'}],foods);assert.equal(s.kcal,331.5);assert.equal(s.invalid,0)});
test('invalid grams rejected',()=>{for(const x of ['-50','abc','0','','10x','10001'])assert.equal(C.validateGrams(x).ok,false,x)});
test('comma decimal is supported',()=>assert.equal(C.validateGrams('125,5').grams,125.5));
test('invalid food is not counted',()=>{const s=C.sumMeal([{id:'rice',grams:'100'},{id:'egg',grams:'oops'}],foods);assert.equal(s.kcal,130);assert.equal(s.invalid,1)});
test('filters change workout suggestions',()=>{const ws=[{cat:'cal',level:'beginner',duration:12,equip:'none'},{cat:'yoga',level:'beginner',duration:20,equip:'mat'}];assert.equal(C.filterWorkouts(ws,{cat:'yoga'}).length,1);assert.equal(C.filterWorkouts(ws,{maxTime:'10'}).length,0);assert.equal(C.filterWorkouts(ws,{equip:'none'}).length,1)});
test('exercise search works',()=>{const es=[{name:'Планк',description:'Торс',steps:'',cat:'cal',level:'beginner',equip:'none'},{name:'Клек',description:'Крака',steps:'',cat:'cal',level:'beginner',equip:'none'}];assert.equal(C.filterExercises(es,{q:'планк'}).length,1);assert.equal(C.filterExercises(es,{q:'йога'}).length,0)});
test('timer display rounding',()=>{assert.equal(C.formatClock(60100),'01:01');assert.equal(C.formatClock(0),'00:00')});
const vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/exercise-art.js','utf8'),context);vm.runInNewContext(fs.readFileSync(__dirname+'/data.js','utf8'),context);
const D=context.window.FORME_DATA;
test('required dataset sizes and categories',()=>{assert.ok(D.exercises.length>=24);assert.ok(D.workouts.length>=6);assert.ok(D.foods.length>=30);for(const cat of ['cal','yoga','mobility'])assert.ok(D.workouts.some(w=>w.cat===cat))});
test('exercise illustrations have consistent licensed or original sources',()=>{
 const ids=new Set(D.exercises.map(e=>e.id));
 assert.equal(ids.size,D.exercises.length);
 for(const e of D.exercises){
  if(e.demoPending){assert.ok(e.name&&e.steps&&e.easier,e.id);assert.equal(e.photo,'');assert.equal(e.photo2,'');assert.equal(e.source,'');continue;}
  assert.ok(e.name&&e.steps&&e.easier&&e.source&&e.photo&&e.photo2&&e.artSource,e.id);
  if(e.artSource.startsWith('RepDB')){
   assert.match(e.photo,/^https:\/\/raw\.githubusercontent\.com\/RepDB\/exercise-dataset\/main\/images\/flat\//);
   assert.match(e.photo2,/^https:\/\/raw\.githubusercontent\.com\/RepDB\/exercise-dataset\/main\/images\/flat\//);
   assert.match(e.source,/^https:\/\/exercise-dataset\.com\/exercise\//);
  }else{
   assert.ok(e.photo.startsWith('data:image/svg+xml;charset=UTF-8,'),e.id);
   assert.equal(e.photo2,e.photo,e.id);
  }
 }
 assert.equal(D.exercises.filter(e=>e.artSource.startsWith('RepDB')).length,14);
 assert.equal(D.exercises.filter(e=>e.photo.startsWith('data:image/svg+xml')).length,10);
 assert.ok(!D.exercises.some(e=>/yuhonas\/free-exercise-db/.test(e.photo)));
});
test('all 30 requested movements have distinct entries and complete training context',()=>{
 const ids=['Pushups','Pullups','Chinups','Bodyweight_Squat','Parallel_Bar_Dips','Australian_Rows','Hollow_Body_Hold','Plank','Hanging_Leg_Raise','Frog_Stand','Pike_Pushups','Skin_the_Cat','Toes_to_Bar','Archer_Pushups','Pistol_Squat','L_Sit','Dragon_Flag','Handstand','Tuck_Planche','Tuck_Front_Lever','Bar_Muscle_Up','Ring_Muscle_Up','Back_Lever','Human_Flag','Handstand_Pushups','Front_Lever','Straddle_Planche','Full_Planche','One_Arm_Pull_Up','Iron_Cross'];
 assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);
 for(const id of ids){
  const matches=D.exercises.filter(x=>x.id===id);assert.equal(matches.length,1,id);const e=matches[0];assert.equal(e.cat,'cal');
  for(const field of ['name','nameEn','nameDe','level','equip','muscles','prerequisites','steps','commonMistakes','easier','harder','progression','measure'])assert.ok(e[field],`${id}: ${field}`);
  if(e.level==='advanced'||e.level==='elite')assert.ok(e.caution,id);
 }
 assert.equal(D.exercises.find(x=>x.id==='Parallel_Bar_Dips').equip,'parallel');
 for(const id of ['Full_Planche','One_Arm_Pull_Up','Iron_Cross'])assert.equal(D.exercises.find(x=>x.id===id).level,'elite');
 assert.ok(C.filterExercises(D.exercises,{q:'iron cross'}).some(e=>e.id==='Iron_Cross'));
 assert.ok(C.filterExercises(D.exercises,{q:'liegestütze'}).some(e=>e.id==='Pushups'));
 assert.ok(C.filterExercises(D.exercises,{level:'elite'}).some(e=>e.id==='Iron_Cross'));
});
test('workout references and approximate durations are consistent',()=>{for(const w of D.workouts){for(const id of w.ids)assert.ok(D.exercises.some(e=>e.id===id),id);const count=w.ids.length*w.rounds;const seconds=count*w.workSec+(count-1)*w.restSec;assert.ok(Math.abs(seconds/60-w.duration)<.6,`${w.id}: ${seconds/60} vs ${w.duration}`)}});
test('foods include states, macro data and source links',()=>{for(const f of D.foods){assert.ok(f.name&&f.state&&f.info&&f.source&&f.emoji,f.id);for(const k of ['kcal','protein','carbs','fat','fiber'])assert.ok(Number.isFinite(f[k])&&f[k]>=0,`${f.id}:${k}`)}});
