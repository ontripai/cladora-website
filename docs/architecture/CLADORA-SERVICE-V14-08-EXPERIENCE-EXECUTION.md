# CLADORA SERVICE v1.4 — SV01N experience boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE finance head `40f832d`. This slice defines the SERVICE consumer boundary for acknowledging component status, requesting Order cancellation or compensation, and accepting a compensation reference. CE coordinates the experience receipt; SERVICE remains owner of the canonical Service Order. This slice creates no parallel experience, cancellation, compensation, benefit, notification or financial state machine.

## Boundary

The client supplies context, Workspace, exact Service Order version, action and idempotency key. Component actions include an exact canonical component version; compensation acceptance includes an exact compensation-reference version; request actions use a bounded reason code. Actor, tenant, experience/cancellation state, compensation amount, benefits, payments/refunds, ledger references and notification outcome are server-owned and rejected when supplied by the client.

The pure evaluator requires current SERVICE authority, the exact canonical Order, an available action-specific component or compensation reference when applicable, and one verified CE coordination receipt bound to the exact action, Order and subject versions. Revoked, closed, stale, wrong-kind and cross-Workspace subjects fail closed. Cancellation or compensation never directly mutates Finance; any monetary effect uses FIN01 separately.

## Operational dependency

Runtime activation requires `service-experience-coordination-receipt.v1`, coordinated by Community & Experience with SERVICE as Order owner. The required output is a versioned component-status/cancellation/compensation receipt bound to the canonical Order and parties; current-authority and audience checks; explicit partial-component outcomes; separation of cancellation, compensation decision and financial effect; bounded denial/conflict/unknown-result codes; exact replay behavior; and atomic SERVICE status link, audit, outbox and idempotency persistence with zero writes on denial.

Until that output exists, neither CE nor SERVICE may infer Order cancellation, compensation or financial success from a UI acknowledgement or notification delivery.

## Evidence scope

`scripts/test-service-experience-v14-contract.mjs` covers strict action payloads, rejected server-owned claims, exact Order/component/compensation versions, revoked and wrong-scope subjects, and verified/mismatched CE receipts. No database, API, browser, notification delivery, Finance, migration or Production test is represented by this suite.
