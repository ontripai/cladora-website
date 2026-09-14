# ADR-AIRPROP-001 — AIRPROP Platform Boundary

**Status:** Proposed  
**Date:** 2026-09-14  
**Decision owner:** CLADORA product architecture

## Context

AIRPROP must support three legally and financially distinct operating models:

1. acquisition and disposal of real estate owned by the operating group;
2. letting and operation of owned or leased real estate; and
3. management of third-party real estate for a fee or under contract.

The first pilot is synthetic and Bucharest-focused. Dubai is a future country pack, not a current integration or operational claim.

CLADORA already provides tenant isolation, context grants, property/building/unit registries, parties and ownerships, occupancy and leases, immutable double-entry accounting, billing, payments, bank reconciliation, private documents, maintenance, procurement and audit evidence. Forking those engines would create inconsistent identity, money and evidence.

## Decision

AIRPROP is a fourth product experience on the shared CLADORA core. It owns investment, asset-management and third-party-management semantics but does not own a second identity system, property registry, ledger, payment rail, document vault, maintenance engine or audit log.

### Shared-core ownership

| Capability | Authoritative owner |
| --- | --- |
| Tenant, workspace, membership, role and context | `platform` / `identity` |
| Address, property, building, unit, party and ownership | `portfolio` |
| Occupancy and base lease | `occupancy` |
| Accounts, journals, billing, payments and reconciliation | `finance` / `billing` / `payments` |
| Documents and scan attestations | `documents` / export vault contracts |
| Work orders, vendors and procurement | maintenance/procurement domains |
| Immutable operational evidence | `audit` |
| Investment, mandate, valuation and disposal semantics | `airprop` |

### AIRPROP bounded contexts

| Context | Responsibility | Explicit exclusion |
| --- | --- | --- |
| Opportunity | lead, target asset, source and qualification | no ownership claim |
| Underwriting | assumptions, scenarios, NOI, yield and IRR | no posted journal |
| Due Diligence | controlled checklist, findings and evidence links | no legal certification claim |
| Acquisition | approval, consideration, costs and closing state | no fund movement by itself |
| Asset Management | business plan, KPI, CapEx and valuation | no parallel maintenance engine |
| Leasing | commercial schedule, indexation, deposit and handover | base parties/lease remain shared |
| Management Mandate | owner contract, scope, SLA and approval limits | no association-governance substitution |
| Client Money | owner payable, controlled expense and payout intent | no commingling or provider custody |
| Disposal | valuation, offer, approval and closing pack | no automated transfer of title |
| Country Pack | versioned legal, fiscal, document and license rules | no country logic embedded in core |

## Non-negotiable invariants

- Every business row is tenant-bound and, where applicable, property-bound.
- A single real-world property has one canonical `portfolio.properties` identity.
- Posted journals remain immutable and balanced; AIRPROP never writes a parallel ledger.
- Tenant deposits and third-party owner funds are liabilities, never management revenue.
- Only earned management fees become AIRPROP operating income.
- Acquisition, disposal, payout, bank-account change and deposit consumption require AAL2 and independent approval.
- AI output is advisory evidence until an authorized human accepts it.
- Country rules are versioned, effective-dated and fail closed when a required rule is absent or expired.
- Documents are referenced through the private vault; secrets and unrestricted object paths are never exposed.
- Idempotency keys protect every command that could create financial or legal evidence.

## Multi-entity rule

The platform tenant is the operational security boundary, not proof of legal ownership. A property interest identifies the legal owner, beneficial owner, lessor, lessee/operator and managing agent separately. Cross-company reporting may aggregate authorized read models, but commands and journals remain within their legal-entity tenant.

## Lifecycle separation

`opportunity -> underwriting -> due_diligence -> approved -> acquired -> operating -> disposal_review -> sold`

An asset may enter AIRPROP as already owned or already managed, but bypasses must record source evidence and approval. A management mandate follows its own lifecycle:

`draft -> owner_review -> active -> suspended -> terminating -> closed`

Closing a mandate revokes future command authority but preserves accounting, document and audit evidence.

## Consequences

### Positive

- Reuses the proven CLADORA security and accounting foundation.
- Enables Bucharest and Dubai without branching the product core.
- Keeps own assets, leased operations and third-party mandates financially distinguishable.
- Allows incremental delivery with synthetic fixtures.

### Costs

- Existing unit-centric ownership must be extended for whole-property interests.
- Lease records need commercial schedules, deposits and event history.
- Third-party client-money controls require stronger reconciliation and dual approval.
- Romania and Dubai rules require qualified local review before production activation.

## Rejected alternatives

1. **Separate AIRPROP application and database:** rejected because it duplicates identity, property, ledger and audit truth.
2. **Add fields directly to Association OS screens:** rejected because acquisition and third-party mandates are different bounded contexts.
3. **Hard-code Romania first and refactor later:** rejected because legal/fiscal rules must be effective-dated country packs.
4. **Fully autonomous transaction agent:** rejected because legal acts and money movement require human authority and segregation of duties.
