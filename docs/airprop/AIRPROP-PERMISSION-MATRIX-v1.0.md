# AIRPROP Permission Matrix v1.0

## Roles

| Role code | Purpose | Default scope |
| --- | --- | --- |
| `airprop_portfolio_director` | portfolio strategy and final business approval | tenant/property set |
| `airprop_acquisition_manager` | opportunity, underwriting and acquisition workflow | assigned properties/cases |
| `airprop_asset_manager` | plans, KPI, valuation and disposal preparation | assigned properties |
| `airprop_property_manager` | mandate operations and owner coordination | mandate properties |
| `airprop_leasing_manager` | applicant, lease and handover workflows | assigned properties/units |
| `airprop_finance_controller` | accounting control, payout and reconciliation approval | legal-entity tenant |
| `airprop_accountant` | journals, billing and statements within granted duties | legal-entity/property |
| `airprop_maintenance_coordinator` | work-order and vendor coordination | assigned properties |
| `airprop_owner_client` | read own property, approvals and statements | own mandate/property |
| `airprop_tenant` | read own lease, charges, deposit and documents | own unit/lease |
| `airprop_auditor` | immutable read-only evidence | explicitly assigned scope |

## Permission catalogue

| Permission | Director | Acquisition | Asset | Property mgr | Leasing | Controller | Accountant | Owner | Tenant | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `airprop.opportunity.read` | A | A | A | — | — | R | R | — | — | R |
| `airprop.opportunity.manage` | A | A | — | — | — | — | — | — | — | — |
| `airprop.underwriting.manage` | A | A | A | — | — | R | R | — | — | R |
| `airprop.due_diligence.manage` | A | A | A | — | — | R | — | — | — | R |
| `airprop.acquisition.approve` | A* | P | R | — | — | A* | R | — | — | R |
| `airprop.asset.read` | A | R | A | A | A | A | A | R | limited | R |
| `airprop.asset_plan.manage` | A | — | A | P | — | R | R | P | — | R |
| `airprop.lease.manage` | R | — | R | A | A | R | R | R | limited | R |
| `airprop.deposit.manage` | R | — | — | P | P | A* | R | R | R | R |
| `airprop.mandate.manage` | A | — | A | A | — | R | R | P | — | R |
| `airprop.owner_expense.propose` | R | — | P | A | — | R | P | R | — | R |
| `airprop.owner_expense.approve` | A* | — | P | P | — | A* | R | A* | — | R |
| `airprop.owner_statement.publish` | R | — | R | P | — | A* | P | R | — | R |
| `airprop.owner_payout.approve` | A* | — | — | P | — | A* | P | R | — | R |
| `airprop.valuation.manage` | A | — | A | — | — | R | R | R | — | R |
| `airprop.disposal.approve` | A* | — | P | — | — | A* | R | — | — | R |
| `airprop.audit.read` | A | R | R | R | R | A | R | own | own | A |

Legend: `A` allowed, `R` read, `P` propose, `—` denied, `*` AAL2 plus independent approval. Matrix entries are ceilings; assignments, context and lifecycle may further restrict access.

## Segregation-of-duties rules

1. A proposer cannot approve the same acquisition, disposal, deposit consumption, owner expense or payout.
2. Bank-detail changes require a verified owner channel and two independent AAL2 actors.
3. The user calculating a management fee cannot be the sole publisher of the owner statement containing it.
4. A property manager cannot post a journal merely because they can approve an operational task.
5. Support impersonation never grants financial command authority.
6. Auditor access is read-only, assignment-scoped and time-bounded.
7. Owner and tenant roles never traverse to another mandate, property, unit or lease.
