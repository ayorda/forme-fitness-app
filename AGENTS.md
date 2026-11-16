# FORME project instructions

- Explain work to the owner in clear Bulgarian.
- Report the current phase and numbered step, completed work, remaining work, and the completion estimate or concrete dependencies preventing an estimate. Use [ROADMAP.md](./ROADMAP.md), not commit/version/test counts, for product progress.
- The product plan has phases 0–3 and 20 major items in phases 1–3. Preserve the distinction between ready/tested, developed/unverified, partial, blocked and planned work.
- Latest owner instruction: publish tested changes directly to `main`, without creating new Pull Requests. The owner explicitly approved merging/publishing PR #50. This supersedes the earlier branch/PR/no-publication instruction. GitHub Pages publishes from main.
- Budget remains 0 EUR. Do not activate paid services, subscriptions or live payments without separate authorization.
- The specific female model must come from the owner's four original references. Do not substitute another person or publish private originals without the required permission and rights checks. Their absence is a blocker for the requested Cinematic Hero, not a completed feature.
- Personal Coaching means a real human trainer. Initial personalization uses transparent rules; a paid AI service is not required.
- Preserve existing functions and user data. Schema changes must retain legacy compatibility, export/import and failure rollback.
- Run `node --test test.js *.test.js` and the production syntax checks before publishing changes. Add new tests/modules to `.github/workflows/final-check.yml`, modules to `index.html` and Service Worker assets, and bump the cache when shell assets change.
- Update the release version consistently in translations, HTML, README and DEMO. Keep historical test results distinct from the current test count.
- Verify UI changes with a real browser at mobile and desktop sizes in BG/EN/DE. Clearly distinguish browser emulation from checks on real iPhone/Android devices.
- See [DEV.md](./DEV.md) for structure, [QA-AUDIO.md](./QA-AUDIO.md) for the audio lifecycle, and [ROADMAP.md](./ROADMAP.md) for priorities and blockers.

- The owner explicitly chose automatic per-record synchronization for 3.2. Preserve that goal; manual snapshots are an advanced backup tool. Use the account workspace storage supplied by bootstrap for user data; direct global localStorage writes can mix accounts. Keep device preferences local, preserve legacy/guest data and tombstones, and include private/auto in atomic account deletion. 3.2 remains partial until real two-device acceptance.

- Keep local-copy cleanup scoped to inactive known account data. It must preserve the current account, guest originals, SDK/session data and cloud records, require an exact safety export and separate confirmation, and retain paused/barrier guards. Extend the cleanup allowlist/QA if new user-data keys are added. It is not a general clear-all or secure-erase control.
