# Core PostgreSQL transaction host v1.0

`CORE-TX-HOST-01` implements a shared, injected PostgreSQL transaction host. It is exported for server-side composition but is not imported by any route or production consumer. This package adds no migration, grant, seed, provider activation, or authority store.

## Trust and authority

Inputs originate from authenticated server context, never client-supplied identity. `context_id`, Workspace and actor must be server-derived. The trusted Core `resolveAuthority` provider reads and locks version-bearing canonical authority state on the supplied transaction scope and returns the existing `core-current-authority-observation.v1`. It must resolve current status and version, not echo the command's expected version. Consumers cannot implement an alternative allow engine or cache an earlier observation. Core still owns selecting the version-bearing authority source; this host does not invent a global authority revision.

The host independently calls `app_private.check_workspace_native_permission_v2` and verifies `auth.uid()` against the exact actor in the same connection. Provider allow cannot override canonical denial. `bindCanonicalCurrentAuthorityObservationV1` rejects revoked actor, stale version, foreign Workspace, mismatched transaction and pre-lock observation. Every replay and serializable retry obtains a fresh decision. A persisted receipt remains non-reusable as command authority.

This is an internal trusted-code capability, not a SQL sandbox. Provider callbacks must use only its parameterized SQL scope and perform no network calls or external side effects. Authority/provider validation is read-only: its query capability admits SELECT only; mutation is enabled only after all guards pass. SQL transaction/session control and multi-statements are rejected. A SQL SELECT can invoke routines, so routine purity remains a reviewed trusted-provider responsibility. No connection string, pool client, release or independent COMMIT is exposed to callbacks. Scope queries fail after the transaction ends. Unawaited queries are drained before phase completion; caught query failures still abort.

## Transaction and locks

Each attempt owns one pooled connection and a serializable transaction. Fixed local search path, lock timeout and statement timeout bound execution. Lock order is idempotency advisory lock, the active `platform.customer_workspaces` row, aggregate advisory lock, then sorted unique provider-source advisory locks. All locks are transaction-scoped. The native database transaction ID and exact command transaction/attempt are exposed to providers for conformance. The host derives tenant from the Workspace row; the caller cannot supply an unrelated tenant.

The domain mutation provider must validate and lock the actual domain aggregate/source rows under these locks and enforce lifecycle and expected aggregate version. Every cooperating host takes the same lock namespace/order. Existing writers which do not use the shared host are not silently upgraded by this package. Authority providers must hold read locks on mutable authority inputs until commit, so concurrent revoke/version changes serialize or force a fresh transaction retry.

## Canonical mappings

| Contract | Existing storage mapping |
| --- | --- |
| Idempotency | `platform.idempotency_keys`: derived tenant, actor, key `core-tx.v1:<Workspace>:<case-sensitive command key>`, SHA-256 of the complete parsed command, immutable receipt in `response_ref`, status 200, bounded expiry |
| Audit | `audit.events`: derived tenant/actor, command ID as request ID, aggregate identity, metadata-only receipt/Workspace/transaction/authority/mutation identifiers; generated bigint ID is returned as a decimal string |
| Outbox | `platform.outbox_events`: derived tenant, aggregate type/ID/version, versioned event type, command trace ID, metadata-only event payload; existing unique constraint is preserved |

Provider/domain state is not copied into another ledger. `input_fingerprint` remains consumer-owned and the host additionally hashes its complete command envelope. Expired, malformed, actor-mismatched or changed-command idempotency rows conflict; they are not deleted or replayed as new writes. Input identity, transaction ID, command ID, aggregate version and provider sources must match exactly for readback.

## Atomic boundary

No idempotency row is created before post-lock authority and provider validation. Success stages the domain mutation, one audit row, one outbox row and committed readback, then commits them together. Denial, stale authority, provider rejection/error and mutation/outbox errors leave no persisted effect set. PostgreSQL identity sequences may advance on rolled-back inserts; zero-write means zero persisted command/domain/ledger effects, not gapless sequences.

Exact replay runs a fresh authority recheck and validates the immutable stored receipt. Consumers that declare `provider_current_state_required` then run the [typed read-only replay hook](CLADORA-CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-v1.0.md) in the same scope before the host returns the original receipt. The hook never reruns fresh-command validation or mutation. Existing authority-only providers preserve their current behavior. Up to three attempts are allowed only for PostgreSQL serialization abort (`40001`), each with a new transaction, authority decision and required replay evaluation. A lost commit acknowledgement returns `unknown_commit/READBACK_REQUIRED`; it is never retried speculatively. If no row is present, the full fresh authority/provider path is required before a new mutation.

## Verification and rollout

`test:core-tx-host:postgres` runs the actual host against migrated disposable PostgreSQL. It exercises canonical Core authority with synthetic fixture state, canonical ledger rows, real concurrency, exact/changed replay, version change/revoke, AAL1 denial, scope invalidation, provider failure, rollback after staged domain effects, unique-outbox failure and lost acknowledgement recovery. It requires explicit ephemeral opt-in and a loopback target. CI bootstraps the existing migrations and runs it in the database workflow.

The fixture reuses existing Core authority fixture setup; it does not create a SERVICE or CE task, mutate those branches or activate a consumer. Disposable fixtures are discarded when the database is stopped. Any future route wiring, authority-version resolver deployment, consumer persistence integration, migration or Remote activation requires its separate package and authorization.
