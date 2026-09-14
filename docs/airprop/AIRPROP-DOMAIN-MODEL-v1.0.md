# AIRPROP Domain Model v1.0

## Aggregate map

| Aggregate root | Key children | Shared references | Primary invariant |
| --- | --- | --- | --- |
| Investment Opportunity | sources, target facts, qualification | party, address/property candidate | cannot imply ownership |
| Underwriting Case | scenarios, assumptions, cash flows, sensitivities | opportunity, currency | published result is immutable/versioned |
| Due Diligence Case | checklist, finding, resolution, evidence | opportunity/acquisition, vault document | blocking finding prevents approval |
| Acquisition | approvals, consideration, closing costs, milestones | property, parties, journals | one accepted closing per idempotency key |
| Property Interest | legal/economic roles, percentage, validity | property, party/legal entity | no overlapping contradictory interest |
| Asset Business Plan | budget, KPI, CapEx proposal | property, periods | approved baseline is versioned |
| Valuation | method, assumptions, amount, valuer evidence | property, currency | no silent overwrite |
| Lease Commercial Schedule | rent steps, indexation, concessions | shared lease | charge schedule stays within lease term |
| Security Deposit | receipt, liability, allocation, return | lease, bank transaction, journal | never recognized as rent on receipt |
| Handover | inspection, inventory, readings, signatures | lease, unit, documents | accepted snapshot is immutable |
| Management Mandate | services, SLA, limits, validity | owner party, properties | commands prohibited outside active scope |
| Owner Approval | request, decision, evidence | mandate, expense/work order | proposer cannot self-approve controlled action |
| Management Fee | rule, calculation, invoice | mandate, period | fee separated from owner funds |
| Owner Statement | opening, receipts, expenses, fees, payout, closing | mandate, journals, reconciliation | statement must reconcile to ledger |
| Client Money Position | receipt, payable, approved disbursement | owner, property, bank transaction | owner balance cannot be overdrawn |
| Disposal Case | valuation, offers, approval, closing | property interest, buyer, documents | sale cannot finalize before authority/evidence |

## Required value objects

- Money: amount, ISO currency and exchange-rate evidence.
- Effective period: valid-from and valid-to with non-overlap checks.
- Jurisdiction: country, subdivision, rule-pack version and effective date.
- Approval policy: amount threshold, proposer role, approver role and required AAL.
- Document reference: vault identifier, hash, classification and retention class.
- External reference: provider/system name, opaque identifier and verification state.

## Operating-model classification

Every active property must have one effective operating model:

- `OWN_ASSET`
- `LEASE_OPERATE`
- `THIRD_PARTY_MANAGEMENT`

Mixed arrangements require separate property interests or mandates; they must not be represented by ambiguous flags.

## Financial truth mapping

| Event | Debit | Credit |
| --- | --- | --- |
| Asset acquisition | investment property/asset | cash or acquisition payable |
| Capital improvement | qualifying asset/CapEx | cash or supplier payable |
| Rent invoice | tenant receivable | rental income |
| Deposit receipt | cash | tenant deposit liability |
| Owner rent collected by manager | client cash/clearing | owner payable |
| Management fee earned | owner receivable/payable offset | management-fee income |
| Approved owner expense | owner expense/receivable | supplier payable/cash |
| Owner payout | owner payable | client cash |
| Disposal | cash/receivable plus carrying-value removal | asset and gain/loss balancing entries |

Exact chart-of-account mappings belong to the accounting rule pack and require accountant acceptance.

## Command/query boundary

Commands use narrow server-side gateways with permission, context, AAL, lifecycle, idempotency and approval checks. Queries use redacted, context-scoped read models. Direct authenticated table writes remain prohibited.

## Data minimization

- Personal identity, bank and tax data are encrypted or tokenized where required.
- UI read models expose only task-relevant fields.
- AI receives redacted structured facts by default, not raw deeds, passports or bank credentials.
- Audit snapshots record decisions and identifiers, not unrestricted document contents.
