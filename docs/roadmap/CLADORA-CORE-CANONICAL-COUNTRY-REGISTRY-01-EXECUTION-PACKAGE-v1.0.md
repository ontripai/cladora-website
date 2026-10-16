# CORE-CANONICAL-COUNTRY-REGISTRY-01 execution package v1.0

Status: **`source_pinned_ready_for_implementation_package`**
Contract: `CLADORA-CORE-CANONICAL-COUNTRY-REGISTRY-v1.0`
Owner: Core / Platform

## Source-gate closure

The static source gate is satisfied by Unicode Consortium CLDR `release-48-2`,
published `2026-03-17`, tag object
`fc1fd058cc6f50544a450a3b15a4bba0e0c1e653`, commit
`11299982335beb974c1c63c45265184e759c0f41`, and exact
`common/validity/region.xml` SHA-256
`e751e0eedd46b52c38f3cdb72b0fab61ac8b48e052e8b28ba74b6ac26c4c8cb1`.
The retained Unicode License v3 bytes have SHA-256
`b49d0e9f8ead51ca8b7df6fec89cc3ae6809198b4b9d43c74216da0118f23f5b`.

The deterministic parser and filter policy produce normalized SHA-256
`4ee7bbf11b19a8f6b5dd467d06f5ecf7fdbe0d89af1d14bc928ce8e684ccf814`.
A hash, release, commit, license, parser or filter-policy mismatch blocks the
next package. Runtime network access and mutable `latest` resolution are
forbidden.

This source supports a technical country/territory region registry. It does not
define sovereignty, political recognition or legal jurisdiction. CLDR locale
and display-name data remain prohibited inference inputs.

## Fixed governance decisions

1. Only uppercase two-letter records with CLDR source status `regular` are
   eligible for new assignment.
2. `macroregion`, `special`, `reserved`, `private_use`, `unknown` and
   `deprecated` are rejected for new assignment. `ZZ` is explicitly rejected.
3. `deprecated` records are preserved only as platform `historical`; they are
   never automatically remapped.
4. Platform `withdrawn` remains distinct and empty in policy v1. Populating it
   requires a separate authoritative, versioned source decision.
5. `XK`, classified `regular` by the pinned artifact, is accepted for technical
   interoperability with an explicit exceptional marker. Acceptance has no
   political, sovereignty or legal-jurisdiction meaning.
6. Release effective intervals are CLADORA platform-validity intervals. They
   must not be described as legal assignment or withdrawal dates.

## Future implementation sequence

1. **Reproducible source verification.** Recompute the exact vendored source and
   license hashes, parse offline with `core-cldr-region-validity-parser.v1`,
   apply `core-country-territory-region-filter.v1` and verify the normalized
   output hash before generating any migration input.
2. **Generated inventory review.** Produce a deterministic review artifact with
   source status, platform entry status, assignment eligibility and exceptional
   marker. Do not add localized names or infer legal timelines.
3. **Core persistence migration.** Add immutable release and entry inventories
   under `platform` using only the reviewed normalized bytes. Record source,
   license, parser, policy and normalized hashes independently.
4. **Database protection.** Enable RLS; deny `PUBLIC`, `anon`, `authenticated`
   and `service_role`; assign a canonical NOLOGIN owner; prevent UPDATE/DELETE,
   source rebind and effective-range ambiguity. Execution roles cannot own the
   objects or reach owner/superuser/BYPASSRLS through membership.
5. **Typed lookup port.** Implement separate current and historical modes with
   no fallback, remap, inference or network dependency. Output remains bounded
   and `reusable_as_command_authority=false`.
6. **Disposable PostgreSQL evidence.** Prove release lifecycle, current and exact
   historical lookup, duplicate/gap/overlap, source integrity, RLS/ACL/owner,
   recursive membership and zero-write behavior from a clean bootstrap.
7. **Independent review.** Bind the reviewed migration, generated inventory and
   parser artifacts to exact SHA-256 values before any Remote request.
8. **Remote preflight and installation.** Require separate authorization and an
   exact pending set. Installation grants no product role and activates no
   consumer.
9. **Consumer packages.** Property address, jurisdiction and AIRPROP packages
   consume the accepted lookup directly. They cannot copy entries or implement
   fallback country selection.

## Required regressions

| Case | Required result |
| --- | --- |
| Source/license/parser/policy/normalized hash mismatch | Fail closed before generation or lookup |
| `AC~G` and `001~3` | Exact deterministic inclusive expansion |
| Duplicate expanded code | Parser failure |
| Active release plus admitted `regular` code | Current lookup accepted |
| Draft release | Current and historical denied |
| Revoked release | Current and historical denied |
| Retired release | Current denied; exact same-version historical evidence only |
| `ZZ`/unknown | Rejected with zero writes |
| `deprecated` | New assignment denied; exact historical lookup only |
| `private_use`, `macroregion`, `special`, `reserved` | New assignment denied |
| Exceptional `XK` | Accepted only with technical/non-political governance marker |
| Historical lookup at another version | Denied; no upgrade/remap/fallback |
| Locale/display name/language/currency/timezone/phone/IP/Workspace default | Ignored; cannot select a code |
| Repeated lookup | Same bounded result; zero durable writes |

## Files in this static package

- exact CLDR region validity bytes and Unicode License v3 bytes;
- machine-readable source manifest with every approved fingerprint;
- deterministic range parser and normalization helper under `scripts/lib`;
- static contract/regression harness;
- versioned contract and this execution package.

No normalized country inventory is committed as a product seed. The parser is a
build/review tool and is not a runtime lookup implementation.

## Explicit exclusions

This package does not add a Property/address country mutation, Country Pack,
tax/accounting rule, currency, postal regex, payment rail, legal approval,
migration, seed, runtime registry, role grant, route, Remote apply or activation.
The AIRPROP guard remains unchanged.

PostgreSQL registry behavior, connected Remote validation and Production
acceptance remain **`NOT_RUN_NOT_PASS`**.
