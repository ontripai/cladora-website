# AP07-OPS-01 — management action links

**Owner:** AIRPROP reference contract; Operations owns canonical work orders

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP06-MGT-01 / Draft PR #342 at `622245fc42914f169fb90a4f9e578923300b8a1a`

**Status:** Exact-head CI verified on Draft PR #343; SERVICE resource reference remains blocked

## Scope

AP07 records an immutable AIRPROP reference from an accepted, currently effective management mandate to an existing actionable `maintenance.work_orders` record. The canonical tenant, property and optional unit must match. Every command and replay requires both the existing AIRPROP `airprop.asset.manage` permission and a current Core `property_operations` authority.

The command serializes by canonical work-order id, rejects changed replay payloads and writes one shared audit event. Revocation of Core authority immediately denies even an exact replay.

## Owner boundaries

AIRPROP does not create or mutate the Operations work order or event history. It creates no SERVICE request/order, Work Order, Finance payable/journal/payment, outbox, role, permission or authority.

The current canonical SERVICE request contract has no accepted property/resource reference suitable for this link. Named blocker: `SERVICE-RESOURCE-REF`, owned by SERVICE/Core; required output is a versioned request/order receipt with canonical resource identity and current authority semantics. AP07 does not add a parallel service order or broaden the existing SERVICE schema.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 244 migrations, 169 test files, 5340 assertions passed |
| AP07 pgTAP contract | 28 assertions cover canonical parity, active Core authority, status eligibility, authority denial/revocation, replay/conflict, immutable shared audit and zero downstream effects |
| AIRPROP commercial route | 42 checks passed; canonical-id-only mapping omits client creation/payment/outbox fields |
| TypeScript / ESLint / diff check | Passed |
| GitHub Actions database runtime | Run `37927757575` passed: AP07 28/28; all 169 files / 5340 assertions passed |
| Application Foundation | Run `37927757636` passed |
| AIRPROP commercial lifecycle | Run `37927757659` passed |
| Vercel | Passed for exact head `0a927f543e354ee53097453b70072c1e3054aace` |

Fixtures are synthetic and use no human account. The migration is an unmerged development artifact and has not been applied to Supabase Remote or Production.
