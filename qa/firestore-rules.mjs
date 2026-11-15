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
process.stdout.write(JSON.stringify({assertions,project,productionRequests:0})+'\n');
