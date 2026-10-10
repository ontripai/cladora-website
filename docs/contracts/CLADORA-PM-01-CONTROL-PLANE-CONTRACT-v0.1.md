# CLADORA PM 01 control plane contract

Baseline: CLADORA Execution Plan FA v1.4, received 2026-10-08. Repository baseline: `main@436e7a634020a846da212aa60501f25455d39850`. Work branch used for the initial inventory: `feat/core-dw-01a-capability-reader`. Owner after the independent-execution directive: Documentation and Oversight work. Core Platform is a producer/consumer of status and shared infrastructure contracts, not the PM-01 implementation owner. Status: `طراحی و تحویل به مالک`. This contract does not authorize a migration, Production connection, endpoint activation, merge or deployment.

## Scope and boundary

PM-01 records the internal execution lifecycle of CLADORA work packages. It is not customer Workspace state and is not construction-project management. Customer membership never grants access to PM-01. GitHub remains the source for code, documents, commits and PRs; PM-01 is the future source for package cycles, evidence, review and acceptance. Documentation and Oversight owns the PM lifecycle, acceptance rules and implementation coordination. Core continues its product/shared-contract work independently and supplies versioned package evidence to PM-01.

Until PM-01 runtime is accepted, the versioned manual status register is authoritative for coordination. Importing that history later must preserve package IDs, cycle IDs, timestamps, evidence hashes, blockers and decisions without rerunning accepted work merely to populate the database.

## Existing infrastructure inventory

| Existing component | Reuse decision | Gap for PM-01 |
| --- | --- | --- |
| `audit.events` | Reuse as immutable audit sink through a bounded PM command; do not create another audit engine. | Current customer-tenant shape and self-read policy are not a complete internal-project authorization model. PM event taxonomy and bounded writer are required. |
| `platform.outbox_events` | Reuse for transition/evidence/acceptance events written atomically with PM state. | PM aggregate types, versions and consumers must be defined. No transport is added in PM-01. |
| `platform.idempotency_keys` | Reuse command fingerprint/replay pattern if retention and internal actor scope fit; otherwise add a PM-specific adapter, not a generic competing engine. | Current key is tenant-scoped; PM project is explicitly independent of customer Workspace/tenant. Scope and retention require a reviewed decision. |
| Effective authority and platform roles | Reuse server-side actor resolution and deny-first principles. | Customer Workspace authority cannot authorize internal plan control. Explicit platform permissions and self-approval separation are required. |
| `migration_hub.projects` | Do not reuse as PM project. | It models customer data migration, has tenant/property coupling and a migration-specific lifecycle. Reusing it would mix domains. |
| Domain approval tables | Reuse patterns only, not records/tables. | Maintenance/delegation/retention approvals have domain-specific subjects and cannot represent package acceptance. |
| GitHub Actions and PR evidence | Consume as external evidence references. | CI/merge cannot auto-accept or auto-close; callbacks need deduplication, head-SHA binding and stale-event rejection. |
| Documentation master index and closure records | Preserve as the current document/evidence catalog. | A versioned v1.4 baseline manifest and PM package/cycle references must be added in a separately approved documentation PR. |

## Logical model

These are logical records, not installed table names.

| Record | Minimum fields and invariants |
| --- | --- |
| ProjectBaseline | stable project ID, approved plan version, document path/hash, approval reference and effective timestamp; append-only supersession |
| WorkstreamAssignment | workstream ID, responsible work, assignee reference, scope, starts/ends and assignment source; no customer Workspace implication |
| WorkPackage | stable package ID, owner, scope, exit criteria, consumers and current cycle pointer; identity survives reopen |
| ExecutionCycle | cycle number, parent cycle/change request, baseline ref, target version, `started_at`, stage, blocker flag and optimistic version |
| Dependency | contract name/version, owner, consumer, minimum usable output, required/optional state and limited impact |
| Blocker | code, affected criterion/step, owner, opened/resolved timestamps and resolution evidence; independent of lifecycle stage |
| Evidence | evidence ID/type, observed vs reported source, environment, commit/head SHA, command/run URL or artifact hash, result and timestamp; immutable |
| TestRun | exact test version, environment, start/end, pass/fail/error, assertion/scenario result and artifact reference; a count alone is insufficient |
| AcceptanceDecision | authorized reviewer, accepted/rejected/waived result, criterion coverage, evidence set hash, reasons and timestamp; append-only and no self-approval where policy forbids it |
| ChangeRequest | closed/accepted source cycle, reason, affected scope, priority, requester and decision; creates a new cycle without rewriting the old one |
| ReleaseReference | PR, merge commit, migration target, deployment and health verification; release state is separate from development closure |

## Lifecycle

Lifecycle stage and blocker are orthogonal.

