# CLADORA shared workspace native authority — CORE-003 v1.0

Decision: CLADORA-ARCH-WORKSPACE-NATIVE-AUTHORITY-20261003-01. Parent: CLADORA-ARCH-SHARED-WORKSPACE-20261003-02. Base: main `5d1b8102db54cb248602450a788bdab2a5bae834`. Consumers: SERVICE and workspace-native AIRPROP; existing Operations and physical AIRPROP continue through v1.

## Canonical authority contract

The v2 runtime context is the tuple `(context_id, workspace_id)`. The server validates the authenticated Context owner, active membership and Context time windows, the exact active Workspace in the same tenant, and at least one current **workspace-scoped** assignment in `platform.workspace_member_roles` to a published, current `platform.workspace_roles` version with a workspace ceiling. Role, assignment, membership, Context and Workspace tenants must agree. Neither tenant membership nor a physical Context alone is authority for this tuple.

This is an additive refinement of the workspace-native Context contract: it uses an existing tenant Context as the outer ceiling and an existing, explicitly assigned local workspace role as the narrower canonical scope. It does not extend `identity.scope_type`, relax Context constraints, mint a new Context ID, create a grant store, infer a Workspace from a property, or promote a tenant read fallback. No assignment is automatically created. Target selection is explicit even when a tenant has only one Workspace.

`resolve_workspace_native_context_v2` returns trusted identifiers and scope, **not permission**. `check_workspace_native_permission_v2` evaluates the exact target through the canonical permission rules: current module and binding, activation, entitlement/override, taxonomy compatibility, base/local allow, deny before allow, and valid delegated allow. Sensitive module/binding AAL2 and existing customer MFA policy apply. Delegation rechecks the grantor's current direct authority in that same Workspace; a physical grantor Context cannot delegate whole-workspace authority.

Current canonical direct/delegated rules live in the v2 internal functions. The existing v1 signatures delegate with a null explicit target to preserve legacy behavior. Existing resolver and context-ceiling functions and consumer RPCs are unchanged. The explicit v2 adapter rejects null Workspace IDs before they could fall into that legacy mode. No public execute grant exists on the resolver, membership-scope helper, or permission engines.

## Target discovery and application integration

Authenticated `customer_api.list_workspace_targets_v2(context_id)` exposes only authorized, active Workspace IDs with their existing type and environment. `GET /api/customer/v1/workspace/targets?context_id=...` calls that gateway, disables caching, rejects malformed/duplicate/extra query inputs, authenticates claims, maps access denial to 403, and does not leak database errors.

SERVICE/AIRPROP commands must resolve the exact tuple, check their canonical module permission, validate every referenced subject/provider/document and business approval, and only then evaluate retries and write. Existing SERVICE request validation/retry fingerprints are not authority. Domain schemas, module seeds, endpoints and UI are separate changes after this core PR. AIRPROP's mandatory AAL2 contract remains even if a future module configuration is changed.

Generic workspaces still need explicit canonical role assignments through an audited provisioning/role flow. This change does not add an issuer or bypass the physical requirements of existing v1 role-assignment commands. If no appropriate assignment exists, target discovery returns an empty list; it does not fabricate authority. Provisioning and suspended-workspace recovery need their separately authorized control-plane flows.

## Ownership and compatibility

This PR owns migration `20261003122445_workspace_native_context_authority_v2.sql`, the target-discovery endpoint, dedicated tests/workflow and this record. Inspected Operations #215 and AIRPROP #219 have no exact changed-path overlap. SERVICE #217/#218 do not change these paths. Runtime shared permission functions are deliberately affected; consumers must validate behavior after the core merge. There is no automatic synchronization between chats.

## Verification and limits

The test executes the actual new migration, actual existing resolver, MFA helper, direct/delegated engines and scoped adapter on isolated PostgreSQL (PGlite 0.5.3). Referenced canonical columns are represented by a bounded fixture schema; this is **not** a complete Supabase migration-chain reset, production verification or multi-connection concurrency test.

60 SQL scenarios cover exact target resolution, same-tenant Workspace B and foreign-tenant denial, expiry/revocation/future validity, physical-to-workspace widening, customer MFA and module AAL2, missing/ambiguous module/binding/taxonomy, entitlements, deny-first, delegation and current grantor authority, internal function ACLs, and authenticated target discovery. A pre/post matrix compares 91 legacy direct/effective/scoped/delegated evaluations. 11 gateway scenarios execute the actual compiled route. Full project TypeScript, focused lint and existing unit tests are required alongside them.

Deployment is gated on review, complete migration-chain verification and the existing Application Foundation checks. The known unchanged npm audit failure is not suppressed. No remote database write or deployment is performed by these tests. SERVICE and AIRPROP remain incomplete until their executable persistence and UI flows consume the core contract. Branches are deleted only after confirmed completed merges.
