const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('i18n.js','utf8'),context);
const {create,languages,messages}=context.window.FORME_I18N;
test('language preference survives reopening and invalid values are rejected',()=>{
 const data={};const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v};
 const first=create(storage);assert.equal(first.getLanguage(),'bg');
 assert.equal(first.setLanguage('de'),true);assert.equal(create(storage).getLanguage(),'de');
 assert.equal(first.translate('languageLabel'),'Sprache');
 assert.equal(first.setLanguage('fr'),false);assert.equal(first.getLanguage(),'de');
});
test('unavailable storage and unknown translations fail safely',()=>{
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const instance=create(blocked);assert.equal(instance.getLanguage(),'bg');
 assert.equal(instance.setLanguage('en'),true);assert.equal(instance.translate('languageLabel'),'Language');
 assert.equal(instance.translate('unknown'),null);
});
test('initial translation keys exist in all three languages',()=>{
 const keys=Object.keys(messages.bg).sort().join(',');
 for(const language of languages)assert.equal(Object.keys(messages[language]).sort().join(','),keys);
});
