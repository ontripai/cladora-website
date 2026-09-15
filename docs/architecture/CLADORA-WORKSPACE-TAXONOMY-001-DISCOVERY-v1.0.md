# CLADORA-WORKSPACE-TAXONOMY-001 — Discovery and Architecture Specification v1.0

**Document ID:** `CLADORA-ARCH-TAXONOMY-001`  
**Status:** Approved for implementation  
**Authoritative baseline SHA:** `076f4c560867b20e94d874b1b5fd01c783439e77`  
**Target migration index:** Migration 100 (`20260915120000_workspace_taxonomy.sql`)  
**Target test index:** Test 087 (`087_workspace_taxonomy.test.sql`)  
**Scope:** Universal Property Taxonomy registries, compatibility contract, temporal workspace assignment, and read-only controlled presentation.

---

## 1. Executive Summary & Objective

This discovery report establishes the technical and architectural foundation for the first delivery package of the Universal Managed Property architecture in CLADORA.

Following the reference equation:
$$\text{Workspace Profile} \neq \text{Operating Model} \neq \text{Building DNA} \neq \text{Service Profile} \neq \text{Country Pack}$$

This package introduces versioned, relational, seed-controlled taxonomy registries for:
1. **Property Profiles** (`platform.property_profiles`): 16 canonical environments.
2. **Operating Models** (`platform.operating_models`): 8 operational authority models.
3. **Space Kinds** (`platform.space_kinds`): 18 unit and spatial classes.
4. **Compatibility Matrices** (`platform.property_operating_model_compatibilities`, `platform.property_space_kind_compatibilities`).
5. **Workspace Taxonomy Assignments** (`platform.workspace_taxonomy_assignments`).

---

## 2. Current-State Schema Inventory & Findings

### 2.1 Workspace & Tenant Boundary
- `platform.tenants`: Master multi-tenant entity.
- `platform.customer_workspaces`: Tenant-bound operational container (`id`, `tenant_id`, `workspace_type`, `lifecycle_status`, `environment`).
- `platform.workspace_entitlements`: Contractual capability allowances.

### 2.2 Existing Portfolio Hierarchy
- `portfolio.properties`: Physical property record with residential `portfolio.property_type` enum (`condominium`, `residential_complex`, `villa`, `gated_community`, `mixed_residential`).
- `portfolio.buildings`, `portfolio.entrances`, `portfolio.units`: Physical subdivision hierarchy.
- **Decision:** The existing physical hierarchy and enum values are left 100% untouched. The new taxonomy registers operational profiles on workspaces without mutating physical portfolio tables.

### 2.3 Existing AIRPROP Boundary
- `airprop.investment_opportunities`, `airprop.underwriting_cases`, `airprop.whole_property_interests`, `airprop.management_mandates`: Established in Migration 99 (`20260914144417_airprop_core_foundation.sql`).
- **Decision:** AIRPROP owns investment/underwriting semantics; CLADORA owns operations. Both share the `platform` and `portfolio` core. Zero AIRPROP tables or records are modified in this package.

### 2.4 Permission Analysis & Mutation Deferral
- Comprehensive analysis of `identity.permissions` across all 99 migrations revealed specific domain permissions (`finance.ledger.read`, `billing.receivables.read`, `utilities.manage`, `assets.manage`, `airprop.property.configure`), but **no** pre-existing canonical customer permission for workspace taxonomy mutation.
- **Decision:** In strict adherence to Section 2.5 of the Implementation Authorization, write/mutation RPCs are excluded from the public customer gateway in this package, avoiding premature permission invention. Finding registered:
  `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-PERMISSION`
- Public gateway provides high-assurance read-only endpoints (`customer_api.get_workspace_taxonomy_v1`, `customer_api.list_taxonomy_profiles_v1`, etc.).

### 2.5 Country Pack Independence
- `Country Pack` is orthogonal to `Property Profile` and `Operating Model`.
- Romanian condominium association rules apply strictly to Romanian associations (`RO`).
- No default or implicit assignment of `RO` is applied to workspaces. Country Pack integration is decoupled.

---

## 3. MATCH / EXTEND / CONFLICT / MISSING / DEFERRED Matrix

