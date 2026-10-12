# AP04-RSL-01 — resale receipt controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP03-OBL-01 / Draft PR #333 at `d769460aa7bb3ab2df72931b8de38b4a248e03e3`

**Status:** Locally verified; exact-head ephemeral database runtime pending

## Scope

This slice records an AIRPROP commercial resale receipt only after an immutable canonical `portfolio.ownership_transfers` fact already exists. It does not execute title transfer, insert an ownership interval or copy Core relationship authority.

The command now:

- requires a unit-bound, point-in-time resale with positive price and ISO currency;
- requires exact tenant, property, unit and effective-date parity with the Core transfer receipt;
- reuses the existing AAL2, `airprop.asset.manage` and current investment-mandate resolver;
- serializes all attempts for one Core transfer;
- returns the original receipt for exact replay and rejects changed payload or second-key replacement;
- makes commercial execution receipts immutable;
- records one shared audit event for the accepted AIRPROP receipt.

## Core boundary

The canonical seller and buyer ownership intervals and the immutable Core transfer receipt are inputs. AIRPROP stores only the commercial context and exact Core reference. The command emits no Core lifecycle mutation, ownership, tenancy, account link, role, payment authority or invented outbox event.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 241 migrations, 166 test files, 5248 assertions passed |
| AP04 pgTAP contract | 33 assertions cover direct RPC validation, Core subject/date parity, authority denial, replay/conflict, audit, immutability, serialization and zero title side effects |
| AIRPROP commercial route checks | 31 passed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| `git diff --check` | Passed |
| GitHub Actions database runtime | Pending exact-head Draft PR CI |

Fixtures are synthetic and use no human account. The database advisory lock and uniqueness are tested contractually; no separate simultaneous-session AP04 race harness is claimed.

The migration is an unmerged development artifact. It has not been applied to Supabase Remote or Production.
