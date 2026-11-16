# FORME v0.13.1 — ограничен технически преглед на защитата

Базата е main `4bb1fc856a92a1c941fc5a0387a5c2695165b7a0` (v0.13.0); поправката е v0.13.1. Това е преглед на наличния код и локални adversarial/SDK проверки, не независима сертификация, пълен penetration test или финално правно приемане. 3.3 остава **3/6 технически подготвени**; петата подстъпка за общ review е започната, не обявена за окончателно завършена. Общият план е 13/20.

## Установено и поправено

**Предпазен download преди restore — риск за целостта на собствените данни.** Ранният permit можеше да остане след известна download грешка; няма bypass към чужд акаунт. Поправката добавя двуфазна preparation/receipt, отказ, busy сериализация и lifecycle инвалидиране. Регресията е възпроизведена върху стария код и покрита с model/SDK/UI проверки. Подробности: [QA-SAFE-RESTORE.md](./QA-SAFE-RESTORE.md).

## Проверен обхват и граници

| Граница | Проверено | Остатъчно ограничение |
| --- | --- | --- |
| Auth/startup | Един официален App/Auth, LOCAL restoration, без собствено съхранение на пароли/токени; UID/verification invalidation и SDK refresh. Съществуващият Auth код е непроменен. | Изчистване/отнемане на browser storage може да изисква нов вход. Реален phone reboot/действително изминали дни не са доказани. |
| Firestore owner | Чужди UID, unauthenticated/unverified, списъци и collection-group; create/update exact keys/типове/размери/revision/времена; all-or-nothing смесен owner/foreign batch. | Размерът ограничава един документ, не общия брой заявки. |
| Authority/roles | Pro/Trainer идват само от Auth custom claims; program/coach канонични права/consent и server time; body/client flags не предоставят роли. | Production issuer/незабавна Pro отмяна не са реализирани. Стар подписан claim може да действа до expiry/срока. Няма активни покупки или production service grants. |
| Account deletion | Recent Auth, auto + snapshot marker атомично преди Auth deletion; fresh marker необходим за auto delete; marker + пресъздаден auto се отказват. | Операторско почистване, минимален UID/време остатък, липса на максимален срок. Без разрушителен production тест. |
| Local copies | Отделени UID/guest, точен safety export/consent, guards, Web Lock, отказ/partial/retry; текущите Auth/guest/cloud се пазят. | Некриптиран споделен браузър не е vault. localStorage не е многоключова транзакция; технически guards и други копия остават. |
| Imports/DOM | Позволени ключове/типове/граници; ограничено декомпресиране, размер/SHA-256/архивна схема. `esc`/textContent при лични имена, бележки и email; няма eval/динамично изпълнение на архиви. | SHA-256 не е автентичност/криптиране. Schema/Rollback не заменят запазен файл; същият origin с изпълним зловреден код има достъп до browser данните. |
| SDK/cache | Pinned SDK + source/license hashes в регресионния набор. Service Worker пази same-origin GET; Firebase API/POST не се кешират. | Доверява се на GitHub Pages origin/публикувания код и доставчиците; HTTP security headers/CSP не са одитирани като отделна завършена защита. |

Оценката на Rules по използвания Firebase auditor checklist е [SECURITY-RULES-AUDIT.json](./SECURITY-RULES-AUDIT.json): **4/5**, с ограничения за shared quota и непрозрачния owner payload. Това не е оценка 4/5 за целия продукт. Не е установен обход към чужди данни в проверените сценарии; липсата на установен обход не доказва липса на всички уязвимости.

## Доказателства и следващо приемане

Допълнителен browser DOM тест на BG/EN/DE показва синтетичен HTML/onerror низ като текст в име на хранене и асистиране на серия, без изпълнение или инжектиран img елемент. Това проверява тези конкретни sinks, не всички възможни XSS пътища.

810 app/model теста, 36 production parse проверки, 249 локални Rules твърдения; BG/EN/DE browser SDK проверки и регресия на автоматичния режим. Доказателствата за публикуването са GitHub Actions/Pages за съответния commit; те не удостоверяват физически устройства или правно съответствие.

Преди широка аудитория остават: приемане на retention/операторския процес и отговорности, независим/по-широк client/supply-chain/hosting review, anti-abuse/квоти и реални устройства. App Check не е активиран или представян като налична защита. Преди първи Programs/Coaching запис се разширяват export/deletion/retention и се приема реалният човешки процес. Бюджет 0 €, без нови платени услуги и без промяна на production правила/административни ключове в тази задача.

[PRIVACY.md](./PRIVACY.md), [MAINTENANCE.md](./MAINTENANCE.md), [ROADMAP.md](./ROADMAP.md).

Актуализация v0.13.2: отделният operator helper вече независимо проверява липсата на auto при read и atomic commit; промененото състояние запазва marker-а. 26 unit/27 локални HTTP твърдения и read-only production съвместимост. Това не променя Rules score, не активира retention максимум и не приключва организационното/production приемане по 3.3.4. [Процесът за приемане](./RETENTION-PROCESS-DRAFT.md) е изрично предложение.
