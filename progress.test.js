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

test('corrupted progress storage repairs invalid goals, sessions and sets on startup',()=>{
 const date='2026-11-09';
 const {journal}=apis({
  'forme-progress-v1':JSON.stringify({
   version:1,
   goal:'broken',
   sessions:[
    null,
    {id:'s-1',workoutId:'cal-start',date,minutes:12},
    {id:'s-1',workoutId:'cal-start',date,minutes:99},
    {id:'s-2',workoutId:'mob-daily',date,minutes:10},
    {id:'bad-min',workoutId:'cal-start',date,minutes:'oops'},
    {id:'bad-date',workoutId:'cal-start',date:'2026-02-30',minutes:10}
   ],
   sets:[
    null,
    {id:'set-1',exerciseId:'Plank',date,kind:'seconds',value:45},
    {id:'set-bad',exerciseId:'Plank',date,kind:'meters',value:10}
   ]
  }),
  'forme-completed-workouts':'[]'
 });
 const summary=journal.weekSummary(new Date(2026,10,9,12));
 assert.equal(summary.goal.workoutsPerWeek,3);
 assert.equal(summary.goal.minutesPerWeek,90);
 assert.equal(summary.workouts,2);
 assert.equal(summary.minutes,22);
 assert.equal(summary.sets,1);
 assert.deepEqual([...journal.sessions().map(x=>x.id)],['s-2','s-1']);
});
