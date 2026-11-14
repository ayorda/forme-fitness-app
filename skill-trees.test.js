const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function api(){const c={window:{}};vm.createContext(c);for(const name of ['exercise-art.js','data.js','skill-trees.js'])vm.runInContext(fs.readFileSync(name,'utf8'),c);return {skills:c.window.FORME_SKILL_TREES,exercises:c.window.FORME_DATA.exercises};}
const plain=value=>JSON.parse(JSON.stringify(value));
const date='2026-11-14';
const record=(extra={})=>({id:'s1',exerciseId:'Pullups',kind:'reps',value:5,date,...extra});

test('five complete skill pathways are available in Bulgarian, English and German',()=>{
 const {skills}=api();
 for(const language of ['bg','en','de']){
  const trees=skills.localized(language);assert.deepEqual(plain(trees.map(x=>x.id)),['pull-ups','chin-ups','dips','muscle-up','handstand']);
  for(const tree of trees){assert.ok(tree.title.trim());assert.ok(tree.nodes.length>=4);for(const node of tree.nodes){assert.ok(node.title.trim());assert.ok(node.criteria.length>=2);assert.ok(node.criteria.every(x=>typeof x==='string'&&x.trim().length>=20));}}
 }
 const bg=skills.localized('bg')[0],en=skills.localized('en')[0],de=skills.localized('de')[0];assert.notEqual(bg.nodes[0].criteria[0],en.nodes[0].criteria[0]);assert.notEqual(en.nodes[0].criteria[0],de.nodes[0].criteria[0]);
});

test('all practice exercises and evidence metrics match the existing exercise catalog',()=>{
 const {skills,exercises}=api();for(const tree of skills.localized()){
  assert.ok(exercises.some(x=>x.id===tree.targetExerciseId));
  for(const node of tree.nodes){const exercise=exercises.find(x=>x.id===node.exerciseId);assert.ok(exercise,node.exerciseId);assert.equal(node.kind,exercise.defaultMetric);assert.ok(['any','assisted','unassisted'].includes(node.mode));}
  for(const id of tree.relatedExerciseIds)assert.ok(exercises.some(x=>x.id===id));
 }
});

test('pathways have valid acyclic preparation dependencies and expandable goal links',()=>{
 const {skills}=api(),trees=skills.localized(),goalIds=new Set(trees.map(x=>x.id));
 for(const tree of trees){
  const done=new Set();for(const node of tree.nodes){assert.ok(!done.has(node.id));for(const prerequisite of node.requires)assert.ok(done.has(prerequisite),`${tree.id}/${node.id} refers to missing or later prerequisite ${prerequisite}`);done.add(node.id);}
  for(const id of tree.nextGoalIds)assert.ok(goalIds.has(id));
 }
});

test('each preparation stage points to the stages that use it next',()=>{
 const {skills}=api(),tree=skills.pathway('muscle-up');
 assert.ok(tree.nodes.find(x=>x.id==='pull').nextIds.includes('transition'));
 assert.ok(tree.nodes.find(x=>x.id==='pull').nextIds.includes('target'));
 assert.deepEqual(plain(tree.nodes.find(x=>x.id==='target').nextIds),[]);
});

test('assisted, bodyweight and weighted practice are reported as separate conditions',()=>{
 const {skills}=api(),records=[record({id:'a',assistance:'band'}),record({id:'b',weightKg:10}),record({id:'c'})],tree=skills.pathway('pull-ups',records,'bg',date);
 const assisted=tree.nodes.find(x=>x.id==='assisted').evidence,target=tree.nodes.find(x=>x.id==='target').evidence;
 assert.equal(assisted.recordCount,1);assert.equal(assisted.latest.id,'a');assert.equal(target.recordCount,1);assert.equal(target.latest.id,'c');assert.equal(target.otherConditions,2);
});

test('invalid, future, wrong-metric and unrelated records cannot become matching practice',()=>{
 const {skills}=api(),node=skills.localized()[0].nodes.find(x=>x.id==='target');
 const records=[null,{},record({date:'2026-02-30'}),record({date:'2026-11-15'}),record({value:0}),record({kind:'seconds'}),record({exerciseId:'Chinups'}),record({weightKg:NaN}),record({weightKg:1.234}),record({assistance:'x'.repeat(121)})];
 assert.equal(skills.evidence(node,records,date).recordCount,0);
});

test('visits, workout completions and checkboxes never unlock or certify a skill',()=>{
 const {skills}=api(),visits=Array.from({length:100},(_,i)=>({id:'visit'+i,workoutId:'cal-start',date,completed:true,checked:true})),tree=skills.pathway('pull-ups',visits,'en',date);
 assert.ok(tree.nodes.every(x=>x.evidence.recordCount===0));
 for(const node of tree.nodes){assert.equal('unlocked' in node,false);assert.equal('mastered' in node,false);assert.equal('complete' in node,false);}
});

test('a logged target movement does not automatically complete its prerequisites',()=>{
 const {skills}=api(),tree=skills.pathway('muscle-up',[record({exerciseId:'Bar_Muscle_Up'})],'bg',date);
 assert.equal(tree.nodes.find(x=>x.id==='target').evidence.recordCount,1);
 assert.ok(tree.nodes.filter(x=>['pull','push','trunk'].includes(x.id)).every(x=>x.evidence.recordCount===0));
});

test('the latest dated record is selected without mutating journal entries',()=>{
 const {skills}=api(),node=skills.localized()[0].nodes.find(x=>x.id==='target'),records=[record({id:'a',date:'2026-11-01'}),record({id:'b',value:6}),record({id:'c',value:7})],before=JSON.stringify(records),evidence=skills.evidence(node,records,date);
 assert.equal(evidence.latest.id,'c');evidence.latest.value=99;assert.equal(JSON.stringify(records),before);
});

test('localized pathway data is isolated between callers and supports language fallback',()=>{
 const {skills}=api(),tree=skills.localized('de')[0];tree.nodes[0].requires.push('tampered');tree.nextGoalIds.push('tampered');tree.nodes[0].criteria[0]='tampered';
 const fresh=skills.localized('de')[0];assert.ok(!fresh.nodes[0].requires.includes('tampered'));assert.ok(!fresh.nextGoalIds.includes('tampered'));assert.notEqual(fresh.nodes[0].criteria[0],'tampered');assert.equal(skills.localized('unknown')[0].title,skills.localized('bg')[0].title);
});

test('Handstand evidence describes the wall-supported catalog movement without claiming free balance',()=>{
 const {skills}=api(),tree=skills.pathway('handstand',[record({exerciseId:'Handstand',kind:'seconds',value:30})],'en',date),node=tree.nodes.find(x=>x.id==='target');
 assert.equal(node.evidence.recordCount,1);assert.match(node.criteria.join(' '),/wall/);assert.match(node.criteria.join(' '),/does not demonstrate freestanding balance/);
});

test('unknown goals and malformed journal containers are handled without invented progress',()=>{
 const {skills}=api();assert.equal(skills.pathway('unknown'),null);for(const records of [null,{},'junk',[]])assert.ok(skills.pathway('pull-ups',records,'bg',date).nodes.every(x=>x.evidence.recordCount===0));
});
