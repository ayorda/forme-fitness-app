# FORME v0.13.3 — повторима browser/CSP проверка

Обхват: [BROWSER-SECURITY.md](./BROWSER-SECURITY.md). Използват се Chromium, pinned Playwright и локални demo Auth/Firestore емулатори; няма production fixtures или парола на собственика.

## Автоматизиран сценарий

- 825 app/model теста, 37 production JS parse проверки; нови policy/registration и media fallback проверки. Всички клиентски и operator регресии остават в набора.
- `qa/csp-browser.py`: трите езика, 11 екрана, 24 theme/width изгледа и offline PWA/home/privacy/services/account. Отделен legacy-cache sentinel проверява прехода към versioned app и последващ offline reload. CSP bypass е изрично false.
- Отрицателният код се зарежда като нормален външен same-origin script, а не като привилегировано DevTools изпълнение. Проверяват се блокирани inline/eval/remote script, event handler, image, frame, object, form, base, fetch и blob worker; probe domain е прихванат и реална мрежова заявка към него не се допуска.
- Медийни error fallback-и се проверяват с недостъпни локални снимки и липсващо видео fixture. Плеърът стартира/паузира/продължава, а синтезираният аудио lifecycle достига playing/paused без CSP нарушения. Това не е доставено видео съдържание.
- Официален SDK: вход/reload/изход; auto на два изолирани профила, realtime favorite, независим offline merge и изтриване; повторно удостоверено account deletion с auto; ръчен safety download failure/cancel/successful restore със запазен гост; регистрация и заявки за verification/reset писма само в Emulator.
- Test HTML за SDK запазва production CSP и добавя само http://127.0.0.1:8080 и :9099 в connect-src. Production HTML се проверява отделно и не ги съдържа. Local-network-access permission е само за test origin, необходимо при нов Chromium; не се иска от потребители на публичния сайт.
- Google Fonts CSS се замества с празен CSS в CI за детерминистична fallback типография; реалните font hosts се проверяват отделно при публичния smoke test. CI не използва blanket TLS bypass.

Проведено локално успешно: 825/825 теста, 37 production parse, 3 езика/24 изгледа, всички 10 CSP категории, legacy-cache upgrade/offline, media fallback, timer/audio lifecycle и трите SDK потока. File preview е отказан от managed browser политиката и не е представен като успешно проверен тук.

Повтаряне:

```sh
python -m pip install -r qa/requirements-browser.txt
python -m playwright install --with-deps chromium
npx -y firebase-tools@15.36.0 emulators:exec --only auth,firestore --project demo-forme-sync "python qa/csp-browser.py"
```

При вече работещи local demo емулатори използвай техните точни два env адреса; не стартирай втори процес върху портовете. FORME_CHROMIUM_EXECUTABLE е незадължителен override към локален Chromium. Playwright polling използва DevTools evaluate, защото nested eval на wait_for_function може да се блокира от CSP; отрицателният executable probe остава обикновен page script.

File guest preview се опитва отделно; managed browser може да го откаже с ERR_BLOCKED_BY_ADMINISTRATOR. Този отказ се отчита като ограничение на средата и не се заобикаля. HTTP/PWA проверките остават задължителни.

Новата отделна `browser-security` CI задача изпълнява сценария и публикува само synthetic JSON evidence. qa-results е извън Git. Това не е физически iPhone/Android тест, WebKit тест, многодневна проверка или положителен production restore/delete.

## Ръчна проверка на телефон — остава

Обнови до v0.13.3 и провери нормалното отваряне, снимките, една тренировка/таймер, хранителния екран и профила. При вече запазен вход той трябва да се възстанови. Провери и офлайн отваряне след предварително онлайн зареждане; Safari и Home Screen са отделни контейнери. Не изтривай акаунта или browser данните за този тест. При проблем запиши екран/действие/браузър без парола или личен архив.

Вече приетото основно iPhone close/reopen остава прието. Новата policy/пълното device приемане и автоматичният дву-устройствен тест още не са потвърдени физически.

CI при първото изпълнение установи 4 px header overflow при BG/320 px с fallback шрифт. Измерването изчаква две animation frames и отчита излизащите елементи; mobile отстоянията/brand са компактни до 360 px, без намаляване на бутоните или отпадане на строгия width assert. Service Worker cache е policy2 за CSS поправката.
