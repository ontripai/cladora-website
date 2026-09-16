# Migration & Test Contract — CLADORA-WORKSPACE-TAXONOMY-MUTATION-001 (v1.0)

## 1. Baseline Invariants

- **Repository:** `ontripai/cladora-website`
- **Base SHA:** `21fd73f0cdd5e556f4a53a2c3ba89bf70f650e4f`
- **Branch:** `feat/cladora-workspace-taxonomy-mutation-001`
- **Prior Package Contract:** 100 migrations, 87 pgTAP tests, 2825 assertions.
- **Updated Package Contract:** 101 migrations, 88 pgTAP tests, 2855 assertions.
- **Byte-Identical Preservation:** Migrations 1–100 and Tests 1–087 remain byte-identical to `main`.

---

## 2. Migration 101 Specifications

- **File:** `supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql`
- **Key Objects:**
  1. Permission: `workspace.taxonomy.manage` in `identity.permissions`.
  2. Role Grants: Granted to `association_admin` and `property_manager` in `identity.role_permissions`.
  3. Registry Table: `platform.workspace_taxonomy_idempotency` with unique `(tenant_id, idempotency_key)`.
  4. Trigger Function: `app_private.guard_workspace_taxonomy_assignment_v1()` forward update allowing `review_required` when a non-empty `notes` is provided.
  5. Mutation RPC: `customer_api.assign_workspace_taxonomy_v1`:
     - Parameters:
       - `p_context_id uuid`
       - `p_property_profile_code text`
       - `p_operating_model_code text`
       - `p_country_code text`
       - `p_idempotency_key uuid`
       - `p_expected_assignment_id uuid default null`
       - `p_reason text default null`
     - Returns: `jsonb` containing `workspace_id`, `assignment_id`, `previous_assignment_id`, `property_profile_code`, `operating_model_code`, `country_code`, `compatibility_status`, `valid_from`, `idempotent_replay`, `audit_event_id`.

---

## 3. pgTAP Test 088 Specifications

- **File:** `supabase/tests/088_workspace_taxonomy_mutation.test.sql`
- **Transaction:** `BEGIN; ... ROLLBACK;`
- **Plan:** Exactly 30 assertions (`select plan(30);`).
- **Covered Scenarios:**
  1. Table & permission existence.
  2. Anonymous caller rejection (`authentication_required`).
  3. Inactive membership caller rejection (`customer_context_access_denied`).
  4. User lacking `workspace.taxonomy.manage` rejection (`workspace_taxonomy_manage_permission_required`).
  5. AAL1 caller rejection (`mfa_required`).
  6. Empty country code rejection (`workspace_taxonomy_country_code_required`).
  7. Inactive / unknown catalog version rejection (`workspace_taxonomy_catalog_version_not_current`).
  8. Incompatible combination rejection (`workspace_taxonomy_incompatible`).
  9. Review-required combination without reason rejection (`workspace_taxonomy_review_reason_required`).
  10. Initial assignment creation on unassigned workspace.
  11. Active assignment and audit event verification.
  12. Idempotent replay returns identical payload with `idempotent_replay = true`.
  13. Idempotent replay does not generate extra audit event.
  14. Conflicting payload with same key rejected (`workspace_taxonomy_idempotency_conflict`).
  15. Stale / mismatched expected assignment ID rejected (`workspace_taxonomy_expected_assignment_conflict`).
  16. Missing expected assignment ID on assigned workspace rejected (`workspace_taxonomy_expected_assignment_conflict`).
  17. Transition with matching expected assignment ID succeeds.
  18. Previous assignment superseded with `valid_to` set.
  19. Single active assignment remains.
  20. `WORKSPACE_TAXONOMY_TRANSITIONED` audit event generated.
  21. Review-required transition with valid reason succeeds.
  22. Complete historical assignment chain retained.
  23. Physical deletion of assignment history blocked (`workspace_taxonomy_assignment_history_immutable`).
  24. Direct update of assignment history blocked (`workspace_taxonomy_assignment_history_immutable`).
  25. Cross-tenant context access denied (`customer_context_access_denied`).
  26. Strict tenant workspace isolation preserved.
  27. Zero overlapping active assignment periods exist.
  28. Zero financial journal or ledger side-effects occurred.
