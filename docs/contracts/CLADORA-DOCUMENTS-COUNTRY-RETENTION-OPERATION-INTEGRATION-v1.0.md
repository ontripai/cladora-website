# CLADORA Documents country retention operation integration v1.0

Package: `DOCUMENTS-COUNTRY-RETENTION-OPERATION-INTEGRATION-03`

Status: inactive integration contract.

Owner: Documents & Vault.

## Result and dependencies

The merged Core replay provider hook is sufficient for this package. The
integration declares `replay_policy=provider_current_state_required`; it does
not add a host, replay hook, receipt store, authority provider or ledger. Fresh
validation and replay validation both use the existing `CoreTransactionScopeV1`,
but replay never calls `validateProviders` or `mutate`.

The implementation consumes these accepted components directly:

- `selectDocumentsReferenceInCoreTransactionV1`, backed by the canonical
  Documents/Vault store and current Core authority provider;
- `resolveDocumentsCountryRetentionV1`, which alone composes the canonical Core
  jurisdiction-domain artifact resolver with the accepted retention evaluator;
- `CoreTransactionProvidersV2` and the Core replay decision/hash contracts.

No migration, route, client grant, Country Pack seed, disposal worker, Storage
operation, backfill or runtime registration is included.

## Server-owned execution profile

The operation request contains only mode, requested operation, immutable target
and, for historical mode, committed evidence. It has no permission, module,
entitlement, purpose, domain, Property, document type or legal-hold field.

Before the document selector runs, the integration exact-matches:

- permission `documents.vault.read`;
- module `documents`;
- entitlement `module.documents` for the exact Workspace and authority revision;
- purpose `documents.country-retention.resolve`;
- aggregate `portfolio.property`;
- subject kind `documents.document_version` and relation `retain`, `dispose` or
  `read-policy` matching the request;
- transaction, command, Context, Workspace, actor, attempt, aggregate lock and
  request fingerprint across scope, command and post-lock authority receipt.

The strict request rejects caller-supplied profile fields. AIRPROP authority,
manage-only authority, another module, missing/stale/revoked entitlement and
cross-Workspace authority cannot reach the document or retention resolver.

## Document, Property and legal-hold binding

The command source-lock set contains the exact Property, document and immutable
version IDs. The accepted Documents selector rechecks current read authority,
safe scan state, lifecycle, exact Workspace and immutable current version in the
same serializable transaction.

After that selector has locked the document and version, the integration reads
those canonical rows again with `FOR SHARE` to derive the stored Property and
document type. The document Property must equal the command aggregate and must
have exactly one active binding to the same Workspace; the Property must be
active. NULL or different Property/Workspace bindings deny without inference.

Only then are all legal-hold rows read in stable ID order with `FOR SHARE`.
Both the legacy `documents.documents.legal_hold` flag and an active canonical
`documents.legal_holds` row produce `legal_hold_state=active`. The state is not
accepted from the caller. A serializable concurrent hold insertion or lifecycle
change causes a PostgreSQL `40001`, which is propagated to the Core host for a
new transaction, authority check and complete read sequence.

## Current and historical resolution

Current mode derives the exact Property, document type, immutable version and
legal-hold state from the locked rows and calls the official current retention
composition. Country and the current profile/artifact remain Core-owned.

Historical mode is a separate strict request variant. It accepts only
`core-jurisdiction-domain-artifact-committed-evidence.v1`; its source Workspace
and Property must equal the locked current document binding. The official
historical composition joins the exact evidence to the committed receipt and
never substitutes the current artifact. The integration creates no historical
snapshot, rewrites no retention record and performs no backfill.

Missing/ambiguous rules, malformed or unavailable receipt evidence, stale
versions, revoked authority and cross-Workspace bindings fail closed. An active
legal hold always makes `dispose` a denied preflight. `retain`, `dispose` and
`read-policy` never delete an object, document row, version row or metadata.

## Output, commit and replay

The direct integration output contains only bounded mode/operation status, an
exact/unavailable binding status and the accepted retention decision or bounded
denial. The retention decision carries only the rule code, retention period,
immutable version number, legal-hold state and exact artifact fingerprint. It
contains no document ID, Property or Workspace ID, title, path, body, content,
hash, permission row, hold reason, Storage provider, bucket or object secret.
Every result sets `source_disclosure=status_only`, `source_reference=null` and
`reusable_as_command_authority=false`.

On fresh acceptance, the provider's mutation phase performs no Documents or
Storage write. The existing Core host may commit its one idempotency receipt,
audit and outbox effect for the preflight command. Every denial happens before
that phase and therefore has zero durable write.

On exact replay, Core first matches the command, request fingerprint, immutable
receipt, current authority and provider marker. `validateReplay` separately
rechecks the current document/version/Property/legal-hold state and reruns the
same current or historical retention composition in the read phase. It returns
only the Core read-only replay decision. It does not call the fresh validator or
mutation, does not project another artifact evidence row and returns the
original receipt unchanged. A changed version, newly active hold, revoked read
authority, missing historical evidence or malformed receipt denies replay.

## Verification boundary

The contract harness covers sealed profile input, current/historical separation,
derived document metadata, legal hold, stale/cross-Workspace denial, privacy,
replay separation and `40001` propagation. The disposable PostgreSQL/Core-host
harness covers accepted preflight, committed historical evidence, exact replay,
current hold denial, stale/cross-Workspace/missing-rule/revoked denial, zero
durable writes and a real serialization retry.

Repository CI and Preview do not prove Remote installation or activation.
Remote query/apply, Storage deletion, document disposal, grants, backfill,
runtime activation and merge remain outside this package.
