const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['exercise-art.js','data.js','exercise-translations.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const required=['Pushups','Pullups','Chinups','Bodyweight_Squat','Parallel_Bar_Dips','Australian_Rows','Hollow_Body_Hold','Plank','Hanging_Leg_Raise','Frog_Stand','Pike_Pushups','Skin_the_Cat','Toes_to_Bar','Archer_Pushups','Pistol_Squat','L_Sit','Dragon_Flag','Handstand','Tuck_Planche','Tuck_Front_Lever','Bar_Muscle_Up','Ring_Muscle_Up','Back_Lever','Human_Flag','Handstand_Pushups','Front_Lever','Straddle_Planche','Full_Planche','One_Arm_Pull_Up','Iron_Cross'];
test('the 30 requested exercises have English and German training details',()=>{
 const exercises=context.window.FORME_DATA.exercises;
 for(const id of required){const original=exercises.find(e=>e.id===id);assert.equal(exercises.filter(e=>e.id===id).length,1,id);for(const lang of ['en','de']){const translated=context.window.FORME_EXERCISE_TRANSLATIONS.get(id,lang);assert.ok(translated,id+' '+lang);for(const field of ['name','description','steps','easier','muscles','prerequisites','commonMistakes','harder','measure','progression'])assert.ok(typeof translated[field]==='string'&&translated[field].trim(),id+' '+lang+' '+field);assert.equal(Boolean(translated.caution),Boolean(original.caution),id+' '+lang+' caution');}}
});
test('unfinished languages and exercises do not masquerade as translated content',()=>{
 assert.equal(context.window.FORME_EXERCISE_TRANSLATIONS.get('Pushups','fr'),null);
 assert.equal(context.window.FORME_EXERCISE_TRANSLATIONS.get('unknown','en'),null);
});
test('every existing exercise has a translated name, description, instructions and easier variant',()=>{
 for(const exercise of context.window.FORME_DATA.exercises)for(const lang of ['en','de']){
  const translated=context.window.FORME_EXERCISE_TRANSLATIONS.get(exercise.id,lang);
  assert.ok(translated,exercise.id+' '+lang);
  for(const field of ['name','description','steps','easier'])assert.ok(typeof translated[field]==='string'&&translated[field].trim(),exercise.id+' '+lang+' '+field);
 }
});
test('all 49 exercises across calisthenics, yoga and mobility have complete BG, EN and DE training metadata',()=>{
 const exercises=context.window.FORME_DATA.exercises;
 assert.equal(exercises.length,49);
 for(const exercise of exercises){
  for(const field of ['name','nameEn','nameDe','muscles','prerequisites','steps','commonMistakes','easier','harder','progression','measure'])
   assert.ok(typeof exercise[field]==='string'&&exercise[field].trim(),`${exercise.id} bg ${field}`);
  for(const lang of ['en','de']){
   const translated=context.window.FORME_EXERCISE_TRANSLATIONS.get(exercise.id,lang);
   assert.ok(translated,`${exercise.id} ${lang}`);
   for(const field of ['name','description','steps','easier','muscles','prerequisites','commonMistakes','harder','progression','measure'])
    assert.ok(typeof translated[field]==='string'&&translated[field].trim(),`${exercise.id} ${lang} ${field}`);
  }
 }
});
