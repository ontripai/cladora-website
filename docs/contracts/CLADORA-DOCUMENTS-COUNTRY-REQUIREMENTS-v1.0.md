# CLADORA Documents Country Requirements Contract v1.0

Package: `DOCUMENTS-MULTI-COUNTRY-REQUIREMENTS-01`

Status: proposed, inactive, documentation only.

Owner: Documents & Vault. Core owns jurisdiction profiles, property
jurisdiction assignment and jurisdiction-domain artifact identity.

## Purpose and boundary

This contract describes how a future Documents/Vault command can consume a
reviewed Country Pack artifact. It defines no database schema, migration,
route, grant, artifact store, writer, selector, ledger or runtime wiring.

A Country Pack describes requirement metadata. It does not contain a document,
document metadata, a permission, a legal opinion or a storage credential. It
does not decide whether a particular invoice, receipt or tax position is
legally valid. Qualified review and a separately controlled activation remain
required for every real country artifact.

## Canonical authorities

1. `portfolio.addresses.country_code` is the explicit physical-country input
   for the Property. Country is never derived from locale, language, currency,
   Tenant, Workspace, actor location, IP address or postal-code shape.
2. `platform.property_jurisdiction_assignments` binds the exact Property and
   Workspace to an immutable `platform.jurisdiction_profiles` revision.
3. `platform.jurisdiction_profile_domains` binds a domain contract version and
   SHA-256 artifact identity to that profile revision.
4. `selectCurrentPropertyJurisdictionProfileV1` is the canonical, read-only
   Core selector. It runs in the supplied `CoreTransactionScopeV1`, rechecks
   current authority after locks, and returns status-only profile/domain
   metadata.
5. The canonical Documents store remains `documents.documents`,
   `documents.document_versions`, `documents.document_permissions`, links,
   retention records, legal holds and scan attestations. Country Pack data does
   not duplicate these records.

The proposed Documents domain code is `documents.requirements`, with contract
version `documents-country-requirements.v1`. This name reserves no active
artifact. Core review must accept the domain code before a pack may register
it. A profile may also require independently owned tax or accounting domains;
Documents consumes their bounded results and never copies their rule stores.

## Artifact envelope

The following is a logical contract shape, not a database schema or an active
artifact:

```text
contract_version             = documents-country-requirements.v1
artifact_id                  = stable non-private identifier
artifact_version             = positive integer
country_code                 = exact profile country
profile_code                 = exact Core profile code
profile_version              = exact Core profile version
profile_manifest_sha256      = exact Core profile manifest hash
domain_code                  = documents.requirements
domain_contract_version      = documents-country-requirements.v1
artifact_effective_from      = date, inclusive
artifact_effective_to        = date or null, exclusive
rules[]                      = immutable requirement rules
review_state                 = bounded status; no reviewer identity or notes
```

`artifact_sha256` is the external Core registry/selector binding for these
canonical bytes. It is not a self-referential field inside the hashed payload.

Every rule has an immutable `rule_id`, positive `rule_version`, one requirement
category, an inclusive `effective_from`, an exclusive or NULL `effective_to`,
an applicability expression over bounded non-private classifications, and a
requirement payload. Effective periods for the same rule identity and
applicability key must not overlap. Empty, ambiguous, missing or expired
selection is a denial.

The canonical byte representation and SHA-256 algorithm must be owned by Core.
Documents must compare the loaded bytes to the selector's exact
`artifact_sha256` before interpreting any rule. A filename, URL, registry row or
semantic version alone cannot establish artifact identity.

## Requirement categories

| Category | Allowed rule metadata | Explicitly excluded |
| --- | --- | --- |
| Document type | Stable type code, lifecycle transition, minimum cardinality, permitted evidence-class codes | Title, filename, document ID, content, party or property identity |
| Invoice/receipt/tax evidence | Evidence-kind codes, relationship code, required/optional status, responsible external domain code | Amounts, tax IDs, rates, filings, invoice lines, tax conclusions |
| Retention and deletion hold | Retention-class code, start-event code, duration expression, review/disposition mode, hold-required flag | Active hold state, hold reason, case details, a command to delete or release a hold |
| Signature/notarization/legalization | Required metadata capability codes, actor-role class, assurance class and verification-status vocabulary | Signature bytes, certificate, signer identity, seal, private key or assertion of legal sufficiency |
| Language/translation | Source-language policy, accepted language tags, translation-required flag, translation assurance code | UI locale as jurisdiction, translated content or translator identity |
| Storage region/data residency | Residency-policy code, allowed region-class codes, adapter-attestation requirement | Bucket, object path, provider account, credential, endpoint or claim that storage is compliant |
| Immutable version/provenance | Required immutable-version state, scan/checksum state, provenance-class code, exact-reference requirement | Document hash or object metadata in the Country Pack |

These categories describe what must be proven. Existing canonical domain
records prove the actual fact. For example, the Country Pack can require an
active deletion hold, but only `documents.legal_holds` determines whether the
target document has one. It can require invoice evidence, but the canonical
financial source and a typed Documents link determine which invoice is in
scope.

## Evaluation request

