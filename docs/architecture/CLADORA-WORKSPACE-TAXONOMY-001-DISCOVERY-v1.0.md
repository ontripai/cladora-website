# CLADORA-WORKSPACE-TAXONOMY-001 — Discovery & Architecture Specification v1.0 (R2)

**Document ID:** `CLADORA-DISC-TAXONOMY-001-R2`  
**Authoritative Architectural Invariant:**  
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$  
**Baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77` (Tracking `origin/main`)  
**Target Migration:** `supabase/migrations/20260915120000_workspace_taxonomy.sql` (Migration 100)  
**Target Acceptance Test:** `supabase/tests/087_workspace_taxonomy.test.sql` (Test 087)  

---

## 1. Executive Summary & Architectural Goals

The purpose of this package is to establish the versioned Universal Workspace Taxonomy for the CLADORA platform. It models property profiles, operating models, space kinds, and their deterministic compatibility matrix in PostgreSQL with strict tenant boundary isolation and default-deny security.

---

## 2. Decision Record & Security Findings (R2)

### 2.1 [WSTAX-SEC-001] Context Resolution & Workspace Binding
- **Issue:** Previous implementations relied on `ORDER BY w.id LIMIT 1` across tenant workspaces, causing potential non-deterministic leakage in multi-workspace tenants.
- **Canonical Chain:** `User → Membership → Context Grant → Scoped Object → Customer Workspace`.
- **Decision:** If context is scoped to a property, building, or unit, it resolves strictly via `platform.import_runs`. If scoped to tenant and the tenant holds exactly 1 active workspace, it resolves that single workspace. If multiple workspaces exist without an unambiguous scoped binding, it fails closed with deterministic error:
  `workspace_taxonomy_context_not_workspace_bound` (errcode `42501`).

### 2.2 [WSTAX-SEC-002] Assignment RLS & Direct Client Read Revocation
- **Issue:** Broad tenant-level RLS (`tenant_id = app_private.active_tenant_id()`) allowed any tenant member to read all workspace taxonomy assignments across different workspaces.
- **Decision:** Direct table `SELECT` and DML privileges for `authenticated` and `anon` are completely REVOKED on `platform.workspace_taxonomy_assignments`. Access to taxonomy assignments is strictly mediated via the context-validated RPC `customer_api.get_workspace_taxonomy_v1(p_context_id)`.

### 2.3 [WSTAX-SEC-003] Catalog Access Minimization
- **Decision:** Direct `SELECT` on `platform.property_profiles`, `platform.operating_models`, `platform.space_kinds`, and compatibility tables is revoked from `authenticated`. All catalog reads are mediated by `customer_api.list_taxonomy_profiles_v1`, `customer_api.list_taxonomy_operating_models_v1`, and `customer_api.list_taxonomy_space_kinds_v1`.

### 2.4 [WSTAX-AUDIT-001] Read-Only Foundation & Deferred Mutation Audit
- **Decision:** Public mutation RPCs for taxonomy assignment are omitted in this package. Assignment records in `platform.workspace_taxonomy_assignments` are immutable and read-only for clients. Finding recorded:
  `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`.

### 2.5 [WSTAX-HISTORY-001] Assignment History Immutability
- **Decision:** Trigger `app_private.guard_workspace_taxonomy_assignment_history_v1` blocks any physical `DELETE` or unauthorized `UPDATE` on existing assignment records, throwing `workspace_taxonomy_assignment_history_immutable`.

### 2.6 [WSTAX-SEED-001] Seed Immutability
- **Decision:** Removed all `ON CONFLICT (code, version) DO UPDATE` clauses. Seeds use deterministic plain `INSERT INTO` statements to ensure existing versions cannot be overwritten.

### 2.7 [WSTAX-VALIDATION-001] Validation Constraints
- **Decision:** Database check constraints enforce:
  - `code ~ '^[a-z0-9_]{3,64}$'`
  - `length(trim(name)) > 0`
  - `jsonb_typeof(labels_json) = 'object'`
  - Non-empty `ro`, `en`, and `fa` strings in `labels_json`
  - `jsonb_typeof(metadata_json) = 'object'`
  - Valid date intervals (`valid_to is null or valid_to > valid_from`).

### 2.8 [WSTAX-UI-001] Dashboard UI Integration
- **Decision:** Integrated `WorkspaceTaxonomyCard` into `CustomerDashboard.tsx` with dynamic fetch via `/api/customer/v1/workspace/taxonomy?context_id=...`, supporting loading state (`role="status"`), error state (`role="alert"`), and complete RO/EN/FA + RTL translations.

### 2.9 [WSTAX-REGRESSION-001] Test Maintenance
- **Decision:** Refined `scripts/test-export-scanner-observability-001.mjs` to assert the exact existence of `supabase/migrations/20260914132346_export_scanner_observability.sql`.

---

## 3. Deterministic Error Codes Matrix

| Error Name | SQLSTATE | Condition |
| :--- | :--- | :--- |
| `authentication_required` | `42501` | `auth.uid()` is null |
| `customer_context_access_denied` | `42501` | Actor has no active grant for context |
| `workspace_taxonomy_context_not_workspace_bound` | `42501` | Ambiguous or unlinked context in multi-workspace tenant |
| `workspace_taxonomy_tenant_mismatch` | `42501` | Assignment `tenant_id` does not match `customer_workspaces` |
| `workspace_taxonomy_immutable_record` | `42501` | Physical deletion of referenced taxonomy catalog record |
| `workspace_taxonomy_assignment_history_immutable` | `42501` | Physical deletion or modification of historic assignment record |
| `workspace_taxonomy_incompatible_assignment` | `P0001` | Incompatible profile and operating model combination |
| `workspace_taxonomy_review_required` | `P0001` | Review-required combination attempted as active without approval |
| `workspace_taxonomy_compatibility_rule_missing` | `P0001` | Missing compatibility rule evaluates to default deny |
| `workspace_taxonomy_assignment_overlap` | `P0001` | Overlapping active assignments for same workspace |
