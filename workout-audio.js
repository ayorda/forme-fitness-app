/* Original FORME scores, loaded on demand. Local synthesis covers unavailable files. */
(function(root){
'use strict';
const styles=Object.freeze(['calm','flow','breath','relax']);
const modes=Object.freeze(['auto',...styles]);
const tracks=Object.freeze(styles.map(id=>Object.freeze({id,src:'media/yoga-music/'+id+'-v1.m4a'})));
function preferences(value){
 const source=value&&typeof value==='object'?value:{};
 return {enabled:source.enabled===true,volume:Number.isInteger(source.volume)&&source.volume>=0&&source.volume<=100?source.volume:35,mode:modes.includes(source.mode)?source.mode:'auto'};
}
function create(options={}){
 let prefs=preferences(options.preferences),session={running:false,supported:false,style:'calm'};
 let context=null,master=null,synth=null,voices=[],status='off',revision=0,pending=false,disposed=false;
 let buffer=null,bufferStyle=null,file=null,fileGain=null,offset=0,startedAt=0;
 let mediaRevision=0,controller=null,loadingStyle=null,failedStyle=null,decodeQueue=Promise.resolve();
 const style=()=>prefs.mode==='auto'?session.style:prefs.mode;
 const wanted=()=>!disposed&&session.running&&session.supported&&prefs.enabled&&prefs.volume>0;
 const snapshot=()=>({...prefs,status,style:style(),source:file?'recording':'synth'});
 const notify=()=>options.onState?.(snapshot());
 function volume(){if(master)master.gain.setTargetAtTime(wanted()?prefs.volume/100*.45:0,context.currentTime,.08);}
 function tune(){
  const notes={calm:[130.813,164.814,195.998,261.626],flow:[146.832,174.614,220,293.665],breath:[130.813,195.998,261.626,293.665],relax:[110,164.814,246.942,329.628]}[style()];
  voices.forEach((voice,i)=>voice.frequency.setTargetAtTime(notes[i],context.currentTime,2));
 }
 function stopFile(){
  if(!file)return;
  offset=(offset+Math.max(0,context.currentTime-startedAt))%buffer.duration;
  try{file.stop();file.disconnect();fileGain.disconnect();}catch{}
  file=null;fileGain=null;
 }
 function cancelLoad(){mediaRevision++;controller?.abort();controller=null;loadingStyle=null;}
 function clearBuffer(){stopFile();buffer=null;bufferStyle=null;offset=0;}
 function prepare(){
  if(context&&context.state!=='closed')return;
  const AudioEngine=options.AudioContext||root.AudioContext||root.webkitAudioContext;
  if(!AudioEngine)throw Error('unavailable');
  context=new AudioEngine();master=context.createGain();master.gain.value=0;master.connect(context.destination);
  synth=context.createGain();synth.gain.value=.38;
  const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=950;
  synth.connect(filter);filter.connect(master);
  voices=[0,1,2,3].map(i=>{
   const voice=context.createOscillator(),level=context.createGain(),breath=context.createOscillator(),depth=context.createGain();
   voice.type='sine';level.gain.value=.22-i*.025;
   breath.frequency.value=.055+i*.009;depth.gain.value=.055;
   breath.connect(depth);depth.connect(level.gain);voice.connect(level);level.connect(synth);
   voice.start();breath.start();return voice;
  });
  tune();
 }
 function startFile(){
  if(file||!buffer||!wanted()||bufferStyle!==style()||context.state!=='running')return;
  try{
   file=context.createBufferSource();file.buffer=buffer;file.loop=true;
   fileGain=context.createGain();fileGain.gain.value=0;file.connect(fileGain);fileGain.connect(master);
   startedAt=context.currentTime;file.start(0,offset%buffer.duration);
   fileGain.gain.setTargetAtTime(1,context.currentTime,.15);synth.gain.setTargetAtTime(0,context.currentTime,.15);notify();
  }catch{stopFile();clearBuffer();failedStyle=style();synth.gain.setTargetAtTime(.38,context.currentTime,.15);notify();}
 }
 function ensureTrack(){
  const selected=style();
  if(bufferStyle===selected&&buffer){startFile();return;}
  if(loadingStyle===selected)return;
  if(bufferStyle!==selected){clearBuffer();synth.gain.setTargetAtTime(.38,context.currentTime,.15);}
  if(failedStyle===selected)return;
  cancelLoad();
  const fetcher=options.fetch||root.fetch?.bind(root),Abort=options.AbortController||root.AbortController;
  if(!fetcher||!context.decodeAudioData){failedStyle=selected;return;}
  controller=Abort?new Abort():null;loadingStyle=selected;
  const token=mediaRevision,engine=context,signal=controller?.signal;
  const valid=()=>token===mediaRevision&&engine===context&&wanted()&&style()===selected;
  Promise.resolve().then(()=>valid()?fetcher(tracks.find(track=>track.id===selected).src,{signal}):null).then(response=>{
   if(!valid())return null;
   if(!response.ok||Number(response.headers?.get('Content-Length')||0)>2000000)throw Error('audio response');
   return response.arrayBuffer();
  }).then(bytes=>{
   if(!valid()||!bytes)return null;
   if(bytes.byteLength>2000000)throw Error('audio size');
   // Rapid style changes must not decode multiple large PCM buffers in parallel.
   const task=decodeQueue.then(()=>valid()?engine.decodeAudioData(bytes):null);
   decodeQueue=task.then(()=>undefined,()=>undefined);
   return task;
  }).then(decoded=>{
   if(!valid()||!decoded)return;
   if(!Number.isFinite(decoded.duration)||decoded.duration<1||decoded.duration>90||decoded.numberOfChannels>2)throw Error('audio duration');
   loadingStyle=null;controller=null;buffer=decoded;bufferStyle=selected;offset=0;startFile();
  }).catch(()=>{
   if(!valid())return;
   loadingStyle=null;controller=null;failedStyle=selected;
   synth.gain.setTargetAtTime(.38,context.currentTime,.15);notify();
  });
 }
 function reconcile(){
  if(!wanted()){
   revision++;pending=false;cancelLoad();failedStyle=null;stopFile();volume();
   if(!session.supported)clearBuffer();
   if(context&&context.state!=='closed')try{Promise.resolve(context.suspend()).catch(()=>{});}catch{}
   status=prefs.enabled?'paused':'off';notify();return;
  }
  try{
   prepare();tune();
   if(status==='playing'&&context.state==='running'){ensureTrack();volume();notify();return;}
   if(pending){ensureTrack();return;}
   const token=++revision,engine=context;pending=true;status='loading';notify();
   // Resume during the gesture, before any fetch/decode await (including iOS).
   Promise.resolve(engine.resume()).then(()=>{
    if(token!==revision){if(engine===context&&!wanted())Promise.resolve(engine.suspend()).catch(()=>{});return;}
    pending=false;if(!wanted())return;
    status=engine.state==='running'?'playing':'blocked';ensureTrack();volume();notify();
   }).catch(()=>{if(token!==revision)return;pending=false;status='blocked';notify();});
   ensureTrack();
  }catch{pending=false;status='unavailable';notify();}
 }
 function configure(change){
  const next=preferences({...prefs,...change});
  if(options.save&&options.save(next)!==true){notify();return false;}
  prefs=next;reconcile();return true;
 }
 function setSession(value){
  session={running:value?.running===true,supported:value?.supported===true,style:styles.includes(value?.style)?value.style:'calm'};reconcile();
 }
 function stop(){session.running=false;reconcile();}
 function dispose(){stop();disposed=true;clearBuffer();revision++;if(context)try{Promise.resolve(context.close()).catch(()=>{});}catch{}context=null;master=null;synth=null;voices=[];}
 return Object.freeze({get:snapshot,configure,setSession,stop,dispose});
}
root.FORME_WORKOUT_AUDIO=Object.freeze({create,preferences,modes,tracks});
})(typeof window!=='undefined'?window:globalThis);
