# CLADORA-P2-BANK-001 — Bank Statement Import, Matching & Canonical Reconciliation

Authoritative migration: `20260913100306_bank_statement_import_reconciliation.sql` (version assigned by the linked Supabase migration service).

## Objective

Complete Stage 3 by extending the existing non-custodial payments engine with controlled bank-statement ingestion, deterministic duplicate prevention, reviewable staging and atomic commit. Existing payment, matching, reconciliation-session and ledger contracts remain canonical.

## Reuse and extension decision

| Area | Decision |
| --- | --- |
| `payments.bank_accounts` | Reuse |
| `payments.import_batches` | Extend with lifecycle, balances, hashes and idempotency |
| `payments.bank_transactions` | Reuse as canonical committed transaction store |
| `payments.reconciliation_matches` | Reuse for partial, split and unmatched handling |
| `payments.reconciliation_sessions` | Reuse for zero-difference finalization |
| `finance.journals` and accounts 5121/4111/419 | Reuse; no parallel ledger |
| Raw import review | Add transaction-bound staging table |

## Security and accounting boundaries

- AAL2 plus `payments.reconcile` is mandatory for create, stage, validate and commit.
- Customer input never supplies tenant identity; tenant/property scope comes from the authenticated context.
- Raw bank rows are bounded to 5,000 per batch and committed once under a row lock.
- File and row SHA-256 fingerprints provide idempotency and duplicate prevention.
- Statement import does not post journals. Accounting remains controlled by canonical payment settlement/allocation functions.
- CLADORA remains non-custodial and stores no bank credential, PAN, CVV or provider secret.

## Delivery scope

- Migration 88: controlled import lifecycle and five versioned RPC gateways (create, stage, validate, read and commit).
- Test 074: 42 structural and authenticated functional assertions covering RLS, grants, AAL2, locking, privacy, idempotency, deduplication, immutability and the zero-ledger boundary.
- Application routes and parser: bounded CSV/JSON ingestion with server-computed SHA-256 source hash.
- Existing reconciliation UI: file selection, import status, validation result and controlled commit action in RO/EN/FA.

## Deferred boundary

Bank-specific CAMT.053 signature validation and direct Open Banking connectivity remain provider integrations and must fail closed until a provider is selected: `DEFERRED-BANK-FEED-PROVIDER`.
