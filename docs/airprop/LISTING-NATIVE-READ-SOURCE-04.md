# Listing native read source v1 — inactive source candidate

Task: V14-AIRPROP-01 / LISTING-NATIVE-READ-SOURCE-04.
Base: a4cf2a468977e97e8900e32119e46a933fde6f96.
Dependency: AIRPROP-LISTING-DW02-C01-READ-01 (Core-owned integration).
No product route binding, installation, grants, SQL execution or native acceptance.
AFFORDANCE-03 and the coordinator's exact-Head 52 controlled checks remain accepted;
this packet does not rerun or reopen them.

## Implemented AIRPROP path

`createListingNativeReadV1(host, producer)` implements ListingSourceRead:
server-resolved scope -> parameterized market_listings page -> actual Core Unit/Property
selector -> actual Core companion mapper -> Listing row/version collection recheck ->
post-wait selector and canonical recheck -> database-clock expiry gate -> host commit ->
return server-only evidence for the existing read mapper/API. Errors abort the whole
collection. No partial rows or error details escape this adapter through the existing API.

The embedded SQL is the inactive query proposal and actual executed query text of the
adapter, not a placeholder or an invented RPC. It SELECTs existing columns only:
id, tenant_id, workspace_id, property_id, unit_id, version, status, available_from/until.
Source identity: `airprop.market_listings.read.v1`. Schema sources:
- supabase/migrations/20261007112219_airprop_commercial_lifecycle_v1.sql: original table;
- supabase/migrations/20261008135433_airprop_listing_controls_v1.sql: version + existing writer.

Filter is exact server tenant/Workspace and the existing UI-supported statuses
published/reserved/withdrawn. Completed listings are outside this v1 lifecycle view.
Context is NOT inferred from these columns: host must resolve it and actual selector
checks its scope for each exact Unit/Property. A foreign/inaccessible row withholds the
collection; no existence count or fallback row is disclosed. This conservative v1 can
withhold a Workspace page with mixed Context coverage; a canonical authorized
collection producer is needed to improve that behavior, not a local ownership resolver.

Order is UUID id ASC; cursor is an explicitly tenant/actor/Context/Workspace-bound
last UUID; limit integer1..100 (default100), no OFFSET, total count or unbounded query.
Same host/scope and exact order/count are checked in returned rows. Cursor is not a
permission token. Existing GET still serves the first bounded page; no public pagination
contract is introduced. Parameter values never become SQL identifiers or fragments.

Row locks are FOR SHARE. Existing control_airprop_listing_v1 takes FOR UPDATE on
that row before version checks. They conflict under PostgreSQL semantics, but installed
ACL/writer closure/serialization behavior is NOT proven here. Logical SELECT-only is
not PostgreSQL `BEGIN READ ONLY`: PostgreSQL forbids row-locking SELECT there.
No zero-WAL assertion is made. No DDL, reservation, audit, idempotency, outbox or
mutation statement is submitted by this adapter. Any 40001 is propagated unchanged,
without auto-retry; an admitted host may later define bounded fresh-snapshot retry.

## Canonical consumption and exact missing producer

