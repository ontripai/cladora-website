# Workspace-native commercial opportunity contract v1.0
Date: 2026-10-03
Decision: CLADORA-ARCH-SHARED-WORKSPACE-20261003-02
Parent: CLADORA-ARCH-SHARED-WORKSPACE-20261003-01
Status: Implementation specification; not a deployed API or schema.
Applies to Operations, AIRPROP and SERVICE. Prerequisites: PR #214 and stacked PR #216.

## Problem and current boundary
A commercial opportunity can concern a workspace before any physical subject is selected. The existing AIRPROP opportunity has an optional property_id and no persisted workspace_id. PR #216 deliberately denies unbound creation and hides historical unbound rows until an explicit workspace authorization contract exists. This temporary restriction does not define the final commercial scope.

A workspace must be resolved from validated core authority, never inferred from a convenient physical anchor. A tenant, portfolio, context grant and workspace remain different identities.

## Authoritative identity and scope
Every new opportunity must persist canonical workspace_id and security tenant identity, checked together against platform.customer_workspaces. Subject selection is optional and cannot determine whether a workspace-native opportunity is valid.
Existing property_id retains its canonical physical meaning. A future subject reference must use the shared registry contract CORE-04; an unchecked subject_type/subject_id pair is not acceptable.

| Opportunity scope | Required identity | Authorization ceiling | Permitted behavior |
|---|---|---|---|
| Workspace | Explicit validated workspace authority | Whole named workspace | Create and evaluate an opportunity without a physical subject |
| Physical subject | Workspace plus canonical bound subject | Exact subject or valid ancestor grant | Create and evaluate within that subject |
| Portfolio collection | Independently authorized workspace references | Each workspace checked separately | Authorized aggregation; no implicit cross-workspace mutation |

A physical subject grant never authorizes a whole-workspace opportunity. Permission to read a workspace summary does not imply mutation authority. A commercial mandate is a business relationship and does not replace software permission.

## Shared core extension
The current resolver's mutation mode requires a physical bound context. Its tenant-only read path cannot be reused as workspace mutation authority.
Introduce an explicit workspace-bound context contract in the shared core after auditing context grant constraints and all dependent consumers. It must validate authenticated principal, active membership, tenant, workspace, grant status and time window. The server returns trusted identifiers and scope, not identifiers supplied by the client without verification.
Preserve existing resolver behavior for existing callers. Use a versioned contract or compatible explicit extension, with negative regression tests for Operations and SERVICE.
The new context must be selectable and validated through the canonical active-context mechanism; a parallel AIRPROP session or grant store is forbidden.

Effective permission continues to use the canonical module, entitlement, taxonomy, local/base allow, deny and delegation engine. Workspace-native authorization must evaluate the exact workspace target; physical authorization must retain the shared context ceiling. AIRPROP requires AAL2 on reads and commands.
Do not invent a new permission solely because a subject is absent: reuse opportunity.read/manage and underwriting.manage unless an independently defined business action requires a new permission.

## Command and persistence contract
A versioned create command accepts explicit workspace_id and optional canonical subject. It resolves core context first, validates target and permission, and then evaluates idempotency.
Persist workspace identity at creation. An opportunity's workspace is immutable through ordinary editing; moving it requires a separately designed authorized transition.
Underwriting derives workspace and subject from the persisted opportunity, never from replacement request fields. Existing immutable version and deterministic calculation behavior remains intact.
Idempotency is workspace scoped for the new contract. Audit the existing tenant/key uniqueness before changing it; identical keys in different workspaces must not disclose or return another workspace's result. Legacy command compatibility requires an explicit namespace or adapter contract.
Reads use persisted workspace identity plus effective permission and scope; they do not infer workspace from today's physical binding. Historical visibility after rebinding requires an explicit policy and migration, not silent recomputation.

## Existing records
| Existing row | Migration treatment |
|---|---|
| Bound subject with exactly one validated matching workspace | Candidate for audited backfill; validate tenant and binding timing |
| Null subject | Unresolved; no tenant-wide or default-workspace inference |
| Missing, ambiguous or inconsistent binding | Unresolved; no automatic assignment |
| Physical subject subsequently rebound | Historical review; current binding alone is insufficient evidence |

Preserve unresolved data and history. Keep it unavailable through ordinary customer reads until an authorized resolution links it to an evidenced workspace. Resolution requires audit provenance and must not emit new commercial or financial effects. No backfill is authorized by this specification itself.

## Three-work execution matrix
| Shared change | Responsible writer | AIRPROP | Operations | SERVICE |
|---|---|---|---|---|
| Explicit workspace context | Shared core | Consume for commercial commands | Validate existing context behavior | Consume for workspace service requests |
| Canonical workspace/subject references | Shared registry | Persist references | Own technical subject detail | Reference spaces/resources |
| Permission evaluation | Shared authorization | Commercial permissions and AAL2 | Existing operational permissions | Service permissions |
| Opportunity/underwriting lifecycle | AIRPROP | Authoritative write | Authorized projections only | Authorized projections only |
| Work orders | Operations | Link when required | Authoritative write | Coordinate through existing gateway |
| Bookings/capacity | Shared availability and SERVICE | Check before commercial commitment | Supply operational constraints | Authoritative booking path |
| Commercial money | Shared finance | Submit source-linked commands | Supply approved execution sources | Submit approved service sources |
| Exchange | Existing shared outbox | Emit owned transitions | Consume under own policy | Consume under own policy |

No consumer may turn opportunity creation or evaluation into an agreement, booking, access grant, invoice or payment without its own authorized transition.

## Acceptance and implementation order
1. Audit latest main and all context-grant/resolver consumers; reserve shared files and migration ownership across the three works.
2. Implement explicit workspace authority in a prerequisite core PR, retaining existing caller semantics.
3. Verify workspace A versus B isolation within the same tenant; cross-tenant denial; expired/revoked membership/context; AAL1; local deny; inactive module; missing entitlement; and physical-to-workspace widening denial.
4. Add persisted workspace identity and an audited legacy-resolution path. Check ambiguous and historical bindings without guessing.
5. Add versioned create and underwriting behavior; test idempotency within and across workspaces, altered retry payloads, authorization revocation before retry, and unchanged audit/business row counts on denial.
6. Align every opportunity/case/version read with persisted scope. Test null subject under explicit workspace authority, and denial under building/unit-only authority.
7. Verify unchanged Operations and SERVICE context behavior, then provide capability-based UI and localized flows.

## Completion boundary
PR #216 covers bound-subject AIRPROP authorization and reads, with 169 focused pgTAP assertions recorded at commit 5780fff691e8b15426e46d68c05dbfd56c611f44. Those results do not certify the workspace-native extension described here. This specification adds no runtime grants, workspace activations, production writes or migration-history changes.
