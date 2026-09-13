# CLADORA-P2-MONTHLY-001 — Canonical Monthly Financial Cycle

## Goal

Close Roadmap Stage 2 by orchestrating one auditable residential month from approved supplier costs and readings through allocation, unit billing, management review, publication, trial balance and immutable accounting-period close.

## Discovery verdict

| Capability | Current canonical source | Decision |
| --- | --- | --- |
| Supplier utility invoices | `utilities.provider_invoices` and lines | REUSE |
| Meter readings and consumption | `utilities.meter_readings` and consumption engine | REUSE |
| Allocation rules/runs/items | `finance.allocation_*` | REUSE + ORCHESTRATE |
| Unit invoices and receivables | `billing.invoices`, lines and receivables | REUSE |
| General ledger | `finance.journals` and entries | REUSE |
| Trial balance/reporting | Existing financial-report RPCs | REUSE |
| Immutable period close | `finance.close_accounting_period` | REUSE |
| End-to-end monthly state | No canonical aggregate exists | MISSING |
| President/censor review evidence | Cross-module monthly acknowledgement absent | MISSING |
| Published monthly-list snapshot | No immutable cycle-level publication artifact | MISSING |

## Forward-only implementation

Migration 87 will add only the orchestration and evidence layer. It must not duplicate invoices, allocations, journals, receivables, documents or communications.

### Proposed internal records

- `finance.monthly_cycles`: one cycle for `(tenant, property, accounting_period)` with a monotonic lifecycle.
- `finance.monthly_cycle_sources`: immutable references and hashes for supplier invoices, readings, allocation runs and supporting documents.
- `finance.monthly_cycle_reviews`: independent president/censor acknowledgements with AAL2 and role evidence.
- `finance.monthly_cycle_publications`: immutable publication snapshot/hash linked to canonical billing and communications records.
- `finance.monthly_cycle_exceptions`: blocking/warning exception queue with resolution evidence.

### Lifecycle

`draft → collecting → ready_for_calculation → calculated → pending_review → approved → published → close_ready → closed`

Cancellation is permitted only before publication. Posted journals, issued invoices, reviews and publication snapshots are never edited or deleted; corrections are forward-only.

## Required invariants

1. Exactly one live monthly cycle per property/accounting period.
2. Accounting period must be open until the final close action.
3. Only approved provider invoices and approved readings may enter the source snapshot.
4. Allocation input total equals allocation item total exactly per currency.
5. Every issued unit invoice is linked to the approved allocation run and canonical journal.
6. `GL 4111 = receivables outstanding` and `GL 419 = unallocated payments` before publication and before close.
7. Publication requires two independent AAL2 reviews: president and censor; neither may be the cycle preparer.
8. Publication freezes the unit-calculation snapshot and emits only provider-neutral communication work.
9. Period close delegates to the existing canonical close function and cannot bypass its locks/readiness checks.
10. Retry is idempotent and concurrent finalization has exactly one winner.

## API boundary

Versioned `customer_api` SECURITY INVOKER wrappers will delegate to guarded `app_private` routines:

- `create_monthly_cycle_v1`
- `collect_monthly_cycle_sources_v1`
- `calculate_monthly_cycle_v1`
- `get_monthly_cycle_v1`
- `submit_monthly_cycle_review_v1`
- `record_monthly_cycle_review_v1`
- `publish_monthly_cycle_v1`
- `get_monthly_cycle_exceptions_v1`
- `finalize_monthly_cycle_close_v1`

No internal finance table will be exposed directly through PostgREST.

## Test 072 acceptance matrix

- Synthetic tenant/property/units and open accounting period only.
- Approved supplier invoice and verified meter reading source capture.
- Deterministic allocation and balanced unit billing.
- Rejection of unapproved, cross-tenant, closed-period and altered sources.
- President/censor AAL2 dual review and self-review denial.
- Immutable published snapshot and forward-correction boundary.
- Continuous 4111/419 parity before publication and close.
- Five concurrent finalize attempts: one winner, no duplicate journal/invoice/publication.
- Full transaction rollback and zero persistent fixtures.

## Deferred boundaries

- Live PSP remains `DEFERRED-PAYMENT-PROVIDER-GATEWAY`.
- Provider refund/reversal remains `DEFERRED-PAYMENT-REVERSAL-PROVIDER`.
- Malware-unscanned documents cannot become authoritative source evidence.
- Romanian accountant acceptance is required before declaring Stage 2 closed.

## Implementation order

1. Create Migration 87 using Supabase CLI.
2. Add schema, indexes, guards and routines.
3. Add pgTAP Test 072 and a multi-connection concurrency runner.
4. Add route handlers and a trilingual monthly-cycle control surface.
5. Run static, runtime, typecheck, lint and build gates locally.
6. Use one feature-branch push and one Vercel Preview.
7. Apply remotely only after PR CI passes; then merge and verify production.

## Pre-implementation verdict

`READY-FOR-CLADORA-P2-MONTHLY-001-IMPLEMENTATION`
