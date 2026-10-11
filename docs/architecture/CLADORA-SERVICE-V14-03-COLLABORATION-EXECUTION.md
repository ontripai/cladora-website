# CLADORA SERVICE v1.4 — SV01K/L collaboration boundary

Baseline: CLADORA v1.4 commit `2fb9d7d`. This slice defines the SERVICE consumer contract for linking an already-authorized canonical Communications message or Vault document to an existing Service Request. It does not add a second message, notification, document-storage, identity, or authorization engine.

## Boundary

The browser may send only the explicit context, Workspace, Service Request, expected request version, canonical reference ID and positive safe source version, relation, and idempotency key. Actor, tenant, audience, message payload, object path, signed URL, customer data, retention decision, delivery state, and notification outcome are server-owned and rejected when supplied by the client.

The pure evaluator fails closed when authority is denied; the request is absent, terminal, cross-Workspace, or stale; the current actor is not a request party; the canonical reference is absent, stale, quarantined/deleted, wrong-kind, cross-Workspace, unreadable, or not restricted to the request-party audience. It is planning logic only, not an authorization boundary.

## Operational dependency

Operational activation is blocked on a shared subject-link adapter contract owned by Core Communications and Core Vault/Documents. The required output is a server-verifiable, versioned adapter that resolves a canonical reference without exposing payload or storage paths; evaluates current request-party audience and current reference read authority; rejects cross-Workspace, quarantined/deleted, stale, revoked, and replay-altered requests with bounded codes; atomically records the SERVICE subject link, audit entry, outbox notification receipt, and idempotency result; proves zero writes for denied requests; and rechecks authority on retry.

Until that adapter exists, SERVICE must not expose a route or claim message/document/notification integration. Existing Communications and Vault flows remain unchanged.

## Evidence scope

`scripts/test-service-collaboration-v14-contract.mjs` covers strict client ownership, a positive safe canonical source version, valid document linking, authority denial, unavailable/terminal/stale request, non-party actor, unavailable/stale/quarantined reference, kind/Workspace mismatch, unreadable reference, over-broad audience, and rejection of private storage, URL, payload, customer-data, and retention claims. No database, API, browser, notification delivery, migration, or Production test is represented by this contract suite.
