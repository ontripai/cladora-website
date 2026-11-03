# CLADORA Core BK-01 shared capacity/time RFC v1.0

**Baseline:** `feat/core-ops-01-execution-receipt@42ba1c217bbc2d6a081a24937345a3e124af3f5b`

**Status:** minimum runtime vertical slice ready for local review.

**Owner:** Core Booking/Capacity owns the shared capacity policy and atomic hold decision. C13 shared-amenity reservation is the first runtime consumer. The earlier SERVICE contract remains a future adapter and is not rebuilt here.

**Delivery boundary:** additive local migration, bounded customer API, C13 customer UI and local tests. No expiry worker, SERVICE/AIRPROP rewrite, parking-allocation engine, payment, remote migration or Production effect.

## Selection and ownership boundaries

C13 is selected because a shared facility can use the already accepted DW-02 canonical Unit reference without creating a second amenity identity. A configured policy marks that Unit as reservable; it does not copy the Unit record. C13 consumes the BK-01 hold directly and exposes only the caller's holds.

SERVICE continues to own Service Order, stage and any future consumer allocation IDs/state. This slice does not connect or alter SERVICE booking.

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

## Runtime acceptance in this slice

Migration `20261019230000_bk01_c13_amenity_capacity_v1.sql` provides the first bounded runtime. It registers, but does not activate, the `booking` module; stores policy, hold and immutable receipt evidence; rechecks AUTH-01 and DW-02 before replay; serializes each policy row; and writes audit/outbox evidence atomically. The C13 API and `/app/amenities` page are the real consumer.

The local pgTAP/API/TypeScript suites prove:

- exact adjacent half-open intervals do not conflict, while true overlaps do;
- exclusive and counted-capacity policies, including partial remaining capacity;
- deterministic single-resource contention and zero writes on denial;
- hold expiry at the timestamp without depending on worker timing;
- confirm versus expiry and reschedule versus competing hold races;
- stale policy, resource, source and hold versions;
- offset-aware instants and pinned IANA timezone disclosure;
- idempotent replay, mismatched replay and unknown-outcome recovery;
- current authority/resource revocation and zero writes on denial;
- bounded conflict disclosure and no competing-party/source leakage;
- C13 binding while the canonical Unit and Core hold retain distinct identities.

Multi-resource holds, a background expiry worker, parking-space allocation, recurring reservations, blackout/buffer/quota/approval rules and a SERVICE adapter remain explicit later work. They do not block this C13 shared-amenity vertical slice.

Local test success is evidence, not merge authorization, remote migration authorization or Production release. No Workspace module activation is performed by this package.
