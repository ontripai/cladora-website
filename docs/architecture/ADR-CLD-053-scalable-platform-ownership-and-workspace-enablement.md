# ADR-CLD-053 — Scalable platform ownership and workspace enablement

Status: Proposed, 2026-09-25. Supersedes no prior decision. Implement in additive slices; this document alone changes no production permissions.

## Decision

CLADORA has two independent authorization planes. Platform staff manage customer acquisition, contracts, subscription finance, provisioning, training, and support in the Platform Control Plane. Customer members manage association operations in their own Workspace. A platform assignment never confers customer membership or unrestricted access to resident, meter, document, or financial records. A customer role never confers platform authority. Keep the existing short-lived, dual-controlled support-access exception from ADR-CLD-023.

Platform headcount scales by adding people to the same responsibility, not by creating a new global role per employee or per customer. One person may hold several platform roles. One workspace can have several collaborators, but exactly one current accountable commercial owner; ownership can be transferred with an audit trail and a designated replacement. Coverage is many-to-many, scoped, time-bounded, and separately revocable. Do not encode an employee's name as the authorization source.

One verified Auth account/email can simultaneously hold several internal platform responsibilities and, separately, several customer Workspace memberships. The immutable Auth user ID identifies the person; email is a contact and sign-in identifier, never an authorization key. Each assignment has its own scope, status and validity. Revoking sales coverage must not revoke the same person's finance, training or customer membership assignment. If a person has both platform and customer identities, require an explicit context selection and evaluate each plane separately. Do not create duplicate accounts merely because the same employee fills several positions during the early growth phase.

## Platform responsibility catalog

| Responsibility | Allowed scope | Prohibited / separate approval |
| --- | --- | --- |
| Super admin | Staff roles, customer coverage, policy and exception oversight | No routine customer private-data access or self-approved support grant |
| Platform operations manager | Work allocation, onboarding queue, capacity and provisioning for covered customers | Cannot certify a bank payment or grant unassigned customer access |
| Sales / commercial owner | Assigned leads, contact history, proposal, handover, training coordination and commercial status | Cannot mark a contract signed, certify payment, or override access expiry |
| Sales collaborator | Explicitly assigned lead/workspace tasks and customer communication | Cannot replace accountable owner or approve own deal |
| Contract reviewer | Contract evidence, signatures, term and commercial approval | Cannot certify funds received solely from sales data |
| Platform finance | Subscription invoices, independently verified receipts, paid-through dates | No association ledger or customer payment access by default |
| Onboarding / trainer | Configuration checklist, guided setup and training evidence | Customer actions require customer-granted delegation or dual-controlled support session |
| Technical support | Diagnostics, integration and provisioning incidents | No automatic access to customer private records |
| Platform auditor | Read-only audit and decision history | No mutations |

`PLATFORM_OPERATIONS`, `PLATFORM_FINANCE`, `PLATFORM_SUPPORT`, `PLATFORM_AUDITOR`, and `PLATFORM_SUPER_ADMIN` already exist. Sales, contract-review, and training capabilities are proposed; do not silently map them to Super Admin. An employee can combine responsibilities in an early team, but the contract and receipt decisions retain distinct approvers and evidence. If no independent approver is available, the decision remains pending rather than self-approved.

## Coverage and accountability

- A customer engagement begins as a lead with a named accountable commercial owner (platform user ID), optional sales collaborators, and an optional backup. Customer coverage is granted by a privileged platform actor; the sales owner cannot grant themselves further scope.
- Store each participant's responsibility, workspace/lead scope, grantor, reason, `valid_from`, `valid_until`, status and revoke/transfer history. Multiple staff members may hold the same responsibility across different or overlapping customer sets. Do not enforce arbitrary limits such as four, ten or twenty employees.
- Separate `accountable_owner` from `collaborator` and from `approver`. Transfer changes the single current owner atomically, records old and new owner, and preserves open tasks. Absence coverage uses an explicit temporary assignment, never credential sharing.
- Show each employee an assignment queue and each customer a single timeline: sales owner, contract reviewer, finance reviewer, onboarding lead, technical contact, approvals, expiry and blockers. Team managers see aggregates only within their coverage; Super Admin sees platform metadata and workload across customers.

