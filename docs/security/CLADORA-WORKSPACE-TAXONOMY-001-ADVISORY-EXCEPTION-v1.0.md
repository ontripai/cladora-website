# CLADORA-WORKSPACE-TAXONOMY-001 — Security Advisory Exception Register v1.0

**Document ID:** `CLADORA-SEC-ADV-TAXONOMY-001-v1.0`  
**Classification:** `ACCEPTED-CONTROLLED-ADVISORY-EXCEPTIONS`  
**Reference Migration:** `supabase/migrations/20260915120000_workspace_taxonomy.sql` (Migration 100)  
**Reference Acceptance Test:** `supabase/tests/087_workspace_taxonomy.test.sql` (Test 087)  
**Supabase Production Ref:** `jyomlehahwlyqzoacrvp`  
**Merged PR:** [#98](https://github.com/ontripai/cladora-website/pull/98) (`feat/cladora-workspace-taxonomy-001` merged at commit `a6fd3f57e55b69ebdd9962de2a4d64dc9b1d1a04`)  
**Review Date:** 2026-09-16  
**Security Lead / Owner:** CLADORA Architecture & Security Working Group
**Review Status:** Formal Post-Release Security Exception Document  

---

## 1. Purpose and Scope

This document establishes the authoritative security exception register and post-release risk evaluation for `CLADORA-WORKSPACE-TAXONOMY-001`.

During post-release operational review against the live Supabase production project (`jyomlehahwlyqzoacrvp`), the automated Supabase Database Linter / Security Advisor flagged eleven (11) advisory findings on schema objects introduced by Migration 100:
- **Seven (7) `INFO` findings:** `rls_enabled_no_policy`
- **Four (4) `WARN` findings:** `authenticated_security_definer_function_executable`

This document records the exact findings, technical controls, authorization proof, residual risk analysis, and formal acceptance rationale.

> [!IMPORTANT]
> **Zero Finding Suppression Statement:**  
> No security finding was deleted, hidden, or falsely marked cleared. The earlier closure report summary noting "zero warnings" reflected plpgsql syntax and runtime advisor checks (`supabase db lint --level warning`), whereas the Supabase Database Linter policy-level advisor reports eleven findings. These eleven findings are acknowledged in full and cataloged herein as deliberate, controlled architectural exceptions (`ACCEPTED-CONTROLLED-ADVISORY-EXCEPTIONS`).

---

## 2. Production & Schema Baseline Reference

- **Target Database:** Supabase Cloud Project `jyomlehahwlyqzoacrvp`
- **Migration Sequence:** Migration 100 of 100 (`20260915120000_workspace_taxonomy.sql`)
- **Local vs Remote Alignment:** 100 Local / 100 Remote / 0 Drift
- **pgTAP Test Suite:** 87 tests / 2825 assertions passing (Test 087: 55/55 assertions)
- **Controlled Scope:** Taxonomy registries (`platform.property_profiles`, `platform.operating_models`, `platform.space_kinds`), compatibility matrices (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`), tenant binding containers (`platform.workspace_taxonomy_assignments`, `platform.workspace_property_bindings`), and four read-only gateway routines in `customer_api`.

---

## 3. Exact Supabase Security Advisor Findings Catalog

### 3.1 Seven (7) INFO Findings — `rls_enabled_no_policy`

| Exception ID | Target Table | Severity | Supabase Linter Rule | Remediation Guidance | Disposition |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `WSTAX-ADV-INFO-001` | `platform.property_profiles` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-002` | `platform.operating_models` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-003` | `platform.space_kinds` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-004` | `platform.property_operating_model_compatibilities` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-005` | `platform.property_space_kind_compatibilities` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-006` | `platform.workspace_taxonomy_assignments` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |
| `WSTAX-ADV-INFO-007` | `platform.workspace_property_bindings` | `INFO` | `rls_enabled_no_policy` | [0008_rls_enabled_no_policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-INTENTIONAL-DENY** |

### 3.2 Four (4) WARN Findings — `authenticated_security_definer_function_executable`

| Exception ID | Target Function Signature | Severity | Supabase Linter Rule | Remediation Guidance | Disposition |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `WSTAX-ADV-WARN-001` | `customer_api.get_workspace_taxonomy_v1(p_context_id uuid)` | `WARN` | `authenticated_security_definer_function_executable` | [0029_authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-GATEWAY** |
| `WSTAX-ADV-WARN-002` | `customer_api.list_taxonomy_profiles_v1(p_context_id uuid)` | `WARN` | `authenticated_security_definer_function_executable` | [0029_authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-GATEWAY** |
| `WSTAX-ADV-WARN-003` | `customer_api.list_taxonomy_operating_models_v1(p_context_id uuid)` | `WARN` | `authenticated_security_definer_function_executable` | [0029_authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-GATEWAY** |
| `WSTAX-ADV-WARN-004` | `customer_api.list_taxonomy_space_kinds_v1(p_context_id uuid)` | `WARN` | `authenticated_security_definer_function_executable` | [0029_authenticated_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-GATEWAY** |

---

## 4. Technical Controls & Evidence

### 4.1 Deny-By-Default RLS Posture (`WSTAX-ADV-INFO-001` through `007`)

The seven tables intentionally have RLS enabled with zero client-facing permissive policies:
1. **Explicit Table-Level Revocation:**
   ```sql
   revoke all on platform.property_profiles from public, anon, authenticated;
   revoke all on platform.operating_models from public, anon, authenticated;
   revoke all on platform.space_kinds from public, anon, authenticated;
   revoke all on platform.property_operating_model_compatibilities from public, anon, authenticated;
   revoke all on platform.property_space_kind_compatibilities from public, anon, authenticated;
   revoke all on platform.workspace_taxonomy_assignments from public, anon, authenticated;
   revoke all on platform.workspace_property_bindings from public, anon, authenticated;
   ```
2. **Minimal Service Role Grants:**
   Only `service_role` is granted table permissions (`select, insert, update, delete`). Clients cannot issue `SELECT` or mutation queries against `platform.*` directly via PostgREST Data API.
3. **Architectural Rationale:**
   Under CLADORA domain boundary rules, platform core registries must never be exposed for ad-hoc client querying. Any query bypassing the contextual RPC layer would bypass tenant membership and contextual tenancy boundaries. Leaving RLS enabled without permissive policies guarantees strict PostgreSQL deny-by-default behavior.

### 4.2 Controlled Authenticated RPC Gateways (`WSTAX-ADV-WARN-001` through `004`)

All four `customer_api` routines document the controls supporting the accepted low-risk advisory decision:

#### Privilege & Execution Matrix
| Function | `SECURITY DEFINER` | `anon` Execute | `authenticated` Execute | `service_role` Execute | Explicit Fixed `search_path` | Volatility | Row-lock clauses |
| :--- | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| `customer_api.get_workspace_taxonomy_v1` | `true` | `false` | `true` | `true` | `pg_catalog, platform, identity, portfolio, app_private` | `STABLE` | none |
| `customer_api.list_taxonomy_profiles_v1` | `true` | `false` | `true` | `true` | `pg_catalog, platform, identity, app_private` | `STABLE` | none |
| `customer_api.list_taxonomy_operating_models_v1` | `true` | `false` | `true` | `true` | `pg_catalog, platform, identity, app_private` | `STABLE` | none |
| `customer_api.list_taxonomy_space_kinds_v1` | `true` | `false` | `true` | `true` | `pg_catalog, platform, identity, app_private` | `STABLE` | none |

#### Mandatory Security Controls Enforced in Function Bodies:
1. **Authoritative Authentication Check:**
   Every routine begins by asserting `auth.uid()`:
   ```sql
   if auth.uid() is null then
     raise exception 'authentication_required' using errcode = '42501';
   end if;
   ```
   Anonymous calls are rejected immediately before any table query.
2. **Context Grant & Membership Validation:**
   Every routine joins `identity.context_grants` with `identity.memberships` verifying:
   - `m.user_id = auth.uid()`
   - `m.status = 'active'`
   - `m.tenant_id = g.tenant_id`
   - Temporal validity: `m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())`
   - Context validity: `g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp())`
   If unverified, throws `customer_context_access_denied` (`42501`).
3. **Fixed Immutable Search Path:**
   All functions specify explicit `set search_path = pg_catalog, ...` preventing search-path hijacking attacks.
4. **Zero Client Mutation & Non-Custodial Isolation:**
   None of these routines perform `INSERT`, `UPDATE`, or `DELETE` on platform state. No financial ledger side-effects, no journal entries, no credentials exposure, and no sensitive personal data are emitted.
5. **Deterministic Fail-Closed Context Resolution:**
   In `customer_api.get_workspace_taxonomy_v1`, if a property has zero bindings, it returns `{ "has_assignment": false, "status": "binding_required", "workspace_id": null }` with zero data leakage. If a tenant has multiple workspaces without property scoping, it raises `workspace_taxonomy_context_not_workspace_bound` (`42501`) rather than nondeterministically guessing.

---

## 5. Residual Risk Assessment

| Finding Class | Evaluated Risk | Mitigation / Control | Residual Risk Level |
| :--- | :--- | :--- | :---: |
| `rls_enabled_no_policy` (7 tables) | Unintended client denial | By design. Client access is strictly routed through RPC gateways. No raw table exposure is permitted. | **NEGLIGIBLE** |
| `authenticated_security_definer_function_executable` (4 RPCs) | Unauthorized data access or privilege elevation | `auth.uid()` gate, active tenant membership join, active context grant validation, explicit search path, and read-only semantics. | **LOW (ACCEPTABLE)** |

---

## 6. Formal Acceptance Rationale & Policy

1. **Deny-by-default posture (`WSTAX-ADV-INFO-001` - `007`):**  
   Accepted as standard defense-in-depth practice for backend registries and relation mappings. Creating superficial permissive policies would defeat tenant containment.
2. **Controlled authenticated read gateways (`WSTAX-ADV-WARN-001` - `004`):**  
   Accepted because `SECURITY DEFINER` is required to read underlying `platform` tables from which `authenticated` has been revoked, but access is locked behind multi-layered membership and context authorization checks.
3. **Non-Inheritance Rule:**  
   This acceptance applies **strictly** to the four read-only taxonomy RPCs. Any future mutation RPC (`create_*`, `bind_*`, `assign_*`) must undergo an independent security review and cannot inherit this acceptance.

---

## 7. Re-Review Triggers

This exception register is automatically invalidated and requires immediate security re-review upon any of the following events:
1. Any modification to function ownership (`ALTER FUNCTION ... OWNER TO ...`).
2. Any modification to function privileges (`GRANT EXECUTE ... TO anon` or public).
3. Any modification to `search_path` on any `customer_api` or `app_private` taxonomy routine.
4. Introduction of any DML / mutation logic inside `customer_api.get_workspace_taxonomy_v1` or list RPCs.
5. Any change in the authorization schema (`identity.context_grants`, `identity.memberships`).
6. Introduction of client-facing permissive RLS policies on the seven `platform.*` tables without architectural sign-off.

---

## 8. References & Standards

- [Supabase Database Linter — RLS Enabled No Policy (`0008_rls_enabled_no_policy`)](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Supabase Database Linter — Authenticated Security Definer Function Executable (`0029_authenticated_security_definer_function_executable`)](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [CLADORA Architecture Decision Record — ADR-CLD-052](../architecture/ADR-CLD-052-universal-managed-property-workspaces.md)
- [CLADORA Security Advisory Closure Register — Migration 93](../CLADORA-P2-SEC-ADVISORY-001.md)
- [CLADORA Workspace Taxonomy Closure Report v1.0 (R5)](../closure/CLADORA-WORKSPACE-TAXONOMY-001-CLOSURE-v1.0.md)
