# Security Advisor Exception Register — Workspace-Local Roles & Permissions (001B.1)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-SECURITY-ADVISOR-v1.0`
**Security Lead / Owner:** CLADORA Architecture & Security Working Group
**Status:** `ACCEPTED-CONTROLLED-EXCEPTION`
**Baseline Date:** 2026-09-18
**Merged Pull Request:** PR [#104](https://github.com/ontripai/cladora-website/pull/104) via Squash Commit [`8d893a1dcccf3d143ca679bc8fc923ce56fbe10c`](https://github.com/ontripai/cladora-website/commit/8d893a1dcccf3d143ca679bc8fc923ce56fbe10c)
**Reference Migration:** `supabase/migrations/20260918120000_workspace_local_roles_permissions.sql` (Migration 103)
**Reference Test:** `supabase/tests/090_workspace_local_roles.test.sql` (Test 090)
**Target Environment:** Supabase Linked Production (`jyomlehahwlyqzoacrvp`) (Migration 103 Applied / Remote 103 / Drift 0 / Production Verified)

---

## 1. Executive Summary & Authoritative Statement

This register documents the formal security exceptions, architectural risk assessments, and compensating controls for database objects introduced in Migration 103 (`20260918120000_workspace_local_roles_permissions.sql`) under package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1`.

Following the authorized remote application to Supabase Linked Production, verification of zero schema drift (`Local 103 / Remote 103 / Drift 0`), confirmation of zero blocking queries and zero ungranted locks, and successful automated CI/CD pipeline execution on `main`, all exceptions cataloged herein have been formally audited and assigned the authoritative status **`ACCEPTED-CONTROLLED-EXCEPTION`** or **`ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL`**.

The cataloged findings represent proven, deliberate, and hardened multi-tenant security patterns:
1. **Ten (10) Accepted `WARN` Findings (`0029_authenticated_security_definer_function_executable`):** Exactly ten controlled `customer_api` RPC functions exposed to authenticated sessions, strictly partitioned into:
   - **One (1) Read RPC Gateway (`customer_api.get_workspace_roles_v1`):** Marked `STABLE`, validates caller workspace membership and context under AAL1 (no AAL2 required), projects role and permission data without requiring idempotency keys or emitting mutation audit events.
   - **Nine (9) Mutation RPC Gateways:** Marked `VOLATILE`, enforce mandatory AAL2 MFA step-up (`auth.jwt()->>'aal' = 'aal2'`), validate dedicated permissions (`workspace.role.manage`, `workspace.role.publish`, `workspace.role.assign`), execute transactional advisory locking, perform versioned optimistic concurrency checks raising SQLSTATE `40001`, require versioned idempotency keys, and atomically record domain audit events in `audit.events`.
2. **Six (6) Accepted `INFO` Findings (`0008_rls_enabled_no_policy`):** Exactly six core workspace role, module scoping, and assignment tables in the `platform` schema with Row Level Security enabled via `ENABLE ROW LEVEL SECURITY`. Direct access by `anon` and `authenticated` roles is completely denied via explicit `REVOKE ALL` from `public`, `anon`, and `authenticated`, with zero client-facing policies. Client application access is mediated exclusively through audited `customer_api` gateways. Internal maintenance and administrative operations are governed by minimal, non-permissive `service_role` grants.
3. **Internal Helper Function:** `app_private.check_effective_permission_v1` is `SECURITY DEFINER`, with fixed `search_path` `pg_catalog, platform, identity, portfolio, app_private`, and is completely revoked from `public`, `anon`, and `authenticated`.
4. **Zero Trigger Bypass:** The database contains zero backdoor session settings, zero operational cleanup overrides, and zero `session_replication_role` bypasses. All historical and invariant triggers remain strictly non-negotiable.

---

## 2. Accepted Security Advisor Findings Inventory

### 2.1 Ten (10) Accepted Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSROLES-ADV-WARN-001` | `customer_api.get_workspace_roles_v1(p_context_id uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-002` | `customer_api.create_workspace_role_draft_v1(p_context_id uuid, p_code text, p_name text, p_description text, p_scope_ceiling text, p_base_role_id uuid, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-003` | `customer_api.attach_workspace_role_module_v1(p_context_id uuid, p_workspace_role_id uuid, p_module_definition_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-004` | `customer_api.detach_workspace_role_module_v1(p_context_id uuid, p_workspace_role_id uuid, p_module_definition_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-005` | `customer_api.attach_workspace_role_permission_v1(p_context_id uuid, p_workspace_role_id uuid, p_permission_id uuid, p_effect text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-006` | `customer_api.detach_workspace_role_permission_v1(p_context_id uuid, p_workspace_role_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-007` | `customer_api.snapshot_workspace_role_template_permissions_v1(p_context_id uuid, p_workspace_role_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-008` | `customer_api.publish_workspace_role_v1(p_context_id uuid, p_workspace_role_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-009` | `customer_api.assign_workspace_role_v1(p_context_id uuid, p_target_membership_id uuid, p_workspace_role_id uuid, p_scope_type text, p_property_id uuid, p_building_id uuid, p_unit_id uuid, p_valid_until timestamp with time zone, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-010` | `customer_api.revoke_workspace_role_assignment_v1(p_context_id uuid, p_assignment_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |

### 2.2 Six (6) Accepted Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSROLES-ADV-INFO-001` | `platform.module_permission_bindings` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-002` | `platform.workspace_roles` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-003` | `platform.workspace_role_modules` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-004` | `platform.workspace_role_permissions` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-005` | `platform.workspace_member_roles` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-006` | `platform.workspace_role_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Technical Catalog & Security Matrix

### 3.1 Ten `SECURITY DEFINER` Gateway Specifications

| Function Name | Complete Signature | Real Owner | Real Volatility | Real Ordered `search_path` | Granted Roles | Revoked Roles |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `get_workspace_roles_v1` | `(p_context_id uuid)` | `postgres` | `STABLE` | `pg_catalog, platform, identity, portfolio, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `create_workspace_role_draft_v1` | `(p_context_id uuid, p_code text, p_name text, p_description text, p_scope_ceiling text, p_base_role_id uuid, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `attach_workspace_role_module_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_module_definition_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `detach_workspace_role_module_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_module_definition_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `attach_workspace_role_permission_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_permission_id uuid, p_effect text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `detach_workspace_role_permission_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `snapshot_workspace_role_template_permissions_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `publish_workspace_role_v1` | `(p_context_id uuid, p_workspace_role_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `assign_workspace_role_v1` | `(p_context_id uuid, p_target_membership_id uuid, p_workspace_role_id uuid, p_scope_type text, p_property_id uuid, p_building_id uuid, p_unit_id uuid, p_valid_until timestamp with time zone, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `revoke_workspace_role_assignment_v1` | `(p_context_id uuid, p_assignment_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |

### 3.2 Security Controls & Compensating Architecture

| Gateway Routine | Type & Volatility | Required Permission | AAL2 MFA Enforced | Context & Tenant Isolation | Concurrency & Idempotency | Audit Logging |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `get_workspace_roles_v1` | Read (`STABLE`) | `workspace.role.read` | No (AAL1 / Read-Only) | Caller authenticated membership in workspace required; scopes projection strictly to caller tenant. | Read snapshot projection (no lock, no idempotency). | N/A (Read-only, no mutation audit) |
| `create_workspace_role_draft_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Validates caller workspace membership; scopes draft role to caller tenant. | `pg_advisory_xact_lock`, versioned hash key, unique code per tenant. | Writes `WORKSPACE_ROLE_CREATED` to `audit.events`. |
| `attach_workspace_role_module_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Ensures role and active module definition belong to caller tenant context. | Transactional advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_MODULE_ATTACHED` to `audit.events`. |
| `detach_workspace_role_module_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Enforces role tenant boundary; only draft roles can be detached. | Transactional advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_MODULE_DETACHED` to `audit.events`. |
| `attach_workspace_role_permission_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Validates permission existence, active status, and non-administrative scope. | Transactional advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_PERMISSION_ATTACHED` to `audit.events`. |
| `detach_workspace_role_permission_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Enforces draft role immutability invariants and tenant ownership. | Transactional advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_PERMISSION_DETACHED` to `audit.events`. |
| `snapshot_workspace_role_template_permissions_v1` | Mutation (`VOLATILE`) | `workspace.role.manage` | Yes (`aal = 'aal2'`) | Snapshots baseline template permissions for attached modules in tenant. | Transactional advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_TEMPLATE_SNAPSHOTTED` to `audit.events`. |
| `publish_workspace_role_v1` | Mutation (`VOLATILE`) | `workspace.role.publish` | Yes (`aal = 'aal2'`) | Enforces active modules, permissions, role versioning (`role_version` increments), tenant scope. | Advisory lock, supersession locking, lock version verification (`40001`), idempotency replay. | Writes `WORKSPACE_ROLE_PUBLISHED` to `audit.events`. |
| `assign_workspace_role_v1` | Mutation (`VOLATILE`) | `workspace.role.assign` | Yes (`aal = 'aal2'`) | Validates published role, active membership, exact scope hierarchy, tenant match. | Advisory lock on target membership, single active role per scope constraint, idempotency replay. | Writes `WORKSPACE_ROLE_ASSIGNED` to `audit.events`. |
| `revoke_workspace_role_assignment_v1` | Mutation (`VOLATILE`) | `workspace.role.assign` | Yes (`aal = 'aal2'`) | Validates caller tenant and target assignment active status. | Advisory lock, checks `expected_lock_version` (`40001` conflict), idempotency replay. | Writes `WORKSPACE_ROLE_ASSIGNMENT_REVOKED` to `audit.events`. |

### 3.3 Technical Justification for `SECURITY DEFINER` (Non-Invocability of `SECURITY INVOKER`)
- **Deny-by-Default Table Architecture:** The underlying relational tables (`platform.workspace_roles`, `platform.workspace_member_roles`, `platform.workspace_role_modules`, `platform.workspace_role_permissions`, `platform.module_permission_bindings`, `platform.workspace_role_idempotency`) reside in private system schemas where direct access by `authenticated` and `anon` roles is completely revoked.
- **Transactional Advisory Locking & Audit Access:** Mutation gateways require calling `pg_advisory_xact_lock` and inserting into `audit.events`. Direct table privileges for `authenticated` users would bypass row-level immutability triggers, concurrency controls, and fail-closed tenant validation.
- **Fail-Closed Context Mediation:** If routines were marked `SECURITY INVOKER`, end-user database sessions would require broad table-level `INSERT`/`UPDATE` grants on security metadata, introducing severe multi-tenant data exfiltration and privilege escalation vulnerabilities. Elevating privileges inside the bounded RPC gateway ensures that operations execute strictly within the verified bounds of caller tenancy, verified membership, and required permissions.

### 3.4 Risk Assessment & Compensating Controls
- **Risk:** Malicious authenticated users attempting privilege escalation or cross-tenant role assignments.
- **Compensating Controls:**
  1. **Strict Context & Membership Anchor:** Every routine takes `p_context_id`, resolves caller identity via `auth.uid()`, and verifies active membership within the specified workspace.
  2. **Explicit Ordered `search_path`:** Every routine specifies a fixed, ordered search path (`pg_catalog, platform, identity, portfolio, [audit, extensions,] app_private`), completely neutralizing search-path hijacking attacks.
  3. **Mandatory AAL2 MFA for Mutations:** All nine mutation operations strictly assert `auth.jwt()->>'aal' = 'aal2'`. Unauthenticated or single-factor sessions cannot mutate roles, bindings, or assignments. The read gateway `get_workspace_roles_v1` requires authenticated membership under standard AAL1 without MFA step-up.
  4. **Optimistic Concurrency & Advisory Locks for Mutations:** Concurrency contention during mutations raises SQLSTATE `40001` (`workspace_role_expected_lock_version_conflict`), preventing race conditions. The read gateway performs snapshot reads without locks or version checks.
  5. **Mandatory Audit Reasons for Mutations:** Parameter `p_reason` is strictly validated (5–500 characters after `trim`) and permanently recorded with before/after state in `audit.events` for all nine mutation gateways. The read gateway performs read-only projection without taking `p_reason` or emitting mutation audit events.
  6. **Zero Physical Deletion:** Published roles, member assignments, and binding histories are protected by strict production triggers that reject `DELETE` operations with SQLSTATE `42501`.

---

## 4. Six Accepted Deny-by-Default RLS Tables Catalog

| Table Name | RLS Status | Actual Database Grants | Direct Policies for `anon` / `authenticated` | Direct Client Access | Mediation Gateway |
| :--- | :---: | :--- | :---: | :---: | :--- |
| `platform.module_permission_bindings` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | Controlled via Migration 103 Seeding |
| `platform.workspace_roles` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | `customer_api.*workspace_role*_v1` |
| `platform.workspace_role_modules` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | `attach`/`detach_workspace_role_module_v1` |
| `platform.workspace_role_permissions` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | `attach`/`detach_workspace_role_permission_v1` |
| `platform.workspace_member_roles` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | `assign`/`revoke_workspace_role_assignment_v1` |
| `platform.workspace_role_idempotency` | `ENABLE ROW LEVEL SECURITY` | `postgres` (ALL), `service_role` (SELECT, INSERT, UPDATE, DELETE) | None (0 policies) | Completely Blocked | Internal Gateway Idempotency Engine |

- **Security Rationale & Deny-by-Default Architecture:**
  1. **Row Level Security Enabled:** Every table has Row Level Security enabled via explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
  2. **Zero Policies for Client Roles:** Exactly zero policies are defined for `anon` or `authenticated` roles in `pg_policies`.
  3. **Explicit Revocations:** Explicit `REVOKE ALL` from `public`, `anon`, and `authenticated` is enforced on all six tables.
  4. **Strict RPC Mediation:** Client access is mediated exclusively through controlled, validated `customer_api` RPC gateways. Direct access via PostgREST or client SDKs fails closed with empty results or permission denied.

---

## 5. Final Disposition Statement

All 16 findings (10 `SECURITY DEFINER` gateways and 6 deny-by-default RLS tables) introduced in Migration 103 on Supabase Linked Production are thoroughly documented, rigorously controlled, and formally accepted:
- **Ten (10) `customer_api` RPC Gateways (1 Read + 9 Mutations):** **`ACCEPTED-CONTROLLED-EXCEPTION`**
- **Six (6) `platform` Relational Tables:** **`ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL`**

Zero unexpected security advisor findings exist. Zero trigger bypasses exist.
