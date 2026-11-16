const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assess,purge,createBackend,parseArgs,timestampNanos,MIN_AGE,PROJECT}=require('./maintenance/purge-deletion-marker.cjs');
const uid='deleted-user',now='2026-11-15T12:00:00Z';
const marker=(extra={})=>({name:`projects/${PROJECT}/databases/(default)/documents/users/${uid}/private/snapshot`,fields:{format:{integerValue:'2'},state:{stringValue:'deleting'},deletedAt:{timestampValue:'2026-11-15T08:00:00Z'}},updateTime:'2026-11-15T08:00:00Z',...extra});
function setup(extra={}){const calls=[];return {calls,args:{uid,loadDocument:async()=>{calls.push('load');return {document:marker(),readTime:now,autoAbsent:true};},userExists:async()=>{calls.push('auth');return false;},deleteDocument:async(name,version)=>{calls.push(['delete',name,version]);},...extra}};}
test('maintenance dry run requires missing Auth user and an old minimal marker but cannot delete',async()=>{const a=setup();assert.deepEqual(await purge(a.args),{eligible:true,deleted:false});assert.deepEqual(a.calls,['auth','load']);});
test('maintenance apply rechecks Auth and uses the exact document updateTime precondition',async()=>{const a=setup({apply:true});assert.equal((await purge(a.args)).deleted,true);assert.deepEqual(a.calls.slice(0,3),['auth','load','auth']);assert.deepEqual(a.calls[3],['delete',marker().name,marker().updateTime]);});
test('maintenance refuses an active user without reading their archive',async()=>{const a=setup({apply:true,userExists:async()=>true});await assert.rejects(()=>purge(a.args),/auth-user-still-exists/);assert.deepEqual(a.calls,[]);});
test('a failed Auth lookup never means the user is absent',async()=>{const a=setup({apply:true,userExists:async()=>{throw Error('network');}});await assert.rejects(()=>purge(a.args),/network/);assert.deepEqual(a.calls,[]);});
test('maintenance refuses a real archive, extra fields, wrong path and invalid identifiers',()=>{for(const doc of [marker({fields:{format:{integerValue:'1'}}}),marker({fields:{...marker().fields,payload:{stringValue:'private'}}}),marker({name:marker().name.replace(uid,'other-user')})])assert.throws(()=>assess(doc,uid,now));for(const id of ['../other','a/b','',uid+' '.repeat(2)])assert.throws(()=>assess(marker(),id,now));});
test('maintenance enforces the full minimum token lifetime and rejects future or invalid clocks',()=>{assert.equal(MIN_AGE,7200000);for(const time of ['2026-11-15T11:00:00Z','2026-11-16T08:00:00Z','bad'])assert.throws(()=>assess(marker({updateTime:time}),uid,now));assert.throws(()=>assess(marker({fields:{...marker().fields,deletedAt:{timestampValue:'bad'}}}),uid,now));});
test('maintenance refuses a user that reappears before deletion',async()=>{let count=0;const a=setup({apply:true,userExists:async()=>++count===2});await assert.rejects(()=>purge(a.args),/auth-user-still-exists/);assert.equal(a.calls.some(x=>Array.isArray(x)),false);});
test('changed-document preconditions fail closed without retrying unguarded deletion',async()=>{let attempts=0;const a=setup({apply:true,deleteDocument:async()=>{attempts++;throw Error('precondition');}});await assert.rejects(()=>purge(a.args),/precondition/);assert.equal(attempts,1);});

