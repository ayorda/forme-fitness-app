const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('./state-normalizer.js');
const known={foods:['rice','egg'],workouts:['cal-start','yoga-reset'],exercises:['Pushups','Plank']};
const norm=api.create(known);

test('favorites keep only unique known string IDs and repair wrong types',()=>{
 assert.deepEqual(norm.favorites(null),{exercises:[],workouts:[]});
 assert.deepEqual(norm.favorites('junk'),{exercises:[],workouts:[]});
 assert.deepEqual(norm.favorites({workouts:5,exercises:[null,7,{}]}),{exercises:[],workouts:[]});
 const fixed=norm.favorites({exercises:['Pushups','Pushups','removed-exercise','Plank',7],workouts:['cal-start','gone']});
 assert.deepEqual(fixed.exercises,['Pushups','Plank']);
 assert.deepEqual(fixed.workouts,['cal-start']);
});

test('a weekly plan accepts only real weekdays and catalog workouts',()=>{
 assert.deepEqual(norm.plan('junk'),{});
 assert.deepEqual(norm.plan({mon:'cal-start',tue:'removed',wed:7,thu:'',sun:'yoga-reset',funday:'cal-start'}),{mon:'cal-start',sun:'yoga-reset'});
});

test('date plans need a real date and either rest or a known workout',()=>{
 assert.deepEqual(norm.datePlans([]),{});
 const fixed=norm.datePlans({'2026-11-09':'cal-start','2026-11-10':'','2026-02-30':'cal-start','bad':'cal-start','2026-11-11':'removed'});
 assert.deepEqual(fixed,{'2026-11-09':'cal-start','2026-11-10':''});
});

test('completion marks need a valid date, ID and visible name',()=>{
 assert.deepEqual(norm.completed({'2026-11-09':{id:'cal-start',name:'Силна основа'},'2026-11-10':{id:5,name:'x'},'bad':{id:'a',name:'b'},'2026-11-11':{id:'a',name:'  '}}),
  {'2026-11-09':{id:'cal-start',name:'Силна основа'}});
});

test('a meal drops unknown foods and invalid amounts instead of breaking the calculator',()=>{
 for(const broken of [{'a':1},'junk',7,null,[{id:'rice'}],[{grams:'100'}],[{id:'rice',grams:'0'}],[{id:'removed',grams:'100'}]])
  assert.deepEqual(norm.meal(broken),[],JSON.stringify(broken));
 assert.deepEqual(norm.meal([{id:'rice',grams:'150'},{id:'egg',grams:' 50 '},{id:'egg',grams:'1 0'},{id:'rice',grams:'10001'}]),
  [{id:'rice',grams:'150'},{id:'egg',grams:' 50 '}]);
 assert.equal(norm.meal(Array.from({length:300},()=>({id:'rice',grams:'100'}))).length,100);
});

test('saved meals need a name and at least one valid product',()=>{
 assert.deepEqual(norm.savedMeals([{name:5}]),[]);
 assert.deepEqual(norm.savedMeals([{name:'Empty',items:[]},{name:'   ',items:[{id:'rice',grams:'100'}]}]),[]);
 const fixed=norm.savedMeals([{name:'  Lunch ',items:[{id:'rice',grams:'100'},{id:'removed',grams:'50'}]}]);
 assert.equal(fixed.length,1);assert.equal(fixed[0].name,'Lunch');assert.equal(fixed[0].items.length,1);
});

test('a stored sound setting is only false when it was explicitly false',()=>{
 assert.equal(norm.sound(false),false);assert.equal(norm.sound('no'),true);assert.equal(norm.sound(undefined),true);
});

test('completed trims workout names and savedMeals validates trimmed 70-char limit',()=>{
 const done=norm.completed({'2026-11-09':{id:'cal-start',name:'  Силна основа  '},'2026-11-10':{id:'cal-start',name:'   '}});
 assert.equal(done['2026-11-09'].name,'Силна основа');
 assert.equal(done['2026-11-10'],undefined);
 const exact70='А'.repeat(70);
 const saved=norm.savedMeals([{name:'  '+exact70+'  ',items:[{id:'egg',grams:100}]}]);
 assert.equal(saved.length,1);
 assert.equal(saved[0].name,exact70);
});


test('date and amount helpers reject impossible values',()=>{
 for(const value of ['2026-11-09','2024-02-29'])assert.equal(norm.validDate(value),true,value);
 for(const value of ['2026-02-30','2026-11-9','','2026-13-01',null,20261109])assert.equal(norm.validDate(value),false,String(value));
 for(const value of ['150',' 150 ','12,5','0.5'])assert.equal(norm.grams(value),true,String(value));
 for(const value of ['0','','abc','10001','-5','1e3'])assert.equal(norm.grams(value),false,String(value));
});