| Capability / Concept | Matrix Status | Current Repository State | Architectural Decision in Package 001 |
| --- | --- | --- | --- |
| **Tenant Isolation & RLS** | `MATCH` | `app_private.active_tenant_id()`, RLS fail-closed | Inherited; RLS enabled on all taxonomy tables with deny-by-default. |
| **Workspace Container** | `MATCH` | `platform.customer_workspaces` | Extended with relational taxonomy assignment referencing workspace ID. |
| **Property Profiles** | `EXTEND` | 5 residential enums in `portfolio.property_type` | 16 versioned relational profiles in `platform.property_profiles`. |
| **Operating Models** | `EXTEND` | 4 enum values in `platform.workspace_type` | 8 versioned relational operating models in `platform.operating_models`. |
| **Space Kinds** | `EXTEND` | `portfolio.units` | 18 versioned spatial classes in `platform.space_kinds`. |
| **Compatibility Rules** | `MISSING` | Not present | Added with `compatible`, `review_required`, `incompatible` and fail-closed default-deny. |
| **Temporal Assignments** | `MISSING` | Not present | Added with trigger-level concurrency lock and overlap prevention. |
| **Customer Mutation RPC** | `DEFERRED` | No matching permission in `identity.permissions` | Deferred to `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001`. Read-only API exposed. |
| **Country Pack Binding** | `DEFERRED` | Documented in ADR-052 & AIRPROP | Decoupled; zero implicit Country Pack binding in this migration. |

---

## 4. Technical Architecture & Invariants

### 4.1 Registries (`platform.*`)
1. **Stable Code & Versioning:**
   - Unique constraint: `UNIQUE (code, version)`.
   - Status: `platform.record_status` (`active`, `draft`, `suspended`, `archived`).
   - Localized labels: JSONB containing `ro`, `en`, and `fa` strings.
2. **Physical Deletion Prevention:**
   - Deletion of records in `platform.property_profiles`, `platform.operating_models`, `platform.space_kinds` referenced by compatibilities or assignments is prohibited via trigger `guard_taxonomy_record_immutability_v1`.

### 4.2 Compatibility Contract
- Evaluation states: `compatible`, `review_required`, `incompatible`.
- **Default Deny:** If no explicit compatibility rule exists between a Property Profile and an Operating Model/Space Kind, validation fails closed with `workspace_taxonomy_compatibility_rule_missing`.
- **Review Required:** Cannot become an effective active assignment without formal review evidence (fails with `workspace_taxonomy_review_required`).
- **Incompatible:** Fails with `workspace_taxonomy_incompatible_assignment`.

### 4.3 Workspace Assignment Contract
- Table: `platform.workspace_taxonomy_assignments`.
- Foreign keys: `tenant_id`, `customer_workspace_id`, `property_profile_id`, `operating_model_id`.
- Temporal range: `valid_from` to `valid_to` (`check(valid_to is null or valid_to > valid_from)`).
- Concurrency & Overlap:
  - Row-level lock on `platform.customer_workspaces` during insert/update.
  - Verification that no other active assignment exists overlapping the same effective period.

### 4.4 Deterministic Error Codes
- `42501` / `authentication_required`: Missing authenticated principal.
- `42501` / `mfa_required`: Missing required AAL2 assurance level.
- `42501` / `customer_context_access_denied`: Principal not permitted in requested context.
- `42501` / `workspace_taxonomy_tenant_mismatch`: Tenant boundary violation.
- `42501` / `workspace_taxonomy_immutable_record`: Attempted physical delete of referenced taxonomy.
- `P0001` / `workspace_taxonomy_compatibility_rule_missing`: Fail-closed compatibility failure.
- `P0001` / `workspace_taxonomy_incompatible_assignment`: Incompatible profile and operating model.
- `P0001` / `workspace_taxonomy_review_required`: Unapproved review-required combination.
- `P0001` / `workspace_taxonomy_assignment_overlap`: Overlapping temporal assignment.
- `P0002` / `workspace_taxonomy_not_found`: Referenced workspace or taxonomy does not exist.

---

## 5. Non-Goals & Explicit Boundaries

1. **No Data Rewriting:** Zero migration changes to existing `portfolio.properties`, `portfolio.units`, or `platform.customer_workspaces`.
2. **No Backfill Guesswork:** Zero backfill assignments generated for existing customer workspaces. Existing residential operations continue uninterrupted.
3. **No Financial Journaling:** Zero journals, ledgers, or payment balances touched.
4. **No Privilege Escalation:** Taxonomy profile does not grant permissions or entitlements.
5. **No Mutation Permission Invention:** public mutation RPC is deferred until the dynamic composition authorization package.
