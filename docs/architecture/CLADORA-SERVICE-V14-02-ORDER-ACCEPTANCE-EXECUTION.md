# CLADORA SERVICE V14 02 order acceptance contract record

## Identity and boundary

| Field | Value |
| --- | --- |
| Package | `SV01E/F` contract boundary after the existing quote flow |
| Workstream | `SERVICE CLADORA 02` |
| Baseline | CLADORA v1.4 at `2fb9d7d`; stacked after accepted `SV01B` head `dc1816b` |
| Cycle | `SERVICE-V14-02-C1` |
| Release | Not released |

The existing quote draft and non-binding publication flows are retained. This slice adds only a strict customer-intent command and a pure decision contract for eventual atomic conversion of one exact presented quote version into a SERVICE Order. It creates no table, migration, RPC, route, Order, financial posting, payment, Booking allocation or Work Order.

## Contract rules

- The client submits only context, Workspace, quote ID, expected quote version and idempotency key.
- Actor, tenant, request, parties, amount, currency, tax, payer shares, finance state, acceptance time and downstream IDs are server-derived and rejected if supplied by the client.
- Current authority, exact Workspace/quote identity, version, presented state, expiry, request state and active parties are checked before a positive planning result.
- A positive result also requires a server-verified Finance contract decision. Until FIN-01 is accepted, operational Order creation remains blocked.
- This pure evaluator is not an authorization boundary and does not imply that an Order exists.

## Narrow dependency

Operational SV01F requires an accepted `financial-proposal-posting-receipt.v1`/FIN-01 result defining the exact price, tax and receipt snapshot consumed by Order creation, plus an accepted atomic SERVICE Order persistence contract. The required output is a server-verifiable, versioned financial decision reference with bounded failure codes and zero-write denial behavior. Finance owns financial posting; SERVICE owns the commercial Order.
