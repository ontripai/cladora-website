# CORE-RECOVERY-AUTH-01: authority-safe unknown-commit recovery

Status: proposed behavior and bounded implementation package; documentation-only Draft PR.
Owner: Core/Platform. Baseline: main `df8124807a702f3b6fdcce3903e74aed7c713c67`.
No runtime behavior is changed by this document.

## Existing behavior and the gap

The existing [transaction host](../../src/lib/core/postgres-transaction-host-v1.ts) authenticates the actor, acquires idempotency/Workspace/aggregate/provider locks, and resolves canonical authority before looking up `platform.idempotency_keys`. Its `request_hash` covers the entire parsed command, including `authority_version`. Exact replay requires that hash, the stored authority revision, and the complete entitlement binding to match. The canonical provider locks the revision row and checks current permission/module truth in the same transaction.

Consequently, resubmitting the original command after a revision bump fails current authority validation; replacing its revision changes the request hash and produces replay conflict. A global revision can advance because an unrelated authority source changed, even when this actor retains permission. This conservative execute behavior remains intact.

A lost COMMIT acknowledgement is not proof of rollback. The committed receipt already exists atomically in `platform.idempotency_keys.response_ref` with the domain mutation, `audit.events`, and `platform.outbox_events`. Recovery must read that existing evidence, not execute the command again.

## Proposed method on the existing host

Add an explicitly read-only `recover` method to `CoreTransactionHostV1` in a future implementation task. It uses the same pool, transaction scope, lock helpers, canonical provider, receipt parser, and idempotency table as `execute`. It is not another host, authority store, or ledger. Existing `execute` overloads, exact-replay comparisons, request hashes, stored receipts, and entitlement comparisons remain unchanged.

The strict versioned input, `core-transaction-recovery-request.v1`, contains:

- `original_command`: the exact original parsed V1/V2 command, including its original authority revision and all effect/subject bindings;
- `current_authority_version`: a fresh server-observed canonical revision hint, verified under the existing revision barrier;
- `recovery_transaction_id` and `recovery_command_id`: distinct identities for this read attempt, never substituted into the original command;
- `request_version: 1`.

A verified server session supplies the actor and assurance required by the original operation. Neither a request body nor a caller-supplied historical receipt can authenticate the actor. Missing original command bytes/fields cannot be reconstructed from receipt fields alone: receipts do not preserve every command field, including `provider_source_ids`. The trusted server caller must retain or supply the complete original command from the original attempt; this proposal creates no durable command store. The existing HTTP handler does not return or persist that complete command for the client, so its recovery integration remains blocked until the owner proves availability of the original envelope without adding a parallel ledger. A public caller cannot select the authority revision or inject a command envelope to authenticate itself. No reduced hash or revision-stripped hash is accepted. Recovery rejects a session actor/Workspace mismatch before disclosing a result.

The host hashes the original command using precisely the existing parser and `SHA-256(JSON.stringify(parsedCommand))` algorithm. It compares that hash with the stored row. Only the fresh *read authorization* uses `current_authority_version`; the original command and historical receipt retain their original revision. Historical/current revision inequality is permitted only in this read operation, never in `execute`.

## Transaction and disclosure algorithm

