# Discovery Report — CLADORA-WORKSPACE-TAXONOMY-MUTATION-001

## 1. Executive Summary

This Discovery Report documents the pre-implementation architectural findings, entity structures, authorization boundaries, and concurrency semantics for implementing the controlled, transactional workspace taxonomy mutation gateway (`customer_api.assign_workspace_taxonomy_v1`) in `ontripai/cladora-website`.

This task closes:
`DEFERRED-WORKSPACE-TAXONOMY-MUTATION-AUDIT`

Baseline SHA: `21fd73f0cdd5e556f4a53a2c3ba89bf70f650e4f`
Target Branch: `feat/cladora-workspace-taxonomy-mutation-001`
Allocated Slots: Migration 101 / pgTAP Test 088

---

## 2. Discovery Findings Matrix

| Status | Entity / Mechanism | Architectural Detail |
| :--- | :--- | :--- |
| **MATCH** | Registry Tables | `platform.property_profiles` (16), `platform.operating_models` (8), `platform.space_kinds` (21) populated from Migration 100 with versioned check constraints and multilingual labels. |
| **MATCH** | Compatibility Rules | `platform.property_operating_model_compatibilities` seeds exist and define canonical relationships (`compatible`, `review_required`, `incompatible`). |
| **MATCH** | Canonical Context Resolver | Context Grant -> Property Binding -> Customer Workspace resolution chain in `customer_api.get_workspace_taxonomy_v1` avoids guessing or single-workspace fallbacks. |
| **MATCH** | Audit Events Foundation | `audit.events` schema conforms to repository standard with actor role, before/after snapshots, and reason. |
| **EXTEND** | Transactional Mutation Gateway | `customer_api.assign_workspace_taxonomy_v1` added with mandatory UUID idempotency key, explicit country code, server-generated timestamps, optimistic concurrency control via `p_expected_assignment_id`, and atomic assignment closing/creation. |
| **EXTEND** | Idempotency Engine | `platform.workspace_taxonomy_idempotency` table created with unique `(tenant_id, idempotency_key)` to guarantee deterministic replays without duplicate assignments or duplicate audit events. |
| **EXTEND** | Forward Guard Update | `app_private.guard_workspace_taxonomy_assignment_v1` forward-updated in Migration 101 to permit `review_required` transitions when a non-empty review reason is provided. |
| **EXTEND** | Granular Identity Permissions | `workspace.taxonomy.manage` introduced into `identity.permissions` and granted to `association_admin` and `property_manager`. |
| **EXTEND** | Customer API Route & UI | Extended `/api/customer/v1/workspace/taxonomy` with `POST` handler enforcing same-origin, size limit, strict Zod schema validation, and trilingual management controls in `WorkspaceTaxonomyCard`. |
| **CONFLICT** | None | Migration 101 and Test 088 slots are free and uncontested. |
| **MISSING** | Mutation RPC & Test 088 | Fully designed and implemented in this task. |
| **DEFERRED** | Deferred Scope Items | `DEFERRED-LIVE-PAYMENT-PROVIDER`, Property Binding mutations, Building DNA / Service Profile mutations, Automatic Country Pack inference. |

---

## 3. Concurrency & Locking Semantics

1. **Per-Workspace Transactional Advisory Lock:**
   ```sql
   perform pg_advisory_xact_lock(hashtextextended('workspace_taxonomy_mutation:' || v_workspace.id::text, 0));
   ```
   Ensures concurrent requests targeting the same customer workspace serialize deterministically.
2. **Optimistic Concurrency Control:**
   - On initial assignment: `p_expected_assignment_id` must be `NULL`.
   - On transition: `p_expected_assignment_id` is mandatory and must match the currently active assignment ID.
   - Concurrency loser: When Client 1 commits a transition, Client 2 unblocks from the advisory lock, re-reads the active assignment, detects that `p_expected_assignment_id` does not match the newly active assignment, and is deterministically rejected with `workspace_taxonomy_expected_assignment_conflict` (`40001`).
