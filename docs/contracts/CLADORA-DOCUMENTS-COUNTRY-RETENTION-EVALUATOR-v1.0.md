# CLADORA Documents Country Retention Evaluator v1.0

Package: `DOCUMENTS-COUNTRY-RETENTION-EVALUATOR-02`

Status: inactive pure contract.

Owner: Documents & Vault.

## Purpose

`evaluateDocumentsCountryRetentionV1` evaluates the `documents.retention`
policy in one already supplied `core-jurisdiction-domain-artifact.v1`. It does
not find, load or resolve an artifact and does not select a Property country.
It adds no migration, store, authority provider, writer, resolver, route,
grant, backfill, receipt replay or runtime activation.

The evaluator imports the canonical Core artifact schema and canonical hash
function directly. It has no clock, random value, database, network or storage
dependency and performs no write. The same input produces the same bounded
decision.

## Input

The strict request contains:

- the complete Core jurisdiction-domain artifact;
- a bounded `document_type_code`;
- the positive numeric immutable document version, without a document ID;
- an explicit offset timestamp `effective_at`;
- legal-hold state `none` or `active`;
- operation `retain`, `dispose` or `read-policy`.

The request contains no Workspace, Property, actor, document ID, filename,
content, object path, bucket, provider or other Storage metadata. Authority and
exact Property/Workspace selection remain outside this pure evaluator.

## Evaluation

The evaluator strict-parses the complete Core artifact, recalculates its
canonical SHA-256 without the self-hash field, and requires the declared hash to
match. It then requires:

1. exact domain `documents.retention` and version `documents-retention.v1`;
2. lifecycle status `active`;
3. `effective_at` within the half-open artifact interval;
4. approved legal and accounting reviews recorded no later than
   `effective_at`;
5. exactly one valid rule for the requested document type.

The Core schema already rejects duplicate/ambiguous document type mappings,
invalid or zero retention periods, unknown fields, invalid legal-hold behavior
and unsorted rule sets. Those artifacts fail closed as malformed. A missing
type mapping fails as `DOCUMENT_TYPE_UNAVAILABLE`.

An active legal hold always returns `LEGAL_HOLD_BLOCKS_DISPOSAL` for a disposal
request. It does not prevent `retain` or the non-authorizing `read-policy`
operation. When no hold is active, disposal returns either
`disposal_review_required` or `disposal_policy_satisfied` from the artifact;
neither value executes or authorizes disposal.

## Output and privacy

An accepted result contains only:

- the exact artifact contract and profile ID/code/version, country and profile
  manifest SHA-256;
- domain code/version and exact artifact version/SHA-256/effective interval;
- requested operation and effective timestamp;
- document type code and positive immutable version number;
- bounded retention rule code and retention period;
- legal-hold state, immutable-version requirement, disposal-review flag and a
  bounded operation effect;
- `reusable_as_command_authority=false`.

It never contains a document ID, title, filename, content, content hash, MIME,
object path, bucket, Storage provider, credential, permission row, hold reason
or private evidence payload. Denials have bounded reasons and no rule payload.

## History and dependency

Evaluation never changes the artifact or any previous decision. Supplying a
new artifact produces a new independent fingerprint and cannot rewrite a
historical document, version, retention assignment, snapshot or receipt.

Historical artifact resolution and receipt replay are intentionally absent.
Draft PR #431 is the formal Core dependency for canonical artifact resolution;
this package neither imports its code nor copies its resolver, migration,
transaction evidence or host changes. Runtime composition must remain inactive
until that Core dependency is merged and separately accepted for the intended
current or historical selection semantics.
