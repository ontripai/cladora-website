# CLADORA SERVICE v1.4 — SV01N experience boundary

Provider contract: `service-experience-coordination-receipt.v1`, owned by Community & Experience. Compatibility is pinned to CE Draft PR #361 at exact SHA `2a6a52ffbb97ace228daf9221404f308aa05668c`. A different CE SHA requires a new compatibility review.

## Boundary

The server-assembled input preserves four actions: `acknowledge_component_status`, `request_cancellation`, `request_compensation` and `accept_compensation`. It binds contract/version, Context, Workspace, canonical Service Order/version, opaque actor and participant references, coordination source/version and an idempotency key. Component and compensation actions carry exact canonical subject versions. `status_reference_id` is accepted only for component acknowledgement. Cancellation and compensation requests use the bounded CE reason-code set.

Client-controlled authority, participant membership, experience/cancellation state, compensation amount, currency, tax, rounding, payment/refund/ledger references, provider result and notification outcome remain rejected. The opaque actor and participant references do not grant authority; the consumer rechecks them against the current server-read authority and membership snapshot.

## Full receipt consumption

SERVICE consumes the full CE receipt rather than the lossy eight-field PR #334 projection. It validates contract/version and receipt identity; verified/denied/conflict/unknown status with its bounded result code; exact action, Workspace, Order/version, subject kind/identity/version or explicit absence, coordination source/version, status reference, reason code, actor and participant authority outcomes, current/resulting coordination state, opaque idempotency binding and evaluation time.

The current snapshot independently binds actor authority, active participant membership, Workspace, Order, subject, source and allowed action. Replay requires the same case-sensitive idempotency key, the CE-compatible full normalized input fingerprint, the exact receipt identity and the opaque idempotency binding. Missing or mismatched receipt fields fail closed. Denial is pure and produces no SERVICE mutation or synthetic receipt.

SERVICE retains canonical Order ownership and does not implement another experience, participant, cancellation, compensation, benefit, notification or financial state machine. Monetary effects remain behind FIN01.

## Acceptance limit

This package proves contract compatibility with the pinned CE provider schema and pure evaluator only. CE runtime issuance, current reads, serialization, persistence, audit/outbox and atomic idempotency enforcement remain unaccepted. DB/API/browser/concurrency and zero-write transaction evidence remain blocked by DB-HIST-01. Contract tests and CI do not constitute runtime, financial, Merge or Release acceptance.
