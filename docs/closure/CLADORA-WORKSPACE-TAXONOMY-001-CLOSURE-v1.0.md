# CLADORA-WORKSPACE-TAXONOMY-001 — Closure Report v1.0 (R2)

**Document ID:** `CLADORA-CLOSE-TAXONOMY-001-R2`  
**Verdict:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`  
**Baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77`  
**Branch:** `feat/cladora-workspace-taxonomy-001`  
**Authoritative Reference:** `docs/architecture/ADR-CLD-052-universal-managed-property-workspaces.md`  
**Change Class:** Database Schema Migration, pgTAP Acceptance Suite, Read-Only API/UI Slice, and Documentation.

---

## 1. Objective & Scope

This package delivers the first canonical execution milestone of the Universal Managed Property architecture for CLADORA.

Core Invariant:
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$

### Delivered Capabilities:
1. **Property Profiles Registry** (`platform.property_profiles`): 16 versioned, relational, seeded profiles with trilingual RO/EN/FA labels and strict JSON/regex check constraints.
2. **Operating Models Registry** (`platform.operating_models`): 8 versioned, relational, seeded operating models with trilingual RO/EN/FA labels.
3. **Space Kinds Registry** (`platform.space_kinds`): 18 versioned spatial classes.
4. **Compatibility Matrices** (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`): Versioned rules with fail-closed default-deny evaluation.
5. **Workspace Taxonomy Assignments** (`platform.workspace_taxonomy_assignments`): Temporal, non-overlapping, tenant-bound classification container with history immutability triggers.
6. **Customer API & UI**: Controlled read-only gateway (`customer_api.get_workspace_taxonomy_v1`, `/api/customer/v1/workspace/taxonomy`) and integrated React component (`WorkspaceTaxonomyCard`) embedded in `CustomerDashboard.tsx` with native Persian RTL and Romanian/English translations.

---

## 2. Review Findings & Remediation Log (R2)

| Finding ID | Description | Resolution Status |
| :--- | :--- | :---: |
| `WSTAX-SEC-001` | Removed non-deterministic `ORDER BY w.id LIMIT 1` workspace resolution. Context resolution strictly bound to `User → Membership → Context Grant → Scoped Object → Customer Workspace`. Ambiguous context in multi-workspace tenants returns `workspace_taxonomy_context_not_workspace_bound`. | **RESOLVED** |
| `WSTAX-SEC-002` | Revoked direct `authenticated` access to assignment table. Removed broad `grant all on all tables in schema platform to service_role;`. Access strictly via context RPC. | **RESOLVED** |
| `WSTAX-SEC-003` | Revoked direct `SELECT` on catalog tables from `authenticated`. Catalog reads mediated by RPCs. Internal validator restricted to `service_role`. | **RESOLVED** |
| `WSTAX-AUDIT-001` | Removed unverified audit claims. Recorded `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT` for read-only foundation. | **RESOLVED** |
| `WSTAX-HISTORY-001` | Added trigger `guard_workspace_taxonomy_assignment_history_v1` to block direct deletion or modification of historic assignment records. | **RESOLVED** |
| `WSTAX-SEED-001` | Removed `ON CONFLICT DO UPDATE`. Plain deterministic `INSERT` statements guarantee existing versions cannot be overwritten. | **RESOLVED** |
| `WSTAX-VALIDATION-001` | Check constraints added for stable code regex, non-empty names, non-empty `ro`/`en`/`fa` in `labels_json`, object `metadata_json`. | **RESOLVED** |
| `WSTAX-UI-001` | Integrated `WorkspaceTaxonomyCard` into `CustomerDashboard.tsx` with dynamic fetching, loading, error, and empty states. | **RESOLVED** |
| `WSTAX-REGRESSION-001` | Refined `test-export-scanner-observability-001.mjs` to check exact file existence of migration 98. | **RESOLVED** |
| `WSTAX-TEST-001` | Extended Test 087 to 34 assertions verifying multi-workspace same-tenant isolation, negative isolation, and validation check constraints. | **RESOLVED** |

---

## 3. Cryptographic Verification & Hash Audit

| File | Type | SHA-256 Checksum |
| --- | --- | --- |
| `supabase/migrations/20260915120000_workspace_taxonomy.sql` | Migration 100 | `71ed109e88decad97089c78004803ff5e9ddfd8820a99814612c19a17bdfffa5` |
| `supabase/tests/087_workspace_taxonomy.test.sql` | Test 087 | `d55b8bdf9a8259a5a295efa51c08ef9f05cb0eeb32f3ce2cff51a51fced38ee6` |

### Prior Migration Invariant:
- Total prior migrations (1 through 99): `99` files
- Verification: Byte-identical preservation across all 99 prior migrations confirmed against `origin/main`.

---

## 4. Test Suite Execution & Results

| Test Category | Command / Script | Plan / Assertions | Result |
| --- | --- | --- | --- |
| **Database Package Contract** | `node scripts/check-database-package.mjs` | 100 migrations / 87 tests / 2804 assertions | **PASS** |
| **Workspace Taxonomy Slice** | `node scripts/test-workspace-taxonomy-slice.mjs` | 5/5 test suites | **PASS** |
| **Unit Test Suite** | `npm run test:unit` | All slice tests + unit suites | **PASS** |
| **App Foundation Contract** | `node scripts/test-supabase-foundation.mjs` | 318/318 assertions | **PASS** |
| **i18n & DOM Untranslated Copy** | `node scripts/audit-untranslated-copy.mjs` | Zero untranslated keys | **PASS** |
| **TypeScript Typecheck** | `npm run typecheck` | 0 errors | **PASS** |
| **ESLint Audit** | `npm run lint` | 0 warnings, 0 errors | **PASS** |
| **Next.js Production Build** | `npm run build` | All static/dynamic routes compiled | **PASS** |

---

## 5. Security & Architectural Invariants Verified

1. **Deny-by-Default RLS & Permissions:** Direct client table reads/writes on platform registries and assignments are revoked; RPCs mediate access.
2. **Deterministic Context Resolution:** Multi-workspace tenants resolve strictly via scoped object. Ambiguous context fails closed (`workspace_taxonomy_context_not_workspace_bound`).
3. **Tenant Isolation:** Workspace assignment enforces `tenant_id` match with `platform.customer_workspaces` row lock.
4. **Compatibility Fail-Closed:** Missing compatibility rule evaluates to default-deny (`workspace_taxonomy_compatibility_rule_missing`).
5. **Physical Deletion & Mutation Prohibition:** Triggers block physical deletion of referenced profiles and historic assignments (`workspace_taxonomy_immutable_record`, `workspace_taxonomy_assignment_history_immutable`).
6. **Temporal Non-Overlap:** Overlapping active assignments for the same workspace fail with `workspace_taxonomy_assignment_overlap`.
7. **Zero Side-Effects:** Zero mutations on `finance.journals`, `payments`, or `airprop.*`.
8. **Country Pack Independence:** Zero implicit defaulting or auto-inference of country pack from property profile.

---

## 6. Deferred Items & Findings

- `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-PERMISSION`: Mutation of workspace classification via public gateway is deferred to `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001`.
- `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`: Transactional audit emission for mutations deferred until mutation gateway is established.

---

## 7. Operational Status & Release Verdict

- **Local Migration Count:** 100
- **Drift Status:** `EXPECTED-PENDING-REMOTE-APPLY`
- **Release Verdict:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`

### Explicit Boundaries:
- `Supabase Apply: NOT PERFORMED`
- `PR Ready: NOT PERFORMED`
- `Merge: NOT PERFORMED`
- `Production mutation: NOT PERFORMED`
