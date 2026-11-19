"""Real image decoding, catalogue bindings and offline upgrade; not an anatomy detector."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import os
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REVIEW = json.loads((ROOT / 'qa/exercise-image-review-v3.json').read_text())
MANIFEST = json.loads((ROOT / 'media/manifest.json').read_text())
CORRECTED = [r['id'] for r in REVIEW['corrections']]
ALL_IDS = [r['id'] for r in REVIEW['catalogueAudit']]
FILES = [v for e in MANIFEST['entries'] if e['kind'] == 'exercise' and e['id'] in CORRECTED for v in e['variants'].values()]
RETIRED = [path for r in REVIEW['corrections'] for path in r['oldPaths']]
REPORT = dict(cases=[], errors=[], csp=[], productionRequests=[], retiredRequests=[])


def wait(page, expression):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if page.evaluate('()=>(' + expression + ')'):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: ' + expression)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ['/qa-anatomy-upgrade.html', '/qa-anatomy-legacy.js']:
            body = ('<!doctype html><title>Local upgrade fixture</title>' if path.endswith('html') else
                    "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));").encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html' if path.endswith('html') else 'application/javascript')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def observe(ctx):
    ctx.add_init_script('window.qaCsp=[];document.addEventListener("securitypolicyviolation",e=>qaCsp.push(e.effectiveDirective));')
    ctx.on('page', lambda page: page.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
    for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
        ctx.route('https://' + host + '/**', lambda route: (REPORT['productionRequests'].append(route.request.url), route.abort())[-1])
    ctx.on('request', lambda request: REPORT['retiredRequests'].append(request.url) if any(request.url.endswith(path) for path in RETIRED) else None)


def main():
    server = None
    base = os.environ.get('FORME_IMAGES_BASE')
    if not base:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        base = 'http://127.0.0.1:' + str(server.server_port) + '/'
    try:
        with sync_playwright() as p:
            args = ['--no-sandbox']
            if os.environ.get('FORME_TLS_SPKI'):
                args.append('--ignore-certificate-errors-spki-list=' + os.environ['FORME_TLS_SPKI'])
            options = dict(headless=True, args=args)
            if os.environ.get('FORME_CHROMIUM_EXECUTABLE'):
                options['executable_path'] = os.environ['FORME_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**options)
            for lang in ['bg', 'en', 'de']:
                for width in [390, 1280]:
                    ctx = browser.new_context(bypass_csp=False, viewport=dict(width=width, height=900), is_mobile=width == 390, has_touch=width == 390)
                    observe(ctx)
                    ctx.add_init_script('if(["http:","https:"].includes(location.protocol)){localStorage.setItem("forme-language",' + json.dumps(lang) + ');if(!localStorage.getItem("forme-qa-images-seeded")){localStorage.setItem("forme-favorites",JSON.stringify({exercises:["Plank"],workouts:[]}));localStorage.setItem("forme-qa-images-seeded","true");}}')
                    page = ctx.new_page()
                    page.goto(base + '#exercises', wait_until='domcontentloaded')
                    page.locator('[data-action=exercise-detail][data-id=Handstand]').first.wait_for()
                    wait(page, '!!navigator.serviceWorker.controller')
                    assert page.locator('#app .photo-visual img').count() == 49
                    for image in page.locator('#app .photo-visual img').all():
                        image.scroll_into_view_if_needed()
                        image.evaluate('img=>img.decode()')
                        dimensions = image.evaluate('img=>({width:img.naturalWidth,height:img.naturalHeight,src:img.currentSrc})')
                        # srcset width descriptors apply density correction and
                        # round intrinsic CSS pixels; decode file pixels below.
                        assert dimensions['width'] > 0 and abs(dimensions['width'] - dimensions['height'] * 1.5) <= 2, dimensions
                    decoded = page.evaluate('''async files=>Promise.all(files.map(async f=>{
                      const r=await fetch(f.path);if(!r.ok)throw Error('Missing '+f.path);
                      const bytes=await r.arrayBuffer(), bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));
                      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
                      const result={path:f.path,width:bitmap.width,height:bitmap.height,sha256:hash,bytes:bytes.byteLength};bitmap.close();return result;
                    }))''', FILES)
                    for expected, actual in zip(FILES, decoded):
                        assert all(expected[key] == actual[key] for key in ['path', 'width', 'height', 'sha256', 'bytes'])
                    for id in ALL_IDS:
                        page.locator(f'[data-action=exercise-detail][data-id={id}]').first.click()
                        image = page.locator('.modal .photo-visual img')
                        image.evaluate('img=>img.decode()')
                        if id in CORRECTED:
                            assert id + '-anatomy-v3-' in image.evaluate('img=>img.currentSrc')
                        if width == 1280:
                            assert image.evaluate('img=>img.currentSrc.endsWith("-960.webp")')
                        assert image.evaluate('img=>getComputedStyle(img).objectFit') == 'contain'
                        frame = page.locator('.modal .modal-visual').bounding_box()
                        assert abs(frame['width'] / frame['height'] - 1.5) < .01, frame
                        assert page.locator('.modal .media-ai-tag').inner_text()
                        badge = page.locator('.modal .media-ai-tag').bounding_box()
                        assert 0 <= badge['y'] - frame['y'] <= 12, (id, badge, frame)
                        picture = page.locator('.modal .photo-visual picture').bounding_box()
                        assert badge['y'] + badge['height'] <= picture['y'] + .5, (id, badge, picture)
                        assert page.locator('.modal .exercise-photo-credit').inner_text()
                        assert page.evaluate('document.documentElement.scrollWidth') <= width
                        if os.environ.get('FORME_IMAGES_SCREENSHOTS') and id in CORRECTED + ['Pullups', 'Arm_Circles']:
                            folder = Path(os.environ['FORME_IMAGES_SCREENSHOTS'])
                            folder.mkdir(parents=True, exist_ok=True)
                            page.screenshot(path=str(folder / f'{lang}-{width}-{id}.png'))
                        page.locator('.modal-close').click()
                    # Fetch completion precedes cache.put(); wait for actual stored responses.
                    wait(page, "caches.open('forme-media-v029-optimized').then(async c=>(await Promise.all(" + json.dumps([f['path'] for f in FILES]) + ".map(f=>c.match(new URL(f,location.href))))).every(Boolean))")
                    ctx.set_offline(True)
                    page.reload(wait_until='domcontentloaded')
                    page.locator('[data-action=exercise-detail][data-id=Handstand]').first.wait_for()
                    for id in ALL_IDS:
                        page.locator(f'[data-action=exercise-detail][data-id={id}]').first.click()
                        page.locator('.modal .photo-visual img').evaluate('img=>img.decode()')
                        page.locator('.modal-close').click()
                    assert 'Plank' in page.evaluate('localStorage.getItem("forme-favorites")')
                    REPORT['csp'] += page.evaluate('qaCsp')
                    REPORT['cases'].append(dict(language=lang, width=width, cards=49, details=len(ALL_IDS), correctedDetails=len(CORRECTED), decodedVariants=len(FILES), offline=True, guestPreserved=True))
                    ctx.close()
            if server:
                ctx = browser.new_context(bypass_csp=False)
                observe(ctx)
                page = ctx.new_page()
                page.goto(base + 'qa-anatomy-upgrade.html')
                page.evaluate("()=>navigator.serviceWorker.register('./qa-anatomy-legacy.js')")
                wait(page, "navigator.serviceWorker.controller?.scriptURL.endsWith('qa-anatomy-legacy.js')")
                page.evaluate("async paths=>{const c=await caches.open('forme-media-v029-optimized');for(const f of paths)await c.put(f,new Response('retired defective fixture'));await c.put('media/exercises/Plank-480.webp',await fetch('media/exercises/Plank-480.webp'));localStorage.setItem('forme-favorites',JSON.stringify({exercises:['Plank'],workouts:[]}));}", RETIRED)
                page.goto(base + '#exercises', wait_until='domcontentloaded')
                wait(page, "navigator.serviceWorker.controller?.scriptURL.endsWith('/service-worker.js')&&navigator.serviceWorker.controller.state==='activated'")
                result = page.evaluate("async paths=>{const c=await caches.open('forme-media-v029-optimized');return {retired:(await Promise.all(paths.map(f=>c.match(f)))).some(Boolean),plank:!!await c.match('media/exercises/Plank-480.webp'),guest:localStorage.getItem('forme-favorites').includes('Plank'),shell:(await caches.keys()).includes('forme-mobile-v0160-nav1')}}", RETIRED)
                assert result == dict(retired=False, plank=True, guest=True, shell=True), result
                REPORT['upgrade'] = result
                ctx.close()
            browser.close()
        assert not any(REPORT[key] for key in ['errors', 'csp', 'productionRequests', 'retiredRequests']), REPORT
        path = Path(os.environ.get('FORME_IMAGES_REPORT', ROOT / 'qa-results/exercise-images.json'))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(REPORT, ensure_ascii=False))
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
