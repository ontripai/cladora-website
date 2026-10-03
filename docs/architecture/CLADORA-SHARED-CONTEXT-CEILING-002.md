# Shared context ceiling and AIRPROP core gate 002

Prerequisite: AIRPROP scope ceiling PR #214. This slice implements the shared target-scope contract from #213, the AIRPROP runtime catalogue and an additive bound-subject gate. Existing domain command signatures and callers are preserved.

`context_covers_workspace_target_v1` resolves the existing workspace context and validates canonical target ancestry, tenant, unique active workspace binding and the original context ceiling. Property contexts cover that target and descendants; building contexts cover that building and child units; unit contexts cover only that unit. A workspace-wide target requires a tenant context resolved unambiguously by the core resolver.

`check_scoped_effective_permission_v1` requires this ceiling AND the canonical effective-permission engine. It reuses module activation, entitlement, taxonomy compatibility, base/local-role deny precedence and delegation checks. Mutation callers must additionally use the core mutation resolver and their AAL gate. Operations and SERVICE can use the same adapter.

AIRPROP has one runtime definition, `airprop_commercial` v1, entitlement `module.airprop_commercial`, trilingual labels and the five already-existing AIRPROP permission bindings. All five bindings require AAL2, are locally assignable and non-delegable in this slice. Existing taxonomy v1 is compatible; new taxonomy versions require explicit compatibility registration. This does not imply a country pack is active.

`require_airprop_workspace_context_v1` is an internal bound-property adapter: authentication, AAL2, known AIRPROP permission and non-null target, core workspace resolver (mutation mode for writes), shared scope ceiling and canonical effective permission. It returns canonical workspace, tenant, membership and base role code for audit provenance. It can accept a local role without requiring an AIRPROP base role. It does not change existing public commands, unbound opportunities or RLS.

The old v2 binding seed validator retains 90 total, 48 active, 42 delegable and 6 non-delegable checks within its ten historic module codes. Global high-risk non-delegation checks remain. AIRPROP independently validates the exact five-row manifest. New domains therefore do not corrupt a historical snapshot test.

No workspace activation, entitlement issuance, role assignment, duplicate registry or production change is made by the migration. Both shared helpers and the AIRPROP helper are private; direct execute is revoked from all client roles.

Validation: 33 shared ceiling assertions and 21 AIRPROP module/gate assertions, including real-core allow/deny, local-role support, AAL2, activation/entitlement denial and ACLs. Hosted results must be checked for this expanded slice. Public command cutover, unbound-opportunity scope, read/RLS alignment and commercial-domain expansion remain separate work.
