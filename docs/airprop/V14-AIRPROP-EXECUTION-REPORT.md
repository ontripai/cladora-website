# CLADORA v1.4 — AIRPROP execution report

**Report timestamp:** 2026-10-09T14:20:33+03:30
**Program baseline:** `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

| Package ID | Responsible work | Baseline | Status | Start time | Commit / PR | Test evidence | Blocker | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AP-VAL-01A` | AIRPROP | CLADORA v1.4 / `2fb9d7d` | Review hardening verified; exact-head acceptance pending | 2026-10-08T16:51:22+03:30 | Draft PR #314 current head | 29/29 contract checks cover Workspace isolation, structured fingerprinting, provenance redaction and missing-vs-zero; exact-head typecheck, lint and build are acceptance gates | No code blocker after green exact-head CI; Release remains separately blocked by DB-HIST-01 | Review exact head and record acceptance. Do not merge without separate authorization. |
| `AP01-LC-01` | AIRPROP | CLADORA v1.4 / `2fb9d7d`; parent PR #310 | CI-verified; review acceptance pending | 2026-10-08T17:21:46+03:30 | `4d09e7e`; draft PR #315 | 22 route checks, typecheck and lint passed; database static contract passed with 5126 assertions; Actions: commercial #2, database #1077 and foundation #1060 passed | No implementation blocker; local DB runtime unavailable but CI pgTAP passed | Review and record acceptance. Do not merge or apply the migration without separate authorization. |
| `AP02-RSV-01` | AIRPROP | CLADORA v1.4 / `2fb9d7d`; parent Draft PR #315 head `6e6f6fc` | Locally verified; exact-head CI pending | 2026-10-08T19:56:00+03:30 | Branch `feat/airprop-ap02-reservation-controls`; Draft PR #319 | 27 route checks, typecheck and lint passed; database static contract passed with 239 migrations, 164 tests and 5185 assertions; 39 pgTAP assertions cover direct RPC, replay, stale/null version, authority denial, audit/revision side effects and overlap exclusion | Managed Docker socket denied access and no local Supabase CLI is installed; exact-head GitHub Actions pgTAP is required | Commit and push to existing Draft PR #319, then record exact-head CI evidence. |
| `V14-AIRPROP-01 / AP-PF02` | AIRPROP consumer; Core owns DW-02/PM-01 | CLADORA v1.4 / `2fb9d7d` | Partially blocked | 2026-10-08T16:51:22+03:30 | No runtime change | Existing PR #310 commercial tests are preserved, not repeated | Accepted Core Resource snapshot, relationship and authority contract is not yet available | Map the accepted Core contract into AIRPROP without changing historical IDs/APIs; then add individual/legal-owner and revoked-role tests. |
| `V14-AIRPROP-01 / dynamic Resource read model` | AIRPROP | CLADORA v1.4 / `2fb9d7d` | Not started | — | Existing commercial implementation: `66aa4e0` / PR #310 | Existing accepted evidence remains authoritative | Correct Resource/Workspace authority adapter depends on accepted Core contract | Add the first dynamic-Resource read model after AP-PF02 is unblocked; do not rebuild the commercial lifecycle. |

## Verified non-actions

- No merge was performed.
- No Supabase migration or SQL was applied to Production. AP01 and AP02 migration files remain development artifacts on unmerged Draft branches.
- No Vercel deployment was created or promoted.
- No PR #310 commercial-lifecycle migration, test or deployment was repeated.

## Acceptance rule

No AIRPROP package, including `AP-VAL-01A`, is complete merely because code exists. Completion requires the recorded command outputs, green CI and explicit review acceptance. Later PM-01 ingestion must preserve this history and must not rerun accepted work or tests solely for reporting.
