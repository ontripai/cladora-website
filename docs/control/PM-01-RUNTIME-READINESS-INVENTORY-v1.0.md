# PM01-B Core/Platform runtime readiness inventory v1.0

**Package:** `PM01-B`

**Status:** Documentation-only readiness package in review; runtime not authorized

**Technical owner:** Core/Platform

**Control and evidence owner:** PM / CLADORA Documentation

**Dependency:** PM01-A in Draft PR #322 and the controlled v1.4 baseline in Draft PR #313

## Outcome

PM01-B converts the PM01-A logical contract into a read-only inventory and a proposed physical/runtime boundary. It identifies what the current repository can safely reuse, what cannot be reused without widening authority, and which approvals and isolated tests must precede implementation.

This package changes documentation only. All proposed schemas, records, functions, routes and permissions below are uninstalled design targets. They do not authorize a Supabase migration, exposed schema, runtime connection, Secret, Production configuration change or deployment.

## Read-only source inventory

| Existing source | Current shape relevant to PM-01 | Decision |
| --- | --- | --- |
| `platform.platform_users` | Active internal actor mapped to `auth.users`; introduced by `20260825002200_platform_control_plane_users_roles.sql` | Reuse as the actor identity root. Do not duplicate users or authorize from GitHub usernames. |
| `platform.platform_role_assignments` | Time-bounded assignment of the coarse `platform_role_type` enum | Reuse only as a platform-user eligibility ceiling. Existing roles are too broad to represent package owner, reviewer and acceptance separation. |
| `platform.platform_customer_assignments` | Assignment is bound to `customer_workspace_id` and customer scope | Do not use for PM-01. Internal development oversight is not a customer Workspace and must not create a synthetic Workspace. |
| `platform.provisioning_runs` / `provisioning_tasks` | Customer-Workspace provisioning lifecycle with task evidence | Do not reuse as the PM package ledger. Its subject, states and authorization are provisioning-specific. |
| `platform.support_access_requests` / grants | Time-bounded access to one customer Workspace and support ticket | Keep separate. A support grant confers no PM ownership, review or acceptance power. |
| `platform.idempotency_keys` | Primary key and foreign key require a real `tenant_id` | Not directly reusable for internal PM commands. Supplying a fake tenant is prohibited. A future migration must add a separately scoped receipt store or approve a generalization without changing existing caller behavior. |
| `platform.outbox_events` | Uniqueness and foreign key require a real `tenant_id`; aggregate ID is UUID | Not directly reusable for internal PM events for the same reason. Use a separately scoped internal outbox or an explicitly reviewed compatible generalization. |
| `audit.events` | `tenant_id` is nullable; actor, request, snapshots, reason and time are available | Reuse through a guarded internal writer with recursively bounded/redacted snapshots. Existing customer/platform read policies must not automatically expose PM private events. |
| `platform.customer_cases` and message records | Customer-case communication and participants | May hold an opaque, separately authorized reference only. They are not canonical work-package state. |
| Existing internal-conversation records | Conversation membership and private document flows | Do not copy content or attachment paths. Link only through independent authorization when a future requirement is approved. |

The inventory is based on repository source at this package branch. Later migrations can replace policies or function bodies; runtime work must regenerate the inventory from the exact implementation base before writing SQL.

## Internal scope decision

The proposed PM registry is program-scoped, not tenant-scoped:

- `program_id` is the top-level immutable UUID for one internal delivery program such as CLADORA.
- A program allowlists repository identities by immutable provider/repository ID plus canonical owner/name; repository name alone is not authority.
- Baseline, workstream, package and cycle records inherit `program_id` through foreign keys.
- Package scope can narrow to a workstream or package but never widen through a customer Workspace membership.
- PM assignments reference `platform.platform_users` and carry explicit permission codes, valid interval and program/workstream/package scope.
- GitHub author, assignee, reviewer, team membership or CI identity is evidence metadata only; none is accepted as a platform actor without a separately verified mapping.

This avoids a fake tenant while preserving CLADORA's current customer-data isolation.

## Proposed physical records

The proposed private schema name is `pm_private`. It is not added to the Data API exposed-schema list. `PUBLIC`, `anon`, `authenticated` and `service_role` receive no direct table privileges. A dedicated least-privilege function owner and bounded server gateway require a separate security review.

