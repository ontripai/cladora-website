# PM01-A private oversight registry contract v1.0

**Package:** `PM01-A`

**Status:** Documentation contract in review; no installed runtime

**Documentation and oversight owner:** PM / CLADORA Documentation

**Future runtime owner:** Core/Platform

**Dependency:** CLADORA v1.4 controlled baseline in Draft PR #313

## Purpose and boundary

PM01-A defines the smallest private control-plane registry needed to supervise CLADORA development packages without treating GitHub, CI, a merged PR or a deployment as automatic acceptance. It is internal software-delivery oversight, not construction project management and not a customer Workspace module.

This document defines logical records, visibility, authority, commands, receipts and synchronization rules. It creates no table, RPC, API route, role, permission, connector, Secret, migration or deployment. Physical names remain unassigned until the future Core/Platform implementation inventories the then-current schema and obtains separate approval.

## Verified foundations to reuse

| Concern | Repository foundation | Reuse rule |
| --- | --- | --- |
| Platform actor and role identity | `platform.platform_users` and `platform.platform_role_assignments` in `20260825002200_platform_control_plane_users_roles.sql` | Resolve the current authenticated platform actor; do not create a PM-only identity directory or infer authority from GitHub authorship. |
| Scoped internal authority | ADR-CLD-023 control-plane separation and the assignment-scoped patterns in ADR-CLD-028 | A future PM permission must be explicit, least-privilege and separately reviewed. Customer Workspace membership never grants internal oversight authority. |
| Immutable audit | `audit.events` in `20260825002000_migration_hub_audit_hardening.sql` | Append bounded transition facts and reasons; never place tokens, credentials, raw CI logs or private payloads in snapshots. |
| Retry receipts | `platform.idempotency_keys` in `20260825000100_platform_tenants_settings_outbox.sql` | Reuse the reviewed atomic claim/lock/receipt pattern only after deciding how internal, non-customer scope is represented. Do not fabricate a tenant identifier. |
| Event handoff | `platform.outbox_events` in `20260825000100_platform_tenants_settings_outbox.sql` | Emit versioned metadata-only events in the same transaction as a future state change; an outbox row is not proof of delivery. |
| Time-bounded support access | `platform.support_access_requests` and grants in `20260825002500_provisioning_support_access_audit_control.sql` | Support access remains separate from PM ownership, review or acceptance. Never convert a support grant into package authority. |
| Existing case and conversation records | `platform.customer_cases`, `platform.customer_case_messages` and the existing internal-conversation migrations | Link only by an authorized opaque reference when needed. Messages and cases are not the canonical package state or acceptance ledger. |

These sources are compatibility constraints, not authorization to change their schema or privileges in this package.

## Logical registry

| Record | Required meaning | Minimum versioned fields |
| --- | --- | --- |
| `ProgramBaseline` | One approved documentation/code baseline | stable ID, version, repository, controlling commit/PR, status, effective time |
| `Workstream` | Core/Operations, AIRPROP, SERVICE, Community & Experience, or PM/Documentation ownership boundary | stable ID, owner, scope, active interval |
| `WorkPackage` | Stable delivery identity across corrections and handovers | package ID, baseline, workstream, title, bounded scope, current cycle, owner, dependency set |
| `ExecutionCycle` | One immutable attempt to deliver or correct a package | cycle number, parent cycle, status, expected version, start/end, scope delta |
| `Dependency` | A typed prerequisite or non-blocking external reference | target ID/reference, kind, required state, blocking flag, reason |
| `EvidenceReference` | Metadata proving a claim at one exact revision | evidence type, repository, commit, PR/check/run URL, environment class, result, collected time, collector |
| `TestRun` | One bounded command/check result | exact commit, command or check name, status, start/end, bounded summary, artifact reference |
| `AcceptanceDecision` | Human/policy decision separate from CI | cycle, reviewer, criterion coverage, decision, reason, time |
| `Blocker` | Orthogonal impediment that does not erase lifecycle state | code, owner, opened/resolved time, resolution reference |
| `ChangeRequest` | Reason and impact for a new correction cycle | source cycle, requested scope, impact, priority, requester, decision |
| `Transition` | Append-only lifecycle movement | prior/new state, expected version, actor, reason, time, command ID |
| `ReleaseReference` | Optional deployment evidence separate from completion | environment, deployment/migration reference, commit, status, observed time |

The registry stores metadata and bounded evidence references. It must not copy source code, document bodies, customer records, raw workflow logs, credentials, personal test data or private attachment paths.

## Visibility classes

| Class | Contents | Reader boundary |
| --- | --- | --- |
| `coordination` | Package ID, owner, lifecycle state, dependency codes and public repository references | Authorized internal coordinators and explicitly approved projections |
| `oversight_private` | Review notes, blocker reasons, acceptance rationale and internal evidence metadata | Explicit internal oversight readers only |
| `restricted_reference` | Opaque reference to a separately protected case, document or conversation | Registry returns the reference only when the caller independently has access to the target system |
| `secret_forbidden` | Tokens, credentials, private keys, session values, raw provider payloads | Never stored or projected |

