const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function api(){const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('workout-audio.js','utf8'),c);return c.window.FORME_WORKOUT_AUDIO;}
function engine(){
 const instances=[];
 class AudioContext{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.nodes=[];this.resumes=0;instances.push(this);}
  node(){const param=()=>({value:0,setTargetAtTime(value){this.value=value;}});const node={gain:param(),frequency:param(),connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};this.nodes.push(node);return node;}
  createGain(){return this.node();}createBiquadFilter(){return this.node();}createOscillator(){return this.node();}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  suspend(){this.state='suspended';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
 }
 return {AudioContext,instances};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('ambient sound is opt-in and creates no audio context before a running enabled yoga session',()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext});
 audio.setSession({running:true,supported:true});
 assert.equal(e.instances.length,0);
 audio.configure({enabled:true});
 assert.equal(e.instances.length,1);
});

test('stored preferences do not autoplay and corrupted settings get bounded defaults',()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:true,volume:1000,mode:'<script>'}});
 assert.equal(e.instances.length,0);
 assert.equal(audio.get().volume,35);assert.equal(audio.get().mode,'auto');
 audio.configure({volume:0});audio.setSession({running:true,supported:true});
 assert.equal(e.instances.length,0);
});

test('workout pause, finish, close and page hiding can stop audio without changing its saved preference',async()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});await flush();
 assert.equal(audio.get().status,'playing');
 audio.stop();assert.equal(e.instances[0].state,'suspended');assert.equal(audio.get().enabled,true);
 audio.setSession({running:true,supported:true});await flush();assert.equal(audio.get().status,'playing');
 audio.setSession({running:false,supported:true});assert.equal(e.instances[0].state,'suspended');
 audio.dispose();assert.equal(e.instances[0].state,'closed');
});

test('calisthenics and mobility sessions stay silent even when music was enabled previously',()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:true}});
 audio.setSession({running:true,supported:false});assert.equal(e.instances.length,0);
});

test('automatic sound follows the yoga style and manual choice overrides it',async()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true,style:'flow'});await flush();
 assert.equal(audio.get().style,'flow');
 audio.configure({mode:'calm'});assert.equal(audio.get().style,'calm');
 audio.setSession({running:true,supported:true,style:'flow'});assert.equal(audio.get().style,'calm');
 assert.equal(e.instances.length,1,'reuse the same audio engine across workout renders');
});

test('volume zero and disabling sound suspend the engine immediately',async()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});await flush();
 audio.configure({volume:0});assert.equal(e.instances[0].state,'suspended');
 audio.configure({volume:40});await flush();assert.equal(e.instances[0].state,'running');
 audio.configure({enabled:false});assert.equal(e.instances[0].state,'suspended');assert.equal(audio.get().status,'off');
});

test('failed preference writes preserve the previous audible settings',async()=>{
 const e=engine(),audio=api().create({AudioContext:e.AudioContext,preferences:{enabled:false,volume:35},save:()=>false});
 audio.setSession({running:true,supported:true});assert.equal(audio.configure({enabled:true,volume:80}),false);
 assert.equal(audio.get().enabled,false);assert.equal(audio.get().volume,35);assert.equal(e.instances.length,0);
});

test('browser autoplay rejection is reported rather than claiming sound is playing',async()=>{
 const e=engine();class Blocked extends e.AudioContext{resume(){return Promise.reject(Error('NotAllowedError'));}}
 const audio=api().create({AudioContext:Blocked,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});await flush();assert.equal(audio.get().status,'blocked');
});

test('unsupported browsers keep the workout usable and report missing sound support',()=>{
 const audio=api().create({preferences:{enabled:true}});
 assert.doesNotThrow(()=>audio.setSession({running:true,supported:true}));assert.equal(audio.get().status,'unavailable');
});

