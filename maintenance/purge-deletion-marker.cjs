/* Operator-only maintenance; never imported by the app or run automatically. */
'use strict';
const PROJECT='forme-fitness-83c13',DEMO_PROJECT='demo-forme-sync',MIN_AGE=2*60*60*1000;
const validUid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
function documentName(uid,project=PROJECT){
 if(!validUid(uid))throw Error('invalid-uid');
 if(![PROJECT,DEMO_PROJECT].includes(project))throw Error('invalid-project');
 return `projects/${project}/databases/(default)/documents/users/${uid}/private/snapshot`;
}
function timestampNanos(value){
 // Firestore REST timestamps are UTC RFC3339, with up to nanosecond precision.
 if(typeof value!=='string')throw Error('invalid-server-time');
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
 if(!match||value.startsWith('0000-'))throw Error('invalid-server-time');
 const millis=Date.parse(match[1]+'Z');
 if(!Number.isFinite(millis)||new Date(millis).toISOString().slice(0,19)!==match[1])throw Error('invalid-server-time');
 return BigInt(millis)*1000000n+BigInt((match[2]||'').padEnd(9,'0'));
}
function field(value,key){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!Object.hasOwn(value,key))throw Error('not-a-deletion-marker');
 return value[key];
}
function assess(doc,uid,readTime,project=PROJECT){
 const name=documentName(uid,project);
 if(doc?.name!==name||typeof doc.updateTime!=='string')throw Error('wrong-document');
 const fields=doc.fields,keys=Object.keys(fields||{}).sort();
 if(keys.join(',')!=='deletedAt,format,state'||field(fields.format,'integerValue')!=='2'||field(fields.state,'stringValue')!=='deleting')throw Error('not-a-deletion-marker');
 const deletedAt=timestampNanos(field(fields.deletedAt,'timestampValue')),updatedAt=timestampNanos(doc.updateTime),observedAt=timestampNanos(readTime);
 // No local wall clock is trusted. Preserve sub-millisecond boundary precision.
 if(deletedAt>updatedAt||updatedAt>observedAt||observedAt-updatedAt<BigInt(MIN_AGE)*1000000n)throw Error('retention-not-elapsed');
 return {name,updateTime:doc.updateTime};
}
async function missingUser(userExists,uid){
 const result=await userExists(uid);
 if(result===true)throw Error('auth-user-still-exists');
 if(result!==false)throw Error('invalid-auth-response');
}
async function purge({uid,apply=false,project=PROJECT,loadDocument,userExists,deleteDocument}){
 documentName(uid,project);
 if(typeof apply!=='boolean')throw Error('invalid-apply');
 await missingUser(userExists,uid);
 const snapshot=await loadDocument(uid);
 if(snapshot?.autoAbsent===false)throw Error('automatic-data-remains');
 if(snapshot?.autoAbsent!==true)throw Error('invalid-automatic-state');
 const approved=assess(snapshot?.document,uid,snapshot?.readTime,project);
 if(!apply)return {eligible:true,deleted:false};
 await missingUser(userExists,uid);
 await deleteDocument(approved.name,approved.updateTime);
 return {eligible:true,deleted:true};
}
function createBackend({auth,firestore,project=PROJECT}){
 documentName('validation',project);
 return {
  project,
  async userExists(uid){
   documentName(uid,project);
   const res=await auth.post(`/projects/${project}/accounts:lookup`,{localId:[uid]}),body=res.body;
   if(res.status!==200||!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!['kind','users'].includes(key))||(body.kind!==undefined&&body.kind!=='identitytoolkit#GetAccountInfoResponse')||(body.users!==undefined&&!Array.isArray(body.users)))throw Error('invalid-auth-response');
   if(!body.users?.length)return false;
   if(body.users.length!==1||body.users[0]?.localId!==uid)throw Error('invalid-auth-response');
   return true;
  },
  async loadDocument(uid){
   const name=documentName(uid,project),automatic=name.replace(/\/snapshot$/,'/auto');
   const res=await firestore.post(`/projects/${project}/databases/(default)/documents:batchGet`,{documents:[name,automatic]});
   if(res.status!==200||!Array.isArray(res.body)||res.body.length!==2)throw Error('invalid-snapshot-response');
   const matches=name=>res.body.filter(row=>row?.missing===name||row?.found?.name===name);
   const rows=matches(name),autos=matches(automatic);
   if(rows.length!==1||autos.length!==1)throw Error('invalid-snapshot-response');
   const row=rows[0],auto=autos[0];
   if(Object.hasOwn(row,'missing')||row.found?.name!==name)throw Error('missing-or-wrong-document');
   timestampNanos(row.readTime);timestampNanos(auto.readTime);
   if(Object.hasOwn(auto,'found'))throw Error('automatic-data-remains');
   if(auto.missing!==automatic)throw Error('invalid-automatic-state');
   return {document:row.found,readTime:row.readTime,autoAbsent:true};
  },
  async deleteDocument(name,updateTime){
   // Both conditions are atomic: exact marker version and still no auto data.
   const match=/\/users\/([A-Za-z0-9_-]{1,128})\/private\/snapshot$/.exec(name);
   if(!match||documentName(match[1],project)!==name)throw Error('wrong-document');
   timestampNanos(updateTime);
   const automatic=name.replace(/\/snapshot$/,'/auto');
   const res=await firestore.post(`/projects/${project}/databases/(default)/documents:commit`,{writes:[{verify:automatic,currentDocument:{exists:false}},{delete:name,currentDocument:{updateTime}}]});
   if(res.status!==200||!Array.isArray(res.body?.writeResults)||res.body.writeResults.length!==2)throw Error('delete-not-confirmed');
   timestampNanos(res.body.commitTime);
  }
 };
}
function parseArgs(args){
 let uid,apply=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--uid'&&uid===undefined){uid=args[++i];if(!validUid(uid)||uid.startsWith('--'))throw Error('invalid-uid');}
  else if(args[i]==='--apply'&&!apply)apply=true;
  else throw Error('usage: --uid UID [--apply]');
 }
 if(!validUid(uid))throw Error('invalid-uid');
 return {uid,apply};
}
async function main(){
 const args=parseArgs(process.argv.slice(2));
 const root=process.env.FORME_FIREBASE_TOOLS_ROOT;if(!root)throw Error('set-FORME_FIREBASE_TOOLS_ROOT-to-the-official-CLI-package');
 const {getGlobalDefaultAccount}=require(root+'/lib/auth.js'),{requireAuth}=require(root+'/lib/requireAuth.js'),{Client}=require(root+'/lib/apiv2.js');
 const account=getGlobalDefaultAccount();if(!account)throw Error('Firebase-CLI-login-required');
 await requireAuth({...account,project:PROJECT,nonInteractive:true});
 const firestore=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1',auth:true});
 const auth=new Client({urlPrefix:'https://identitytoolkit.googleapis.com',apiVersion:'v1',auth:true});
 const result=await purge({...args,...createBackend({auth,firestore})});
 process.stdout.write(JSON.stringify(result)+'\n');
}
module.exports={assess,purge,createBackend,parseArgs,timestampNanos,MIN_AGE,PROJECT,DEMO_PROJECT};
if(require.main===module)main().catch(()=>{process.stderr.write('Cleanup refused or failed. No document contents or credentials were logged.\n');process.exitCode=1;});
