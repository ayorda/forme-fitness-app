const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function createApp(saved={},translated=false,page='#exercises',withData=false){
 const handlers={},nodes={},storage={...saved};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 const files=['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js'];if(translated)files.push('i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js');if(withData)files.push('state-normalizer.js','progress.js','backup.js','skill-trees.js');files.push('app.js');
 for(const f of files)vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {handlers,nodes,storage,data:window.FORME_DATA,window,localStorage};
}

test('retired Handstand Push-Ups has no active catalogue, image, detail or workout selector',()=>{
 const a=createApp({},true,'#exercises',true);
 assert.equal(a.data.exercises.length,48);
 assert.ok(a.data.exercises.some(e=>e.id==='Handstand'));
 assert.ok(!a.data.exercises.some(e=>e.id==='Handstand_Pushups'));
 assert.equal(a.window.FORME_EXERCISE_PHOTOS.get('Handstand_Pushups'),null);
 assert.deepEqual(JSON.parse(JSON.stringify(a.data.retiredExercises.map(e=>e.id))),['Handstand_Pushups']);
 assert.doesNotMatch(a.nodes['exercise-results'].innerHTML,/data-id="Handstand_Pushups"/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Handstand_Pushups'}})}});
 assert.equal(a.nodes['modal-root'].innerHTML,'');
 a.handlers.click({target:{closest:()=>({dataset:{action:'nav',page:'progress'}})}});
 assert.doesNotMatch(a.nodes.app.innerHTML,/<option[^>]+value="Handstand_Pushups"/);
});

test('hidden retired favorite survives active favorite edits and archive export without restoring a card',()=>{
 const raw=JSON.stringify({exercises:['Handstand_Pushups'],workouts:[]});
 const a=createApp({'forme-favorites':raw},true,'#favorites',true);
 assert.doesNotMatch(a.nodes.app.innerHTML,/data-id="Handstand_Pushups"/);
 assert.equal(a.storage['forme-favorites'],raw);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Plank'}})}});
 assert.deepEqual(JSON.parse(a.storage['forme-favorites']).exercises,['Handstand_Pushups','Plank']);
 const before=a.storage['forme-favorites'];
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Handstand_Pushups'}})}});
 assert.equal(a.storage['forme-favorites'],before);
 const archive=JSON.parse(a.window.FORME_BACKUP.exportData(a.localStorage));
 assert.ok(JSON.parse(archive.data['forme-favorites']).exercises.includes('Handstand_Pushups'));
});

test('legacy retired sets remain readable in three languages and are exported unchanged without replay links',()=>{
 const progress={version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'legacy-hspu-1',exerciseId:'Handstand_Pushups',date:'2026-11-20',kind:'reps',value:5,weightKg:2}]};
 for(const [lang,title] of [['bg','Лицеви опори от стойка на ръце'],['en','Handstand Push-Ups'],['de','Handstand-Liegestütze']]){
  const raw=JSON.stringify(progress),a=createApp({'forme-language':lang,'forme-progress-v1':raw},true,'#progress',true);
  assert.ok(a.nodes.app.innerHTML.includes(title),lang+' retired history title');
  assert.doesNotMatch(a.nodes.app.innerHTML,/data-id="Handstand_Pushups"|<option[^>]+value="Handstand_Pushups"/);
  assert.equal(a.storage['forme-progress-v1'],raw);
  const archive=JSON.parse(a.window.FORME_BACKUP.exportData(a.localStorage));
  assert.deepEqual(JSON.parse(archive.data['forme-progress-v1']).sets,progress.sets);
 }
});