| Transition | Required server-side conditions |
| --- | --- |
| `planned -> ready` | Baseline, scope, owner, exit criteria and dependencies are recorded. |
| `ready -> in_progress` | Authorized assignee starts one numbered cycle; `started_at` is written once. |
| `in_progress -> in_review` | Deliverable and evidence point to the exact commit/version; known gaps remain visible. |
| `in_review -> tested` | Every applicable required test has an actual passing TestRun; N/A requires an authorized reason. |
| `tested -> accepted` | An authorized reviewer other than a prohibited self-approver validates criteria against the same evidence/version. |
| `accepted -> closed` | Closure receipt records exact scope and time; deployment is not implied. |
| `request_change/reopen` | A ChangeRequest creates a child cycle in `planned` or `ready`; prior accepted/closed cycle is preserved. |
| `block/unblock` | Only blocker state changes. Unblocking never advances lifecycle stage. |
| `cancel` | Authorized reason is recorded; cancellation is not successful closure. |
| release transition | Separate values `not_released`, `ready`, `deployed`, `verified`, `rolled_back`; never inferred from package stage alone. |

## Versioned command contract

Every command is server-authenticated and contains `request_id`, `idempotency_key`, `expected_version` and its command-specific payload. Actor, platform role and decision authority are server-derived. A retry with the same key and fingerprint returns the stored receipt after current read authorization; a changed fingerprint conflicts.

| Command | Permission | Minimum result |
| --- | --- | --- |
| `register_package_v1` | `pm.package.manage` | package/cycle IDs, version and baseline receipt |
| `start_cycle_v1` | `pm.cycle.start` | cycle number, fixed `started_at`, assignment and version |
| `record_dependency_v1` | `pm.dependency.manage` | dependency ID/version and bounded impact |
| `set_blocker_v1` | `pm.blocker.manage` | blocker state/version without implicit stage change |
| `attach_evidence_v1` | `pm.evidence.attach` | immutable evidence ID, source classification and content hash/ref |
| `record_test_run_v1` | `pm.test.record` | test-run ID, exact commit/environment/result and evidence ref |
| `request_review_v1` | `pm.review.request` | review request and frozen candidate version/evidence-set hash |
| `decide_acceptance_v1` | `pm.acceptance.decide` | append-only acceptance decision and criterion coverage; self-approval policy enforced |
| `close_cycle_v1` | `pm.cycle.close` | closure receipt for the accepted candidate; no release implication |
| `request_change_v1` | `pm.change.request` | change request and new child-cycle reference |
| `record_release_reference_v1` | `pm.release.record` | independent release state and immutable external references |
| `ingest_ci_evidence_v1` | internal webhook principal only | deduplicated evidence bound to provider event ID, repo and head SHA; no automatic acceptance |

## Receipt and atomicity

One transaction must lock the package/cycle version, validate authority and transition, persist the domain change, write the idempotency response, append the audit event and enqueue the outbox event. A failure writes none of them. Receipts contain contract version, request ID, package ID, cycle ID, previous/new version, stage, blocker/release states, actor reference, event/evidence references and `occurred_at`.

## Read contract

`get_pm_package_status_v1(package_id)` returns the current cycle, responsible workstream, baseline/version, stage, blocker, start/latest-change times, commit/PR, required/latest tests, acceptance and release state. `list_pm_package_history_v1(package_id)` returns ordered immutable cycles, transitions and decisions. Sensitive webhook payloads, credentials and private reviewer data are never returned.

## Acceptance scenarios

1. Closure without an accepted decision and matching evidence set is rejected.
2. Prohibited self-approval is rejected.
3. Stale `expected_version` loses a concurrent transition.
4. Exact retries return one receipt; changed payload under the same key conflicts.
5. Reopen creates a child cycle and preserves the accepted/closed parent.
6. Block/unblock does not advance the lifecycle stage.
7. Evidence remains bound to the exact commit and environment.
8. Reported evidence cannot silently become observed evidence.
9. Customer Workspace users and unauthorized platform roles cannot read or mutate PM records.
10. Duplicate or older CI webhook events cannot regress state or duplicate evidence.
11. CI green or PR merge cannot automatically accept or close a package.
12. Start, completion and correction times remain separately reportable by workstream.
13. Import of the manual register preserves timestamps, IDs, hashes and results without generating replacement test runs.

## Handoff decisions for Documentation and Oversight

- Confirm the PM-01 implementation branch and accept ownership of this v0.1 inventory/contract.
- Coordinate with Core Security to select the internal platform authority source and explicit PM permission-role matrix.
- Decide whether `platform.idempotency_keys` can safely support non-customer PM scope; do not fake a customer tenant solely to reuse it.
- Define audit tenant-null/internal-project policy and bounded reviewer visibility.
- Define GitHub webhook trust, signature verification, repository allowlist and event retention.
- Approve the first migration schema/name and disposable CI database test path. This migration is not part of the Core DW-01A branch.
