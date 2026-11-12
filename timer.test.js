const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(language='bg',navigator=undefined){
 let now=100000;const handlers={},nodes={},storage={};
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 class Clock extends Date{static now(){return now;}}
 const window={addEventListener(){},scrollTo(){}};
 const context={window,document,navigator,localStorage:{getItem(key){return key==='forme-language'?language:storage[key]??null;},setItem(key,value){storage[key]=value;}},location:{hash:'#home'},Date:Clock,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(context);
 const files=['exercise-art.js','data.js','core.js','food-art.js','progress.js'];if(language!=='bg')files.push('i18n.js','interface-translations.js','exercise-translations.js','food-translations.js','workout-translations.js','locale-content.js');files.push('app.js');
 for(const file of files){
  let source=fs.readFileSync(file,'utf8');
  if(file==='app.js')source=source.replace(/\}\)\(\);\s*$/, 'window.__timerTest={state,startWorkout,playerControl};})();');
  vm.runInContext(source,context,{filename:file});
 }
 return {run:code=>vm.runInContext('with(window.__timerTest){'+code+'}',context),advance:ms=>{now+=ms;},handlers,nodes,storage};
}
test('timer translates controls while preserving workout steps and time',()=>{
 for(const [language,workout,ready,pause] of [['en','Strong Foundation','READY?','Pause'],['de','Starke Grundlage','BEREIT?','Pause']]){
  const a=boot(language);a.run("startWorkout('cal-start')");
  assert.ok(a.nodes['player-layout'].innerHTML.includes(workout));assert.ok(a.nodes['player-layout'].innerHTML.includes(ready));
  const steps=a.run('state.player.steps.length');a.run("playerControl('player-start')");
  assert.ok(a.nodes['player-layout'].innerHTML.includes(pause));assert.equal(a.run('state.player.steps.length'),steps);
 }
});

test('player keeps focus on the replacement control after starting',()=>{
 const a=boot();a.run("startWorkout('cal-start')");
 a.run("document.activeElement={dataset:{action:'player-start'}};document.getElementById('player-layout').contains=()=>true;document.getElementById('player-layout').querySelector=selector=>({focus(){window.__focusedSelector=selector}});playerControl('player-start')");
 assert.equal(a.run('window.__focusedSelector'),'[data-action="player-pause"]:not([disabled])');
});

test('changing timer settings keeps the controls mounted',()=>{
 const a=boot();a.run("startWorkout('cal-start')");
 const before=a.nodes['player-layout'].innerHTML;
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'45'}});
 assert.equal(a.run('state.player.restMs'),45000);
 assert.equal(a.nodes['player-layout'].innerHTML,before);
});

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

test('pause first catches up when work has already ended between timer ticks',()=>{
 const a=boot();a.run("startWorkout('cal-start'); playerControl('player-start')");
 const work=a.run('state.player.workMs'),rest=a.run('state.player.restMs');
 a.advance(work+2000);a.run("playerControl('player-pause')");
 assert.equal(a.run('state.player.phase'),'rest');
 assert.equal(a.run('state.player.remainingMs'),rest-2000);
 assert.equal(a.run('state.player.running'),false);
});
test('pause after the full workout has elapsed leaves the workout completed',()=>{
 const a=boot();a.run("startWorkout('cal-start'); playerControl('player-start')");
 const length=a.run('state.player.steps.length'),work=a.run('state.player.workMs'),rest=a.run('state.player.restMs');
 a.advance(length*work+(length-1)*rest+1000);a.run("playerControl('player-pause')");
 assert.equal(a.run('state.player.phase'),'done');assert.equal(a.run('state.player.running'),false);
});
test('next catches up first and skips the currently elapsed rest period',()=>{
 const a=boot();a.run("startWorkout('cal-start'); playerControl('player-start')");
 const work=a.run('state.player.workMs');a.advance(work+2000);
 a.run("playerControl('player-next')");
 assert.equal(a.run('state.player.phase'),'work');assert.equal(a.run('state.player.index'),1);
 assert.equal(a.run('state.player.remainingMs'),work);
});

test('completed workout records configured active duration after background catch-up',()=>{
 const a=boot();a.run("startWorkout('cal-start')");
 a.handlers.change({target:{dataset:{action:'player-setting',key:'workMs'},value:'5'}});
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'5'}});
 a.run("playerControl('player-start')");
 a.advance(600000);a.handlers.visibilitychange();
 const result=JSON.parse(a.storage['forme-progress-v1']).sessions[0];
 assert.equal(a.run('state.player.phase'),'done');
 assert.equal(a.run('state.player.finishedAt-state.player.startedAt'),115000);
 assert.equal(result.minutes,2);
});

test('paused time and skipped steps do not inflate recorded minutes',()=>{
 const a=boot();a.run("startWorkout('cal-start')");
 a.handlers.change({target:{dataset:{action:'player-setting',key:'workMs'},value:'600'}});
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'600'}});
 a.run("playerControl('player-start')");
 a.advance(120000);a.run("playerControl('player-pause')");
 a.advance(120000);a.run("playerControl('player-resume')");
 a.advance(60000);a.run("for(let i=0;i<23;i++)playerControl('player-next')");
 const result=JSON.parse(a.storage['forme-progress-v1']).sessions[0];
 assert.equal(a.run('state.player.phase'),'done');
 assert.equal(a.run('state.player.pausedMs'),120000);
 assert.equal(result.minutes,3);
});