test('retirement leaves saved plans unchanged and removes all active skill-tree and media bindings',()=>{
 const plan=JSON.stringify({mon:'cal-start'}),dated=JSON.stringify({'2026-11-26':'cal-start'});
 const a=createApp({'forme-plan':plan,'forme-date-plans':dated},true,'#plan',true);
 assert.equal(a.storage['forme-plan'],plan);assert.equal(a.storage['forme-date-plans'],dated);
 for(const w of a.data.workouts)assert.ok(!w.ids.includes('Handstand_Pushups'));
 for(const tree of a.window.FORME_SKILL_TREES.localized('en'))assert.ok(!tree.relatedExerciseIds.includes('Handstand_Pushups'));
 const retired=JSON.parse(fs.readFileSync('qa/exercise-retirements.json','utf8')).retired;
 assert.deepEqual(retired.map(r=>r.id),['Handstand_Pushups']);
 const media=JSON.parse(fs.readFileSync('media/manifest.json','utf8'));
 assert.ok(!media.entries.some(e=>e.kind==='exercise'&&e.id==='Handstand_Pushups'));
 for(const path of retired[0].oldPaths){assert.equal(fs.existsSync(path),false);assert.ok(fs.readFileSync('service-worker.js','utf8').includes(path));}
});
test('catalog searches by English name and shows honest missing-media placeholder',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Iron Cross'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Железен кръст/);assert.match(html,/media\/exercises\/Iron_Cross-480.webp/);assert.match(html,/AI визуализация/);
});
test('each workout card has a distinct emoji, with the requested calisthenics symbols',()=>{
 const app=createApp({},false,'#sessions');
 const glyphs=[...app.nodes['workout-results'].innerHTML.matchAll(/<div class="glyph" aria-hidden="true">([^<]+)<\/div>/g)].map(match=>match[1]);
 assert.equal(glyphs.length,6);
 assert.equal(new Set(glyphs).size,6);
 app.handlers.input({target:{dataset:{filter:'workouts',key:'cat'},value:'cal'}});
 const calisthenics=[...app.nodes['workout-results'].innerHTML.matchAll(/<div class="glyph" aria-hidden="true">([^<]+)<\/div>/g)].map(match=>match[1]);
 assert.deepEqual(calisthenics,['🤸‍♂️','💪']);
});
test('all exercises have a movement-appropriate default set metric',()=>{
 const exercises=createApp().data.exercises;
 assert.equal(exercises.length,48);
 assert.ok(exercises.every(x=>['reps','seconds'].includes(x.defaultMetric)));
 assert.equal(exercises.filter(x=>x.defaultMetric==='seconds').length,24);
 for(const exercise of exercises.filter(x=>x.measure))assert.equal(exercise.defaultMetric,exercise.measure.startsWith('Секунди')?'seconds':'reps',exercise.id);
 for(const id of ['Plank','Side_Bridge','Hollow_Body_Hold','Handstand','Full_Planche','Childs_Pose','Shoulder_Stretch'])assert.equal(exercises.find(x=>x.id===id).defaultMetric,'seconds',id);
 for(const id of ['Pushups','Pullups','Bodyweight_Squat','Cat_Stretch','Arm_Circles'])assert.equal(exercises.find(x=>x.id===id).defaultMetric,'reps',id);
});
test('exercise media is described as an AI visualisation',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Планк'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Визуализация и инструкции/);
 assert.match(html,/AI визуализация/);
});
test('new exercise details show requirements and can be saved as favorite',()=>{
 const a=createApp();
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Iron_Cross'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/Преди да започнеш/);assert.match(a.nodes['modal-root'].innerHTML,/квалифициран треньор/);
 assert.match(a.nodes['modal-root'].innerHTML,/Видео демонстрацията предстои/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Iron_Cross'}})}});
 assert.ok(JSON.parse(a.storage['forme-favorites']).exercises.includes('Iron_Cross'));
 const b=createApp(a.storage);assert.match(b.nodes['exercise-results'].innerHTML,/Премахни от любими/);
});

test('squat uses its reviewed local AI image, not the inaccurate old drawing',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Клек със собствено тегло'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Bodyweight_Squat-480.webp/);assert.match(html,/AI визуализация/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Bodyweight_Squat'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/Как се изпълнява/);
 assert.match(a.nodes['modal-root'].innerHTML,/Bodyweight_Squat-960.webp/);
});
test('translated exercise search keeps stable IDs and preserves Bulgarian default',()=>{
 for(const [language,name] of [['en','Pull-Ups'],['de','Klimmzüge im Obergriff']]){
  const a=createApp({'forme-language':language},true);
  a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:name}});
  const html=a.nodes['exercise-results'].innerHTML;
  assert.match(html,/data-id="Pullups"/);assert.ok(html.includes(name));assert.match(a.nodes.app.innerHTML,language==='en'?/Search exercises/:/Übung suchen/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Pullups'}})}});
  assert.ok(a.nodes['modal-root'].innerHTML.includes(name));
  assert.match(a.nodes['modal-root'].innerHTML,/<video controls playsinline preload="none"/);
  assert.match(a.nodes['modal-root'].innerHTML,language==='en'?/Use an overhand grip/:/Greife im Obergriff/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Pullups'}})}});
  assert.match(a.nodes.toast.textContent,language==='en'?/Added to favorites/:/Zu Favoriten hinzugefügt/);
  assert.ok(JSON.parse(a.storage['forme-favorites']).exercises.includes('Pullups'));
 }
 const bg=createApp();assert.match(bg.nodes.app.innerHTML,/Търси упражнение/);
});
test('translated food search keeps the USDA nutrient values and stable food IDs',()=>{
 for(const [language,name] of [['en','Turkey breast'],['de','Putenbrust']]){
  const a=createApp({'forme-language':language},true,'#nutrition');
  assert.match(a.nodes.app.innerHTML,language==='en'?/Raw and cooked weights are not interchangeable/:/Rohes und gegartes Gewicht sind nicht austauschbar/);
  a.handlers.input({target:{dataset:{filter:'foods',key:'q'},value:name}});
  const html=a.nodes['food-results'].innerHTML;
  assert.ok(html.includes(name));assert.match(html,/data-id="turkey"/);assert.match(html,/<strong>114<\/strong> kcal/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-detail',id:'turkey'}})}});
  const detail=a.nodes['modal-root'].innerHTML;
  assert.ok(detail.includes(name));assert.match(detail,/114 kcal/);
  assert.match(detail,language==='en'?/<th>Nutrient<\/th>/:/<th>Nährwert<\/th>/);
  assert.match(detail,language==='en'?/23.7 g/:/23,7 g/);
 }
});
test('meal calculator uses translated food state while keeping the same total',()=>{
 for(const [language,name,state] of [['en','Turkey breast','raw, meat only'],['de','Putenbrust','roh, nur Fleisch']]){
  const a=createApp({'forme-language':language,'forme-current-meal':JSON.stringify([{id:'turkey',grams:'100'}])},true,'#nutrition');
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'meal'}})}});
  assert.ok(a.nodes.app.innerHTML.includes(name+' · '+state));
  assert.match(a.nodes.app.innerHTML,/114 <span>kcal<\/span>/);
  assert.match(a.nodes.app.innerHTML,/data-index="0"/);
 }
});
test('weekly plan shows localized workout names without changing saved IDs',()=>{
 for(const [language,heading,workout] of [['en','My weekly plan','Strong Foundation'],['de','Mein Wochenplan','Starke Grundlage']]){
  const saved=JSON.stringify({mon:'cal-start'}),a=createApp({'forme-language':language,'forme-plan':saved},true,'#plan');
  assert.ok(a.nodes.app.innerHTML.includes(heading));assert.ok(a.nodes.app.innerHTML.includes(workout));
  assert.match(a.nodes.app.innerHTML,/value="cal-start" selected/);assert.equal(a.storage['forme-plan'],saved);
 }
});
test('food imagery is labeled as AI while nutrient state remains visible in each language',()=>{
 for(const [language,notice,state] of [['en','AI-generated visualisation','cooked, without salt'],['de','KI-generierte Visualisierung','gekocht, ohne Salz']]){
  const a=createApp({'forme-language':language},true,'#nutrition');
  a.handlers.input({target:{dataset:{filter:'foods',key:'q'},value:language==='en'?'Lentils':'Linsen'}});
  assert.ok(a.nodes['food-results'].innerHTML.includes(language==='en'?'AI visualisation':'KI-Visualisierung'));
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-detail',id:'lentils'}})}});
  assert.ok(a.nodes['modal-root'].innerHTML.includes(notice));
  assert.ok(a.nodes['modal-root'].innerHTML.includes(state));
 }
});
test('workout detail preview lists included exercises with muscles and opens complete yoga/mobility details',()=>{
 for(const [language,workoutTitle,childName,musclesHeading] of [
  ['bg','Спокойно възстановяване','Поза на детето','Основни мускули'],
  ['en','Calm Recovery','Child’s Pose','Main muscles'],
  ['de','Ruhige Erholung','Kindhaltung','Hauptmuskeln']
 ]){
  const a=createApp({'forme-language':language},true,'#sessions');
  a.handlers.click({target:{closest:()=>({dataset:{action:'workout-detail',id:'yoga-reset'}})}});
  const modal=a.nodes['modal-root'].innerHTML;
  assert.ok(modal.includes(workoutTitle),language+' workout title');
  assert.ok(modal.includes(childName),language+' exercise in workout');
  assert.match(modal,/data-action="start-workout" data-id="yoga-reset"/);
  a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Childs_Pose'}})}});
  const detail=a.nodes['modal-root'].innerHTML;
  assert.ok(detail.includes(musclesHeading),language+' yoga muscles heading');
  assert.ok(detail.includes('→'),language+' yoga progression arrow');
 }
});

