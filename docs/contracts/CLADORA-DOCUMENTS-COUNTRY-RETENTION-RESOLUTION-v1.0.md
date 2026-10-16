# CLADORA Documents Country Retention Resolution v1.0

Package: `DOCUMENTS-COUNTRY-RETENTION-RESOLUTION-02`

Status: inactive composition contract.

Owner: Documents & Vault.

Core dependency: the merged canonical
`core-jurisdiction-domain-artifact-resolver.v1` contract from #431.

## Purpose and boundary

`resolveDocumentsCountryRetentionV1` composes the canonical Core artifact
resolver with the accepted pure Documents retention evaluator. It operates in
the caller's existing `CoreTransactionScopeV1` and adds no transaction host,
authority provider, artifact store, receipt store, resolver, replay hook,
migration, route, grant, disposal action or runtime wiring.

The strict composition request has no artifact or `effective_at` field. A
caller therefore cannot supply artifact bytes, choose a timestamp, or replace
historical evidence with current state. The composition constructs the fixed
`documents.retention` / `documents-retention.v1` Core request and calls only:

- `resolveCurrentJurisdictionDomainArtifactV1` for current evaluation; or
- `resolveHistoricalJurisdictionDomainArtifactV1` for historical evaluation.

The returned Core artifact is passed directly to
`evaluateDocumentsCountryRetentionV1` inside the composition. It is never
included in the composition output.

## Requests

Both modes require a bounded document type code, positive immutable version
number, legal-hold state (`none` or `active`) and operation (`retain`,
`dispose`, or `read-policy`). The request contains no document ID, object
identity, path, content, permission data or Storage metadata.

### Current

Current mode accepts an explicit Property ID and optional expected country
code. The Core resolver derives the current Property jurisdiction/profile in
the same serializable transaction after canonical authority recheck and locks
the Property assignment, profile, domain mapping and artifact with
`SELECT ... FOR SHARE`. The evaluator timestamp is the resolver's transaction
evaluation time. Locale and caller-supplied country artifacts are not inputs.

### Historical

Historical mode accepts only the canonical
`core-jurisdiction-domain-artifact-committed-evidence.v1` reference. Core joins
that exact reference to the evidence committed with the stated receipt,
transaction, command, attempt, Workspace, Property and actor. The evaluator
timestamp is the committed reference's `effective_at`.

Historical mode never runs current profile selection and never substitutes a
current artifact. A new profile, changed assignment or newer artifact cannot
rewrite or upgrade prior receipt evidence. Missing, stale, ambiguous or
malformed evidence fails closed.

## Exact binding and denial

The composition derives transaction, command, Context, Workspace, actor,
authority revision, provider source locks and aggregate lock identity from the
existing Core scope and command. Core rechecks current authority after the
lock. The composition then independently requires exact equality between the
resolved artifact and fingerprint for profile ID/code/version, country,
profile manifest hash, domain/version, artifact hash, lifecycle and effective
period. Historical mode additionally requires the committed reference to
match that fingerprint and period exactly.

Core resolver denials remain bounded in `resolver_denial_reason`. These cover
binding mismatch, revoked or stale authority, unavailable/ambiguous profile or
artifact, missing/tampered/unsupported bytes, inactive or ineffective state,
missing review, missing historical receipt evidence and provider failure.
Malformed composition input, including any extra artifact or timestamp field,
is rejected before a database query. PostgreSQL `40001` is deliberately
propagated to the Core host for a fresh transaction attempt.

An active legal hold always makes `dispose` fail as
`LEGAL_HOLD_BLOCKS_DISPOSAL`. `retain` and `read-policy` remain bounded policy
evaluations. No outcome performs or authorizes disposal, mutation, retention
assignment or document access.

## Output and privacy

An accepted result contains the evaluator's bounded status, exact
profile/domain/artifact fingerprint, effective period, document type and
immutable version number, rule code, retention period, legal-hold state and
operation effect. Denials contain only bounded status and reason data.

Every result sets:

- `source_disclosure=status_only`;
- `source_reference=null`; and
- `reusable_as_command_authority=false`.

Results never contain artifact bytes, receipt ID, Property or Workspace ID,
document ID, path, filename, content, content hash, permission row, object
secret, bucket, provider or other Storage metadata.

## Transaction, replay and writes

Resolution is SELECT-only. Current and historical database reads run in the
same `CoreTransactionScopeV1` and the composition has no mutation API.
Resolver/evaluator denial therefore has zero write. Receipt creation remains a
Core host responsibility outside this composition.

Exact replay is the Core host's replay of a previously committed command and
receipt. It returns the same committed artifact evidence without duplicating
it. A later historical evaluation may reference that exact evidence; the
composition does not create, modify, auto-upgrade or replay a receipt itself.

## Inactive integration state

The implementation and harnesses are an inactive library contract. No route,
client grant, disposal worker, schedule, feature flag or production wiring is
included. Remote database and runtime activation are outside this package.