Visibility is field-level and fail-closed. A summary count must not reveal that a restricted reference exists when the caller lacks its independent permission.

## Lifecycle and commands

The canonical lifecycle remains:

`planned → ready → in_progress → in_review → tested → accepted → closed`

`blocked` is an orthogonal condition. `cancelled` is a justified terminal result and never a success alias. Reopening creates a new linked cycle; it does not mutate prior acceptance.

| Conceptual command | Preconditions | Atomic receipt |
| --- | --- | --- |
| `register_package` | Current baseline, unique stable package ID, valid owner and dependency syntax | Package/cycle identity, version and audit reference |
| `start_cycle` | Package is ready, caller owns execution, no conflicting active cycle | Active cycle number, new version and transition reference |
| `attach_evidence` | Exact active cycle and commit; allowed evidence kind; no secret-shaped fields | Evidence identity, normalized source reference and cycle version |
| `record_test_result` | Exact evidence/commit binding and recognized result | Test-run identity, result and version; never auto-accepts |
| `request_review` | Required delivery evidence present for the declared scope | `in_review` transition receipt and immutable review snapshot reference |
| `record_acceptance` | Authorized independent reviewer and complete criterion decisions | Acceptance identity and decision; no automatic close |
| `close_cycle` | Accepted active cycle and all required closure criteria | Closure receipt and current-cycle version |
| `request_change` | Existing cycle, reason and impact supplied | Change-request identity; approved request creates a new linked cycle |
| `set_blocker` / `resolve_blocker` | Current package/cycle and explicit blocker owner | Blocker transition while preserving lifecycle stage |

Every future mutation must authenticate and authorize again on replay, require `expected_version` plus an idempotency key, lock the authoritative package/cycle row, and commit domain mutation, transition, audit, outbox and bounded response together. A changed payload with the same key conflicts; a stale callback cannot advance a newer cycle.

## GitHub and CI synchronization

- GitHub remains the source for repository, branch, PR, commit and check metadata.
- A webhook or polling consumer may attach evidence only after signature/authenticity validation, installation/repository allowlisting, replay protection and exact commit matching.
- CI success can move no package beyond the state explicitly authorized by policy. It cannot create an acceptance decision.
- A force-pushed or superseded commit retains historical evidence but cannot satisfy the current cycle unless it is still the declared delivery commit.
- PR Draft/open/merged/closed state is recorded as source metadata. It is not mapped directly to accepted or closed.
- Vercel Preview success is preview evidence only. Production deployment is a distinct `ReleaseReference` and requires separately authorized release work.
- Issue/Project projections are downstream views with source IDs and loop prevention; they are not a competing state authority.

## External unavailable references

`CE010`, private CE/PM credentials or bindings, and commit `1f010c4` remain `external/unavailable`. No Secret, hostname, private path or package source is assumed. They are non-blocking references unless a future package explicitly depends on a verified contract. PM01-A and other independent repository packages continue without them.

The repository-owned `CE-010` slice in Draft PR #318 is a separate verifiable source and must not be conflated with the unavailable external identifier.

## Acceptance matrix

1. Unauthorized, AAL1, expired, wrong-scope and customer-only actors receive no private registry rows and create zero writes.
2. A coordinator can register/start only packages in the authorized internal scope; an executor cannot accept their own cycle when independent review is required.
3. Exact retry returns the prior receipt after current authority is rechecked; changed input conflicts with zero additional facts.
4. Concurrent start, close and reopen attempts serialize to one valid current cycle and preserve all prior history.
5. Evidence for commit A cannot satisfy commit B; stale CI delivery cannot overwrite a newer result.
6. Test success does not create acceptance; acceptance does not imply deployment; merge does not imply closure.
7. Reopen creates a new numbered cycle linked to the prior cycle, preserving the previous decision and evidence.
8. Blocker resolution preserves the lifecycle stage and records a separate immutable transition.
9. Restricted-reference denial leaks neither target identifier nor counts, labels, paths or existence hints.
10. Audit/outbox/idempotency failure rolls back the future domain transition atomically.
11. Redaction rejects secret-, token-, password-, session- and credential-shaped fields recursively.
12. Reports distinguish `in_review`, `tested`, `accepted`, `closed` and deployed for the exact cycle and commit.

## Successor implementation gate

Before any runtime implementation, Core/Platform must deliver a read-only schema and authority inventory against the then-current branch, decide the internal scope model without fake tenant data, specify physical records and APIs, and obtain separate approval for migration and runtime work. Isolated database, concurrency, RLS/ACL, replay, redaction and negative-authorization tests are mandatory for a future implementation PR.

This documentation package authorizes none of those runtime actions.
