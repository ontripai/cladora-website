# Security Advisor Exception Register — Workspace Taxonomy Mutation Gateway (v1.0)

**Document Identifier:** `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0`  
**Security Lead / Owner:** CLADORA Architecture & Security Working Group  
**Status:** `PROPOSED-CONTROLLED-EXCEPTION` (Pending Independent Codex Security Review)  
**Baseline Date:** 2026-09-17  
**PR:** #100 (`ontripai/cladora-website`)  

---

## 1. Executive Summary

During the implementation of `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001` (Migration 101), the transactional mutation gateway and its accompanying catalog options RPC were implemented in `customer_api`:
1. `customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)`
2. `customer_api.get_taxonomy_catalog_options_v1(uuid)`
3. `customer_api.get_workspace_taxonomy_v1(uuid)` (forward delta update for canonical `country_code` return)

These functions are defined as `SECURITY DEFINER` and granted to `authenticated` and `service_role`. This document registers the Supabase Database Linter findings:
- `0029_authenticated_security_definer_function_executable`
under status **`PROPOSED-CONTROLLED-EXCEPTION`**. In accordance with security protocol, final acceptance is strictly deferred until formal Codex architecture and security review.

---

## 2. Advisory Finding Register & Delta

| Finding ID | Object Name | Severity | Rule ID | Documentation Reference | Architectural Disposition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `WSTAX-ADV-WARN-005` | `customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)` | `WARN` | `0029_authenticated_security_definer_function_executable` | [Database Linter Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-006` | `customer_api.get_taxonomy_catalog_options_v1(uuid)` | `WARN` | `0029_authenticated_security_definer_function_executable` | [Database Linter Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-001` (delta) | `customer_api.get_workspace_taxonomy_v1(uuid)` | `WARN` | `0029_authenticated_security_definer_function_executable` | [Database Linter Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **PROPOSED-CONTROLLED-EXCEPTION** |

---

## 3. Detailed Security Profile of RPCs

### 3.1 `customer_api.assign_workspace_taxonomy_v1`
- **Owner:** `postgres`
- **Volatility:** `VOLATILE`
- **Security Context:** `SECURITY DEFINER`
- **Search Path:** Fixed strictly to `pg_catalog, platform, identity, portfolio, audit, app_private`
- **Grants:** `EXECUTE` granted to `authenticated, service_role`
- **Revocations:** `REVOKE ALL` from `public, anon`
- **Privilege Escape Analysis:**
  - Zero dynamic SQL (`EXECUTE ...` is not used; all queries use parameterized static DML).
  - Explicit caller authentication check: `if auth.uid() is null then raise exception 'authentication_required'; end if;`
  - Mandatory AAL2 verification: `if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then raise exception 'mfa_required'; end if;`
  - Fail-closed context authorization: validates active membership and active context grant matching caller's `auth.uid()`.
  - Scoped permission check: requires `identity.role_permissions` granting `workspace.taxonomy.manage`.
  - Tenant boundary isolation: context resolution is fail-closed, requiring explicit property/building/unit binding. Tenant-only fallback is rejected.
  - Zero cross-tenant data leakage: target workspace and audit records are bound strictly to caller's verified membership tenant.

### 3.2 `customer_api.get_taxonomy_catalog_options_v1`
- **Owner:** `postgres`
- **Volatility:** `STABLE`
- **Security Context:** `SECURITY DEFINER`
- **Search Path:** Fixed strictly to `pg_catalog, platform, identity, app_private`
- **Grants:** `EXECUTE` granted to `authenticated, service_role`
- **Revocations:** `REVOKE ALL` from `public, anon`
- **Privilege Escape Analysis:**
  - Requires valid authenticated session (`auth.uid() is not null`).
  - Requires active customer context grant and active membership.
  - Read-only queries against public platform taxonomy catalogs (`property_profiles`, `operating_models`, `compatibilities`).
  - Exposes zero tenant secrets, zero customer data, zero credential hashes.

### 3.3 `customer_api.get_workspace_taxonomy_v1`
- **Owner:** `postgres`
- **Volatility:** `STABLE`
- **Security Context:** `SECURITY DEFINER`
- **Search Path:** Fixed strictly to `pg_catalog, platform, identity, portfolio, app_private`
- **Grants:** `EXECUTE` granted to `authenticated, service_role`
- **Revocations:** `REVOKE ALL` from `public, anon`
- **Privilege Escape Analysis:**
  - Delta update forward to return canonical `country_code` stored in `platform.workspace_taxonomy_assignments`.
  - Retains all existing security definer boundaries, tenant isolation, and unconfigured response protections established in Migration 100.

---

## 4. Why SECURITY DEFINER is Architecturally Mandatory

1. **Deny-by-Default Foundation:** All underlying tables (`platform.workspace_taxonomy_assignments`, `platform.workspace_taxonomy_idempotency`, `audit.events`) have RLS enabled and direct DML permissions completely revoked from `public, anon, authenticated`.
2. **Inadmissibility of SECURITY INVOKER:** If these routines were executed as `SECURITY INVOKER`, the client role `authenticated` would require direct table `INSERT` and `UPDATE` privileges on `platform.workspace_taxonomy_assignments` and `audit.events`. This would violate the repository's core security model by permitting unmediated client writes.
3. **Compensating Controls:** All authorization, AAL2 elevation, tenant matching, idempotency matching, and concurrency locking are evaluated inside the security definer function before any write occurs.

---

## 5. Review & Approval Protocol

- **Current Status:** `PROPOSED-CONTROLLED-EXCEPTION`
- **Next Step:** Formal review and sign-off by Codex Architecture Review before any remote application or PR merge.
