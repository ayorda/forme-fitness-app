const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function createApp(saved={}){
 const handlers={},nodes={},storage={...saved};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash:'#exercises'},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);
 for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 return {handlers,nodes,storage};
}
test('catalog searches by English name and shows honest missing-media placeholder',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Iron Cross'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Железен кръст/);assert.match(html,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(html,/<img[^>]+src=""/);
});
test('existing drawn exercise media is described as illustration rather than photography',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Планк'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Илюстрации и инструкции/);
 assert.doesNotMatch(html,/Снимки и инструкции/);
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

test('squat withholds its inaccurate illustration until a verified demonstration is available',()=>{
 const a=createApp();
 a.handlers.input({target:{dataset:{filter:'exercises',key:'q'},value:'Клек със собствено тегло'}});
 const html=a.nodes['exercise-results'].innerHTML;
 assert.match(html,/Клек със собствено тегло/);assert.match(html,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(html,/bodyweight-squat/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Bodyweight_Squat'}})}});
 const detail=a.nodes['modal-root'].innerHTML;assert.match(detail,/Как се изпълнява/);assert.match(detail,/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);assert.doesNotMatch(detail,/<img/);
});
