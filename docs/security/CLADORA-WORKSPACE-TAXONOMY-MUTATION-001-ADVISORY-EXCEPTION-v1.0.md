# Security Advisor Exception Register — Workspace Taxonomy Mutation Gateway (v1.0)

**Document Identifier:** `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0`
**Security Lead / Owner:** CLADORA Architecture & Security Working Group
**Status:** `ACCEPTED-CONTROLLED-EXCEPTION`
**Baseline Date:** 2026-09-17
**PR:** #100 (Merged via commit `78e14045c6bd2079989f537be73d2cef3db75587`)
**Reference Migration:** `supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql` (Migration 101)
**Reference Test:** `supabase/tests/088_workspace_taxonomy_mutation.test.sql` (Test 088)
**Supabase Production Project Ref:** `jyomlehahwlyqzoacrvp`

---

## 1. Executive Summary & Authoritative Statement

This document records the formal acceptance and post-release risk register for the architectural exceptions identified by the Supabase Remote Database Linter / Security Advisor following the deployment of Migration 101 (`20260916120000_workspace_taxonomy_mutation.sql`).

> [!IMPORTANT]
> **Security Advisor Review Finding Statement:**
> Security Advisor reviewed: 6 controlled SECURITY DEFINER gateway warnings and 8 deny-by-default RLS informational findings remain. All findings are documented with explicit owners, access boundaries, fixed search paths and compensating controls. No unexpected new finding or privilege exposure was detected.

The findings represent intentional architectural design patterns:
1. **Six (6) `WARN` findings (`0029_authenticated_security_definer_function_executable`):** Six controlled `customer_api` RPC functions exposed to authenticated sessions with internal fail-closed authorization, tenant isolation, explicit search paths, and AAL2 step-up validation.
2. **Eight (8) `INFO` findings (`0008_rls_enabled_no_policy`):** Eight core relational and taxonomy container tables with Row Level Security enabled and zero client-facing permissive policies, enforcing strict PostgreSQL deny-by-default table isolation.

---

## 2. Remote Security Advisor Findings Inventory

### 2.1 Six (6) Accepted Authenticated Security Definer Gateways

