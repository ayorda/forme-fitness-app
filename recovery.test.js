const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const date='2026-11-14';
function setup(initial={}){
 const data={...initial};let failKey=null;
 const storage={getItem:key=>data[key]??null,setItem(key,value){if(key===failKey)throw Error('quota');data[key]=value;},removeItem(key){if(key===failKey)throw Error('quota');delete data[key];}};
 const context={window:{}};vm.createContext(context);for(const file of ['recovery.js','backup.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 const api=context.window.FORME_RECOVERY;
 return {api,journal:api.create(storage,{today:()=>date}),backup:context.window.FORME_BACKUP,storage,data,fail:key=>{failKey=key;}};
}
const input=(extra={})=>({date,bedtime:'23:00',wakeTime:'07:00',awakeMinutes:30,quality:4,fatigue:2,...extra});
const entry=(extra={})=>({id:'n1',date,bedtime:'23:00',wakeTime:'07:00',bedOffset:0,wakeOffset:0,awakeMinutes:30,quality:4,fatigue:2,...extra});
const document=entries=>({version:1,ageGroup:'adult',entries});
const plain=value=>JSON.parse(JSON.stringify(value));

test('overnight sleep subtracts reported awake time and survives reopening',()=>{
 const a=setup();assert.equal(a.journal.save(input()),true);const saved=a.journal.forDate(date);
 assert.equal(a.api.duration(saved).inBedMinutes,480);assert.equal(a.api.duration(saved).sleepMinutes,450);
 assert.deepEqual(plain(setup(a.data).journal.forDate(date)),plain(saved));
});
test('daytime sleep remains on the wake-up date',()=>{
 const {api}=setup(),prepared=api.prepare(input({bedtime:'09:00',wakeTime:'11:30',awakeMinutes:10}));assert.equal(api.duration(prepared).sleepMinutes,140);
});
test('invalid dates, clock times, awake minutes and ratings cannot change saved data',()=>{
 const a=setup();for(const bad of [{date:'2026-02-30'},{bedtime:'25:00'},{wakeTime:'07:90'},{wakeTime:'23:00'},{awakeMinutes:-1},{awakeMinutes:480},{awakeMinutes:1.5},{quality:0},{quality:6},{fatigue:NaN},{fatigue:'2'}])assert.equal(a.journal.save(input(bad)),false);
 assert.equal(a.journal.entries().length,0);assert.equal(a.data[a.api.key],undefined);
});
test('future nights are refused while valid historical nights can be logged',()=>{
 const a=setup();assert.equal(a.journal.save(input({date:'2026-11-15'})),false);assert.equal(a.journal.save(input({date:'2026-11-01'})),true);
});
test('editing a wake-up date updates the same record instead of duplicating the night',()=>{
 const a=setup();a.journal.save(input());const id=a.journal.forDate(date).id;
 a.journal.save(input({quality:5,awakeMinutes:10}));assert.equal(a.journal.entries().length,1);assert.equal(a.journal.forDate(date).id,id);assert.equal(a.journal.forDate(date).quality,5);
});
test('editing ratings after travel preserves the original recorded UTC offsets',()=>{
 const old=entry({date:'2026-03-29',bedOffset:-60,wakeOffset:-120});
 const a=setup({'forme-recovery-v1':JSON.stringify(document([old]))});
 assert.equal(a.journal.save(input({date:old.date,quality:5})),true);const saved=a.journal.forDate(old.date);
 assert.equal(saved.bedOffset,-60);assert.equal(saved.wakeOffset,-120);assert.equal(a.api.duration(saved).sleepMinutes,390);
});
test('quota failures preserve the prior entry and age setting',()=>{
 const a=setup();a.journal.save(input());const prior=a.data[a.api.key];a.fail(a.api.key);
 assert.equal(a.journal.save(input({quality:5})),false);assert.equal(a.journal.setAgeGroup('older'),false);assert.equal(a.data[a.api.key],prior);assert.equal(a.journal.forDate(date).quality,4);
});
test('corrupted storage drops invalid entries without creating sleep or subjective ratings',()=>{
 const saved={version:1,ageGroup:'bad',entries:[null,entry(),entry({id:'duplicate'}),entry({id:'bad',date:'2026-02-30'}),entry({id:'bad2',date:'2026-11-13',quality:'good'})]};
 const a=setup({'forme-recovery-v1':JSON.stringify(saved)});assert.equal(a.journal.get().ageGroup,'unspecified');assert.equal(a.journal.entries().length,1);assert.equal(a.journal.forDate(date).quality,4);
});
test('the entry cap refuses a new date but still allows edits of an existing night',()=>{
 const entries=Array.from({length:5000},(_,i)=>{const day=new Date(Date.UTC(2000,0,1+i)).toISOString().slice(0,10);return entry({id:'n'+i,date:day});});
 const a=setup({'forme-recovery-v1':JSON.stringify(document(entries))});assert.equal(a.journal.save(input()),false);
 assert.equal(a.journal.save(input({date:entries[0].date,quality:5})),true);assert.equal(a.journal.entries().length,5000);
});
test('delete and undo preserve the entire night and refuse date/ID collisions',()=>{
 const a=setup();a.journal.save(input());const saved=a.journal.forDate(date);assert.equal(a.journal.remove(saved.id),true);
 assert.equal(a.journal.restore(saved),true);assert.equal(a.journal.restore(saved),false);assert.deepEqual(plain(a.journal.forDate(date)),plain(saved));
});
test('weekly averages exclude missing nights rather than imputing zero hours',()=>{
 const a=setup();a.journal.save(input({awakeMinutes:0}));a.journal.save(input({date:'2026-11-13',bedtime:'01:00',awakeMinutes:0,quality:2,fatigue:4}));
 const week=a.journal.week(date),summary=a.journal.summary(date);assert.equal(week.length,7);assert.equal(week.filter(day=>day.sleepMinutes===null).length,5);
 assert.equal(summary.count,2);assert.equal(summary.averageMinutes,420);assert.equal(summary.averageQuality,3);assert.equal(summary.averageFatigue,3);
});
test('week navigation handles year boundaries and empty/invalid dates explicitly',()=>{
 const a=setup();const week=a.journal.week('2026-01-03');assert.equal(week[0].date,'2025-12-28');assert.equal(week[6].date,'2026-01-03');assert.equal(a.journal.week('').length,0);assert.equal(a.journal.forDate('bad'),null);assert.equal(a.journal.summary(date).averageMinutes,null);
});
test('age guidance is optional, bounded and uses the documented ranges',()=>{
 const {api}=setup();assert.equal(api.guidance('adult').minMinutes,420);assert.equal(api.guidance('adult').maxMinutes,540);assert.equal(api.guidance('teen').minMinutes,480);assert.equal(api.guidance('older').maxMinutes,480);assert.equal(api.guidance('unknown').group,'unspecified');
});
test('age preference persists without inventing a night and rejects unsupported values',()=>{
 const a=setup();assert.equal(a.journal.setAgeGroup('teen'),true);assert.equal(a.journal.setAgeGroup('child'),false);assert.equal(setup(a.data).journal.get().ageGroup,'teen');assert.equal(a.journal.entries().length,0);
});
test('JSON export, clear and import preserve all night fields and optional age group',()=>{
 const a=setup();a.journal.setAgeGroup('older');a.journal.save(input());const archive=a.backup.exportData(a.storage),saved=a.data[a.api.key];
 assert.equal(a.backup.validate(JSON.parse(archive)),true);assert.equal(a.backup.summarizeArchive(archive).recoveryEntries,1);
 assert.equal(a.backup.clearData(a.storage),true);assert.equal(a.data[a.api.key],undefined);assert.equal(a.backup.importData(a.storage,archive),true);assert.equal(a.data[a.api.key],saved);
});
test('archive merge adds new dates, keeps local conflicts and renumbers colliding IDs',()=>{
 const a=setup({'forme-recovery-v1':JSON.stringify(document([entry()]))});const incoming=document([entry({quality:1}),entry({date:'2026-11-13',id:'n1',quality:3})]);
 const invalid={app:'FORME',version:1,data:{'forme-recovery-v1':JSON.stringify(incoming)}};assert.equal(a.backup.validate(invalid),false);
 incoming.entries[0].id='other';const archive=JSON.stringify({app:'FORME',version:1,data:{'forme-recovery-v1':JSON.stringify(incoming)}});
 assert.equal(a.backup.mergeData(a.storage,archive),true);assert.equal(a.backup.mergeData(a.storage,archive),true);const result=JSON.parse(a.data['forme-recovery-v1']);assert.equal(result.entries.length,2);assert.equal(result.entries.find(x=>x.date===date).quality,4);assert.equal(new Set(result.entries.map(x=>x.id)).size,2);
});
test('model and independent archive validators agree on valid and malformed sleep records',()=>{
 const a=setup();for(const extra of [{},{bedOffset:-60,wakeOffset:-120},{quality:0},{awakeMinutes:480},{wakeTime:'25:00'},{bedOffset:841},{wakeOffset:0.5},{date:'2026-02-30'},{fatigue:'2'}]){const doc=document([entry(extra)]),archive={app:'FORME',version:1,data:{'forme-recovery-v1':JSON.stringify(doc)}};assert.equal(a.api.validDocument(doc),a.backup.validate(archive),JSON.stringify(extra));}
 const broken=document([entry(),entry({id:'bad',date:'2026-02-30'})]);a.data['forme-recovery-v1']=JSON.stringify(broken);const cleaned=JSON.parse(JSON.parse(a.backup.exportData(a.storage)).data['forme-recovery-v1']);assert.equal(cleaned.entries.length,1);
});
test('a failed archive import rolls back existing recovery and other user data',()=>{
 const a=setup();a.journal.save(input());a.data['forme-favorites']='{"exercises":[],"workouts":[]}';const before={...a.data},incoming={app:'FORME',version:1,data:{'forme-recovery-v1':JSON.stringify(document([entry({quality:5})]))}};
 a.fail('forme-recovery-v1');assert.equal(a.backup.importData(a.storage,JSON.stringify(incoming)),false);assert.deepEqual(a.data,before);
});
test('DST-aware calculations handle spring/fall changes and refuse skipped local times',()=>{
 const code="require('./recovery.js');const api=globalThis.FORME_RECOVERY;const input=date=>({date,bedtime:'23:00',wakeTime:'07:00',awakeMinutes:0});const spring=api.prepare(input('2026-03-29')),fall=api.prepare(input('2026-10-25'));process.stdout.write(JSON.stringify({spring:api.duration(spring).sleepMinutes,fall:api.duration(fall).sleepMinutes,gap:api.prepare({...input('2026-03-29'),wakeTime:'02:30'})}));";
 const result=JSON.parse(execFileSync(process.execPath,['-e',code],{cwd:__dirname,env:{...process.env,TZ:'Europe/Budapest'},encoding:'utf8'}));assert.equal(result.spring,420);assert.equal(result.fall,540);assert.equal(result.gap,null);
});
test('summary exposes observed sleep and self-ratings without a fabricated recovery percentage',()=>{
 const a=setup();a.journal.save(input());assert.deepEqual(Object.keys(a.journal.summary(date)).sort(),['averageFatigue','averageMinutes','averageQuality','count']);assert.equal(a.journal.get().ageGroup,'unspecified');
});
