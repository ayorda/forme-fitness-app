const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const context={window,document,localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#exercises'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 for(const file of ['exercise-art.js','data.js','exercise-photos.js','core.js','food-art.js','food-photos.js','app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return {window,nodes,handlers};
}

test('verified stills include credits while the pending motion demonstration stays pending',()=>{
 const {window,nodes,handlers}=boot();
 for(const [id,credit] of [['Pushups','Nenad Stojković'],['Bodyweight_Squat','Peterlocicero'],['Chinups','Deziree Keay'],['Pullups','Abooyeah'],['Parallel_Bar_Dips','Jahlena Riveraroyer'],['Bench_Dips','Kenneth Abbate'],['Bar_Muscle_Up','Maksim Sokolov'],['Human_Flag','Daniel Kaiser']]){
  const photo=window.FORME_EXERCISE_PHOTOS.get(id);assert.ok(photo.src.startsWith('https://'));assert.ok(photo.page.startsWith('https://commons.wikimedia.org/'));assert.ok(photo.licenseUrl.startsWith('https://'));
  handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id}})}});
  const html=nodes['modal-root'].innerHTML;
  assert.match(html,new RegExp(credit));assert.match(html,/Снимката показва един момент от движението/);assert.match(html,/Видео демонстрацията предстои/);assert.match(html,/Преоразмерена версия/);
 }
 handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Bodyweight_Squat'}})}});
 assert.match(nodes['modal-root'].innerHTML,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);
 assert.match(nodes['exercise-results'].innerHTML,/CC BY-SA 4.0/);
 assert.match(nodes['exercise-results'].innerHTML,/вариант с допълнителна тежест/);
 assert.equal(window.FORME_EXERCISE_PHOTOS.get('constructor'),null);
});

test('a failed still hides itself and leaves the original illustration or honest pending state',()=>{
 const {nodes}=boot(),html=nodes['exercise-results'].innerHTML;
 const img=html.match(/<img class="exercise-still"[^>]+>/)[0];
 assert.match(html,/<span class="exercise-still-tag" hidden>СНИМКА<\/span>/);
 const handler=img.match(/onerror="([^"]+)"/)[1];
 const still={hidden:false,nextElementSibling:{hidden:false}};Function(handler).call(still);
 assert.equal(still.hidden,true);assert.equal(still.nextElementSibling.hidden,true);
 assert.match(html,/ФАЗА 01/);
});
