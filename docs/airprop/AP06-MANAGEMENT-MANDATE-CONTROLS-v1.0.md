# AP06-MGT-01 — management mandate request and acceptance controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP05-LSE-01 / Draft PR #341 at `b23cf4eef3742e4ccec43e5fbd0fd755ea84c6c8`

**Status:** Locally verified; exact-head ephemeral database runtime pending

## Scope

AP06 records a bounded management proposal and a separately recorded acceptance. The request identifies the canonical property and owner party, an enumerated commercial scope, an explicit start/end date and proposal evidence. Acceptance requires a different currently authorized AAL2 actor and separate evidence.

Both commands serialize on the canonical property, reauthorize before every replay, reject changed replay payloads, preserve immutable evidence and use the shared `audit.events` path.

## Authority boundary

Request or acceptance does **not** create or mutate:

- `platform.workspace_property_authorities`;
- roles, permissions, assignments or delegations;
- `airprop.commercial_execution_links`;
- a lease, title, payment, invoice, journal, ledger, outbox or message.

An accepted commercial mandate is therefore not software command authority. Core must establish any later `property_operations` authority through its existing controlled process before AIRPROP can record the existing management execution link.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 243 migrations, 168 test files, 5312 assertions passed |
| AP06 pgTAP contract | 33 assertions cover scope/duration, owner parity, AAL2 authority denial, independent acceptance, replay/conflict, immutable shared audit and zero authority/role/execution effects |
| AIRPROP commercial route | 41 checks passed, including omission of client-supplied authority/role fields |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| `git diff --check` | Passed |
| GitHub Actions database runtime | Pending exact-head Draft PR CI |

Fixtures are synthetic and use no human account. The migration is an unmerged development artifact and has not been applied to Supabase Remote or Production.
