# Core TX provider evidence v1

Status: Draft, unwired. This package adds no migration, grant, authority store,
ledger, route or runtime consumer activation.

## Versioned command and callback

`core-transaction-command.v2` preserves all v1 command fields and requires
`subject_reference: { kind, id, version, relation, request_version }`. Kind and
relation are canonical lowercase identifiers; versions are positive safe integers.
The subject ID must be in `provider_source_ids`, so the existing ordered source
lock set covers it. Domain providers own the canonical kind mapping, actual source
version, request version, relationship and actor-readability checks; the host does
not infer a Resource's authority or create a parallel registry.

`CoreTransactionProvidersV2` has a stable `provider_code` and:

```ts
validateProviders(scope, command, authority): Promise<CoreTransactionProviderEvidenceV1>
```

The third argument is a defensive copy of the Core decision receipt produced
inside this exact serializable host transaction after all locks and the canonical
Core authority recheck. It is not an injected/cached allow. The provider uses the
same scope connection. It returns strict accepted or bounded denied evidence;
a boolean cannot authorize v2. Evidence binds provider identity, transaction,
command, Workspace, actor, Context, authority decision/revision, attempt and every
subject-reference field. Its evaluation instant must be between the current
Core decision and the host's current database clock. Accepted evidence also
requires available source state and current actor readability.

Only status and caller-known identities/versions are carried. Source rows,
private object definitions, credentials and raw Resource payloads are forbidden.
The provider remains trusted backend code, not an arbitrary SQL sandbox.

## Unchanged execution boundary

The order is still: idempotency advisory lock, Workspace row lock, aggregate
advisory lock, sorted provider-source advisory locks, canonical authority recheck,
existing idempotency read/replay check, provider validation, idempotency claim,
domain mutation, audit/outbox/receipt writes, atomic commit. Provider evidence is
checked before the first durable write. All retries perform a fresh Core recheck.
Stale/revoked authority never reaches provider validation. Any binding/denial/
provider failure rolls back and has zero new canonical effects.

`core-transaction-receipt.v2` includes the exact subject and accepted provider
evidence beside the original authority receipt. It is stored only in the existing
`platform.idempotency_keys.response_ref`. `audit.events`, `platform.outbox_events`,
the Workspace-scoped key namespace and existing SQL column mapping stay unchanged.
No new evidence or authority table is created.

## Replay and compatibility

The request hash includes the v2 protocol tag and all five subject fields. Changing
subject identity/version/relation/request version with the same key conflicts.
Persisted v2 evidence is parsed and checked against the committed subject,
authority and effect identities; a different configured provider identity also
conflicts. Missing/tampered evidence is REPLAY_CONFLICT with zero new effects.

An identical replay first rechecks current Core authority, then returns the
original immutable committed receipt. It does not run the provider or mutate again.
Its evidence is historical proof of that original commit, not fresh Resource
validation or authority for a new command. New commands require new provider
validation. A stale/revoked current authority can never reuse a prior allow.

The v1 command, receipt shape, key, request hashing and boolean callback behavior
remain compatible. Existing two-argument callbacks can ignore the added authority
argument. The overloads preserve v1 result types; v2 has an explicit typed provider
and v2 receipt. v1 receives no optional subject fields or evidence payloads.
Cross-version use of the same idempotency key conflicts rather than silently
upgrading or downgrading an existing receipt.

## Verification and handoff

Real PostgreSQL tests cover post-lock authority/transaction binding, subject
conflicts, tampered persisted evidence, provider/authority/time/redaction mismatches,
valid replay, concurrent duplicate, rollback and stale/revoked zero-write. The full
existing host and canonical authority suites prove legacy compatibility. SERVICE
provider-composition and Core consumer conformance remain independent contracts;
this Draft does not wire or activate either consumer.
