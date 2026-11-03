# CLADORA SERVICE V14 execution contract

Status: **application/API source wired, runtime binding inactive, install and
runtime acceptance blocked**.

This package connects the existing versioned SERVICE catalog contracts to a
non-binding service Request. It preserves the current definition, Quote,
subject-provider V2, condition-evidence and persistence contracts. A catalog
definition is not an Offering. An Offering is a Workspace-local, versioned
commercial publication whose exact provider agreement, terms, coverage and
eligibility policy are pinned before a Request can refer to it.

## Command boundary

The server creates transaction, command, Offering/Request and revision IDs.
Clients cannot provide an actor, authority result, provider result or boolean
authorization. The adapters emit `core-transaction-command.v2` and delegate
authority, locking, idempotency, audit, outbox, replay and unknown-commit
handling to the existing Core transaction host.

An Offering create stores revision 1 with its complete localized description,
price or quotation mode, cancellation and acceptance terms, validity interval,
provider/agreement version, coverage and eligibility policy. Submission and
publication require exact Offering and revision versions. Publication uses the
existing separate `services.catalog.publish` permission.

A Request pins the published revision version, Offering lock version,
provider/agreement version, beneficiary, optional canonical resource and the
member description. It creates no Order, booking, payment, acceptance or
finance effect. Condition evidence remains owned by its existing versioned
contract; this package neither rewrites it nor derives a property valuation.

The private mapper writes the existing `service_catalog.requests` aggregate.
Consequently the accepted Quote draft reader/writer can continue from that
Request and produce a non-binding proposal. Neither the request mapper nor the
Quote draft UI creates an Order, accepts a quote, reserves capacity, or
authorizes payment. Financial Order creation remains outside this package and
requires its separately accepted finance provider and atomic persistence.

## Canonical dependencies

The package imports the existing Core provider-agreement and canonical-resource
ABIs from `resource-contracts-v1.ts`, and the existing Core V2 transaction host,
provider-evidence and replay ABIs. It does not define a parallel authority or
receipt envelope.

Provider-agreement storage/producer remains **PROPOSED_NOT_ACCEPTED**. The
injected reader must supply the canonical verification inside the same Core
transaction. Until that producer is accepted, runtime binding is `NOT_READY`.
Geographic coverage is independently `NOT_READY`; its absence does not block a
Workspace-only or resource-bound Request. Capability/policy requirements that
cannot be proven by the current canonical resource ABI also fail closed without
blocking offerings that do not require those claims.

## Application flow

`service-offering-request-flow.v1` is the browser-safe boundary for the
Offering-to-Request action. The UI first asks the server to evaluate the exact
Workspace, Offering, published revision, provider agreement and coverage. For
resource coverage it displays only the current name returned by S02 and sends
the exact resource identity/version/type selected by the member. Workspace
coverage does not call S02, and missing S03 blocks only geographic coverage.

The POST body contains no actor, authority result, provider identity, agreement
identity, Offering version or transaction identifiers. The server resolves
those values and derives stable command identities from the authenticated actor,
Workspace and client idempotency key. A lost result can therefore retry the
same key/body without creating a new command. A changed body with the same key
has a different fingerprint and remains a replay conflict.

The route is present at
`/api/customer/v1/services/offering-request-flow`, but its production binding
returns `null` until accepted S01/S02/S03 readers and the Core transaction host
are installed. It returns `RUNTIME_BINDING_INACTIVE` and never falls back to
the legacy request RPC, `service_role`, or a client decision. The injectable
handler/port boundary is exercised with synthetic local data.

### Request preflight source ports

`service-request-source-ports.v1` implements the existing `loadOffering` and
`resolvePrincipal` ports for one caller-owned `CoreTransactionScopeV1`. It
reuses the accepted Offering/revision/definition/provider SELECTs and Core's
canonical `resolveAuthority` evaluator. The trusted caller must provide the
authority request identity for the already-open serializable transaction,
Workspace lock and exact Offering aggregate. The adapter cannot create a
transaction, synthesize an actor or authority version, or fall back to AAL,
user metadata, `service_role`, or a client flag.

The source read locks the Offering `FOR KEY SHARE`, the exact published
revision `FOR SHARE`, the definition `FOR KEY SHARE`, and the provider party
`FOR SHARE`. Canonical `services.orders.request` authority is checked before
the reads and again after their possible waits. The application calls the
versioned S01 reader and then reloads the complete snapshot; a changed
Offering/revision/provider/agreement/coverage/eligibility binding conflicts,
and expiry or revoked authority denies instead of returning stale readiness.
The exact PostgreSQL `40001` object is preserved for the trusted transaction
caller. Other source failures are reduced to bounded public codes.

`service-offering-time-precision.v1` is the internal SERVICE time facet for
these source decisions. It converts the exact PostgreSQL timestamp text to
epoch microseconds without using `Date.parse`, keeps the inclusive start and
exclusive end boundaries, and treats malformed, over-precision or inverted
intervals as unavailable. Equivalent timezone offsets resolve to the same
instant. The request-source clock port now publishes the exact database string;
numeric/client clocks are incompatible and fail closed rather than silently
rounding to milliseconds.

The S01 dependency is injected as an accepted reader bound to the same scope.
This package does not implement Core's S01 store/final-wait closeout. If that
reader is absent, only the Request preflight returns `SERVICE_S01_NOT_READY`.
The Offering disclosure witness remains independent and never calls S01, so
there is no witness/consumer cycle.

The default product binding remains `null`. Runtime composition still needs a
Core-owned host that opens the exact serializable scope, acquires its Workspace
and Offering lock, produces the authority request identity, and supplies the
accepted S01 implementation. The native-proof request records this missing
composition precisely; it does not require installing unrelated migrations.

## Persistence and replay

`forward.sql` is a source module, not an applied migration. It adds nullable,
legacy-safe version bindings and private source/mutation functions. Existing
rows without the new binding are ineligible for this path and are not inferred
or backfilled. The private mutation function performs Offering/revision row
locks, exact-version checks, a post-wait canonical authority recheck and the
domain mutation in the host transaction. It does not write idempotency, audit
or outbox records because those are Core host responsibilities.

All functions revoke PUBLIC, anon, authenticated and service-role execution.
There is no positive runtime grant. Route source is wired but inactive. Replay
uses `provider_current_state_required`; revoked/expired/stale sources cannot
recover an old successful state. `READBACK_REQUIRED` remains unknown and is
never reported as success.

## Evidence and validation boundary

The offline harness covers exact command binding, Offering and revision
versions, provider agreement and resource currentness, cross-Workspace and
stale denials, publication state, geography and unresolved eligibility gates,
malformed receipts, changed replay, private persistence mapping and unknown
commit handling. The application harness additionally covers HTTP validation,
zero-write denials, stable retry identity, named resources, the existing Quote
draft continuation and the inactive default binding.

A real-Chromium harness for RO/EN/FA and 320/390/768 viewports is included, but
is not runtime evidence unless the locked Playwright dependency and browser are
present and the harness actually runs. None of these synthetic checks proves
PostgreSQL locks, rollback, concurrency, real authority, installation,
connected HTTP/Auth, or provider availability.

Required future gates are: accepted canonical provider-agreement producer,
accepted runtime implementations for any S02/S03 action used, Core artifact pin
if its ABI changes, PostgreSQL parse/install in a disposable environment, real
concurrent CAS/replay/rollback/unknown-commit tests, dedicated executor
ownership/ACL review, route binding activation and connected browser/API/Auth
proof. Those gates do not block the source-only Workspace flow or its tests.