test('finishing while paused records only time before the pause',()=>{
 const a=boot();a.run("startWorkout('cal-start')");
 a.handlers.change({target:{dataset:{action:'player-setting',key:'workMs'},value:'600'}});
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'600'}});
 a.run("playerControl('player-start')");
 a.advance(60000);a.run("playerControl('player-pause')");
 a.advance(180000);a.run("for(let i=0;i<23;i++)playerControl('player-next')");
 const result=JSON.parse(a.storage['forme-progress-v1']).sessions[0];
 assert.equal(a.run('state.player.phase'),'done');
 assert.equal(result.minutes,1);
});

test('closing a completed workout refreshes weekly progress on the underlying screen',()=>{
 const a=boot();
 assert.match(a.nodes.app.innerHTML,/<strong>0 \/ 3<\/strong>/);
 a.run("startWorkout('cal-start')");
 a.handlers.change({target:{dataset:{action:'player-setting',key:'workMs'},value:'5'}});
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'5'}});
 a.run("playerControl('player-start')");
 a.advance(600000);a.handlers.visibilitychange();
 assert.equal(a.run('state.player.saved'),true);
 a.handlers.keydown({key:'Escape'});
 assert.match(a.nodes.app.innerHTML,/<strong>1 \/ 3<\/strong>/);
 assert.match(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
});

test('completing a workout marks today as completed in the Monthly Calendar',()=>{
 const a=boot();
 a.run("startWorkout('cal-start')");
 a.handlers.change({target:{dataset:{action:'player-setting',key:'workMs'},value:'5'}});
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'5'}});
 a.run("playerControl('player-start')");
 a.advance(600000);a.handlers.visibilitychange();
 a.handlers.keydown({key:'Escape'});
 const click=dataset=>a.handlers.click({target:{closest:()=>({dataset})}});
 click({action:'nav',page:'plan'});
 click({action:'plan-view',view:'month'});
 click({action:'plan-date',date:String(new Date().getDate())});
 assert.match(a.nodes.app.innerHTML,/month-completed/);
 assert.match(a.nodes.app.innerHTML,/Отбелязана като изпълнена: Силна основа/);
 assert.doesNotMatch(a.nodes.app.innerHTML,/data-action="completion-remove"/);
});

test('player displays easier regression during work and toggles start/pause/resume with Space',()=>{
 const a=boot();
 a.run("startWorkout('cal-start')");
 assert.match(a.nodes['player-layout'].innerHTML,/По-лесен вариант: Клек до стол\./);
 a.handlers.keydown({key:' ',code:'Space',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.running'),true);
 a.advance(2000);
 a.handlers.keydown({key:' ',code:'Space',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.running'),false);
 a.handlers.keydown({key:' ',code:'Space',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.running'),true);
});

test('player-prev steps back from rest or later exercise without restarting the whole workout',()=>{
 const a=boot();
 a.run("startWorkout('cal-start'); playerControl('player-start')");
 assert.match(a.nodes['player-layout'].innerHTML,/data-action="player-prev" disabled/);
 a.run("playerControl('player-next')");
 assert.equal(a.run('state.player.phase'),'rest');
 a.run("playerControl('player-prev')");
 assert.equal(a.run('state.player.phase'),'work');
 assert.equal(a.run('state.player.index'),0);
 a.run("playerControl('player-next'); playerControl('player-next')");
 assert.equal(a.run('state.player.index'),1);
 assert.equal(a.run('state.player.phase'),'work');
 a.run("playerControl('player-prev')");
 assert.equal(a.run('state.player.index'),0);
 assert.equal(a.run('state.player.phase'),'work');
});

test('workout player acquires and releases Screen Wake Lock when running, paused and closed',async()=>{
 let requested=0,released=0;
 const nav={wakeLock:{async request(kind){assert.equal(kind,'screen');requested++;return {async release(){released++;}};}}};
 const a=boot('bg',nav);
 a.run("startWorkout('cal-start'); playerControl('player-start')");
 await Promise.resolve();
 assert.equal(requested,1);
 assert.equal(released,0);
 a.run("playerControl('player-pause')");
 await Promise.resolve();
 assert.equal(released,1);
 a.run("playerControl('player-resume')");
 await Promise.resolve();
 assert.equal(requested,2);
 a.handlers.keydown({key:'Escape'});
 await Promise.resolve();
 assert.equal(released,2);
});

test('ArrowRight and ArrowLeft step forward and backward inside an active workout player',()=>{
 const a=boot();
 a.run("startWorkout('cal-start'); playerControl('player-start')");
 a.handlers.keydown({key:'ArrowLeft',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.index'),0);
 assert.equal(a.run('state.player.phase'),'work');
 a.handlers.keydown({key:'ArrowRight',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.phase'),'rest');
 a.handlers.keydown({key:'ArrowRight',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.index'),1);
 assert.equal(a.run('state.player.phase'),'work');
 a.handlers.keydown({key:'ArrowLeft',target:{tagName:'DIV'},preventDefault(){}});
 assert.equal(a.run('state.player.index'),0);
 assert.equal(a.run('state.player.phase'),'work');
});

test('workout player displays and live-updates total remaining workout time',()=>{
 const a=boot();
 a.run("startWorkout('cal-start')");
 assert.match(a.nodes['player-layout'].innerHTML,/id="player-total-remaining">11:40<\/b>/);
 a.handlers.change({target:{dataset:{action:'player-setting',key:'restMs'},value:'30'}});
 assert.equal(a.nodes['player-total-remaining'].textContent,'13:30');
 a.run("playerControl('player-start')");
 a.advance(10000);
 a.handlers.visibilitychange();
 assert.equal(a.nodes['player-total-remaining'].textContent,'13:20');
 a.advance(900000);
 a.handlers.visibilitychange();
 assert.equal(a.run('state.player.phase'),'done');
 assert.match(a.nodes['player-layout'].innerHTML,/id="player-total-remaining">00:00<\/b>/);
});

