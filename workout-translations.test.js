const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['exercise-art.js','data.js','workout-translations.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
test('all existing workouts have English and German names, tags and descriptions',()=>{
 for(const workout of context.window.FORME_DATA.workouts)for(const language of ['en','de']){
  const translated=context.window.FORME_WORKOUT_TRANSLATIONS.get(workout.id,language);assert.ok(translated,workout.id+' '+language);
  for(const field of ['name','tag','desc'])assert.ok(typeof translated[field]==='string'&&translated[field].trim(),workout.id+' '+language+' '+field);
 }
});
test('unknown workouts and unfinished languages return no translation',()=>{
 assert.equal(context.window.FORME_WORKOUT_TRANSLATIONS.get('missing','en'),null);
 assert.equal(context.window.FORME_WORKOUT_TRANSLATIONS.get('cal-start','fr'),null);
});
