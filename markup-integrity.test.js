const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(page,language='bg',extraStorage={}){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const storage={...(language==='bg'?{}:{'forme-language':language}),...extraStorage};
 const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}},location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','recovery.js','personalization.js','backup.js','auth-config.js','auth.js','skill-trees.js','app.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {nodes,handlers};
}

function collect(html,label,ids,problems){
 for(const m of html.matchAll(/ id="([^"]+)"/g)){
  if(ids.has(m[1]))problems.push(`duplicate id "${m[1]}" (${label})`);
  ids.add(m[1]);
 }
 for(const m of html.matchAll(/<img[^>]*>/g)){
  const alt=m[0].match(/alt="([^"]*)"/);
  if(!alt||!alt[1].trim())problems.push(`img without alt text (${label}): ${m[0].slice(0,90)}`);
 }
 for(const m of html.matchAll(/<a[^>]*target="_blank"[^>]*>/g))
  if(!/rel="[^"]*noopener/.test(m[0]))problems.push(`target="_blank" without noopener (${label})`);
 for(const m of html.matchAll(/<a[^>]*href="([^"]+)"/g))
  if(/^(javascript:|data:text)/.test(m[1]))problems.push(`unsafe href (${label}): ${m[1].slice(0,60)}`);
 for(const m of html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)){
  const open=m[0].slice(0,m[0].indexOf('>'));
  const text=m[1].replace(/<[^>]+>/g,'').trim();
  if(!text&&!/aria-label=/.test(open))problems.push(`button without accessible name (${label}): ${open.slice(0,90)}`);
 }
}

function checkLabels(html,label,ids,problems){
 for(const m of html.matchAll(/<label[^>]*for="([^"]+)"/g))
  if(!ids.has(m[1]))problems.push(`label points to missing id "${m[1]}" (${label})`);
}

function checkAll(fragments){
 const ids=new Set(),problems=[];
 for(const [label,html] of fragments)collect(html,label,ids,problems);
 for(const [label,html] of fragments)checkLabels(html,label,ids,problems);
 return problems;
}

const screens=['#home','#sessions','#exercises','#nutrition','#plan','#progress','#favorites','#recovery','#account'];

test('every screen keeps images, ids, labels, buttons and links accessible in all three languages',()=>{
 for(const language of ['bg','en','de']){
  for(const page of screens){
   const a=boot(page,language);
   const problems=checkAll([
    [`${language} ${page} page`,a.nodes.app.innerHTML],
    [`${language} ${page} workouts`,a.nodes['workout-results'].innerHTML],
    [`${language} ${page} exercises`,a.nodes['exercise-results'].innerHTML],
    [`${language} ${page} foods`,a.nodes['food-results'].innerHTML]
   ]);
   assert.deepEqual(problems,[],problems.join('; '));
  }
 }
});

test('exercise and food details keep the same guarantees while open over the page',()=>{
 const cases=[
  ['#sessions',{action:'workout-detail',id:'cal-start'}],
  ['#exercises',{action:'exercise-detail',id:'Plank'}],
  ['#nutrition',{action:'food-detail',id:'rice'}],
  ['#home',{action:'open-shortcuts',id:'shortcuts'}]
 ];
 for(const [page,action] of cases){
  const a=boot(page);
  a.handlers.click({target:{closest:()=>({dataset:action})}});
  const modal=a.nodes['modal-root'].innerHTML;
  assert.ok(modal.length>200,`${action.id} detail renders`);
  const problems=checkAll([
   [`${action.id} page under modal`,a.nodes.app.innerHTML],
   [`${action.id} modal`,modal]
  ]);
  assert.deepEqual(problems,[],problems.join('; '));
 }
});

test('the workout player keeps labelled settings and unique ids while running',()=>{
 const a=boot('#sessions');
 a.handlers.click({target:{closest:()=>({dataset:{action:'start-workout',id:'cal-start'}})}});
 const player=a.nodes['player-layout'].innerHTML;
 assert.ok(player.includes('work-seconds'),'player exposes its work setting');
 const problems=checkAll([
  ['sessions page under player',a.nodes.app.innerHTML],
  ['player',player]
 ]);
 assert.deepEqual(problems,[],problems.join('; '));
});

