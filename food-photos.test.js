const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function boot(){
 const handlers={},nodes={};const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(type,fn){handlers[type]=fn;}};
 const window={addEventListener(){},scrollTo(){}};const c={window,document,localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#nutrition'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','food-photos.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});return {handlers,nodes,window};
}
test('selected food photos supplement the offline illustration and show source credit',()=>{
 const a=boot(),html=a.nodes['food-results'].innerHTML;
 for(const id of ['17563535','6107734','4451847','7890027','6294255','4753649','1759055','7655896','38444066','8755152','16719840','54369','6740693','6824475','7937387','10856281','3296279','4110456','34415723','3737651','4113300','7656595','12001951'])assert.match(html,new RegExp('pexels-photo-'+id));assert.match(html,/<svg/);
 a.handlers.click({target:{closest:()=>({dataset:{action:'food-detail',id:'rice'}})}});
 const modal=a.nodes['modal-root'].innerHTML;assert.match(modal,/Илюстративна снимка/);assert.match(modal,/Jubair Bin Iqbal \/ Pexels/);assert.match(modal,/сварен/);
});
test('failed photo hides the image and label while leaving the original illustration',()=>{
 const a=boot(),html=a.nodes['food-results'].innerHTML,tag=html.match(/<img class="food-photo"[^>]+>/)[0],handler=tag.match(/onerror="([^"]+)"/)[1];
 const photo={hidden:false,nextElementSibling:{hidden:false}};Function(handler).call(photo);
 assert.equal(photo.hidden,true);assert.equal(photo.nextElementSibling.hidden,true);assert.match(html,/<svg/);
 assert.equal(a.window.FORME_FOOD_PHOTOS.get('unknown'),null);assert.equal(a.window.FORME_FOOD_PHOTOS.get('constructor'),null);
});
test('the photo label appears only after the image loads',()=>{
 const a=boot(),html=a.nodes['food-results'].innerHTML,tag=html.match(/<img class="food-photo"[^>]+>/)[0],handler=tag.match(/onload="([^"]+)"/)[1];
 assert.match(html,/<span class="food-photo-tag" hidden>СНИМКА<\/span>/);
 const photo={nextElementSibling:{hidden:true}};Function(handler).call(photo);assert.equal(photo.nextElementSibling.hidden,false);
});

test('Wikimedia photos show author, license and display modifications',()=>{
 const a=boot();
 for(const [id,author,license] of [['quinoa','ProjectManhattan','CC BY-SA 3.0'],['brownrice','Estwordenn','CC BY-SA 4.0'],['peanutbutter','PiccoloNamek','CC BY-SA 3.0']]){
  const photo=a.window.FORME_FOOD_PHOTOS.get(id);assert.ok(photo.src.startsWith('https://thumb.wikimedia.org/'));
  a.handlers.click({target:{closest:()=>({dataset:{action:'food-detail',id}})}});
  const html=a.nodes['modal-root'].innerHTML;assert.match(html,new RegExp(author));assert.match(html,new RegExp(license.replaceAll('.','\\.')));assert.match(html,/Преоразмерена и частично изрязана/);assert.ok(html.includes(photo.licenseUrl));
 }
 assert.match(a.nodes['food-results'].innerHTML,/CC BY-SA 3.0/);
 const cottage=a.window.FORME_FOOD_PHOTOS.get('cottage');assert.match(cottage.credit,/USDA/);
});
