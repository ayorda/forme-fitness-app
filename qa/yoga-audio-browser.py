"""Real Chromium decoding/output/lifecycle/offline checks; no production accounts.

Optional FORME_AUDIO_BASE tests the deployed app. This is not a physical phone test.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse
import json
import os
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = {'languages': [], 'errors': [], 'violations': [], 'productionRequests': [], 'externalFontNetwork': []}
PROBE = r"""
window.qaContexts=[];window.qaFiles=[];window.qaViolations=[];
document.addEventListener('securitypolicyviolation',e=>qaViolations.push(e.effectiveDirective));
const Original=window.AudioContext||window.webkitAudioContext;
class Observed extends Original{
 constructor(...args){super(...args);qaContexts.push(this);this.qaAnalyser=this.createAnalyser();this.qaAnalyser.fftSize=2048;}
 createGain(){const node=super.createGain(),connect=node.connect.bind(node),engine=this;node.connect=function(target,...rest){if(target===engine.destination)connect(engine.qaAnalyser);return connect(target,...rest);};return node;}
 createBufferSource(){const node=super.createBufferSource(),start=node.start.bind(node),stop=node.stop.bind(node);let record;node.start=function(...args){record={duration:node.buffer.duration,loop:node.loop,active:true};qaFiles.push(record);return start(...args);};node.stop=function(...args){if(record)record.active=false;return stop(...args);};return node;}
}
window.AudioContext=Observed;
"""


def wait(page, expression, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate('()=>(' + expression + ')'):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: ' + expression)


def signal(page):
    return page.evaluate("""async()=>{let peak=0;for(let i=0;i<8;i++){for(const ctx of qaContexts){const data=new Float32Array(ctx.qaAnalyser.fftSize);ctx.qaAnalyser.getFloatTimeDomainData(data);peak=Math.max(peak,Math.sqrt(data.reduce((n,x)=>n+x*x,0)/data.length));}await new Promise(r=>setTimeout(r,60));}return peak;}""")


def open_yoga(page):
    page.locator('[data-action=workout-detail][data-id=yoga-reset]').first.click()
    page.locator('.modal [data-action=start-workout]').click()


def playing(page, fallback=False):
    key = 'fallback' if fallback else 'playing'
    wait(page, "document.querySelector('#music-status')?.textContent===FORME_INTERFACE_TRANSLATIONS.get('audio.status." + key + "',document.documentElement.lang)")


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = None
    base = os.environ.get('FORME_AUDIO_BASE')
    if not base:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        base = 'http://127.0.0.1:' + str(server.server_port) + '/'
    try:
        with sync_playwright() as p:
            args = ['--no-sandbox']
            # Optional exact proxy-CA keys, never a blanket TLS or CSP bypass.
            if os.environ.get('FORME_TLS_SPKI'):
                args.append('--ignore-certificate-errors-spki-list=' + os.environ['FORME_TLS_SPKI'])
            options = dict(headless=True, args=args)
            if os.environ.get('FORME_CHROMIUM_EXECUTABLE'):
                options['executable_path'] = os.environ['FORME_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**options)
            for lang in ['bg', 'en', 'de']:
                ctx = browser.new_context(bypass_csp=False, viewport={'width': 390, 'height': 900}, is_mobile=True, has_touch=True)
                ctx.add_init_script(PROBE)
                ctx.add_init_script('if(["http:","https:"].includes(location.protocol)){localStorage.setItem("forme-language",' + json.dumps(lang) + ');localStorage.setItem("forme-sound","false");}')
                ctx.on('page', lambda page: page.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
                def request(req):
                    if urlparse(req.url).hostname in {'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com'}:
                        REPORT['productionRequests'].append(req.url)
                ctx.on('request', request)
                for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
                    ctx.route('https://' + host + '/**', lambda route: route.abort())
                for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
                    ctx.route('https://' + host + '/**', lambda route: (REPORT['externalFontNetwork'].append(route.request.url), route.abort())[-1])
                page = ctx.new_page()
                page.goto(base + '#sessions', wait_until='domcontentloaded')
                page.locator('[data-action=workout-detail][data-id=yoga-reset]').first.wait_for()
                wait(page, '!!navigator.serviceWorker.controller')
                assert page.evaluate('qaContexts.length') == 0
                assert page.evaluate("async()=>!(await caches.keys()).some(k=>k.startsWith('forme-audio-'))")
                open_yoga(page)
                page.locator('#music-enabled').check()
                assert page.evaluate('qaContexts.length') == 0, 'enabling alone must not start audio'
                page.locator('[data-action=player-start]').click()
                playing(page)
                levels = {}
                for style in ['calm', 'flow', 'breath', 'relax']:
                    page.locator('#music-mode').select_option(style)
                    playing(page)
                    wait(page, 'qaFiles.filter(x=>x.active).length===1')
                    levels[style] = round(signal(page), 7)
                    assert levels[style] > .001, (style, levels)
                    assert page.evaluate('qaFiles.at(-1).loop&&Math.abs(qaFiles.at(-1).duration-80)<.03')
                assert page.evaluate('qaContexts.length') == 1
                assert page.evaluate("async()=>{const k=(await caches.keys()).find(k=>k.startsWith('forme-audio-'));return (await (await caches.open(k)).keys()).length;}") == 4
                page.locator('[data-action=player-pause]').click()
                wait(page, 'qaContexts.every(x=>x.state==="suspended")&&qaFiles.every(x=>!x.active)')
                page.locator('[data-action=player-resume]').click()
                playing(page)
                page.locator('#music-volume').fill('0')
                wait(page, 'qaContexts.every(x=>x.state==="suspended")&&qaFiles.every(x=>!x.active)')
                page.locator('#music-volume').fill('28')
                playing(page)
                page.locator('[data-action=close-modal]').click()
                wait(page, 'qaContexts.every(x=>x.state==="suspended")&&qaFiles.every(x=>!x.active)')
                page.reload(wait_until='domcontentloaded')
                assert page.evaluate('qaContexts.length') == 0, 'remembered preference is not permission to autoplay'
                open_yoga(page)
                assert page.locator('#music-mode').input_value() == 'relax'
                assert page.locator('#music-volume').input_value() == '28'
                assert page.locator('#music-enabled').is_checked()
                ctx.set_offline(True)
                page.locator('[data-action=player-start]').click()
                playing(page)
                assert signal(page) > .001
                page.locator('[data-action=close-modal]').click()
                # A never-cached selection offline must use the original synth,
                # not a broken file, and must still stop with the workout.
                page.evaluate("async()=>{for(const k of await caches.keys())if(k.startsWith('forme-audio-'))await caches.delete(k);}")
                page.reload(wait_until='domcontentloaded')
                open_yoga(page)
                page.locator('[data-action=player-start]').click()
                playing(page, fallback=True)
                assert signal(page) > .001
                assert page.evaluate('qaFiles.length') == 0
                page.locator('[data-action=player-restart]').click()
                wait(page, 'qaContexts.every(x=>x.state==="suspended")')
                REPORT['violations'].extend(page.evaluate('qaViolations'))
                REPORT['languages'].append({'language': lang, 'recordedSignalRms': levels, 'offlineRecording': True, 'uncachedOfflineFallback': True, 'pauseMuteCloseRestart': True, 'preferencesReloadNoAutoplay': True, 'singleEngine': True})
                ctx.close()
                print(lang + ' music decoding, controls, persisted preferences and offline passed', flush=True)
            browser.close()
        assert not REPORT['errors'] and not REPORT['violations'] and not REPORT['productionRequests'] and not REPORT['externalFontNetwork'], REPORT
        REPORT['passed'] = True
    finally:
        if server:
            server.shutdown()
        destination = Path(os.environ.get('FORME_AUDIO_REPORT', ROOT / 'qa-results/yoga-audio.json'))
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