| Proposed record | Key contract | Notes |
| --- | --- | --- |
| `pm_private.programs` | `id`, stable code, repository provider/ID, status, version | One canonical internal program root; no customer tenant FK |
| `pm_private.baselines` | program, semantic version, controlling commit/PR, status, effective time | Exact commit binding; one current baseline is a policy decision, not a mutable singleton |
| `pm_private.workstreams` | program, stable code, owner label, scope, active interval | Labels are not authorization; assignments below grant access |
| `pm_private.assignments` | platform user, program/workstream/package scope, permission code, valid interval, status | Explicit deny-first PM authority without adding a new platform role enum |
| `pm_private.work_packages` | program, baseline, workstream, stable package ID, bounded scope, current cycle, version | Stable across handover and reopen |
| `pm_private.execution_cycles` | package, cycle number, parent cycle, state, scope delta, version, start/end | At most one active cycle per package; history immutable after close |
| `pm_private.dependencies` | source package/cycle, typed target, required state, blocking flag, reason | External unavailable references can be non-blocking and never imply a Secret |
| `pm_private.evidence_references` | cycle, exact commit, type, provider/run/artifact reference, result, collected time | Metadata only; no raw log or customer content |
| `pm_private.test_runs` | cycle/evidence, exact commit, check name, status, bounded summary, start/end | Stale/superseded results remain historical but cannot satisfy a new commit |
| `pm_private.acceptance_decisions` | cycle, reviewer platform user, criteria snapshot, decision, reason, time | Append-only; independent-review policy enforced at write time |
| `pm_private.blockers` | cycle/package, code, owner, opened/resolved time, resolution ref | Orthogonal to lifecycle state |
| `pm_private.change_requests` | source cycle, requested scope, impact, priority, decision | Approved request creates a new linked cycle |
| `pm_private.transitions` | cycle, from/to state, actor, expected/new version, command ID, reason, time | Append-only authoritative state history |
| `pm_private.release_references` | cycle, environment class, commit, deployment/migration reference, observed status/time | Separate from tested, accepted and closed |
| `pm_private.command_receipts` | program, actor, namespace/key, request hash, response, expiry | Internal replacement for tenant-required `platform.idempotency_keys` |
| `pm_private.outbox_events` | program, aggregate, version, event type, bounded payload, publish state | Internal replacement for tenant-required `platform.outbox_events` |

Physical implementation may consolidate append-only records only if constraints, query isolation and acceptance semantics remain independently provable. JSON must not replace typed identity, lifecycle, version, time or authority columns.

## Proposed authority contract

Initial permission codes for review, not installed permissions:

| Permission | Allows | Does not allow |
| --- | --- | --- |
| `pm.package.read` | Read coordination fields in assigned scope | Read private review/evidence fields |
| `pm.package.manage` | Register package, assign owner, start cycle, manage blockers | Record own acceptance or change Production |
| `pm.evidence.attach` | Attach bounded references/results for the assigned cycle | Mark a test passed without provider evidence |
| `pm.review.read` | Read oversight-private evidence in assigned scope | Mutate package state |
| `pm.review.decide` | Record criterion decisions when independence policy passes | Accept own delivery where separation is required |
| `pm.release.read` | Read release references | Deploy, migrate or change configuration |

Every evaluation must require an active platform user, AAL2 for mutations, a current PM assignment covering the exact program/workstream/package, the named permission, and no applicable deny. `PLATFORM_SUPER_ADMIN` may administer policy only through separately guarded commands; it is not an implicit self-approval bypass.

## Proposed private functions and HTTP routes

Private database functions are conceptual exact-version targets and remain revoked from client roles:

- `pm_private.list_packages_internal_v1(program_id, filters, limit, cursor)`
- `pm_private.get_package_internal_v1(program_id, package_id)`
- `pm_private.register_package_internal_v1(command)`
- `pm_private.transition_cycle_internal_v1(command)`
- `pm_private.attach_evidence_internal_v1(command)`
- `pm_private.record_test_result_internal_v1(command)`
- `pm_private.record_acceptance_internal_v1(command)`
- `pm_private.request_change_internal_v1(command)`

