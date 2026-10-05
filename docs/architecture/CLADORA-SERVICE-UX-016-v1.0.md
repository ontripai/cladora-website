# SERVICE UX alignment 016

## Reference and scope

The user attached UX and Background Controls Directive v1.0 on 2026-10-05 and requested attachment and continuation. The original DOCX is preserved byte-for-byte in `references/CLADORA-UX-Background-Controls-Directive-v1.0.docx`, with an adjacent SHA-256 manifest. Local decision identifier: UX-DEC-001; no official ADR number is invented. The directive complements lifecycle v1.1 and travels with each SERVICE successor session.

Baseline: main `23014127c4d3f4ca5b8eaeaa60c58637eb6d0b40` (#261). This package is confined to SERVICE quote presentation UI and its evidence. Core owns common context, navigation, authentication, notifications and shared report conventions. AIRPROP and Operations implementations are not duplicated.

## Evidence register

| Rule | Page / role / context | Observed gap and effect | Owner / correction | Evidence / final status |
| --- | --- | --- | --- | --- |
| UX-07, UX-14, QA-02 | Quote presentation / coordinator or requester / authorized workspace | All read failures, including network errors, alleged account denial | SERVICE: distinguish session verification (401), unavailable access (403/404), and retryable load failure; refresh remains available | Mounted UI tests cover offline recovery, 500/503, 401 and 403; corrected locally |
| UX-04, UX-09 | Quote presentation / coordinator without publish permission | Draft visible without an explanation of the missing action or next responsible person | SERVICE: explain review-only access and ask workspace administrator for permission; show state-specific next step | Mounted UI verifies coordinator-only guidance; no permission is granted by this change |
| UX-08 | Quote presentation / all supported locales | Raw ISO timestamp was technical and difficult to read | SERVICE: localized display, semantic time element, preserved exact instant, explicit UTC; Persian RTL and bidirectional isolation | Mounted UI checks RO/EN/FA date, timezone and direction; user-specific timezone preference remains dependent on Core |
| UX-03, QA-03 | Quote presentation buttons | Focus affordance relied on browser defaults | SERVICE: explicit focus-visible outline on refresh and presentation actions | Source inspection; keyboard/mobile visual acceptance still pending |
| SEC-01, SEC-04, QA-04 | Quote read/publish endpoint and database | Server authorization already implemented independently of button visibility | SERVICE: retain all existing guards, immutable versions, same-key retry and scope isolation | Existing 015 UI replay, denied read, conflict and late-response tests retained; API regression rerun |
| UX-02, SEC-02 | Shared workspace/context selection and authentication | Cross-module context and return-to-action behavior is outside this panel; not fully audited | Core: shared dirty-form and authentication-return contracts; SERVICE must consume them | Dependent on Core; do not claim compliance from this patch |
| UX-05–07, UX-10–13, UX-15, SEC-03, RULE-01 | Catalogue/request/draft/order/document/report and notification flows | Full SERVICE flow audit remains outstanding; commercial acceptance and orders are not enabled | SERVICE audit plus existing Core Finance/documents and Operations contracts | Unreviewed; not declared complete |

## Validation and remaining acceptance

16 mounted UI scenarios pass, including four new behavior scenarios; full-precision amounts, confirmed success after history failure, no duplicate writes, frozen retries and cross-workspace late response isolation remain covered. Targeted API regression, TypeScript and ESLint results are recorded with the delivery. This is not a claim of complete QA-01–06 acceptance: a new live publication grant, live presentation, keyboard/mobile check, and measured user task baseline remain outstanding. No invented task-time targets are asserted.

No migration, role grant, notification, order, payment, acceptance or production deployment is part of this package. Temporary pilot permission must not be silently extended. Preserve this register and both attached directives in the next SERVICE handoff; coordinate common gaps through the Core workstream (CLADORA 12 and successors).
