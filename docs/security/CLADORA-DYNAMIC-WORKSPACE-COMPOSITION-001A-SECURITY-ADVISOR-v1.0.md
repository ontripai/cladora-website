# Security Advisor Exception Register — Dynamic Workspace Composition (v1.0)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-SECURITY-ADVISOR-v1.0`
**Security Lead / Owner:** CLADORA Architecture & Security Working Group
**Status:** `PROPOSED-CONTROLLED-EXCEPTION`
**Baseline Date:** 2026-09-17
**PR:** Draft PR (Branch `feat/cladora-dynamic-workspace-composition-001a` -> `main`)
**Reference Migration:** `supabase/migrations/20260917120000_workspace_dynamic_composition.sql` (Migration 102)
**Reference Test:** `supabase/tests/089_workspace_dynamic_composition.test.sql` (Test 089)
**Target Supabase Environment:** Ephemeral Postgres / CI Runner (Remote Apply: NOT PERFORMED)

---

## 1. Executive Summary & Authoritative Statement

This document logs the proposed security exceptions and architectural controls for the database objects introduced in Migration 102 (`20260917120000_workspace_dynamic_composition.sql`) under package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A`.

> [!IMPORTANT]
> **Pre-Release Architectural Security Statement:**
> All findings identified below are classified as **`PROPOSED-CONTROLLED-EXCEPTION`**. Under strict release policy, **no finding is marked as Accepted** prior to formal authorization, branch review, and Supabase remote deployment. All gateway functions are protected by fail-closed context authorization, explicit search paths, role validation, and AAL2 step-up enforcement. All new tables enforce strict PostgreSQL deny-by-default Row Level Security.

The findings represent intentional architectural patterns:
1. **Three (3) `WARN` findings (`0029_authenticated_security_definer_function_executable`):** Three controlled `customer_api` RPC functions exposed to authenticated sessions with internal fail-closed context resolution, tenant isolation, explicit search paths, permission checks (`workspace.module.manage`), and AAL2 step-up validation for mutations.
2. **Seven (7) `INFO` findings (`0008_rls_enabled_no_policy`):** Seven core module registry, compatibility, and temporal activation tables with Row Level Security enabled and zero client-facing permissive policies, enforcing strict PostgreSQL deny-by-default table isolation.

---

## 2. Proposed Security Advisor Findings Inventory

### 2.1 Three (3) Proposed Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSCOMP-ADV-WARN-001` | `customer_api.get_workspace_composition_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSCOMP-ADV-WARN-002` | `customer_api.activate_workspace_module_v1(uuid, uuid, uuid, jsonb, text, text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSCOMP-ADV-WARN-003` | `customer_api.deactivate_workspace_module_v1(uuid, uuid, uuid, text, text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |

### 2.2 Seven (7) Proposed Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSCOMP-ADV-INFO-001` | `platform.module_definitions` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-002` | `platform.module_dependencies` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-003` | `platform.module_incompatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-004` | `platform.module_property_profile_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-005` | `platform.module_operating_model_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-006` | `platform.workspace_modules` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSCOMP-ADV-INFO-007` | `platform.workspace_module_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Security Matrix for Composition RPC Gateways

