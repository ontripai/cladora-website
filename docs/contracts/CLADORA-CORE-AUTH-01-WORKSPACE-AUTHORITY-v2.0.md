# CLADORA Core AUTH-01 Workspace-native authority v2.0

**Baseline:** `feat/core-pf-01-owner-portfolio-projection@7cf9577d6183b6adf37e6ef002a9a86f27b87a30`

**Owner:** Core Security and Identity owns the shared authority evaluator. Product/domain owners select exact permission and module codes and enforce their own lifecycle prerequisites.

**Delivery boundary:** additive decision schema, pure result adapter and regression contract only. No migration, endpoint, role/permission mutation, parallel evaluator, central manifest rewrite or Production effect.

## Existing authority reused

AUTH-01 reuses:

- `app_private.resolve_workspace_native_context_v2` for explicit current actor/context/Workspace resolution;
- `app_private.check_workspace_native_permission_v2` as the canonical Workspace-scope boolean evaluator;
- `app_private.check_effective_permission_v2` and its direct helper for deny-first direct/local/delegated evaluation;
- existing memberships, context grants, module definitions, permission bindings, Workspace roles/assignments, authority lineage and delegations.

It creates no second membership, role, permission, grant, assignment, delegation, audit, outbox or idempotency source. It does not widen public execution privileges on private evaluator functions.

## `workspace-native-effective-authority.v2`

The request pins a caller-generated decision ID, context, Workspace, exact permission/module pair, Workspace target and bounded evaluation purpose. `target_scope_id` must equal `workspace_id`; resource-scoped commands continue using their existing canonical domain authority path and are not silently promoted to Workspace scope.

The adapter describes the boolean returned by `app_private.check_workspace_native_permission_v2`. It does not recalculate role, entitlement, taxonomy, delegation or lineage rules in TypeScript. The only reasons are `current_effective_permission_allowed` and `current_effective_permission_denied`; a boolean false is not expanded into a guessed internal denial reason.

Every result has status-only source disclosure and a null source reference. Internal membership, role, assignment, delegation, grantor and lineage identifiers are not exposed. The decision is point-in-time evidence, not a bearer token: `reusable_as_command_authority = false` and `current_authority_recheck_required = true` are invariant.

## Preserved evaluator semantics

The existing evaluator remains authoritative for all of the following:

- current actor, active membership/context and explicit active Workspace;
- published, temporally valid role assignment with matching Workspace scope;
- active module and current entitlement prerequisite;
- exact permission/module binding and AAL2 requirement;
- deny-first identity/local-role evaluation;
- delegable binding only, zero recursion, current grantee/grantor authority and expiry ceiling;
- live authority-lineage validation after role handover, revocation or expiry;
- fail-closed unknown, ambiguous, inactive and cross-tenant inputs.

An allowed decision grants no domain approval, audience eligibility, ownership, provider agreement, capacity, financial posting or lifecycle transition. Those remain separate prerequisites at the destination command.

## Regression evidence and future runtime gate

Repository evidence already covers native resolution, direct/local/delegated allow, deny precedence, revoked/expired membership and delegation, grantor re-evaluation, unknown resource kinds and role-handover lineage through:

- `scripts/test-workspace-native-authority-003.mjs`;
- `supabase/tests/170_workspace_role_handover.test.sql`;
- `supabase/migrations/20261003122445_workspace_native_context_authority_v2.sql`;
- `supabase/migrations/20261006090000_workspace_role_authority_lineage_v1.sql`.

This slice does not repeat those evaluators or claim a new database run. A future consumer adapter must call the private evaluator server-side, preserve its boolean exactly, validate this result schema, and then recheck authority inside every command. Any public RPC, persisted decision ledger or broader reason disclosure requires a separate reviewed package and disposable database evidence.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