test('operator wall clock cannot authorize a fresh marker',()=>{const original=Date.now;try{Date.now=()=>Date.parse('2099-01-01T00:00:00Z');assert.throws(()=>assess(marker({updateTime:'2026-11-15T11:59:00Z'}),uid,now),/retention-not-elapsed/);}finally{Date.now=original;}});
test('server timestamp comparison retains nanosecond precision at the two-hour boundary',()=>{assert.doesNotThrow(()=>assess(marker({updateTime:'2026-11-15T10:00:00Z'}),uid,now));assert.throws(()=>assess(marker({updateTime:'2026-11-15T10:00:00.000000001Z'}),uid,now),/retention-not-elapsed/);assert.equal(timestampNanos('2026-11-15T10:00:00.000000001Z')-timestampNanos('2026-11-15T10:00:00Z'),1n);});
test('untrusted, missing, invalid calendar and inconsistent server times fail closed',()=>{for(const value of [undefined,null,Date.now(),'2026-02-30T12:00:00Z','2026-11-15T24:00:00Z','2026-11-15T12:00:00+00:00','0000-01-01T00:00:00Z','2026-11-15T12:00:00.1234567890Z'])assert.throws(()=>assess(marker(),uid,value));assert.throws(()=>assess(marker({fields:{...marker().fields,deletedAt:{timestampValue:'2026-11-15T09:00:00Z'}}}),uid,now));assert.doesNotThrow(()=>timestampNanos('2024-02-29T12:00:00.123456789Z'));});
test('non-string UIDs and non-boolean apply cannot start administrative requests',async()=>{for(const value of [undefined,null,42,true,['user']]){const a=setup({uid:value});await assert.rejects(()=>purge(a.args),/invalid-uid/);assert.deepEqual(a.calls,[]);}const a=setup({apply:'false'});await assert.rejects(()=>purge(a.args),/invalid-apply/);assert.deepEqual(a.calls,[]);});
test('malformed Auth absence predicates never count as a missing user',async()=>{for(const result of [undefined,null,0,'',[],{}]){const a=setup({userExists:async()=>result});await assert.rejects(()=>purge(a.args),/invalid-auth-response/);assert.deepEqual(a.calls,[]);}});
test('REST marker fields cannot hide an extra Value discriminator',()=>{for(const key of ['format','state','deletedAt'])assert.throws(()=>assess(marker({fields:{...marker().fields,[key]:{...marker().fields[key],stringValue:'extra'}}}),uid,now));});
test('CLI accepts only one exact UID and an optional apply flag, never a clock or project override',()=>{assert.deepEqual(parseArgs(['--uid',uid]),{uid,apply:false});assert.deepEqual(parseArgs(['--apply','--uid',uid]),{uid,apply:true});for(const args of [[],['--uid'],['--uid','--apply'],['--uid',uid,'--uid','other'],['--uid',uid,'--apply','--apply'],['--uid',uid,'--now','2099'],['--uid',uid,'--project','demo-forme-sync'],['--uid',uid,'extra']])assert.throws(()=>parseArgs(args));});
test('Auth transport recognizes exact lookup results without accepting an unrelated UID',async()=>{let response={status:200,body:{}};const calls=[];const backend=createBackend({auth:{async post(path,data){calls.push([path,data]);return response;}},firestore:{}});assert.equal(await backend.userExists(uid),false);response.body={kind:'identitytoolkit#GetAccountInfoResponse',users:[]};assert.equal(await backend.userExists(uid),false);response.body={users:[{localId:uid}]};assert.equal(await backend.userExists(uid),true);assert.deepEqual(calls[0],[`/projects/${PROJECT}/accounts:lookup`,{localId:[uid]}]);for(const body of [null,[],{error:{}},{note:'incomplete'},{kind:'unexpected'},{users:{}},{users:[{localId:'other'}]},{users:[{localId:uid},{localId:uid}]}]){response={status:200,body};await assert.rejects(()=>backend.userExists(uid),/invalid-auth-response/);}response={status:403,body:{}};await assert.rejects(()=>backend.userExists(uid),/invalid-auth-response/);});
test('transport failures propagate and cannot be mistaken for Auth absence',async()=>{const backend=createBackend({auth:{post:async()=>{throw Error('permission-denied');}},firestore:{}});await assert.rejects(()=>backend.userExists(uid),/permission-denied/);});
const autoName=marker().name.replace(/\/snapshot$/,'/auto');
const batch=()=>[{found:marker(),readTime:now},{missing:autoName,readTime:now}];
test('Firestore batchGet checks both exact documents and preserves marker server readTime',async()=>{
 let response={status:200,body:batch()};const calls=[];const backend=createBackend({auth:{},firestore:{async post(path,data){calls.push([path,data]);return response;}}});
 assert.deepEqual(await backend.loadDocument(uid),{document:marker(),readTime:now,autoAbsent:true});assert.deepEqual(calls[0],[`/projects/${PROJECT}/databases/(default)/documents:batchGet`,{documents:[marker().name,autoName]}]);
 for(const body of [null,{},[],[batch()[0]],[{missing:marker().name,readTime:now},batch()[1]],[{found:marker()},batch()[1]],[{found:marker({name:'wrong'}),readTime:now},batch()[1]],[batch()[0],batch()[0]],[...batch(),batch()[1]]]){response={status:200,body};await assert.rejects(()=>backend.loadDocument(uid));}
});
test('conditional commit atomically verifies auto absence and the exact marker version',async()=>{
 let response={status:200,body:{writeResults:[{},{}],commitTime:now}};const calls=[];const backend=createBackend({auth:{},firestore:{async post(path,body){calls.push([path,body]);return response;}}});
 await backend.deleteDocument(marker().name,marker().updateTime);assert.deepEqual(calls[0],[`/projects/${PROJECT}/databases/(default)/documents:commit`,{writes:[{verify:autoName,currentDocument:{exists:false}},{delete:marker().name,currentDocument:{updateTime:marker().updateTime}}]}]);
 for(const name of [marker().name.replace(PROJECT,'another-project'),marker().name.replace('/private/snapshot','/private/other'),'projects/'+PROJECT+'/databases/(default)'])await assert.rejects(()=>backend.deleteDocument(name,marker().updateTime),/wrong-document/);
 assert.equal(calls.length,1);
 for(const result of [{status:202,body:{}},{status:200,body:{}},{status:200,body:{writeResults:[],commitTime:now}},{status:200,body:{writeResults:[{}],commitTime:now}},{status:200,body:{writeResults:[{},{},{}],commitTime:now}},{status:200,body:{writeResults:[{},{}],commitTime:'invalid'}}]){response=result;await assert.rejects(()=>backend.deleteDocument(marker().name,marker().updateTime));}
});
test('maintenance cannot target arbitrary projects',()=>{assert.throws(()=>createBackend({auth:{},firestore:{},project:'unexpected-project'}),/invalid-project/);assert.throws(()=>assess(marker(),uid,now,'unexpected-project'),/invalid-project/);});

