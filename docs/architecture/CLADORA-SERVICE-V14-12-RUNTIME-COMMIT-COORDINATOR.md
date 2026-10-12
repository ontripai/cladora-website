# SERVICE v1.4 runtime commit coordinator contract

`SV-RUNTIME-COMMIT-16-LOCAL` is a local, contract/test-only transaction coordinator candidate. It composes the four existing SERVICE provider adapters through injected canonical owner ports and produces a non-executable atomic plan. It has no route, database client, persistence implementation, migration, or runtime import.

## Canonical provider ports

| SERVICE port | Canonical source contract | Adapter receipt | Runtime status |
|---|---|---|---|
| Subject reference | Communications `communication-request-receipt.v1` or Documents `documents-reference-authority.v1` | `service-subject-link-adapter.v1` | COM01 schema exists on `main`; Documents reference issuer and the composed bridge are contract-only |
| Delivery evidence | Documents/Vault `documents-delivery-evidence.v1` | `service-delivery-evidence-receipt.v1` | Provider and issuer are contract-only |
| Stage/Work Order | OPS01 `operations-execution-request-receipt.v1` | `service-order-stage-work-order-adapter.v1` | OPS01 schema exists on `main`; SERVICE stage bridge and runtime issuance are contract-only |
| Portfolio action | PF01 `owner-portfolio-projection.v1` | `portfolio-service-action-projection-receipt.v1` | PF01 schema exists on `main`; SERVICE Order/action projection bridge and runtime issuance are contract-only |

All five injected provider boundaries, including the Core transactional authority port, return Promises so their future DB-backed implementations can be awaited inside the transaction. The coordinator awaits each canonical source before validating its receipt. Rejection produces only the bounded `PROVIDER_RESULT_UNKNOWN` result. This contract change adds no implementation, I/O, route, persistence, or runtime import.

All injected canonical port results carry `acceptance: contract_only`. A verified adapter result can therefore produce only `CONTRACT_PLAN_READY` with `executable=false`; it cannot activate runtime behavior or imply provider acceptance.

## Transaction and recovery model

The fixed lock order is `idempotency_key → workspace → service_aggregate → provider_source`. The coordinator checks the complete lock sequence before current authority, replay, or provider evaluation. It then rechecks the exact actor and authority version, resolves an existing idempotency record before calling a provider, and binds the case-sensitive key to the normalized full-command fingerprint.

An exact committed replay returns the immutable prior commit receipt without calling a provider. Changed payload, Workspace, actor, operation, key, or fingerprint conflicts. Pending and unknown-commit records return `COMMIT_OUTCOME_UNKNOWN` and cannot stage or repeat effects. Provider exceptions return a bounded unknown decision without internal detail.

The state machine exposes no write while locks, authority, providers, or effects are being evaluated. Staging is `staged_not_written`; any denial rolls back to `none`. A commit acknowledgement or a committed recovery produces one observed atomic effect set. A lost acknowledgement remains `unknown` until canonical idempotency recovery proves either `committed_once` or an absent transaction with zero writes and a safe retry.

The proposed atomic effect set is one SERVICE domain mutation, one redacted `audit.events` record, one versioned `platform.outbox_events` record, and one `platform.idempotency_keys` result. The candidate models these effects but performs none of them.

## Runtime dependencies

Runtime activation requires accepted canonical implementations for the four provider ports; current workspace/resource authority re-read; canonical SERVICE Order, stage, subject-link and delivery persistence; a transaction-scoped idempotency claim; atomic audit/outbox persistence; unknown-commit recovery; and DB/API/concurrency evidence against the real database. Those dependencies remain outside this candidate.