1. Strictly parse both request and original command. Reject unknown fields. Verify session, assurance, actor, and Workspace binding. Freeze the original command for the attempt.
2. Use the same session-bound backend and serializable transaction lifecycle as the existing host. Acquire the existing lock order: original Workspace-scoped idempotency key, active Workspace row, original aggregate, sorted unique original provider sources, then the canonical revision barrier through the existing authority provider. Recovery IDs identify the new SQL scope; original IDs identify only the historical effect.
3. Resolve current authority with the original context, actor, Workspace, permission, module and evaluation purpose, but the recovery transaction/command IDs and fresh revision hint. Reuse `resolveAuthority` and the host's canonical actor/permission check. A stale hint, revoked membership/context, missing module/entitlement, denied permission, cross-Workspace, or unknown authority denies before returning any history. A stale hint requires a fresh caller request; never silently rewrite a command or fall back to old authority.
4. Read the existing idempotency row under the same key/tenant lock. Validate row actor, original full request hash, unexpired retention and receipt schema. Validate every existing original receipt identity comparison, including original revision, context, aggregate result version, subject's five fields and provider code. Corrupt, changed, incomplete or mismatched evidence returns a bounded conflict/unavailable result. Do not refresh expiry or write a response reference.
5. Preserve entitlement identity: current and stored canonical bindings must have identical contract, Workspace, module definition ID, module code and entitlement key and both must exist. Each revision must equal its own associated authority receipt. Historical/current revision inequality alone is acceptable for recovery; disappeared or substituted entitlement identity is a conflict. A legacy receipt without canonical entitlement or V2 typed evidence is unsupported for cross-revision recovery; no compatibility boolean allow.
6. Require a current provider read/disclosure decision in this SQL scope, bound to recovery IDs, attempt, fresh authority decision/revision, original actor/Workspace/context and the exact original subject reference. Use the existing typed evidence schema and binding validation. Existing command-execution validators must not be called with forged command versions to bypass post-commit CAS checks. Where the existing provider cannot express readback of a committed result, add an optional read-only `validateRecovery` capability to the same provider composition; absence fails closed. It must use existing canonical aggregate/source authorization and privacy rules, not cached historical evidence or a new policy engine. It verifies the stored effect's relation and current actor access; it does not require the aggregate still be at the pre-mutation CAS version. Any subject drift that cannot be safely authorized against the exact original reference denies disclosure. No rewritten subject or evidence under another provider identity is allowed.
7. Build the minimal recovery response while the revision barrier is held, then ROLLBACK the read transaction and clean/release the connection. Cleanup failure fails closed; uncertain/broken connections are destroyed. Retry real `40001` using the same bounded host policy and a fresh transaction/attempt; recompute current authority/evidence on every attempt. No mutation callback, idempotency claim/update, audit insert or outbox insert is reachable in recovery.

The revision barrier protects the authorization decision through transaction end; revocation committed before that decision is denied. Revocation after the read transaction ends does not retroactively invalidate an already-authorized response, and that response grants no later operation.

## Result contract and behavior matrix

`core-transaction-recovery-result.v1` is a read result, never `committed` or `exact_replay` and never a replacement persisted receipt. Success has `status=recovered_committed`, `execution_authorized=false`, a bounded result `{receipt_id, aggregate_id, aggregate_version, committed_at}`, and an internal current `recovery_authority` plus current typed provider evidence. Their IDs/attempt identify the recovery transaction. The historical authority/provider evidence remains unchanged in the persisted receipt and is not exposed through the public transport. Current read authorization evidence is not persisted as another ledger.

| Situation | Recovery behavior | Durable writes |
| --- | --- | --- |
| Original commit exists, revision unchanged, current permission and disclosure gates pass | `recovered_committed`; same receipt ID/result version | 0 |
| Original commit exists, revision advanced, original operation permission and entitlement identity retained, current disclosure gates pass | `recovered_committed`; preserve old receipt; authorize only this read with current revision | 0 |
| Actor/context revoked or original operation permission/module removed | `denied/AUTHORITY_DENIED`; no receipt existence/detail disclosed; never undo the prior commit | 0 |
| Same key, changed intent, context, identities, source set, versions or subject/relation | `denied/REPLAY_CONFLICT` after current authorization; no historical result returned | 0 |
| Entitlement removed or identity changed despite another allow | authority denial or entitlement conflict; no historical result returned | 0 |
| Current authority hint stale, unknown, or provider query fails | bounded denial/unavailable; no cached allow | 0 |
| Authorized read, row absent after serialized lookup | `unresolved/READBACK_REQUIRED`; no automatic execution | 0 |
| Row expired, malformed, incomplete, purged or unsupported legacy evidence | `unresolved/RECOVERY_UNAVAILABLE`; no fallback to mutation | 0 |
| Concurrent recovery/execute of same key | serialized by existing idempotency lock; recovery reads only the committed visible state | 0 for recovery |

