const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
 let now=100000;const handlers={},nodes={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 class Clock extends Date{static now(){return now;}}
 const window={addEventListener(){},scrollTo(){}};
 const context={window,document,localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#home'},Date:Clock,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 for(const file of ['exercise-art.js','data.js','core.js','food-art.js','app.js']){
  let source=fs.readFileSync(file,'utf8');
  if(file==='app.js')source=source.replace(/\}\)\(\);\s*$/, 'window.__timerTest={state,startWorkout,playerControl};})();');
  vm.runInContext(source,context,{filename:file});
 }
 return {run:code=>vm.runInContext('with(window.__timerTest){'+code+'}',context),advance:ms=>{now+=ms;},handlers};
}

test('timer catches up through work and rest after the screen becomes visible',()=>{
 const a=boot();a.run("startWorkout('cal-start'); playerControl('player-start')");
 const work=a.run('state.player.workMs'),rest=a.run('state.player.restMs');
 a.advance(work+rest+2000);a.handlers.visibilitychange();
 assert.equal(a.run('state.player.phase'),'work');assert.equal(a.run('state.player.index'),1);
 assert.equal(a.run('state.player.remainingMs'),work-2000);
});

test('pausing freezes remaining time and resuming continues from it',()=>{
 const a=boot();a.run("startWorkout('cal-start'); playerControl('player-start')");
 a.advance(3000);a.run("playerControl('player-pause')");const remaining=a.run('state.player.remainingMs');
 a.advance(60000);a.handlers.visibilitychange();assert.equal(a.run('state.player.remainingMs'),remaining);
 a.run("playerControl('player-resume')");a.advance(1000);a.handlers.visibilitychange();
 assert.equal(a.run('state.player.remainingMs'),remaining-1000);
});
