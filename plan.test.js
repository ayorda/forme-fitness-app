const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const data=fs.readFileSync('data.js','utf8');
const art=fs.readFileSync('exercise-art.js','utf8');
const planFunction=app.slice(app.indexOf('function planPage()'),app.indexOf('function favoritesPage()'));

function render(plan, weekday){
  const context={window:{},state:{plan},pageHeading:()=>'',days:[['mon','ПОН'],['tue','ВТО'],['wed','СРЯ'],['thu','ЧЕТ'],['fri','ПЕТ'],['sat','СЪБ'],['sun','НЕД']],cats:{cal:'Калистеника',yoga:'Йога',mobility:'Мобилност'},Date:class extends Date {getDay(){return weekday;}}};
  vm.createContext(context);
  vm.runInContext(art,context);vm.runInContext(data,context);
  context.workouts=context.window.FORME_DATA.workouts;
  context.byId=(items,id)=>items.find(item=>item.id===id);
  vm.runInContext(planFunction+';this.renderPlan=planPage;',context);
  return {html:context.renderPlan(),workouts:context.workouts};
}
test('Existing saved plans stay selected and the weekly count reflects them',()=>{
  const id=render({},1).workouts[0].id;
  const {html}=render({mon:id,tue:'',wed:id},1);
  assert.match(html,/2 от 7 дни/);
  assert.match(html,new RegExp(`value="${id}" selected`));
  assert.equal((html.match(/data-action="plan-day"/g)||[]).length,7);
});
test('Today is highlighted correctly on Sunday and Monday',()=>{
  for(const [weekday,day] of [[0,'НЕД'],[1,'ПОН']]){
    const {html}=render({},weekday);
    assert.match(html,new RegExp(`day-card-today[^]*?day-label">${day}</div><span class="today-badge">ДНЕС`));
    assert.equal((html.match(/today-badge/g)||[]).length,1);
  }
});
