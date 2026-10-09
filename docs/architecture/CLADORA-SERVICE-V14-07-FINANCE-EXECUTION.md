# CLADORA SERVICE v1.4 — SV01M finance boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE portfolio head `c65810d`. This slice defines the SERVICE consumer boundary for invoice requests, payment application, refund requests and provider-settlement requests. It does not calculate money or tax, post a ledger, own invoice/payment/refund/settlement state, expose a route, persist financial data, run a migration or change Production.

## Boundary

The client supplies only context, Workspace, exact Service Order version, a canonical source reference and its exact version, the requested action and an idempotency key. Refund adds a bounded reason code. Actor, tenant, amounts, currency, tax, payer shares, invoice/refund/provider amounts, ledger references, posting state and timestamps are server-owned and rejected when supplied by the client.

The pure evaluator requires current SERVICE authority, a non-cancelled canonical Order in the exact Workspace/version, an eligible action-specific source (delivery acceptance, payment or settlement source), and one verified FIN01 receipt bound to the exact action, Order and source versions. Reversed, void, disputed, stale, wrong-kind and scope-altered sources fail closed.

## Operational dependency

Runtime activation requires `service-financial-operation-receipt.v1`, owned by Core Finance (`FIN01`). The required output is a versioned, server-verifiable decision and posting receipt for invoice, payment application, refund/reversal and provider settlement; canonical price/tax/currency and rounding; payer-share authorization; closed-period and duplicate-source handling; source parity; bounded denial/conflict/unknown-result codes; exact replay behavior with current authority; and atomic SERVICE result link, audit, outbox and idempotency persistence with zero writes on denial.

Until that output exists, SERVICE must not expose financial routes, claim posting success or infer settlement from delivery, Work Order completion or payment UI state.

## Evidence scope

`scripts/test-service-finance-v14-contract.mjs` covers strict action payloads, rejected financial claims, current authority, exact Order/source versions and scope, action-specific source kinds, reversed/disputed sources, and verified/mismatched FIN01 receipts. No database, API, browser, ledger parity, closed-period, payment provider, migration or Production test is represented by this suite.
