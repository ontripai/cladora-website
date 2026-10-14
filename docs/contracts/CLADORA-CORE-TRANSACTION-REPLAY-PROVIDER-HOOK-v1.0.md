# Core transaction exact-replay provider hook v1

Status: inactive Core contract and host implementation. No route, grant, migration, consumer wiring or Remote activation is included.

## Boundary and order

`createCorePostgresTransactionHostV1` remains the only transaction engine. It keeps the existing order: Workspace-scoped idempotency advisory lock, active Workspace row lock, aggregate advisory lock, sorted provider-source locks, canonical current-authority recheck, and locked idempotency receipt read. The hook runs only after the stored row, complete command hash, parsed receipt, authority entitlement and V2 subject/provider identity all match. It runs before `exact_replay` is returned.

The hook receives the existing `CoreTransactionScopeV1`, exact parsed command, current post-lock authority decision and parsed stored receipt. Its decision binds the PostgreSQL transaction ID, transaction/command IDs, Workspace, actor, Context, current authority decision/revision, attempt, receipt ID/version and domain-separated SHA-256 hashes of the exact command and receipt. `evaluated_at` must be no earlier than the current authority decision and no later than the host's post-hook database time.

The scope remains in its read phase. Fresh `validateProviders` and `mutate` are not called on replay. Denial, stale current state/evidence, unavailable provider, malformed decision or malformed stored receipt rolls back the read attempt and adds no idempotency, audit, outbox or domain write. A PostgreSQL `40001` is propagated to the host loop; the next attempt uses a new transaction, locks, authority decision and hook evaluation.

## Capability and compatibility

Existing providers default to `replay_policy=authority_only`, preserving their current authority-and-receipt replay behavior. A consumer that needs current provider state declares `replay_policy=provider_current_state_required` and supplies `validateReplay`. V1 providers also supply `replay_provider_code`; V2 providers reuse their existing `provider_code`. The host persists that provider identity and requirement inside the existing immutable Core receipt, so a later replay composition cannot remove or downgrade it. A required capability that is missing, malformed, substituted or present without its policy marker fails closed with `PROVIDER_UNAVAILABLE`.

The registered CE Guide and Documents writer profiles must select the required policy when their inactive integrations consume this contract. CE rechecks the current resulting Guide version/state and current target disclosure. Documents rechecks the consumed intent plus committed document/version/Workspace provenance. Neither profile may call its fresh-command validator, reconstruct command authority from the historical receipt, or add another host, authority store or replay ledger.

## Bounded outcomes

An accepted decision permits return of the unchanged historical Core receipt as `exact_replay`; it does not authorize a new command. `REPLAY_STATE_CHANGED`, `REPLAY_DISCLOSURE_DENIED` and `STALE_PROVIDER_EVIDENCE` map to `REPLAY_CONFLICT`. `PROVIDER_UNAVAILABLE` and malformed hook evidence map to `PROVIDER_UNAVAILABLE`. Current authority denial occurs before the hook. A canonical pre-receipt `ACTOR_REVOKED` failure returns bounded `AUTHORITY_DENIED` without an authority receipt or internal denial reason.

`CORE-RECOVERY-AUTH-01` remains separate. Its cross-revision unknown-commit readback contract may authorize disclosure under a new authority revision. This exact-replay hook does not relax the existing equality requirement for command, receipt, entitlement or authority revision and does not implement recovery.

## Verification

`test:core-tx-replay-hook:postgres` runs the real Core host against a disposable migrated PostgreSQL database. It covers V2 CE and V1 Documents profiles, exact replay, skipped fresh validation/mutation, missing capability, provider denial, stale evidence, malformed decision/receipt, current-authority revocation, zero additional effects and a PostgreSQL `40001` that reaches the host and succeeds only after a fresh attempt.
