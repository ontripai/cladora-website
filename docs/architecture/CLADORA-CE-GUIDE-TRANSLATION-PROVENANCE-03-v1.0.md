# CE Guide translation provenance 03

Status: **pure contract and evaluator; persistence and activation not authorized**

Owner: Community & Experience for Guide content provenance; jurisdiction,
Country Pack and legal/accounting approvals remain with their canonical owners

Baseline: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`
(`tree 752e5eb031da3ad11143b357f73d80b712a615e5`)

## Decision

A translation is an immutable, append-only rendition beneath one existing
Guide aggregate and one exact source content version. It is never a new Guide,
Country Pack, jurisdiction decision, domain artifact, legal signoff, accounting
approval or authority decision. Locale remains a presentation/content attribute
and is not jurisdiction evidence.

The package defines `ce-guide-translation-provenance.v1` as an inactive pure
evaluator. It performs no I/O, writes no record and is not imported by a route,
provider, editor or lifecycle command. A future canonical persistence package
may consume an accepted append plan; this package does not authorize one.

## Exact binding

Every evaluation binds all of these facts:

- exact Context, Workspace and Guide IDs;
- positive current Guide version;
- immutable source content version ID, positive source version and SHA-256;
- exact source locale and target locale;
- stable translation series ID, immutable translation version ID and positive
  translation version;
- expected previous translation version and previous record fingerprint;
- translation content SHA-256;
- method: `source_authored`, `human_reviewed` or `machine_assisted`;
- private provenance identity, producer identity and production time;
- review status, private reviewer identity, reviewer authority revision and
  review time;
- one closed public attribution policy compatible with the method.

The evaluator compares the bound source to the current source snapshot. A
different Guide/content version or version ID is stale. A different hash for
the same version is a hash mismatch. A draft or unpublished current source is
not eligible for a translation append.

## Append-only lifecycle

The first translation version must be version `1`, expect previous version `0`
and carry no previous fingerprint. A later version must bind the exact existing
head, expect its positive version and fingerprint, use the same Context,
Workspace, Guide, source content version, translation series and target locale,
and advance exactly once. Reusing a version ID, rewriting an earlier version or
moving the series to another source or Workspace is denied.

An accepted result contains a deterministic internal append plan and record
fingerprint. Every denial or conflict contains `append_plan=null`; therefore a
caller has no authorized write instruction. The evaluator mutates neither its
input nor an existing head.

## Method, review and public attribution

The three methods remain distinct:

| Method | Required review | Only permitted public attribution policy |
| --- | --- | --- |
| `source_authored` | Current approved review with private reviewer evidence | `source_authored` |
| `human_reviewed` | Current approved review with private reviewer evidence | `human_reviewed` |
| `machine_assisted` | Current approved human review with private reviewer evidence | `machine_assisted_human_reviewed` |

Pending, rejected or incomplete review fails closed. The contract accepts no
free-form reviewer label, professional title, qualification or expertise claim.
The public projector returns only target locale, translation version, method
and the closed attribution policy. Reviewer/producer identities, authority
revision, timestamps, hashes and provenance IDs remain private.

## Locale and jurisdiction separation

Only the exact content locales `ro`, `en` and `fa` are accepted by this version.
Region tags or ambiguous values fail closed. Mappings such as `ro -> RO`,
`fa -> IR` and `en -> a default country` are explicitly forbidden. No locale,
language, translation method, reviewer or content hash may select or create:

- a governing country or Country Pack;
- a jurisdiction profile or profile version;
- a jurisdiction domain or artifact hash;
- legal review/signoff or accounting approval;
- command authority, permission, entitlement or target access.

A translated Guide grants no access to any document, message, service,
property or other referenced destination. Translation status does not repair a
missing or invalid destination decision.

## Failure matrix

| Scenario | Result | Write authority |
| --- | --- | --- |
| Current published source, exact scope/hash, approved review, next version | `OK` with one deterministic append plan | Plan only; no write in this package |
| Source Guide/content version changed | `SOURCE_STALE` | None |
| Same source version with a different hash | `SOURCE_HASH_MISMATCH` | None |
| Source draft or unpublished | `SOURCE_UNPUBLISHED` | None |
| Region-tagged, unsupported or source-equal target locale | `LOCALE_AMBIGUOUS` | None |
| Pending/missing review evidence | `REVIEW_REQUIRED` | None |
| Rejected review | `REVIEW_REJECTED` | None |
| Method and attribution policy disagree | `ATTRIBUTION_POLICY_MISMATCH` | None |
| Existing head belongs to another scope/source/series/locale | `IMMUTABLE_BINDING_CONFLICT` | None |
| Previous version/fingerprint or next version is wrong | `TRANSLATION_VERSION_CONFLICT` | None |
| Extra country, jurisdiction, signoff or professional-title field | `MALFORMED_INPUT` | None |

## Existing runtime boundary

Unpublish remains target-free. It removes Guide visibility under the existing
current CE lifecycle authority and exact Guide version without requiring a
translation, document reference, Country Pack or current target disclosure.
The translation evaluator is not called by unpublish.

The public Guide path continues to pass `commands=null`, and the public
projection continues to force `can_edit=false`. This package adds no route,
editor command, content-policy implementation, provider, runtime wiring or
activation.

## Static acceptance

The static harness covers:

- all three methods and their exact attribution policy;
- first append, exact next append and input immutability;
- Context, Workspace, Guide, source version and hash mismatch;
- stale, draft and unpublished sources;
- missing, pending and rejected review;
- ambiguous locale and forbidden country/jurisdiction fields;
- immutable head/version/fingerprint conflicts;
- private provenance redaction and absence of invented professional claims;
- no runtime consumer of the evaluator;
- target-free unpublish and the unchanged `commands=null` / `can_edit=false`
  boundary.

Migration, persistence, Country Pack implementation, route exposure, remote
installation, runtime activation and Production acceptance remain
**NOT_RUN_NOT_PASS**.
