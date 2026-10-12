# SERVICE provider composition contract

`SV-PROVIDER-COMPOSITION-18-LOCAL` composes the merged SERVICE transaction coordinator with `CORE-AUTH-TX-PORT-06` and the four existing SERVICE provider adapters. It is a local contract/test candidate and remains non-executable.

The composition validates the fixed lock sequence and Workspace before calling the injected Core port. It constructs the Core request from the server transaction context and the exact SERVICE command, pins `services.orders.request`, `services_orders`, and `service.order.transition`, and accepts only a transaction-bound decision receipt whose actor, Workspace, authority version, transaction, command, aggregate lock, permission, module, purpose, and evaluation time match the request.

Every retry and replay rechecks Core authority first. Revoked, stale, denied, malformed, mismatched, or unavailable authority produces a bounded result before a canonical provider is called. An exact committed replay remains non-executable; changed replay conflicts; a pending or unknown commit remains unknown and cannot be retried speculatively.

Core transactional authority, Subject, delivery evidence, OPS Work Order, and PF01 action are Promise-returning injected ports. The composition awaits Core only after the lock and Workspace checks; the coordinator then resolves replay before awaiting the selected canonical provider. Provider receipt source identity and version remain exact. A rejected Promise, provider denial, stale receipt, or port mismatch produces no plan or write.

The candidate has no route, provider implementation, database client, migration, persistence, audit/outbox writer, or runtime import. A successful result remains `CONTRACT_PLAN_READY` with `executable=false`.

Runtime activation still requires the real Core transactional authority provider, canonical Communications/Documents subject issuer, Documents/Vault delivery-evidence issuer, OPS01 stage/Work Order issuer, PF01 action projection issuer, SERVICE persistence, atomic idempotency/audit/outbox, and unknown-commit recovery with real database evidence.
