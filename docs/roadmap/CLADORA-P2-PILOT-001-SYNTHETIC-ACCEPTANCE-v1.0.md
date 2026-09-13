# CLADORA-P2-PILOT-001 — Synthetic Residential Building Acceptance

## Objective

Prove the complete controlled residential import path against canonical CLADORA domains without touching a real customer, creating a new migration, or leaving persistent fixtures.

## Acceptance boundary

- Test 071 runs inside one PostgreSQL transaction and ends with `ROLLBACK`.
- Two synthetic AAL2 actors enforce creator/approver separation.
- A synthetic property and open accounting period are preconditions; the importer creates the building, entrance, unit, party, ownership, occupancy, accounts, meter, reading, opening journal, invoice, and receivable.
- Validation, dry-run, submission, independent approval, reconciliation, mapping traceability, and activation are exercised through versioned `customer_api` routines.
- Opening accounting proves `Dr 4111 = receivables outstanding`, balanced debits/credits, and zero clearing delta.
- No P1TEST identity, live association, payment provider, Vercel production deployment, or physical document is used.

## Explicit product boundary

Creating a new property and importing opening balances in the same commit remains out of scope because an open accounting period must already exist for the property. Pilot onboarding therefore provisions the property and accounting period before financial import. A future forward-only design may make that precondition an explicit provisioning checkpoint.

## Promotion gate

Residential pilot promotion is allowed only when Test 071 passes in the PostgreSQL runtime CI job together with the complete database package, application foundation, typecheck, lint, and production build.
