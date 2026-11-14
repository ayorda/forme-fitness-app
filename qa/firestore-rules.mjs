// Integration assertions target the local demo emulator only; no production data.
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8080',project='demo-forme-sync';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')throw Error('Use the local Firestore emulator at 127.0.0.1:8080');
const url=origin+'/v1/projects/'+project+'/databases/(default)/documents';
const jwt=(uid,verified=true)=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:uid,user_id:uid,aud:project,iss:'https://securetoken.google.com/'+project,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,email_verified:verified,firebase:{sign_in_provider:'password'}})).toString('base64url'),''].join('.');
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
process.stdout.write(JSON.stringify({assertions,project,productionRequests:0})+'\n');
