const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function homeHtml(){
 const nodes={};const element=()=>({innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return element();}});
 const document={body:{style:{}},hidden:false,getElementById(id){return nodes[id]||(nodes[id]=element());},addEventListener(){}};
 const window={addEventListener(){},scrollTo(){}};
 const c={window,document,localStorage:{getItem(){return null;},setItem(){}},location:{hash:'#home'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
 vm.createContext(c);for(const f of ['exercise-art.js','data.js','core.js','food-art.js','app.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});return nodes.app.innerHTML;
}
test('home remains usable if the private portrait cannot be loaded',()=>{
 const html=homeHtml(),tag=html.match(/<img src="\.\/private-media\/model-front\.png"[^>]+>/)?.[0];assert.ok(tag);
 const handler=tag.match(/onerror="([^"]+)"/)[1],image={parentElement:{hidden:false}};
 Function(handler).call(image);assert.equal(image.parentElement.hidden,true);
 assert.match(html,/data-action="nav" data-page="sessions"/);
});
test('private model file stays out of the public app cache and exercise data',()=>{
 assert.match(fs.readFileSync('.gitignore','utf8'),/\/private-media\//);
 assert.doesNotMatch(fs.readFileSync('service-worker.js','utf8'),/private-media/);
 assert.doesNotMatch(fs.readFileSync('data.js','utf8'),/model-front|private-media/);
});