test('operator cleanup must preserve the marker while automatic account data remains',async()=>{
 const a=setup({apply:true,loadDocument:async()=>({document:marker(),readTime:now,autoAbsent:false})});
 await assert.rejects(()=>purge(a.args),/automatic-data-remains/);assert.equal(a.calls.some(Array.isArray),false);
});

test('missing or ambiguous automatic-state evidence never authorizes dry-run or apply',async()=>{
 for(const apply of [false,true])for(const autoAbsent of [undefined,null,0,1,'true',[],{}]){
  const a=setup({apply,loadDocument:async()=>({document:marker(),readTime:now,autoAbsent})});await assert.rejects(()=>purge(a.args),/invalid-automatic-state/);assert.equal(a.calls.some(Array.isArray),false);
 }
});
test('automatic document presence refuses cleanup regardless of its content',async()=>{
 for(const fields of [{},{format:{integerValue:'1'}},{payload:{stringValue:'private records'}}]){
  const backend=createBackend({auth:{},firestore:{async post(){return {status:200,body:[batch()[0],{found:{name:autoName,fields},readTime:now}]};}}});await assert.rejects(()=>backend.loadDocument(uid),/automatic-data-remains/);
 }
});
test('unordered batch rows use marker readTime rather than a later automatic read',async()=>{
 const backend=createBackend({auth:{},firestore:{async post(){return {status:200,body:[{missing:autoName,readTime:'2026-11-20T12:00:00Z'},batch()[0]]};}}});const row=await backend.loadDocument(uid);assert.equal(row.readTime,now);assert.equal(row.autoAbsent,true);
});
test('missing wrong-scope duplicate or contradictory auto rows fail closed',async()=>{
 for(const auto of [{missing:autoName,found:null,readTime:now},{missing:autoName,found:{name:autoName},readTime:now},{missing:autoName.replace(PROJECT,'foreign-project'),readTime:now},{missing:autoName.replace(uid,'foreign-uid'),readTime:now},{missing:autoName},{missing:autoName,readTime:'invalid'},{missing:autoName,readTime:123}]){
  const backend=createBackend({auth:{},firestore:{async post(){return {status:200,body:[batch()[0],auto]};}}});await assert.rejects(()=>backend.loadDocument(uid));
 }
});
test('an automatic-state precondition conflict is not retried as an unguarded deletion',async()=>{
 const calls=[];const backend=createBackend({auth:{},firestore:{async post(path,data){calls.push(data);throw Error('FAILED_PRECONDITION');}}});await assert.rejects(()=>backend.deleteDocument(marker().name,marker().updateTime),/FAILED_PRECONDITION/);assert.equal(calls.length,1);assert.deepEqual(calls[0].writes[0],{verify:autoName,currentDocument:{exists:false}});
});
