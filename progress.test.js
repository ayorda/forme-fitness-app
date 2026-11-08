const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function apis(initial={}){
 const data={...initial};let fail=false;
 const storage={getItem:key=>data[key]??null,setItem(key,value){if(fail)throw Error('quota');data[key]=value;}};
 const context={window:{},Date,Math};vm.createContext(context);
 for(const file of ['progress.js','programs.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return {journal:context.window.FORME_PROGRESS.create(storage),programs:context.window.FORME_PROGRAMS,data,failWrites(value){fail=value;}};
}

test('workout and exercise records survive reopening and count toward weekly goals',()=>{
 const {journal,data}=apis();const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 assert.equal(journal.recordWorkout('cal-start',date,12),true);
 assert.equal(journal.recordSet('Pushups','reps',10,date),true);
 assert.equal(journal.recordSet('Plank','seconds',30,date),true);
 assert.equal(journal.setGoal(4,120),true);
 const reopened=apis(data).journal,week=reopened.weekSummary(today);
 assert.equal(week.workouts,1);assert.equal(week.minutes,12);assert.equal(week.sets,2);
 assert.equal(week.goal.workoutsPerWeek,4);assert.equal(week.goal.minutesPerWeek,120);
 assert.equal(reopened.get().version,1);
});

test('legacy calendar completions remain visible without duplicating logged sessions',()=>{
 const today=new Date(),date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const {journal}=apis({'forme-completed-workouts':JSON.stringify({[date]:{id:'cal-start',name:'Силна основа'}})});
 assert.equal(journal.sessions().length,1);assert.equal(journal.sessions()[0].legacy,true);
 assert.equal(journal.recordWorkout('cal-start',date,12),true);
 assert.equal(journal.sessions().length,1);assert.equal(journal.sessions()[0].legacy,undefined);
});

test('invalid and failed writes do not change journal state',()=>{
 const app=apis();assert.equal(app.journal.recordSet('Pushups','reps',0),false);
 assert.equal(app.journal.recordWorkout('cal-start','2026-02-30',12),false);
 assert.equal(app.journal.recordSet('Pushups','reps',10,'2026-02-30'),false);
 assert.equal(app.journal.setGoal(8,90),false);assert.equal(app.journal.get().sets.length,0);
 app.failWrites(true);assert.equal(app.journal.recordWorkout('cal-start','2026-11-07',12),false);
 assert.equal(app.journal.get().sessions.length,0);
});

test('four-week programs use only the current workout catalog and preserve beginner level',()=>{
 const {programs}=apis(),dataContext={window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}};
 vm.createContext(dataContext);vm.runInContext(fs.readFileSync('data.js','utf8'),dataContext);
 const workouts=dataContext.window.FORME_DATA.workouts,exercises=dataContext.window.FORME_DATA.exercises;
 for(const program of programs.programs){const dates=programs.schedule(program.id,new Date(2026,10,3));assert.equal(dates.length,12);assert.equal(new Set(dates.map(x=>x.date)).size,12);
  for(const slot of dates){const workout=workouts.find(x=>x.id===slot.workoutId);assert.ok(workout);if(program.level==='beginner')for(const id of workout.ids)assert.notEqual(exercises.find(x=>x.id===id).level,'elite');}
 }
});
