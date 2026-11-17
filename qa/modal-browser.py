"""Actual modal focus/AX isolation and restoration. Not a VoiceOver/device test."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import os
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = {'cases': [], 'errors': [], 'violations': [], 'productionRequests': [], 'externalFontNetwork': []}


def wait(page, expression, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if page.evaluate('()=>(' + expression + ')'):
            return
        page.wait_for_timeout(100)
    raise AssertionError('Timed out: ' + expression)


def isolated(page, context):
    wait(page, 'document.querySelector(".modal")?.contains(document.activeElement)')
    assert page.evaluate("()=>[document.querySelector('.shell'),document.querySelector('.skip-link')].every(el=>el.inert&&el.getAttribute('aria-hidden')==='true')")
    page.evaluate("()=>document.getElementById('top-account').focus()")
    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")')
    # A focusable outside the known roots also exercises the fallback guard.
    page.evaluate("()=>{const b=document.createElement('button');b.id='qa-outside-focus';document.body.append(b);b.focus();b.remove();}")
    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")')
    session = context.new_cdp_session(page)
    tree = session.send('Accessibility.getFullAXTree')['nodes']
    session.detach()
    label = page.locator('#top-account').get_attribute('aria-label')
    assert not any(not node.get('ignored') and node.get('role', {}).get('value') == 'button' and node.get('name', {}).get('value') == label for node in tree), 'background account remains accessible'
    assert any(not node.get('ignored') and node.get('role', {}).get('value') == 'dialog' and node.get('name', {}).get('value') for node in tree)
    first = page.locator('.modal-close')
    first.focus()
    page.keyboard.press('Shift+Tab')
    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")')
    page.keyboard.press('Tab')
    assert first.evaluate('(el)=>document.activeElement===el')


def released(page):
    assert page.locator('[role=dialog]').count() == 0
    assert page.evaluate("()=>[document.querySelector('.shell'),document.querySelector('.skip-link')].every(el=>!el.hasAttribute('inert')&&!el.hasAttribute('aria-hidden'))")
    assert page.evaluate('document.body.style.overflow') == ''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    server = None
    base = os.environ.get('FORME_MODAL_BASE')
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
                    context = browser.new_context(bypass_csp=False, viewport={'width': width, 'height': 900}, is_mobile=width < 600, has_touch=width < 600)
                    context.add_init_script('window.qaViolations=[];document.addEventListener("securitypolicyviolation",e=>qaViolations.push(e.effectiveDirective));')
                    context.add_init_script('if(["http:","https:"].includes(location.protocol)){localStorage.setItem("forme-language",' + json.dumps(lang) + ');localStorage.setItem("forme-sound","false");}')
                    context.on('page', lambda page: page.on('pageerror', lambda error: REPORT['errors'].append(str(error))))
                    for host in ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com']:
                        context.route('https://' + host + '/**', lambda route: (REPORT['productionRequests'].append(route.request.url), route.abort())[-1])
                    for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
                        context.route('https://' + host + '/**', lambda route: (REPORT['externalFontNetwork'].append(route.request.url), route.abort())[-1])
                    page = context.new_page()
                    page.goto(base + '#exercises', wait_until='domcontentloaded')
                    trigger = page.locator('[data-action=exercise-detail][data-id=Plank]').first
                    trigger.click()
                    isolated(page, context)
                    field = page.locator('#detail-set-value')
                    field.fill('17')
                    assert field.evaluate('(el)=>document.activeElement===el')
                    # Changing a favorite replaces the original trigger and can
                    # rerender the dialog; close must find the replacement card.
                    page.locator('.modal [data-action=favorite][data-kind=exercises][data-id=Plank]').first.click()
                    wait(page, '!!document.activeElement.closest("[role=dialog]")')
                    assert page.locator('.shell').get_attribute('aria-hidden') == 'true'
                    page.keyboard.press('Escape')
                    released(page)
                    assert page.locator('[data-action=exercise-detail][data-id=Plank]').first.evaluate('(el)=>document.activeElement===el')
                    # Successive open/close cycles must not preserve our own
                    # temporary aria-hidden/inert as the original page state.
                    for _ in range(3):
                        page.locator('[data-action=exercise-detail][data-id=Plank]').first.click()
                        isolated(page, context)
                        page.locator('.modal-close').click()
                        released(page)
                    page.goto(base + '#nutrition', wait_until='domcontentloaded')
                    page.locator('[data-action=food-detail][data-id=rice]').first.click()
                    isolated(page, context)
                    if width > 600:
                        page.locator('.modal-overlay').click(position={'x': 2, 'y': 2})
                    else:
                        page.locator('.modal-close').click()
                    released(page)
                    page.goto(base + '#sessions', wait_until='domcontentloaded')
                    page.locator('[data-action=workout-detail][data-id=cal-start]').first.click()
                    isolated(page, context)
                    page.locator('.modal [data-action=start-workout]').click()
                    isolated(page, context)
                    for action, expected in [('player-start', 'player-pause'), ('player-pause', 'player-resume'), ('player-resume', 'player-pause')]:
                        page.locator('[data-action=' + action + ']').click()
                        assert page.evaluate('document.activeElement.dataset.action') == expected
                    page.locator('[data-action=player-restart]').click()
                    assert page.evaluate('!!document.activeElement.closest("[role=dialog]")')
                    page.locator('.modal-close').click()
                    released(page)
                    page.keyboard.press('?')
                    isolated(page, context)
                    page.keyboard.press('Escape')
                    released(page)
                    wait(page, '!!navigator.serviceWorker.controller')
                    context.set_offline(True)
                    page.reload(wait_until='domcontentloaded')
                    page.locator('[data-action=workout-detail][data-id=cal-start]').first.click()
                    isolated(page, context)
                    page.locator('.modal-close').click()
                    released(page)
                    REPORT['violations'].extend(page.evaluate('qaViolations'))
                    REPORT['cases'].append({'language': lang, 'width': width, 'backgroundFocusAndAXBlocked': True, 'guardOutsideRoots': True, 'tabWrapEscapeReturn': True, 'replacedTriggerReturn': True, 'repeatedCycles': True, 'playerControlsKeepFocus': True, 'offline': True})
                    context.close()
                    print(lang + '/' + str(width) + ' dialog isolation, focus, player and offline passed', flush=True)
            browser.close()
        assert not any(REPORT[key] for key in ['errors', 'violations', 'productionRequests', 'externalFontNetwork']), REPORT
        REPORT['passed'] = True
    finally:
        if server:
            server.shutdown()
        path = Path(os.environ.get('FORME_MODAL_REPORT', ROOT / 'qa-results/modal.json'))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
