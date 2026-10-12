# SERVICE runtime persistence contract

`SV-RUNTIME-PERSISTENCE-22-LOCAL` defines the transaction-scoped persistence boundary that follows the existing non-executable SERVICE composition. It is a local contract and test candidate. It adds no route, migration, database implementation, runtime import, or activation.

## Atomic boundary

One serializable transaction owns one idempotency claim, one SERVICE domain mutation, one metadata-only `audit.events` row, one versioned `platform.outbox_events` row, and the committed idempotency readback. The transaction scope must equal the exact command transaction ID. The full command fingerprint, case-sensitive idempotency key, Workspace, actor, current authority decision/version, aggregate, operation, and canonical provider receipt remain bound throughout the effect set.

An exact replay returns the immutable committed receipt and writes nothing. A changed fingerprint conflicts and writes nothing. A transaction failure rolls back the pending claim and all staged effects together. Stale authority and provider failure occur before persistence and therefore produce no claim, mutation, audit event, outbox event, or receipt.

## Unknown commit recovery

Connection loss after the commit attempt cannot be retried speculatively. Recovery reads the canonical idempotency record by Workspace and key, then verifies the exact actor, transaction scope, and fingerprint. A committed readback returns the prior receipt. A pending record remains unknown. An absent record permits a retry only after fresh Core authority and canonical provider evaluation. A different fingerprint is a replay conflict.

## Ownership and activation

`ServiceRuntimeAtomicPersistencePortV1` is injected and Promise-based. The contract validates inputs and results but never calls the port. Core authority and the COMM/DOC, Documents/Vault, OPS and PF01 providers remain injected canonical owners. No SERVICE truth table or parallel provider projection is introduced.

The PostgreSQL conformance test creates and removes an isolated schema inside a disposable local PostgreSQL container. Its DDL is test fixture setup, is not stored under the migration directory, and is never applied to Supabase Remote. Runtime activation remains blocked by `DB-HIST-01`, accepted real providers, canonical SERVICE persistence ownership, security review, and DB/API/concurrency acceptance against the authorized target environment.
