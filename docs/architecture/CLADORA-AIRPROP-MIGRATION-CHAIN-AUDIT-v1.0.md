# CLADORA AIRPROP Migration Chain Audit v1.0
Date: 2026-10-03
Baseline: 7f7ea716a97e9c9ae29e7cbdbcd905c8391246c3
Status: Read-only repository source audit; production parity and runtime tests not performed.

## Method
Enumerated all 184 SQL migration files from the non-truncated main tree. Fetched each at the same commit, in bounded batches; zero fetch failures.
Scanned literal references and function definitions for require_airprop_context_v1, check_effective_permission_v1, resolve_workspace_from_customer_context_v1, airprop. and outbox_events.
Read relevant definitions in full. This is a targeted symbol/override audit, not a full security audit of all statements or dynamically constructed SQL.

## Definition lineage
| Function | Definition migrations | Latest repository definition |
|---|---|---|
| require_airprop_context_v1 | 20260914144417_airprop_core_foundation.sql | Original AIRPROP helper; no later literal override found |
| check_effective_permission_v1 | 20260918120000_workspace_local_roles_permissions.sql; 20260919120000_workspace_delegations_approvals.sql | Delegation-aware definition on September 19 |
| resolve_workspace_from_customer_context_v1 | 20260917120000_workspace_dynamic_composition.sql | Original dynamic-composition resolver |

Only the AIRPROP foundation contains literal airprop. references among the 184 migrations. No later literal AIRPROP permission binding/authorization repair was located.
Outbox appears in the platform foundation and retention migration; this does not prove an active business-event dispatcher.

## Confirmed implementation implications
1. Existing AIRPROP commands still use their original role-allow helper, not the later effective-permission function.
2. The effective-permission function requires a runtime module, valid assignable module-permission binding, workspace activation, entitlement and taxonomy compatibility. Simply replacing the AIRPROP helper call without seeding these prerequisites would deny every new AIRPROP request.
3. The resolver returns workspace_id, tenant_id, membership_id, role_id, role_code and status. It does not return the source grant's full scope ceiling. Preserve/check that ceiling separately in an AIRPROP adapter.
4. Mutation mode prohibits tenant-only contexts. It resolves a physical subject to one active workspace binding and accepts PROVISIONING or ACTIVE workspace lifecycle. A business mutation should separately require the appropriate lifecycle; do not change shared onboarding behavior globally.
5. Read mode may resolve a tenant-only context when exactly one active/provisioning workspace exists. Such resolution is not permission to read every commercial case.
6. AIRPROP configuration is whole-property scoped, while the original helper accepts matching ancestor through building/unit. The adapter must enforce full-target authority.
7. New unregistered opportunities have no workspace foreign key in the existing foundation. Backfilling workspace ownership must be explicit and ambiguous historical cases must remain inaccessible pending resolution, rather than silently selecting a workspace.
8. The five seeded AIRPROP permissions and three roles are still the implementation baseline located by this scan.

## First implementation slice
Use a new AIRPROP authorization adapter referencing the shared resolver and effective-permission engine.
Define runtime module/bindings/compatibility and workspace entitlement prerequisites in the same reviewed package.
Add explicit commercial case/workspace linkage, case visibility and full-subject scope checks.
Retain existing command signatures where safe; when adding a workspace parameter use a versioned gateway rather than silently reinterpreting context_id.
Add scoped read projections before removing legacy read paths, with an inventory of consumers.
Keep PROVISIONING support for shared setup; deny business AIRPROP writes until commercial activation policy is satisfied.
No automatic production entitlements or user roles are granted by this design.

## Required implementation verification
Existing test 086 fixtures use legacy role/context authorization and must be adapted to the shared module/workspace prerequisites while preserving original idempotency and underwriting invariants.
Run local synthetic database tests for narrow scope, missing binding/module/entitlement, deny precedence, expired delegations, inaccessible unregistered cases and replay after revocation.
The current scratch environment has Node, but no Supabase CLI, psql or Docker on PATH at inspection. No database test result is claimed. A suitable local test runtime or CI must be established before release.

## Coordination
This audit supplements the shared change register and execution contract in PR #213.
No old migration was edited; no new schema migration was created/applied; no production data or application code changed.
