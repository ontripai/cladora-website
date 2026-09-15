# CLADORA-WORKSPACE-TAXONOMY-001 — Closure Report v1.0

**Document ID:** `CLADORA-CLOSE-TAXONOMY-001`  
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
1. **Property Profiles Registry** (`platform.property_profiles`): 16 versioned, relational, seeded profiles with trilingual RO/EN/FA labels.
2. **Operating Models Registry** (`platform.operating_models`): 8 versioned, relational, seeded operating authority models with trilingual RO/EN/FA labels.
3. **Space Kinds Registry** (`platform.space_kinds`): 18 versioned spatial classes.
4. **Compatibility Matrices** (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`): Versioned rules with fail-closed default-deny evaluation.
5. **Workspace Taxonomy Assignments** (`platform.workspace_taxonomy_assignments`): Temporal, non-overlapping, tenant-bound classification container.
6. **Customer API & UI**: Controlled read-only gateway (`customer_api.get_workspace_taxonomy_v1`, `/api/customer/v1/workspace/taxonomy`) and accessible React component (`WorkspaceTaxonomyCard`) with native Persian RTL and Romanian/English translations.

---

## 2. File Inventory & Modification Evidence

### New Files Created:
1. `docs/architecture/CLADORA-WORKSPACE-TAXONOMY-001-DISCOVERY-v1.0.md`
2. `supabase/migrations/20260915120000_workspace_taxonomy.sql`
3. `supabase/tests/087_workspace_taxonomy.test.sql`
4. `src/lib/customer/workspace-taxonomy-schema.ts`
5. `src/app/api/customer/v1/workspace/taxonomy/route.ts`
6. `src/components/workspace/WorkspaceTaxonomyCard.tsx`
7. `scripts/test-workspace-taxonomy-slice.mjs`
8. `docs/closure/CLADORA-WORKSPACE-TAXONOMY-001-CLOSURE-v1.0.md`

### Modified Files:
1. `package.json` (Registered `scripts/test-workspace-taxonomy-slice.mjs` in `test:unit`)
2. `scripts/test-export-scanner-observability-001.mjs` (Forward-compatible migration count assertion `>= 98`)

---

## 3. Cryptographic Verification & Hash Audit

| File | Type | SHA-256 Checksum |
| --- | --- | --- |
| `supabase/migrations/20260915120000_workspace_taxonomy.sql` | Migration 100 | `e9d7e4d37699a8960ff2f325e83bf129988b77490ca925f197b2dfa92ce8f16d` |
| `supabase/tests/087_workspace_taxonomy.test.sql` | Test 087 | `3bd422127715cff79c6ae068d6bdfe57e06e6d260f97ca9d1637b2311b7c0092` |

### Prior Migration Invariant:
- Total prior migrations (1 through 99): `99` files
- Verification: Byte-identical preservation across all 99 prior migrations confirmed against `origin/main`.

---

## 4. Test Suite Execution & Results

| Test Category | Command / Script | Plan / Assertions | Result |
| --- | --- | --- | --- |
| **Database Package Contract** | `node scripts/check-database-package.mjs` | 100 migrations / 87 tests / 2801 assertions | **PASS** |
| **Workspace Taxonomy Slice** | `node scripts/test-workspace-taxonomy-slice.mjs` | 5/5 test suites | **PASS** |
| **Unit Test Suite** | `npm run test:unit` | All slice tests + unit suites | **PASS** |
| **App Foundation Contract** | `node scripts/test-supabase-foundation.mjs` | 318/318 assertions | **PASS** |
| **i18n & DOM Untranslated Copy** | `node scripts/audit-untranslated-copy.mjs` | Zero untranslated keys | **PASS** |
| **TypeScript Typecheck** | `npm run typecheck` | 0 errors | **PASS** |
| **ESLint Audit** | `npm run lint` | 0 warnings, 0 errors | **PASS** |
| **Next.js Production Build** | `npm run build` | All static/dynamic routes compiled | **PASS** |

---

## 5. Security & Architectural Invariants Verified

1. **Deny-by-Default RLS:** Platform registries are read-only for authenticated principals; direct client mutations are rejected with `42501`.
2. **Tenant Isolation:** Workspace assignment enforces `tenant_id` match with `platform.customer_workspaces` row lock; cross-tenant attempts throw `workspace_taxonomy_tenant_mismatch`.
3. **Compatibility Fail-Closed:** Missing compatibility rule evaluates to default-deny (`workspace_taxonomy_compatibility_rule_missing`).
4. **Physical Deletion Prohibition:** Trigger `guard_taxonomy_record_immutability_v1` blocks physical deletion of referenced profiles/models/spaces (`workspace_taxonomy_immutable_record`).
5. **Temporal Non-Overlap:** Overlapping active assignments for the same workspace fail with `workspace_taxonomy_assignment_overlap`.
6. **Zero Side-Effects:** Migration 100 performs zero mutations on `finance.journals`, `payments`, or `airprop.*`.
7. **Country Pack Independence:** Zero implicit defaulting or auto-inference of country pack from property profile.

---

## 6. Deferred Items & Findings

- `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-PERMISSION`: Mutation of workspace classification via public gateway is deferred to `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001` to ensure comprehensive integration with dynamic capability catalogs and workspace-local roles.

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
