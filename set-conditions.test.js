const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./core.js');

function setup(initial={}){
 const data={...initial};let fail=false;
 const storage={getItem:k=>data[k]??null,setItem(k,v){if(fail)throw Error('quota');data[k]=v;},removeItem:k=>{delete data[k];}};
 const c={window:{}};vm.createContext(c);for(const file of ['progress.js','backup.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 return {data,storage,journal:c.window.FORME_PROGRESS.create(storage),backup:c.window.FORME_BACKUP,fail:()=>{fail=true;}};
}
const date='2026-11-14';
const plain=value=>JSON.parse(JSON.stringify(value));

test('weighted and assisted sets survive reopening without changing legacy record shapes',()=>{
 const a=setup();a.journal.recordSet('Pullups','reps',8,date,{weightKg:12.5,assistance:'  green   band  '});
 a.journal.recordSet('Pushups','reps',10,date);
 const b=setup(a.data),[weighted,legacy]=b.journal.get().sets;
 assert.equal(weighted.weightKg,12.5);assert.equal(weighted.assistance,'green band');
 assert.equal(Object.hasOwn(legacy,'weightKg'),false);assert.equal(Object.hasOwn(legacy,'assistance'),false);
 assert.equal(b.journal.get().version,1);
});

test('invalid weight precision, bounds and assistance cannot mutate the journal',()=>{
 const a=setup();const prior=JSON.stringify(a.journal.get());
 for(const details of [{weightKg:-1},{weightKg:501},{weightKg:1.234},{weightKg:'12'},{weightKg:NaN},{weightKg:Infinity},{assistance:123},{assistance:'x'.repeat(121)}])
  assert.equal(a.journal.recordSet('Pullups','reps',5,date,details),false);
 assert.equal(JSON.stringify(a.journal.get()),prior);assert.equal(a.data['forme-progress-v1'],undefined);
});

test('decimal weight boundaries and no-assistance defaults normalize predictably',()=>{
 const a=setup();for(const weightKg of [0,0.01,1.1,2.55,500])assert.equal(a.journal.recordSet('Pullups','reps',5,date,{weightKg,assistance:' '}),true);
 const rows=a.journal.get().sets;assert.equal(Object.hasOwn(rows[0],'weightKg'),false);
 assert.equal(rows[3].weightKg,2.55);assert.equal(rows[4].weightKg,500);assert.ok(rows.every(x=>!Object.hasOwn(x,'assistance')));
});

test('startup repairs invalid optional metadata while preserving the exercise result',()=>{
 const payload={version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:'s1',exerciseId:'Pullups',kind:'reps',value:8,date,weightKg:-5,assistance:' green band '}]};
 const a=setup({'forme-progress-v1':JSON.stringify(payload)}),row=a.journal.get().sets[0];
 assert.equal(row.value,8);assert.equal(Object.hasOwn(row,'weightKg'),false);assert.equal(row.assistance,'green band');
});

test('storage failure cannot report a weighted set as saved',()=>{
 const a=setup();a.journal.recordSet('Pushups','reps',10,date);const prior=a.data['forme-progress-v1'];a.fail();
 assert.equal(a.journal.recordSet('Pullups','reps',5,date,{weightKg:10}),false);
 assert.equal(a.data['forme-progress-v1'],prior);assert.equal(a.journal.get().sets.length,1);
});

test('delete and undo retain exact weight and assistance without duplicating IDs',()=>{
 const a=setup();a.journal.recordSet('Pullups','reps',8,date,{weightKg:2.5,assistance:'partner'});
 const original=a.journal.get().sets[0];assert.equal(a.journal.removeRecord(original.id),true);
 assert.equal(a.journal.restore([original]),true);assert.deepEqual(plain(a.journal.get().sets[0]),plain(original));
 a.journal.restore([original]);assert.equal(a.journal.get().sets.length,1);
});

test('the journal refuses overflow rather than losing the newest weighted set on reload',()=>{
 const sets=Array.from({length:5000},(_,i)=>({id:'s'+i,exerciseId:'Pullups',kind:'reps',value:5,date}));
 const a=setup({'forme-progress-v1':JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets})});
 assert.equal(a.journal.recordSet('Pullups','reps',8,date,{weightKg:10}),false);assert.equal(a.journal.get().sets.length,5000);
});

test('personal records separate added loads, assistance and reps from timed holds',()=>{
 const rows=[{id:'a',exerciseId:'Pullups',kind:'reps',value:10,date},{id:'b',exerciseId:'Pullups',kind:'reps',value:5,date,weightKg:10},{id:'c',exerciseId:'Pullups',kind:'reps',value:20,date,assistance:'green band'},{id:'d',exerciseId:'Pullups',kind:'seconds',value:30,date},{id:'e',exerciseId:'Pullups',kind:'reps',value:22,date,assistance:' GREEN  band '}];
 const best=core.bestExerciseSets(rows,'Pullups');assert.deepEqual(best.map(x=>x.id),['a','b','e','d']);
 assert.equal(core.sameSetContext(rows[0],rows[1]),false);assert.equal(core.sameSetContext(rows[2],rows[4]),true);
});

