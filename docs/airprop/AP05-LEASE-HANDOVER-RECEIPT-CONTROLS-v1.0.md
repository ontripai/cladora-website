# AP05-LSE-01 — lease handover receipt controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP04-RSL-01 / Draft PR #340 at `fe2492c9eb5122f24a1ddc688acd1ee8ee6fd515`

**Status:** Exact-head CI verified on Draft PR #341; Finance receipt integration blocked on FIN01

## Scope and boundary

This slice records AIRPROP commercial context only after an immutable Core `occupancy.lease_handover_receipts` record and its canonical `occupancy.leases` row exist. The database requires tenant, property, unit, effective dates, rent and currency to match the Core handover schedule and lease.

AIRPROP creates no second lease, occupancy, handover, title, role, payment, invoice or journal. The existing AAL2, `airprop.asset.manage`, current investment mandate, serialized replay, immutable commercial receipt and shared audit path remain authoritative.

## Finance dependency

The controlled plan requires receipt from Finance. No accepted FIN01 source/posting receipt contract is available in the current baseline, so this slice neither invents an opaque financial receipt nor writes Finance tables. Named blocker: `FIN01-LEASE-RECEIPT`, owned by Finance/Core; required output is a versioned canonical source/receipt contract with authority, idempotency and reversal semantics.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 242 migrations, 167 test files, 5279 assertions passed |
| AP05 pgTAP contract | 31 assertions cover Core schedule/date parity, authority denial, replay/conflict, audit, immutability and zero duplicate-lease/Finance effects |
| AIRPROP commercial route checks | 35 passed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| `git diff --check` | Passed |
| GitHub Actions database runtime | Run `37925791969` passed: AP05 pgTAP passed; all 167 files / 5279 assertions passed |
| Application Foundation | Run `37925792137` passed |
| AIRPROP commercial lifecycle | Run `37925792029` passed |
| Vercel | Passed for exact head `b23cf4eef3742e4ccec43e5fbd0fd755ea84c6c8` |

Fixtures are synthetic and use no human account. The migration is an unmerged development artifact and has not been applied to Supabase Remote or Production.
