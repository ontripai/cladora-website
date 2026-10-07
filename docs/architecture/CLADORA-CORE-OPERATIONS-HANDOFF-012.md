# CLADORA core and Operations continuation from CLADORA 11

Verified 2026-10-05. Stable owner: shared core and Operations, including LC-C01 through LC-C05 and LC-O01. Numbered work conversations do not change ownership or authorize repeated migrations.

## Verified baseline

Repository: ontripai/cladora-website. Main and latest READY production deployment at inspection: 3c3eeaafc06bb9411c2ee1668589747d91948044, deployment dpl_J9eg4V3rqv9SvkTVMyZJeJtuX5qg. Latest completed Operations read-authority slice: PR 253, merged as 378f024; remote migration 20261004190314 is recorded. Earlier Operations PRs 239, 240, 243, 246, 247 and 251 are merged; do not replay their pilot mutations.

Current unfinished slice: PR 258, fix/maintenance-dashboard-authority, original head 1f8828f9d54b80352ab2b2876df84ac1847484d0. Database workflow 37237674297 and AIRPROP workflow 37237674259 succeeded at that exact head. The branch has now been merged with the inspected main without conflict; combined-head CI must be checked separately.

A fresh clone was clean before continuation. The old conversation filesystem and any unpushed changes are unavailable; no claim is made about their state. The existing remote branch is the recovery source.

Remote migration 20261004214536_maintenance_dashboard_context_authority is absent. Read-only catalog inspection confirms maintenance.get_customer_maintenance still lacks check_effective_permission_v1. Its current owner is postgres, SECURITY DEFINER is true and existing ACL contains postgres, authenticated and service_role. Preserve actual catalog facts; do not confuse this private implementation with the public invoker gateway or the separate PR 253 readers.

Local database package validation after main integration: 211 migrations, 147 test files, 4768 assertions. This is static validation, not execution of those assertions. Exact-head hosted runtime CI remains the release gate.

## Source attachment

User attachment CLADORA_Lifecycle_Implementation_Package_v1.1(4).docx has SHA256 52f0977b2f8ad6d9e760c61492153fdcb3efbfd95ec6c9527f1644ed9e9996ad. It is byte-identical to the canonical reference already proposed by SERVICE PR 261 at docs/architecture/references/CLADORA-Lifecycle-Implementation-Package-v1.1.docx. Reuse that reference when merged; do not create a divergent copy or import SERVICE implementation to attach it. The original attachment remains available in this work conversation. Design input is not verified property evidence.

## Coordination and remaining work

| Requirement | Actual state | Evidence | Conflict | Owner | Dependency | Remaining action |
|---|---|---|---|---|---|---|
| LC-C01 | Existing foundations; lifecycle mapping incomplete | portfolio foundation migration; shared workspace architecture; AIRPROP lifecycle 014 | Property identity must not become workspace identity | Core | Existing subject and workspace bindings | Publish canonical reference and authority map |
| LC-C02 | Not verified complete | Existing properties/buildings/units; AIRPROP 014 dependency request | Existing identifiers do not prove planned specification versions or split/merge lineage | Core | C01 | Inspect actual model and specify only missing version/lineage contracts |
| LC-C03 | Partial foundations | Ownership/occupancy, local roles, effective permission engine; PRs 246/247/251/253 | Membership is not ownership or a business mandate | Core | C01 | Map dated relationships and revocation before adding transitions |
| LC-C04 | Partial foundations | platform outbox_events/idempotency_keys; existing domain retry tests | Outbox insertion alone does not prove delivery or recovery | Core | C01 | Version event envelope, consumer receipts and recovery contract |
| LC-C05 | Partial document foundation | Existing vault and PR 260 property selection | Clean uploaded design document is not handover evidence or transfer consent | Core | C02/C03 | Define handover snapshot, partial acceptance and allowed transfer manifest |
| LC-O01 | Existing equipment/work-order slices; lifecycle integration incomplete | PRs 239/240/243; work-order UI tests; PR 258 authority tests | Do not duplicate SERVICE orders or imply a real physical service from synthetic tests | Operations | C02/C05 and SERVICE link contract | Finish PR 258 release, then map defect/warranty/service linkage |
| LC-X01 | Not completed | Package two-unit scenario and T01-T10 | Individual slice tests do not establish whole lifecycle acceptance | Three stable workstreams | Connected contracts | Run integrated authorized synthetic scenario after dependencies |

AIRPROP PR 262 is merged and owns LC-A01 through LC-A03 mapping. SERVICE PR 261 is open at inspection and owns quote publication and LC-S01/LC-S02 work. Its migration 20261005075657 is already recorded remotely despite its application PR still being open. Do not reapply it or change that branch from this workstream. Remote versions for SERVICE draft quotes and document choices differ from source filename prefixes; reconcile SQL content before treating a filename difference as a missing migration.

