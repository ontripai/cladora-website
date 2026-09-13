# CLADORA-P2-MONTHLY-002 — Authenticated Monthly-Cycle Acceptance

## Objective

Prove the complete Migration 87 workflow through authenticated `customer_api` contracts without a new migration, real-customer mutation, or persistent test identities.

## Acceptance scenario

- Synthetic association, active accounting entitlement, property, concluded open period, and balanced allocation run.
- Three distinct AAL2 actors: association administrator, president, and censor.
- AAL1 mutation rejection and tenant/context authorization.
- Source snapshot capture, approved allocation binding, and submission.
- Legacy direct-close bypass rejection.
- Independent president/censor approvals and pre-approval publication rejection.
- Immutable SHA-256 publication snapshot and exact continuous parity.
- Canonical period close through `close_monthly_cycle_v1`.

## Persistence boundary

Test 073 is enclosed in one PostgreSQL transaction and always ends with `ROLLBACK`. It contains no P1TEST identity, real association, payment, provider call, or persistent fixture.

## Promotion gate

The package may merge only after Test 073 passes on the linked database inside a rollback transaction and the complete `postgres-runtime`, static contract, application contract, and Vercel checks pass.
