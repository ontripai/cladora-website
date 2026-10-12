# CLADORA Core current-authority transactional port v1.0

Status: contract-only candidate

Owner: Core

Consumers: SERVICE and Community & Experience (CE)

## Purpose

This contract binds a command to a fresh current-authority decision inside the command transaction. It does not authorize a command by itself. A runtime provider must resolve authority after acquiring the command aggregate lock and immediately before the protected mutation.

Core remains the sole authority truth. The provider must use `workspace-native-effective-authority.v2` and the canonical evaluator `app_private.check_workspace_native_permission_v2`. Consumers must not create an authority store, registry, cache, ledger, or projection that can issue a decision.

This package includes no runtime provider, endpoint, migration, grant, seed, role assignment, or activation.

## Request

`core-current-authority-transaction-port-request.v1` is strict and contains:

- exact `workspace_id` and server-derived `actor_id`;
- the authority version expected by the command;
- exact permission, module, and evaluation purpose;
- transaction ID, command ID, retry attempt, and isolation level;
- the locked aggregate identity, lock Workspace, and lock acquisition instant.

The actor identity must come from the authenticated server context. A public client value is not an authority input. The authority version must be read from version-bearing Core authority state; it must not be minted or advanced by a consumer.

## Canonical observation

`core-current-authority-observation.v1` is valid only when produced by the future Core provider in the same database transaction as the command. It binds the canonical decision to the request, actor, Workspace, authority version, permission, module, transaction, command, and lock Workspace.

The observation exposes status only. Membership, role, grant, policy source, and other authority internals remain private. The observation is transient input to the adapter and is not a consumer projection.

## Decision receipt

`core-current-authority-decision-receipt.v1` has `receipt_version=1`, an offset-aware `evaluated_at`, and exact request bindings. An allow receipt proves that the canonical observation was evaluated at or after the lock instant. Equivalent timestamp offsets are compared as instants.

Every receipt is transaction-bound, is not reusable as command authority, and requires a new current-authority recheck on retry or replay. Persisting a receipt for audit does not turn it into a grant.

Denial is limited to these codes:

- `CROSS_WORKSPACE`
- `TRANSACTION_CONTEXT_MISMATCH`
- `AUTHORITY_BINDING_MISMATCH`
- `ACTOR_REVOKED`
- `STALE_AUTHORITY_VERSION`
- `RECHECK_BEFORE_LOCK`
- `AUTHORITY_DENIED`

Evaluation is fail-closed in that order. A denial returns request-bound status and does not disclose the membership, role, grant, or policy source that caused it.
Structurally invalid or unknown input fields fail schema validation and the command must abort without side effects.

## Transaction sequence

1. Resolve the authenticated actor and selected Workspace on the server.
2. Begin the command transaction.
3. Lock the command aggregate in the same Workspace.
4. Resolve the current Core authority version and evaluate the canonical permission in that transaction.
5. Bind the canonical observation to the request.
6. Continue only with an `allowed` receipt; otherwise abort before side effects.
7. On any retry or replay, repeat steps 2–6 with a new decision ID and current authority.

A provider must abort on a cross-Workspace lock, a revoked actor, a changed authority version, an observation made before the lock, or any binding mismatch.

## Consumer conformance

SERVICE binds order mutations to `services.orders.request` in `services_orders`. SERVICE retains ownership of order lifecycle, idempotency, and domain invariants.

CE binds guide commands to `experience.guide.manage` in `experience_guides`. This mapping is contract-only and does not seed or activate the permission. CE retains ownership of guide lifecycle and domain invariants.

Both consumers must pass exact Workspace, actor, authority version, permission, module, transaction, command, and aggregate-lock context. Neither consumer may infer allow from a previous receipt or from locally copied authority data.

## Integration boundary

The exported TypeScript interface describes the future provider boundary. `bindCanonicalCurrentAuthorityObservationV1` is a pure fail-closed adapter for validation and receipt construction. It performs no I/O and supplies no authority truth.