test('progress gains compare only sets at the same load and assistance',()=>{
 const rows=[{exerciseId:'Pullups',kind:'reps',date:'2026-11-01',value:5,weightKg:10},{exerciseId:'Pullups',kind:'reps',date,value:8,weightKg:10},{exerciseId:'Pullups',kind:'reps',date,value:30,assistance:'machine'}];
 assert.equal(core.exerciseProgressDelta(rows,'Pullups','reps',{weightKg:10}).gain,3);
 assert.equal(core.exerciseProgressDelta(rows,'Pullups','reps'),null);
});

test('JSON backup export, import and merge preserve distinct conditions and deduplicate matching sets',()=>{
 const a=setup();a.journal.recordSet('Pullups','reps',8,date,{weightKg:10,assistance:'green band'});
 const archive=a.backup.exportData(a.storage),b=setup();assert.equal(b.backup.importData(b.storage,archive),true);
 assert.equal(JSON.parse(b.data['forme-progress-v1']).sets[0].weightKg,10);
 const payload=JSON.parse(archive),progress=JSON.parse(payload.data['forme-progress-v1']);
 progress.sets.push({...progress.sets[0],weightKg:20});payload.data['forme-progress-v1']=JSON.stringify(progress);
 // Separate archives can have colliding IDs; different conditions must survive merge.
 const c=setup();c.journal.recordSet('Pullups','reps',8,date,{weightKg:20,assistance:'green band'});
 assert.equal(c.backup.mergeData(c.storage,archive),true);assert.equal(c.backup.mergeData(c.storage,archive),true);
 assert.equal(JSON.parse(c.data['forme-progress-v1']).sets.length,2);
 assert.equal(a.backup.validate(payload),false,'duplicate IDs in one archive remain invalid');
});

test('archives reject invalid conditions and export repairs optional corruption without losing valid results',()=>{
 const a=setup();a.journal.recordSet('Pullups','reps',8,date,{weightKg:10});
 const progress=JSON.parse(a.data['forme-progress-v1']);progress.sets[0].weightKg=-10;progress.sets[0].assistance='band';a.data['forme-progress-v1']=JSON.stringify(progress);
 assert.equal(a.backup.validate({app:'FORME',version:1,data:{'forme-progress-v1':a.data['forme-progress-v1']}}),false);
 const clean=JSON.parse(JSON.parse(a.backup.exportData(a.storage)).data['forme-progress-v1']).sets[0];
 assert.equal(clean.value,8);assert.equal(clean.assistance,'band');assert.equal(Object.hasOwn(clean,'weightKg'),false);
});

test('CSV adds condition columns when needed, preserves decimal precision and escapes formula-like assistance',()=>{
 const rows=[{exerciseId:'Pullups',kind:'reps',value:8,date,weightKg:12.55,assistance:'=SUM(A1:A2)'}];
 const csv=core.exportActivityCsv({sets:rows,sessions:[{workoutId:'cal-start',minutes:12,date}]});
 assert.match(csv,/fiber_g,weight_kg,assistance\r\n/);assert.match(csv,/12\.55,'=SUM\(A1:A2\)/);
 const old=core.exportActivityCsv({sets:[{exerciseId:'Pullups',kind:'reps',value:8,date}]});
 assert.ok(old.startsWith('\uFEFFdate,type,name,metric,value,kcal,protein_g,carbs_g,fat_g,fiber_g\r\n'));
});

test('exercise trends show daily bests in chronological order without mixing conditions',()=>{
 const rows=[{exerciseId:'Pullups',kind:'reps',date:'2026-11-14',value:10},{exerciseId:'Pullups',kind:'reps',date:'2026-11-01',value:5},{exerciseId:'Pullups',kind:'reps',date:'2026-11-07',value:7},{exerciseId:'Pullups',kind:'reps',date:'2026-11-07',value:6},{exerciseId:'Pullups',kind:'reps',date:'2026-11-07',value:100,weightKg:10}];
 assert.deepEqual(core.exerciseTrend(rows,'Pullups','reps'),[{date:'2026-11-01',value:5,count:1},{date:'2026-11-07',value:7,count:2},{date:'2026-11-14',value:10,count:1}]);
 assert.equal(core.exerciseTrend(rows,'Pullups','reps',{weightKg:10})[0].value,100);
});

test('trend history limits dates and ignores malformed dates and values',()=>{
 const rows=Array.from({length:20},(_,i)=>({exerciseId:'Pullups',kind:'reps',date:'2026-11-'+String(i+1).padStart(2,'0'),value:i+1}));
 rows.push({exerciseId:'Pullups',kind:'reps',date:'2026-02-30',value:100},{exerciseId:'Pullups',kind:'reps',date:'2026-11-21',value:NaN});
 const trend=core.exerciseTrend(rows,'Pullups','reps');assert.equal(trend.length,12);assert.equal(trend[0].date,'2026-11-09');assert.equal(trend.at(-1).date,'2026-11-20');
 assert.deepEqual(core.exerciseTrend(rows,'Plank','seconds'),[]);
});
