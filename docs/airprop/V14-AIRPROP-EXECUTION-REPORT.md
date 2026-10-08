# CLADORA v1.4 — AIRPROP execution report

**Report timestamp:** 2026-10-08T16:51:22+03:30  
**Program baseline:** `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

| Package ID | Responsible work | Baseline | Status | Start time | Commit / PR | Test evidence | Blocker | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AP-VAL-01A` | AIRPROP | CLADORA v1.4 / `2fb9d7d` | Verified; review acceptance pending | 2026-10-08T16:51:22+03:30 | `ba0d5c8`; draft PR #314 | 15/15 contract checks passed; `npm run typecheck` passed; `npm run lint` passed; GitHub Actions `AIRPROP valuation contract` run #2 passed | No blocker for Slice A | Review and record acceptance. Do not merge without separate authorization. |
| `AP01-LC-01` | AIRPROP | CLADORA v1.4 / `2fb9d7d`; parent PR #310 | Implemented; runtime acceptance pending | 2026-10-08T17:21:46+03:30 | Branch `feat/airprop-ap01-listing-controls`; commit/PR pending | 22 route checks passed; typecheck and lint passed; database static contract passed with 5126 assertions | Local pgTAP runtime blocked because Docker/Podman is unavailable | Commit and push to a separate Draft PR; use CI database job for pgTAP evidence. No Production migration. |
| `V14-AIRPROP-01 / AP-PF02` | AIRPROP consumer; Core owns DW-02/PM-01 | CLADORA v1.4 / `2fb9d7d` | Partially blocked | 2026-10-08T16:51:22+03:30 | No runtime change | Existing PR #310 commercial tests are preserved, not repeated | Accepted Core Resource snapshot, relationship and authority contract is not yet available | Map the accepted Core contract into AIRPROP without changing historical IDs/APIs; then add individual/legal-owner and revoked-role tests. |
| `V14-AIRPROP-01 / dynamic Resource read model` | AIRPROP | CLADORA v1.4 / `2fb9d7d` | Not started | — | Existing commercial implementation: `66aa4e0` / PR #310 | Existing accepted evidence remains authoritative | Correct Resource/Workspace authority adapter depends on accepted Core contract | Add the first dynamic-Resource read model after AP-PF02 is unblocked; do not rebuild the commercial lifecycle. |

## Verified non-actions

- No merge was performed.
- No Supabase migration or SQL was created or applied.
- No Vercel deployment was created or promoted.
- No PR #310 commercial-lifecycle migration, test or deployment was repeated.

## Acceptance rule

`AP-VAL-01A` is not complete merely because code exists. Completion requires the recorded command outputs, green CI and explicit review acceptance. Later PM-01 ingestion must preserve this history and must not rerun accepted work solely to enter a record.

