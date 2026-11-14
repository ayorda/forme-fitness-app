/* Original, locally synthesized ambient sound. No downloads or external services. */
(function(root){
'use strict';
const modes=Object.freeze(['auto','calm','flow']);
function preferences(value){
 const source=value&&typeof value==='object'?value:{};
 return {enabled:source.enabled===true,volume:Number.isInteger(source.volume)&&source.volume>=0&&source.volume<=100?source.volume:35,mode:modes.includes(source.mode)?source.mode:'auto'};
}
function create(options={}){
 let prefs=preferences(options.preferences),session={running:false,supported:false,style:'calm'};
 let context=null,master=null,voices=[],status='off',revision=0,pending=false;
 const notify=()=>options.onState?.(snapshot());
 const wanted=()=>session.running&&session.supported&&prefs.enabled&&prefs.volume>0;
 function snapshot(){return {...prefs,status,style:prefs.mode==='auto'?session.style:prefs.mode};}
 function volume(){if(master)master.gain.setTargetAtTime(wanted()?prefs.volume/100*0.17:0,context.currentTime,0.12);}
 function tune(){
  const notes=(prefs.mode==='auto'?session.style:prefs.mode)==='flow'?[146.832,174.614,220,293.665]:[130.813,164.814,195.998,261.626];
  voices.forEach((voice,i)=>voice.frequency.setTargetAtTime(notes[i],context.currentTime,2));
 }
 function prepare(){
  if(context&&context.state!=='closed')return;
  const AudioEngine=options.AudioContext||root.AudioContext||root.webkitAudioContext;
  if(!AudioEngine)throw Error('unavailable');
  context=new AudioEngine();
  master=context.createGain();master.gain.value=0;
  const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=950;
  master.connect(filter);filter.connect(context.destination);
  voices=[0,1,2,3].map(i=>{
   const voice=context.createOscillator(),level=context.createGain(),breath=context.createOscillator(),depth=context.createGain();
   voice.type='sine';level.gain.value=0.22-i*0.025;
   breath.frequency.value=0.055+i*0.009;depth.gain.value=0.055;
   breath.connect(depth);depth.connect(level.gain);voice.connect(level);level.connect(master);
   voice.start();breath.start();return voice;
  });
  tune();
 }
 function reconcile(){
  if(!wanted()){
   revision++;pending=false;volume();
   if(context&&context.state!=='closed')try{Promise.resolve(context.suspend()).catch(()=>{});}catch{}
   status=prefs.enabled?'paused':'off';notify();return;
  }
  try{
   prepare();tune();
   if(status==='playing'&&context.state==='running'){volume();notify();return;}
   if(pending)return;
   const token=++revision;pending=true;status='loading';notify();
   Promise.resolve(context.resume()).then(()=>{
    if(token!==revision)return;
    pending=false;
    if(!wanted())return;
    status=context.state==='running'?'playing':'blocked';volume();notify();
   }).catch(()=>{if(token!==revision)return;pending=false;status='blocked';notify();});
  }catch{pending=false;status='unavailable';notify();}
 }
 function configure(change){
  const next=preferences({...prefs,...change});
  if(options.save&&options.save(next)!==true){notify();return false;}
  prefs=next;reconcile();return true;
 }
 function setSession(value){
  session={running:value?.running===true,supported:value?.supported===true,style:value?.style==='flow'?'flow':'calm'};
  reconcile();
 }
 function stop(){session.running=false;reconcile();}
 function dispose(){stop();revision++;if(context)try{Promise.resolve(context.close()).catch(()=>{});}catch{}context=null;master=null;voices=[];}
 return Object.freeze({get:snapshot,configure,setSession,stop,dispose});
}
root.FORME_WORKOUT_AUDIO=Object.freeze({create,preferences,modes});
})(typeof window!=='undefined'?window:globalThis);
