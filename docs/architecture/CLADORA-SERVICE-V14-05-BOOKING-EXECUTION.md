# CLADORA SERVICE v1.4 — SV01H booking boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE delivery head `3729884`. This slice defines the SERVICE consumer boundary for requesting and confirming a capacity hold, rescheduling an allocation, or cancelling it. It does not implement BK01, calculate availability or conflicts, create a capacity ledger, own resource identity, expose a route, persist an allocation, or release to Production.

## Boundary

The client supplies only context, Workspace, exact Service Order/stage versions, the requested action and idempotency key. Hold and reschedule intents include an explicit offset-aware half-open time window, bounded capacity, and canonical resource IDs. Confirm, reschedule and cancel intents identify one exact allocation version; cancellation adds a bounded reason code. Actor, tenant, availability, conflict results, allocation state/expiry, resource state, financial effects, audit, outbox and receipt identity are server-owned and rejected when supplied by the client.

The pure evaluator fails closed for denied authority; missing, terminal, cross-Workspace or stale Orders; missing, terminal, cross-Order or stale stages; stages that do not require booking; mismatched, terminal, expired or stale allocations; and missing, denied, stale or scope-altered BK01 decisions. Resource sets are compared canonically. A valid result consumes one server-verified BK01 receipt and never infers availability from the requested window.

## Operational dependency

Runtime activation requires `shared-capacity-allocation-receipt.v1`, owned by Core Booking/Capacity (`BK01`). The required output is a versioned, server-verifiable receipt for hold/confirm/reschedule/release over canonical resources and a half-open interval; atomic conflict and partial-capacity enforcement; deterministic multi-resource locking; expiry independent of cleanup timing; bounded denial/conflict/unknown-result codes; exact replay binding; current authority and resource-state rechecks; and atomic SERVICE allocation link, audit, outbox and idempotency persistence with zero writes on denial.

Until that output is accepted, SERVICE must not expose a booking route, claim a hold or reservation, or reuse AIRPROP reservation state as evidence of BK01. Services that do not require booking remain independent.

## Evidence scope

`scripts/test-service-booking-v14-contract.mjs` covers strict action-specific payloads; time ordering and unique resources; exact Order, stage and allocation versions; terminal and cross-scope denial; required-booking separation; hold expiry; and exact BK01 receipt action, capacity, window and resource binding. No database, API, browser, concurrency, expiry-worker, migration or Production test is represented by this suite.