| Attribute | `get_workspace_composition_v1` | `activate_workspace_module_v1` | `deactivate_workspace_module_v1` |
| :--- | :--- | :--- | :--- |
| **Function Owner** | `postgres` | `postgres` | `postgres` |
| **Security Context** | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` |
| **Actual Volatility** | `STABLE` | `VOLATILE` | `VOLATILE` |
| **Explicit search_path** | `pg_catalog, platform, identity, app_private` | `pg_catalog, platform, identity, audit, app_private` | `pg_catalog, platform, identity, audit, app_private` |
| **EXECUTE Granted** | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` |
| **Revoked Roles** | `public, anon` | `public, anon` | `public, anon` |
| **AAL2 Step-Up Check** | N/A (read-only) | Conditional: Enforced when module requires_aal2 is true or sensitivity_level is sensitive/high_impact (`auth.jwt()->>'aal' = 'aal2'`) | Conditional: Enforced when module requires_aal2 is true or sensitivity_level is sensitive/high_impact (`auth.jwt()->>'aal' = 'aal2'`) |
| **Permission Check** | Active context grant | Enforces `workspace.module.manage` | Enforces `workspace.module.manage` |
| **Context Validation** | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, 'read')` | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, 'mutation')` | `app_private.resolve_workspace_from_customer_context_v1(p_context_id, 'mutation')` |
| **Tenant Isolation** | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` | Scoped strictly to caller's `tenant_id` and resolved `workspace_id` |
| **Concurrency Guard** | Transaction-level isolation | `pg_advisory_xact_lock(hashtext('workspace_module_mutation:' || v_resolved.workspace_id::text))` | `pg_advisory_xact_lock(hashtext('workspace_module_mutation:' || v_resolved.workspace_id::text))` |
| **Why DEFINER Required** | Reads locked `platform.*` tables | Reads & mutates `platform.*` and `audit.*` while direct client DML is denied | Reads & mutates `platform.*` and `audit.*` while direct client DML is denied |
| **Risk Disposition** | **PROPOSED-CONTROLLED-EXCEPTION** | **PROPOSED-CONTROLLED-EXCEPTION** | **PROPOSED-CONTROLLED-EXCEPTION** |

---

## 4. Deep-Dive Security Controls & Compensating Safeguards

### 4.1 Context Resolver Reuse & Fail-Closed Guard (`app_private.resolve_workspace_from_customer_context_v1`)
- **Resolver Isolation:** The resolver is declared `SECURITY DEFINER` under `app_private` schema with execution revoked from `PUBLIC`, `anon`, and `authenticated`. Only backend functions run as definer or `service_role` can invoke it.
- **Context Integrity:** Validates that `auth.uid()` holds an active membership in the context's tenant.
- **Fail-Closed Mutation Enforcement:** When invoked with `p_mode = 'mutation'`:
  - Lacking property/building/unit binding throws `workspace_module_context_not_workspace_bound` (`42501`).
  - Ambiguous bindings throw `workspace_module_workspace_binding_ambiguous` (`42501`).
  - Tenant-only fallback is explicitly rejected.
- **Read Mode Resilience:** When invoked with `p_mode = 'read'`:
  - Returns structured `status: 'binding_required'` when unbound or ambiguous, allowing client UIs to present informative setup guidance without throwing unhandled database exceptions.

### 4.2 Idempotency Boundary & Payload Normalization (`platform.workspace_module_idempotency`)
- **Canonical Boundary:** Idempotency uniqueness is scoped to `UNIQUE (tenant_id, idempotency_key)`, strictly preventing cross-workspace key leakage within a tenant.
- **Deterministic SHA-256 Hash:** Constructed using `jsonb_build_object` with normalized `request_hash_version = 1`, trimmed non-empty reason, canonical `{}` config, action name, and IDs.
- **Collision Detection:** Any key reuse across different workspaces or different payloads emits `workspace_module_idempotency_conflict` (`22023`).
- **Success-Only Persistence:** Idempotency records represent committed success only. Failed operations abort the transaction completely; zero residue or failed records are left in the database.

### 4.3 Optimistic Concurrency & Serialization Guard
- **Advisory Locks:** Mutations acquire `pg_advisory_xact_lock` on the workspace ID.
- **State Validation:** Mutations verify `p_expected_workspace_module_id` against the currently active module record. Stale requests raise `workspace_module_expected_state_conflict` (`40001`).

### 4.4 RLS Deny-by-Default Architecture
- All seven tables in `platform` have Row Level Security enabled (`ENABLE ROW LEVEL SECURITY`).
- `GRANT SELECT, INSERT, UPDATE, DELETE` is restricted to `service_role`.
- `authenticated` and `anon` roles have zero table-level grants and zero permissive policies.
- Direct client manipulation via PostgREST is impossible; all queries must traverse the audited `customer_api` gateways.

### 4.5 Fail-Closed Taxonomy Compatibility Gate & Projection Guard (R4)
- **Zero Fallback to Compatible:** All `coalesce(..., 'compatible')` projections have been removed. Projection emits server-authoritative fields (`profile_compatibility`, `operating_model_compatibility`, `effective_compatibility`).
- **Enforced Assignment Cardinality:** Mutation strictly requires exactly one active taxonomy assignment on the workspace. Zero active assignments emits `workspace_module_taxonomy_assignment_required` (`42501`); multiple emits `workspace_module_taxonomy_assignment_ambiguous` (`42501`).
- **Mandatory Compatibility Rules:** Both property profile and operating model compatibility rules must explicitly exist. Missing rules reject mutation with `workspace_module_compatibility_rule_missing` (`42501`).
- **Review Required Rejection in 001A:** Status `review_required` rejects mutation with `workspace_module_compatibility_review_required` (`42501`) because independent approval workflows remain deferred under `DEFERRED-COUNTRY-PACK-MODULE-POLICY`.
- **Zero Partial Writes:** All taxonomy and compatibility failures immediately abort transaction execution, resulting in zero rows written to `workspace_modules`, `workspace_module_idempotency`, or `audit.events`.
