const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app.js','utf8');
const definition=source.split('\n').find(line=>line.startsWith('const image='));
const errorDefinition=source.split('\n').find(line=>line.startsWith('function handleMediaError('));
const videoDefinition=source.split('\n').find(line=>line.startsWith('function exerciseVideo('));
const context=vm.createContext({window:{FORME_EXERCISE_PHOTOS:{get:id=>id==='Test'?{origin:'ai',small:'media/exercises/Test-480.webp',large:'media/exercises/Test-960.webp'}:null}},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;'),textFor:(_key,fallback)=>fallback});
vm.runInContext(definition+'\n'+videoDefinition+'\n'+errorDefinition+'\nthis.mediaError=handleMediaError;this.renderImage=image;this.renderVideo=exerciseVideo;',context);

test('missing media shows a local placeholder without a broken image',()=>{
  assert.match(context.renderImage({id:'Missing',name:'Missing'}),/Изображението предстои/);
  assert.doesNotMatch(context.renderImage({id:'Missing',name:'Missing'}),/<img/);
});

test('AI image uses responsive WebP and an honest error fallback',()=>{
  const html=context.renderImage({id:'Test',name:'Test'});
  assert.match(html,/Test-480.webp 480w, media\/exercises\/Test-960.webp 960w/);
  assert.match(html,/loading="lazy"/);
  assert.match(html,/AI визуализация/);
  assert.match(html,/data-media-fallback="exercise"/);assert.doesNotMatch(html,/onerror=/);
});
test('exercise detail requests a readable full frame while cards retain lazy smaller sizing',()=>{
 const card=context.renderImage({id:'Test',name:'Test'}),detail=context.renderImage({id:'Test',name:'Test'},true);
 assert.match(card,/sizes="\(max-width:780px\) 100vw, 33vw"/);
 assert.match(detail,/sizes="\(max-width:780px\) calc\(100vw - 36px\), 704px"/);
 assert.match(detail,/loading="lazy"/);assert.match(detail,/data-media-fallback="exercise"/);
});
test('unapproved or unsafe video paths remain clearly pending',()=>{
 for(const video of [undefined,{approved:false,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'https://example.test/video.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'media/exercise-videos/../other.mp4',credit:'Author',source:'https://example.test'}, {approved:true,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'javascript:alert(1)'}]){
  const html=context.renderVideo({name:'Test',demoVideo:video});assert.match(html,/Видео демонстрацията предстои/);assert.doesNotMatch(html,/<video/);
 }
});
test('approved local video has controls, no autoplay, source credit and an error fallback',()=>{
 const html=context.renderVideo({name:'Test',demoVideo:{approved:true,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'https://example.test/source',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'}});
 assert.match(html,/<video controls playsinline preload="none"/);assert.doesNotMatch(html,/autoplay/);assert.match(html,/Author/);
 assert.doesNotMatch(html,/onerror=/);const video={tagName:'VIDEO',dataset:{mediaFallback:'video'},hidden:false,nextElementSibling:{hidden:true}};
 context.mediaError({target:video});assert.equal(video.hidden,true);assert.equal(video.nextElementSibling.hidden,false);
});

test('reviewed Coverr real footage renders with visible licence and no AI disclosure',()=>{
 const video={approved:true,origin:'filmed',reviewStatus:'accepted-internal',src:'media/exercise-videos/dips-v2.mp4',poster:'media/exercise-videos/dips-v2-poster.jpg',width:960,height:540,credit:'Coverr',source:'https://coverr.co/videos/a-man-does-bar-dips',license:'Coverr License',licenseUrl:'https://coverr.co/license'};
 const html=context.renderVideo({id:'Parallel_Bar_Dips',name:'Test',demoVideo:video});
 assert.match(html,/<video controls playsinline preload="none"/);assert.match(html,/<\/video><p class="error" hidden>/);
 assert.match(html,/Coverr License/);assert.doesNotMatch(html,/video-disclosure|computer-generated|Компютърно генерирана|autoplay|<canvas/);
 for(const bad of [{reviewStatus:'pending'},{origin:'ai-image-to-video'},{license:'Pexels'},{licenseUrl:'https://example.test/license'},{source:'https://coverr.co.evil.test/videos/test'},{source:'https://coverr.co/videos/a-man-does-bar-dips?redirect=elsewhere'},{approved:false}])assert.doesNotMatch(context.renderVideo({name:'Test',demoVideo:{...video,...bad}}),/<video/);
});
test('retired AI metadata cannot bypass the real-footage player using a real licence',()=>{
 for(const license of [{license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},{license:'Coverr License',licenseUrl:'https://coverr.co/license'}]){
  const video={approved:true,origin:'ai-image-to-video',generator:'wan3_0',reviewStatus:'accepted-internal',src:'media/exercise-videos/never-published.mp4',credit:'QA',source:'https://coverr.co/videos/a-man-does-bar-dips',...license};
  assert.doesNotMatch(context.renderVideo({name:'Test',demoVideo:video}),/<video/);
 }
});

test('delegated image failures reveal the matching food or exercise fallback',()=>{
 for(const kind of ['food','exercise']){const picture={hidden:false},changes=[];const visual={classList:{add:name=>changes.push(name)}};const target={tagName:'IMG',dataset:{mediaFallback:kind},closest:selector=>selector==='picture'?picture:selector===(kind==='food'?'.food-visual':'.photo-visual')?visual:null};context.mediaError({target});assert.equal(picture.hidden,true);assert.deepEqual(changes,['media-pending']);}
});
test('unmarked and unrelated media errors do not hide arbitrary content',()=>{
 for(const target of [undefined,{tagName:'IMG',dataset:{},hidden:false},{tagName:'VIDEO',dataset:{mediaFallback:'food'},hidden:false},{tagName:'DIV',dataset:{mediaFallback:'exercise'},hidden:false}]){context.mediaError({target});if(target)assert.equal(target.hidden,false);}
});

test('shipped video matches the catalogue, licensed source and immutable byte manifest',()=>{
 const crypto=require('node:crypto');
 const c=vm.createContext({window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}});
 vm.runInContext(fs.readFileSync('data.js','utf8'),c);
 const manifest=JSON.parse(fs.readFileSync('media/exercise-videos/manifest.json','utf8'));
 const available=c.window.FORME_DATA.exercises.filter(ex=>ex.demoVideo?.approved);
 assert.equal(available.length,manifest.entries.length);assert.equal(available.length,1);
 for(const entry of manifest.entries){
  const ex=available.find(ex=>ex.id===entry.exerciseId);assert.ok(ex);
  assert.equal(ex.demoVideo.source,entry.sourcePage);assert.equal(ex.demoVideo.license,entry.license);assert.equal(ex.demoVideo.licenseUrl,entry.licenseUrl);
  assert.equal(entry.origin,'filmed');assert.equal(entry.sourceMetadataSnapshot.isAiGenerated,false);assert.equal(entry.sourceMetadataSnapshot.isPremium,false);assert.equal(entry.rightsReview.useContext,'integrated-instructional-app');
  assert.equal(entry.adaptationLicense,'Coverr License');assert.ok(entry.changes);assert.ok(entry.review.limitations);
  for(const v of entry.variants){const bytes=fs.readFileSync(v.path);assert.equal(bytes.length,v.bytes);assert.ok(bytes.length<1024*1024);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.sha256);}
  assert.ok(entry.variants.some(v=>v.path===ex.demoVideo.src&&v.codec==='h264'));
  assert.equal(ex.demoVideo.poster,entry.poster.path);const poster=fs.readFileSync(entry.poster.path);assert.equal(poster.length,entry.poster.bytes);assert.equal(poster.readUInt16BE(0),0xffd8);assert.equal(crypto.createHash('sha256').update(poster).digest('hex'),entry.poster.sha256);
 }
});
test('video poster accepts only local actual-frame JPEG paths and reserves undistorted dimensions',()=>{
 const video={approved:true,src:'media/exercise-videos/pullup.mp4',credit:'Author',source:'https://example.test/source',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'};
 const html=context.renderVideo({name:'Test',demoVideo:{...video,poster:'media/exercise-videos/frame-v1.jpg',width:720,height:720}});
 assert.match(html,/poster="media\/exercise-videos\/frame-v1\.jpg"/);assert.match(html,/width="720" height="720"/);
 for(const poster of ['https://example.test/leak.jpg','javascript:alert(1)','media/exercise-videos/../other.jpg','media/exercise-videos/fake.svg']) {
  const result=context.renderVideo({name:'Test',demoVideo:{...video,poster,width:NaN,height:-1}});assert.doesNotMatch(result,/ poster=/);assert.match(result,/width="854" height="480"/);
 }
});
test('real clip renders a licence, change notice and localized technique cue without autoplay',()=>{
 const c=vm.createContext({window:{FORME_EXERCISE_ART:{url:()=> 'placeholder'}}});vm.runInContext(fs.readFileSync('data.js','utf8'),c);
 const ex=c.window.FORME_DATA.exercises.find(ex=>ex.id==='Parallel_Bar_Dips');
 const html=context.renderVideo(ex);assert.match(html,/https:\/\/coverr\.co\/license/);assert.match(html,/Coverr/);assert.match(html,/Съкратено, компресирано, без звук/);assert.doesNotMatch(html,/autoplay|onerror=/);
});
