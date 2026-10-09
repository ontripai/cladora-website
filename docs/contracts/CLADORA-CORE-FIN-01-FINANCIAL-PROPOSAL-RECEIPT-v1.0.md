# CLADORA Core FIN-01 financial proposal/posting receipt v1.0

**Baseline:** `feat/core-com-01-communication-receipt@8afed7d61173de0f5c84770fe658363dcb0c7a41`

**Owner:** Core Finance owns posting, invoice/receivable/payment/payable references, reversals and financial authority. Domain owners may propose source-linked financial work but do not post journals directly.

**Delivery boundary:** additive TypeScript contracts and static gateway mapping only. No migration, endpoint, journal, backfill, central manifest rewrite or Production effect.

## Existing sources reused

FIN-01 maps to the current `finance.journals`, `finance.journal_entries`, `billing.invoices`, `billing.receivables`, `payments.payments`, `payments.payment_allocations`, `maintenance.vendor_payables`, `platform.idempotency_keys` and `audit.events` sources and their existing bounded customer/domain gateways.

It creates no parallel general ledger, invoice, receivable, payment, payable, approval, audit, outbox or idempotency source. Private PF bookkeeping remains self-reported and cannot become an official posting source by projection.

## `financial-proposal-posting-receipt.v1`

The proposal pins its own ID/version and idempotency key, explicit context/Workspace, immutable domain source ID/version/reference, optional canonical resource, proposal kind, currency/net/tax/gross snapshot, tax treatment/version, payer allocations and approval states. `posting_authorization = not_evaluated` is invariant: an approved business proposal is not permission to post.

Amounts are decimal strings with at most four fractional digits. Finance must validate exact currency precision, payer allocation parity, net + tax = gross, tax treatment and legal/accounting period rules using its canonical decimal implementation. Consumers must not coerce these values through binary floating point or infer missing amounts as zero.

The posting request pins the expected proposal and approval versions and has its own idempotency key. `post` must not name an original receipt. `reverse` must name the original receipt and records a correction/reversal; it never rewrites a posted journal or prior receipt.

A posted receipt includes at least one canonical Finance-owned reference. A reversal includes a reversal journal reference and the original receipt. A rejected receipt exposes no journal, invoice, receivable, payment or payable identifiers. Every receipt pins the exact proposal/source/amount snapshot and audit event.

## Authority and atomicity

The Finance gateway must independently verify:

- current AUTH-01 permission and source Workspace/resource scope;
- exact current proposal/approval versions and all required payer approvals;
- immutable source parity and one posting per accepted source/version;
- currency, tax, accounting-period and close-state rules;
- posting/reversal permission and separation of duties;
- idempotency fingerprint equality for replay.

Within one transaction the accepted gateway records or replays the Finance-owned artifacts, receipt, audit and existing outbox evidence. Domain consumers cannot insert or update `finance.journals` or `finance.journal_entries`, select accounts, mark a journal posted, mutate invoice/payment state, or bypass closed-period/reversal rules.

## Existing evidence and future runtime gate

Repository evidence already covers ledger balance/immutability, charge allocation, close reporting, canonical monthly cycle, maintenance payable authority, payment reconciliation, cash discipline, idempotency and concurrent posting behavior. Relevant sources include:

- `supabase/migrations/20260825000500_finance_ledger.sql`;
- `supabase/migrations/20260825000700_billing_invoices_receivables.sql`;
- `supabase/migrations/20260908180000_maintenance_work_orders_procurement_slice.sql`;
- `supabase/migrations/20260913082028_canonical_monthly_financial_cycle.sql`;
- `scripts/test-financial-close-concurrency.mjs`;
- `scripts/test-cash-discipline-concurrency.mjs`.

This slice does not claim a new database run. A future adapter requires a selected first consumer and disposable tests for closed periods, currency/amount mismatch, payer denial, source-version conflict, idempotent replay, concurrent posting, reversal parity and proof that the domain role has zero direct journal mutation privilege.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
