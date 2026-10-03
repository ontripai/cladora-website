# Shared context ceiling 002

Prerequisite: AIRPROP scope ceiling PR #214. This additive slice implements the shared target-scope contract from #213 without replacing existing permission functions or domain callers.

`context_covers_workspace_target_v1` resolves the existing workspace context and validates canonical target ancestry, tenant, unique active workspace binding and the original context ceiling. Property contexts cover that target and descendants; building contexts cover that building and child units; unit contexts cover only that unit. A workspace-wide target requires a tenant context resolved unambiguously by the existing core resolver. Resolving a workspace does not itself widen access.

`check_scoped_effective_permission_v1` requires this ceiling AND the canonical effective-permission engine. It does not recreate module activation, entitlement, taxonomy, base/local-role deny precedence or delegation. Both helpers remain internal with execute revoked from public, anon, authenticated and service_role.

The adapter is read-capable. Mutating callers must additionally use the existing mutation workspace resolver and their required AAL checks. This does not activate AIRPROP, grant permissions, alter runtime data, change RLS or connect existing commands. AIRPROP catalogue/binding integration and caller migration remain subsequent work; Operations and SERVICE can reuse the same adapter when their domain gates are implemented.

Validation: 33 synthetic pgTAP assertions exercise exact/descendant targets, widening and sibling denial, actor and input denial, actual core effective allow/deny and entitlement/module gates, and private helper ACLs. Hosted validation is required. No production execution or deployment.
