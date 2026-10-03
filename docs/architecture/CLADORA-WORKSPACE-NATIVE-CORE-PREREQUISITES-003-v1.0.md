# Explicit workspace authority: shared core prerequisite 003

Date: 2026-10-03
Parent decision: CLADORA-ARCH-SHARED-WORKSPACE-20261003-02
Audited source: main 5d1b8102db54cb248602450a788bdab2a5bae834, 186 SQL migrations.
Status: source audit and implementation specification; no runtime authorization change.

## Finding

The current customer context store cannot represent explicit workspace authority.
`identity.scope_type` contains tenant/property/building/unit. `identity.context_grants`
has no workspace column; its shape check requires a physical identifier for each
physical scope. A tenant context has no physical identifiers. Membership status
and membership/grant time windows govern validity; this context table has no
independent status field. Do not assume one exists.

The composition resolver v1 requires a validated physical binding for mutation.
Its tenant read fallback resolves only one eligible workspace, and must not become
mutation authority. A physical grant also must not authorize a workspace-wide
opportunity. Replacing that resolver alone would affect existing shared gateways.

`src/types/platform.ts` ScopeType describes INTERNAL PLATFORM assignment categories
(workspace/commercial/technical/support/audit). It is not the customer identity
enum and must not be reused as customer authorization scope.

## Coordinated change matrix

| Surface verified in source | Required core work | Compatibility gate |
|---|---|---|
| 20260825000200 identity migration: enum, grant shape, membership linkage | Add an explicit named workspace scope and canonical workspace/tenant linkage in NEW migrations; retain existing grant shapes | Existing tenant/property/building/unit grants keep their meaning; no automatic conversion |
| platform.customer_workspaces composite identity added by #216 | Reuse (id,tenant_id), never create a second workspace registry | Wrong-tenant workspace rejected by storage and resolver |
| app_private.resolve_workspace_from_customer_context_v1 in 20260917120000 | Versioned resolver for explicit workspace grants; reuse authentication, active membership and time-window checks | Preserve v1 caller behavior; no unique-workspace inference for mutations |
| app_private.check_effective_permission_v1 final replacement in 20260919120000 | Shared versioned extension resolves explicit authority and evaluates exact workspace target | Keep base/local deny-first, delegation, module, entitlement, taxonomy and AAL requirements; no parallel AIRPROP evaluator |
| app_private.context_covers_workspace_target_v1 and check_scoped_effective_permission_v1 in #216 | Versioned ceiling handles named workspace plus canonical physical ancestry/binding | Building/unit grants cannot widen to workspace; mismatched target ID rejected |
| platform.list_my_customer_contexts in 20260902074312; customer_api gateway in 20260907200000 | Versioned projection adds trusted workspace identity/label without changing v1 RETURNS TABLE shape | Existing context clients continue to parse existing output |
| src/components/customer/CustomerContextProvider.tsx; /api/customer/v1/contexts | Use the canonical selector and validated server projection for the new scope | No AIRPROP-only context/session store; existing saved context IDs still work |
| app_private.active_context_id in foundation; customer_context_is_active and customer gateways | Trace the active claim transport and validate ownership/current validity at each new command/read boundary | A browser-selected ID or forged claim cannot establish authority |
| tokenless invitation acceptance in 20260901075649; prepared access in 20260924161209; provision binding in 20260926184942 | Dedicated audited issuance/revocation path with explicit workspace and authority | Do not silently broaden existing tenant/physical invitations; preserve their current flows |
| local roles in 20260918120000 and delegations in 20260919120000 | Validate assignment/delegation ceilings against the new context and persisted named workspace | No tenant-wide allow inherited from a narrow physical grant |
| AIRPROP create/read/underwriting in #216 | Consume completed shared contract through versioned gateway | Existing v1 remains bound-subject-only; historical unresolved rows remain protected |

These are verified change surfaces, not a claim that all transitive authorization
dependencies have been proven safe. Search the full current migration chain,
RLS policies, grants, JWT/context transport, generated types and API consumers
again before the runtime core PR. Historic definitions are not necessarily the
final installed definitions. Full migration replay and database catalog evidence
are required to establish the actual final function bodies and ACLs.

## One writer across the three works

The prerequisite core PR owns the identity scope extension, context resolver,
effective permission integration and projection. AIRPROP and SERVICE consume it;
Operations validates compatibility. None of these works may create a duplicate
grant, workspace or permission engine to get around the prerequisite.

Open-work path snapshot on 2026-10-03:

| PR | Owned paths | Relationship to this AIRPROP slice |
|---|---|---|
| #215 Operations | building setup wizard and its hardening script | No exact changed-path overlap |
| #217 SERVICE architecture | two SERVICE architecture documents | No exact changed-path overlap |
| #218 SERVICE contract | SERVICE schema, lifecycle, test and dedicated workflow | No exact changed-path overlap; common core prerequisite remains |

This snapshot neither synchronizes independent chats nor reserves files in their
future work. Recheck open PR paths and main before creating the core migration.

## Runtime acceptance before release

1. Explicit workspace A/B in one tenant: list/select/resolve exact workspace;
   deny wrong-workspace target and cross-tenant identifiers, including retries.
2. Deny anonymous, AAL1, wrong principal, revoked/suspended/expired membership,
   future/expired grant and inactive workspace. Prove current checks precede
   idempotency lookup; denial changes no records/audit/outbox.
3. Prove physical-to-workspace widening denial, local/base deny precedence,
   inactive module, missing entitlement, incompatible taxonomy and scoped
   delegation behavior using the canonical engine.
4. Replay existing Operations and SERVICE-related context suites; preserve v1
   scope semantics, invitations, provisioning, context selection and RLS reads.
5. Add a separate v2 persistence namespace/unique key and atomic retry locking.
   Prove same-key/different-workspace isolation, altered-payload conflict and
   concurrent duplicate requests producing one opportunity and one creation audit.
6. Align nullable-subject reads/underwriting with persisted workspace. Preserve
   unresolved history until the separately audited resolution gateway exists.

No existing memberships, grants, roles, entitlements, bindings or customer data
are modified by this audit or the accompanying pure AIRPROP input contract.