test('a delayed resume cannot restart sound after the workout is closed',async()=>{
 const e=engine();let resolveResume;
 class Slow extends e.AudioContext{resume(){return new Promise(resolve=>{resolveResume=resolve;});}}
 const audio=api().create({AudioContext:Slow,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});audio.stop();resolveResume();await flush();
 assert.equal(audio.get().status,'paused');assert.equal(e.instances[0].state,'suspended');
 assert.equal(e.instances[0].nodes[0].gain.value,0);
});

test('music preferences join the existing schema and survive export, clear and restore',()=>{
 const c={window:{}};vm.createContext(c);
 for(const file of ['storage-schema.js','backup.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 const values={};const storage={getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>{delete values[k];}};
 const schema=c.window.FORME_STORAGE_SCHEMA.create(storage),backup=c.window.FORME_BACKUP;
 assert.equal(schema.save('music',{enabled:true,volume:27,mode:'flow'}),true);
 const archive=backup.exportData(storage);assert.equal(backup.validate(JSON.parse(archive)),true);
 backup.clearData(storage);assert.equal(storage.getItem('forme-music'),null);
 assert.equal(backup.importData(storage,archive),true);
 assert.equal(JSON.parse(storage.getItem('forme-music')).volume,27);
 backup.clearData(storage);assert.equal(backup.mergeData(storage,archive),true);
 assert.equal(JSON.parse(storage.getItem('forme-music')).volume,27);
 c.window.FORME_STORAGE_SCHEMA.create(storage).save('music',{enabled:false,volume:55,mode:'calm'});
 assert.equal(backup.mergeData(storage,archive),true);assert.equal(JSON.parse(storage.getItem('forme-music')).volume,55);
});

test('archive import refuses invalid audio settings instead of applying corrupted preferences',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('backup.js','utf8'),c);
 for(const settings of [{enabled:'yes',volume:35,mode:'auto'},{enabled:true,volume:-1,mode:'calm'},{enabled:true,volume:35,mode:'javascript:bad'}]){
  const payload={app:'FORME',version:1,data:{'forme-music':JSON.stringify(settings)}};
  assert.equal(c.window.FORME_BACKUP.validate(payload),false);
 }
});


function recordings(){
 const e=engine(),requests=[];
 class Recorded extends e.AudioContext{
  createBufferSource(){const node=this.node();node.buffer=null;return node;}
  decodeAudioData(){return Promise.resolve({duration:80,numberOfChannels:2});}
 }
 const fetch=async(url,options)=>{requests.push({url,...options});return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(16)};};
 return {...e,AudioContext:Recorded,requests,fetch};
}

test('only the chosen original recording downloads, loops, pauses and resumes in one engine',async()=>{
 const e=recordings(),audio=api().create({AudioContext:e.AudioContext,fetch:e.fetch,preferences:{enabled:true}});
 assert.equal(e.requests.length,0);
 audio.setSession({running:true,supported:true,style:'flow'});await flush();
 assert.equal(e.requests.length,1);assert.match(e.requests[0].url,/flow-v1.m4a$/);
 assert.equal(audio.get().source,'recording');
 const source=e.instances[0].nodes.find(n=>n.buffer);assert.equal(source.loop,true);
 for(let i=0;i<10;i++)audio.setSession({running:true,supported:true,style:'flow'});
 audio.configure({volume:22});await flush();assert.equal(e.requests.length,1);
 audio.stop();assert.equal(source.stopped,true);assert.equal(source.disconnected,true);
 audio.setSession({running:true,supported:true,style:'flow'});await flush();assert.equal(audio.get().source,'recording');assert.equal(e.requests.length,1);
 assert.equal(e.instances.length,1);
});