## Lifecycle and approval gates

1. **Lead:** Sales records source, customer type, consent/contact history, owner and next action. A pilot tenant may already exist in `LEAD`; the real tenant/workspace identifiers remain stable through onboarding.
2. **Review / proposal:** Record scope, plan, price or pilot eligibility and documented customer decision. Commercial review cannot imply payment.
3. **Contract:** Record actual signed contract and its term with independent contract verification. `CONTRACT_PENDING` is not approval.
4. **Subscription finance:** Finance verifies subscription receipt, currency, amount, date, reference and paid-through term against evidence; building/resident payments do not count. The paid access basis must reference the active signed contract. A prepared payment reference alone is not bank automation.
5. **Timed pilot:** Authorized platform approver records reason, scope, owner and 24/48/72-hour duration. No fictional contract or payment. The clock starts at activation by the verified primary administrator, and expiry removes customer access including delegated memberships.
6. **Provisioning:** Only after an approved paid basis or timed pilot decision. Run idempotent setup tasks, verify tenant isolation and record the designated customer administrator. Preparing a basis creates no account and sends no email; any invitation is a separate explicit operation.
7. **Guided setup:** The customer administrator decides customer roles, building structure and delegations. Trainers may prepare recommendations and checklists; customer data changes require customer-scoped authorization or an approved, short-lived support grant.
8. **Active / renewal / expiry:** Finance handles subscription renewal, operations handles setup completion, sales handles relationship follow-up. Pilot expiry, suspension and contract termination stop customer access; commercial metadata and immutable audit remain available to authorized platform personnel.

The existing lifecycle, access-basis and provisioning guards remain authoritative. New workflow gates must be enforced in server/database operations; hiding buttons is insufficient. Neither sales nor support can move a workspace past contract or finance decisions by editing a status label.

## Customer Workspace authorization

The primary administrator belongs to the customer Workspace, not to CLADORA staff. They may propose or delegate scoped customer tasks (accounting, meter reading, maintenance, governance, auditor, owner, resident, vendor) only within their own authority, the applicable association appointment rules, active subscription/pilot term and Workspace scope. Independent auditor and payment approver appointments require their own evidence and separation rules. A customer may use the same email as a platform employee, but platform and customer permissions are evaluated independently and in an explicitly selected context.

## Delivery slices and acceptance

1. **Catalog and inventory:** Document existing RPCs/pages/roles and mark each platform capability as implemented, partial or missing. Publish two separate role matrices. No data or permission mutation.
2. **Platform coverage:** Add typed staff responsibility and customer coverage assignments, single accountable owner with audited transfer/backup, many collaborators, and a queue visible within scope. Migrate the current `commercial_owner` text as display-only historical data until matched deliberately to an active platform user. Verify cross-customer denial and reassignment.
3. **Commercial approvals:** Add sales handover, contract and independently reviewed subscription-payment evidence. Enforce transition gates and dual decision where needed. Test false receipt, expired contract, rejected decision and concurrent actions.
4. **Pilot and onboarding:** Reuse timed access bases, connect an onboarding checklist and trainer/support assignment, and verify exact expiry for primary admin and downstream users. Invitation sending remains a separately authorized action.
5. **Workspace delegation:** Let the primary administrator manage scoped local duties and appointments, then test each customer persona with real API permissions and expiration, separately from the demo.

Before applying a migration, review existing production migration history and rehearse the new version in CI. Roll out with audit evidence, a restricted pilot, and a rollback/disable path for newly introduced privileges. Avoid backfilling staff identity from free-text names automatically.

## Existing implementation and gaps (2026-09-25)

- Existing: five platform role types, `platform.platform_customer_assignments` with scope and validity, workspace lifecycle, contracts, provisioning, time-limited pilot/paid access bases, customer local roles and delegated grants.
- Gaps: `commercial_owner` is free text; sales, commercial approval, training and accountable-owner transfer are not structured platform responsibilities. Current operator creation accepts only operations, finance, support and auditor. There is no single reviewable cross-team onboarding queue and decision history connecting all handoffs.
- ADR-CLD-023 and customer-plane authorization remain in force. This proposal does not authorize a customer invitation, payment confirmation, role grant, or lifecycle change for the existing pilot.
