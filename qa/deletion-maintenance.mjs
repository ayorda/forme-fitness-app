// Destructive fixture tests are restricted to local demo emulators, never production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import maintenance from '../maintenance/purge-deletion-marker.cjs';
const {createBackend,purge,DEMO_PROJECT:project}=maintenance;
const authOrigin='http://127.0.0.1:9099',firestoreOrigin='http://127.0.0.1:8080';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Use the local demo Auth and Firestore emulators only');
let requests=0,assertions=0;
async function call(origin,path,method='GET',body,query={}){
 const url=new URL((origin===authOrigin?'/identitytoolkit.googleapis.com/v1':'/v1')+path,origin);
 if(![authOrigin,firestoreOrigin].includes(url.origin))throw Error('Non-loopback request refused');
 for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
 requests++;
 const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await response.text(),result={status:response.status,body:text?JSON.parse(text):{}};
 if(!response.ok){const error=Error(result.body.error?.message||'local-request-failed');error.status=response.status;throw error;}
 return result;
}
const client=origin=>({post:(path,body)=>call(origin,path,'POST',body),delete:(path,options)=>call(origin,path,'DELETE',undefined,options?.queryParams)});
const backend=createBackend({auth:client(authOrigin),firestore:client(firestoreOrigin),project});
const base=`/projects/${project}/databases/(default)/documents`;
const name=uid=>`projects/${project}/databases/(default)/documents/users/${uid}/private/snapshot`;
const path=uid=>base+`/users/${uid}/private/snapshot`;
async function marker(uid,extra={}){
 return call(firestoreOrigin,path(uid),'PATCH',{fields:{format:{integerValue:'2'},state:{stringValue:'deleting'},deletedAt:{timestampValue:'2020-01-01T00:00:00Z'},...extra}});
}
async function absent(uid){await assert.rejects(()=>backend.loadDocument(uid),/missing-or-wrong-document/);assertions++;}
async function present(uid){const result=await backend.loadDocument(uid);assert.equal(result.document.name,name(uid));assertions++;return result;}
async function refused(promise,pattern){await assert.rejects(()=>promise,pattern);assertions++;}
// Simulate elapsed retention only in this test wrapper. Production uses untouched readTime.
const aged={...backend,async loadDocument(uid){const row=await backend.loadDocument(uid);return {...row,readTime:new Date(Date.parse(row.readTime)+3*60*60*1000).toISOString()};}};
const created=[];
try{
 const signup=await call(authOrigin,'/accounts:signUp','POST',{email:`cleanup-${randomUUID()}@example.com`,password:randomUUID()+'aA1!',returnSecureToken:true},{key:'AIza'+'A'.repeat(35)});
 const active=signup.body.localId;created.push(active);await marker(active);
 await refused(purge({uid:active,apply:true,...aged}),/auth-user-still-exists/);
 await present(active);
 await call(authOrigin,`/projects/${project}/accounts:delete`,'POST',{localId:active});
 assert.equal(await backend.userExists(active),false);assertions++;
 await refused(purge({uid:active,apply:true,...backend}),/retention-not-elapsed/);
 await present(active);
 assert.deepEqual(await purge({uid:active,...aged}),{eligible:true,deleted:false});assertions++;
 await present(active);
 assert.deepEqual(await purge({uid:active,apply:true,...aged}),{eligible:true,deleted:true});assertions++;
 await absent(active);

 const conflict='cleanup-conflict-'+randomUUID();created.push(conflict);await marker(conflict);
 await refused(purge({uid:conflict,apply:true,...aged,async deleteDocument(document,version){const changed=await marker(conflict,{deletedAt:{timestampValue:'2021-01-01T00:00:00Z'}});assert.notEqual(changed.body.updateTime,version);await backend.deleteDocument(document,version);}}),error=>error.status===400||error.status===409||error.status===412);
 await present(conflict);

 const realArchive='cleanup-archive-'+randomUUID();created.push(realArchive);
 await marker(realArchive,{format:{integerValue:'1'},payload:{stringValue:'must-not-delete'}});
 await refused(purge({uid:realArchive,apply:true,...aged}),/not-a-deletion-marker/);
 await present(realArchive);
 const extra='cleanup-extra-'+randomUUID();created.push(extra);await marker(extra,{payload:{stringValue:'must-not-delete'}});
 await refused(purge({uid:extra,apply:true,...aged}),/not-a-deletion-marker/);await present(extra);

 const broken='cleanup-auth-failure-'+randomUUID();created.push(broken);await marker(broken);
 const unauthorized=createBackend({project,firestore:client(firestoreOrigin),auth:{async post(){return {status:403,body:{error:{message:'denied'}}};}}});
 await refused(purge({uid:broken,apply:true,...aged,userExists:unauthorized.userExists}),/invalid-auth-response/);await present(broken);
 const missing='cleanup-missing-'+randomUUID();await refused(purge({uid:missing,apply:true,...aged}),/missing-or-wrong-document/);
 process.stdout.write(JSON.stringify({assertions,requests,project,elapsedRetention:'simulated-only-in-test',productionRequests:0,productionDeletes:0})+'\n');
}finally{
 // Clean only this test's exact fixture documents. Never flush the shared emulator.
 for(const uid of created){try{await call(firestoreOrigin,path(uid),'DELETE');}catch(error){if(error.status!==404)throw error;}}
}
