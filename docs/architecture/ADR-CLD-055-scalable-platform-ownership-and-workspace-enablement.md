# ADR-CLD-055 — Scalable platform ownership and workspace enablement

Version: 1.1, 2026-09-26. Status: architectural direction with partially implemented delivery slices. Reconciled against `main` at `695b09a981b7ead2243dd46e2657fc5a42c85818` (PR #145). This document changes no runtime permissions and does not certify end-to-end production acceptance.

Change log:
- v1.0, 2026-09-25: original proposal in PR #125, preserved verbatim in [historical proposal](history/scalable-platform-ownership-v1.0-proposal.md). Its provisional ADR-CLD-053 label collided with the existing commercial/pilot access decision and is not the current identifier.
- v1.1, 2026-09-26: assign unused ADR-CLD-055; reconcile specialist roles, staff responsibilities, case workflow and owner-portfolio pilot boundaries with merged implementation. Preserve outstanding acceptance gates. Supersedes the proposal's implementation inventory, not any existing ADR or permission boundary.

[ADR-CLD-053](ADR-CLD-053-commercial-and-pilot-access-bases.md) remains the commercial/workspace pilot decision. [ADR-CLD-054](ADR-CLD-054-customer-case-portal-v1.md) remains the customer case decision. Historical proposal text is not current deployment status.

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

The original five platform roles remain. `PLATFORM_SALES`, `PLATFORM_CONTRACTS` and `PLATFORM_ONBOARDING` were added by migrations `20260925063411` and `20260925063430`; multi-role operator assignment followed in `20260925070855`. Their presence does not grant customer-plane access or certify every proposed workflow as complete. Separate contract and receipt evidence/approvers remain an architectural requirement to verify per operation; do not infer independent approval merely from distinct role names. If independent approval is required but unavailable, the decision must remain pending.

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
5. **Timed pilot:** Authorized platform approver records reason, scope, owner and 24/48/72-hour duration. No fictional contract or payment. For workspace access bases under ADR-CLD-053, the clock starts at activation by the verified primary administrator, and expiry limits downstream memberships. The personal multi-unit-owner pilot is a different workflow: migration `20260925133513` starts its 24/48/72-hour term when the Super Admin activates an already claimed, verified case. It creates a personal tenant membership without building context grants. Do not describe this as a prepared workspace access basis or assume its clock waits for a later owner login.
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

## Implementation inventory and remaining acceptance (2026-09-26)

| Area | Evidence in the reviewed commit | Status / limit |
| --- | --- | --- |
| Typed workspace staff responsibilities and commercial-owner transfer | `supabase/migrations/20260925063350_platform_customer_responsibility_v1.sql`; `src/app/api/platform/v1/staff-responsibilities/route.ts` | Implemented slice: unique active commercial owner, collaborators, audited transfer/revocation. Existing free-text owner data must not be treated as authorization or automatically backfilled. Full lead-to-workspace task continuity is not certified here. |
| Specialist and multiple platform roles | Migrations `20260925063411`, `20260925063430`, `20260925070855`; `src/app/api/platform/v1/operators/roles/route.ts` | Implemented role catalog/operator support. These roles do not replace operation-specific scope and approval checks. |
| Start requests and customer cases | Migrations `20260925070917`, `20260925085832`, `20260925085859`; `src/components/cases/CasePortal.tsx` | Request queue, scoped case participants, messages and documents exist. Do not describe a complete cross-team onboarding process as verified solely from these screens. |
| Case/workspace preparation and approval validity | Migrations `20260925103854`, `20260925105455`, `20260925111146`, `20260925114332` | Multiple workspace references, preparation and validity guards exist. Linking does not independently grant customer membership or prove payment. |
| Portfolio/hybrid workspace primary administrators | Migration `20260925120244`; [ADR-CLD-031](../adr/ADR-CLD-031-portfolio-hybrid-primary-roles-v1.md) | Undefined primary-role paths remain restricted. Do not activate them by reusing an unrelated association/property-manager role. |
| Personal multi-unit owner | [ADR-CLD-032](../adr/ADR-CLD-032-multi-unit-owner-portfolio-v1.md); migrations `20260925124751` through `20260925143306`; PR #145 | Intake, private inventory, case-approved timed pilot, verified unit links, official charge read model, lease lifecycle and self-reported annual bookkeeping exist. This is distinct from `owner_portfolio_admin`; no automatic tax calculation or building-wide permission is implied. |
| Explicit platform/customer context choice | `src/lib/auth/post-auth-route.ts` | Current post-auth routing prioritizes platform access. The explicit dual-plane context-selection experience required above remains an acceptance gap, not a feature certified by this document. |

The delivery list above is a roadmap, not a list of operations to replay. Inspect live migration history and current source before any further rollout. Existing CI/component tests do not substitute for an authenticated end-to-end test of customer claim, MFA, approval, expiry, multi-role context selection and scoped unit access.

No customer invitation, email, payment confirmation, role grant, database migration or lifecycle action is authorized merely by merging this documentation. ADR-CLD-023 and customer-plane authorization remain in force. Remaining functionality must be implemented and tested through separate reviewed changes.