test('exercise details link back to parent workouts, return to a previewed workout, and jump straight to set logging with the right metric',()=>{
 const a=createApp({},true,'#sessions');
 a.handlers.click({target:{closest:()=>({dataset:{action:'workout-detail',id:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/data-action="exercise-detail" data-id="Plank" data-from-workout="cal-start"/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Plank',fromWorkout:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/modal-back" data-action="workout-detail" data-id="cal-start">← Силна основа/);
 assert.match(a.nodes['modal-root'].innerHTML,/Включено в тренировки/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'workout-detail',id:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/<h2>Силна основа<\/h2>/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Plank',fromWorkout:'cal-start'}})}});
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-log-set',id:'Plank'}})}});
 assert.equal(a.nodes['modal-root'].innerHTML,'');
 assert.match(a.nodes.app.innerHTML,/value="Plank" selected/);
 assert.match(a.nodes.app.innerHTML,/value="seconds" selected/);
 assert.match(a.nodes.app.innerHTML,/id="set-value"[^>]*value="30"/);
});

test('workout and exercise detail modals expose item-named dialogs and toggle favorites in place',()=>{
 const a=createApp({},true,'#sessions');
 a.handlers.click({target:{closest:()=>({dataset:{action:'workout-detail',id:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/role="dialog" aria-modal="true" aria-label="Силна основа"/);
 assert.match(a.nodes['modal-root'].innerHTML,/data-action="favorite" data-kind="workouts" data-id="cal-start" aria-pressed="false"/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'workouts',id:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/data-action="favorite" data-kind="workouts" data-id="cal-start" aria-pressed="true"/);

 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Plank',fromWorkout:'cal-start'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/role="dialog" aria-modal="true" aria-label="Планк"/);
 assert.match(a.nodes['modal-root'].innerHTML,/data-action="favorite" data-kind="exercises" data-id="Plank" aria-pressed="false"/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Plank'}})}});
 assert.match(a.nodes['modal-root'].innerHTML,/data-action="favorite" data-kind="exercises" data-id="Plank" aria-pressed="true"/);
});

test('exercise search still matches original Bulgarian names when switched to English or German',()=>{
 for(const language of ['en','de']){
  const a=createApp({'forme-language':language},true,'#exercises');
  a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Набирания'}});
  assert.match(a.nodes['exercise-results'].innerHTML,/data-id="Pullups"/);
 }
});

