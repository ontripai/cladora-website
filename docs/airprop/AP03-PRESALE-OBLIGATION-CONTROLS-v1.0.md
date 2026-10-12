# AP03-OBL-01 — presale obligation controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP02-RSV-01 / Draft PR #319 at `bea9e3064f1695b54eb5f468ffe41e1eae3e94cb`

**Status:** Locally verified; exact-head ephemeral database runtime pending

## Scope

This additive slice hardens the existing AIRPROP command that records a purchase-obligation schedule for an existing signed presale. It does not create a second accounting contract and it does not treat an opaque source reference as a posted financial fact.

The command now:

- requires one to 120 strict terms containing only a canonical date, positive amount with at most four decimals and a bounded label;
- requires the exact term sum to equal the declared total;
- reauthorizes through the existing AAL2, workspace permission and current investment-mandate resolver;
- serializes all attempts for one signed presale before resolving replay or conflict;
- returns the original receipt for an exact replay and rejects changed payloads under the same key;
- rejects a second schedule for the same presale with a named conflict;
- writes one shared `audit.events` record for the accepted schedule.

## Finance boundary

`financial_source_reference` remains a bounded external reference only. Recording the AIRPROP commercial schedule creates no `finance.journals`, `billing.invoices`, `payments.payments`, ownership, tenancy or invented Finance outbox event. A canonical Finance-owned source/posting contract is still required before AIRPROP can validate that reference against an official financial record or request a posting.

This is a real cross-workstream dependency, not a reason to introduce an AIRPROP ledger, receivable, payment rail or resource registry.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 240 migrations, 165 test files, 5215 assertions passed |
| AP03 pgTAP contract | 30 assertions cover direct RPC validation, authority denial, exact replay, changed-payload conflict, same-presale conflict, audit, serialization primitive and non-effects in Finance/Core |
| AIRPROP commercial route checks | 27 passed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| `git diff --check` | Passed |
| Local pgTAP runtime | Not executed: managed Docker is unavailable and the Supabase CLI cannot create its fixed config directory on the read-only home filesystem |
| GitHub Actions database runtime | Pending exact-head Draft PR CI |

All fixtures are synthetic and use no human account. The database advisory lock and unique constraints are exercised contractually; a separate simultaneous-session AP03 race harness is not claimed.

The migration is an unmerged development artifact. It has not been applied to Supabase Remote or Production.
