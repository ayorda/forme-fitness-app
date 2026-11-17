"""Actual font decoding/use/cache/fallback checks. No physical phone claim."""
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
MANIFEST = json.loads((ROOT / 'media/fonts/manifest.json').read_text())
REPORT = {'languages': [], 'errors': [], 'violations': [], 'externalFontNetwork': [], 'productionRequests': []}


def wait(page, expression, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate('()=>(' + expression + ')'):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: ' + expression)


def actual_fonts(page):
    page.evaluate("""async()=>{for(const [id,family,text] of [['dm','DM Sans','FORME ÄÖÜäöüß 123'],['space','Space Grotesk','FORME ÄÖÜäöüß 123'],['bg','DM Sans','Прогрес']]){await document.fonts.load('400 22px "'+family+'"',text);let el=document.getElementById('qa-font-'+id);if(!el){el=document.createElement('span');el.id='qa-font-'+id;document.body.append(el);}el.textContent=text;Object.assign(el.style,{fontFamily:'"'+family+'",system-ui',fontSize:'22px',position:'absolute',left:'-10000px',top:'0'});}await document.fonts.ready;}""")
    session = page.context.new_cdp_session(page)
    session.send('DOM.enable')
    session.send('CSS.enable')
    document = session.send('DOM.getDocument')['root']['nodeId']
    output = {}
    for name in ['dm', 'space', 'bg']:
        node = session.send('DOM.querySelector', {'nodeId': document, 'selector': '#qa-font-' + name})['nodeId']
        output[name] = session.send('CSS.getPlatformFontsForNode', {'nodeId': node})['fonts']
    session.detach()
    assert any(f['isCustomFont'] and f['glyphCount'] > 0 and f['familyName'].startswith('DM Sans') for f in output['dm']), output
    assert any(f['isCustomFont'] and f['glyphCount'] > 0 and f['familyName'].startswith('Space Grotesk') for f in output['space']), output
    assert output['bg'] and all(not f['isCustomFont'] for f in output['bg']), 'Cyrillic intentionally keeps the existing system fallback'
    return output


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = None
    base = os.environ.get('FORME_FONTS_BASE')
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
                ctx = browser.new_context(bypass_csp=False, viewport={'width': 390, 'height': 900}, is_mobile=True, has_touch=True)
                def observe(context):
                    context.add_init_script('window.qaViolations=[];document.addEventListener("securitypolicyviolation",e=>qaViolations.push(e.effectiveDirective));')
                    context.add_init_script('if(["http:","https:"].includes(location.protocol))localStorage.setItem("forme-language",' + json.dumps(lang) + ');')
                    context.on('page', lambda page: page.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
                    for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
                        context.route('https://' + host + '/**', lambda route: (REPORT['externalFontNetwork'].append(route.request.url), route.abort())[-1])
                    for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
                        context.route('https://' + host + '/**', lambda route: (REPORT['productionRequests'].append(route.request.url), route.abort())[-1])
                observe(ctx)
                page = ctx.new_page()
                page.goto(base, wait_until='domcontentloaded')
                page.locator('.hero').wait_for()
                fonts = actual_fonts(page)
                # Readable layouts and dark-card text in both actual themes.
                contrast = {}
                for theme in ['light', 'dark']:
                    page.evaluate('(theme)=>document.documentElement.setAttribute("data-theme",theme)', theme)
                    for width in [320, 390, 768, 1280]:
                        page.set_viewport_size({'width': width, 'height': 900})
                        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                        assert page.evaluate('document.documentElement.scrollWidth') <= width, (lang, theme, width)
                    contrast[theme] = page.evaluate(r"""()=>{const card=document.querySelector('.today-plan'),rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0),backgrounds=getComputedStyle(card).backgroundImage.match(/rgba?\([^)]*\)/g).map(rgb);return ['h2','.eyebrow'].map(selector=>{const foreground=lum(rgb(getComputedStyle(card.querySelector(selector)).color));return Math.min(...backgrounds.map(color=>{const bg=lum(color);return (Math.max(foreground,bg)+.05)/(Math.min(foreground,bg)+.05);}));});}""")
                    assert min(contrast[theme]) >= 4.5, (lang, theme, contrast)
                page.emulate_media(media='print')
                assert page.locator('.today-plan h2').evaluate('(el)=>getComputedStyle(el).color') == 'rgb(17, 17, 17)'
                page.emulate_media(media='screen')
                wait(page, '!!navigator.serviceWorker.controller')
                cached = page.evaluate("""async files=>{const keys=await caches.keys(),key=keys.find(k=>k.startsWith('forme-mobile-')),cache=await caches.open(key);return Promise.all(files.map(async f=>{const r=await cache.match(new URL(f.src,location.href));return !!r&&r.status===200;}));}""", MANIFEST['files'])
                assert all(cached), cached
                ctx.set_offline(True)
                page.reload(wait_until='domcontentloaded')
                actual_fonts(page)
                decoded = page.evaluate("""async files=>{const result=[];for(const file of files){const r=await fetch(file.src);const data=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('font hash mismatch');const font=new FontFace('QAOfflineFont',data,{weight:file.weights});await font.load();result.push(font.status);}return result;}""", MANIFEST['files'])
                assert decoded == ['loaded'] * 5
                REPORT['violations'].extend(page.evaluate('qaViolations'))
                page.set_viewport_size({'width': 390, 'height': 900})
                screenshot = os.environ.get('FORME_FONTS_SCREENSHOTS')
                if screenshot:
                    page.screenshot(path=str(Path(screenshot) / ('fonts-' + lang + '.png')))
                ctx.close()
                fallback = browser.new_context(bypass_csp=False, service_workers='block', viewport={'width': 320, 'height': 900})
                observe(fallback)
                fallback.route('**/media/fonts/**', lambda route: route.abort())
                page = fallback.new_page()
                page.goto(base, wait_until='domcontentloaded')
                page.locator('.hero').wait_for()
                page.evaluate('()=>document.fonts.ready')
                assert page.evaluate('document.documentElement.scrollWidth') <= 320
                assert page.locator('h1').inner_text().strip()
                REPORT['violations'].extend(page.evaluate('qaViolations'))
                fallback.close()
                REPORT['languages'].append({'language': lang, 'platformFonts': fonts, 'offlineDecodedFiles': len(decoded), 'noHorizontalOverflow': [320, 390, 768, 1280], 'failedFontFallback': True, 'todayCardContrast': contrast, 'printText': True})
                print(lang + ' actual local fonts, offline bytes/decoding and failed-font fallback passed', flush=True)
            browser.close()
        assert not any(REPORT[k] for k in ['errors', 'violations', 'externalFontNetwork', 'productionRequests']), REPORT
        REPORT['passed'] = True
    finally:
        if server:
            server.shutdown()
        path = Path(os.environ.get('FORME_FONTS_REPORT', ROOT / 'qa-results/fonts.json'))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
