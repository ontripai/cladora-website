# CE010-UX-02 — Accessible Community form feedback

Owner: CLADORA Community & Experience. Independent base: `main@c0c82133d4a6ef95800c72b9f155fb9a65ae1822`. Branch: `feat/ce-010-form-feedback`.
Status: locally tested; candidate for in_review. No acceptance, closure, activation, remote migration or release is claimed.

## Problem and resulting behavior

Announcement draft, content report and moderation forms previously cleared successful input without announcing the result. Pending forms only disabled the submit button, and two synchronous submit events could issue two commands before React committed the pending state.

Each form now has a unique accessible name, a persistent polite status region and a localized pending/success message in RO/EN/FA. A synchronous per-form lock prevents overlapping UI commands; a disabled fieldset holds the submitted fields steady until completion. A failed action retains the exact entered text and selections, announces failure and allows retry. Only success clears submitted fields and requests refresh. Existing Workspace/Community keys reset both input and feedback; completion in a discarded Workspace does not announce success in the new Workspace.

This is UI feedback only: client locking is not server idempotency or authority. Existing server permission, context, audience, expected-version and idempotency contracts remain authoritative. No Core registry, API, SQL, migration, shared layout, Auth or environment setting changes are part of the package.

## Evidence and limits

Actually executed locally:

- `node scripts/test-ce-010-form-feedback.mjs`: nine mounted locale/form scenarios plus late Workspace completion; overlapping submissions, exact payloads, moderation version, disabled fields, pending/success/error announcements, preserved retry input, success-only refresh and feedback reset passed.
- `node scripts/test-ce-010-ce-012-ui.mjs`: existing RO/EN/FA, RTL, named choices and preservation/reset regression passed.
- `npm run typecheck`: passed.
- Targeted ESLint on the changed component and test: passed with zero warnings.
- `git diff --check`: passed.

The new regression is included in the CE-owned CI workflow. These mounted tests use delayed in-memory commands and JSDOM; they do not claim real-user, live database, physical screen-reader or browser acceptance. CI and Preview must be checked on the delivery commit before recording their results.

## Previous delivery retained

Live recovery proved #318, #348 and #349 merged. Only the confirmed merged CE event/guide branches were cleaned after ancestry verification. Draft #354 (`CE010-UI-01`) is separate and must not be duplicated or merged by this package. Current #354 head `5574424` has all checks passing: Application `38068052006`, CE Community `38068051954`, Database `38068051955` and native runtime `38068051989`. The failed Inter/Turbopack build at older head `ea3df23` also passed on its one failed-job rerun (`38061591411`, attempt 2). `CORE-CE-BUILD-FONT-01` is therefore cleared by the agreed successful-check evidence; no CE patch to the shared build was made.

The external/unavailable label `CE010` is not proof of repository capability `CE-010`. Proposal installation and Workspace activation remain separate gates; no migration inventory was queried because this UX slice changes no persistence contract.

## Next independent package

`CE011-UX-02` will assess and improve Event-interest/attendance form feedback and recovery on the already merged Event page. It will reuse exact server versions and existing Core authority, preserve the no-reservation/no-entry-guarantee message, and cover RO/EN/FA, pending/error/success states and Workspace/Event reset. Shared changes, if needed, must be recorded as formal owner dependencies. This next package is not yet claimed tested or complete.
