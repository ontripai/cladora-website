# CLADORA SERVICE v1.4 — SV01G/J delivery boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE collaboration head `c08dc8c`. This slice defines the SERVICE-owned consumer contract for recording delivery, accepting or rejecting delivered quantity, and requesting rework for one exact Service Order stage. It does not create a Service Order, Work Order, document resolver, financial posting, route, persistence layer or parallel authority engine.

## Boundary

The client supplies only context, Workspace, Service Order and stage references with exact expected versions, a bounded decimal quantity, the requested action, an idempotency key, and—only when recording delivery—canonical evidence reference IDs. Rejection and rework require a bounded reason code. Actor, tenant, parties, cumulative quantities, lifecycle states, evidence state, Operations state, financial effects, audit and outbox references are server-owned and rejected when supplied by the client.

The pure evaluator fails closed for denied authority; missing, terminal, cross-Workspace or stale Orders; missing, cross-Order or stale stages; an actor lacking the exact delivery/acceptance capability; invalid stage transitions; zero or excessive quantity; duplicate, missing, cross-Workspace, quarantined/deleted or unreadable evidence. Decimal quantities are compared exactly rather than with floating-point arithmetic. Completion of an Operations Work Order never implies SERVICE acceptance or financial settlement.

## Operational dependencies

Operational evidence attachment requires `service-delivery-evidence-receipt.v1`, owned by Core Vault/Documents. The required output is a server-verifiable, versioned resolution receipt for canonical evidence references that exposes no payload or storage path; rechecks current read authority and quarantine/deletion state; binds the exact Workspace, Service Order stage and delivery attempt; returns bounded denial codes; and supports atomic SERVICE delivery, audit, outbox and idempotency persistence with zero writes on denial and current-authority replay checks.

Technical execution linkage, when a stage genuinely requires it, consumes `service-order-stage-work-order-adapter.v1`, owned by Core Operations (`OPS01`). The required output binds at most one canonical Work Order per execution step, returns versioned current status and bounded conflict/unknown-result codes, preserves SERVICE acceptance as a separate decision, prevents duplicate dispatch on replay, and never treats Work Order completion as delivery acceptance or settlement. Advisory and other non-technical stages remain independent of OPS01.

Until these outputs exist, SERVICE must not expose a runtime delivery route or claim database, API, browser, Operations, document or Production integration.

## Evidence scope

`scripts/test-service-delivery-v14-contract.mjs` covers strict client ownership; action-specific payloads; exact Order/stage versions; current delivery and acceptance capability; terminal and cross-reference denial; partial quantity ceilings using exact decimal comparison; canonical evidence availability, Workspace, quarantine and read access; duplicate evidence; acceptance, rejection and rework decisions. No database, API, browser, Work Order, financial, migration or Production test is represented by this suite.
