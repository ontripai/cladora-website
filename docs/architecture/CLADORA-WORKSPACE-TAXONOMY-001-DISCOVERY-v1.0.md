# CLADORA-WORKSPACE-TAXONOMY-001 — Discovery & Architecture Specification v1.0 (R3)

**Document ID:** `CLADORA-DISC-TAXONOMY-001-R3`  
**Authoritative Architectural Invariant:**  
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$  
**Baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77` (Tracking `origin/main`)  
**Target Migration:** `supabase/migrations/20260915120000_workspace_taxonomy.sql` (Migration 100)  
**Target Acceptance Test:** `supabase/tests/087_workspace_taxonomy.test.sql` (Test 087)  

---

## 1. Executive Summary & Architectural Goals

The purpose of this package is to establish the versioned Universal Workspace Taxonomy for the CLADORA platform. It models property profiles, operating models, space kinds, deterministic workspace property bindings, and compatibility matrices in PostgreSQL with strict tenant boundary isolation, version effective-period integrity, and default-deny security.

---

## 2. Decision Record & Security Findings (R3 Remediation)

### 2.1 [WSTAX-R2-001] Canonical Workspace Property Binding
- **Issue:** Relying on `platform.import_runs` for runtime workspace resolution was non-authoritative because `import_runs` represents migration history, not canonical live authority. Multiple historical import runs on a property could introduce non-deterministic resolution.
- **Canonical Model:** Introduced `platform.workspace_property_bindings` as the single canonical source of truth for property-to-workspace mapping:
  - Columns: `id`, `tenant_id`, `customer_workspace_id`, `property_id`, `status`, `valid_from`, `valid_to`, `binding_source`, `created_by`, `created_at`, `updated_at`.
  - Allowed `binding_source` values: `onboarding_activation`, `building_setup`, `platform_assignment`, `migration_verified`.
  - Non-overlapping active binding constraint per property.
  - Zero backfill of existing legacy workspaces (existing workspaces remain unclassified / not-bound until canonical binding is registered).
  - Runtime resolution chain:
    $$\text{Context Grant} \longrightarrow \text{Scoped Object (Property/Building/Unit)} \longrightarrow \text{Property} \longrightarrow \text{workspace\_property\_bindings} \longrightarrow \text{Customer Workspace}$$

### 2.2 [WSTAX-R2-002] Version Effective-Period Integrity
- **Issue:** Registries permitted concurrent overlapping active versions of the same `code`, creating catalog ambiguity.
- **Decision:** Implemented concurrency-safe trigger `app_private.guard_taxonomy_version_effective_period_v1` on `platform.property_profiles`, `platform.operating_models`, and `platform.space_kinds`.
- Any attempt to insert or update an active version with an overlapping effective period throws `workspace_taxonomy_version_effective_period_overlap` (`P0001`).
- Catalog List APIs (`list_taxonomy_profiles_v1`, `list_taxonomy_operating_models_v1`, `list_taxonomy_space_kinds_v1`) filter strictly by `valid_from <= statement_timestamp() AND (valid_to IS NULL OR valid_to > statement_timestamp())`, guaranteeing that only the single currently effective version per code is exposed.

### 2.3 [WSTAX-R2-003] Historical Identity Protection
- **Decision:** In `guard_workspace_taxonomy_assignment_history_v1` and `guard_workspace_property_binding_history_v1`, the full historical identity (`id`, `tenant_id`, `customer_workspace_id`, `property_id` / `property_profile_id`, `operating_model_id`, `created_by`, `created_at`, `valid_from`) is immutable. Physical `DELETE` is prohibited.
- `notes` on assignments is documented as an operational annotation for audit annotations, while historical entity identities are strictly protected.

### 2.4 [WSTAX-SEC-002] Assignment RLS & Direct Client Read Revocation
- **Decision:** Direct table `SELECT` and DML privileges for `authenticated` and `anon` are completely REVOKED on `platform.workspace_taxonomy_assignments` and `platform.workspace_property_bindings`. Access is strictly mediated via context-validated RPCs.

### 2.5 [WSTAX-SEC-003] Catalog Access Minimization
- **Decision:** Direct `SELECT` on `platform.property_profiles`, `platform.operating_models`, `platform.space_kinds`, and compatibility tables is revoked from `authenticated`. All catalog reads are mediated by `customer_api` RPCs.

### 2.6 [WSTAX-AUDIT-001] Read-Only Foundation & Deferred Mutation Audit
- **Decision:** Public mutation RPCs for taxonomy assignment are omitted in this package. Assignment records are read-only for clients. Finding recorded:
  `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`.

### 2.7 [WSTAX-SEED-001] Seed Immutability
- **Decision:** Removed all `ON CONFLICT (code, version) DO UPDATE` clauses. Seeds use deterministic plain `INSERT INTO` statements to ensure existing versions cannot be overwritten.

### 2.8 [WSTAX-UI-001] Dashboard UI Integration
- **Decision:** Integrated `WorkspaceTaxonomyCard` into `CustomerDashboard.tsx` with dynamic fetch via `/api/customer/v1/workspace/taxonomy?context_id=...`, supporting loading state (`role="status"`), error state (`role="alert"`), and complete RO/EN/FA + RTL translations.

---

## 3. Deterministic Error Codes Matrix

| Error Name | SQLSTATE | Condition |
| :--- | :--- | :--- |
| `authentication_required` | `42501` | `auth.uid()` is null |
| `customer_context_access_denied` | `42501` | Actor has no active grant for context |
| `workspace_taxonomy_context_not_workspace_bound` | `42501` | Unbound property or ambiguous context grant |
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
