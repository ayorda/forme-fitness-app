"""CSP and official-SDK checks. Auth/Firestore fixtures are local demo only."""
from pathlib import Path
from urllib.parse import urlparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from contextlib import contextmanager
from playwright.sync_api import sync_playwright, Error as PlaywrightError
import json, os, re, uuid, urllib.request, time

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'demo-forme-sync'
KEY = 'AIza' + 'A' * 35
PASSWORD = 'Local-CSP-fixture-only-Aa19!'
PRODUCTION = {'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com'}
for key, value in [('FIRESTORE_EMULATOR_HOST','127.0.0.1:8080'), ('FIREBASE_AUTH_EMULATOR_HOST','127.0.0.1:9099')]:
    if os.environ.get(key) != value:
        raise RuntimeError('Use the local demo Auth and Firestore emulators only')
config = dict(enabled=True, apiKey=KEY, authDomain=PROJECT+'.firebaseapp.com', projectId=PROJECT,
              appId='1:123456789:web:abcdef0123456789', emulatorUrl='http://127.0.0.1:9099')
html = (ROOT/'index.html').read_text()
# Only the local SDK fixture adds two loopback connections. Every other
# directive is identical; the published policy must never allow localhost.
assert '127.0.0.1' not in html and 'localhost' not in html
emulator_html = html.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:8080 http://127.0.0.1:9099", 1)
assert emulator_html != html
report = {'guest': [], 'sdk': [], 'views': [], 'errors': [], 'productionRequests': [], 'probeNetwork': [], 'externalFontNetwork': [], 'negativeDirectives': [], 'failedRequests': []}
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/qa-upgrade.html':
            body=b'<!doctype html><title>Local cache upgrade fixture</title>'
        elif self.path == '/qa-legacy-worker.js':
            body=b"const key='forme-legacy-csp-qa';self.addEventListener('install',e=>e.waitUntil(caches.open(key).then(c=>c.put('./app.js',new Response('window.qaLegacyScriptWasLoaded=true;',{headers:{'Content-Type':'application/javascript'}}))).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.match(e.request).then(v=>v||fetch(e.request)));});"
        else:
            return super().do_GET()
        self.send_response(200);self.send_header('Content-Type','application/javascript' if self.path.endswith('.js') else 'text/html');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1',0), partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
BASE = 'http://127.0.0.1:'+str(server.server_port)+'/'

def api(action, data, admin=False):
    req = urllib.request.Request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:'+action+'?key='+KEY,
          data=json.dumps(data).encode(),headers={'Content-Type':'application/json',**({'Authorization':'Bearer owner'} if admin else {})})
    return json.load(urllib.request.urlopen(req,timeout=15))
def user():
    email='csp-'+uuid.uuid4().hex[:12]+'@example.com'
    result=api('signUp',dict(email=email,password=PASSWORD,returnSecureToken=True))
    api('update',dict(localId=result['localId'],emailVerified=True),True)
    return email,result['localId']

def observe(context):
    context.add_init_script("window.qaViolations=[];document.addEventListener('securitypolicyviolation',e=>qaViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));")
    context.on('page',lambda page: page.on('pageerror',lambda e:report['errors'].append(str(e))))
    def request(req):
        if urlparse(req.url).hostname in PRODUCTION: report['productionRequests'].append(req.url)
    context.on('request',request)
    context.on('requestfailed',lambda req:report['failedRequests'].append(dict(host=urlparse(req.url).hostname,error=req.failure)))
    # Never contact production with synthetic credentials if a fixture regresses.
    for host in PRODUCTION: context.route('https://'+host+'/**',lambda r:r.abort())
    # The application now uses its real local fonts in CI. Any provider request
    # is a regression; even negative CSP probes must not reach the network.
    for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
        context.route('https://'+host+'/**',lambda r:(report['externalFontNetwork'].append(r.request.url),r.abort())[-1])

def wait(page, expression, timeout=30000):
    # wait_for_function uses nested eval on later polls. Keep CSP enforced and
    # poll through DevTools calls instead; the actual negative probes run in a
    # normal external page script, never privileged evaluation.
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        try:
            if page.evaluate('() => ('+expression+')'): return
        except PlaywrightError as error:
            if not any(text in str(error) for text in ['Execution context was destroyed','Cannot find context with specified id']): raise
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: '+expression)

