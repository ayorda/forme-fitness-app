# FORME v0.13.3 — браузърна политика и ограничения на hosting

Фаза 3, подстъпка 3.3.5. Това е конкретна техническа защита в продължаващия преглед, не гаранция за липса на уязвимости или завършено независимо/правно приемане. Базата е v0.13.2, main `e82baa8c407cbbe0c3757f4565dab0e9b1d78a4b`.

## Наложена Content Security Policy

Една CSP meta е поставена веднага след charset, преди stylesheet/скриптовете. Default е `none`; разрешенията са изрични:

| Ресурс | Разрешено | Причина |
| --- | --- | --- |
| Скриптове | Само собствен origin | Каталози, app и pinned официален Firebase SDK; без inline/eval/remote exception. |
| Връзки | Собствен origin + identitytoolkit.googleapis.com, securetoken.googleapis.com, firestore.googleapis.com по HTTPS | Email/Password Auth, refresh/OOB и Firestore. Няма wildcard, loopback или произволен HTTPS host в production. |
| Стилове | Собствен origin, съществуващите inline стилове и fonts.googleapis.com | Динамични графики/барове и Google Fonts. Изключението е само за CSS, не скриптове. |
| Шрифтове | Собствен origin и fonts.gstatic.com | Съществуващата типография. |
| Изображения | Собствен origin и data URI | Локални WebP и локални SVG визуализации. |
| Медии, manifest, workers | Собствен origin | Локални видео файлове/PWA; `child-src self` е съвместим fallback за worker поддръжката. |
| Base, objects, frames, native form submit | Забранени | Няма нужда от тях; формите работят чрез предотвратен native submit и Firebase SDK. |

Referrer policy е изрично `strict-origin-when-cross-origin`: външните HTTPS заявки получават само origin, не пътя/fragment-а. Това запазва origin за услуги, които го използват при проверка на домейна.

PWA регистрацията е преместена в `pwa-register.js`, със същия HTTPS/localhost lifecycle и file-preview guard. Новият файл е в precache. HTML и precache използват един и същ versioned app.js URL, така че старият service worker да не върне стария inline-handler код под новата политика. Старият кеш се подменя при нормално обновяване, без принудително презареждане на активен екран/тренировка. Error fallback-ите за снимки/видео използват data marker + capture listener в app.js; няма executable HTML handler. Добавянето на CSP не променя Auth persistence, акаунтните пространства, облачните схеми/Rules или lifecycle на данните. CSP не изпраща reports към нова услуга.

## Реални граници

- Meta CSP защитава след позицията си в документа. Не е HTTP header; не предоставя Report-Only, `frame-ancestors` или CSP sandbox. `frame-src none` блокира frames вътре във FORME, а не вграждането на FORME в чужд сайт.
- При read-only проверката на GitHub Pages преди тази промяна има HSTS, но няма CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy response headers. Не се създава фиктивен `_headers` файл: GitHub Pages не го прилага. Пълната server-header защита изисква hosting решение, което реално я поддържа; такова преместване не се извършва тук.
- Worker script-ът има отделен response контекст; meta политиката ограничава стартирането му, но не се представя като собствен HTTP CSP за service-worker.js.
- `self` означава origin, включително останалите доверени файлове под ayorda.github.io. Компрометиран собствен скрипт/публикуване остава риск. Изтеглен JSON, споделен браузър и собственик с admin права не са защитени чрез CSP.
- CSS inline изключението, Google Fonts, shared Spark quota, липсата на App Check и временният живот на подписани права са остатъчни граници. Server Rules продължават да определят достъпа по UID/claims. Политиката не заменя escaping/схеми/доказан backup.
- Видео инфраструктурата е проверена с липсващ локален fixture, не с истински демонстрации: остава 0/49 клипа. Нови външни медии или Auth providers изискват нов преглед на необходимите origins.

## Проверки

[QA-BROWSER-SECURITY.md](./QA-BROWSER-SECURITY.md) описва повторимия сценарий с реално наложена CSP и официалния SDK. Emulator страницата в теста добавя само две loopback връзки, без промяна на останалите директиви; това изключение не се публикува в приложението. Test browser получава local-network-access permission само за този local origin. Synthetic тестовете не правят production requests или emails.

Оставащият общ обхват е в [SECURITY-REVIEW.md](./SECURITY-REVIEW.md) и [ROADMAP.md](./ROADMAP.md): 13/20 основни задачи, 7 незавършени плюс приемане; 3.3 технически 3/6, общият review продължава.

Технически източници: [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [ограничения на frame-ancestors в meta](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors), [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).