test('every WebP on disk is documented in the manifest and every documented file exists',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=`${dir}/${entry.name}`;
  return entry.isDirectory()?walk(path):[path];
 });
 const disk=walk('media').filter(path=>path.endsWith('.webp')).sort();
 const manifest=JSON.parse(fs.readFileSync('media/manifest.json','utf8'));
 const documented=new Set();
 for(const record of manifest.entries)
  for(const size of ['mobile','desktop'])documented.add(record.variants[size].path);
 const orphans=disk.filter(path=>!documented.has(path));
 const missing=[...documented].filter(path=>!disk.includes(path));
 assert.deepEqual(orphans,[],'files on disk without a manifest record');
 assert.deepEqual(missing,[],'manifest records without a file on disk');
 assert.equal(disk.length,158,'79 records keep both 480 and 960 variants');
});

test('populated nutrition sub-tabs, month calendar, progress history and favorites keep accessible markup in BG/EN/DE',()=>{
 const today=new Date();
 const y=today.getFullYear(),m=String(today.getMonth()+1).padStart(2,'0'),d=String(today.getDate()).padStart(2,'0'),todayKey=`${y}-${m}-${d}`;
 const populated={
  'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank','Pullups'],foods:['salmon']}),
  'forme-current-meal':JSON.stringify([{id:'chicken',grams:'150'},{id:'chicken',grams:'50'},{id:'rice',grams:'150'}]),
  'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'chicken',grams:'200'}]},{name:'Закуска',items:[{id:'oats',grams:'80'}]}]),
  'forme-plan':JSON.stringify({mon:'cal-start',wed:'yoga-reset'}),
  'forme-date-plans':JSON.stringify({[todayKey]:'cal-start'}),
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:{workoutsPerWeek:3,minutesPerWeek:90},
   sessions:[{id:'s1',workoutId:'cal-start',date:todayKey,minutes:15}],
   sets:[{id:'st1',exerciseId:'Plank',date:todayKey,kind:'seconds',value:60},{id:'st2',exerciseId:'Pullups',date:todayKey,kind:'reps',value:10}]
  }),
  'forme-nutrition-v1':JSON.stringify({
   version:1,
   goal:{kcal:2000,protein:100},
   entries:[{id:'n1',date:todayKey,name:'Обяд',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]
  })
 };
 for(const language of ['bg','en','de']){
  const nutr=boot('#nutrition',language,populated);
  for(const tab of ['meal','saved','journal']){
   nutr.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab}})}});
   const problems=checkAll([[`${language} nutrition:${tab}`,nutr.nodes.app.innerHTML]]);
   assert.deepEqual(problems,[],problems.join('; '));
  }
  const plan=boot('#plan',language,populated);
  plan.handlers.click({target:{closest:()=>({dataset:{action:'plan-view',view:'month'}})}});
  plan.handlers.click({target:{closest:()=>({dataset:{action:'plan-date',date:String(today.getDate())}})}});
  assert.deepEqual(checkAll([[`${language} plan:month`,plan.nodes.app.innerHTML]]),[]);

  const prog=boot('#progress',language,populated);
  prog.handlers.click({target:{closest:()=>({dataset:{action:'program-activate',id:'foundation'}})}});
  prog.handlers.click({target:{closest:()=>({dataset:{action:'nav',page:'progress'}})}});
  prog.handlers.click({target:{closest:()=>({dataset:{action:'backup-reset-ask'}})}});
  assert.deepEqual(checkAll([[`${language} progress:populated`,prog.nodes.app.innerHTML]]),[]);

  const favs=boot('#favorites',language,populated);
  assert.deepEqual(checkAll([[`${language} favorites:populated`,favs.nodes.app.innerHTML]]),[]);

  const ex=boot('#exercises',language,populated);
  ex.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Pullups'}})}});
  assert.deepEqual(checkAll([[`${language} exercises:page`,ex.nodes.app.innerHTML],[`${language} exercises:results`,ex.nodes['exercise-results'].innerHTML],[`${language} exercises:modal`,ex.nodes['modal-root'].innerHTML]]),[]);
 }
});

