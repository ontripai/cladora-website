# Security Advisor Exception Register — Workspace-Local Roles & Permissions (001B.1)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-SECURITY-ADVISOR-v1.0`  
**Security Lead / Owner:** CLADORA Architecture & Security Working Group  
**Status:** `PROPOSED-CONTROLLED-EXCEPTION`  
**Baseline Date:** 2026-09-18  
**Reference Branch:** `feat/cladora-workspace-local-roles-001b1`  
**Reference Migration:** `supabase/migrations/20260918120000_workspace_local_roles_permissions.sql` (Migration 103)  
**Reference Test:** `supabase/tests/090_workspace_local_roles.test.sql` (Test 090)  
**Target Environment:** Local / Ephemeral CI (Remote Apply Strictly NOT Authorized in 001B.1)  

---

## 1. Executive Summary & Authoritative Statement

This register logs the formal security exceptions and architectural controls for the database objects introduced in Migration 103 (`20260918120000_workspace_local_roles_permissions.sql`) under package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1`.

Because remote application is not authorized during this implementation phase, all findings cataloged herein are assigned the status **`PROPOSED-CONTROLLED-EXCEPTION`** or **`PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL`**. Upon subsequent authorized remote application and production verification, these items will transition to `ACCEPTED`.

The findings represent intentional, proven architectural patterns:
1. **Ten (10) Proposed `WARN` findings (`0029_authenticated_security_definer_function_executable`):** Ten controlled `customer_api` RPC functions exposed to authenticated sessions with internal fail-closed context resolution, tenant isolation, explicit ordered search paths, permission checks (`workspace.role.read`, `workspace.role.manage`, `workspace.role.publish`, `workspace.role.assign`), and AAL2 step-up validation for all mutation RPCs.
2. **Six (6) Proposed `INFO` findings (`0008_rls_enabled_no_policy`):** Six core workspace role and binding tables with Row Level Security enabled. Direct access by `anon` and `authenticated` roles is completely denied via explicit `REVOKE ALL` and zero client-facing policies; client application access is mediated exclusively through audited `customer_api` gateways. Internal maintenance and administrative operations are governed by minimal `service_role` grants.
3. **Internal Helper Function:** `app_private.check_effective_permission_v1` is `SECURITY DEFINER`, with fixed search_path `pg_catalog, platform, identity, portfolio, app_private`, and is completely revoked from `public`, `anon`, and `authenticated`.

---

## 2. Proposed Security Advisor Findings Inventory

### 2.1 Ten (10) Proposed Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSROLES-ADV-WARN-001` | `customer_api.get_workspace_roles_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-002` | `customer_api.create_workspace_role_draft_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-003` | `customer_api.attach_workspace_role_module_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-004` | `customer_api.detach_workspace_role_module_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-005` | `customer_api.attach_workspace_role_permission_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-006` | `customer_api.detach_workspace_role_permission_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-007` | `customer_api.snapshot_workspace_role_template_permissions_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-008` | `customer_api.publish_workspace_role_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-009` | `customer_api.assign_workspace_role_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSROLES-ADV-WARN-010` | `customer_api.revoke_workspace_role_assignment_v1(...)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |

### 2.2 Six (6) Proposed Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSROLES-ADV-INFO-001` | `platform.module_permission_bindings` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-002` | `platform.workspace_roles` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-003` | `platform.workspace_role_modules` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-004` | `platform.workspace_role_permissions` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-005` | `platform.workspace_member_roles` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSROLES-ADV-INFO-006` | `platform.workspace_role_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Security Matrix for Workspace Role RPCs

| Attribute | Read RPC (`get_workspace_roles_v1`) | Mutation RPCs (9 Gateways) |
| :--- | :--- | :--- |
| **Real Function Owner** | `postgres` | `postgres` |
| **Security Context** | `SECURITY DEFINER` | `SECURITY DEFINER` |
| **Real Volatility** | `STABLE` | `VOLATILE` |
| **Real Ordered search_path** | `pg_catalog, platform, identity, portfolio, app_private` | `pg_catalog, platform, identity, portfolio, audit, extensions, app_private` |
| **EXECUTE Granted** | `authenticated, service_role` | `authenticated, service_role` |
| **Revoked Roles** | `public, anon` | `public, anon` |
| **AAL2 Step-Up Check** | N/A (read-only) | Mandatory: Enforced via `auth.jwt()->>'aal' = 'aal2'` |
| **Advisory Transaction Lock** | N/A | Mandatory per entity/action |
| **Idempotency Check** | N/A | Mandatory via `platform.workspace_role_idempotency` |
| **Audit Event Emission** | N/A | Mandatory in `audit.events` |

---

## 4. Final Disposition Statement

All 16 findings introduced in Migration 103 are documented under status **`PROPOSED-CONTROLLED-EXCEPTION`** or **`PROPOSED-DENY-BY-DEFAULT-INFORMATIONAL`**. No remote mutations or unauthorized grants have been executed.
