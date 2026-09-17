# Closure & Review Report — CLADORA-WORKSPACE-TAXONOMY-MUTATION-001 (v1.0)

**Document Identifier:** `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-CLOSURE-v1.0`
**Status:** `APPLIED-REMOTE / LOCAL-101-REMOTE-101-DRIFT-0 / MERGED-TO-MAIN / PRODUCTION-VERIFIED / CONTROLLED-ADVISORIES-ACCEPTED`
**Item In-Scope:** `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`
**Repository:** `ontripai/cladora-website`
**Base SHA:** `21fd73f0cdd5e556f4a53a2c3ba89bf70f650e4f`
**Merged PR:** [#100](https://github.com/ontripai/cladora-website/pull/100)
**Squash Merge SHA:** `78e14045c6bd2079989f537be73d2cef3db75587`
**Supabase Production Project Ref:** `jyomlehahwlyqzoacrvp`
**Date:** 2026-09-17

---

## 1. Executive Summary & Release Verification

This report documents the completed production delivery, release evidence, and operational acceptance for `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001`.

The transactional mutation gateway (`customer_api.assign_workspace_taxonomy_v1`), accompanying catalog options RPC (`customer_api.get_taxonomy_catalog_options_v1`), forward-updated taxonomy resolver (`customer_api.get_workspace_taxonomy_v1`), and responsive trilingual UI (`WorkspaceTaxonomyCard.tsx`) are verified live on both Supabase Remote and Vercel Production.

### Production Release Evidence:
1. **Migration 101 Applied to Supabase Remote:**
   - Migration `20260916120000_workspace_taxonomy_mutation.sql` applied exactly once via `supabase db push --linked`.
   - Inventory: **Local 101 / Remote 101 / Drift 0**.
2. **Health & Concurrency Audits:**
   - Active Blocking Queries (`pg_blocking_pids`): **0 rows (zero contention)**.
3. **Security Advisor Statement:**
   > Security Advisor reviewed: 6 controlled SECURITY DEFINER gateway warnings and 8 deny-by-default RLS informational findings remain. All findings are documented with explicit owners, access boundaries, fixed search paths and compensating controls. No unexpected new finding or privilege exposure was detected.
4. **Pull Request & Main Branch:**
   - PR #100 was marked ready for review and squash-merged into `main` at commit `78e14045c6bd2079989f537be73d2cef3db75587`.
5. **Database Package Totals:**
   - Package status: **101 migrations / 88 tests / 2891 assertions**.
   - Migrations 1–100 and Tests 1–087 are 100% byte-identical to `origin/main` baseline.
6. **Production Deployment (Vercel):**
   - Deployment ID: `dpl_ATQio2G6qX6FBGV5j17w3eYNmT9s`
   - State: `READY`
   - Target Git SHA: `78e14045c6bd2079989f537be73d2cef3db75587`
   - Production Aliases:
     - `cladora.ro`
     - `www.cladora.ro`
     - `cladora-website.vercel.app`

---

## 2. Invariants & Delivered Components

1. **Database Migration 101:**
   - Path: `supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql`
   - SHA-256: `57474646523CCC07885BB03237BA815A7EA74E91D7F221DD5EC52279E6590129`
   - Scope:
     - Exact independent role existence validation (`app_private.validate_workspace_taxonomy_manage_seeding_v1()`) ensuring both `association_admin` and `property_manager` exist independently with deterministic error messages (`required_target_role_missing: <role>`).
     - Permission `workspace.taxonomy.manage` seeded without `DO UPDATE`.
     - Future role bootstrap trigger (`trg_bootstrap_role_taxonomy_permissions`).
     - Canonical `country_code` column on `platform.workspace_taxonomy_assignments`.
     - Forward updates to `guard_workspace_taxonomy_assignment_history_v1` and `guard_workspace_taxonomy_assignment_v1` (with latest rule_version ordering).
     - Catalog options RPC `customer_api.get_taxonomy_catalog_options_v1` with latest-rule filtering (`DISTINCT ON (p.code, m.code) ... ORDER BY p.code, m.code, c.rule_version desc`).
     - Resolver `customer_api.get_workspace_taxonomy_v1` with uniform `assignment_id` contract (`v_assignment.id` when active, explicit `null` for unclassified and all binding_required branches).
     - Transactional mutation RPC `customer_api.assign_workspace_taxonomy_v1`.
2. **pgTAP Test 088:**
   - Path: `supabase/tests/088_workspace_taxonomy_mutation.test.sql`
   - SHA-256: `71EFC3C015AAC09E7715C604DE767773F07E9EBF9F7F821E4AF7660BD162EBA7`
   - Plan: Exact 66 planned and executed assertions in `BEGIN; ... ROLLBACK;`.
   - Coverage:
     - Remediation 1 & R2A: Active workspace returns canonical `assignment_id`; unassigned and unbound property contexts return explicit `null` with `binding_required`/`unclassified` status.
     - Remediation 2: Exact role validation tested with 2 `association_admin` and 0 `property_manager` (proving raw count cannot trick it) and 0 `association_admin`.
     - Remediation 3: Options RPC excludes future profiles and expired models; returns exactly 1 entry for current profile/model pair with latest `rule_version` level; zero duplicate pairs; and mutation RPC evaluates with identical latest rule.
     - End-to-End Transition Contract: Full 10-step sequence verifying GET active `assignment_id`, payload conversion, successful transition, rejection of stale/null IDs with SQLSTATE `40001`, exact post-transition entity counts (1 active, 1 superseded, 1 audit event, 1 idempotency record), and idempotent retry with zero duplicate writes.
3. **Database Package Invariant:**
   - Contract verified: 101 migrations, 88 tests, 2891 assertions.
   - Migrations 1–100 and Tests 1–087 are verified 100% byte-identical to prior baseline.
4. **API Route Handlers & Zod Schemas:**
   - Path: `src/lib/customer/workspace-taxonomy-schema.ts` (`assignment_id: uuidSchema.nullable().optional()`).
   - Path: `src/app/api/customer/v1/workspace/taxonomy/route.ts` (GET and POST with same-origin check, body size limit, strict Zod validation, authoritative client auth, and structured error mapping).
   - Path: `src/app/api/customer/v1/workspace/taxonomy/options/route.ts` (GET options).
5. **Customer UI Component:**
   - Path: `src/components/workspace/WorkspaceTaxonomyCard.tsx`
   - Forwards exact active `assignment_id` as `expected_assignment_id` for transitions; uses `null` for initial assignments. Zero client-side ID extraction fallback.
   - Server-authoritative catalog options and compatibility evaluation (zero client hardcoding, zero compatible fallback), country code input, `canManage` derived from server permissions, and real MFA step-up link to `/${lang}/mfa`.
6. **Multi-Session Concurrency Rehearsal:**
   - Path: `scripts/test-workspace-taxonomy-mutation-concurrency.mjs`
   - Real PostgreSQL multi-session race with advisory transaction locking, explicit blocker/blocked PID verification via `pg_blocking_pids`, loser SQLSTATE `40001`, and zero replica trigger bypass.
7. **CI Workflow Integration:**
   - Path: `.github/workflows/database-tests.yml`
   - Concurrency tests integrated into CI runner under `postgres-runtime`.
8. **Security Exception Register:**
   - Path: `docs/security/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md`
   - Status: `ACCEPTED-CONTROLLED-EXCEPTION` for all 6 `customer_api` gateway functions and `ACCEPTED-DENY-BY-DEFAULT-INFORMATIONAL` for all 8 `platform.*` tables.

---

## 3. Review Findings & Remediation Log

| Remediation Phase | Scope | Status |
| :--- | :--- | :---: |
| `R1` | Fail-closed context resolver, forward-only `country_code` storage, dynamic options endpoint, and true multi-session concurrency rehearsal. | **RESOLVED** |
| `R2` | Explicit `assignment_id` in resolver, independent role validation, and catalog options latest-rule parity. | **RESOLVED** |
| `R2A` | Uniform `assignment_id: null` contract across all `binding_required` and `unclassified` branches. | **RESOLVED** |
| `ADVISORY-DOC` | Formal post-release evidence recording and acceptance of Security Advisor findings. | **RESOLVED** |

---

## 4. References & Standards

- [CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md](../contracts/CLADORA-WORKSPACE-TAXONOMY-MUTATION-CONTRACT-v1.0.md)
- [CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md](../security/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md)
- [ADR-CLD-052: Universal Managed Property Workspaces](../architecture/ADR-CLD-052-universal-managed-property-workspaces.md)
- [CLADORA-CONTROLLED-DOCUMENTATION-MASTER-INDEX-v1.0.md](../CLADORA-CONTROLLED-DOCUMENTATION-MASTER-INDEX-v1.0.md)
