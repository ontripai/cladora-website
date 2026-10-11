# CE011-UX-02 — Event feedback and recovery

Owner: CLADORA Community & Experience. Independent base: `main@c0c82133d4a6ef95800c72b9f155fb9a65ae1822`. Branch: `feat/ce-011-form-recovery`.
Status: locally tested; prepared for in_review. No acceptance, closure, activation or release is claimed.

## Verified starting point

PR #348 already merged the Event page and product-gated navigation; PR #318 delivered the domain/API/proposal. Those completed slices must be retained. CE010-UX-02 is independently in_review in Draft #356 and is not a prerequisite for this Event slice.

Read-only code inspection of `CustomerEventInterest.tsx` and `CustomerEventInterestPage.tsx` found that attendance disables only its submit button, lacks a pending/success status region and sets its pending guard through React state. An isolated synthetic JSDOM probe against the unchanged component issued two commands for two synchronous form submit events, found zero status regions while pending and after success, and no disabled fieldset. The probe ran with in-memory promises only; it made no network or database call. This is a reproduced UX gap, not live-user or operational evidence.

The page already supplies exact Event/interest versions, server-derived action flags, named eligible participants, Workspace/Event keys and a 409 reload. It must keep these contracts. Interest remains explicitly not a booking or admission guarantee in RO/EN/FA.

## Bounded next implementation

1. Add named attendance form and localized pending/success feedback outside busy controls.
2. Use a synchronous CE-owned UI guard for overlapping attendance submissions and Event actions; retain the server as the authority for permission, audience, version and idempotency.
3. Lock only the in-flight form fields; preserve entered participant/time after failure, and clear them only after confirmed success.
4. Keep feedback and pending state isolated across Workspace/Event changes, including late completion; assess selection loss and 409 recovery with the existing page contract.
5. Preserve timezone display and conversion, eligible named selection, RTL and the no-booking/no-guarantee notice.

## Acceptance evidence to produce

Mounted delayed-command tests in RO/EN/FA must cover success, failure, retry, overlapping submit/action events, exact Event/interest versions, participant/time payloads, permission-hidden controls, and Workspace/Event reset. Retain the existing Event domain/page/HTTP regression. Run lint and typecheck, then create a Draft PR and verify exact-head CI and Preview.

No shared Core change is currently required. If authoritative recovery needs a new Core contract, record the exact owner/input/output/error/version agreement before consumption; do not implement shared authority in CE. No migrations, remote mutation, activation, Auth, CAPTCHA, SMTP, DNS, environment setting, Merge or Production deployment is in scope.


## Implemented delivery

The Event component now owns one synchronous per-Event UI lock across publication/cancellation, interest changes and attendance. This prevents overlap before a React pending render, while server permission/version/idempotency checks remain authoritative. All actions announce localized pending/success feedback through a persistent polite region outside busy fields. The attendance form has a unique accessible name and describes its current status/error. Its fields are disabled while an Event command is pending; failure preserves participant and local time, success clears only submitted attendance input. Event actions leave any unrelated attendance draft intact.

The exported component keys its internal state by Workspace and Event even when a caller supplies no key. Cleanup suppresses feedback and refresh callbacks from discarded Event completions. Changed versions in the same Event retain the draft. The existing page reloads on 409 but does not retry the mutation automatically; explicit retry consumes the reloaded Event and interest versions.

The no-booking/no-admission-guarantee notice, named eligible participants, timezone, RTL and server-derived permission flags remain present. No dependency or shared Core/API/SQL change was required.

## Executed local validation

- `node scripts/test-ce-011-form-recovery.mjs`: 15 mounted locale/action scenarios plus late completion for both Event and Workspace changes; duplicate submit and cross-action lock, exact version/member/timezone payloads, pending/success/error announcements, failure preservation and explicit retry, permission-hidden controls and state reset passed.
- `node scripts/test-ce-011-event-page.mjs`: mounted real page/Context provider with mocked transport; version conflict triggers reload, no automatic mutation retry, and explicit retry uses new Event/interest versions; existing named projection/navigation/503 checks passed.
- `node scripts/test-ce-011-event-interest.mjs`: existing domain/UI regression passed.
- `node scripts/test-ce-011-route.mjs`: existing HTTP boundary checks passed.
- Targeted ESLint and `npm run typecheck`: passed.
- `git diff --check`: passed.

The new regression is included in the CE-owned CI workflow. The mounted tests use JSDOM and synthetic delayed commands or mocked HTTP transport. They are not a physical screen-reader or real-user/live-database acceptance claim. Exact-head CI and Preview results will be recorded in the Draft PR and PM after inspection. No remote migration inventory is needed for this UI-only slice.

## Next independent slice

After this delivery is recorded in_review, `CE012-UX-02` begins with a bounded assessment of Guide form feedback/recovery. It will retain Guide versions, safe references, permission flags and Workspace/Guide reset; the already merged Guide page will not be repeated. External reference resolution remains owned by the existing Documents/Core contract.
