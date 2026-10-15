# CLADORA Core Jurisdiction Domain Artifact v1.0

Package: `CORE-JURISDICTION-DOMAIN-ARTIFACT-03`

Status: inactive public contract

Activation: prohibited by this package

## Purpose

Country Packs are an open, unbounded catalog of reviewed, effective-dated policy
artifacts. Core does not contain country branches. Each artifact is bound to one
exact jurisdiction profile ID, profile code/version, explicit ISO country code,
profile manifest SHA-256, domain code/version and artifact SHA-256.

The v1 domain catalog models four independent policy families:

- `address.structure` / `address-structure.v1`;
- `finance.tax-accounting` / `finance-tax-accounting.v1`;
- `documents.retention` / `documents-retention.v1`;
- `payments.policy` / `payments-policy.v1`.

Adding a country creates reviewed artifact data conforming to these schemas. It
does not add a country condition to Core and does not activate a product.

## Governing-country and address rules

An address always supplies its country explicitly. Locale, language, currency,
timezone, telephone number and IP address are forbidden inference sources. The
country stored in an accepted current `JurisdictionProfileSelector` decision is
matched directly to the artifact.

Postal codes are country text. They are not global identifiers, are not unique
and have no platform-wide length or pattern. A country artifact may provide a
bounded deterministic grammar made of exact-length digit, letter or
alphanumeric segments and fixed printable delimiters, or choose no syntax
validation. Arbitrary regular expressions are not executable artifact data.
The same postal text may appear on any number of addresses. Postal validation
cannot select or change the governing country.

## Review, lifecycle and hashing

An artifact declares `effective_from`, optional exclusive `effective_to`, and a
lifecycle status. Binding succeeds only while status is `active` and the
requested instant is within the effective period. Both legal and accounting
reviews must be approved, versioned, timestamped and represented by evidence
SHA-256 values.

`artifact_sha256` is SHA-256 over canonical JSON for the entire parsed artifact
except the `artifact_sha256` field itself. Object keys are sorted recursively;
array order is policy-significant. The calculated hash must equal both the file
value and the exact domain hash in the accepted selector decision. Profile,
country, manifest, domain or hash drift fails closed.

## Tax, accounting, documents and retention

Tax/accounting artifacts bind reporting currency, per-currency exponent and
rounding, versioned tax rule identifiers, evidence requirements and posting
class mappings. The reporting currency must have an exact monetary rule. They
do not embed executable tax code or select a ledger.

Document artifacts bind document types to reviewed retention rule identifiers,
periods, immutable-version requirements, legal-hold behavior, disposal review
and residency rule identifiers. They neither store documents nor perform
disposal. A retention period contains at least one positive year, month or day
component; empty and zero periods are invalid.

## Payment policy boundary

Payment artifacts model:

- currency exponent, rounding mode and minor-unit increment;
- individually active or inactive payment rails and supported currencies;
- a sorted, unique supported-operation set for each rail;
- settlement mode, maximum settlement interval and finality classification;
- refund support and original-rail constraints;
- receipt and invoice evidence;
- regulatory evidence requirements.

The binder requires an explicit currency, rail and operation. The operation
must be declared by that rail and is returned in the bounded payment resolution.
A missing payment domain, unknown or inactive rail, unsupported currency or
operation, or unsupported refund is a bounded denial. Refund limits, settlement
intervals, and required receipt, invoice and regulatory evidence must be
internally coherent. Currency or timezone never selects the Country Pack.

Artifacts cannot contain credentials, account numbers, merchant IDs, passwords,
secrets, API keys or provider tokens. The schemas contain no provider endpoint,
adapter, account or execution capability. Runtime provider authorization remains
a separate dependency.

## Binder contract

`bindCoreJurisdictionDomainArtifactV1` consumes the complete accepted result of
`selectCurrentPropertyJurisdictionProfileV1`; callers cannot reconstruct a
smaller profile claim. It exact-matches:

1. profile ID, code and version;
2. explicit country and manifest hash;
3. requested domain code/version;
4. artifact SHA-256;
5. artifact lifecycle, effective period and both reviews;
6. payment currency/rail/operation when the payment domain is requested.

Missing, malformed, stale, inactive, expired, unsupported or mismatched input is
fail-closed. Accepted output contains the validated public policy artifact and
optional bounded payment resolution. Every result sets
`reusable_as_command_authority=false`; neither an artifact nor a historical
selector decision authorizes a command.

## Inactive boundary

This package adds no migration, Country Pack seed, statutory rate, real legal
rule, payment account, credential, adapter, route, grant, Remote operation or
Production activation. Its five-country fixtures are synthetic contract vectors,
not deployable country policy. AIRPROP owns its guard and any later consumer
integration.
