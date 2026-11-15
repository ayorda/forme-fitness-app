// Integration assertions target the local demo emulator only; no production data.
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8080',project='demo-forme-sync';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Use the local Firestore emulator at 127.0.0.1:8080');
const url=origin+'/v1/projects/'+project+'/databases/(default)/documents';
const jwt=(uid,verified=true,authAge=3600,extra={})=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,user_id:uid,aud:project,iss:'https://securetoken.google.com/'+project,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,email_verified:verified,auth_time:Math.floor(Date.now()/1000)-authAge,firebase:{sign_in_provider:'password'},...extra})).toString('base64url'),''].join('.');
const cleared=await fetch(origin+'/emulator/v1/projects/'+project+'/databases/(default)/documents',{method:'DELETE'});assert.ok(cleared.ok);
const owner=jwt('athlete-a'),other=jwt('athlete-b'),unverified=jwt('athlete-a',false);
let assertions=0;
const expect=(response,status)=>{assert.equal(response.status,status,JSON.stringify(response.body));assertions++;};
async function call(path,method='GET',token=owner,body){const res=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};}
const fields={format:{integerValue:'1'},revision:{integerValue:'1'},encoding:{stringValue:'raw'},payload:{stringValue:'e30='},rawBytes:{integerValue:'2'},sha256:{stringValue:'a'.repeat(64)}};
const path='users/athlete-a/private/snapshot';
async function write(extra={},token=owner,transforms=['createdAt','updatedAt'],documentPath=path){return call(':commit','POST',token,{writes:[{update:{name:'projects/'+project+'/databases/(default)/documents/'+documentPath,fields:{...fields,...extra}},updateTransforms:transforms.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}]});}
expect(await call('/users/athlete-a/private/snapshot','GET',null),403);
expect(await call('/users/athlete-a/private/snapshot','GET',other),403);
expect(await call('/users/athlete-a/private/snapshot','GET',unverified),403);
expect(await call('/users/athlete-a/private/snapshot','GET',owner),404);
expect(await write({},other),403);expect(await write({},unverified),403);expect(await write({},null),403);
for(const extra of [{isAdmin:{booleanValue:true}},{uid:{stringValue:'athlete-b'}},{payload:{stringValue:'x'.repeat(700001)}},{rawBytes:{integerValue:'12582913'}},{revision:{integerValue:'0'}},{encoding:{stringValue:'unknown'}},{sha256:{stringValue:'invalid'}}])expect(await write(extra),403);
expect(await write({},owner,[]),403);expect(await write({},owner,['createdAt','updatedAt'],'users/athlete-a/private/unapproved'),403);
expect(await write(),200);
const current=await call('/users/athlete-a/private/snapshot');expect(current,200);
const createdAt=current.body.fields.createdAt;
const next={...fields,revision:{integerValue:'2'},createdAt};
expect(await write(next,owner,['updatedAt']),200);
expect(await write(next,owner,['updatedAt']),403); // stale revision
for(const extra of [{isAdmin:{booleanValue:true}},{payload:{stringValue:'x'.repeat(700001)}},{rawBytes:{stringValue:'2'}},{sha256:{stringValue:'bad'}},{revision:{integerValue:'7'}},{createdAt:{timestampValue:'2000-01-01T00:00:00Z'}}])expect(await write({...next,revision:{integerValue:'3'},...extra},owner,['updatedAt']),403);
const omitted={...next,revision:{integerValue:'3'}};delete omitted.sha256;
expect(await call(':commit','POST',owner,{writes:[{update:{name:'projects/'+project+'/databases/(default)/documents/'+path,fields:omitted},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]}),403);
expect(await write({...next,revision:{integerValue:'3'}},other,['updatedAt']),403);
expect(await call('/users/athlete-a/private/snapshot','DELETE',owner),403);
expect(await call('/users/athlete-a/private','GET',other),403);
expect(await call('/users','GET',null),403);expect(await call('/users','GET',owner),403);
expect(await call('/users/athlete-b/private/snapshot','GET',owner),403);
const recent=jwt('athlete-a',true,0),recentUnverified=jwt('unverified-owner',false,0);
async function erase(token,fieldsExtra={},transforms=['deletedAt'],documentPath=path){return call(':commit','POST',token,{writes:[{update:{name:'projects/'+project+'/databases/(default)/documents/'+documentPath,fields:{format:{integerValue:'2'},state:{stringValue:'deleting'},...fieldsExtra}},updateTransforms:transforms.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}]});}
expect(await erase(owner),403);expect(await erase(other),403);expect(await erase(unverified),403);expect(await erase(null),403);
for(const fieldsExtra of [{payload:{stringValue:'must not remain'}},{uid:{stringValue:'other'}},{state:{stringValue:'active'}},{format:{integerValue:'1'}}])expect(await erase(recent,fieldsExtra),403);
expect(await erase(recent,{},[]),403);
expect(await erase(recent,{deletedAt:{timestampValue:'2000-01-01T00:00:00Z'}},[]),403);
expect(await erase(recent),200);
const removed=await call('/users/athlete-a/private/snapshot');expect(removed,200);assert.deepEqual(Object.keys(removed.body.fields).sort(),['deletedAt','format','state']);assertions++;
expect(await write({...next,revision:{integerValue:'3'}},owner,['updatedAt']),403);
expect(await write({...next,revision:{integerValue:'3'}},recent,['updatedAt']),403);
expect(await call('/users/athlete-a/private/snapshot','DELETE',recent),403);
expect(await call('/users/athlete-a/private/snapshot','GET',other),403);
expect(await write({},recentUnverified,['createdAt','updatedAt'],'users/unverified-owner/private/snapshot'),403);
expect(await erase(recentUnverified,{},['deletedAt'],'users/unverified-owner/private/snapshot'),200);
expect(await erase(recent,{},['deletedAt'],'users/other-owner/private/snapshot'),403);
// A signed grant authorizes only an exact owner's reserved probe path.
const until=Math.floor(Date.now()/1000)+3600;
const pro=uid=>jwt(uid,true,3600,{formeAccess:{schema:1,proUntil:until}});
const probe='/users/pro-owner/pro/access';
expect(await call(probe,'GET',null),403);expect(await call(probe,'GET',jwt('pro-owner')),403);
expect(await call(probe,'GET',pro('other-owner')),403);
expect(await call(probe,'GET',jwt('pro-owner',false,3600,{formeAccess:{schema:1,proUntil:until}})),403);
for(const claim of [{schema:1,proUntil:Math.floor(Date.now()/1000)-1},{schema:1,proUntil:String(until)},{schema:1,proUntil:until+.5},{schema:2,proUntil:until},{schema:1,proUntil:until,admin:true},{schema:1},{schema:1,proUntil:4102444801},true,null,[]])expect(await call(probe,'GET',jwt('pro-owner',true,3600,{formeAccess:claim})),403);
expect(await call(probe,'GET',pro('pro-owner')),404); // authorized, no stored document
expect(await call('/users/pro-owner/pro','GET',pro('pro-owner')),403);
expect(await call('/users','GET',pro('pro-owner')),403);
expect(await call('/users/pro-owner/private/snapshot','GET',pro('pro-owner')),404);
expect(await call(probe,'PATCH',pro('pro-owner'),{fields:{isPro:{booleanValue:true}}}),403);
expect(await call(probe,'DELETE',pro('pro-owner')),403);
expect(await call('/users/pro-owner/access/grant','PATCH',jwt('pro-owner'),{fields:{formeAccess:{mapValue:{fields:{schema:{integerValue:'1'},proUntil:{integerValue:String(until)}}}}}}),403);
expect(await call('/users/pro-owner/pro/other','GET',pro('pro-owner')),403);
expect(await call('/users/athlete-a/pro/access','GET',pro('athlete-a')),403); // deletion marker blocks old grant
// Future service fixtures are synthetic and exist ONLY in the demo emulator.
const stamp=n=>({timestampValue:new Date(n).toISOString()}),str=value=>({stringValue:value}),num=value=>({integerValue:String(value)}),bool=value=>({booleanValue:value});
const now=Date.now(),past=stamp(now-60000),future=stamp(now+3600000);
const serviceOwner=jwt('service-client'),coach=jwt('service-coach',true,3600,{formeTrainer:{schema:1,validUntil:until}}),stranger=jwt('service-stranger');
const programGrant={schema:num(1),programId:str('muscle-up'),state:str('active'),grantedAt:past,updatedAt:past};
const programVersion={schema:num(1),programId:str('muscle-up'),versionId:str('v1'),body:{mapValue:{fields:{bg:str('Локален пример'),en:str('Local fixture'),de:str('Lokales Beispiel')}}},updatedAt:past};
const engagement={schema:num(1),clientUid:str('service-client'),coachUid:str('service-coach'),state:str('active'),startsAt:past,endsAt:future,consent:bool(true),consentAt:past,updatedAt:past};
const coachingNote={schema:num(1),engagementId:str('engagement-a'),clientUid:str('service-client'),coachUid:str('service-coach'),kind:str('feedback'),body:str('Local technique fixture'),createdAt:past,updatedAt:past};
const grantPath='/users/service-client/programs/muscle-up',versionPath='/program-content/muscle-up/versions/v1',engagementPath='/coaching/engagement-a',notePath=engagementPath+'/notes/note-a';
async function fixture(path,fields){const response=await call(path,'PATCH','owner',{fields});assert.equal(response.status,200,JSON.stringify(response));}
await fixture(grantPath,programGrant);await fixture(versionPath,programVersion);await fixture(engagementPath,engagement);await fixture(notePath,coachingNote);
for(const target of [grantPath,versionPath,engagementPath,notePath]){
 expect(await call(target,'GET',null),403);expect(await call(target,'GET',stranger),403);expect(await call(target,'GET',jwt('service-client',false)),403);
 expect(await call(target,'GET',serviceOwner),200);
 for(const method of ['PATCH','DELETE'])expect(await call(target,method,serviceOwner,method==='PATCH'?{fields:{schema:num(1)}}:undefined),403);
}
for(const target of ['/users/service-client/programs','/program-content/muscle-up/versions','/coaching',engagementPath+'/notes'])expect(await call(target,'GET',serviceOwner),403);
expect(await call(versionPath,'GET',pro('pro-owner')),403); // Pro does not buy a program
expect(await call(grantPath,'GET',coach),403);expect(await call(versionPath,'GET',coach),403);
expect(await call('/users/service-client/private/snapshot','GET',coach),403); // no trainer access to the cloud archive
for(const target of [engagementPath,notePath]){expect(await call(target,'GET',coach),200);expect(await call(target,'PATCH',coach,{fields:engagement}),403);expect(await call(target,'DELETE',coach),403);expect(await call(target,'GET',jwt('service-coach')),403);expect(await call(target,'GET',jwt('service-coach',false,3600,{formeTrainer:{schema:1,validUntil:until}})),403);expect(await call(target,'GET',jwt('wrong-coach',true,3600,{formeTrainer:{schema:1,validUntil:until}})),403);}
for(const claim of [{schema:1,validUntil:Math.floor(now/1000)-1},{schema:2,validUntil:until},{schema:1,validUntil:String(until)},{schema:1,validUntil:until+.5},{schema:1,validUntil:4102444801},{schema:1,validUntil:until,admin:true},true,null,[]])expect(await call(notePath,'GET',jwt('service-coach',true,3600,{formeTrainer:claim})),403);
// Revoked canonical grants block new reads even with an unchanged signed token.
await fixture(grantPath,{...programGrant,state:str('revoked')});expect(await call(grantPath,'GET',serviceOwner),200);expect(await call(versionPath,'GET',serviceOwner),403);
for(const bad of [{...programGrant,isPro:bool(true)},{...programGrant,programId:str('handstand')},{...programGrant,grantedAt:future},{...programGrant,schema:num(2)}]){await fixture(grantPath,bad);expect(await call(grantPath,'GET',serviceOwner),403);expect(await call(versionPath,'GET',serviceOwner),403);}
await fixture(grantPath,programGrant);
for(const bad of [{...programVersion,versionId:str('v2')},{...programVersion,body:{mapValue:{fields:{en:str('Missing translations')}}}},{...programVersion,updatedAt:future},{...programVersion,price:num(5)}]){await fixture(versionPath,bad);expect(await call(versionPath,'GET',serviceOwner),403);}await fixture(versionPath,programVersion);
// Client retains their own history; trainer loses access at canonical withdrawal,
// pause, ending, future start or server-time expiry, regardless of role JWT age.
for(const change of [{consent:bool(false)},{state:str('paused')},{state:str('ended')},{startsAt:stamp(now+100000)},{startsAt:stamp(now-7200000),endsAt:past}]){
 await fixture(engagementPath,{...engagement,...change});for(const target of [engagementPath,notePath]){expect(await call(target,'GET',coach),403);expect(await call(target,'GET',serviceOwner),200);}
}
for(const bad of [{...engagement,coachUid:str('service-client')},{...engagement,consent:str('true')},{...engagement,consentAt:future},{...engagement,email:str('private@example.com')},{...engagement,endsAt:past}]){await fixture(engagementPath,bad);expect(await call(engagementPath,'GET',serviceOwner),403);expect(await call(notePath,'GET',coach),403);}
await fixture(engagementPath,engagement);
for(const bad of [{...coachingNote,clientUid:str('other')},{...coachingNote,engagementId:str('other')},{...coachingNote,kind:str('diagnosis')},{...coachingNote,body:str('x'.repeat(20001))},{...coachingNote,createdAt:future},{...coachingNote,secret:str('extra')}]){await fixture(notePath,bad);expect(await call(notePath,'GET',serviceOwner),403);expect(await call(notePath,'GET',coach),403);}await fixture(notePath,coachingNote);
expect(await call('/coaching/unassigned/notes/note-a','GET',coach),403);
for(const target of ['/users/service-client/programs/handstand','/program-content/handstand/versions/v1','/coaching/client-created','/coaching/engagement-a/notes/client-created'])expect(await call(target,'PATCH',serviceOwner,{fields:{schema:num(1)}}),403);
await fixture('/users/service-coach/private/snapshot',{format:num(2),state:str('deleting'),deletedAt:past});expect(await call(notePath,'GET',coach),403);expect(await call(notePath,'GET',serviceOwner),200);
await fixture('/users/service-client/private/snapshot',{format:num(2),state:str('deleting'),deletedAt:past});for(const target of [grantPath,versionPath,engagementPath,notePath])expect(await call(target,'GET',serviceOwner),403);expect(await call(engagementPath,'GET',coach),403);

process.stdout.write(JSON.stringify({assertions,project,productionRequests:0})+'\n');
