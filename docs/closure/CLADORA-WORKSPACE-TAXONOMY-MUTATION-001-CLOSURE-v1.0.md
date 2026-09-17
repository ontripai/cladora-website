# Closure & Review Report — CLADORA-WORKSPACE-TAXONOMY-MUTATION-001 (v1.0)

**Status:** `READY-FOR-REVIEW / REMOTE-APPLY-NOT-AUTHORIZED`  
**Item In-Scope:** `DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`  
**Repository:** `ontripai/cladora-website`  
**Base SHA:** `21fd73f0cdd5e556f4a53a2c3ba89bf70f650e4f`  
**Branch:** `feat/cladora-workspace-taxonomy-mutation-001`  
**PR:** #100 (Draft)  
**Date:** 2026-09-17  

---

## 1. Executive Summary

This report documents the review-ready state of `CLADORA-WORKSPACE-TAXONOMY-MUTATION-001` following all review remediations (R1, R2, and R2A).

A canonical, fail-closed, transactional mutation gateway (`customer_api.assign_workspace_taxonomy_v1`) has been implemented to allow authorized administrators to assign and transition workspace taxonomy profiles and operating models with strict AAL2 MFA enforcement, granular `workspace.taxonomy.manage` permissions, independent exact role existence validation, automatic role bootstrap triggers for future administrative roles, catalog compatibility checks, deterministic versioned idempotency, advisory transaction locking, forward-only canonical `country_code` storage, a uniform `assignment_id` contract (explicit `assignment_id: null` across all unclassified and binding_required branches), latest-rule catalog/mutation parity, and transactional audit trail generation.

All strict boundaries were upheld:
- `Supabase Remote Apply: NOT PERFORMED (ZERO DDL/DML ON REMOTE)`
- `PR Status: DRAFT MAINTAINED (NOT MARKED READY / NOT MERGED)`
- `Production Redeploy: ZERO`
- `Customer Data Mutation: ZERO`
- `Auth/Credential Changes: ZERO`
- `session_replication_role = replica: ZERO USE`

---

## 2. Invariants & Deliverables

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
   - Contract passed: 101 migrations, 88 tests, 2891 assertions.
   - Migrations 1–100 and Tests 1–087 are verified 100% byte-identical to `origin/main`.
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
   - Real PostgreSQL multi-session race with advisory transaction locking, explicit blocker/blocked PID verification via `pg_blocking_pids`, loser SQLSTATE `40001`, and zero `session_replication_role = replica`.
7. **CI Workflow Integration:**
   - Path: `.github/workflows/database-tests.yml`
   - Mutation concurrency script integrated into triggers and `postgres-runtime` job.
8. **Security Advisor Delta:**
   - Finding `WSTAX-ADV-WARN-005` (`assign_workspace_taxonomy_v1`)
   - Finding `WSTAX-ADV-WARN-006` (`get_taxonomy_catalog_options_v1`)
   - Forward update coverage for `get_workspace_taxonomy_v1`
   - Documented as `PROPOSED-CONTROLLED-EXCEPTION` in `docs/security/CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-ADVISORY-EXCEPTION-v1.0.md`.
