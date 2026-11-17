"""Pinned axe audit of guest/synthetic UI states under the real CSP.

This does not certify WCAG or replace physical assistive-technology testing.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import base64
import json
import os
import ssl
import subprocess
import tempfile
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
AXE = ROOT / 'qa/node_modules/axe-core/axe.min.js'
TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
ROUTES = ['home', 'sessions', 'exercises', 'nutrition', 'plan', 'progress', 'favorites', 'recovery', 'account', 'privacy', 'services']
REPORT = {'engine': 'axe-core', 'version': '4.14.0', 'tags': TAGS, 'views': [], 'errors': [], 'csp': [], 'productionRequests': [], 'externalFontNetwork': []}
SEED = r"""
if(['http:','https:'].includes(location.protocol)){
 const date=new Date(),today=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
 // Deliberately synthetic legacy fixtures exercise the existing guest migration.
 // No real account, archive or production database is used by this audit.
 const records={
  'forme-favorites':{workouts:['cal-start'],exercises:['Plank','Pullups'],foods:['salmon']},
  'forme-current-meal':[{id:'chicken',grams:'150'},{id:'rice',grams:'150'}],
  'forme-saved-meals':[{name:'QA meal',items:[{id:'chicken',grams:'200'}]},{name:'QA breakfast',items:[{id:'oats',grams:'80'}]}],
  'forme-plan':{mon:'cal-start',wed:'yoga-reset'},'forme-date-plans':{[today]:'cal-start'},
  'forme-progress-v1':{version:1,goal:{workoutsPerWeek:3,minutesPerWeek:90},sessions:[{id:'qa-s1',workoutId:'cal-start',date:today,minutes:15}],sets:[{id:'qa-st1',exerciseId:'Plank',date:today,kind:'seconds',value:60},{id:'qa-st2',exerciseId:'Pullups',date:today,kind:'reps',value:10}]},
  'forme-nutrition-v1':{version:1,goal:{kcal:2000,protein:100},entries:[{id:'qa-n1',date:today,name:'QA meal',items:[{id:'chicken',grams:'200'},{id:'rice',grams:'150'}]}]},
  'forme-recovery-v1':{version:1,ageGroup:'adult',entries:[{id:'qa-r1',date:today,bedtime:'23:00',wakeTime:'07:00',bedOffset:0,wakeOffset:0,awakeMinutes:15,quality:4,fatigue:2}]}
 };
 for(const [key,value] of Object.entries(records))if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(value));
 localStorage.setItem('forme-sound','false');
}
window.qaViolations=[];document.addEventListener('securitypolicyviolation',e=>qaViolations.push(e.effectiveDirective));
"""


def wait(page, expression, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate('()=>(' + expression + ')'):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: ' + expression)


def capture(page, language, theme, width, state):
    assert page.locator('html').get_attribute('lang') == language
    assert page.locator('html').get_attribute('data-theme') == theme
    page.evaluate('()=>document.fonts.ready')
    # Contrast must be sampled after the existing 200 ms theme transitions.
    page.wait_for_timeout(300)
    if not page.evaluate('!!window.axe'):
        page.evaluate("()=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./qa-axe.js';s.onload=resolve;s.onerror=()=>reject(Error('axe source failed'));document.head.append(s);})")
    assert page.evaluate('axe.version') == REPORT['version']
    result = page.evaluate("""async tags=>{const r=await axe.run(document,{runOnly:{type:'tag',values:tags},resultTypes:['violations','incomplete']});return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,helpUrl:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))};}""", TAGS)
    REPORT['views'].append({'language': language, 'theme': theme, 'width': width, 'state': state, **result})
    REPORT['csp'].extend(page.evaluate('qaViolations'))
    if result['violations']:
        print(language, theme, width, state, [(v['id'], len(v['nodes'])) for v in result['violations']], flush=True)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    assert AXE.exists(), 'Run npm ci --prefix qa --ignore-scripts first'
    source = AXE.read_text()
    REPORT['engineSha256'] = hashlib.sha256(AXE.read_bytes()).hexdigest()
    server = None
    certificate_dir = None
    pins = [value for value in os.environ.get('FORME_TLS_SPKI', '').split(',') if value]
    base = os.environ.get('FORME_A11Y_BASE')
    if not base:
        # Match production's HTTPS requirement without weakening Auth config or
        # trusting every certificate. The test key stays in a temporary folder.
        certificate_dir = tempfile.TemporaryDirectory(prefix='forme-a11y-tls-')
        certificate = str(Path(certificate_dir.name) / 'certificate.pem')
        key = str(Path(certificate_dir.name) / 'key.pem')
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        public = subprocess.check_output(['openssl', 'x509', '-in', certificate, '-pubkey', '-noout'])
        der = subprocess.check_output(['openssl', 'pkey', '-pubin', '-outform', 'DER'], input=public)
        pins.append(base64.b64encode(hashlib.sha256(der).digest()).decode())
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(certificate, key)
        server.socket = tls.wrap_socket(server.socket, server_side=True)
        Thread(target=server.serve_forever, daemon=True).start()
        base = 'https://127.0.0.1:' + str(server.server_port) + '/'
    try:
        with sync_playwright() as p:
            args = ['--no-sandbox']
            if pins:
                args.append('--ignore-certificate-errors-spki-list=' + ','.join(pins))
            options = dict(headless=True, args=args)
            if os.environ.get('FORME_CHROMIUM_EXECUTABLE'):
                options['executable_path'] = os.environ['FORME_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**options)
            for language in ['bg', 'en', 'de']:
                for theme in ['light', 'dark']:
                    for width in [390, 1280]:
                        context = browser.new_context(bypass_csp=False, service_workers='block', viewport={'width': width, 'height': 900}, timezone_id='UTC', is_mobile=width < 600, has_touch=width < 600)
                        context.add_init_script(SEED)
                        context.add_init_script('if(["http:","https:"].includes(location.protocol)){localStorage.setItem("forme-language",' + json.dumps(language) + ');localStorage.setItem("forme-theme",JSON.stringify(' + json.dumps(theme) + '));}')
                        context.route('**/qa-axe.js', lambda route: route.fulfill(content_type='application/javascript', body=source))
                        for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
                            context.route('https://' + host + '/**', lambda route: (REPORT['productionRequests'].append(route.request.url), route.abort())[-1])
                        for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
                            context.route('https://' + host + '/**', lambda route: (REPORT['externalFontNetwork'].append(route.request.url), route.abort())[-1])
                        context.on('page', lambda page: page.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
                        page = context.new_page()
                        def go(route):
                            page.goto(base + '#' + route, wait_until='domcontentloaded')
                            page.locator('#app h1,#app h2').first.wait_for()
                        def scan(state):
                            capture(page, language, theme, width, state)
                        for route in ROUTES:
                            go(route)
                            scan(route)
                        go('nutrition')
                        for tab in ['meal', 'saved', 'journal']:
                            page.locator('[data-action=food-tab][data-tab=' + tab + ']').click()
                            scan('nutrition-' + tab)
                        go('exercises')
                        page.locator('[data-action=exercise-detail][data-id=Plank]').first.click()
                        scan('exercise-detail')
                        page.locator('.modal-close').click()
                        go('nutrition')
                        page.locator('[data-action=food-tab][data-tab=library]').click()
                        page.locator('[data-action=food-detail][data-id=rice]').first.click()
                        scan('food-detail')
                        page.locator('.modal-close').click()
                        go('sessions')
                        page.locator('[data-action=workout-detail][data-id=cal-start]').first.click()
                        scan('workout-detail')
                        page.locator('.modal [data-action=start-workout]').click()
                        scan('player-ready')
                        page.locator('[data-action=player-start]').click()
                        scan('player-running')
                        page.locator('[data-action=player-pause]').click()
                        scan('player-paused')
                        page.locator('.modal-close').click()
                        page.keyboard.press('?')
                        scan('shortcuts')
                        page.locator('.modal-close').click()
                        go('plan')
                        page.locator('[data-action=plan-view][data-view=month]').click()
                        scan('plan-month')
                        page.locator('[data-action=plan-date]').first.click()
                        scan('plan-selected-date')
                        go('account')
                        for mode in ['signup', 'reset']:
                            page.locator('[data-action=account-mode][data-mode=' + mode + ']').click()
                            scan('account-' + mode)
                        context.close()
                        print(language + '/' + theme + '/' + str(width) + ': 25 states audited', flush=True)
            browser.close()
        REPORT['violationCount'] = sum(len(v['violations']) for v in REPORT['views'])
        REPORT['incompleteCount'] = sum(len(v['incomplete']) for v in REPORT['views'])
        assert len(REPORT['views']) == 300, len(REPORT['views'])
        assert REPORT['violationCount'] == 0, 'Accessibility violations: see qa-results/a11y.json'
        assert not any(REPORT[key] for key in ['errors', 'csp', 'productionRequests', 'externalFontNetwork']), REPORT
        REPORT['passed'] = True
    finally:
        if server:
            server.shutdown()
        if certificate_dir:
            certificate_dir.cleanup()
        path = Path(os.environ.get('FORME_A11Y_REPORT', ROOT / 'qa-results/a11y.json'))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
