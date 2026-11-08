const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(hash,storage){
 const handlers={},nodes={};
 let focused='';
 const closeButton={focus(){focused='close';}};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(selector){return selector==='.modal-close'?closeButton:element();}});
 const document={activeElement:{isConnected:true,focus(){focused='trigger';}},body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};
 const localStorage={getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}};
 const c={window,document,localStorage,location:{hash},Date:class extends Date{getDay(){return 1;}},setTimeout:()=>0,clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});return {handlers,nodes,focused:()=>focused,document};
}
test('a workout saved in the weekly plan appears on home after reopening',()=>{
 const storage={};const a=boot('#plan',storage);
 a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.equal(JSON.parse(storage['forme-plan']).mon,'cal-start');
 assert.match(a.nodes.app.innerHTML,/1 от 7 дни/);
 const b=boot('#home',storage);
 assert.match(b.nodes.app.innerHTML,/Силна основа/);
 assert.match(b.nodes.app.innerHTML,/data-action="start-workout" data-id="cal-start"/);
});
test('existing favorites and saved meals remain readable when the new catalog loads',()=>{
 const storage={'forme-favorites':JSON.stringify({workouts:['cal-start'],exercises:['Plank']}),'forme-saved-meals':JSON.stringify([{name:'Тест',items:[{id:'rice',grams:150}]}])};
 const a=boot('#favorites',storage);assert.match(a.nodes.app.innerHTML,/Силна основа/);assert.match(a.nodes.app.innerHTML,/Планк/);
 assert.equal(JSON.parse(storage['forme-saved-meals'])[0].name,'Тест');
});

test('opening and closing details moves keyboard focus and restores it',()=>{
 const a=boot('#exercises',{});
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Plank'}})}});
 assert.equal(a.focused(),'close');assert.equal(a.document.body.style.overflow,'hidden');
 a.handlers.keydown({key:'Escape'});
 assert.equal(a.focused(),'trigger');assert.equal(a.nodes['modal-root'].innerHTML,'');assert.equal(a.document.body.style.overflow,'');
});

test('Tab and Shift+Tab stay inside an open detail dialog',()=>{
 const a=boot('#exercises',{});
 const trigger=a.document.activeElement;
 const buttons=['first','last'].map(name=>({getClientRects:()=>[{}],closest:()=>null,focus(){a.document.activeElement=this;}}));
 const dialog={querySelectorAll:()=>buttons,contains:element=>buttons.includes(element)};
 a.nodes['modal-root'].querySelector=selector=>selector==='.modal-close'?buttons[0]:dialog;
 a.handlers.click({target:{closest:()=>({dataset:{action:'exercise-detail',id:'Plank'}})}});
 assert.equal(a.document.activeElement,buttons[0]);
 let prevented=false;
 a.handlers.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented=true;}});
 assert.equal(a.document.activeElement,buttons[1]);assert.equal(prevented,true);
 prevented=false;
 a.handlers.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented=true;}});
 assert.equal(a.document.activeElement,buttons[0]);assert.equal(prevented,true);
 a.document.activeElement=trigger;prevented=false;
 a.handlers.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented=true;}});
 assert.equal(a.document.activeElement,buttons[0]);assert.equal(prevented,true);
});

test('favorite keeps keyboard focus after the card is redrawn',()=>{
 const a=boot('#sessions',{});
 let focused=false;
 const selected={dataset:{action:'favorite',kind:'workouts',id:'cal-start'}};
 const replacement={dataset:{...selected.dataset},disabled:false,focus(){focused=true;}};
 a.document.activeElement=selected;
 a.nodes.app.contains=element=>element===selected;
 a.nodes.app.querySelectorAll=()=>[replacement];
 a.handlers.click({target:{closest:()=>selected}});
 assert.equal(focused,true);
});
