# CLADORA Core BK-01 shared capacity/time RFC v1.0

**Baseline:** `feat/core-ops-01-execution-receipt@42ba1c217bbc2d6a081a24937345a3e124af3f5b`

**Status:** contract/RFC ready for review; no runtime or persistence.

**Owner:** Core Booking/Capacity owns the shared capacity policy and atomic hold decision. The selected first consumer is SERVICE via Draft PR #328 (`feat/service-v14-booking-sv01h-contract@c3f05eb4e8b6853c8639f8d3980266c2df365933`).

**Delivery boundary:** additive TypeScript contracts and static verification only. No migration, endpoint, allocation ledger, expiry worker, SERVICE change, central manifest rewrite or Production effect.

## Selection and ownership boundaries

SERVICE is selected because its v1.4 consumer contract already separates Order/stage/allocation state from a server-verified BK-01 receipt and keeps non-booking services independent. SERVICE continues to own Service Order, stage and consumer allocation IDs/state.

Capacity-backed Community/Event may adopt the contract later. Free Event base, interest/withdrawal and manual attendance do not wait for BK-01. AIRPROP commercial reservation remains a separate exclusive commercial state machine; `airprop.exclusive_reservations` and pgTAP 171 are explicitly not BK-01 persistence or test evidence.

BK-01 creates no shared booking identity across domains and never reuses a SERVICE allocation, Event registration or AIRPROP reservation as the Core hold ID.

## `shared-capacity-time.v1`

The versioned policy pins an IANA timezone, capacity unit/total, hold TTL, exclusive or counted-capacity conflict mode, all-or-nothing multi-resource behavior and half-open interval semantics `[start, end)`. UTC instants decide overlap. The pinned timezone is used only for policy calendars, DST/local-day rules and display; clients must not strip offsets or compare local clock strings.

All resource sets use versioned `canonical-resource-reference.v1` inputs. The authoritative adapter re-resolves every current resource/version and policy state. Resource locks are acquired in deterministic canonical `(resource_type, resource_id)` order. A multi-resource request either succeeds for every resource and capacity unit or writes nothing.

## `shared-capacity-allocation-receipt.v1`

The request supports `request_hold`, `confirm_hold`, `reschedule` and `release`. It pins context/Workspace, immutable consumer source ID/version, policy/version and idempotency key. Hold/reschedule additionally pin a half-open interval, positive integer capacity and one to twenty unique canonical resources. Confirm/reschedule/release pin the exact Core hold version.

A verified receipt returns the Core hold ID/version/state, exact effective interval/capacity/resource versions and a point-in-time policy version. Only `held` has `expires_at`; expiry is effective when the timestamp is reached even if a cleanup worker has not yet updated the stored row. `confirmed`, `released` and `expired` do not carry an expiry.

A denied receipt may expose only conflicting resource IDs and intervals already visible to the caller; it never exposes the competing booking, party, consumer source, title or payload. `stale` and `unknown` expose no resource or conflict identifiers and require a fresh read. Unknown outcomes must be recovered by the same idempotency key; callers must not create a second hold.

The receipt is not action authority. Every consumer write rechecks current AUTH-01 authority, source and resource state and exact receipt binding. SERVICE may map the Core hold to its separate allocation inside an accepted atomic integration boundary; it must not treat a preflight availability calculation as a hold.

## Required atomic behavior

A runtime implementation must, in one database transaction:

1. resolve the current actor/context/Workspace and exact consumer source/version;
2. resolve current policy and canonical resource versions;
3. acquire deterministic locks and expire timestamp-dead holds logically;
4. enforce half-open overlap and total counted capacity across every resource;
5. create/update/release exactly one versioned Core hold or fail with zero hold writes;
6. record the idempotent receipt, audit and existing outbox evidence;
7. when integrated with SERVICE, atomically bind the Core hold receipt to the SERVICE allocation without transferring state ownership.

Replay with an equal fingerprint returns the same receipt and `replayed = true`. The same key with a changed action/source/policy/window/capacity/resource set/expected version fails closed. Reschedule retains the hold identity and increments its version; it cannot temporarily double-book old and new windows.

## Acceptance matrix still required

This RFC/static schema is not runtime acceptance. A later versioned migration and isolated pgTAP/concurrency package must prove:

- exact adjacent half-open intervals do not conflict, while true overlaps do;
- exclusive and counted-capacity policies, including partial remaining capacity;
- deterministic multi-resource contention with no deadlock and all-or-nothing writes;
- hold expiry at the timestamp without depending on worker timing;
- confirm versus expiry and reschedule versus competing hold races;
- stale policy, resource, source and hold versions;
- timezone/DST calendar boundaries with offset-aware instants;
- idempotent replay, mismatched replay and unknown-outcome recovery;
- current authority/resource revocation and zero writes on denial;
- bounded conflict disclosure and no competing-party/source leakage;
- SERVICE binding parity while SERVICE and Core retain distinct IDs/state machines.

No production schema exists for BK-01 in this slice. CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
