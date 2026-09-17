# Architecture & Discovery Report — Workspace-Local Roles & Effective Permissions (001B.1)

**Document Identifier:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-DISCOVERY-v1.0`  
**Package:** `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1 — Workspace-local Roles, Module Scoping & Effective Permission Engine`  
**Release:** `001B.1` (Migration 103 / Test 090)  
**Status:** `READY-FOR-REVIEW / 001B.1-IMPLEMENTED / REMOTE-APPLY-NOT-AUTHORIZED`  
**Baseline SHA:** `6c354801abc1dc72a4f7b0697c360a155bde5097` (`origin/main`)  
**Deferred Milestone:** `001B.2` (Migration 104 / Test 091 — Controlled Delegation & Independent Dual Approvals)  

---

## 1. Executive Summary & Non-Negotiable Invariants

### 1.1 The Cardinal Invariant
```
Workspace Taxonomy ≠ Module Activation ≠ Entitlement ≠ Permission ≠ Role ≠ Delegation ≠ Country Pack
```
No layer implicitly grants any other layer. Every boundary is strictly explicit, orthogonal, relational, and evaluated fail-closed.

### 1.2 Formal Release Decoupling
* **Release 001B.1 (Implemented in Migration 103):**
  - Six relational tables in `platform` schema (`module_permission_bindings`, `workspace_roles`, `workspace_role_modules`, `workspace_role_permissions`, `workspace_member_roles`, `workspace_role_idempotency`).
  - Versioned module-permission registry with temporal validity and exactly one active version per mapping.
  - Four administrative permission seeds in `identity.permissions` (`workspace.role.read`, `workspace.role.manage`, `workspace.role.publish`, `workspace.role.assign`).
  - Strict separation of business revisions (`role_version`) from concurrency tokens (`lock_version`).
  - Atomic transition `published -> archived` on supersession. Zero physical deletion of roles or assignments.
  - Scope ceiling and ancestry enforcement across `workspace`, `property`, `building`, and `unit`.
  - Deny-first effective permission resolution engine (`app_private.check_effective_permission_v1`).
  - Protected Next.js customer API routes with Zod validation, 16KB body limit, and AAL2 step-up links.
  - Server-authoritative trilingual UI (`ro`, `en`, `fa` with RTL support).
  - Explicit non-negotiable rule: **`is_delegable = false` across all registry rows in Migration 103**.
* **Release 001B.2 (Deferred to Migration 104):**
  - Controlled delegation tables, approval dual-control tables, anti-self-approval constraints, bounded delegation depth (`delegation_depth = 0`), and emergency revocation RPCs.

---

## 2. Versioned Module–Permission Binding Registry

To prevent orthogonal permission leakage (e.g. assigning a financial permission to a role that is only bound to maintenance) while supporting forward-only schema evolution:

### 2.1 Table Schema: `platform.module_permission_bindings`
- `module_definition_id uuid references platform.module_definitions(id) on delete restrict`
- `permission_id uuid references identity.permissions(id) on delete restrict`
- `binding_version integer not null default 1 check (binding_version >= 1)`
- `permission_mode text check (permission_mode in ('read', 'manage', 'execute', 'admin'))`
- `is_assignable_to_local_role boolean not null default true`
- `is_delegable boolean not null default false` (Enforced `false` in 001B.1 by trigger)
- `requires_aal2 boolean not null default false`
- `lifecycle_status text check (lifecycle_status in ('active', 'deprecated', 'retired'))`
- `valid_from timestamptz not null default statement_timestamp()`
- `valid_to timestamptz check (valid_to is null or valid_to > valid_from)`
- `unique (module_definition_id, permission_id, binding_version)`
- Partial unique index: `where (lifecycle_status = 'active' and valid_to is null)`

### 2.2 Proven 48-Mapping Manifest
Every permission in the registry is proven from active migration files:
- `occupancy` (2): `occupancy.occupancies.manage`, `occupancy.registry.read`
- `billing` (4): `billing.manage`, `billing.issue`, `billing.cancel`, `billing.receivables.read`
- `payments` (5): `payments.manage`, `payments.allocate`, `payments.reverse`, `payments.reconcile`, `payments.reconciliation.read`
- `accounting` (1): `finance.ledger.read`
- `maintenance` (11): `maintenance.requests.read`, `maintenance.requests.create`, `maintenance.requests.manage`, `maintenance.requests.assign`, `maintenance.work_orders.read`, `maintenance.work_orders.manage`, `maintenance.work_orders.verify`, `maintenance.procurement.read`, `maintenance.procurement.manage`, `maintenance.procurement.approve`, `maintenance.assets.read`
- `utilities` (6): `utilities.manage`, `utilities.readings.capture`, `utilities.readings.approve`, `utilities.tariffs.manage`, `utilities.billing.create`, `utilities.metering.read`
- `governance` (11): `governance.meetings.manage`, `governance.agenda.manage`, `governance.attendance.manage`, `governance.proxies.manage`, `governance.votes.cast`, `governance.votes.administer`, `governance.resolutions.read`, `governance.resolutions.manage`, `governance.minutes.read`, `governance.minutes.finalize`, `governance.meetings.read`
- `communications` (4): `communications.notices.read`, `communications.notices.manage`, `communications.notices.publish`, `communications.feed.read`
- `documents` (3): `documents.vault.manage`, `documents.vault.upload`, `documents.vault.read`
- `security` (1): `security.access.read`
- Catalog-only modules (`core_property_registry`, `contracts_tenancy`) have exactly zero bindings.

---

## 3. Disambiguated Versioning: `role_version` vs `lock_version`

* **`role_version`**: Business revision identifier for `(customer_workspace_id, code)`. Increments only when a published role is superseded by creating a new revision.
* **`lock_version`**: Optimistic concurrency token. Increments on every draft mutation. Mutation RPCs accept `p_expected_lock_version integer`; mismatch raises SQLSTATE `40001` (`workspace_role_expected_lock_version_conflict`).
* **Supersession State Machine**: The only permitted transition on a published role is `published -> archived` with `valid_to = statement_timestamp()`, executed atomically inside `publish_workspace_role_v1`. Direct DELETE or UPDATE on published roles is strictly prohibited.

---

## 4. Deny-First Effective Permission Resolution Engine

$$\text{Effective Permission} = \text{Common Gates} \;\land\; \neg(\text{Applicable Scoped Deny}) \;\land\; (\text{Any Applicable Allow})$$

1. **Common Gates (Evaluated Fail-Closed):**
   - Active membership & context grant for `auth.uid()`.
   - Deterministic workspace resolution.
   - Active module installation & valid active entitlement.
   - Compatible taxonomy assignment (both profile and operating model = `'compatible'`).
   - Active module-permission binding with `is_assignable_to_local_role = true`.
   - Target object scope containment within workspace property bindings.
2. **Deny-First Evaluation:**
   - Evaluates applicable denys across both Path A (System role) and Path B (Workspace-local roles).
   - A deny at `property` scope automatically denies child `buildings` and `units`.
   - A deny at `building` scope automatically denies child `units`.
   - If any applicable deny is found -> immediately returns `FALSE`.
3. **Allow Evaluation:**
   - Only evaluated if zero applicable denys exist.
   - Returns `TRUE` if either Path A Allow or Path B Allow encompasses target scope; else `FALSE`.
4. **Gateway Isolation:** Existing Migration 1–102 gateways are NOT migrated to this helper.

---

## 5. Ten Customer Gateway RPCs

1. `customer_api.get_workspace_roles_v1(uuid)` (STABLE)
2. `customer_api.create_workspace_role_draft_v1(...)` (VOLATILE)
3. `customer_api.attach_workspace_role_module_v1(...)` (VOLATILE)
4. `customer_api.detach_workspace_role_module_v1(...)` (VOLATILE)
5. `customer_api.attach_workspace_role_permission_v1(...)` (VOLATILE)
6. `customer_api.detach_workspace_role_permission_v1(...)` (VOLATILE)
7. `customer_api.snapshot_workspace_role_template_permissions_v1(...)` (VOLATILE)
8. `customer_api.publish_workspace_role_v1(...)` (VOLATILE)
9. `customer_api.assign_workspace_role_v1(...)` (VOLATILE)
10. `customer_api.revoke_workspace_role_assignment_v1(...)` (VOLATILE)

All mutations enforce context resolution, mandatory trimmed reason (>= 5 chars), advisory locking, optimistic lock checking (`40001`), versioned idempotency snapshotting (`request_hash_version = 1`), and atomic audit event generation in `audit.events`.

---

## 6. Deferred Register for 001B.2

| Topic | Commitment for Release 001B.2 |
| :--- | :--- |
| **Relational Delegations** | Model in `platform.workspace_delegations` (Migration 104) |
| **Delegation Permissions** | Pure relational table `platform.workspace_delegation_permissions` |
| **Dual-Control Approval** | Independent table `platform.workspace_delegation_approvals` |
| **Anti-Self-Approval** | Relational constraint `approver_membership_id <> grantor_membership_id` |
| **Delegation Depth** | Hardcoded ceiling `delegation_depth = 0` (no re-delegation) |
| **Emergency Revocation** | Immediate single-party revocation RPC |
| **Country Pack Policy** | Remains deferred under `DEFERRED-COUNTRY-PACK-MODULE-POLICY` |
