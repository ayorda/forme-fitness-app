# FORME project instructions

- Explain work to the owner in clear Bulgarian.
- Report the current phase and numbered step, completed work, remaining work, and the completion estimate or concrete dependencies preventing an estimate. Use [ROADMAP.md](./ROADMAP.md), not commit/version/test counts, for product progress.
- The product plan has phases 0–3 and 20 major items in phases 1–3. Preserve the distinction between ready/tested, developed/unverified, partial, blocked and planned work.
- The owner's latest workflow instruction authorizes tested commits directly to `main`, without a Pull Request. GitHub Pages publishes from `main`; the previous PR-only restriction is superseded.
- Budget remains 0 EUR. Do not activate paid services, subscriptions or live payments without separate authorization.
- The specific female model must come from the owner's four original references. Do not substitute another person or publish private originals without the required permission and rights checks. Their absence is a blocker for the requested Cinematic Hero, not a completed feature.
- Personal Coaching means a real human trainer. Initial personalization uses transparent rules; a paid AI service is not required.
- Preserve existing functions and user data. Schema changes must retain legacy compatibility, export/import and failure rollback.
- Run `node --test test.js *.test.js` and the production syntax checks before publishing changes. Add new tests/modules to `.github/workflows/final-check.yml`, modules to `index.html` and Service Worker assets, and bump the cache when shell assets change.
- Update the release version consistently in translations, HTML, README and DEMO. Keep historical test results distinct from the current test count.
- Verify UI changes with a real browser at mobile and desktop sizes in BG/EN/DE. Clearly distinguish browser emulation from checks on real iPhone/Android devices.
- See [DEV.md](./DEV.md) for structure, [QA-AUDIO.md](./QA-AUDIO.md) for the audio lifecycle, and [ROADMAP.md](./ROADMAP.md) for priorities and blockers.
