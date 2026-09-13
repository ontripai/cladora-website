# CLADORA-P2-BANK-002 — Assisted Bank Matching, Reconciliation Exceptions & Approval Workflow

## Objective

Extend the canonical reconciliation engine delivered by BANK-001. Generate conservative, reviewable match proposals from committed statement rows, route ambiguous or unmatched items into an exception queue, and require independent AAL2 approval before a proposal becomes confirmed.

## Canonical reuse decision

| Area | Decision |
| --- | --- |
| `payments.bank_transactions` | Reuse as committed statement truth |
| `payments.reconciliation_matches` | Extend with run provenance, proposer and reviewer evidence |
| `payments.reconciliation_sessions` | Reuse unchanged for zero-difference close |
| `payments.payments` / `payment_intents` | Reuse as candidate sources |
| Matching runs | Add bounded, idempotent orchestration records |
| Exceptions | Add controlled workflow records; no parallel transaction ledger |

## Matching policy

- Incoming credits only; debits are excluded.
- A suggestion is created only when exactly one settled payment matches reference, amount and currency.
- Zero candidates become `no_candidate`; multiple candidates become `ambiguous_candidate`.
- Suggestions never post journals, allocate receivables, or change payment status.
- The actor who generated or proposed a match cannot approve it.
- Review and exception-resolution proposals require AAL2 plus `payments.reconcile` or `payments.manage`.
- All mutable decisions use row locks and immutable audit events.

## Delivery

- Migration 89: match-run and exception tables, provenance columns, four `customer_api` gateways, RLS, covering indexes and dual control.
- Test 075: 42 structural and authenticated functional assertions.
- API: queue/read, generate, review and exception-resolution handlers with origin, body-size, authentication and no-store controls.
- UI: RO/EN/FA matching work queue with Persian RTL and explicit independent-approval notice.

## Deferred boundary

Machine-learning scoring, fuzzy payer identity inference and direct Open Banking feed connectivity remain deferred. No probabilistic candidate is auto-approved: `DEFERRED-BANK-FUZZY-MATCHING-PROVIDER`.