| Boundary | Existing canonical source | Required input/output and remaining gate |
| --- | --- | --- |
| Scope/session | identity.context_grants, memberships; platform.customer_workspaces; existing Core current authority provider | Core must supply authenticated actor/tenant/Context/Workspace in one real same-session serializable SQL scope. Browser scope alone is never trusted. |
| Unit->Property | src/lib/core/current-unit-property-selector-v1.ts | Actual selector called unchanged. Requires same-transaction post-lock canonical authority receipt, entitlement/revision, real transaction/command/attempt and portfolio.unit aggregate lock. AIRPROP constructs none of them. Wrong/missing binding fails closed. |
| Read host | src/lib/core/postgres-transaction-host-v1.ts | Existing host is a COMMAND host with reserve/mutate/receipt semantics, not an admitted SELECT-only host. It must NOT be invoked with a dummy mutation to manufacture the required selector receipt. `ListingNativeReadHostV1` is a proposed AIRPROP integration shape, not accepted Core ABI. Core must provide/admit a lock-capable SELECT-only execution path compatible with selector preconditions, or a reviewed Core selector successor. Until then HOST_NOT_READY. |
| Official resource/version/party/relationship and label | src/lib/core/owner-portfolio-projection-v1.ts; resource-contracts-v1.ts; resource-authority-contract-v1.ts; airprop-companion-mapping-v1.ts | These are real schemas/pure evaluator/mapper; no installed canonical SQL companion producer found in this Base. Core/DW02 must emit current official evidence, exact Unit/spec version, relationship/party and safe authorized label. No display name, spec version, mandate or authority is invented from market_listings. Until supplied CANONICAL_PRODUCER_NOT_READY. |
| Time/currentness | existing Core selector and current-authority-postgres-provider-v1.ts | Producer must evaluate current permission and all effective/expiry gates AFTER waits at database time >= supplied boundary and expose the earliest REAL expiry of every scope/authority/resource/relationship gate as current_until. This is an explicit proposed producer requirement, not an installed API or invented TTL/lease. If it cannot establish that bound, it must fail unavailable. Existing schemas alone do not prove this. |
| Edit actions | AFFORDANCE-03 existing version2 transport | This slice supplies NO manage projection. Optional action producer remains unavailable; read permission and DW02 not_evaluated never grant edits. |

The producer interface is not the completion claim: the actual AIRPROP page SQL,
bounds, canonical selector invocation, mapping, repeated collection/version checks,
post-wait temporal checks and failure propagation are implemented. Missing host and
canonical producer are the precisely isolated NOT_READY connections.

No Property-as-Unit or first-Unit fallback exists. Canonical relationships are consumed
by the existing Core mapper; Listing has no party/relationship-version columns from
which AIRPROP could legitimately infer a new binding. A coherent wrong-party witness
therefore requires verification against the REAL canonical producer/store, not a new
AIRPROP owner evaluator. Controlled tests cover a foreign companion and coherent
party/relationship change between observations; native wrong-party proof stays open.

## Temporal and writer boundaries

Initial locked collection is re-read after mapping; row identities, versions, statuses
and timestamps must match. All selector waits precede the final collection boundary.
Canonical evidence must be evaluated no earlier than that boundary. A final non-locking
database clock observation follows ALL canonical producer calls; equality to the earliest
actual expiry is denied. Timestamp comparisons preserve PostgreSQL microseconds,
including a one-microsecond backdate; Date.now is not used. Provider calls must never
renew/touch a lease or update expiry to make this pass.

This establishes adapter ordering checks, not continuous revocation outside a snapshot.
All relevant writers must participate in the canonical authority revision/row lock protocol
and use the installed required isolation. Exact lock order, bounded lock timeout and
cross-domain writer compatibility must be admitted by Core before native use. The
adapter does not configure the connection or invent advisory lock custody. Host must
commit before disclosing results and discard callback output on rollback/commit failure.
The proposed host completion envelope must carry a REAL trusted database-clock
observation after commit/waits; the adapter rejects a backdated completion or expiry
at/before that observation. This is not a minted receipt or an assertion that an
existing host already provides this field. Without that producer it is NOT_READY.
Canonical producer must not use network, writes or cached boolean authority.

## Proof request and evidence classes

The adjacent .proof-request.json pins the actual adapter/test and unchanged canonical
inputs. Enclosing delivered commit pins the entire inventory. This is a request for a
future separately authorized disposable native proof; it is NOT a runner registration,
installer, grant, execution instruction or activation permission.

Targeted new script: scripts/test-airprop-listing-native-read-04.mjs. Real adapter,
Core selector, mapper and schemas; fake query responses/session/receipts in the fixture.
Checks cover scoped current read, missing producers, foreign scope/rows/companions,
wrong Unit/Property, revoke/stale resource, coherent party/relationship drift, Listing
version drift, final expiry/backdate, original40001 propagation, page bounds/order/cursor,
and zero promotion to edit authority. No PostgreSQL/Auth/server is started.
Target-lock prerequisite is checked before behavioral scenarios. Current environment
cache mismatch means new behavioral tests NOT_RUN_NOT_PASS; no cache search/install
or replay of the accepted26+26 groups is requested. Static checks on available cache
are reported separately and are not target/native acceptance.
