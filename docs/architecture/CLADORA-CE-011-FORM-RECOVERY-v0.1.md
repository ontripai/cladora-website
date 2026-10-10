# CE011-UX-02 — Event feedback and recovery: started

Owner: CLADORA Community & Experience. Independent base: `main@c0c82133d4a6ef95800c72b9f155fb9a65ae1822`. Branch: `feat/ce-011-form-recovery`.
Status: in_progress; discovery and acceptance contract only. No implementation completion or passing acceptance test is claimed.

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
