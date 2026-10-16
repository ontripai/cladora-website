# AIRPROP address structure presentation evaluator v1.0

Status: **inactive pure contract**.

Baseline: live `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`.

This package formats explicit address data into bounded display parts. It consumes
the official `core-jurisdiction-domain-artifact.v1` schema directly and accepts
only an active, reviewed, hash-valid and effective `address.structure` /
`address-structure.v1` artifact supplied by its caller. It performs no artifact
lookup, Core selection, Country Pack installation, authority resolution, route
composition or write.

## Request

`airprop-address-structure-presentation-request.v1` is a strict object:

| Field | Contract |
| --- | --- |
| `artifact` | Complete Core artifact supplied by the caller. The evaluator reparses it with `coreJurisdictionDomainArtifactV1Schema` and independently verifies `artifact_sha256`. |
| `effective_at` | Explicit offset timestamp. The evaluator never reads a clock. |
| `country_code` | Explicit uppercase alpha-2 input. It must exactly match `artifact.profile.country_code`; syntax alone is not canonical-country recognition. |
| `address_fields` | At most 64 explicit `{ field_code, value }` entries. `country_code` is forbidden here because the request has exactly one country source. Duplicate field codes are ambiguous. |

The strict request rejects extra keys. Therefore locale, language, currency,
timezone, phone number, IP address, browser headers and Workspace or tenant
defaults cannot enter the evaluator and cannot produce or replace country.

## Artifact-driven evaluation

The evaluator applies only rules present in the accepted artifact:

1. `policy.ordered_fields` determines output order within the evaluator's closed,
   presentation-safe address-field taxonomy. An artifact that introduces an
   identity, authority, receipt, evidence or other unknown field fails closed.
2. Each field's `required` flag and `max_length` determine presence and length.
3. `policy.postal_code.normalization` determines postal normalization.
4. `policy.postal_code.validation` supplies either no grammar or the exact
   artifact-local segment grammar.

There is no global postal regex, uniqueness lookup or cross-country postal
index. The same postal text can be displayed by addresses in different
countries. An optional postal field is omitted rather than synthesized.

The official artifact v1 schema defines no locale label, separator, line-break,
direction or full-address template. This evaluator therefore does not invent
one. It returns ordered `{ field_code, value }` display parts. RTL and LTR text
is preserved byte-for-byte as explicit field data. C0/C1 controls, line/paragraph
separators, lone surrogates and bidi control/override characters fail closed;
ordinary Persian and mixed LTR/RTL content remain valid. A UI may present those parts
without changing their order, values or country identity.

## Decision

`airprop-address-structure-presentation-decision.v1` returns either:

- `accepted` with only ordered `display_parts`; or
- `denied` with a bounded reason and `display_parts=null`.

Every result has `reusable_as_command_authority=false`. It carries no actor,
Context, Workspace, Property, Building, Unit, assignment, permission, receipt,
review evidence, compliance status or activation status. It is presentation
output, not evidence that an artifact is installed or that any command is
authorized.

Bounded denial reasons are:

- `MALFORMED_INPUT`
- `MALFORMED_ARTIFACT`
- `DOMAIN_MISMATCH`
- `ARTIFACT_HASH_MISMATCH`
- `ARTIFACT_INACTIVE`
- `ARTIFACT_NOT_EFFECTIVE`
- `REVIEW_UNAVAILABLE`
- `COUNTRY_MISMATCH`
- `UNKNOWN_FIELD`
- `AMBIGUOUS_FIELD`
- `REQUIRED_FIELD_MISSING`
- `FIELD_VALUE_INVALID`
- `POSTAL_CODE_INVALID`

Denials disclose no address value or internal review detail.

## Inactive boundary

The evaluator is a pure library with no database, network, environment, clock,
randomness, cache or mutation dependency. It is not imported by a route,
component, Artifact B2 runtime or portfolio gateway. AIRPROP remains
`commands=null`, `can_edit=false` and `pre_activation`; the Production B2 route
continues to expose `runtime=null` and `portfolio=null`. Unit-linked output is
still fail-closed.

This package adds no migration, selector, registry, Country Pack seed, grant,
Remote DB action or activation.
