const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function setup(){const window={},calls=[];vm.runInNewContext(fs.readFileSync('firebase-client.js','utf8'),{window});const sdk={memoryLocalCache:()=>({kind:'memory'}),initializeFirestore(app,options){calls.push(['init',app,options.localCache.kind]);return {app};},connectFirestoreEmulator(db,host,port){calls.push(['emulator',host,port]);}};return {api:window.FORME_FIRESTORE,sdk,calls,app:{}};}
test('shared Firestore registry has no initialization side effects',()=>{const a=setup();assert.deepEqual(a.calls,[]);});
test('cloud and rights contexts for one App reuse exactly one memory-only Firestore',()=>{const a=setup(),one=a.api.database(a),two=a.api.database({...a});assert.equal(one,two);assert.equal(a.calls.length,1);assert.equal(a.calls[0][2],'memory');});
test('different App instances do not share a database',()=>{const a=setup();assert.notEqual(a.api.database(a),a.api.database({...a,app:{}}));assert.equal(a.calls.length,2);});
test('emulator connection happens exactly once before database reuse',()=>{const a=setup();a.api.database({...a,emulator:true});a.api.database({...a,emulator:true});assert.deepEqual(a.calls[1],['emulator','127.0.0.1',8080]);assert.equal(a.calls.length,2);});
test('missing or conflicting SDK/emulator contexts cannot silently create a second registry',()=>{const a=setup();assert.throws(()=>a.api.database(null));assert.throws(()=>a.api.database({app:{}}));a.api.database(a);assert.throws(()=>a.api.database({...a,sdk:{}}),/mismatch/);assert.throws(()=>a.api.database({...a,emulator:true}),/mismatch/);assert.equal(a.calls.length,1);});
