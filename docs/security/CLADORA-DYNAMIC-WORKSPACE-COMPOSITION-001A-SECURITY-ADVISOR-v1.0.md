# Security Advisor Exception Register — Dynamic Workspace Composition (v1.0)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-SECURITY-ADVISOR-v1.0`
**Security Lead / Owner:** CLADORA Architecture & Security Working Group
**Status:** `ACCEPTED-CONTROLLED-EXCEPTION`
**Baseline Date:** 2026-09-17
**Merged Pull Request:** PR [#102](https://github.com/ontripai/cladora-website/pull/102) via Squash Commit [`98800623e150d0877ca8839d2ba5f33bd5da3c6a`](https://github.com/ontripai/cladora-website/commit/98800623e150d0877ca8839d2ba5f33bd5da3c6a)
**Reference Migration:** `supabase/migrations/20260917120000_workspace_dynamic_composition.sql` (Migration 102)
**Reference Test:** `supabase/tests/089_workspace_dynamic_composition.test.sql` (Test 089)
**Target Supabase Environment:** Supabase Linked Production (Migration 102 Applied / Remote 102 / Drift 0 / Production Verified)

---

## 1. Executive Summary & Authoritative Statement

This document logs the formal security exceptions and architectural controls for the database objects introduced in Migration 102 (`20260917120000_workspace_dynamic_composition.sql`) under package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A`.

Following the successful application of Migration 102 to Supabase Linked Production, verification of zero drift (`Local 102 / Remote 102 / Drift 0`), zero blocking queries (0 blocked PID, 0 ungranted lock), and automated CI/CD validation on `main`, all exceptions cataloged herein have been formally audited and assigned the status **`ACCEPTED-CONTROLLED-EXCEPTION`** or **`ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL`**.

The findings represent intentional, proven architectural patterns:
1. **Three (3) `WARN` findings (`0029_authenticated_security_definer_function_executable`):** Three controlled `customer_api` RPC functions exposed to authenticated sessions with internal fail-closed context resolution, tenant isolation, explicit ordered search paths, permission checks (`workspace.module.manage`), and AAL2 step-up validation for mutations.
2. **Seven (7) `INFO` findings (`0008_rls_enabled_no_policy`):** Seven core module registry, compatibility, and temporal activation tables with Row Level Security enabled. Direct access by `anon` and `authenticated` roles is completely denied via explicit `REVOKE ALL` and zero client-facing policies; client application access is mediated exclusively through audited `customer_api` gateways. Internal maintenance and administrative operations are governed by minimal, non-permissive `service_role` grants and dedicated `service_role_all` policies.

---

## 2. Accepted Security Advisor Findings Inventory

### 2.1 Three (3) Accepted Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSCOMP-ADV-WARN-001` | `customer_api.get_workspace_composition_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSCOMP-ADV-WARN-002` | `customer_api.activate_workspace_module_v1(uuid, uuid, uuid, jsonb, text, text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSCOMP-ADV-WARN-003` | `customer_api.deactivate_workspace_module_v1(uuid, uuid, text, text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |

### 2.2 Seven (7) Accepted Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSCOMP-ADV-INFO-001` | `platform.module_definitions` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-002` | `platform.module_dependencies` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-003` | `platform.module_incompatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-004` | `platform.module_property_profile_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-005` | `platform.module_operating_model_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-006` | `platform.workspace_modules` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-007` | `platform.workspace_module_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Security Matrix for Composition RPC Gateways

| Attribute | `get_workspace_composition_v1` | `activate_workspace_module_v1` | `deactivate_workspace_module_v1` |
| :--- | :--- | :--- | :--- |
| **Real Function Owner** | `postgres` | `postgres` | `postgres` |
| **Security Context** | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` |
| **Real Volatility** | `STABLE` | `VOLATILE` | `VOLATILE` |
| **Real Ordered search_path** | `pg_catalog, platform, identity, portfolio, app_private` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` |
| **EXECUTE Granted** | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` |
| **Revoked Roles** | `public, anon` | `public, anon` | `public, anon` |
| **AAL2 Step-Up Check** | N/A (read-only) | Conditional: Enforced when module `requires_aal2` is true or `sensitivity_level` is sensitive/high_impact (`auth.jwt()->>'aal' = 'aal2'`) | Conditional: Enforced when module `requires_aal2` is true or `sensitivity_level` is sensitive/high_impact (`auth.jwt()->>'aal' = 'aal2'`) |
| **Permission Check** | Active context grant | Enforces `workspace.module.manage` | Enforces `workspace.module.manage` |
| **Context Validation** | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, false)` | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, true)` | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, true)` |
| **Tenant Isolation** | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` |
| **Fail-Closed Taxonomy Behavior** | Evaluates active assignment cardinality; returns `taxonomy_required` or `rule_missing`; never defaults to `compatible` | Exactly 1 active assignment required; missing rules raise `42501`; `review_required` raises `42501`; 0 partial writes | Safe leaf deactivation preserved regardless of taxonomy state; requires active installation |
| **Concurrency Guard** | Transaction-level read consistency | `pg_advisory_xact_lock(hashtextextended('workspace_module:' || v_res.workspace_id::text || ':' || v_module_def.code, 0))` | `pg_advisory_xact_lock(hashtextextended('workspace_module:' || v_res.workspace_id::text || ':' || v_current.module_code, 0))` |
| **Why DEFINER Required** | Reads locked `platform.*` tables | Reads & mutates `platform.*` and `audit.*` while direct client DML is denied | Reads & mutates `platform.*` and `audit.*` while direct client DML is denied |
| **Compensating Controls** | Strict resolver isolation, no direct DML, fail-closed projection | Advisory locks, optimistic concurrency check (`40001`), AAL2 enforcement, deterministic idempotency hash, transactional audit event recording | Advisory locks, dependency graph check (`workspace_module_dependent_active`), optimistic concurrency check (`40001`), transactional audit event recording |
| **Residual Risk** | Low / Controlled, subject to periodic review (read-only projection, zero side effects) | Low / Controlled, subject to periodic review (guarded by authorization, idempotency, advisory locks, audit events) | Low / Controlled, subject to periodic review (guarded by dependency leaf enforcement, advisory locks, audit events) |
| **Review Owner** | CLADORA Architecture & Security WG | CLADORA Architecture & Security WG | CLADORA Architecture & Security WG |
| **Risk Disposition** | **ACCEPTED-CONTROLLED-EXCEPTION** | **ACCEPTED-CONTROLLED-EXCEPTION** | **ACCEPTED-CONTROLLED-EXCEPTION** |

---

## 4. Deep-Dive Security Controls & Compensating Safeguards

### 4.1 Context Resolver Contract & Fail-Closed Guard (`app_private.resolve_workspace_from_customer_context_v1`)
- **Resolver Signature & Isolation:** Declared as `app_private.resolve_workspace_from_customer_context_v1(p_context_id uuid, p_is_mutation boolean)` with `SECURITY DEFINER` under `app_private` schema and explicit search path `pg_catalog, platform, identity, portfolio, app_private`. Execution is revoked from `PUBLIC`, `anon`, and `authenticated`. It contains zero direct grants to external roles and is callable only internally by definer gateway functions.
- **Context Integrity:** Validates that `auth.uid()` holds an active membership in the context's tenant and that context grants and memberships are temporally active (`starts_at <= statement_timestamp() < ends_at`).
- **Mutation Path Enforcement (`p_is_mutation = true`):**
  - Strictly requires explicit Property/Building/Unit binding. If absent or 0 active property bindings exist, throws `workspace_composition_context_not_workspace_bound` (`42501`).
  - Ambiguous property bindings (>1 active bindings) throw `workspace_composition_workspace_binding_ambiguous` (`42501`).
  - Tenant-only context fallback and single-workspace guessing are strictly prohibited.
- **Read Path Behavior (`p_is_mutation = false`):**
  - When context has a scoped property binding with 0 active bindings, returns structured `status: 'binding_required'`.
  - When context has ambiguous property bindings (>1 active bindings), raises fail-closed exception `workspace_composition_workspace_binding_ambiguous` (`42501`).
  - When context is pure tenant-scoped (unbound to property): if exactly 1 active workspace exists, resolves that workspace; if 0 active workspaces exist, returns `status: 'binding_required'`; if multiple active workspaces exist (>1), raises fail-closed exception `workspace_composition_context_not_workspace_bound` (`42501`).

### 4.2 Idempotency Boundary & Payload Normalization (`platform.workspace_module_idempotency`)
- **Canonical Boundary:** Idempotency uniqueness is scoped to `UNIQUE (tenant_id, idempotency_key)`, preventing cross-workspace key leakage within a tenant.
- **Deterministic SHA-256 Hash:** Constructed using `jsonb_build_object` with normalized `request_hash_version = 1`, trimmed non-empty reason, canonical `{}` config, action name, and IDs.
- **Collision Detection:** Any key reuse across different workspaces or different payloads emits `workspace_module_idempotency_conflict` (`22023`).
- **Success-Only Persistence:** Idempotency records represent committed success only. Failed operations abort the transaction completely; zero residue or failed records are left in the database.

### 4.3 Optimistic Concurrency & Scoped Advisory Lock Guard
- **Scoped Advisory Locks:** Mutations acquire `pg_advisory_xact_lock(hashtextextended('workspace_module:' || workspace_id || ':' || module_code, 0))` on the composite workspace and module code. This avoids workspace-wide mutation serialization while guaranteeing strict mutual exclusion for concurrent operations on the same module.
- **State Validation:** Mutations verify `p_expected_workspace_module_id` against the currently active module record. Stale requests raise `workspace_module_expected_state_conflict` (`40001`).

### 4.4 RLS & Table Grant Architecture
- All seven tables in `platform` have Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`).
- **Client Roles (`anon`, `authenticated`):** `REVOKE ALL` applied to all seven tables; zero table-level grants and zero policies exist for client roles. Direct client access is prevented under the documented grants, revokes and RLS policies; programmatic client access is mediated exclusively through audited `customer_api` RPC gateways.
- **Service Role Grants & Policies:**
  - `GRANT SELECT` only on registry and compatibility tables (`platform.module_definitions`, `platform.module_dependencies`, `platform.module_incompatibilities`, `platform.module_property_profile_compatibilities`, `platform.module_operating_model_compatibilities`).
  - `GRANT SELECT, INSERT, UPDATE` on temporal state and idempotency tables (`platform.workspace_modules`, `platform.workspace_module_idempotency`). Note that `DELETE` is not granted.
  - Each table defines a dedicated service role policy: `create policy service_role_all on platform.<table_name> for all to service_role using (true) with check (true);`.

