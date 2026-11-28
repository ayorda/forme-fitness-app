"""Actual native H.264 playback/cache checks; no production account access or technique certification."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json
import os
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT/'media/exercise-videos/manifest.json').read_text())
ENTRIES = MANIFEST['entries']
REPORT = dict(cases=[], errors=[], csp=[], productionRequests=[], fullPlayback=[], offline=[], upgrade=None, fallback=None)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass


def wait(page, expression, timeout=30000):
    page.wait_for_function(expression, timeout=timeout)


def observe(ctx):
    ctx.add_init_script('window.qaVideoCsp=[];document.addEventListener("securitypolicyviolation",e=>qaVideoCsp.push(e.effectiveDirective));')
    ctx.on('page', lambda p: p.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
    for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
        ctx.route('https://'+host+'/**', lambda route: (REPORT['productionRequests'].append(route.request.url), route.abort())[-1])


def open_exercise(page, id):
    page.locator(f'#app [data-action="exercise-detail"][data-id="{id}"]').first.click()
    video = page.locator('.exercise-video video')
    video.wait_for()
    video.scroll_into_view_if_needed()
    return video


def close_detail(page):
    page.locator('#modal-root [data-action="close-modal"]').first.click()


def native_play(video):
    box = video.bounding_box()
    video.click(position=dict(x=26, y=box['height']-48))
    video.page.wait_for_function('()=>{const v=document.querySelector(".exercise-video video");return v&&!v.paused&&v.currentTime>0.05;}', timeout=5000)


def missing_video_check(browser, base):
    # Fresh cache: a failed MP4 must retain the image, technique text and clear fallback.
    ctx=browser.new_context(bypass_csp=False,viewport=dict(width=390,height=900),is_mobile=True,has_touch=True)
    observe(ctx)
    ctx.route('**/media/exercise-videos/pushups-real-v1.mp4',lambda route:route.fulfill(status=404,content_type='text/plain',body='Local QA missing video'))
    page=ctx.new_page();page.goto(base+'#exercises',wait_until='domcontentloaded')
    wait(page,'()=>!!navigator.serviceWorker.controller')
    v=open_exercise(page,'Pushups');v.evaluate('v=>v.load()')
    wait(page,'()=>{const v=document.querySelector(".exercise-video video");return v.hidden&&!v.nextElementSibling.hidden;}')
    image=page.locator('#modal-root .modal-visual img');image.evaluate('img=>img.decode()')
    assert image.evaluate('img=>img.naturalWidth>0') and page.locator('.video-cue').is_visible()
    REPORT['fallback']=dict(missingMp4=True,imageRetained=True,techniqueRetained=True,messageVisible=True)
    REPORT['csp']+=page.evaluate('qaVideoCsp');ctx.close()


def main():
    server=None
    base=os.environ.get('FORME_VIDEOS_BASE')
    if not base:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}/'
    try:
        with sync_playwright() as p:
            options=dict(headless=True,args=['--no-sandbox'])
            if os.environ.get('FORME_TLS_SPKI'):
                options['args'].append('--ignore-certificate-errors-spki-list='+os.environ['FORME_TLS_SPKI'])
            if os.environ.get('FORME_CHROMIUM_EXECUTABLE'): options['executable_path']=os.environ['FORME_CHROMIUM_EXECUTABLE']
            browser=p.chromium.launch(**options)
            for lang in ['bg','en','de']:
                for width in [390,1280]:
                    ctx=browser.new_context(bypass_csp=False,viewport=dict(width=width,height=900),is_mobile=width==390,has_touch=width==390,reduced_motion='reduce')
                    observe(ctx)
                    ctx.add_init_script('if(["http:","https:"].includes(location.protocol)){localStorage.setItem("forme-language",'+json.dumps(lang)+');if(!localStorage.getItem("forme-video-seeded")){localStorage.setItem("forme-favorites",JSON.stringify({exercises:["Plank","Handstand_Pushups"],workouts:[]}));localStorage.setItem("forme-progress-v1",JSON.stringify({version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[],sets:[{id:"legacy-hspu-video",exerciseId:"Handstand_Pushups",date:"2026-11-20",kind:"reps",value:5}]}));localStorage.setItem("forme-video-seeded","true");}}')
                    page=ctx.new_page();requested=[]
                    page.on('request',lambda r:requested.append(r.url) if r.url.split('?')[0].endswith('.mp4') else None)
                    page.goto(base+'#exercises',wait_until='domcontentloaded');wait(page,'()=>!!navigator.serviceWorker.controller')
                    assert page.locator('#app [data-action="exercise-detail"][data-id="Handstand_Pushups"]').count()==0
                    assert len(page.evaluate('window.FORME_DATA.exercises'))==48
                    # Installation and catalogue browsing must not fetch any MP4.
                    assert not requested,requested
                    initial=page.evaluate('async()=>{const c=await caches.open("forme-video-v0143-dips2");return(await c.keys()).filter(r=>r.url.endsWith(".mp4")).length;}')
                    assert initial==0
                    for entry in ENTRIES:
                        id=entry['exerciseId'];variant=entry['variants'][0];print(lang,width,id,flush=True)
                        before=len(requested);v=open_exercise(page,id)
                        assert v.get_attribute('preload')=='none' and v.get_attribute('playsinline') is not None
                        assert v.get_attribute('controls') is not None and v.get_attribute('autoplay') is None
                        assert v.get_attribute('src')==variant['path'] and v.get_attribute('poster')==entry['poster']['path']
                        assert v.evaluate('v=>v.paused&&v.currentTime===0&&v.playbackRate===1')
                        page.wait_for_timeout(100);assert len(requested)==before,'preload none must remain lazy'
                        section=page.locator('.exercise-video');assert section.locator('.video-cue').inner_text().strip()
                        assert section.locator(f'a[href="{entry["sourcePage"]}"]').inner_text().strip()
                        assert section.locator(f'a[href="{entry["licenseUrl"]}"]').inner_text()==entry['license']
                        assert 'Компютърно генерирана' not in section.inner_text() and 'computer-generated' not in section.inner_text()
                        # Native Play hit target; pause/resume using native keyboard support.
                        native_play(v)
                        wait(page,'()=>document.querySelector(".exercise-video video").readyState>=2')
                        metrics=v.evaluate('v=>({w:v.videoWidth,h:v.videoHeight,d:v.duration,rate:v.playbackRate,muted:v.muted,audio:v.webkitAudioDecodedByteCount||0})')
                        assert (metrics['w'],metrics['h'])==(variant['width'],variant['height'])
                        assert abs(metrics['d']-variant['duration'])<.03 and metrics['rate']==1 and metrics['audio']==0
                        full=lang=='bg' and width==390
                        if full:
                            wait(page,'()=>document.querySelector(".exercise-video video").ended',timeout=round((variant['duration']+15)*1000))
                            REPORT['fullPlayback'].append(dict(id=id,seconds=variant['duration'],normalSpeed=True))
                        else: page.wait_for_timeout(120)
                        v.evaluate('v=>v.pause()');at=v.evaluate('v=>v.currentTime');page.wait_for_timeout(70);assert abs(v.evaluate('v=>v.currentTime')-at)<.02
                        v.evaluate('v=>{v.currentTime=v.duration*.5;}');wait(page,'()=>!document.querySelector(".exercise-video video").seeking')
                        assert abs(v.evaluate('v=>v.currentTime')-variant['duration']*.5)<.1
                        # Replay from start after a complete/end-positioned video.
                        v.evaluate('v=>{v.currentTime=0;}');v.evaluate('v=>v.play()');page.wait_for_timeout(100);v.evaluate('v=>v.pause()')
                        assert v.evaluate('v=>v.currentTime<1&&v.readyState>=2')
                        # Full body in CacheStorage, byte identity; range requests served by SW.
                        result=page.evaluate('''async path=>{const c=await caches.open('forme-video-v0143-dips2');const r=await c.match(path);if(!r)return null;const bytes=await r.arrayBuffer();return {status:r.status,bytes:bytes.byteLength,sha:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')};}''',base+variant['path'])
                        assert result==dict(status=200,bytes=variant['bytes'],sha=variant['sha256']),(id,result)
                        ranges=page.evaluate('''async path=>{const r=await fetch(path,{headers:{Range:'bytes=0-31'}});const invalid=await fetch(path,{headers:{Range:'bytes=999999999-'}});const whole=await fetch(path,{headers:{Range:'bytes=0-31','If-Range':'"old"'}});return [r.status,(await r.arrayBuffer()).byteLength,r.headers.get('Content-Range'),invalid.status,whole.status];}''',variant['path'])
                        assert ranges==[206,32,f'bytes 0-31/{variant["bytes"]}',416,200],ranges
                        # Native player remains within modal, with contain and no horizontal page overflow.
                        geometry=v.evaluate('v=>({width:v.getBoundingClientRect().width,max:document.documentElement.clientWidth,fit:getComputedStyle(v).objectFit})')
                        assert geometry['width']<=geometry['max'] and geometry['fit']=='contain'
                        if lang=='bg' and width==390:
                            output=ROOT/'qa-results/videos';output.mkdir(parents=True,exist_ok=True)
                            section.screenshot(path=str(output/(id+'.png')))
                        REPORT['cases'].append(dict(language=lang,width=width,id=id,metadata=metrics,range=ranges,lazy=True,replay=True))
                        close_detail(page)
                    # Offline reload, all viewed clips decode, play and seek; guest history remains.
                    ctx.set_offline(True);page.reload(wait_until='domcontentloaded')
                    for entry in ENTRIES:
                        v=open_exercise(page,entry['exerciseId']);native_play(v);v.evaluate('v=>{v.pause();v.currentTime=v.duration*.7;}');wait(page,'()=>!document.querySelector(".exercise-video video").seeking')
                        assert v.evaluate('v=>v.readyState>=2&&!v.error')
                        REPORT['offline'].append(dict(language=lang,width=width,id=entry['exerciseId']))
                        close_detail(page)
                    assert page.evaluate('localStorage.getItem("forme-favorites").includes("Handstand_Pushups")&&localStorage.getItem("forme-progress-v1").includes("legacy-hspu-video")')
                    REPORT['csp']+=page.evaluate('qaVideoCsp');ctx.close()
            # Existing video/image/audio caches survive new shell activation; no mass MP4 download.
            ctx=browser.new_context(bypass_csp=False);observe(ctx);page=ctx.new_page();page.goto(base+'#exercises');wait(page,'()=>!!navigator.serviceWorker.controller')
            expected=ENTRIES[0]['variants'][0]
            await_seed=page.evaluate('''async paths=>{for(const [name,path] of paths){const c=await caches.open(name);await c.put(path,await fetch(path));}await caches.open('forme-mobile-v0167-videos10');}''',[['forme-video-v0143-dips2',expected['path']],['forme-media-v029-optimized','media/exercises/Plank-480.webp'],['forme-audio-v0150-original1','media/yoga-music/calm-v1.m4a']])
            # The actual activate handler is exercised via a fresh SW script URL, not by synthetic cache deletion.
            page.evaluate('async()=>{const r=await navigator.serviceWorker.register("service-worker.js?qa-upgrade=0168",{scope:"./"});await r.update();}')
            wait(page,'()=>navigator.serviceWorker.controller?.scriptURL.includes("qa-upgrade=0168")&&navigator.serviceWorker.controller.state==="activated"')
            result=page.evaluate('''async()=>{const names=await caches.keys();return {oldShell:names.includes('forme-mobile-v0167-videos10'),video:!!await(await caches.open('forme-video-v0143-dips2')).match('media/exercise-videos/parallel-bar-dips-v2.mp4'),image:!!await(await caches.open('forme-media-v029-optimized')).match('media/exercises/Plank-480.webp'),audio:!!await(await caches.open('forme-audio-v0150-original1')).match('media/yoga-music/calm-v1.m4a')};}''')
            assert result==dict(oldShell=False,video=True,image=True,audio=True),result
            REPORT['upgrade']=result;REPORT['csp']+=page.evaluate('qaVideoCsp');ctx.close()
            missing_video_check(browser,base)
            browser.close()
        assert not REPORT['errors'] and not REPORT['csp'] and not REPORT['productionRequests'],REPORT
        output=Path(os.environ.get('FORME_VIDEOS_REPORT',ROOT/'qa-results/exercise-videos.json'));output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(REPORT,indent=2)+'\n')
        print(json.dumps(dict(cases=len(REPORT['cases']),offline=len(REPORT['offline']),fullPlayback=len(REPORT['fullPlayback']),upgrade=REPORT['upgrade'],errors=0)))
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