Absence is not permission to retry mutation: a serializable snapshot may predate a concurrent commit, and retention may have removed history. No automatic new key or re-execution is permitted. A later business command needs its own currently authorized execution and explicit domain reconciliation. A recovered receipt is historical commit evidence, never input authorization for that command.

## Limited executable follow-up package

This Draft contains the specification only. The following bounded implementation is a separate reviewed package:

1. Extend types and implementation in `src/lib/core/postgres-transaction-host-v1.ts` with recovery-only input/result schemas and `recover`; reuse private receipt parsing and lock/transaction helpers. Do not remove revision from execution hashing or alter `entitlementBindingsMatch` for execute.
2. Share host lifecycle code without changing execute lock ordering, atomic boundary or retry/zero-write semantics. Keep recovery permanently in the read phase and terminate via rollback. Guard the mutation function and every ledger write as unreachable in this mode.
3. Extend the existing typed provider composition with optional current readback validation. Implement only a canonical provider-supported profile; unsupported V1 or provider profiles return unavailable. Do not introduce a generic allow, fake execution command, new permission grant, or provider-specific authority engine.
4. Add only focused real PostgreSQL regressions to the existing host/provider harnesses. Consumer HTTP wiring, routes, grants, migrations and activation remain outside this package. A future transport may map authorized success to 200, unresolved to 202, conflict to 409, denial to 403 and unavailable to 503 using bounded bodies; this document does not implement it.
5. Review the implementation and its exact head independently before rollout. If schema or privilege changes are discovered necessary, stop for separate authorization; the intended design uses the existing inventory only.

### New regression acceptance cases (not run by this documentation task)

- Real commit followed by acknowledgement loss, unrelated canonical revision bump, and retained permission: current recovery succeeds with the original stored receipt ID and no second effect.
- Same setup followed by revoke: bounded denial, no existence leak, unchanged committed effect set; repeat for permission/module/entitlement removal.
- Changed intent under the original key: conflict for every effect/identity binding, not recovered success.
- Revision/permission unchanged: recovery returns the same minimal result; execute's exact replay behavior remains unchanged.
- Entitlement identity changed while another path grants permission: no cross-binding recovery.
- Concurrent revocation and readback: real lock barrier ordering, current decision under the same SQL transaction; real SSI retry records attempt 2 and performs no writes.
- Concurrent recovery and delayed commit: no speculative execution, bounded unresolved when snapshot visibility is insufficient; fresh recovery may subsequently see the commit.
- Expired/absent/corrupt history and missing provider readback capability: unavailable/unresolved, never mutate or claim a key.
- Forged recovery authority/evidence, foreign actor/Workspace/transaction/revision/subject/provider: fail closed; current evidence bound to the recovery scope.
- All outcomes assert unchanged domain values and unchanged idempotency row contents/expiry, audit and outbox counts. Verify no receipt or canonical revision write. Verify session/SQL-role cleanup and poisoned pool isolation using existing helpers.

These are new acceptance requirements, not claims that old suites have passed them. Previously reviewed host/provider and HTTP evidence is retained and is not repeated in this docs task.

## Boundaries and dependencies

Core owns current authority, the host and receipt validation. Domain owners supply current read/disclosure validation using their existing canonical sources. SERVICE's HTTP unknown-commit response can remain `202 READBACK_REQUIRED` until a separately reviewed recovery transport exists. Consumer/provider support is a real dependency; permission retention alone cannot bypass subject privacy. Neither #389 acceptance nor this proposal authorizes production wiring.

No historical SQL, Remote statements, credentials or private PM configuration is included. This proposal creates no migration, grant, runtime activation, parallel authority/ledger or PM lifecycle transition.
