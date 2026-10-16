# CLADORA Core Canonical Country/Territory Region Registry v1.0

Status: **`approved_source_pinned_static_contract`**
Package: `CORE-CANONICAL-COUNTRY-REGISTRY-01`
Baseline: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`

## Purpose and terminology

This contract defines a canonical, versioned CLADORA registry for explicit
country/territory region codes. It is a technical interoperability registry.
An accepted code is not a statement about sovereignty, political recognition,
national status or legal jurisdiction, and it is not command authority.

New assignment input remains an explicit uppercase two-letter token. The syntax
check `^[A-Z]{2}$` is necessary but never establishes membership. A token must
also be present in the exact pinned source release and admitted by the fixed
filter policy below. `ZZ` is always rejected.

The source gate identified in the first review is now satisfied for static
design by the approved Unicode CLDR validity artifact. This PR still creates no
database registry or runtime lookup.

## Approved source pin

| Field | Exact value |
| --- | --- |
| Publisher | Unicode Consortium |
| Release | `CLDR release-48-2` |
| Published | `2026-03-17` |
| Tag object | `fc1fd058cc6f50544a450a3b15a4bba0e0c1e653` |
| Commit | `11299982335beb974c1c63c45265184e759c0f41` |
| Source artifact | `common/validity/region.xml` |
| Source SHA-256 | `e751e0eedd46b52c38f3cdb72b0fab61ac8b48e052e8b28ba74b6ac26c4c8cb1` |
| License | Unicode License v3 (`Unicode-3.0`) |
| LICENSE SHA-256 | `b49d0e9f8ead51ca8b7df6fec89cc3ae6809198b4b9d43c74216da0118f23f5b` |
| Parser | `core-cldr-region-validity-parser.v1` |
| Filter policy | `core-country-territory-region-filter.v1` |
| Normalized format | `core-country-territory-region-validity.normalized.v1` |
| Normalized SHA-256 | `4ee7bbf11b19a8f6b5dd467d06f5ecf7fdbe0d89af1d14bc928ce8e684ccf814` |

The exact source bytes, license bytes and machine-readable manifest are retained
under
`docs/contracts/references/CORE-CANONICAL-COUNTRY-REGISTRY-01/`.
Static review/build tooling and CI parse those local pinned bytes. A future
runtime implementation must consume the same pinned local artifact. Neither
the current tooling nor a future runtime may request a network
resource, follow a mutable URL or select a `latest` release.

CLDR locale data, localized display names and likely-subtag information remain
forbidden country inference sources. Their presence in the broader CLDR project
does not authorize their use here. Only the pinned
`common/validity/region.xml` bytes are admitted as registry source input.

## Deterministic parsing and normalization

The parser recognizes only `id` elements with `type='region'` and these exact
`idStatus` values: `regular`, `special`, `macroregion`, `deprecated`,
`reserved`, `private_use` and `unknown`. Unknown status, malformed token,
duplicate expanded code or empty input fails closed.

A compact CLDR range has the form `START~END_SUFFIX`. The parser prefixes the
suffix with the unchanged leading characters from `START`, then enumerates the
inclusive fixed-width range in one character family:

- `AC~G` expands to `AC AD AE AF AG`;
- `001~3` expands to `001 002 003`.

Mixed numeric/alphabetic ranges, a decreasing range, width mismatch or an
unbounded expansion is rejected. Normalization sorts expanded records by code
and source status and emits fixed tab-separated fields with a versioned header,
parser version and filter-policy version. The exact UTF-8 bytes, including one
final newline, produce the pinned normalized SHA-256 above.

The approved source expands to 343 records: 257 `regular`, 12 `deprecated`,
35 `macroregion`, 2 `special`, 13 `reserved`, 23 `private_use` and 1
`unknown`.

## Fixed filter policy

| CLDR source status | New assignment | Registry treatment |
| --- | --- | --- |
| `regular` uppercase two-letter | allowed, subject to release lifecycle | `active` |
| `deprecated` | rejected | `historical`; exact historical lookup only |
| `macroregion` | rejected | excluded |
| `special` | rejected | excluded |
| `reserved` | rejected | excluded |
| `private_use` | rejected | excluded |
| `unknown` | rejected | excluded; `ZZ` is explicitly denied |

The platform states `active`, `withdrawn` and `historical` remain distinct.
This CLDR artifact supplies `regular` and `deprecated`, but does not provide
legal assignment/withdrawal dates. Policy v1 maps `regular` to platform
`active` and `deprecated` to platform `historical`. It creates no `withdrawn`
entry. A future `withdrawn` classification requires separately approved,
versioned evidence and cannot be inferred from `deprecated`.

### Exceptional regular code governance

`XK` is classified `regular` by the pinned artifact. Policy v1 explicitly
accepts it for technical region interoperability and marks it
`exceptional_regular=true`. This decision conveys no political, sovereignty or
legal-jurisdiction meaning. No other exceptional code is accepted by analogy;
a filter-policy version change and independent review are required.

## Registry release lifecycle

Each future immutable registry release carries exact source, license, parser,
filter policy and normalized-output fingerprints plus release-scoped platform
`effective_from` and optional exclusive `effective_to` instants.

These instants describe when CLADORA permits that registry release. They are not
CLDR publication history, legal assignment dates or legal withdrawal dates.

- `draft`: current and historical lookup denied;
- `active`: current lookup allowed; exact historical lookup allowed;
- `retired`: current lookup denied; only exact historical evidence carrying the
  same registry version may resolve;
- `revoked`: current and historical lookup denied.

A current lookup never falls back to a retired release. A historical lookup
never remaps a deprecated code, substitutes a newer version or upgrades to the
current release.

## Lookup contracts

Current lookup accepts only an explicit uppercase two-letter code and a
server-evaluated current instant. It requires one effective `active` release
and one admitted `active` entry. Missing, duplicate, unknown, `ZZ`, deprecated,
excluded, draft, retired, revoked, gap or overlap returns bounded denial.

Historical lookup requires committed evidence with the exact registry version,
code and `effective_at` instant. It may resolve an `active` or `historical`
entry from the exact `active` or `retired` release. It cannot use draft or
revoked releases and cannot become authority for a new assignment or command.

Both modes are read-only. They cannot change a Property or address country and
cannot create a Country Pack, tax/accounting rule, currency rule, postal regex,
payment rail or legal approval.

## Bounded output and inference ban

Accepted output is limited to contract/registry version, exact code, entry
status, release-scoped effective interval, exceptional-regular marker, source
provenance classification and pinned fingerprints. Every result includes
`reusable_as_command_authority=false`.

Locale, language, currency, timezone, phone number/prefix, IP/geolocation,
browser headers, Tenant values and Workspace defaults are never inputs to code
selection. An absent explicit code fails closed. Output exposes no address,
Property, actor, membership, localized name, reviewer identity, private signoff,
Country Pack payload or compliance decision.

## Inactive boundary

This package contains approved source evidence, deterministic static parsing
and contract tests only. It adds no `src/lib/core` implementation, migration,
table, seed, PostgreSQL function, RLS policy, grant, route, UI, credential,
Remote DB operation or activation. PostgreSQL registry behavior remains
**`NOT_RUN_NOT_PASS`** until a separately reviewed implementation package.
