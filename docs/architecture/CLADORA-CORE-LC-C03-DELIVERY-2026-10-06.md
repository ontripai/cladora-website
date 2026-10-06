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

## Remaining contract boundary

LC-C03 currently delivers a proposal and evidence decision. Canonical title/lease changes, verified legal evidence, effectivity and retroactive visibility rules, and access handover require their own commands and acceptance tests. The private ledger remains inaccessible for direct customer table writes; all published commands check the native workspace, module, role and property mandate. The setup-reviewer dashboard context remains hidden from general navigation.