| Finding ID | Target Function Signature | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSTAX-ADV-WARN-001` | `customer_api.get_workspace_taxonomy_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-002` | `customer_api.list_taxonomy_profiles_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-003` | `customer_api.list_taxonomy_operating_models_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-004` | `customer_api.list_taxonomy_space_kinds_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-005` | `customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |
| `WSTAX-ADV-WARN-006` | `customer_api.get_taxonomy_catalog_options_v1(uuid)` | `WARN` | `0029` | [Rule 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | **ACCEPTED-CONTROLLED-EXCEPTION** |

### 2.2 Eight (8) Deny-by-Default RLS Tables

| Exception ID | Target Table | Severity | Rule ID | Remediation Guidance | Architectural Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| `WSTAX-ADV-INFO-001` | `platform.operating_models` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-002` | `platform.property_operating_model_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-003` | `platform.property_profiles` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-004` | `platform.property_space_kind_compatibilities` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-005` | `platform.space_kinds` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-006` | `platform.workspace_property_bindings` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-007` | `platform.workspace_taxonomy_assignments` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |
| `WSTAX-ADV-INFO-008` | `platform.workspace_taxonomy_idempotency` | `INFO` | `0008` | [Rule 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | **ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL** |

---

## 3. Comprehensive Security Matrix for Taxonomy Gateway Functions

| Attribute | `get_workspace_taxonomy_v1` | `list_taxonomy_profiles_v1` | `list_taxonomy_operating_models_v1` | `list_taxonomy_space_kinds_v1` | `get_taxonomy_catalog_options_v1` | `assign_workspace_taxonomy_v1` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Function Owner** | `postgres` | `postgres` | `postgres` | `postgres` | `postgres` | `postgres` |
| **Security Context** | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` | `SECURITY DEFINER` |
| **Actual Volatility** | `STABLE` | `STABLE` | `STABLE` | `STABLE` | `STABLE` | `VOLATILE` |
| **Explicit search_path** | `pg_catalog, platform, identity, portfolio, app_private` | `pg_catalog, platform, identity, app_private` | `pg_catalog, platform, identity, app_private` | `pg_catalog, platform, identity, app_private` | `pg_catalog, platform, identity, app_private` | `pg_catalog, platform, identity, portfolio, audit, app_private` |
| **EXECUTE Granted** | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` | `authenticated, service_role` |
| **Revoked Roles** | `public, anon` | `public, anon` | `public, anon` | `public, anon` | `public, anon` | `public, anon` |
| **Authentication Check** | `auth.uid() is not null` | `auth.uid() is not null` | `auth.uid() is not null` | `auth.uid() is not null` | `auth.uid() is not null` | `auth.uid() is not null` |
| **Context Validation** | `identity.context_grants` & `memberships` join | `identity.context_grants` & `memberships` join | `identity.context_grants` & `memberships` join | `identity.context_grants` & `memberships` join | `identity.context_grants` & `memberships` join | `identity.context_grants` & `memberships` join |
| **Tenant Isolation** | Scoped strictly to caller's `tenant_id` | Scoped strictly to caller's `tenant_id` | Scoped strictly to caller's `tenant_id` | Scoped strictly to caller's `tenant_id` | Scoped strictly to caller's `tenant_id` | Bound strictly to caller's verified `tenant_id` |
| **Permission Check** | Active context grant | Active context grant | Active context grant | Active context grant | Active context grant | Enforces `workspace.taxonomy.manage` |
| **AAL2 Step-Up Check** | Not applicable (read-only) | Not applicable (read-only) | Not applicable (read-only) | Not applicable (read-only) | Not applicable (read-only) | Mandatory: `auth.jwt()->>'aal' = 'aal2'` |
| **Why DEFINER Required** | Reads locked `platform.*` tables | Reads locked `platform.*` tables | Reads locked `platform.*` tables | Reads locked `platform.*` tables | Reads locked `platform.*` tables | Writes `platform.*`, `audit.*` while tables deny client direct DML |
| **Risk Disposition** | Accepted controlled gateway | Accepted controlled gateway | Accepted controlled gateway | Accepted controlled gateway | Accepted controlled gateway | Accepted controlled gateway |

---

## 4. Deep-Dive Security Controls by Function

### 4.1 `customer_api.assign_workspace_taxonomy_v1` (Mutation Gateway)
- **Mandatory Authentication & MFA Level:**
  ```sql
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  ```
- **Granular Permission Check:**
  Requires the caller's role to possess the `workspace.taxonomy.manage` permission on `identity.role_permissions`.
- **Fail-Closed Context Resolution:**
  Enforces that context grants explicitly map through `platform.workspace_property_bindings` to an unambiguous workspace. Contexts lacking bindings return `binding_required` or raise `customer_context_access_denied` (`42501`). Single-workspace fallback is strictly disallowed during mutation.
- **Optimistic Concurrency & Advisory Lock:**
  Acquires an advisory transaction lock (`pg_advisory_xact_lock`) keyed on `workspace_taxonomy_mutation:<workspace_id>`. Verifies `p_expected_assignment_id` against active assignment; concurrent contenders receive deterministic `workspace_taxonomy_expected_assignment_conflict` (`40001`).
- **Audit & Idempotency:**
  Writes immutable audit records (`WORKSPACE_TAXONOMY_ASSIGNED` or `WORKSPACE_TAXONOMY_TRANSITIONED`) and registers idempotent keys in `platform.workspace_taxonomy_idempotency` with zero side-effects on replay.

### 4.2 `customer_api.get_taxonomy_catalog_options_v1` (Catalog Parity)
- **Controlled Scope:**
  Evaluates active `platform.property_profiles`, `platform.operating_models`, and compatibility matrices with latest `rule_version` parity (`DISTINCT ON (p.code, m.code) ... ORDER BY p.code, m.code, c.rule_version desc`).
- **Data Protection:**
  Emits only localized UI display labels, descriptions, and compatibility flags. Emits zero customer records, zero financial balances, and zero credential metadata.

### 4.3 `customer_api.get_workspace_taxonomy_v1` (Forward-Updated Resolver)
- **Forward Parity:**
  Returns canonical `country_code` stored on `platform.workspace_taxonomy_assignments`.
- **Uniform Contract:**
  Consistently returns explicit `assignment_id: null` on all unassigned and `binding_required` branches, and active UUID on assigned branches.

---

## 5. Deny-by-Default RLS Architecture (`platform.*`)

### 5.1 Defense-in-Depth Rationale
The eight platform tables intentionally maintain `ROW LEVEL SECURITY` without client-facing permissive policies:
1. `platform.operating_models`
2. `platform.property_operating_model_compatibilities`
3. `platform.property_profiles`
4. `platform.property_space_kind_compatibilities`
5. `platform.space_kinds`
6. `platform.workspace_property_bindings`
7. `platform.workspace_taxonomy_assignments`
8. `platform.workspace_taxonomy_idempotency`

### 5.2 Direct Table Revocations
Direct `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` privileges have been revoked from `public`, `anon`, and `authenticated`:
```sql
revoke all on platform.workspace_taxonomy_assignments from public, anon, authenticated;
revoke all on platform.workspace_taxonomy_idempotency from public, anon, authenticated;
revoke all on platform.workspace_property_bindings from public, anon, authenticated;
```

### 5.3 Controlled Access Principle
- In PostgreSQL RLS semantics, a table with RLS enabled and zero policies rejects all queries from non-superuser / non-bypassrls roles (including PostgREST Data API requests for `anon` and `authenticated`).
- Data access is mediated exclusively via `customer_api` RPC functions where authorization, multi-tenant boundaries, and AAL2 step-up are programmatically validated.
- **Architectural Constraint:** This design decision must not be interpreted as permission or justification to add public or permissive RLS policies in the future. Any modification must go through formal Architecture Review.

---

## 6. Architectural Rationale for SECURITY DEFINER

1. **Deny-by-Default Integrity:** Because direct table access is revoked from client roles, `SECURITY DEFINER` execution is required for the gateway routines to read and write underlying tables on behalf of verified callers.
2. **Inadmissibility of SECURITY INVOKER:** Operating under `SECURITY INVOKER` would necessitate granting direct `INSERT` and `UPDATE` privileges on `platform.workspace_taxonomy_assignments` and `audit.events` to `authenticated`. This would undermine tenant isolation by allowing clients to bypass contextual business logic and execute arbitrary direct writes.
3. **Compensating Controls:** The risks associated with elevated function execution are managed through fixed explicit search paths, static queries (zero dynamic SQL), authoritative caller verification (`auth.uid()`), strict tenancy isolation, and transactional audit event logging.

---

## 7. Operational Re-Review Triggers

This exception register remains valid under the current schema baseline and must be reviewed immediately if:
1. Any function ownership or security context is modified (`SECURITY DEFINER` removed or owner changed).
2. Function execution privileges are granted to `anon` or `public`.
3. The explicit `search_path` of any `customer_api` or `app_private` routine is altered.
4. Client-facing permissive RLS policies are attached to any of the 8 `platform.*` tables.
5. Membership or context grant verification logic in `app_private` is restructured.

---

## 8. Standards & Document References

- [Supabase Database Linter — RLS Enabled No Policy (`0008_rls_enabled_no_policy`)](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Supabase Database Linter — Authenticated Security Definer Function Executable (`0029_authenticated_security_definer_function_executable`)](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [ADR-CLD-052: Universal Managed Property Workspaces](../architecture/ADR-CLD-052-universal-managed-property-workspaces.md)
- [CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md](../contracts/CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md)
- [CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-CLOSURE-v1.0.md](../closure/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-CLOSURE-v1.0.md)
