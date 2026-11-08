const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(page,language='bg'){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const storage=language==='bg'?{}:{'forme-language':language};
 const c={window:{addEventListener(){},scrollTo(){}},document,localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}},location:{hash:page},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js','state-normalizer.js','storage-schema.js','progress.js','programs.js','nutrition-journal.js','backup.js','app.js'])
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

const screens=['#home','#sessions','#exercises','#nutrition','#plan','#progress','#favorites'];

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
  ['#exercises',{action:'exercise-detail',id:'Plank'}],
  ['#nutrition',{action:'food-detail',id:'rice'}]
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