test('network and decoding failures keep an audible fallback, with retry on the next session',async()=>{
 for(const decodeFailure of [false,true]){
  const e=recordings();let calls=0;
  class Codec extends e.AudioContext{decodeAudioData(){return Promise.reject(Error('unsupported codec'));}}
  const fetch=decodeFailure?e.fetch:async()=>{calls++;throw Error('offline');};
  const audio=api().create({AudioContext:decodeFailure?Codec:e.AudioContext,fetch,preferences:{enabled:true}});
  audio.setSession({running:true,supported:true});await flush();
  assert.equal(audio.get().status,'playing');assert.equal(audio.get().source,'synth');
  const before=decodeFailure?e.requests.length:calls;
  for(let i=0;i<8;i++)audio.setSession({running:true,supported:true});await flush();
  assert.equal(decodeFailure?e.requests.length:calls,before,'do not repeatedly download a failed track on renders');
  audio.stop();audio.setSession({running:true,supported:true});await flush();assert.equal(decodeFailure?e.requests.length:calls,before+1);
 }
});

test('a stale download or decode cannot play after close, replacement or disposal',async()=>{
 for(const action of ['stop','switch','dispose']){
  const e=recordings();let finish;
  class SlowDecode extends e.AudioContext{decodeAudioData(){return new Promise(resolve=>{finish=resolve;});}}
  const audio=api().create({AudioContext:SlowDecode,fetch:e.fetch,preferences:{enabled:true}});
  audio.setSession({running:true,supported:true,style:'calm'});await flush();const stale=finish;
  if(action==='switch')audio.configure({mode:'relax'});else audio[action]();
  stale({duration:80,numberOfChannels:2});await flush();
  assert.equal(e.instances[0].nodes.filter(n=>n.buffer).length,0);
  if(action==='switch'){finish({duration:80,numberOfChannels:2});await flush();assert.equal(audio.get().style,'relax');assert.equal(audio.get().source,'recording');}
 }
});

test('closing before the fetch microtask starts makes no recording request',async()=>{
 const e=recordings(),audio=api().create({AudioContext:e.AudioContext,fetch:e.fetch,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});audio.stop();await flush();assert.equal(e.requests.length,0);
});

test('a real late resume is suspended when the session was stopped meanwhile',async()=>{
 const e=engine();let finish;
 class Slow extends e.AudioContext{resume(){return new Promise(resolve=>{finish=()=>{this.state='running';resolve();};});}}
 const audio=api().create({AudioContext:Slow,preferences:{enabled:true}});
 audio.setSession({running:true,supported:true});audio.stop();finish();await flush();assert.equal(e.instances[0].state,'suspended');
});

test('unsafe recording responses fall back without claiming a recorded track',async()=>{
 for(const response of [{ok:false},{ok:true,headers:{get:()=>3000000}},{ok:true,headers:{get:()=>null},arrayBuffer:async()=>new ArrayBuffer(2000001)}]){
  const e=recordings(),audio=api().create({AudioContext:e.AudioContext,fetch:async()=>response,preferences:{enabled:true}});
  audio.setSession({running:true,supported:true});await flush();assert.equal(audio.get().source,'synth');assert.equal(audio.get().status,'playing');
 }
});

test('breathing and relaxation choices validate in backups while old modes remain valid',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('backup.js','utf8'),c);
 for(const mode of ['auto','calm','flow','breath','relax']){
  assert.equal(c.window.FORME_BACKUP.validate({app:'FORME',version:1,data:{'forme-music':JSON.stringify({enabled:true,volume:25,mode})}}),true);
  assert.equal(api().preferences({mode}).mode,mode);
  const values=new Map([['forme-music',JSON.stringify({enabled:true,volume:25,mode})]]),restored=new Map();
  const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  assert.equal(c.window.FORME_BACKUP.importData(storage(restored),c.window.FORME_BACKUP.exportData(storage(values))),true);assert.equal(JSON.parse(restored.get('forme-music')).mode,mode);
 }
});

test('recording catalogue matches shipped original scores and their immutable hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync('media/yoga-music/manifest.json','utf8'));
 const crypto=require('node:crypto');assert.equal(manifest.files.length,4);
 assert.deepEqual(JSON.parse(JSON.stringify(api().tracks)),manifest.files.map(({id,src})=>({id,src})));
 for(const entry of manifest.files){const bytes=fs.readFileSync(entry.src);assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);assert.equal(entry.seconds,80);assert.ok(bytes.length<1200000);}
});