### 4.5 Fail-Closed Taxonomy Compatibility Gate & Projection Guard (R4)
- **Zero Fallback to Compatible:** All `coalesce(..., 'compatible')` projections have been removed. Projection emits server-authoritative fields (`profile_compatibility`, `operating_model_compatibility`, `effective_compatibility`).
- **Enforced Assignment Cardinality:** Mutation strictly requires exactly one active taxonomy assignment on the workspace. Zero active assignments emits `workspace_module_taxonomy_assignment_required` (`42501`); multiple emits `workspace_module_taxonomy_assignment_ambiguous` (`42501`).
- **Mandatory Compatibility Rules:** Both property profile and operating model compatibility rules must explicitly exist. Missing rules reject mutation with `workspace_module_compatibility_rule_missing` (`42501`).
- **Review Required Rejection in 001A:** Status `review_required` rejects mutation with `workspace_module_compatibility_review_required` (`42501`) because independent approval workflows remain deferred under `DEFERRED-COUNTRY-PACK-MODULE-POLICY`.
- **Zero Partial Writes:** All taxonomy and compatibility failures immediately abort transaction execution, resulting in zero rows written to `workspace_modules`, `workspace_module_idempotency`, or `audit.events`.

---

## 5. Scope Boundaries & Deferred Policies

- **`DEFERRED-COUNTRY-PACK-MODULE-POLICY`:** Jurisdiction-specific module overrides, country packs, and statutory approval workflows remain deferred. No approval workflow logic is claimed or implemented in 001A.
- **Package 001B / 001C:** Dynamic composition remains strictly within the verified bounds of 001A. Zero speculative features or runtime extensions for 001B are introduced in this advisory register.