A future consumer supplies the following values inside an already accepted
Core command and its existing transaction scope:

- exact `context_id`, `workspace_id`, actor and authority revision;
- exact `property_id` already present in the command's provider-source locks;
- explicit `effective_on` date and operation purpose;
- bounded requirement category and document/evidence type codes;
- when an existing document is evaluated, exact `document_id`, immutable
  `document_version_id` and numeric version.

The consumer asks Core for the ordered `documents.requirements` domain and any
separately required tax/accounting domains. It does not accept a country code
from UI locale. An optional expected country can only be a caller-known
cross-check and must exactly match the selected Property country.

## Evaluation sequence

All current-state checks occur in the same serializable
`CoreTransactionScopeV1` and before the command's first durable write:

1. Verify the exact command, Context, Workspace, actor, authority revision,
   purpose, Property source lock and current authority receipt.
2. Call `selectCurrentPropertyJurisdictionProfileV1`; require one current
   active Workspace/Property binding, assignment, signed profile and ordered
   active domain result.
3. Load canonical artifact bytes by the returned domain identity, verify the
   exact SHA-256, contract version, profile version, country and effective
   bounds, then parse with strict unknown-field rejection.
4. Select exactly one applicable rule set for `effective_on`. A missing,
   expired or overlapping result denies.
5. For an existing document, use the accepted Documents reference selector to
   recheck exact Workspace, immutable version, current read authority, safe
   scan and lifecycle state after locks. NULL-bound or cross-Workspace targets
   deny.
6. Resolve actual evidence only through its canonical owner. Retention and
   legal-hold state remain in Vault; invoice/tax facts remain with their domain;
   storage attestation remains with the approved storage boundary.
7. Return bounded metadata evidence. A denial performs zero Documents, Core,
   audit, outbox or idempotency writes.

`SELECT ... FOR SHARE` is sufficient for immutable/current rows unless an
existing Core host lock already provides a stronger lock. PostgreSQL `40001`
must propagate to the Core host and the whole evaluation must run again in a
fresh attempt.

## Decision and evidence

The private transaction decision binds:

- accepted/denied state and bounded reason;
- Context, Workspace, actor and authority revision;
- Property jurisdiction assignment and profile identity/version;
- profile manifest, domain contract and domain artifact SHA-256;
- explicit `effective_on`, selected rule IDs/versions and their effective
  bounds;
- caller-known immutable document/version identity when applicable;
- evaluation timestamp and `source_disclosure=status_only`;
- `reusable_as_command_authority=false`.

This decision belongs only in the existing Core transaction receipt/evidence
boundary. It does not create a Documents receipt or ledger.

A public receipt projection may expose only the decision/status, contract
version, rule-version references, effective date and artifact fingerprint
needed for verification. It must omit country when Property jurisdiction is
not already public, and always omit Tenant, Workspace, Property, Context,
actor, document/version IDs, title, type when private, content hash, MIME,
filename, object path, storage region/provider, retention or hold details,
permission data, tax/party identifiers and reviewer references.

## Historical preservation

Country Pack artifacts and their rules are append-only after use. A change
creates new canonical bytes, a new SHA-256 and a new profile/domain revision.
It must not update a document, immutable document version, retention snapshot,
legal hold, invoice/receipt/tax evidence or existing Core receipt.

Fresh commands use the currently selected profile/domain and their explicit
effective-date rules. Historical proof uses the profile version, artifact hash,
rule version and effective bounds already committed in the existing receipt;
it never silently substitutes the newest pack. A missing historical artifact
or a receipt that lacks the complete binding fails closed. No auto-upgrade or
backfill is allowed.

## Denial contract

The future consumer must use bounded reasons such as `BINDING_MISMATCH`,
`AUTHORITY_DENIED`, `JURISDICTION_UNAVAILABLE`, `ARTIFACT_UNAVAILABLE`,
`ARTIFACT_HASH_MISMATCH`, `RULE_UNAVAILABLE`, `RULE_AMBIGUOUS`,
`RULE_EXPIRED`, `DOCUMENT_REFERENCE_DENIED` and `DEPENDENCY_UNAVAILABLE`.
Denials disclose no candidate country, document, permission, rule payload or
private source fact.

NULL Property jurisdiction, NULL document Workspace, a cross-Workspace source,
stale authority, stale document version, unsafe scan, inactive lifecycle,
missing artifact bytes, an unknown contract, hash mismatch and missing or
ambiguous effective rules all deny with zero write.

## Activation dependencies

The repository already provides the Core profile registry and
`CORE-JURISDICTION-PROFILE-SELECTOR-02`. Runtime consumption remains blocked on
a Core-owned canonical artifact-byte resolver keyed by
`(domain_code, contract_version, artifact_sha256)` with immutable historical
availability and strict byte verification. The current selector returns the
hash but no artifact bytes or historical-by-hash resolver.

Core must also decide how a command whose `effective_on` is not the current
date obtains an exact historical profile/domain binding. Documents must not
implement a parallel historical selector. Until both behaviors are canonical,
the consumer remains inactive and `DEPENDENCY_UNAVAILABLE` is the only safe
result.
