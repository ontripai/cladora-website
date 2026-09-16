# CLADORA-WORKSPACE-TAXONOMY-001 — Closure Report v1.0 (R4)

**Document ID:** `CLADORA-CLOSE-TAXONOMY-001-R4`  
**Verdict:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`  
**Baseline Starting HEAD:** `c70177d561e8b3eaae279b48aec3c6d4e6eb071e`  
**Branch:** `feat/cladora-workspace-taxonomy-001`  
**Authoritative Reference:** `docs/architecture/ADR-CLD-052-universal-managed-property-workspaces.md`  
**Change Class:** Concurrency Hardening, Complete Space Kind Registry (21), Safe Unbound Dashboard UX, Security Revokes, Acceptance Tests, and Concurrency Rehearsal.

---

## 1. Objective & Scope

This package delivers the final concurrency hardening, complete 21 Space Kind catalog, safe unbound workspace handling, and function security remediation for the Universal Managed Property architecture for CLADORA.

Core Invariant:
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$

### Delivered Capabilities:
1. **Property Profiles Registry** (`platform.property_profiles`): 16 versioned, relational, seeded profiles with trilingual RO/EN/FA labels, strict JSON/regex check constraints, and deterministic advisory-locked version effective-period overlap prevention.
2. **Operating Models Registry** (`platform.operating_models`): 8 versioned, relational, seeded operating models with trilingual RO/EN/FA labels and advisory-locked version effective-period overlap prevention.
3. **Space Kinds Registry** (`platform.space_kinds`): Exactly 21 versioned spatial classes (including restored `yard`, `loading_zone`, `land_parcel` and modern `courtyard_garden`, `roof_deck`, `infrastructure_node`) with advisory-locked version effective-period overlap prevention.
4. **Compatibility Matrices** (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`): Complete versioned rules including all 21 space kinds with fail-closed default-deny evaluation.
5. **Workspace Property Bindings** (`platform.workspace_property_bindings`): Canonical, forward-only, non-overlapping property-to-workspace mapping container with property row `FOR UPDATE` lock serialization and full historical immutability.
6. **Workspace Taxonomy Assignments** (`platform.workspace_taxonomy_assignments`): Temporal, non-overlapping, tenant-bound classification container with history immutability triggers.
7. **Customer API & UI**: Controlled read-only gateway (`customer_api.get_workspace_taxonomy_v1`, `/api/customer/v1/workspace/taxonomy`) and integrated React component (`WorkspaceTaxonomyCard`) embedded in `CustomerDashboard.tsx` with neutral unconfigured state for unbound legacy workspaces in Romanian, English, and Persian RTL.
8. **Privileged Function Execution Control**: Explicit `REVOKE ALL` on all `app_private` trigger and helper functions from `public, anon, authenticated`.

---

## 2. Review Findings & Remediation Log (R4)

| Finding ID | Description | Resolution Status |
| :--- | :--- | :---: |
| `WSTAX-R4-001-VERSION-RACE` | Added deterministic transactional advisory lock `pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA \|\| ':' \|\| TG_TABLE_NAME \|\| ':' \|\| new.code, 0))` in `guard_taxonomy_version_effective_period_v1`. Concurrent version inserts for same code serialize; loser throws `workspace_taxonomy_version_effective_period_overlap` (`P0001`). | **RESOLVED** |
| `WSTAX-R4-002-BINDING-RACE` | Locked target property row `FOR UPDATE` in `portfolio.properties` prior to checking tenant consistency and overlap in `guard_workspace_property_binding_v1`. Concurrent bindings targeting the same property serialize on property lock; loser throws `workspace_property_binding_overlap` (`P0001`). | **RESOLVED** |
| `WSTAX-R4-003-SPACE-KIND-COMPLETENESS` | Restored `yard`, `loading_zone`, and `land_parcel` into `platform.space_kinds`, bringing registry total to exactly 21 space kinds. Updated compatibility matrices for all property profiles. | **RESOLVED** |
| `WSTAX-R4-004-UNBOUND-WORKSPACE-UX` | Unbound valid context returns controlled `has_assignment: false`, `status: "binding_required"`, `workspace_id: null` with zero data leakage. Route maps `workspace_taxonomy_context_not_workspace_bound` to 409 `TAXONOMY_NOT_CONFIGURED`. UI renders neutral non-error card in RO/EN/FA without Access Denied alert styling. | **RESOLVED** |
| `WSTAX-R4-005-PRIVILEGED-FUNCTION-GRANTS` | Explicitly revoked execute on all `app_private` trigger and helper functions from `public, anon, authenticated`. | **RESOLVED** |

---

## 3. Cryptographic Verification & Hash Audit

| File | Type | SHA-256 |
| :--- | :--- | :--- |
| `supabase/migrations/20260915120000_workspace_taxonomy.sql` | Migration 100 | `1161449c53bd173ff81b600d0ff077ab29d35d9aa4b043914107ffda0710edba` |
| `supabase/tests/087_workspace_taxonomy.test.sql` | Test 087 | `2f432fa97b0863759312b2de83b528ca2e6f5525801ad8e8f6466ade04faaa7e` |

### Prior Migration Invariant:
- Total prior migrations (1 through 99): `99` files
- Verification: Byte-identical preservation across all 99 prior migrations confirmed against `origin/main`.

---

## 4. Test Suite Execution & Results

| Test Category | Command / Script | Plan / Assertions | Result |
| :--- | :--- | :--- | :--- |
| **Database Package Contract** | `node scripts/check-database-package.mjs` | 100 migrations / 87 tests / 2825 assertions | **PASS** |
| **Workspace Taxonomy Slice** | `node scripts/test-workspace-taxonomy-slice.mjs` | 5/5 test suites (21 space kinds, locks, revokes, UI) | **PASS** |
| **Concurrency Rehearsal** | `node scripts/test-workspace-taxonomy-concurrency.mjs` | 3/3 rehearsal steps (lock formulas, interleaving models, invariants) | **PASS** |
| **Unit Test Suite** | `npm test` | All slice tests + unit suites + rehearsal | **PASS** |
| **TypeScript Typecheck** | `npm run typecheck` | 0 errors | **PASS** |
| **ESLint Audit** | `npm run lint` | 0 warnings, 0 errors | **PASS** |
| **Next.js Production Build** | `npm run build` | All 358 static/dynamic routes compiled | **PASS** |

---

## 5. Explicit Invariants & Confirmations

- `Supabase Apply: NOT PERFORMED` (Strictly prohibited prior to formal authorization)
- `PR Ready: NOT PERFORMED` (PR #98 remains Draft)
- `Merge: NOT PERFORMED`
- `Production mutation: NOT PERFORMED`
- `Zero Legacy Backfill: ENFORCED`