Next release sequence: validate combined PR 258 head; obtain bounded production authorization if not already documented for this slice; apply only the reviewed missing migration; reconcile the actual recorded migration version; recheck catalog/ACL and read behavior; merge/deploy and verify exact production SHA. No pilot financial posting or repeat work-order transition is necessary.

For any required customer login, announce ontrip.ai@gmail.com and Synthetic Pilot Building before requesting user action. Current browser session is not inspected by this handoff. Prior live API acceptance encountered ERR_BLOCKED_BY_CLIENT; distinguish that client restriction from a backend test result.

## Continuation and UX directive on 2026-10-05

The user supplied UX-DEC-001 and instructed attachment and continuation after the public-branch publication request. The exact original is retained at [UX directive v1.0](references/CLADORA-UX-Background-Controls-Directive-v1.0.docx), SHA256 408698b7c5b232e96b98e5b7c55b4ce09187e3c6361e09aa73409fc5e180fd1b. It supplements the lifecycle package and applies to all existing/new core and Operations work, including successor conversations. Controls remain enforced server-side; the interface explains the user's next action without internal authorization jargon. This is a product requirement, not a claim of completed UX or legal compliance.

Reinspection: PR 261 is now merged as 2301412 and its canonical lifecycle attachment is present. This branch incorporates that main without conflict, so the lifecycle document is attached once through its existing canonical path. The baseline above is historical inspection evidence, not a claim that main stopped changing.

### Observed UX gaps

| Rule | Page or process | Role/context | Observed implementation | Effect | Owner | Required correction | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| UX-01 / UX-14 | Maintenance dashboard | Customer context; live session not tested | Subtitle/loading copy mentions authorized evidence, database and server verification | Internal implementation terminology obscures the task | Core/Operations | Replace with everyday task/status wording in EN/RO/FA | CustomerMaintenanceDashboard.tsx copy object | Needs correction |
| UX-02 / SEC-04 | Maintenance dashboard context switch | Customer context | Requests are aborted but existing summary data remains unbound to the context that loaded it | Previous-context totals can remain visible during refresh/error | Core/Operations | Bind displayed payload to request context and filters; never render stale totals as current | CustomerMaintenanceDashboard.tsx load and summary rendering | Needs correction |
| UX-12 | Maintenance report | Customer context | Summary renders separately from loading/error state | Error state can coexist with previous totals | Core/Operations | Distinguish loading, failure, empty and actual zero; show report scope and refresh time | CustomerMaintenanceDashboard.tsx summary before loading/error branch | Needs correction |
| QA-03 | Maintenance pagination | Customer context | Icon-only previous/next buttons have no accessible labels | Screen reader purpose is unclear | Core/Operations | Localized accessible labels and keyboard/mobile check | CustomerMaintenanceDashboard.tsx pagination buttons | Needs correction |
| SEC-01 / SEC-04 / QA-04 | Maintenance database dashboard | Scoped authenticated fixtures | PR 258 checks target authority and vendor aggregate scope | Server denies unauthorized reads independently of UI | Core/Operations | Finish combined-head runtime CI and bounded release verification | Original-head database job 111539948499 passed pgTAP, all concurrency steps, catalog and advisors | Release pending |

The gaps above are source-review findings, not live usability test results. Track QA-01 through QA-06 for each UI correction. No session, permission, module, financial data or production migration is changed by attaching this directive. Finish the existing database authority slice before implementing the separately recorded UI corrections; shared patterns remain owned by this workstream.

## Release reconciliation after UX correction

At the 2026-10-05 continuation, PR #258 merged as `5aa7ad73cc7b230b1883a4fcad03b5a5fc7c4eda`, its reviewed migration was applied once remotely as `20261005122509`, and Production was READY. PR #267 then merged as `1503c1a1a380719e978b8e51d0caf2b7eef29459`; all eight GitHub workflows passed, Vercel Production deployment `dpl_CEKKuJcDuJDQ9ixHE1fnadMuCRBA` was READY with the production aliases, and its merged branch was deleted. The four dashboard UX rows above are completed by source/test/CI/deployment evidence; authenticated live usability, keyboard and mobile visual acceptance are not claimed. This section supersedes only their historical pending labels and the PR #258 release sequence.

The next Core task is LC-C01. See [core lifecycle reference 013](CLADORA-CORE-LIFECYCLE-REFERENCE-013-v0.1.md) for the source-backed map and current multi-workspace binding conflict. That reference is a mapping checkpoint, not LC-C01 runtime completion.
