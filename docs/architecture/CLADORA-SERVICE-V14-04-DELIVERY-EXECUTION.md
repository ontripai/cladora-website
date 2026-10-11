# CLADORA SERVICE v1.4 — SV01G/J delivery boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after accepted SERVICE collaboration head `a3cbb7b`. This slice defines the SERVICE-owned consumer contract for recording delivery, accepting or rejecting delivered quantity, and requesting rework for one exact Service Order stage. It does not create a Service Order, Work Order, document resolver, financial posting, route, persistence layer or parallel authority engine.

## Boundary

The client supplies only context, Workspace, Service Order and stage references with exact expected versions, a bounded decimal quantity, the requested action, an idempotency key, and—only when recording delivery—canonical evidence references. Each evidence reference is a strict pair of a UUID `reference_id` and a positive safe-integer `source_version`. Rejection and rework require a bounded reason code. Actor, tenant, parties, cumulative quantities, lifecycle states, evidence state, Operations state, financial effects, audit and outbox references are server-owned and rejected when supplied by the client.

The pure evaluator fails closed for denied authority; missing, terminal, cross-Workspace or stale Orders; missing, cross-Order or stale stages; an actor lacking the exact delivery/acceptance capability; invalid stage transitions; zero or excessive quantity; duplicate, missing, cross-Workspace, quarantined/deleted or unreadable evidence; and any mismatch between the supplied evidence source version and the exact version read by the server. Evidence access is checked before version mismatch so a denial cannot disclose internal evidence or Workspace metadata. A stale evidence reference returns only the bounded `STALE_EVIDENCE_REFERENCE` code. The evaluator has no write or receipt capability. Decimal quantities are compared exactly rather than with floating-point arithmetic. Completion of an Operations Work Order never implies SERVICE acceptance or financial settlement.

## Operational dependencies

Operational evidence attachment requires `service-delivery-evidence-receipt.v1`, owned by Core Vault/Documents. The required output is a server-verifiable, versioned resolution receipt for canonical evidence references that exposes no payload, signed URL, private object path or storage metadata; returns the exact server-read evidence source version; rechecks current read authority and quarantine/deletion state; binds the exact Workspace, Service Order stage and delivery attempt; returns bounded denial codes; and supports atomic SERVICE delivery, audit, outbox and idempotency persistence with zero writes or receipts on denial and current-authority replay checks. The resolver and runtime adapter remain contract-only and unaccepted.

Technical execution linkage, when a stage genuinely requires it, consumes `service-order-stage-work-order-adapter.v1`, owned by Core Operations (`OPS01`). The required output binds at most one canonical Work Order per execution step, returns versioned current status and bounded conflict/unknown-result codes, preserves SERVICE acceptance as a separate decision, prevents duplicate dispatch on replay, and never treats Work Order completion as delivery acceptance or settlement. Advisory and other non-technical stages remain independent of OPS01.

Until these outputs exist, SERVICE must not expose a runtime delivery route or claim database, API, browser, Operations, document or Production integration.

## Evidence scope

`scripts/test-service-delivery-v14-contract.mjs` covers strict client ownership; action-specific payloads; exact Order/stage versions; current delivery and acceptance capability; terminal and cross-reference denial; partial quantity ceilings using exact decimal comparison; versioned canonical evidence input; exact source-version matching; Workspace, quarantine and read access; duplicate evidence; bounded stale denial without mutation or metadata disclosure; acceptance, rejection and rework decisions. No database, API, browser, Work Order, financial, migration or Production test is represented by this suite.
