# CLADORA Shared Core Execution Contract 001 v1.0
Date: 2026-10-03
Scope: CORE-01, CORE-02, CORE-03 from the shared change register.
Status: Proposed implementation specification. No migration/API implementation or runtime verification in this change.
Parent: CLADORA-ARCH-SHARED-WORKSPACE-20261003-01, PR #213.

## Deliverable boundary
Align the three existing AIRPROP commands and introduce permission-controlled read projections using the shared context/module/permission machinery.
Do not add leasing, mandates, deposits, public listings or SERVICE booking commands in this package.
Do not alter old migrations; use a new coordinated migration after full-chain review.

## CORE-01: Context and target contract
Use app_private.resolve_workspace_from_customer_context_v1 and existing hierarchy resolution; extend their contract only if audit proves a gap.
Input: authenticated actor (server-derived), context_id, requested action, explicit target scope/type and target ID when bound.
Output for internal use: tenant_id, workspace_id, membership_id, role_id, target ancestry, context ceiling and effective time. Never expose another tenant's target IDs in errors.
context_id, workspace_id, tenant_id and physical subject ID are distinct.
Target must belong to the resolved tenant and be actively bound to the workspace.
Context ceiling must encompass the full object being read or changed. A unit grant may act on that unit; it cannot configure rights or operating models for its parent property.
An opportunity without a registered subject is a case. Tenant membership alone must not imply universal case visibility. Select explicit case assignments or workspace-contained ownership rules before implementation.

## CORE-02: Effective AIRPROP permission contract
Resolve the target first, then use the canonical effective permission evaluator.
All applicable gates: active membership/context/workspace, matching tenant/subject, active runtime module, entitlement, taxonomy compatibility, permission binding, deny-first evaluation, current local roles/delegation, action-specific assurance.
Retain AAL2 for the existing AIRPROP commands during alignment. Any relaxation is a separate documented policy decision.
Commercial rights/mandates are additional business checks, not substitutes for software permissions.

### Command mapping
| Existing command | Existing permission | Required target treatment |
|---|---|---|
| create_airprop_opportunity_v1 | airprop.opportunity.manage | Validate supplied property against context and active workspace binding; unbound cases use explicit case/workspace policy |
| add_airprop_underwriting_version_v1 | airprop.underwriting.manage | Resolve opportunity and subject/case scope without existence leaks; require access before returning facts |
| configure_airprop_property_v1 | airprop.asset.manage | Full-property authority; reject unit/building-only grants for whole-property mutation |
| Proposed opportunity read projection | airprop.opportunity.read | Case/subject assignment and field redaction |
| Proposed interests/model read projection | airprop.asset.read | Subject scope and party-sensitive field redaction |

Keep command signatures compatible where possible. Existing idempotency replay still requires current authorization and must not disclose a previously authorized response after revocation.
Close alternate direct-read paths only after inventorying consumers and introducing compatible gateways. Preserve existing protections and service-worker contracts.

## CORE-03: Runtime catalogue and role bindings
Catalogue the existing five permissions. Separate read, propose, manage and approve actions when new workflows are introduced.
Three seeded AIRPROP roles are templates; the documented eleven-role model is not proof of implemented roles.
Choose actual runtime module code(s) after auditing module registry conventions. Do not invent duplicate cores or turn a catalog_only entry into a runtime module without dependency, entitlement and compatibility definitions.
For every binding record: permission, module version, validity period, local-role assignment eligibility, delegation eligibility, required AAL and approval policy.
Financial approval/posting permissions are not inherited merely from airprop.asset.manage.
SERVICE contributes its permission requirements through the same catalogue in a subsequent domain package; this package does not seed speculative booking permissions.
Capability read projection drives menu/actions; server checks remain authoritative.

## Acceptance matrix
| ID | Scenario | Expected |
|---|---|---|
| T01 | Anonymous command | Denied, no mutation |
| T02 | Required AAL2 absent | Denied, no mutation |
| T03 | Expired/revoked membership or context | Denied |
| T04 | Different security tenant target | No data disclosure or write |
| T05 | Same tenant, different workspace target | Denied without valid binding/scope |
| T06 | Unit grant configures parent property | Denied |
| T07 | Property-level valid authority | Authorized command succeeds |
| T08 | Local role deny with base role allow | Denied |
| T09 | Valid local role allow without base permission | Allowed only within scope and all module gates |
| T10 | Delegation expired, revoked or grantor authority removed | Denied |
| T11 | Module inactive, entitlement expired or compatibility missing | Denied |
| T12 | Opportunity null-subject case outside assignment | Denied |
| T13 | Duplicate authorized command | Same result, no duplicate evidence |
| T14 | Same idempotency key, different payload | Conflict, no extra writes |
| T15 | Replay after actor access revoked | Denied |
| T16 | Concurrent interest/model changes | Invariants preserved; conflict/retry behavior explicit |
| T17 | Gateway denied, direct table read attempted | No authorization bypass |
| T18 | Read-only actor issues mutation | Denied |
| T19 | UI context switches while read/save pending | Previous-context results never displayed/applied to new context |
| T20 | RO/EN/FA capability display | Correct direction/labels; denied actions hidden or explained consistently |

T01-T18 use synthetic transaction-isolated fixtures; T19-T20 use actual UI/API when introduced.
Test specifications above are not executed tests.

## Files and coordination
Expected shared touchpoints: context resolver, effective-permission evaluator integration, module definitions/bindings, capability projection and scoped gateway contracts.
Prefer AIRPROP adapters to rewriting the global evaluator; modify shared helpers only for a proven common gap and run existing role/delegation/composition regression suites.
Domain work must declare overlapping files before edits. Migration numbering is reserved at implementation time, not in this document.
A new implementation PR depends on the shared architecture baseline. It must list actual changed functions, consumer compatibility, test evidence and remote migration parity requirements.

## Completion criteria
Full migration-chain override audit complete; implementation and synthetic negative tests pass; no parallel identity/space/financial registries; command/read gateways consistent; production rollout scope separately established.
