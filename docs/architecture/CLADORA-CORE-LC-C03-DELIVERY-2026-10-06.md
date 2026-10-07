# CLADORA Core LC-C03 — delivery and pilot acceptance

Date: 2026-10-06 UTC. Scope: synthetic property A in the pilot workspace only.

## Source and deployment

| Change | GitHub | Production result |
| --- | --- | --- |
| Proposal, independent review, history reads, property discovery and two-connection race test | [PR #303](https://github.com/ontripai/cladora-website/pull/303), squash `51295df9` | Database, Application Foundation and AIRPROP regression green; Vercel READY |
| Native workspace route and localized navigation | [PR #304](https://github.com/ontripai/cladora-website/pull/304), squash `4a4cd16e` | Application Foundation and AIRPROP native runtime green; Vercel READY |
| Reviewer context discovery outside the ordinary dashboard | [PR #305](https://github.com/ontripai/cladora-website/pull/305), squash `d1928d86` | Database, Application Foundation and both AIRPROP checks green; Vercel READY |

Supabase production project `jyomlehahwlyqzoacrvp` records the applied migrations `lifecycle_relationship_review_gateway` and `lifecycle_relationship_native_contexts`. The second migration was rehearsed inside a rolled-back transaction before release. The first migration's 21 pgTAP assertions and real two-connection review race passed in CI. Source branches of the three merged PRs were deleted after verification.

## Synthetic pilot acceptance

Four test roles covered proposal, independent review, missing permission, and expired access. The browser created one proposal for synthetic unit A-02. A separate authorized reviewer rejected its synthetic evidence reference because no verified legal document existed. Negative authorization checks returned no proposal or action to an unentitled context and denied an expired context. All pilot grants were bound to the synthetic property and existing time limits.

The A-02 canonical ownership and lease tables each had **zero** records after the review, with zero new entries since the proposal. No invitation, title transfer, tenancy transition or access handover was performed. The receipt is test evidence, not a legal decision about a real person or property.

## Canonical transition releases, 2026-10-07

| Acceptance row | GitHub and source | Production result |
| --- | --- | --- |
| T03 contractual buyer | [PR #307](https://github.com/ontripai/cladora-website/pull/307), squash `58a27a17`; migration `20261007084346 lifecycle_contractual_buyer_activation` | Independently reviewed signed presale creates only a purpose-limited contractual-buyer fact. Database run `37583589935` and the related application/AIRPROP checks passed; Vercel Production is READY. |
| T06 ownership transfer | [PR #308](https://github.com/ontripai/cladora-website/pull/308), squash `c4c1cbdf`; migration `20261007092932 lifecycle_verified_ownership_transfer` | Exact outgoing ownership baseline closes and the successor interval starts without copying roles, invitations, account-party links, document ACLs or payment authority. Database run `37598695319` and all three related checks passed; Vercel Production is READY. |
| T07 lease handover and termination | [PR #309](https://github.com/ontripai/cladora-website/pull/309), squash `bbd0b68b`; migration `20261007100730 lifecycle_verified_lease_handover` | Signed-lease activation creates the canonical lease/occupancy and an immutable handover receipt. Termination is a separate command that closes only the exact access and occupancy baseline and leaves settlement separate. Database run `37604178278` and all three related checks passed; Vercel Production `dpl_F9L6zWXCQ6JK87XZc4SjffgoNWWo` is READY. |

Production inspection after T07 confirmed RLS on both receipt tables, no direct `anon`, `authenticated` or `service_role` table grants, authenticated-only guarded RPC execution, one AAL2 nondelegable permission binding, complete foreign-key index coverage and zero migration-created business receipts. The Production root returned HTTP 200 and the POST-only lease-transition route returned HTTP 405 to GET. No real title, lease, invitation, account link, private document permission or financial record was created for this release verification.

## Acceptance closure

The rollback fixture `151_airprop_acquisition_decision.test.sql` now executes the connected T03, T06 and T07 contracts. T07 coverage creates a clean independently verified signed lease, activates one canonical lease and tenant occupancy, checks idempotency and negative authority guarantees, and separately terminates a prior lease with an exact access-assignment baseline. It verifies immutable receipts, audit/outbox events, title preservation, no invitation/account-party/document-ACL copy, separate settlement, and AAL2 reauthorization on replay.

This closes the synthetic implementation acceptance for the three LC-C03 transition rows. It does **not** assert a legal decision for a real person or property, authorize production fixture creation, complete LC-C01/T08 multi-workspace whole-lifecycle acceptance, or implement LC-C04/T09 consumer delivery and recovery. AIRPROP commercial lifecycle and SERVICE requester/payer integrations remain owned and accepted by their respective workstreams.
