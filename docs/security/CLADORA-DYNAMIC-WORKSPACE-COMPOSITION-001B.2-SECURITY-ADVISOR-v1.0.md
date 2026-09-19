# Security Advisor Exception Register — Workspace Delegation & Four-Eyes Control (001B.2)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2-SECURITY-ADVISOR-v1.0`  
**Security Lead / Owner:** CLADORA Architecture & Security Working Group  
**Status:** `ACCEPTED-CONTROLLED-EXCEPTION`  
**Baseline Date:** 2026-09-19  
**Merged Pull Request:** PR [#106](https://github.com/ontripai/cladora-website/pull/106) via Squash Commit [`f6e8e2cf096fdab0bfe0526710c6e9994c0ff242`](https://github.com/ontripai/cladora-website/commit/f6e8e2cf096fdab0bfe0526710c6e9994c0ff242)  
**Reference Migration:** `supabase/migrations/20260919120000_workspace_delegations_approvals.sql` (Migration 104)  
**Reference Test:** `supabase/tests/091_workspace_delegations.test.sql` (Test 091)  
**Target Environment:** Supabase Linked Production (`jyomlehahwlyqzoacrvp`) (Migration 104 Applied / Remote 104 / Drift 0 / Production Verified)  

---

## 1. Executive Summary & Authoritative Statement

This register documents the formal security exceptions, architectural risk assessments, and compensating controls for database objects introduced in Migration 104 (`20260919120000_workspace_delegations_approvals.sql`) under package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2`.

Following the authorized remote application to Supabase Linked Production, verification of zero schema drift (`Local 104 / Remote 104 / Drift 0`), confirmation of zero blocking queries and zero ungranted locks, and successful automated CI/CD pipeline execution on `main`, all exceptions cataloged herein have been formally audited and assigned the authoritative status **`ACCEPTED-CONTROLLED-EXCEPTION`** or **`ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL`**.

The cataloged findings represent proven, deliberate, and hardened multi-tenant security patterns:
1. **Eight (8) Accepted `WARN` Findings (`0029_authenticated_security_definer_function_executable`):** Exactly eight controlled `customer_api` RPC functions exposed to authenticated sessions, strictly partitioned into:
   - **One (1) Read RPC Gateway (`customer_api.get_workspace_delegations_v1`):** Marked `STABLE`, validates caller workspace membership and context under AAL1 (no AAL2 required), projects delegation and approval records without requiring idempotency keys or emitting mutation audit events.
   - **Seven (7) Mutation RPC Gateways:** Marked `VOLATILE`, enforce mandatory AAL2 MFA step-up (`auth.jwt()->>'aal' = 'aal2'`), validate dedicated permissions or caller identity constraints, execute transactional advisory locking, perform versioned optimistic concurrency checks raising SQLSTATE `40001`, require versioned idempotency keys, and atomically record domain audit events in `audit.events`.
2. **Four (4) Accepted `INFO` Findings (`0008_rls_enabled_no_policy`):** Exactly four core workspace delegation, permission attachment, independent approval, and idempotency tables in the `platform` schema with Row Level Security enabled via `ENABLE ROW LEVEL SECURITY`. Direct access by `anon` and `authenticated` roles is completely denied via explicit `REVOKE ALL` from `public`, `anon`, and `authenticated`, with zero client-facing policies. Client application access is mediated exclusively through audited `customer_api` gateways. Internal maintenance and administrative operations are governed by minimal, non-permissive `service_role` grants.
3. **Internal Helper Functions:** Internal authorization engine helpers (`app_private.check_direct_effective_permission_v1` and `app_private.check_effective_permission_v1`) are `SECURITY DEFINER`, with fixed ordered `search_path`, and are completely revoked from `public`, `anon`, and `authenticated`.
4. **Relational Anti-Self-Approval:** The database enforces relational constraints preventing grantors from accepting their own delegations or approving their own grants (`approver_membership_id <> grantor_membership_id`).
5. **Zero Trigger Bypass:** The database contains zero backdoor session settings, zero operational cleanup overrides, and zero `session_replication_role` bypasses. All historical and invariant triggers remain strictly non-negotiable.

---

## 2. Accepted Security Advisor Findings Inventory

### 2.1 Eight (8) Accepted Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSDEL-ADV-WARN-001` | `customer_api.get_workspace_delegations_v1(p_context_id uuid, p_status_filter text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-002` | `customer_api.create_workspace_delegation_draft_v1(p_context_id uuid, p_grantee_membership_id uuid, p_scope_type text, p_property_id uuid, p_building_id uuid, p_unit_id uuid, p_valid_from timestamptz, p_valid_until timestamptz, p_purpose text, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-003` | `customer_api.attach_workspace_delegation_permission_v1(p_context_id uuid, p_delegation_id uuid, p_module_definition_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-004` | `customer_api.detach_workspace_delegation_permission_v1(p_context_id uuid, p_delegation_id uuid, p_module_definition_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-005` | `customer_api.submit_workspace_delegation_v1(p_context_id uuid, p_delegation_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-006` | `customer_api.accept_workspace_delegation_v1(p_context_id uuid, p_delegation_id uuid, p_decision text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-007` | `customer_api.approve_workspace_delegation_v1(p_context_id uuid, p_delegation_id uuid, p_decision text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSDEL-ADV-WARN-008` | `customer_api.revoke_workspace_delegation_v1(p_context_id uuid, p_delegation_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |

### 2.2 Four (4) Accepted Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSDEL-ADV-INFO-001` | `platform.workspace_delegations` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSDEL-ADV-INFO-002` | `platform.workspace_delegation_permissions` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSDEL-ADV-INFO-003` | `platform.workspace_delegation_approvals` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSDEL-ADV-INFO-004` | `platform.workspace_delegation_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Technical Catalog & Security Matrix

### 3.1 Eight `SECURITY DEFINER` Gateway Specifications

| Function Name | Complete Signature | Real Owner | Real Volatility | Real Ordered `search_path` | Granted Roles | Revoked Roles |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| `get_workspace_delegations_v1` | `(p_context_id uuid, p_status_filter text)` | `postgres` | `STABLE` | `pg_catalog, platform, identity, portfolio, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `create_workspace_delegation_draft_v1` | `(p_context_id uuid, p_grantee_membership_id uuid, p_scope_type text, p_property_id uuid, p_building_id uuid, p_unit_id uuid, p_valid_from timestamptz, p_valid_until timestamptz, p_purpose text, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `attach_workspace_delegation_permission_v1` | `(p_context_id uuid, p_delegation_id uuid, p_module_definition_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `detach_workspace_delegation_permission_v1` | `(p_context_id uuid, p_delegation_id uuid, p_module_definition_id uuid, p_permission_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `submit_workspace_delegation_v1` | `(p_context_id uuid, p_delegation_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `accept_workspace_delegation_v1` | `(p_context_id uuid, p_delegation_id uuid, p_decision text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `approve_workspace_delegation_v1` | `(p_context_id uuid, p_delegation_id uuid, p_decision text, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |
| `revoke_workspace_delegation_v1` | `(p_context_id uuid, p_delegation_id uuid, p_expected_lock_version integer, p_reason text, p_idempotency_key text)` | `postgres` | `VOLATILE` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` | `authenticated, service_role, postgres` | `public, anon` |

### 3.2 Security Controls & Compensating Architecture

| Gateway Routine | Type & Volatility | Required Permission | AAL2 MFA Enforced | Context & Tenant Isolation | Concurrency & Idempotency | Audit Logging |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `get_workspace_delegations_v1` | Read (`STABLE`) | `workspace.delegation.read` | No (AAL1 Read) | Caller membership required; scopes projection strictly to caller tenant and workspace. | Read snapshot projection (no lock, no idempotency). | N/A (Read-only query) |
| `create_workspace_delegation_draft_v1` | Mutation (`VOLATILE`) | `workspace.delegation.manage` | Yes (`aal2`) | Validates caller membership; ensures grantee belongs to same tenant; validates scope ancestry. | Advisory lock on creation hash, idempotency replay check (`22023` on mismatch). | Writes `WORKSPACE_DELEGATION_CREATED` to `audit.events`. |
| `attach_workspace_delegation_permission_v1` | Mutation (`VOLATILE`) | `workspace.delegation.manage` | Yes (`aal2`) | Validates draft status; enforces delegable v2 binding; enforces grantor ceiling; blocks 6 sensitive permissions. | Transactional advisory lock, checks `expected_lock_version` (`40001`), idempotency replay. | Writes `WORKSPACE_DELEGATION_PERMISSION_ATTACHED` to `audit.events`. |
| `detach_workspace_delegation_permission_v1` | Mutation (`VOLATILE`) | `workspace.delegation.manage` | Yes (`aal2`) | Enforces draft status; ensures permission is attached; updates lock version. | Transactional advisory lock, checks `expected_lock_version` (`40001`), idempotency replay. | Writes `WORKSPACE_DELEGATION_PERMISSION_DETACHED` to `audit.events`. |
| `submit_workspace_delegation_v1` | Mutation (`VOLATILE`) | `workspace.delegation.manage` | Yes (`aal2`) | Requires >= 1 attached permission; computes canonical SHA-256 payload hash; assigns approval policy. | Advisory lock, checks `expected_lock_version` (`40001`), pre-creates approval record, idempotency replay. | Writes `WORKSPACE_DELEGATION_SUBMITTED` to `audit.events`. |
| `accept_workspace_delegation_v1` | Mutation (`VOLATILE`) | Grantee membership | Yes (`aal2`) | Caller must be the designated grantee; grantor cannot accept; validates payload hash integrity. | Advisory lock, checks `expected_lock_version` (`40001`), dual outcome (`accept`/`reject`), idempotency replay. | Writes `WORKSPACE_DELEGATION_ACCEPTED` or `WORKSPACE_DELEGATION_REJECTED`. |
| `approve_workspace_delegation_v1` | Mutation (`VOLATILE`) | `workspace.delegation.approve` | Yes (`aal2`) | Four-Eyes enforcement: caller must not be grantor or grantee; validates policy role requirements (`single_manager`/`dual_approval`). | Advisory lock, checks `expected_lock_version` (`40001`), dual outcome (`approve`/`reject`), idempotency replay. | Writes `WORKSPACE_DELEGATION_APPROVED` or `WORKSPACE_DELEGATION_REJECTED`. |
| `revoke_workspace_delegation_v1` | Mutation (`VOLATILE`) | `workspace.delegation.revoke` or Grantor | Yes (`aal2`) | Caller must be original grantor or authorized administrator; immediate fail-safe revocation without dual approval. | Advisory lock, checks `expected_lock_version` (`40001`), idempotency replay. | Writes `WORKSPACE_DELEGATION_REVOKED` to `audit.events`. |

### 3.3 Technical Justification for `SECURITY DEFINER`
- **Deny-by-Default Table Architecture:** The underlying relational tables (`platform.workspace_delegations`, `platform.workspace_delegation_permissions`, `platform.workspace_delegation_approvals`, `platform.workspace_delegation_idempotency`) reside in private schemas where direct access by `authenticated` and `anon` roles is completely revoked.
- **Transactional Advisory Locking & Audit Access:** Mutation gateways invoke `pg_advisory_xact_lock` and insert immutable audit records into `audit.events`. Direct table DML privileges for `authenticated` users would bypass anti-self-approval constraints, approval workflows, and fail-closed tenant validation.
- **Fail-Closed Context Mediation:** Bounded RPC gateways guarantee that all delegation lifecycle transitions execute strictly within verified tenant boundaries, validated grantor authorities, and enforced Four-Eyes approval policies.

---

## 4. Known Benign PL/pgSQL Compiler Notices

Three compiler notices of type `variable ... is assigned but never read` were registered during compilation of Migration 104:
1. `v_binding` in `app_private.check_direct_effective_permission_v1` (lines 706, 819).
2. `v_target_building_id` in `customer_api.create_workspace_delegation_draft_v1` (lines 1403, 1484, 1497).
3. `v_target_unit_id` in `customer_api.create_workspace_delegation_draft_v1` (lines 1404, 1498).

**Classification:** **Benign PL/pgSQL Compiler Notices / SQLSTATE 00000**.  
These variables do not alter transaction semantics, access control, or authorization decisions. They will be cleaned up in the next scheduled refactoring.

---

## 5. Traceability & Sign-Off

- **Security Lead:** CLADORA Architecture & Security Working Group
- **Disposition:** All eight (8) `WARN` findings and four (4) `INFO` findings are formally accepted under controlled architectural compensating controls.
- **Final Security Verdict:** `ACCEPTED-CONTROLLED-EXCEPTION / ZERO-ERRORS / ZERO-SECURITY-FINDINGS-OUTSTANDING`.
