const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(blocked,initial={},hash='#plan'){
 const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const storage={getItem(key){return initial[key]??null;},setItem(key,value){if(blocked)throw Error('storage unavailable');initial[key]=value;}};
 const context={window:{addEventListener(){},scrollTo(){}},document,localStorage:storage,location:{hash},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 return {handlers,nodes};
}
test('failed plan or favorite writes leave a warning instead of a success message',()=>{
 const a=boot(true);a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Plank'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
});
test('successful plan writes still show confirmation',()=>{
 const a=boot(false);a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:'cal-start'}});
 assert.equal(a.nodes.toast.textContent,'Седмичният план е запазен.');
});
test('failed meal save does not claim the meal was saved',()=>{
 const a=boot(true);
 a.handlers.click({target:{closest:()=>({dataset:{action:'add-food',id:'rice'}})}});
 a.nodes['meal-name']={value:'Обяд',focus(){}};
 a.handlers.click({target:{closest:()=>({dataset:{action:'save-meal'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
});

test('failed meal save does not add an unsaved meal to the saved list',()=>{
 const a=boot(true,{},'#nutrition');
 a.handlers.click({target:{closest:()=>({dataset:{action:'add-food',id:'rice'}})}});
 a.nodes['meal-name']={value:'Обяд',focus(){}};
 a.handlers.click({target:{closest:()=>({dataset:{action:'save-meal'}})}});
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'saved'}})}});
 assert.doesNotMatch(a.nodes.app.innerHTML,/<h4>Обяд<\/h4>/);
});
test('failed deletion keeps the saved meal visible',()=>{
 const initial={'forme-saved-meals':JSON.stringify([{name:'Обяд',items:[{id:'rice',grams:100}]}])};
 const a=boot(true,initial,'#nutrition');
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'saved'}})}});
 assert.match(a.nodes.app.innerHTML,/<h4>Обяд<\/h4>/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'delete-saved-meal',index:'0'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 assert.match(a.nodes.app.innerHTML,/<h4>Обяд<\/h4>/);
});
test('successful meal save and deletion update both the list and stored data',()=>{
 const initial={};const a=boot(false,initial,'#nutrition');
 a.handlers.click({target:{closest:()=>({dataset:{action:'add-food',id:'rice'}})}});
 a.nodes['meal-name']={value:'Обяд',focus(){}};
 a.handlers.click({target:{closest:()=>({dataset:{action:'save-meal'}})}});
 assert.match(a.nodes.app.innerHTML,/<h4>Обяд<\/h4>/);
 assert.equal(JSON.parse(initial['forme-saved-meals'])[0].name,'Обяд');
 a.handlers.click({target:{closest:()=>({dataset:{action:'delete-saved-meal',index:'0'}})}});
 assert.doesNotMatch(a.nodes.app.innerHTML,/<h4>Обяд<\/h4>/);
 assert.equal(JSON.parse(initial['forme-saved-meals']).length,0);
});

test('failed weekly plan edits and clearing keep the previously saved plan visible',()=>{
 const initial={'forme-plan':JSON.stringify({mon:'cal-start'})};const a=boot(true,initial);
 assert.match(a.nodes.app.innerHTML,/1 от 7 дни/);
 a.handlers.change({target:{dataset:{action:'plan-day',day:'mon'},value:''}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 assert.match(a.nodes.app.innerHTML,/1 от 7 дни/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'clear-plan'}})}});
 assert.match(a.nodes.app.innerHTML,/1 от 7 дни/);
 assert.equal(JSON.parse(initial['forme-plan']).mon,'cal-start');
});
test('successful weekly plan clearing removes the saved plan',()=>{
 const initial={'forme-plan':JSON.stringify({mon:'cal-start'})};const a=boot(false,initial);
 a.handlers.click({target:{closest:()=>({dataset:{action:'clear-plan'}})}});
 assert.match(a.nodes.app.innerHTML,/0 от 7 дни/);
 assert.deepEqual(JSON.parse(initial['forme-plan']),{});
 assert.equal(a.nodes.toast.textContent,'Планът е изчистен.');
});

test('failed favorite changes keep the previously saved favorite state',()=>{
 const initial={'forme-favorites':JSON.stringify({exercises:['Plank'],workouts:[]})};const a=boot(true,initial,'#favorites');
 assert.match(a.nodes.app.innerHTML,/Планк/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'favorite',kind:'exercises',id:'Plank'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);
 assert.match(a.nodes.app.innerHTML,/Планк/);
 assert.deepEqual(JSON.parse(initial['forme-favorites']).exercises,['Plank']);
});

test('failed load keeps the current meal intact and leaves the saved list open',()=>{
 const initial={'forme-current-meal':JSON.stringify([{id:'rice',grams:'150'}]),'forme-saved-meals':JSON.stringify([{name:'Яйца',items:[{id:'egg',grams:'100'}]}])};
 const a=boot(true,initial,'#nutrition');
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'saved'}})}});
 a.handlers.click({target:{closest:()=>({dataset:{action:'load-meal',index:'0'}})}});
 assert.match(a.nodes.toast.textContent,/Неуспешно локално запазване/);assert.match(a.nodes.app.innerHTML,/<h4>Яйца<\/h4>/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'meal'}})}});
 assert.match(a.nodes.app.innerHTML,/Премахни Бял ориз/);assert.doesNotMatch(a.nodes.app.innerHTML,/Премахни Яйце/);
 assert.equal(JSON.parse(initial['forme-current-meal'])[0].id,'rice');
});
test('successful load replaces and persists the current meal',()=>{
 const initial={'forme-current-meal':JSON.stringify([{id:'rice',grams:'150'}]),'forme-saved-meals':JSON.stringify([{name:'Яйца',items:[{id:'egg',grams:'100'}]}])};
 const a=boot(false,initial,'#nutrition');
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-tab',tab:'saved'}})}});
 a.handlers.click({target:{closest:()=>({dataset:{action:'load-meal',index:'0'}})}});
 assert.match(a.nodes.app.innerHTML,/Премахни Яйце/);assert.equal(JSON.parse(initial['forme-current-meal'])[0].id,'egg');
});
