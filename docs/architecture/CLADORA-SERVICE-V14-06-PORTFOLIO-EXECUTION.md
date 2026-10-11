# CLADORA SERVICE v1.4 — SV01I portfolio projection boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE booking head `c3f05eb`. This slice defines the SERVICE consumer boundary for reading a Service Order reference and following a currently allowed action from an existing owner portfolio projection. It does not create or copy identity, ownership, portfolio membership, resources or Service Orders, and adds no route, persistence, migration or Production change.

## Boundary

The client supplies context, Workspace and canonical portfolio reference for reads, with optional canonical resource filtering and bounded pagination. An action intent adds one exact Service Order version and one bounded SERVICE action. Actor, tenant, owner or party identity, ownership shares, projected items, Order lifecycle state, resource labels and available actions are server-derived and rejected when supplied by the client.

The pure evaluator requires current SERVICE authority, a verified and readable PF01 receipt for the exact portfolio and Workspace, one unique versioned Order reference inside that receipt, the canonical Service Order in that Workspace, its exact resource and version, and the requested action in both the receipt-derived and current server-derived action sets. A Service Order that is absent from the receipt fails with the generic `ORDER_UNAVAILABLE` decision before its data can influence the result, preventing another owner's Order or resource metadata from being disclosed. Revoked/stale receipts, duplicate or malformed references, cross-Workspace references, stale Orders and unavailable actions fail closed. Every read and replay must recheck current authority and receipt revocation.

## Operational dependency

Runtime activation requires `portfolio-service-action-projection-receipt.v1`, owned by Core Portfolio (`PF01`). The required output is a versioned, server-verifiable projection receipt that binds current person/organization authority to canonical portfolio, Workspace and resource references; returns unique Service Order references with exact versions, resource bindings and allowed action links without copying source records; removes revoked management while preserving independent ownership; prevents other-owner leakage; provides bounded stale/revoked/scope errors and cursor binding; and requires current-authority rechecks for reads and action replay.

Until that output exists, SERVICE must not expose a portfolio route or infer portfolio authority from a Service Order, historical owner field or Workspace membership alone.

## Evidence scope

`scripts/test-service-portfolio-v14-contract.mjs` covers strict read/action payloads, bounded pagination, current authority, verified/readable and revoked PF01 receipts, exact portfolio/Workspace scope, unique receipt-bound Order references, canonical Order resource/version, bounded allowed actions and generic cross-owner denial. No database, API, browser, runtime cross-owner fixture, revocation race, migration or Production test is represented by this suite.