def clean(page):
    assert page.evaluate('qaViolations') == [], page.evaluate('qaViolations')
    assert not report['externalFontNetwork'], report['externalFontNetwork']
def local_data(page):
    return page.evaluate('JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-favorites")||"{}").exercises||[]')
def check(page):
    page.locator('[data-action=sync-check]').click();page.locator('.sync-summary').wait_for()
    wait(page,'!document.querySelector("[data-action=sync-check]").disabled')

try:
 with sync_playwright() as p:
    args=['--no-sandbox']
    options=dict(headless=True,args=args)
    if os.environ.get('FORME_CHROMIUM_EXECUTABLE'): options['executable_path']=os.environ['FORME_CHROMIUM_EXECUTABLE']
    browser=p.chromium.launch(**options)
    for lang in ['bg','en','de']:
        ctx=browser.new_context(bypass_csp=False,viewport={'width':390,'height':900},reduced_motion='reduce' if lang=='bg' else 'no-preference');observe(ctx)
        ctx.add_init_script('if(location.protocol==="http:")localStorage.setItem("forme-language",'+json.dumps(lang)+');')
        page=ctx.new_page();page.goto(BASE,wait_until='domcontentloaded');page.locator('.hero').wait_for()
        for route in ['sessions','exercises','nutrition','plan','progress','favorites','recovery','account','privacy','services','home']:
            page.goto(BASE+'#'+route,wait_until='domcontentloaded');page.locator('#app').locator('h1,h2').first.wait_for();clean(page)
        for theme in ['light','dark']:
            page.evaluate('(theme)=>document.documentElement.setAttribute("data-theme",theme)',theme)
            for width in [320,390,768,1280]:
                page.set_viewport_size({'width':width,'height':900})
                page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                layout=page.evaluate('()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("body *")].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,right:Math.round(el.getBoundingClientRect().right)}))})')
                assert layout['scroll']<=width,(lang,theme,width,layout)
                report['views'].append(dict(language=lang,theme=theme,width=width))
        wait(page,'navigator.serviceWorker.controller!==null')
        video_requests=[]
        page.on('request',lambda request:video_requests.append(request.url) if request.url.endswith('.mp4') else None)
        page.goto(BASE+'#exercises',wait_until='domcontentloaded')
        page.locator('[data-action=exercise-detail][data-id=Parallel_Bar_Dips]').first.click()
        video=page.locator('.exercise-video video');video.wait_for()
        assert video.get_attribute('preload')=='none' and video.get_attribute('autoplay') is None
        page.wait_for_timeout(300);assert not video_requests,video_requests
        assert video.get_attribute('poster')=='media/exercise-videos/parallel-bar-dips-v2-poster.jpg'
        poster=video.evaluate('async v=>{const image=new Image();image.src=v.poster;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight}}')
        assert poster==dict(width=960,height=540),poster
        assert video.evaluate('v=>v.paused&&v.currentTime===0')
        for width in [320,1280]:
            page.set_viewport_size({'width':width,'height':900})
            page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            assert page.evaluate('document.documentElement.scrollWidth')<=width
        assert 'Coverr' in page.locator('.exercise-video').inner_text()
        assert page.locator('.exercise-video a[href="https://coverr.co/license"]').count()==1
        assert page.locator('.video-cue').inner_text()
        video.click(position={'x':26,'y':video.bounding_box()['height']-48});wait(page,'document.querySelector("video").currentTime>.25')
        assert abs(video.evaluate('v=>v.duration')-6.875)<.01
        video.evaluate('v=>{v.currentTime=4;return v.play()}');wait(page,'document.querySelector("video").currentTime>4.1')
        video.evaluate('v=>v.pause()')
        paused=video.evaluate('v=>v.currentTime');page.wait_for_timeout(300);assert abs(video.evaluate('v=>v.currentTime')-paused)<.1
        partial=page.evaluate("async()=>{const r=await fetch('media/exercise-videos/parallel-bar-dips-v2.mp4',{headers:{Range:'bytes=2-7'}});return {status:r.status,range:r.headers.get('Content-Range'),length:(await r.arrayBuffer()).byteLength}}")
        assert partial==dict(status=206,range='bytes 2-7/642528',length=6),partial
        video.evaluate('v=>{v.currentTime=v.duration-.1;return v.play()}');wait(page,'document.querySelector("video").ended')
        video.click(position={'x':26,'y':video.bounding_box()['height']-48});wait(page,'document.querySelector("video").currentTime>.25&&!document.querySelector("video").ended')
        assert video.evaluate('v=>v.currentTime<2');video.evaluate('v=>v.pause()');clean(page)
        page.locator('[data-action=close-modal]').click()
        # Negative metadata fixtures only: no synthetic candidate is played.
        page.evaluate('()=>{window.qaOriginalDemo=FORME_DATA.exercises.find(e=>e.id==="Parallel_Bar_Dips").demoVideo}')
        fixture=dict(approved=True,origin='ai-image-to-video',reviewStatus='accepted-internal',src='media/exercise-videos/qa-not-published.mp4',credit='QA',source='https://coverr.co/videos/a-man-does-bar-dips',license='Coverr License',licenseUrl='https://coverr.co/license')
        for bad in [fixture,{**fixture,'origin':'filmed','reviewStatus':'pending'}]:
            page.evaluate('(video)=>FORME_DATA.exercises.find(e=>e.id==="Parallel_Bar_Dips").demoVideo=video',bad)
            page.locator('[data-action=exercise-detail][data-id=Parallel_Bar_Dips]').first.click()
            assert page.locator('.exercise-video video').count()==0
            assert page.locator('.video-disclosure').count()==0
            clean(page);page.locator('[data-action=close-modal]').click()
        page.evaluate('()=>{FORME_DATA.exercises.find(e=>e.id==="Parallel_Bar_Dips").demoVideo=window.qaOriginalDemo;delete window.qaOriginalDemo}')
        report.setdefault('realVideoGuardFixtures',[]).append(dict(language=lang,aiRefused=True,pendingRefused=True,metadataOnly=True))
        page.goto(BASE+'#home',wait_until='domcontentloaded')
        ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.locator('.hero').wait_for()
        page.goto(BASE+'#exercises',wait_until='domcontentloaded')
        page.locator('[data-action=exercise-detail][data-id=Parallel_Bar_Dips]').first.click()
        assert page.locator('.exercise-video video').evaluate('v=>v.poster.endsWith("-poster.jpg")')
        offline_video=page.locator('.exercise-video video');offline_video.click(position={'x':26,'y':offline_video.bounding_box()['height']-48});wait(page,'document.querySelector("video").currentTime>.25')
        page.locator('.exercise-video video').evaluate('v=>{v.currentTime=3;return v.play()}');wait(page,'document.querySelector("video").currentTime>3.1')
        clean(page);page.locator('[data-action=close-modal]').click()
        report.setdefault('video',[]).append(dict(language=lang,noPreload=True,actualPoster=True,mp4Decode=True,pauseAndReplay=True,range206=True,offlineReloadAndSeek=True,reducedMotion=lang=='bg',widths=[320,1280],styleStatus='accepted-internal'))
        for route in ['privacy','services','account']:
            page.goto(BASE+'#'+route,wait_until='domcontentloaded');page.locator('#app').locator('h1,h2').first.wait_for();clean(page)
        report['guest'].append(dict(language=lang,routes=True,offline=True));ctx.set_offline(False);ctx.close();print(lang,'guest/offline passed',flush=True)

    upgrade_ctx=browser.new_context(bypass_csp=False);observe(upgrade_ctx);upgrade=upgrade_ctx.new_page()
    upgrade.goto(BASE+'qa-upgrade.html',wait_until='domcontentloaded');upgrade.evaluate("()=>navigator.serviceWorker.register('./qa-legacy-worker.js')")
    wait(upgrade,"navigator.serviceWorker.controller?.scriptURL.endsWith('qa-legacy-worker.js')")
    upgrade.evaluate("async()=>{const old=await caches.open('forme-media-v029-optimized');for(const path of ['media/exercise-videos/parallel-bar-dips-v1.mp4','media/exercises/Parallel_Bar_Dips-480.webp','media/exercises/Parallel_Bar_Dips-960.webp'])await old.put(path,await fetch(path));await old.put('media/exercise-videos/parallel-bar-dips-v1.webm',new Response('Retired duplicate test fixture'));localStorage.setItem('forme-favorites',JSON.stringify({exercises:['Plank'],workouts:[]}));}")
    upgrade.goto(BASE+'#home',wait_until='domcontentloaded');upgrade.locator('.hero').wait_for();assert upgrade.evaluate('window.qaLegacyScriptWasLoaded') is None;clean(upgrade)
    wait(upgrade,"navigator.serviceWorker.controller?.scriptURL.endsWith('/service-worker.js') && navigator.serviceWorker.controller.state==='activated'")
    migrated=upgrade.evaluate("async()=>{const current=await caches.open('forme-video-v0143-dips2'),old=await caches.open('forme-media-v029-optimized');return {newVideo:!!await current.match('media/exercise-videos/parallel-bar-dips-v2.mp4'),oldVideo:!!await old.match('media/exercise-videos/parallel-bar-dips-v1.mp4'),retired:!!await old.match('media/exercise-videos/parallel-bar-dips-v1.webm'),image:!!await old.match('media/exercises/Parallel_Bar_Dips-480.webp')}}")
    assert migrated==dict(newVideo=False,oldVideo=False,retired=False,image=True),(migrated,upgrade.evaluate("async()=>{const result={};for(const key of await caches.keys())result[key]=(await (await caches.open(key)).keys()).map(r=>r.url);return result}"))
    # New bytes must be fetched under their new URL before they can work offline.
    upgrade.goto(BASE+'#exercises',wait_until='domcontentloaded');upgrade.locator('[data-action=exercise-detail][data-id=Parallel_Bar_Dips]').first.click()
    new_video=upgrade.locator('.exercise-video video');new_video.click(position={'x':26,'y':new_video.bounding_box()['height']-48});wait(upgrade,'document.querySelector("video").currentTime>.25');new_video.evaluate('v=>v.pause()');clean(upgrade)
    upgrade_ctx.set_offline(True);upgrade.reload(wait_until='domcontentloaded');upgrade.locator('#app').wait_for();clean(upgrade)
    assert local_data(upgrade)==['Plank']
    upgrade.goto(BASE+'#exercises',wait_until='domcontentloaded');upgrade.locator('[data-action=exercise-detail][data-id=Parallel_Bar_Dips]').first.click();offline_video=upgrade.locator('.exercise-video video');offline_video.click(position={'x':26,'y':offline_video.bounding_box()['height']-48});wait(upgrade,'document.querySelector("video").currentTime>.25');clean(upgrade)
    upgrade_ctx.set_offline(False);upgrade_ctx.close();report['legacyCacheUpgradeAndOffline']=True;report['videoReplacementNeverUsesOldBytes']=True;report['videoCacheMigrationAndGuestPreservation']=True

    # Executable probe is a separate same-origin external script, so eval is
    # tested under page CSP rather than privileged DevTools evaluation.
    ctx=browser.new_context(bypass_csp=False,service_workers='block');observe(ctx)
    ctx.route('https://csp-probe.invalid/**',lambda r:(report['probeNetwork'].append(r.request.url),r.abort())[-1])
    page=ctx.new_page();page.goto(BASE,wait_until='domcontentloaded');page.locator('.hero').wait_for();clean(page)
    probe="""
    window.qaProbe={};
    try{new Function('window.qaEvalRan=1')();}catch(e){qaProbe.evalBlocked=true;}
    const inline=document.createElement('script');inline.textContent='window.qaInlineRan=1';document.body.append(inline);
    const script=document.createElement('script');script.src='https://csp-probe.invalid/script.js';document.body.append(script);
    const style=document.createElement('link');style.rel='stylesheet';style.href='https://fonts.googleapis.com/css2?family=DM+Sans';document.head.append(style);
    new FontFace('ForbiddenRemoteFont','url(https://fonts.gstatic.com/forbidden.woff2)').load().catch(()=>{qaProbe.remoteFontBlocked=true;});
    const img=document.createElement('img');img.setAttribute('onerror','window.qaHandlerRan=1');img.src='/missing-csp-image.png';document.body.append(img);
    const remote=document.createElement('img');remote.src='https://csp-probe.invalid/image.png';document.body.append(remote);
    const base=document.createElement('base');base.href='https://csp-probe.invalid/';document.head.append(base);
    const object=document.createElement('object');object.data='https://csp-probe.invalid/object';document.body.append(object);
    const frame=document.createElement('iframe');frame.src='https://csp-probe.invalid/frame';document.body.append(frame);
    const form=document.createElement('form');form.action='https://csp-probe.invalid/submit';document.body.append(form);form.submit();
    fetch('https://csp-probe.invalid/data').catch(()=>{qaProbe.fetchBlocked=true;});
    const workerURL=URL.createObjectURL(new Blob(['postMessage(1)'],{type:'text/javascript'}));
    try{const worker=new Worker(workerURL);worker.onerror=()=>{qaProbe.workerBlocked=true;worker.terminate();};}catch(e){qaProbe.workerBlocked=true;}
    URL.revokeObjectURL(workerURL);qaProbe.baseKept=location.origin+'/'===document.baseURI;
    """
    ctx.route('**/qa-csp-probe.js',lambda r:r.fulfill(content_type='application/javascript',body=probe))
    page.evaluate("()=>{const s=document.createElement('script');s.src='./qa-csp-probe.js';document.body.append(s);}")
    try:
        wait(page,"window.qaProbe?.remoteFontBlocked&&window.qaProbe?.evalBlocked&&window.qaProbe?.fetchBlocked&&window.qaProbe?.workerBlocked&&['script-src','script-src-elem','script-src-attr','img-src','base-uri','object-src','frame-src','form-action','connect-src','worker-src'].every(d=>qaViolations.some(v=>v.directive===d))")
    except Exception:
        print('Probe diagnostics:',page.evaluate('({probe:window.qaProbe,violations:qaViolations})'),report['errors'],flush=True)
        raise
    assert page.evaluate('qaProbe.baseKept');assert page.evaluate('[window.qaEvalRan,window.qaInlineRan,window.qaHandlerRan]')==[None,None,None]
    report['negativeDirectives']=sorted(set(v['directive'] for v in page.evaluate('qaViolations')))
    for directive in ['script-src','script-src-elem','script-src-attr','style-src-elem','font-src','img-src','base-uri','object-src','frame-src','form-action','connect-src','worker-src']:
        assert directive in report['negativeDirectives'],report['negativeDirectives']
    assert not report['probeNetwork'] and not report['externalFontNetwork'];ctx.close();print('negative CSP probes passed',flush=True)
    fallback_ctx=browser.new_context(bypass_csp=False,service_workers='block');observe(fallback_ctx)
    for kind in ['exercises','foods']:fallback_ctx.route('**/media/'+kind+'/**',lambda r:r.abort())
    fallback=fallback_ctx.new_page();fallback.goto(BASE+'#exercises',wait_until='domcontentloaded');fallback.locator('.photo-visual.media-pending').first.wait_for()
    fallback.goto(BASE+'#nutrition',wait_until='domcontentloaded');fallback.locator('.food-visual.media-pending').first.wait_for();clean(fallback)
    fallback.goto(BASE+'#exercises',wait_until='domcontentloaded')
    fallback.evaluate("()=>{FORME_DATA.exercises.find(x=>x.id==='Plank').demoVideo={approved:true,src:'media/exercise-videos/qa-missing.mp4',credit:'Local test fixture',source:'https://example.invalid/source',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'};}")
    fallback.locator('[data-action=exercise-detail][data-id=Plank]').first.click();fallback.locator('video').wait_for();fallback.locator('video').evaluate('(v)=>v.load()')
    wait(fallback,"document.querySelector('video').hidden&&!document.querySelector('video').nextElementSibling.hidden");clean(fallback)
    fallback.locator('[data-action=close-modal]').click()
    fallback.goto(BASE+'#sessions',wait_until='domcontentloaded');yoga=fallback.evaluate("FORME_DATA.workouts.find(x=>x.cat==='yoga').id")
    fallback.locator('[data-action=workout-detail][data-id="'+yoga+'"]').first.click();fallback.locator('.modal [data-action=start-workout]').click();fallback.locator('[data-action=player-start]').click();fallback.locator('#music-enabled').check()
    wait(fallback,"document.querySelector('#music-status').textContent===FORME_INTERFACE_TRANSLATIONS.get('audio.status.playing','bg')")
    fallback.locator('[data-action=player-pause]').click();wait(fallback,"document.querySelector('#music-status').textContent===FORME_INTERFACE_TRANSLATIONS.get('audio.status.paused','bg')")
    fallback.locator('[data-action=player-resume]').click();wait(fallback,"document.querySelector('#music-status').textContent===FORME_INTERFACE_TRANSLATIONS.get('audio.status.playing','bg')");fallback.locator('[data-action=close-modal]').click();clean(fallback)
    report['mediaFallbacks']=True;report['timerAndAudioLifecycle']=True;fallback_ctx.close()
    file_ctx=browser.new_context(bypass_csp=False,service_workers='block');observe(file_ctx);file_page=file_ctx.new_page()
    try:
        file_page.goto((ROOT/'index.html').as_uri(),wait_until='domcontentloaded');file_page.locator('.hero').wait_for();clean(file_page);report['fileGuestPreview']=True
    except PlaywrightError as error:
        if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(error): raise
        report['fileGuestPreview']='blocked-by-test-environment-policy'
    file_ctx.close()
    browser.close();browser=p.chromium.launch(**options)

    for lang in ['bg','en','de']:
        def sdk_page(email,seed=None):
            ctx=browser.new_context(bypass_csp=False,viewport={'width':390,'height':950},service_workers='block');observe(ctx)
            ctx.grant_permissions(['local-network-access'],origin=BASE)
            ctx.route('**/index.html?qa=emulator',lambda r:r.fulfill(content_type='text/html',body=emulator_html))
            ctx.route('**/auth-config.js',lambda r:r.fulfill(content_type='application/javascript',body='window.FORME_AUTH_CONFIG='+json.dumps(config)+';'))
            ctx.route('**/auto-sync.js',lambda r:r.fulfill(content_type='application/javascript',body=(ROOT/'auto-sync.js').read_text()+"\nwindow.qaCreateAuto=FORME_AUTO.create;window.FORME_AUTO={...FORME_AUTO,create(...args){const m=window.qaCreateAuto(...args);window.qaAuto=m;return m;}};"))
            values={'forme-language':lang,**(seed or {})}
            ctx.add_init_script('if(location.protocol==="http:"&&!sessionStorage.getItem("csp-fixture")){for(const[k,v]of Object.entries('+json.dumps(values)+'))localStorage.setItem(k,v);sessionStorage.setItem("csp-fixture","1");}')
            page=ctx.new_page();page.goto(BASE+'index.html?qa=emulator#account',wait_until='domcontentloaded');page.locator('#account-form').wait_for()
            page.locator('#account-email').fill(email);page.locator('#account-password').fill(PASSWORD);page.locator('#account-form button[type=submit]').click()
            wait(page,"document.querySelector('.hero')||document.querySelector('#account-message[role=alert]')")
            if not page.locator('.hero').count():
                print('Login diagnostics:',page.evaluate('({problem:FORME_BOOTSTRAP.account.get().problem,violations:qaViolations,configured:FORME_BOOTSTRAP.account.get().configured,project:FORME_AUTH_CONFIG.projectId,emulator:FORME_AUTH_CONFIG.emulatorUrl})'),report['failedRequests'][-5:],len(report['productionRequests']),flush=True)
                raise AssertionError('Local SDK login failed')
            clean(page);return ctx,page
        email,uid=user();ca,a=sdk_page(email,{'forme-favorites':json.dumps({'exercises':['Plank'],'workouts':[]})})
        a.locator('#top-account').click();a.locator('#auto-consent').check();a.locator('[data-action=auto-enable]').click();a.locator('[data-action=auto-pause]').wait_for();wait(a,'!qaAuto.get().busy&&qaAuto.get().lastSync!==null')
        cb,b=sdk_page(email);wait(b,'JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-favorites")||"{}").exercises?.includes("Plank")')
        a.goto(BASE+'index.html?qa=emulator#exercises',wait_until='domcontentloaded');a.locator('[data-action=favorite][data-id=Pushups][data-kind=exercises]').first.click()
        wait(b,'JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-favorites")||"{}").exercises?.includes("Pushups")')
        ca.set_offline(True);a.evaluate('FORME_STORAGE_SCHEMA.create(FORME_BOOTSTRAP.workspace.storage).save("plan",{mon:"cal-start"})')
        cb.set_offline(True);b.evaluate('FORME_PROGRESS.create(FORME_BOOTSTRAP.workspace.storage).recordSet("Plank","seconds",37,"2026-11-15")')
        wait(a,'qaAuto.get().pending');wait(b,'qaAuto.get().pending')
        ca.set_offline(False);cb.set_offline(False)
        wait(a,'JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-progress-v1")||"{}").sets?.some(x=>x.value===37)',timeout=45000)
        wait(b,'JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-plan")||"{}").mon==="cal-start"',timeout=45000)
        a.evaluate('const j=FORME_PROGRESS.create(FORME_BOOTSTRAP.workspace.storage);j.removeRecord(j.get().sets.find(x=>x.value===37).id)')
        wait(b,'!JSON.parse(FORME_BOOTSTRAP.workspace.storage.getItem("forme-progress-v1")||"{}").sets?.some(x=>x.value===37)',timeout=45000)
        a.goto(BASE+'index.html?qa=emulator#account',wait_until='domcontentloaded');a.reload(wait_until='domcontentloaded');a.locator('.account-email').wait_for();assert a.locator('#account-form').count()==0;clean(a);clean(b);cb.close()
        a.goto(BASE+'index.html?qa=emulator#privacy',wait_until='domcontentloaded');a.locator('.privacy-delete summary').click();a.locator('#delete-password').fill(PASSWORD);a.locator('#delete-consent').check();a.locator('#account-delete-form button[type=submit]').click();a.locator('#privacy-message[role=status]').wait_for();assert a.evaluate('FORME_BOOTSTRAP.workspace.uid') is None;clean(a);ca.close()
        # Manual backup is tested separately with automatic mode off.
        email,uid=user();ca,a=sdk_page(email,{'forme-favorites':json.dumps({'exercises':['Plank'],'workouts':[]})});a.locator('#top-account').click();check(a);a.locator('#sync-upload-consent').check();a.locator('[data-action=sync-upload]').click();a.locator('#sync-message[role=status]').wait_for()
        cb,b=sdk_page(email,{'forme-favorites':json.dumps({'exercises':['Pushups'],'workouts':[]})});b.locator('#top-account').click();check(b)
        b.evaluate("()=>{window.qaURL=URL.createObjectURL;URL.createObjectURL=()=>{throw Error('synthetic download failure');};}");b.locator('[data-action=sync-safety]').click();b.locator('#sync-message[role=alert]').wait_for();assert b.locator('#sync-restore-consent').is_disabled();b.evaluate('()=>{URL.createObjectURL=window.qaURL;}')
        with b.expect_download() as download:b.locator('[data-action=sync-safety]').click()
        archive=json.loads(Path(download.value.path()).read_text());assert json.loads(archive['data']['forme-favorites'])['exercises']==['Pushups']
        b.locator('[data-action=sync-cancel]').click();assert b.locator('#sync-restore-consent').is_disabled()
        with b.expect_download():b.locator('[data-action=sync-safety]').click()
        b.locator('#sync-restore-consent').check()
        with b.expect_navigation(wait_until='domcontentloaded'):b.locator('[data-action=sync-restore]').click()
        b.locator('.account-email').wait_for();assert local_data(b)==['Plank'];assert b.evaluate('JSON.parse(localStorage.getItem("forme-favorites")).exercises')==['Pushups'];clean(a);clean(b)
        b.locator('[data-action=account-logout]').click();b.locator('#account-form').wait_for();assert b.evaluate('FORME_BOOTSTRAP.workspace.uid') is None;clean(b)
        signup_email='csp-signup-'+uuid.uuid4().hex[:10]+'@example.com'
        b.locator('[data-action=account-mode][data-mode=signup]').click();b.locator('#account-email').fill(signup_email);b.locator('#account-password').fill(PASSWORD);b.locator('#account-password-repeat').fill(PASSWORD);b.locator('#account-form button[type=submit]').click();b.locator('.account-email').wait_for()
        assert b.locator('.account-email').inner_text()==signup_email
        b.locator('[data-action=account-verify]').click();b.locator('#account-message[role=status]').wait_for();clean(b)
        b.locator('[data-action=account-logout]').click();b.locator('#account-form').wait_for();b.locator('[data-action=account-mode][data-mode=reset]').click();b.locator('#account-email').fill(signup_email);b.locator('#account-form button[type=submit]').click();b.locator('#account-message[role=status]').wait_for();clean(b);ca.close();cb.close()
        report['sdk'].append(dict(language=lang,loginReload=True,automaticTwoProfiles=True,offlineMergeDelete=True,accountDeletion=True,manualSafetyDownloadCancelRestore=True,logout=True,registrationAndEmailRequests=True));print(lang,'SDK flows passed',flush=True)
    browser.close()
 assert not report['errors'],report['errors'];assert not report['productionRequests'],report['productionRequests']
 target=ROOT/'qa-results';target.mkdir(exist_ok=True);(target/'csp.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
finally:
 server.shutdown();server.server_close()
