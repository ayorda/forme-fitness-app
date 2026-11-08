const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app.js','utf8');
const definition=source.split('\n').find(line=>line.startsWith('const image='));
const videoDefinition=source.split('\n').find(line=>line.startsWith('function exerciseVideo('));
const context=vm.createContext({window:{FORME_EXERCISE_PHOTOS:{get:id=>id==='Test'?{origin:'ai',small:'media/exercises/Test-480.webp',large:'media/exercises/Test-960.webp'}:null}},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),textFor:(_key,fallback)=>fallback});
vm.runInContext(definition+'\n'+videoDefinition+'\nthis.renderImage=image;this.renderVideo=exerciseVideo;',context);

test('missing media shows a local placeholder without a broken image',()=>{
  assert.match(context.renderImage({id:'Missing',name:'Missing'}),/Изображението предстои/);
  assert.doesNotMatch(context.renderImage({id:'Missing',name:'Missing'}),/<img/);
});

test('AI image uses responsive WebP and an honest error fallback',()=>{
  const html=context.renderImage({id:'Test',name:'Test'});
  assert.match(html,/Test-480.webp 480w, media\/exercises\/Test-960.webp 960w/);
  assert.match(html,/loading="lazy"/);
  assert.match(html,/AI визуализация/);
  assert.match(html,/closest\('picture'\).hidden=true/);
});
test('unapproved or unsafe video paths remain clearly pending',()=>{
 for(const video of [undefined,{approved:false,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'https://example.test/video.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'media/exercise-videos/../other.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'javascript:alert(1)'}]){
  const html=context.renderVideo({name:'Test',demoVideo:video});assert.match(html,/Видео демонстрацията предстои/);assert.doesNotMatch(html,/<video/);
 }
});
test('approved local video has controls, no autoplay, source credit and an error fallback',()=>{
 const html=context.renderVideo({name:'Test',demoVideo:{approved:true,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'https://example.test/source'}});
 assert.match(html,/<video controls playsinline preload="none"/);assert.doesNotMatch(html,/autoplay/);assert.match(html,/Author/);
 const handler=html.match(/onerror="([^"]+)"/)[1];const video={hidden:false,nextElementSibling:{hidden:true}};
 Function(handler).call(video);assert.equal(video.hidden,true);assert.equal(video.nextElementSibling.hidden,false);
});
