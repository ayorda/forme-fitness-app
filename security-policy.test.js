const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),register=fs.readFileSync('pwa-register.js','utf8');
function policy(){const tags=[...html.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g)];assert.equal(tags.length,1);const directives=tags[0][1].split(';').map(s=>s.trim().split(/\s+/)).filter(x=>x[0]);assert.equal(new Set(directives.map(x=>x[0])).size,directives.length);return new Map(directives.map(([key,...values])=>[key,values]));}
test('the production shell enforces one policy before any resource can load',()=>{
 const pos=html.indexOf('http-equiv="Content-Security-Policy"');assert.ok(pos>html.indexOf('<meta charset="UTF-8">'));
 assert.ok(pos<html.indexOf('<link'));assert.ok(pos<html.indexOf('<script'));
 assert.deepEqual(policy().get('default-src'),["'none'"]);assert.match(html,/<meta name="referrer" content="strict-origin-when-cross-origin">/);
});
test('scripts have no inline eval event or remote-source exception',()=>{
 const p=policy();assert.deepEqual(p.get('script-src'),["'self'"]);assert.deepEqual(p.get('script-src-attr'),["'none'"]);
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){assert.equal(match[2].trim(),'');const src=match[1].match(/src="([^"]+)"/);assert.ok(src);assert.match(src[1],/^[a-z0-9][a-z0-9./_-]*\.js(?:\?v=\d+)?$/i);assert.ok(!src[1].includes('..'));}
 assert.doesNotMatch(html,/\son[a-z]+\s*=/i);
});
test('production connections allow only the needed Firebase hosts and own origin',()=>{
 assert.deepEqual(policy().get('connect-src'),["'self'",'https://identitytoolkit.googleapis.com','https://securetoken.googleapis.com','https://firestore.googleapis.com']);
 assert.doesNotMatch([...policy().values()].flat().join(' '),/localhost|127\.0\.0\.1|http:|\*/);
});
test('content injection cannot change the base submit forms or embed objects',()=>{
 const p=policy();for(const key of ['base-uri','object-src','form-action','frame-src'])assert.deepEqual(p.get(key),["'none'"]);
 for(const key of ['worker-src','child-src','manifest-src','media-src'])assert.deepEqual(p.get(key),["'self'"]);
 assert.deepEqual(p.get('img-src'),["'self'",'data:']);assert.deepEqual(p.get('style-src'),["'self'","'unsafe-inline'",'https://fonts.googleapis.com']);assert.deepEqual(p.get('font-src'),["'self'",'https://fonts.gstatic.com']);
});
test('external PWA registration waits for load and reports failure without throwing',async()=>{
 const listeners={},calls=[],warnings=[];const root={navigator:{serviceWorker:{register(path){calls.push(path);return Promise.reject(Error('offline'));}}},location:{protocol:'https:'},addEventListener:(name,fn)=>{listeners[name]=fn;},console:{warn:(...args)=>warnings.push(args)}};
 vm.runInNewContext(register,{window:root});assert.deepEqual(calls,[]);assert.equal(typeof listeners.load,'function');listeners.load();await Promise.resolve();assert.deepEqual(calls,['./service-worker.js']);assert.equal(warnings.length,1);
});
test('file previews and browsers without Service Worker do not register one',()=>{
 for(const [protocol,navigator] of [['file:',{serviceWorker:{register(){throw Error('unexpected');}}}],['https:',{}]])vm.runInNewContext(register,{window:{navigator,location:{protocol},addEventListener(){throw Error('unexpected listener');}}});
});

test('a new CSP shell requests a versioned app that is explicitly cached offline',()=>{
 const src=html.match(/<script src="(app\.js\?v=\d+)"><\/script>/)?.[1];assert.ok(src,'a legacy cache must not supply the old inline-handler app');assert.ok(fs.readFileSync('service-worker.js','utf8').includes("'./"+src+"'"));
});
