const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('app.js','utf8');
const definition=source.split('\n').find(line=>line.startsWith('const image='));
const context=vm.createContext({esc:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;')});
vm.runInContext(definition+'\nthis.renderImage=image;',context);

test('missing or incomplete media is shown as pending without a broken image',()=>{
  assert.match(context.renderImage({name:'Test'}),/ДЕМОНСТРАЦИЯТА ПРЕДСТОИ/);
  assert.doesNotMatch(context.renderImage({name:'Test',photo:'one.jpg'},true),/<img/);
});

test('an image loading failure replaces the misleading demonstration label',()=>{
  const html=context.renderImage({name:'Test',photo:'one.jpg',photo2:'one.jpg'});
  const handler=html.match(/onerror="([^"]+)"/)[1];
  const image={classList:{add(value){image.hidden=value;}},nextElementSibling:{textContent:'ДЕМОНСТРАЦИЯ'}};
  Function(handler).call(image);
  assert.equal(image.hidden,'hidden');
  assert.equal(image.nextElementSibling.textContent,'ИЗОБРАЖЕНИЕТО НЕ Е НАЛИЧНО');
});
