const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('interface-translations.js','utf8'),context);
const api=context.window.FORME_INTERFACE_TRANSLATIONS;
test('prepared interface messages exist for all three languages with matching variables',()=>{
 assert.ok(api.keys.length>=100);
 const names=['exercises','workouts','foods','minutes','rounds','found','total','food','count','workout','exercise','month','index','day'];
 const values=Object.fromEntries(names.map(name=>[name,`§${name}§`]));
 for(const key of api.keys){let expected;
  for(const language of ['bg','en','de']){
   const result=api.get(key,language,values);assert.ok(result,key+' '+language);assert.doesNotMatch(result,/\{[a-zA-Z]+\}/,key+' '+language);
   const used=(result.match(/§[a-zA-Z]+§/g)||[]).sort().join(',');if(expected===undefined)expected=used;else assert.equal(used,expected,key+' '+language);
  }
 }
});
test('unknown messages, unsupported languages and missing values fail explicitly',()=>{
 assert.equal(api.get('unknown','en'),null);assert.equal(api.get('nav.home','fr'),null);
 assert.equal(api.get('home.libraryCount','de',{exercises:1}),null);
 assert.equal(api.get('plan.recorded','en',{workout:'Training'}),'Marked as completed: Training');
});
