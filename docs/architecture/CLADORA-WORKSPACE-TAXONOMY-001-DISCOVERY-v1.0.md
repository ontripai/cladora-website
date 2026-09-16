# CLADORA-WORKSPACE-TAXONOMY-001 — Discovery & Architecture Specification v1.0 (R4)

**Document ID:** `CLADORA-DISC-TAXONOMY-001-R4`  
**Authoritative Architectural Invariant:**  
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$  
**Baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77` (Tracking `origin/main`)  
**Target Migration:** `supabase/migrations/20260915120000_workspace_taxonomy.sql` (Migration 100)  
**Target Acceptance Test:** `supabase/tests/087_workspace_taxonomy.test.sql` (Test 087)  

---

## 1. Executive Summary & Architectural Goals

The purpose of this package is to establish the versioned Universal Workspace Taxonomy for the CLADORA platform. It models property profiles (16), operating models (8), space kinds (21), deterministic workspace property bindings, and compatibility matrices in PostgreSQL with strict tenant boundary isolation, version effective-period integrity, concurrency-safe locking, and default-deny security.

---

## 2. Decision Record & Security Findings (R4 Remediation)

### 2.1 [WSTAX-R4-001-VERSION-RACE] Deterministic Version Concurrency Protection
- **Issue:** In R3, `app_private.guard_taxonomy_version_effective_period_v1` relied solely on `SELECT EXISTS(...)`, allowing two concurrent transactions inserting active versions for the same code to both pass in parallel.
- **Decision:** Added a deterministic transactional advisory lock per (registry, code) prior to the overlap check:
  `perform pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA || ':' || TG_TABLE_NAME || ':' || new.code, 0));`
- **Result:** Concurrent inserts for the same `(registry, code)` serialize deterministically. Under `READ COMMITTED`, the unblocked second transaction observes the committed version from the winner and throws `workspace_taxonomy_version_effective_period_overlap` (`P0001`). Different codes never block each other.

### 2.2 [WSTAX-R4-002-BINDING-RACE] Property-Level Concurrency Serialization
- **Issue:** In R3, `app_private.guard_workspace_property_binding_v1` locked the `customer_workspace` row. Two concurrent transactions attempting to bind the same property to two different workspaces could lock separate workspace rows and both succeed.
- **Decision:** The target property row in `portfolio.properties` is now locked `FOR UPDATE` prior to checking tenant consistency and active binding overlap:
  `select tenant_id into v_property_tenant from portfolio.properties where id = new.property_id for update;`
- **Result:** Concurrent binding attempts for the same `property_id` serialize on the property row lock. Exactly one winner commits; the losing transaction detects the committed active binding and raises `workspace_property_binding_overlap` (`P0001`).

### 2.3 [WSTAX-R4-003-SPACE-KIND-COMPLETENESS] Complete Space Kind Registry (21 Items)
- **Decision:** Restored the 3 approved space kinds:
  1. `yard` (Yard & Outdoor Staging)
  2. `loading_zone` (Loading Zone & Logistics Dock)
  3. `land_parcel` (Land Parcel)
  retaining all 3 R3 additions (`courtyard_garden`, `roof_deck`, `infrastructure_node`) to achieve exactly 21 canonical space kinds.
- **Compatibility Matrix Complete:**
  - `yard`: compatible with `warehouse_logistics`, `industrial_park`, `managed_township`, `gated_villa_community`, `single_villa`; review_required with `retail_centre`, `mixed_use_estate`, `office_centre`.
  - `loading_zone`: compatible with `retail_centre`, `warehouse_logistics`, `industrial_park`, `mixed_use_estate`; review_required with `office_centre`.
  - `land_parcel`: compatible with `single_villa`, `gated_villa_community`, `managed_township`, `industrial_park`, `developer_portfolio`; review_required with `mixed_use_estate`.

### 2.4 [WSTAX-R4-004-UNBOUND-WORKSPACE-UX] Unbound Existing Workspace UX & Safe Degradation
- **Context:** Migration 100 enforces zero backfill of legacy data. Existing property-scoped contexts will initially lack bindings.
- **Security & UX Alignment:**
  - RPC (`customer_api.get_workspace_taxonomy_v1`): After authoritative user, membership, and context validation, if no binding exists (`v_binding_count = 0`), returns:
    ```json
    {
      "has_assignment": false,
      "status": "binding_required",
      "workspace_id": null
    }
    ```
  - Zero sensitive data leak: No workspace ID or tenant info is exposed in the unbound state.
  - Route (`/api/customer/v1/workspace/taxonomy`): Maps `workspace_taxonomy_context_not_workspace_bound` to HTTP 409 `TAXONOMY_NOT_CONFIGURED` if encountered, while passing valid 200 responses with `status: 'binding_required'`.
  - UI (`WorkspaceTaxonomyCard`): Displays neutral, non-error informative state with trilingual copy:
    - RO: „Clasificarea workspace-ului nu este încă configurată.”
    - EN: “Workspace classification is not configured yet.”
    - FA: «طبقه‌بندی فضای کاری هنوز تنظیم نشده است.»
  - Unauthorized contexts continue to receive HTTP 403 `CONTEXT_ACCESS_DENIED`. Ambiguous bindings (>1) remain fail-closed.

### 2.5 [WSTAX-R4-005-PRIVILEGED-FUNCTION-GRANTS] Explicit Privileged Function Revocations
- **Decision:** Executed explicit `REVOKE ALL ON FUNCTION ... FROM public, anon, authenticated;` for all `app_private` trigger functions and internal helpers created in Migration 100:
  - `guard_taxonomy_version_effective_period_v1()`
  - `guard_taxonomy_record_immutability_v1()`
  - `guard_workspace_taxonomy_assignment_history_v1()`
  - `guard_workspace_property_binding_history_v1()`
  - `guard_workspace_property_binding_v1()`
  - `guard_workspace_taxonomy_assignment_v1()`
  - `validate_taxonomy_compatibility_v1(uuid, uuid)` (strictly granted to `service_role`).

---

## 3. Deterministic Error Codes Matrix

| Error Name | SQLSTATE | Condition |
| :--- | :--- | :--- |
| `authentication_required` | `42501` | `auth.uid()` is null |
| `customer_context_access_denied` | `42501` | Actor has no active grant for context |
| `workspace_taxonomy_context_not_workspace_bound` | `42501` | Ambiguous tenant-scoped context without property scope |
| `workspace_taxonomy_workspace_binding_ambiguous` | `42501` | Multiple active workspace bindings exist for property |
| `workspace_taxonomy_workspace_binding_tenant_mismatch` | `42501` | Binding `tenant_id` does not match membership / property tenant |
| `workspace_property_binding_overlap` | `P0001` | Overlapping active binding periods for same property |
| `workspace_property_binding_history_immutable` | `42501` | Attempted deletion or mutation of property binding identity |
| `workspace_taxonomy_version_effective_period_overlap` | `P0001` | Overlapping active effective periods for same registry code |
| `workspace_taxonomy_immutable_record` | `42501` | Physical deletion of referenced taxonomy catalog record |
| `workspace_taxonomy_assignment_history_immutable` | `42501` | Physical deletion or modification of historic assignment record |
| `workspace_taxonomy_incompatible_assignment` | `P0001` | Incompatible profile and operating model combination |
| `workspace_taxonomy_review_required` | `P0001` | Review-required combination attempted as active without approval |
| `workspace_taxonomy_compatibility_rule_missing` | `P0001` | Missing compatibility rule evaluates to default deny |
| `workspace_taxonomy_assignment_overlap` | `P0001` | Overlapping active assignments for same workspace |
