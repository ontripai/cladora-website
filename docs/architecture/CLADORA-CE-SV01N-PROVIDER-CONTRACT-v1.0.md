# CE-SV01N provider contract — service experience coordination receipt v1

Status: contract-only, in review. Owner: Community & Experience. Consumer baseline: SERVICE PR #334 at `bed66934343a0d86d336925f3ed7cd66ca45f065`.

## Ownership and boundary

SERVICE owns the canonical Service Order, its version and state. CE owns only the Experience coordination decision and `service-experience-coordination-receipt.v1`. The contract consumes a server-read SERVICE Order reference and Core-derived actor and participant authority. It does not create another Order, participant registry, authority resolver, cancellation engine, compensation ledger, financial state or notification result.

This package contains a strict TypeScript contract, a pure evaluator, a lossy compatibility projection for the current SERVICE consumer and executable contract tests. It adds no API, route, SQL, migration, persistence, public UI or capability activation. A successful contract test is not runtime or transactional acceptance.

## Trusted input and current snapshot

The server-assembled input binds contract/version, Context, Workspace, canonical Service Order and expected version, opaque verified actor and participant references, CE coordination source and expected version, action and idempotency key. Action-specific fields are:

| Action | Subject | Additional input |
| --- | --- | --- |
| `acknowledge_component_status` | component ID and version | exact `status_reference_id` |
| `request_cancellation` | none | bounded `reason_code` |
| `request_compensation` | component ID and version | bounded `reason_code` |
| `accept_compensation` | compensation reference ID and version | none |

All variants are strict. Order state, authority result, participant membership, experience state, cancellation result, compensation amount, currency, tax, rounding, payment/refund/ledger references and audit/outbox results are rejected as input claims. The opaque actor and participant references do not grant authority; the evaluator must match them against the current server-read snapshot.

The snapshot contains current actor authority, current participant membership, the canonical SERVICE Order reference/version and opaque state, the current CE subject, current coordination source, Workspace bindings, action availability, resolution certainty and prior replay state. The evaluator treats the SERVICE Order state as an opaque owner-provided reference and does not reproduce SERVICE transition rules.

## Receipt and bounded decisions

The receipt binds its contract/version and identity to the action, Workspace, Service Order/version, subject kind/ID/version or explicit absence, coordination source/version, optional status reference, optional bounded reason and an opaque idempotency binding. It exposes only verified/denied authority outcomes; it never exposes actor or participant identity, membership metadata, request payload, raw idempotency key or internal fingerprint.

The bounded result codes are:

- `OK`
- `AUTHORITY_DENIED`
- `PARTICIPANT_DENIED`
- `ORDER_UNAVAILABLE`
- `STALE_ORDER`
- `SUBJECT_UNAVAILABLE`
- `STALE_SUBJECT`
- `SOURCE_UNAVAILABLE`
- `STALE_SOURCE`
- `WORKSPACE_MISMATCH`
- `ACTION_NOT_ALLOWED`
- `REPLAY_CONFLICT`
- `UNKNOWN_RESULT`

`OK` maps to `verified`; stale and replay conflicts map to `conflict`; `UNKNOWN_RESULT` maps to `unknown`; the remaining codes map to `denied`. Only `OK` advances the CE-owned resulting coordination state. Every other decision reports `unchanged` or `unknown`.

The evaluator is pure. It does not mutate input or snapshot state and does not write a successful receipt, audit, outbox event or idempotency completion on denial. A same-key replay must have the same full normalized input fingerprint and an exact previously verified receipt, and it rechecks current authority, participant, Workspace, Order, subject and source before returning that immutable receipt. A changed payload, key mismatch or mismatched receipt returns `REPLAY_CONFLICT`. Cross-Workspace and cross-Order details remain internal bounded decisions; a future public adapter must map them without disclosing another Workspace, participant, Order or subject.

## SERVICE PR #334 compatibility matrix

The current SERVICE consumer receipt has eight fields: `status`, `action`, `workspace_id`, `order_id`, `order_version`, `subject_id`, `subject_version` and `status_reference_id`. The CE contract remains stronger and provides a compatibility projection only for integration testing.

| CE receipt field | PR #334 consumer field | Classification | Required follow-up |
| --- | --- | --- | --- |
| `action` | `action` | exact match | none |
| `workspace_id` | `workspace_id` | exact match | none |
| `service_order_id` | `order_id` | compatible mapping | rename in adapter |
| `service_order_version` | `order_version` | compatible mapping | rename in adapter |
| `subject_id` | `subject_id` | exact match | none |
| `subject_version` | `subject_version` | exact match | none |
| `status_reference_id` | `status_reference_id` | exact match | none |
| `decision_status` | `status` | compatible mapping | `verified` maps exactly; conflict maps to stale; denied/unknown remain non-success |
| `contract`, `version`, `receipt_id` | — | missing in consumer | validate contract identity and receipt identity |
| `coordination_source_id`, `coordination_source_version` | — | missing in consumer | bind the exact CE source and version |
| `reason_code` | — | missing in consumer | bind cancellation/compensation reason to the receipt |
| `result_code` | — | missing in consumer | preserve bounded denial/conflict/unknown result |
| `actor_authority`, `participant_authority` | — | missing in consumer | validate current authority outcomes without participant identity |
| `current_coordination_state`, `resulting_coordination_state` | — | missing in consumer | validate the CE-owned coordination transition |
| `idempotency_binding_id` | — | missing in consumer | bind replay without exposing payload/key |
| `evaluated_at` | — | missing in consumer | bind evaluation time |
| — | — | missing in provider | none for the required v1 fields |

Result: `changes_requested_on_consumer`. PR #334 does not yet model the required coordination source identity/version, participant binding, bounded result, reason binding or replay binding. SERVICE must accept and validate the agreed full receipt or an owner-approved lossless verification envelope before runtime activation. CE must not weaken its provider contract, and this package does not modify PR #334.

## Runtime dependency and acceptance limit

Operational issuance needs a separately authorized runtime package that reuses the shared Core authority resolver, canonical SERVICE Order projection and shared idempotency/audit/outbox infrastructure. It must atomically re-read authority and participant membership, validate the exact owner-provided Order/source/subject versions, serialize concurrent attempts, persist a successful CE receipt and shared effects once, and prove zero writes for denial. It will require an explicit persistence and migration decision; this contract creates neither.

Acceptance for this package is limited to strict positive and negative schema coverage for all four actions, bounded decisions, stale and scope checks, action/subject binding, exact replay and conflict behavior, privacy, zero mutation, PR #334 compatibility tests, CE010/CE011/CE012 regressions, lint, typecheck, production build, diff and safety scans, exact-head CI and Vercel Preview.
