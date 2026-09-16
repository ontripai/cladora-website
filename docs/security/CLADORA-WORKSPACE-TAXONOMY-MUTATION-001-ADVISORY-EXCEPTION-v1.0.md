# Security Advisor Exception Register — Workspace Taxonomy Mutation Gateway (v1.0)

**Document Identifier:** `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0`  
**Security Lead / Owner:** CLADORA Architecture & Security Working Group  
**Target Function:** `customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)`  
**Scope:** Controlled mutation exception for `0029_authenticated_security_definer_function_executable`  
**Baseline Date:** 2026-09-16  

---

## 1. Executive Summary

During the implementation of `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001`, the mutation gateway RPC:
`customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)`
was implemented as `SECURITY DEFINER` and granted to `authenticated` and `service_role`.

This register evaluates the resulting Supabase Database Linter rule:
`0029_authenticated_security_definer_function_executable`
and documents the controls supporting the accepted low-risk advisory decision.

---

## 2. Advisory Finding Register

| Finding ID | Object Name | Severity | Rule ID | Documentation Reference | Architectural Disposition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `WSTAX-ADV-WARN-005` | `customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)` | `WARN` | `0029_authenticated_security_definer_function_executable` | [Database Linter Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-GATEWAY** |

---

## 3. Technical Evaluation & Compensating Controls

### Why SECURITY DEFINER is Mandatory
1. **Deny-by-Default Boundary:** The tables `platform.workspace_taxonomy_assignments`, `platform.workspace_taxonomy_idempotency`, and `audit.events` have RLS enabled and all privileges revoked from `public, anon, authenticated`.
2. **Elimination of Direct Client DML:** Clients operate under standard authenticated user JWTs and never possess direct table write privileges or `service_role` tokens.
3. **Inadmissibility of SECURITY INVOKER:** If this routine were changed to `SECURITY INVOKER`, the client role `authenticated` would require direct table `INSERT` and `UPDATE` privileges on `platform.workspace_taxonomy_assignments` and `audit.events`. This would completely dismantle the repository's deny-by-default architecture.

### Compensating Security Controls
- **Explicit Search Path:** `search_path = pg_catalog, platform, identity, portfolio, audit, app_private` prevents search path hijacking.
- **Authentication Check:** `if auth.uid() is null then raise exception 'authentication_required'; end if;`
- **Mandatory AAL2 (MFA):** Rejects any token lacking `aal2` (`mfa_required`).
- **Context & Membership Boundary:** Validates active membership and context grant matching the caller's `auth.uid()`.
- **Role & Permission Verification:** Requires explicit grant of `workspace.taxonomy.manage`.
- **Transactional Advisory Lock:** Prevents concurrent race conditions via workspace-scoped advisory locking.
- **Immutable Audit Logging:** Atomically records before/after snapshots in `audit.events`.
