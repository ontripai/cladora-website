# PM-01 Internal execution lifecycle

Status: approved product direction; implementation design, not installed runtime.
Owner: Core/Platform for implementation. Program coordination: CLADORA supervision work. Acceptance decisions: authorized reviewer/customer according to policy.
This is internal CLADORA development tracking, not physical construction project management.

## Logical records

Project, Baseline, Workstream, Assignment, WorkPackage, ExecutionCycle, Dependency, Blocker, Evidence, TestRun, AcceptanceDecision, ChangeRequest, Transition, ReleaseReference.
Inventory current tables and commands before choosing SQL schema or migration. Record canonical IDs and references; do not duplicate identity, audit, messages or authority infrastructure.

- Package ID is stable across corrections and work-number transfers.
- Cycle has an immutable cycle number and parent cycle, scope/baseline, owner, version, start/completion timestamps.
- Evidence binds exact commit, environment, test command/result, artifact/hash, time and collector; reported vs independently verified is explicit.
- Acceptance records reviewer, criterion coverage, decisions, reasons, scope and time. History is append-only.
- Release references track deployment separately from development completion.

## State contract

planned → ready → in_progress → in_review → tested → accepted → closed.
blocked is an orthogonal impediment; cancelled is a justified terminal outcome, not success.
Reopen creates a new linked execution cycle with a reason and new scope. It never overwrites a closed cycle or its original acceptance. The package current-cycle pointer changes atomically.

Transitions require trusted actor/context, permission, expected_version and idempotency key. Mutations, transition, audit and receipt are atomic. Retry produces no duplicate transition. Old CI callbacks cannot advance a new cycle or overwrite a newer result.

A failed test returns the active cycle to in_progress with the failure attached. A changed implementation after testing requires impact assessment and rerun of affected required checks. Skipped or unavailable checks are not PASS; N/A needs explicit justified acceptance. Closed requires acceptance of that cycle and completion scope; deployment is required only where that scope includes release.

## Synchronization boundary

GitHub is source of code/docs/PR/test-run metadata. CI/webhook events attach evidence after authenticity and deduplication checks; they cannot authorize acceptance. Database is source of runtime status once built. Issue/project updates are projections via existing outbox patterns with source IDs and loop prevention.

No customer Workspace membership grants authority to manage internal work packages. Reuse platform identity and policy, and require separate reviewer authority where the approved policy demands it. Do not invent new platform roles solely for this package.

## Acceptance cases

1. No close without required evidence and authorized acceptance.
2. Stale version and unauthorized transition rejected with zero domain mutation.
3. Reopen preserves prior closed record and links new cycle.
4. Evidence cannot be reused as proof for a different untested commit silently.
5. Parallel close/reopen commands remain consistent.
6. Idempotent retry and duplicate CI events create no duplicate facts.
7. Blocker removal preserves the execution stage.
8. Reports distinguish tested, accepted, closed and deployed.
9. Workstream handover retains package/cycle history.
10. No confidential user/test data in public GitHub evidence.

See plan sections 27–30 for rollout and four-work obligations. No migration or database execution is performed by this document.
