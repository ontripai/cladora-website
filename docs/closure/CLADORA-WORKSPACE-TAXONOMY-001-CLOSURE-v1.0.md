# CLADORA-WORKSPACE-TAXONOMY-001 — Closure Report v1.0 (R3)

**Document ID:** `CLADORA-CLOSE-TAXONOMY-001-R3`  
**Verdict:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`  
**Baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77`  
**Branch:** `feat/cladora-workspace-taxonomy-001`  
**Authoritative Reference:** `docs/architecture/ADR-CLD-052-universal-managed-property-workspaces.md`  
**Change Class:** Database Schema Migration, pgTAP Acceptance Suite, Read-Only API/UI Slice, and Documentation.

---

## 1. Objective & Scope

This package delivers the canonical execution milestone of the Universal Managed Property architecture for CLADORA with deterministic workspace property bindings, version effective-period integrity, and zero guessing.

Core Invariant:
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$

### Delivered Capabilities:
1. **Property Profiles Registry** (`platform.property_profiles`): 16 versioned, relational, seeded profiles with trilingual RO/EN/FA labels, strict JSON/regex check constraints, and concurrency-safe version effective-period overlap prevention triggers.
2. **Operating Models Registry** (`platform.operating_models`): 8 versioned, relational, seeded operating models with trilingual RO/EN/FA labels and version effective-period overlap prevention.
3. **Space Kinds Registry** (`platform.space_kinds`): 18 versioned spatial classes with version effective-period overlap prevention.
4. **Compatibility Matrices** (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`): Versioned rules with fail-closed default-deny evaluation.
5. **Workspace Property Bindings** (`platform.workspace_property_bindings`): Canonical, forward-only, non-overlapping property-to-workspace mapping container with tenant consistency checks and full historical immutability.
6. **Workspace Taxonomy Assignments** (`platform.workspace_taxonomy_assignments`): Temporal, non-overlapping, tenant-bound classification container with history immutability triggers guarding `id`, `tenant_id`, `customer_workspace_id`, `property_profile_id`, `operating_model_id`, `created_by`, `created_at`, and `valid_from`.
7. **Customer API & UI**: Controlled read-only gateway (`customer_api.get_workspace_taxonomy_v1`, `/api/customer/v1/workspace/taxonomy`) and integrated React component (`WorkspaceTaxonomyCard`) embedded in `CustomerDashboard.tsx` with native Persian RTL and Romanian/English translations.

---

## 2. Review Findings & Remediation Log (R3)

| Finding ID | Description | Resolution Status |
| :--- | :--- | :---: |
| `WSTAX-R2-001` | Removed runtime resolver dependency on `platform.import_runs`. Introduced canonical `platform.workspace_property_bindings` table. Deterministic errors: `workspace_taxonomy_context_not_workspace_bound`, `workspace_taxonomy_workspace_binding_ambiguous`, `workspace_taxonomy_workspace_binding_tenant_mismatch`. Zero backfill of existing legacy workspaces. | **RESOLVED** |
| `WSTAX-R2-002` | Added concurrency-safe trigger `guard_taxonomy_version_effective_period_v1` on all 3 registries throwing `workspace_taxonomy_version_effective_period_overlap`. List APIs filter by current effective validity period. | **RESOLVED** |
| `WSTAX-R2-003` | Extended assignment history immutability to include `created_by` and `id`. Binding history immutability enforced on `workspace_property_bindings`. | **RESOLVED** |
| `WSTAX-SEC-001` | Context resolution strictly bound to `User → Membership → Context Grant → Scoped Object → Property → workspace_property_bindings → Customer Workspace`. Single-workspace fallback restricted strictly to pure tenant-scoped context. | **RESOLVED** |
| `WSTAX-SEC-002` | Revoked direct `authenticated` access to assignment and binding tables. Access strictly via context RPC. | **RESOLVED** |
| `WSTAX-SEC-003` | Revoked direct `SELECT` on catalog tables from `authenticated`. Catalog reads mediated by RPCs. Internal validator restricted to `service_role`. | **RESOLVED** |
| `WSTAX-AUDIT-001` | Recorded `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT` for read-only foundation. | **RESOLVED** |
| `WSTAX-HISTORY-001` | Added trigger `guard_workspace_taxonomy_assignment_history_v1` to block direct deletion or modification of historic assignment records. | **RESOLVED** |
| `WSTAX-SEED-001` | Plain deterministic `INSERT` statements guarantee existing versions cannot be overwritten. | **RESOLVED** |
| `WSTAX-VALIDATION-001` | Check constraints added for stable code regex, non-empty names, non-empty `ro`/`en`/`fa` in `labels_json`, object `metadata_json`. | **RESOLVED** |
| `WSTAX-UI-001` | Integrated `WorkspaceTaxonomyCard` into `CustomerDashboard.tsx` with dynamic fetching, loading, error, and empty states. | **RESOLVED** |
| `WSTAX-REGRESSION-001` | Refined `test-export-scanner-observability-001.mjs` to check exact file existence of migration 98. | **RESOLVED** |
| `WSTAX-TEST-001` | Extended Test 087 to 47 assertions verifying canonical binding resolution, multi-workspace same-tenant isolation, version overlap rejection, and historical immutability. | **RESOLVED** |

---

## 3. Cryptographic Verification & Hash Audit

| File | Type |
| :--- | :--- |
| `supabase/migrations/20260915120000_workspace_taxonomy.sql` | Migration 100 | `ab6381842a3813ad7acb3f9c76cdb149d3c85e624aa74a3263c0fd13c7d2c33e` |
| `supabase/tests/087_workspace_taxonomy.test.sql` | Test 087 | `e624850cda99031584bbf928a5455f3320a3008f472e4ae49f28559cf7f2b597` |

### Prior Migration Invariant:
- Total prior migrations (1 through 99): `99` files
- Verification: Byte-identical preservation across all 99 prior migrations confirmed against `origin/main`.

---

## 4. Test Suite Execution & Results

| Test Category | Command / Script | Plan / Assertions | Result |
| :--- | :--- | :--- | :--- |
| **Database Package Contract** | `node scripts/check-database-package.mjs` | 100 migrations / 87 tests / 2817 assertions | **PASS** |
| **Workspace Taxonomy Slice** | `node scripts/test-workspace-taxonomy-slice.mjs` | 5/5 test suites | **PASS** |
| **Unit Test Suite** | `npm test` | All slice tests + unit suites | **PASS** |
| **TypeScript Typecheck** | `npm run typecheck` | 0 errors | **PASS** |
| **ESLint Audit** | `npm run lint` | 0 warnings, 0 errors | **PASS** |
| **Next.js Production Build** | `npm run build` | All static/dynamic routes compiled | **PASS** |

---

## 5. Security & Architectural Invariants Verified

1. **Deterministic Workspace Binding:** Runtime resolution uses `workspace_property_bindings`. Unbound properties fail closed. Multiple historical `import_runs` do not affect resolution.
2. **Deny-by-Default RLS & Permissions:** Direct client table reads/writes on platform registries, assignments, and bindings are revoked; RPCs mediate access.
3. **Version Effective-Period Non-Overlap:** Registries reject concurrent active overlapping versions of the same code (`workspace_taxonomy_version_effective_period_overlap`).
4. **Current Catalog Filtering:** Catalog list RPCs return strictly the currently effective active version for each code, excluding future and expired versions.
5. **Historical Immutability:** Triggers block physical deletion of referenced profiles, historic bindings, and historic assignments. Assignment and binding identities (`id`, `tenant_id`, `customer_workspace_id`, `property_id`, `created_by`, `created_at`, `valid_from`) cannot be mutated.
6. **Tenant Isolation:** Workspace assignments and bindings enforce strict tenant match with row lock.
7. **Compatibility Fail-Closed:** Missing compatibility rule evaluates to default-deny (`workspace_taxonomy_compatibility_rule_missing`).
8. **Zero Side-Effects:** Zero mutations on `finance.journals`, `payments`, or `airprop.*`.
9. **Country Pack Independence:** Zero implicit defaulting or auto-inference of country pack from property profile.

---

## 6. Deferred Items & Findings

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