Proposed server-only routes:

| Method and route | Bounded behavior |
| --- | --- |
| `GET /api/platform/v1/internal-work/packages` | Cursor-bounded coordination projection after server authorization |
| `GET /api/platform/v1/internal-work/packages/[id]` | Field-filtered package/cycle detail; restricted references independently checked |
| `POST /api/platform/v1/internal-work/packages` | Register package and initial cycle with trusted origin, JSON/body limit and idempotency |
| `POST /api/platform/v1/internal-work/cycles/[id]/transitions` | Execute one allowed expected-version state transition |
| `POST /api/platform/v1/internal-work/cycles/[id]/evidence` | Attach metadata-only exact-commit evidence |
| `POST /api/platform/v1/internal-work/cycles/[id]/tests` | Record authenticated provider/check result without acceptance side effect |
| `POST /api/platform/v1/internal-work/cycles/[id]/decisions` | Independent reviewer decision with criterion snapshot |
| `POST /api/platform/v1/internal-work/cycles/[id]/changes` | Record change request and, only when approved, create a linked cycle |

The future route-to-database connection mechanism requires a separate decision. No new exposed Supabase schema, service-role browser use or generic SQL endpoint is permitted. All responses are private/no-store and exclude source payloads, tokens, private URLs and raw error details.

## Command and receipt envelope

Every mutation command must include `program_id`, exact package/cycle identity, `expected_version`, bounded reason, client-generated `request_id` and idempotency key. The server derives actor, authority, repository allowlist and current state. Client-supplied actor, permission, acceptance, CI result, deployment state or tenant is rejected.

One transaction must lock the authoritative row and persist domain change, transition, redacted `audit.events` entry, internal outbox event and command receipt. Exact replay returns the bounded prior response only after current authority is rechecked. Changed payload, stale version, revoked assignment and superseded cycle fail with zero partial writes.

## Required approvals before runtime

1. Accept or revise the program-scoped, non-tenant model and proposed physical ownership.
2. Approve the PM assignment/permission model and independent-review policy.
3. Approve the server route-to-private-function connection pattern and function owner privileges.
4. Approve a migration package after exact current-schema inventory and collision review.
5. Approve any GitHub App/webhook credential separately; repository polling or webhook work must not request unrelated CE/PM credentials.
6. Approve Preview deployment and synthetic test identities separately from Production rollout.
7. Approve Production migration and deployment only after isolated acceptance evidence; neither is authorized by this document or a green Draft PR.

## Required isolated verification

- Clean migration and rollback-compatible full-chain database test.
- RLS/ACL catalog assertions proving no direct client/service-role table access and no schema CREATE leakage.
- Positive and negative authority cases for every permission and scope level, including AAL1, expired, revoked, cross-program and customer-only actors.
- Independent reviewer and self-approval denial.
- Exact retry, changed-payload conflict, stale-version denial and reauthorization on replay.
- Real two-connection races for start, transition, close and reopen.
- Atomic rollback when audit, outbox or receipt insertion fails.
- Recursive secret/redaction fixtures and restricted-reference non-enumeration.
- Stale/superseded CI callback and duplicate webhook delivery.
- API body/origin/content-type/cache/error bounds and cursor pagination.
- Proof that merge, CI success, acceptance, closure and deployment remain distinct facts.

## External unavailable references

`CE010`, private CE/PM credentials or bindings, and commit `1f010c4` remain `external/unavailable` and non-blocking. PM01-B introduces no dependency on them and defines no inferred Secret, hostname, file path or private package source. The repository-owned `CE-010` work remains a separate verifiable source.

## Exit state

PM01-B is complete as a documentation/readiness package when this inventory, scope decision, proposed physical/API boundary and verification gates are reviewed. [The PM01 Runtime Authorization Gate](PM-01-RUNTIME-AUTHORIZATION-GATE-v1.0.md) records that no further independent documentation package remains and enumerates the separate approvals required for the proposed `PM01-RUNTIME-01` successor. Runtime remains blocked until those approvals are explicit. The next runtime implementation package must use a separate Core/Platform branch and Draft PR and must not be inferred from acceptance of this documentation.
