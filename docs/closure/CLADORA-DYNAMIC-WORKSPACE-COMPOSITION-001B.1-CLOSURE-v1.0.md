# Closure & Review Report — Workspace-Local Roles & Effective Permissions (001B.1)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-CLOSURE-v1.0`  
**Package:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1 — Workspace-local Roles, Module Scoping & Effective Permission Engine`  
**Final Status:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`  
**Repository:** `ontripai/cladora-website`  
**Baseline HEAD (`origin/main`):** `6c354801abc1dc72a4f7b0697c360a155bde5097`  
**Branch:** `feat/cladora-workspace-local-roles-001b1`  
**Target Migration:** `supabase/migrations/20260918120000_workspace_local_roles_permissions.sql` (Migration 103)  
**Target Test:** `supabase/tests/090_workspace_local_roles.test.sql` (Test 090)  
**Date:** 2026-09-18  

---

## 1. Executive Summary & Authoritative Scope

This report documents the completion of package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1`. In accordance with the project governance rules, all changes are strictly bounded to 001B.1. Remote database execution is **strictly unauthorized** (`REMOTE-APPLY-NOT-AUTHORIZED`) and no production apply has been executed.

All core mandates are implemented and verified:
1. **Migration 103:** Exactly six relational tables created in `platform` schema (`module_permission_bindings`, `workspace_roles`, `workspace_role_modules`, `workspace_role_permissions`, `workspace_member_roles`, `workspace_role_idempotency`). Zero `ON DELETE CASCADE`. Explicit fixed `search_path` on all routines. Deny-by-default RLS with zero grants to `anon` or `authenticated`.
2. **Cardinal Delegation Rule:** `is_delegable = false` across all module-permission binding records in Migration 103. Delegation runtime and approval dual control are strictly deferred to 001B.2 (Migration 104).
3. **Proven Module-Permission Seed Manifest:** Exactly 48 proven mappings registered without wildcards. Catalog-only modules (`core_property_registry`, `contracts_tenancy`) have exactly zero bindings. Four administrative permissions (`workspace.role.*`) are excluded from operational module mappings.
4. **Disambiguated Versioning:** `role_version` increments forward-only on supersession; `lock_version` increments on draft mutations. Lock version conflicts raise SQLSTATE `40001`. Published roles are content-immutable; supersession atomically transitions previous version to `archived`. Zero physical deletion.
5. **Scoped Member Assignments:** Enforces tenant consistency, active membership, published role status, exactly-one-scope constraint, real property/building/unit ancestry, workspace property binding validation, and scope ceiling.
6. **Deny-First Effective Permission Resolution Engine (`app_private.check_effective_permission_v1`):** Canonical equation:
   $$\text{Effective Permission} = \text{Common Gates} \;\land\; \neg(\text{Applicable Scoped Deny}) \;\land\; (\text{Any Applicable Allow})$$
   Evaluates all applicable denys before any allow. Legacy Migration 1–102 gateways remain untouched.
7. **Ten Controlled Customer RPCs:** Full suite of STABLE read and VOLATILE mutation gateways with advisory locks, AAL2 enforcement, mandatory trimmed reason, versioned idempotency (`request_hash_version = 1`), and atomic audit logging in `audit.events`.
8. **Protected Next.js API Routes & UI:** Ten route handlers under `src/app/api/customer/v1/workspace/roles/` with same-origin checks, 16KB body limit, Zod validation, and zero service role in browser paths. Trilingual UI (`ro`, `en`, `fa` + RTL) at `src/app/[lang]/app/settings/roles/`.

---

## 2. Evidence Identifiers & Checksums

### 2.1 Database Package Invariant
- **Total Migrations:** 103 (Migration 103 added)
- **Total Tests:** 90 (Test 090 added)
- **Total Assertions:** 3063 (Increase of 76 assertions over 2987 baseline)
- **Migrations 1–102:** 100% byte-identical to `origin/main` baseline.
- **Tests 1–089:** 100% byte-identical to `origin/main` baseline.
- **Package Check:** `node scripts/check-database-package.mjs` executed cleanly with code 0.

### 2.2 SHA-256 Checksums
- **Migration 103 Path:** `supabase/migrations/20260918120000_workspace_local_roles_permissions.sql`
- **Migration 103 SHA-256:** `35555711024FDED4211F7F4E9CD0D7F97AF2938E0F031F0D5BCDCABB1939AC04`
- **Test 090 Path:** `supabase/tests/090_workspace_local_roles.test.sql`
- **Test 090 SHA-256:** `3EFEB8F406ABD0E87F1AC055DB25D987DA8D1652C3C1E8EC0782FA401E0796D8`
- **pgTAP Plan:** Exactly 76 assertions matching `SELECT plan(76);`.

---

## 3. Seed Manifest Audit

### 3.1 Four Administrative Permissions (`identity.permissions`)
- `workspace.role.read` (Granted to `association_admin`, `property_manager`, `president`, `censor`)
- `workspace.role.manage` (Granted to `association_admin`, `property_manager`)
- `workspace.role.publish` (Granted to `association_admin`, `property_manager`)
- `workspace.role.assign` (Granted to `association_admin`, `property_manager`)

### 3.2 48 Proven Operational Module–Permission Mappings (`platform.module_permission_bindings`)
- `occupancy` (2): `occupancy.occupancies.manage` (manage, aal2: false), `occupancy.registry.read` (read, aal2: false)
- `billing` (4): `billing.manage` (manage, aal2: true), `billing.issue` (execute, aal2: true), `billing.cancel` (manage, aal2: true), `billing.receivables.read` (read, aal2: false)
- `payments` (5): `payments.manage` (manage, aal2: true), `payments.allocate` (execute, aal2: true), `payments.reverse` (manage, aal2: true), `payments.reconcile` (manage, aal2: true), `payments.reconciliation.read` (read, aal2: false)
- `accounting` (1): `finance.ledger.read` (read, aal2: false)
- `maintenance` (11): `maintenance.requests.read` (read, aal2: false), `maintenance.requests.create` (execute, aal2: false), `maintenance.requests.manage` (manage, aal2: false), `maintenance.requests.assign` (manage, aal2: false), `maintenance.work_orders.read` (read, aal2: false), `maintenance.work_orders.manage` (manage, aal2: false), `maintenance.work_orders.verify` (manage, aal2: false), `maintenance.procurement.read` (read, aal2: false), `maintenance.procurement.manage` (manage, aal2: false), `maintenance.procurement.approve` (manage, aal2: true), `maintenance.assets.read` (read, aal2: false)
- `utilities` (6): `utilities.manage` (manage, aal2: false), `utilities.readings.capture` (execute, aal2: false), `utilities.readings.approve` (manage, aal2: false), `utilities.tariffs.manage` (manage, aal2: false), `utilities.billing.create` (execute, aal2: true), `utilities.metering.read` (read, aal2: false)
- `governance` (11): `governance.meetings.manage` (manage, aal2: false), `governance.agenda.manage` (manage, aal2: false), `governance.attendance.manage` (manage, aal2: false), `governance.proxies.manage` (manage, aal2: false), `governance.votes.cast` (execute, aal2: false), `governance.votes.administer` (admin, aal2: true), `governance.resolutions.read` (read, aal2: false), `governance.resolutions.manage` (manage, aal2: false), `governance.minutes.read` (read, aal2: false), `governance.minutes.finalize` (manage, aal2: true), `governance.meetings.read` (read, aal2: false)
- `communications` (4): `communications.notices.read` (read, aal2: false), `communications.notices.manage` (manage, aal2: false), `communications.notices.publish` (execute, aal2: true), `communications.feed.read` (read, aal2: false)
- `documents` (3): `documents.vault.manage` (manage, aal2: false), `documents.vault.upload` (execute, aal2: false), `documents.vault.read` (read, aal2: false)
- `security` (1): `security.access.read` (read, aal2: false)

---

## 4. Verification Suite Summary

- `npm run test:unit`: All 27 unit and slice contract test suites passed.
- `scripts/test-workspace-roles-slice.mjs`: All 6 contract suites passed.
- `scripts/test-workspace-roles-concurrency.mjs`: Multi-session concurrency rehearsal verified.
- `npm run typecheck`: Passed cleanly with zero errors (`tsc --noEmit`).
- `npm run lint`: Passed with zero warnings (`eslint . --max-warnings=0`).
- `node scripts/check-database-package.mjs`: Passed (103 migrations, 90 tests, 3063 assertions).
- Zero side-effects on finance/ledger, legacy delegations, or Migrations 100–102.

---

## 5. Deferred Register for 001B.2

| Topic | Design Commitment for 001B.2 | Target Slot |
| :--- | :--- | :---: |
| **Relational Delegations** | Model in `platform.workspace_delegations` | Migration 104 |
| **Delegation Permissions** | Relational table `platform.workspace_delegation_permissions` | Migration 104 |
| **Dual-Control Approval** | Independent table `platform.workspace_delegation_approvals` | Migration 104 |
| **Anti-Self-Approval** | Enforced constraint `approver_membership_id <> grantor_membership_id` | Migration 104 |
| **Delegation Depth** | Hardcoded ceiling `delegation_depth = 0` | Migration 104 |
| **Emergency Revocation** | Immediate single-party revocation RPC | Migration 104 |
| **pgTAP Delegation Suite** | Test 091 (`091_workspace_delegations.test.sql`) | Test 091 |

---

## 6. Final Sign-off Statement

Package `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1` is fully implemented, verified across static contracts, unit suites, and type-checks, and is prepared for Draft PR review. Remote apply remains **strictly unauthorized**. Status: **`READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`**.
