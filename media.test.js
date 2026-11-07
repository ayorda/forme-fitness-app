const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app.js','utf8');
const definition=source.split('\n').find(line=>line.startsWith('const image='));
const videoDefinition=source.split('\n').find(line=>line.startsWith('function exerciseVideo('));
const context=vm.createContext({esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),textFor:(_key,fallback)=>fallback});
vm.runInContext(definition+'\n'+videoDefinition+'\nthis.renderImage=image;this.renderVideo=exerciseVideo;',context);

test('missing or incomplete media is shown as pending without a broken image',()=>{
  assert.match(context.renderImage({name:'Test'}),/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);
  assert.doesNotMatch(context.renderImage({name:'Test',photo:'one.jpg'},true),/<img/);
});

test('an image loading failure replaces the misleading demonstration label',()=>{
  const html=context.renderImage({name:'Test',photo:'one.jpg',photo2:'one.jpg'});
  const handler=html.match(/onerror="([^"]+)"/)[1];
  const image={classList:{add(value){image.hidden=value;}},dataset:{errorLabel:'ИЗОБРАЖЕНИЕТО НЕ Е НАЛИЧНО'},nextElementSibling:{textContent:'ДЕМОНСТРАЦИЯ'}};
  Function(handler).call(image);
  assert.equal(image.hidden,'hidden');
  assert.equal(image.nextElementSibling.textContent,'ИЗОБРАЖЕНИЕТО НЕ Е НАЛИЧНО');
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
