# CLADORA Core Canonical Country Registry v1.0

Status: **`canonical_source_required`**
Package: `CORE-CANONICAL-COUNTRY-REGISTRY-01`
Baseline: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`

## Decision

CLADORA requires one Core-owned, versioned registry before any component can
claim that an explicit two-letter token is a canonical country. The live
Repository contains no pinned and verifiable authoritative country dataset.
It therefore cannot safely create the registry inventory in this package.

This contract defines the admission, storage and lookup boundary. It does not
invent a country list, copy an unpinned web list or treat `[A-Z]{2}` as registry
membership. Until an authoritative source release is approved and pinned, every
canonical lookup returns `CANONICAL_SOURCE_REQUIRED` with zero durable writes.

## Live inventory

The reviewed baseline has these separate concepts:

- `portfolio.addresses.country_code` requires explicit uppercase two-letter
  syntax. That constraint accepts syntactically valid unknown values such as
  `ZZ`; it is not canonical membership.
- `platform.jurisdiction_profiles` and
  `platform.property_jurisdiction_assignments` bind an explicit country to a
  versioned Property jurisdiction profile. They do not define which country
  codes are authoritative.
- `platform.workspace_taxonomy_assignments.country_code` is Workspace
  configuration and cannot become a Property-country default.
- AIRPROP contains fixed legacy labels and fixtures. They are not a source for
  a global registry.
- `package.json` and `package-lock.json` contain no pinned ISO 3166 dataset or
  library whose source bytes, edition and provenance satisfy this contract.

Locale, language, currency, timezone, phone number or prefix, IP/geolocation,
browser headers, Tenant data and Workspace defaults are absent from the country
authority boundary. They cannot create, repair or rank a country candidate.

## Authoritative source admission

A future registry release is admissible only when one named source artifact is
approved with all of the following immutable evidence:

1. authoritative publisher and dataset family;
2. exact source edition or publication version;
3. immutable retrieval reference and retrieval timestamp;
4. SHA-256 of the exact acquired source bytes;
5. source signature or an explicitly reviewed integrity mechanism when the
   publisher offers one;
6. redistribution and retention decision for the source bytes and generated
   public inventory;
7. documented parser/generator version and deterministic normalization rules;
8. SHA-256 of the normalized registry manifest;
9. review receipt binding the preceding fields without embedding reviewer
   identity or a private signoff reference in public lookup output.

A package name, dependency version, mutable URL, copied table, country picker,
CLDR locale data or a list reconstructed from current application values does
not meet this admission contract. If any evidence is unavailable, the result
remains `canonical_source_required`.

## Versioned registry model

The future persistence package must separate releases from entries.

### Release identity

Each immutable release carries:

- `registry_contract_version`;
- monotonic `registry_version`;
- source publisher, dataset family and source edition;
- exact source-byte SHA-256 and normalized-manifest SHA-256;
- `effective_from` and optional exclusive `effective_to` instants;
- lifecycle status `draft`, `active`, `retired` or `revoked`;
- bounded public provenance classification.

Only one active release may match a current instant. Gaps and overlaps fail
closed. A release cannot be edited into another source, version or time range.

### Entry identity

Every entry belongs to one exact release and carries:

- an explicit uppercase ISO alpha-2 `country_code`;
- entry classification `active`, `withdrawn` or `historical`;
- `effective_from` and optional exclusive `effective_to`;
- exact provenance link to the release;
- immutable source-record fingerprint.

The syntax constraint `^[A-Z]{2}$` is necessary but never sufficient. An entry
must exist exactly once in the selected release and effective interval. `ZZ`, an
unknown token, a duplicate, a gap or overlapping matches are bounded denial.
Active, withdrawn and historical classifications are never collapsed into a
single boolean.

The registry describes country-code recognition only. It cannot change a
Property or address country and cannot create a Country Pack, tax rule,
currency rule, postal grammar, payment rail or legal approval.

## Lookup contracts

### Current lookup

Current lookup accepts only:

- an explicit uppercase two-letter token; and
- a server-evaluated current instant.

It resolves exactly one active registry release and exactly one effective entry
classified `active`. There is no fallback to a previous release, withdrawn
entry, historical entry, syntax-only acceptance or inferred token.

### Historical lookup

Historical lookup requires the exact `registry_version`, explicit country code
and `effective_at` instant from previously committed evidence. It returns only
the entry from that release and interval. It cannot substitute the current
release, upgrade a withdrawn code, or turn historical evidence into authority
for a new command.

Both modes are read-only. Neither mode updates a Property, address, profile,
assignment, receipt or registry row.

## Bounded output

An accepted result may expose only:

- contract and registry version;
- exact country code and entry classification;
- effective interval;
- source provenance classification;
- source and normalized manifest SHA-256 fingerprints;
- `reusable_as_command_authority=false`.

It exposes no address, Property, actor, Workspace membership, locale, private
source bytes, reviewer identity, private signoff reference, Country Pack payload
or compliance decision.

## Fail-closed decisions

| Condition | Result | Durable effects |
| --- | --- | --- |
| No admitted source release | `CANONICAL_SOURCE_REQUIRED` | zero |
| Missing or lowercase token | `COUNTRY_CODE_INVALID` | zero |
| `ZZ` or any unregistered token | `COUNTRY_CODE_UNKNOWN` | zero |
| Duplicate/overlapping release or entry | `COUNTRY_REGISTRY_AMBIGUOUS` | zero |
| No release/entry at the evaluated instant | `COUNTRY_REGISTRY_NOT_EFFECTIVE` | zero |
| Current lookup finds withdrawn/historical entry | `COUNTRY_CODE_NOT_CURRENT` | zero |
| Historical version or entry missing | `COUNTRY_HISTORY_UNAVAILABLE` | zero |
| Source/manifest/provenance mismatch | `COUNTRY_REGISTRY_INTEGRITY_FAILURE` | zero |

Errors do not return candidate lists or infer replacements.

## Inactive boundary

This package creates no TypeScript registry, migration, table, seed, country
entry, PostgreSQL function, RLS policy, grant, route, UI, credential, Remote DB
change or activation. PostgreSQL validation is therefore
**`NOT_RUN_NOT_PASS`**. The next package may start only after the canonical
source decision in the execution package is satisfied.
