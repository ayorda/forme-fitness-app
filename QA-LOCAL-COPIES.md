# Проверки на локалните копия — v0.13.0

Обхватът е [LOCAL-DATA-CONTROLS.md](./LOCAL-DATA-CONTROLS.md), част от незавършената 3.3. Тества се почистване само на синтетични неактивни локални копия. Не се изтриват реални данни на собственика или production акаунти.

## Автоматични проверки

- 21 `local-copies.test.js`: scoped enumeration/export, забранени Auth/guest/current ключове, raw recovery/валиден standard import, missing backup/consent, cancel, променен source/queue/identity, Web Locks, размери, rollback, partial и retry. v0.12-style stale facade с актуалния непроменен auto engine вижда paused metadata и не изпраща локалното почистване като cloud deletion.
- 16 `workspaces.test.js`: предишните 11 + минимизиран migration marker, прекъснат/невалиден barrier, отказ на стар facade и изрично ново отваряне без повторно guest копиране.
- Общият набор е **800 теста**; **36 production JS parse проверки**. Новите файл/тест са регистрирани в CI, HTML, Service Worker; версии/кеш/линкове/преводи са проверени. Правилата, Auth, SDK и merge engine са непроменени; съществуващите 236 Firestore assertions остават в CI.

Команди:

```sh
node --test test.js *.test.js
node --check local-copies.js
node --check workspaces.js
```

## Browser / SDK сценарии

Локалният Auth/Firestore Emulator и действителният официален SDK създават синтетичен акаунт, включват auto и го изтриват по нормалния UI. Останалото локално копие се открива от друг текущ акаунт:

1. Истински download с лични записи и recovery cache; standard backup validate/import остава валиден.
2. Без отметка бутонът за премахване е disabled; cancel отменя разрешението.
3. Променен source след износа отказва премахването; нов архив е необходим.
4. Keyboard Space/Enter потвърждават избраното копие; текущият акаунт, guest оригиналите, Firebase session и cloud state остават.
5. Принудителен rollback failure е частичен резултат с clearing marker; нов опит завършва.
6. BG/EN/DE × две теми × 320/390/768/1280 =24 изгледа; няма page errors/overflow. Това е Chromium, а не физически iPhone.

Реалните cloud/Auth операции са само по локалния synthetic setup/delete flow. Самият local copy модул няма network API. Не се създава нов production marker или тестов акаунт за тези проверки.

Проведено: трите BG/EN/DE потока и всички 24 изгледа са успешни, без page errors/overflow/production requests. Отделна реална SDK регресия на auto с два локални профила на BG/EN/DE също премина: присъединяване, realtime favorite, независим offline merge, изтриване и reload с възстановена сесия. Няма проведен физически дву-устройствен или многодневен тест.

Допълнителен локален browser тест: принудителна download грешка отменя разрешението за премахване; след успешен download синтетичното копие се почиства със запазен гост. Обновената PWA обвивка зарежда новия модул и privacy/home/services/account офлайн. Няма cloud requests.

## Кратък ръчен тест на iPhone — остава

1. Обнови FORME до v0.13.0, без да триеш browser site data. Отвори „Данни и поверителност“.
2. Ако няма неактивни копия, очаквай празен списък. Не изтривай реален акаунт само за да създадеш копие за тест.
3. При налично копие изтегли архива, провери файла в Files/Downloads и прегледай кои записи съдържа. До потвърждението няма почистване.
4. По желание натисни „Отказ“ и провери, че копието остава. Реално премахване извършвай само за избрано ненужно копие след собствен преглед и запазен файл.
5. След това текущият акаунт/гост прогрес и входът трябва да са запазени; другите устройства/cloud данни не се изтриват. Могат да останат други guest/browser/изтеглени копия и минимални локални guards.

Провери Safari и Home Screen отделно, ако ползваш и двете: контейнерите може да са отделни. Този нов контрол още няма owner acceptance на физически телефон. Приетият основен iPhone persistent-login тест остава приет; автоматичният дву-устройствен тест е отделно по [QA-AUTO-SYNC.md](./QA-AUTO-SYNC.md).
