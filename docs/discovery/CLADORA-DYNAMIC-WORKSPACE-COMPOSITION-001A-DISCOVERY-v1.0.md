# Discovery Report — CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A

## 1. Executive Summary

This Discovery Report documents the pre-implementation and architecture verification for the dynamic workspace composition engine (`CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A`) in `ontripai/cladora-website`.

This task delivers:
- Canonical Module Registry with relational dependency DAG and universal taxonomy compatibility
- Context-Scoped Customer RPC Gateways (`get_workspace_composition_v1`, `activate_workspace_module_v1`, `deactivate_workspace_module_v1`)
- Strict single-current temporal tracking (`valid_to IS NULL`) and historical immutability
- Versioned, deterministic tenant-scoped idempotency engine (`platform.workspace_module_idempotency`)
- Server-authoritative projection flags (`is_installed`, `is_entitled`, `is_compatible`, `can_activate`, `can_deactivate`)
- Zero Identity schema mutation; controlled permission catalog seed (`workspace.module.manage`)

**Baseline SHA**: `681770b4708748091d536dd254d60fbafe4e18f6`  
**Target Branch**: `feat/cladora-dynamic-workspace-composition-001a`  
**Allocated Slots**: Migration 102 / pgTAP Test 089  

---

## 2. Discovery Findings Matrix

| Status | Entity / Mechanism | Architectural Detail |
| :--- | :--- | :--- |
| **MATCH** | Taxonomy Foundation | `platform.property_profiles` (16 profiles) and `platform.operating_models` (8 models) populated from Migration 100/101. |
| **MATCH** | Context Binding Foundation | `platform.workspace_property_bindings` links customer context via property/building/unit scope to canonical workspace. |
| **MATCH** | Active Entitlement Store | `platform.workspace_entitlements` stores canonical `module.*` entitlement keys verified against active contracts and subscription plans. |
| **MATCH** | Audit Events Pipeline | `audit.events` captures immutable operational snapshots with actor role, action, and rationale. |
| **EXTEND** | Module Registry | `platform.module_definitions` created with composite uniqueness `(code, version)`, effective window guard, and trilingual RO/EN/FA labels. |
| **EXTEND** | Relational Dependency DAG | `platform.module_dependencies` with recursive cycle detection trigger `guard_module_dependency_dag_v1()` preventing cyclic graphs. |
| **EXTEND** | Relational Incompatibilities | `platform.module_incompatibilities` enforcing architectural incompatibility constraints. |
| **EXTEND** | Taxonomy Compatibilities | `platform.module_property_profile_compatibilities` and `platform.module_operating_model_compatibilities` linking module definitions to taxonomy IDs. |
| **EXTEND** | Temporal Workspace Modules | `platform.workspace_modules` with partial unique index `(customer_workspace_id, module_code) WHERE (valid_to IS NULL)`. |
| **EXTEND** | Versioned Idempotency | `platform.workspace_module_idempotency` with canonical boundary `UNIQUE (tenant_id, idempotency_key)` and SHA-256 JSONB digest. |
| **EXTEND** | Identity Permission Seed | Seeded `workspace.module.manage` in `identity.permissions` and granted to `association_admin` and `property_manager`. |
| **EXTEND** | Client Surface | `/api/customer/v1/workspace/composition`, `/api/customer/v1/workspace/modules/activate`, `/api/customer/v1/workspace/modules/deactivate`, and `WorkspaceCompositionCard.tsx`. |
| **DEFERRED** | Deferred Scope Items | `DEFERRED-COUNTRY-PACK-MODULE-POLICY`, Package 001B (Workspace-local roles & delegation), Package 001C (Dual-control approvals & module config mutations). |

---

## 3. Concurrency & Locking Semantics

1. **Per-Workspace Per-Module Transactional Advisory Lock:**
   ```sql
   perform pg_advisory_xact_lock(hashtextextended('workspace_module:' || v_res.workspace_id::text || ':' || v_module_def.code, 0));
   ```
2. **Deterministic Concurrency Contract:**
   - Initial activation: caller passes `p_expected_workspace_module_id IS NULL`. If a concurrent transaction commits first, the second transaction detects the active row and throws SQLSTATE `40001` with domain code `workspace_module_expected_state_conflict`.
   - Deactivation: caller passes exact active `workspace_module_id`. If state changed concurrently, throws SQLSTATE `40001` (`workspace_module_expected_state_conflict`).
   - Zero raw `23505` errors are leaked to the client or test suite.
