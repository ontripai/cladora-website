# AIRPROP multi-country address entry contract 06

Status: **`contract_defined_implementation_blocked`**.

Baseline: live `main@0727f77f3579fd667252b187504f73b31d139702`, tree
`6db5d15945d0f2d0ccdffa7ffd1db9e5128166bf`.

This package is a documentation and static audit only. It changes no migration,
schema, form, runtime, route, grant, Core selector, Country Pack seed, guard or
activation state. The merged readiness audit and the execution package from PR
#440 remain authoritative for the read side. In particular,
`CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01` remains a Core-owned
dependency and is not implemented here.

## Inventory and findings

The audit searched product TypeScript, API routes, SQL migrations, test fixtures
and seeds for Property/address creation, mutation, import, formatting, postal
validation, defaults and movement. The path and line references below are the
reviewed baseline locations.

| Surface | Evidence | Finding |
| --- | --- | --- |
| Canonical address storage | `supabase/migrations/20260825000300_portfolio_properties_buildings_units.sql:6-13` | `portfolio.addresses` has fixed `county`, `city`, `street`, `building_no` and optional `postal_code`; `properties.address_id` is nullable. The historical migration contained `country_code default 'RO'`. |
| Effective country syntax | `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql:7-21` | The later migration drops the default and requires explicit uppercase two-letter syntax. It states that postal text has no global format or uniqueness. This is syntactic validation only; it does not prove that a token names a canonical country. |
| Canonical-country recognition | repository-wide Core/schema search | No canonical country registry exists. A syntactically valid token such as `ZZ` cannot be accepted as canonical. **Dependency CR-01:** `CORE-CANONICAL-COUNTRY-REGISTRY-01`; until it exists, canonical recognition returns `DEPENDENCY_UNAVAILABLE`. |
| Versioned jurisdiction binding | `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql:73-98,217-289` | Assignment identity and version are immutable; address, Property, Workspace and profile country must agree. |
| In-place country/move guard | `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql:296-349` | A bound address country cannot change in place, and an assigned Property cannot be switched to a different-country address. |
| Property/address create and edit UI | repository-wide `src` search; `src/components/customer/CustomerBuildingSetupWizard.tsx:18-42` | No product form creates or edits canonical `portfolio.addresses`. The setup wizard captures structure and balances only. This is an implementation gap, not permission to infer country. |
| Building onboarding API | `src/lib/customer/building-setup-schema.ts:15-37`; `src/app/api/customer/v1/onboarding/building-setup/route.ts:8-22` | Payload and route contain no canonical address or country. |
| Building provisioning | `supabase/migrations/20260926143510_pilot_reviewer_access_v1.sql:175-200` | The active definition creates a Property, Building and Units without `address_id`. **Blocker AE-01:** it can create an addressless Property and is not a compliant address-entry path. |
| Controlled CSV import API | `src/lib/customer/onboarding-import-schema.ts:3-17`; `src/app/api/customer/v1/onboarding/imports/[id]/sources/route.ts:1-2`; `src/lib/onboarding/csv-stream-parser.ts:1-31` | Upload is bounded CSV with configurable headers. The route has no address-specific country contract. Formula-leading cells are escaped. |
| Import validation | `supabase/migrations/20260913063638_residential_pilot_import_completion.sql:75-166` | Rows stage independently and receive blocking issues. The Property template requires only `name`; it does not require `country_code` or address fields. **Blocker AE-02.** |
| Import commit and atomicity | `supabase/migrations/20260913063638_residential_pilot_import_completion.sql:168-230,275-301` | Commit is one database transaction, insert-only and all-or-none: any blocking/non-new row aborts the commit. It creates a Property without an address. There is no partial canonical success, though staging/validation preserves per-row issues. |
| Older import definition | `supabase/migrations/20260912215541_controlled_residential_import_onboarding.sql:31-99,250-401` | The historical pipeline also stages rows and commits atomically. Later definitions supersede its functions; it remains immutable history. |
| Onboarding shell | `src/app/[lang]/app/onboarding/page.tsx:16-26` | Completes onboarding/security state; it has no address capture. |
| AIRPROP opportunity UI/API contract | `src/components/customer/CustomerAirpropWorkspace.tsx:39-64`; `src/lib/airprop/opportunity-contract-v2.ts:16-24`; `supabase/migrations/20261003151604_20261003083859_workspace_scoped_effective_permission.sql:240-255` | Commercial opportunity country is hard-coded to `RO`. It is not a canonical Property address. **Blocker AE-03:** it is unsuitable for multi-country entry and must never seed address country. |
| Legacy AIRPROP Property configuration | `supabase/migrations/20260914144417_airprop_core_foundation.sql:286-325`; effective internal replacement in `supabase/migrations/20261003151604_20261003083859_workspace_scoped_effective_permission.sql:292-315` | `customer_api.configure_airprop_property_v1` delegates to `app_private.configure_airprop_property_internal_v1`. Both expose an `AIRPROP-RO`/`1.0` default; the effective internal function rejects every other pack/version and records Romania configuration evidence. This is legacy AIRPROP operating-model/Country-Pack configuration. It is neither canonical address authority nor a multi-country Country Pack resolver. |
| Workspace taxonomy | `src/components/workspace/WorkspaceTaxonomyCard.tsx:201-225,247-283,454-468`; `supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql:528-586,779-827` | Taxonomy country is explicit and versioned, but is Workspace configuration, not address authority or an address default. |
| Address formatter | `src/config/formatters.ts:180-199` | `formatAddress` rewrites Romanian-style tokens in an opaque string for display. **Blocker AE-04:** it is not a canonical multi-country formatter and must not parse, normalize or choose country. |
| Owner-private address text | `supabase/migrations/20260925131751_multi_unit_owner_private_portfolio_v1.sql:36-46`; `supabase/migrations/20260929065846_owner_portfolio_manager_invite.sql:132-140` | `address_text` is an opaque private label synthesized from Building/Unit names. It is not a canonical address and cannot be mined for country or postal data. |
| Postal constraints | repository-wide migration search; `supabase/tests/185_core_jurisdiction_profile.test.sql:139-146` | There is no global postal unique constraint or global SQL regex. The test stores the same postal text in RO and IR and a different CA shape. |
| Seed and address fixtures | `supabase/seed.sql:15-20`; `supabase/tests/185_core_jurisdiction_profile.test.sql:136-182`; concurrency fixtures under `scripts/test-workspace-*-concurrency.mjs` | Positive current fixtures provide country explicitly. The one country-omitting insert is a negative test that proves rejection. |
| Historical missing values | current schema plus the paths above | Canonical `country_code` is `NOT NULL`; `postal_code` may be NULL. Addressless Properties, nullable Workspace taxonomy, and opaque private address labels exist, but none supplies missing canonical country. |
| AIRPROP read projection | `docs/roadmap/AIRPROP-EXPLICIT-ADDRESS-COUNTRY-PROJECTION-05-EXECUTION-PACKAGE-v1.0.md:22-98` | PR #440 stopped at `core_extension_required`. Production and unit-linked output remain unavailable; this entry contract does not change that state. |

No API, RPC, server action or UI currently offers a compliant create/edit/change-
country operation for canonical addresses. Finding an addressless Property, a
legacy `RO` opportunity, the `AIRPROP-RO` Property-configuration default,
Workspace taxonomy country, locale, currency, timezone, phone, IP/header data or
opaque address text does not authorize an address default. The AIRPROP
configuration RPCs configure legacy operating-model evidence; they do not prove
the Property address country or select a multi-country Country Pack.

## Canonical address-entry contract

1. A new canonical address carries a user-visible, explicit `country_code`. The
   current storage boundary validates only uppercase two-letter syntax. This is
   not ISO membership or canonical-country validation. The value may come only
   from the user's explicit selection or an authorized command whose input
   records that explicit selection.
2. Canonical recognition requires the Core-owned
   `CORE-CANONICAL-COUNTRY-REGISTRY-01`. Until that registry exists and recognizes
   the exact token, a syntactically valid value including `ZZ` yields
   `DEPENDENCY_UNAVAILABLE` and no write. AIRPROP must not create a local registry
   or treat the syntax check, `AIRPROP-RO`, Workspace taxonomy or a Country Pack
   code as recognition evidence.
3. Locale, language, currency, timezone, phone prefix, IP, browser headers,
   Workspace defaults and tenant defaults never generate, repair or override
   `country_code`. A missing or ambiguous value fails before any canonical write.
4. `postal_code` is text contextual to country and the other address parts. It is
   not globally unique; the same value may occur in different countries or
   Properties. There is no universal numeric, length, case or regex rule. Before
   an accepted canonical artifact is resolved, country-specific validation and
   compliance claims remain unavailable.
5. Address structures are not globally uniform. Administrative areas may be
   absent, repeated or multi-level. Region/state/province/district labels and
   display order are presentation metadata. Translated labels do not grant
   authority and locale never mutates stored address data or country.
6. A country change is never an update of the connected address row. It requires
   a new canonical address, a new effective-dated Property address assignment and
   a new jurisdiction assignment/version in one separately reviewed workflow.
   Old addresses, assignments, receipts and documents remain immutable.
7. New reads and writes reject missing, malformed, unrecognized, ambiguous or cross-Workspace
   address identity. They do not backfill or infer historical rows. Remediation
   is an evidence-based, separately authorized package.
8. Address country is physical metadata. It is not a permission, command
   authority, Country Pack activation, compliance result or runtime grant.
9. Public responses and errors expose no full address, unit, actor, membership,
   hidden Property existence, provider detail or raw database message.
10. This contract does not activate unit-linked AIRPROP output. It remains fail-
   closed pending the accepted canonical selectors and movement semantics.

## Exact current country-move blockers

Two independent Core guards deny a cross-country move today; this package does
not weaken either one:

- `guard_property_jurisdiction_assignment_v1` at
  `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql:247-289`
  raises `property_jurisdiction_country_rebind_forbidden` when any active,
  superseded or archived assignment for the Property has a different country
  from the proposed profile. Creating another assignment/version therefore does
  not currently permit a cross-country rebind once history exists.
- `guard_jurisdiction_bound_property_address_v1` at the same migration
  `:315-332` raises `property_jurisdiction_property_country_immutable` when a
  historically assigned Property is pointed at an address whose country differs
  from the latest bound country. The address-country guard at `:300-313` also
  denies changing the connected address country in place.

The future delivery sequence is intentionally Core canonical-country registry,
then Core country-move/rebinding contract, then Core guard implementation, and
only then `AIRPROP-PROPERTY-COUNTRY-MOVE-09`. AIRPROP cannot route around the
present guards or predefine their replacement.

## Operation matrix

| Operation | Required input and checks | Atomic result | Current state |
| --- | --- | --- | --- |
| Create address/Property | Explicit uppercase two-letter input, canonical recognition by the future Core registry, authorized actor, Context, Workspace and Property scope; country-neutral address fields; no defaults | Address, Property linkage and required version evidence either commit together or nothing writes | `BLOCKED_AE_01` and `DEPENDENCY_UNAVAILABLE_CR_01` |
| Edit within same country | Existing current address/version plus allowed field delta; country remains identical | Forward correction/version where history requires it; no receipt rewrite | `NOT_IMPLEMENTED` |
| Change country / move Property | New address plus explicit country, new effective assignment/version, current authority and conflict guard | New chain commits together; previous chain closes and remains immutable | `BLOCKED`: separate move package required |
| CSV/bulk import | Every address row has explicit two-letter `country_code` input and future Core-registry recognition; missing, malformed, unrecognized or dependency-unavailable country is a blocking row issue; duplicate postal values are allowed | Staging may report row issues; canonical commit is all-or-none under the current importer | `BLOCKED_AE_02` and `DEPENDENCY_UNAVAILABLE_CR_01` |
| Display form | Render stored values; locale may select labels, direction and order only | No write and no normalization of country/data | `BLOCKED_AE_04`: current formatter is Romania-shaped |
| Historical NULL/addressless | Evidence review only; no inferred patch | No automatic write or backfill | `SEPARATE_REMEDIATION_REQUIRED` |

An error in one import row must not generate a default country for that row or
any other row. Per-row staging diagnostics do not mean partial canonical success.
The current importer commits the entire accepted run in one transaction; a later
address importer must retain that all-or-none boundary unless an independently
reviewed contract explicitly versions a different model.

## UI field model

The future UI starts with a required country input whose submitted token is
stored independently from translated labels. Selectable canonical values remain
blocked until the Core registry is available. The neutral model contains:

- `country_code`: explicit uppercase two-letter input, always required; selectable
  values must eventually come from the accepted Core canonical-country registry,
  which is currently unavailable;
- one or more bounded address lines and locality text without invented national
  meaning;
- ordered administrative levels represented as optional level/value pairs,
  rather than assuming one universal state/county/district hierarchy;
- optional `postal_code` as country-contextual text with no global pattern;
- optional building/sub-building fields that remain distinct from Unit identity;
- immutable address/assignment version identity outside editable display fields.

An accepted Country Pack may later supply field labels, ordering and bounded
country-specific validation. The UI may use locale for translation, direction
and display order. It must submit the same stored values and `country_code`
regardless of locale, and it must never advertise a Country Pack or compliance
status that the canonical resolver did not return.

## Historical NULL and legacy policy

- Do not backfill stored address country from old `RO` defaults, names, address text,
  postal text, currency, timezone, phone, locale, Workspace or tenant metadata.
- A canonical address cannot currently hold NULL country, but an addressless
  Property is possible. New entry/read workflows treat both missing address and
  missing country as unavailable and fail closed.
- A NULL postal code remains valid at the global layer. Country-specific
  requiredness may be asserted only by an accepted exact artifact.
- Nullable Workspace taxonomy country, AIRPROP opportunity country and
  `owner_private_units.address_text` are separate domains and cannot remediate a
  canonical address.
- Future remediation must record provenance, reviewer, previous state, new
  address/version and immutable receipt without rewriting historical documents.

## Bounded error taxonomy

| Public code | Meaning | Forbidden disclosure |
| --- | --- | --- |
| `ADDRESS_COUNTRY_REQUIRED` | Explicit country absent | inferred candidate or defaults |
| `ADDRESS_COUNTRY_INVALID_SYNTAX` | Country value is not exactly two uppercase letters | inferred correction or Country Pack/provider internals |
| `DEPENDENCY_UNAVAILABLE` | Core canonical-country registry is absent/unavailable, so even a syntactically valid token cannot be recognized | guessed canonical status, registry/provider internals |
| `ADDRESS_COUNTRY_UNRECOGNIZED` | Future available Core registry does not recognize the supplied token | fallback country or inferred replacement |
| `ADDRESS_STRUCTURE_UNAVAILABLE` | No accepted structure artifact for requested behavior | fabricated field rules or compliance status |
| `ADDRESS_SCOPE_DENIED` | Actor/Context/Workspace/Property scope not accepted | existence, address, membership or denial detail |
| `ADDRESS_VERSION_CONFLICT` | Current address/assignment version changed | current private values |
| `ADDRESS_COUNTRY_CHANGE_REQUIRES_NEW_VERSION` | In-place country mutation denied | previous full address or receipts |
| `IMPORT_ROW_INVALID` | Bounded row and field code failed validation | raw row, full address or database error |
| `IMPORT_BATCH_REJECTED` | At least one blocking row prevents canonical commit | unrelated rows or actor details |
| `ADDRESS_UNAVAILABLE` | Missing, ambiguous, stale or provider-unavailable state | internal classification; distinct from authorized empty |

Logs and public projections use bounded identifiers and field codes. They do not
echo raw CSV payloads or full addresses. Cross-Workspace denial uses the same
public shape as an inaccessible/missing resource.

## Threat model

| Threat | Required control |
| --- | --- |
| Locale/header/IP spoof selects country | These values are never accepted as country inputs; explicit country is required |
| Currency/timezone/phone/default bleed | No fallback or derived country; missing input fails before write |
| Global postal uniqueness collision/denial | No unique constraint or global deduplication by postal text |
| Universal postal regex excludes valid countries | Country-neutral storage; only an exact accepted artifact may apply local syntax |
| Workspace/cross-tenant IDOR | Actor, Context, Workspace, Property and address are checked in the same authorized transaction |
| Country changed behind active assignment | In-place update guards plus new address/assignment/version workflow |
| Partial import poisons other rows with a default | Per-row blocking issue and all-or-none canonical commit; no shared inferred value |
| Stale UI or actor/session switch | Request identity and version bind the response; late results are discarded |
| Historical receipt/document rewrite | Append/version only; prior address, assignment, receipt and document remain immutable |
| Opaque label parsed as authority | Formatter and `address_text` are display-only and never feed country/postal storage |
| Country Pack/compliance spoof | Country alone never implies artifact, validation, compliance or activation |
| Error/log privacy oracle | Bounded codes; no raw address, Unit, actor, membership, existence or provider detail |

## Follow-up execution packages

1. **Core: `CORE-CANONICAL-COUNTRY-REGISTRY-01`.** Publish the authoritative
   canonical-country recognition interface. Uppercase two-letter syntax alone is
   never sufficient, and unknown tokens remain unavailable.
2. **Core: `CORE-COUNTRY-MOVE-REBINDING-CONTRACT-01`.** Define the forward-only
   country-move/rebinding semantics and immutable history model.
3. **Core: `CORE-COUNTRY-MOVE-GUARD-IMPLEMENTATION-01`.** Implement the reviewed
   contract in the assignment/address guards without weakening existing denial.
4. **AIRPROP: `AIRPROP-PROPERTY-COUNTRY-MOVE-09`.** Consume the accepted Core
   registry, rebinding contract and guards; coordinate a new address, Workspace/
   Property binding and jurisdiction assignment/version without rewriting history.
5. **Core: `CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01`.** Supply the
   same-transaction read dependency already required by #440. AIRPROP does not
   own or pre-implement it.
6. **Core/Platform: `CORE-CANONICAL-ADDRESS-STRUCTURE-V2-01`.** Define a country-
   neutral, versioned address structure and atomic Property address assignment;
   resolve the fixed Romania-shaped column blocker without inferred migration.
7. **AIRPROP: `AIRPROP-CANONICAL-ADDRESS-ENTRY-UI-API-07`.** Implement create and
   same-country edit after the Core contracts are accepted, with explicit country
   and bounded errors.
8. **AIRPROP: `AIRPROP-CANONICAL-ADDRESS-IMPORT-08`.** Version the Property CSV
   template to require explicit country and preserve all-or-none commit semantics.
9. **AIRPROP: `AIRPROP-HISTORICAL-ADDRESS-REMEDIATION-10`.** Inventory and review
   addressless/unknown legacy records using evidence; never infer or bulk backfill.
10. **AIRPROP: `AIRPROP-OPPORTUNITY-EXPLICIT-COUNTRY-11`.** Replace the legacy
   Romania-only opportunity input independently; it still must not become address
   authority.
11. **AIRPROP: `AIRPROP-ADDRESS-PRESENTATION-12`.** Add artifact-backed,
   presentation-only formatting after the structure contract is accepted.

## Preserved state and validation classification

`commands=null`, `can_edit=false`, `state=pre_activation`, Production
`runtime=null`, Production `portfolio=null` and unit-linked fail-closed behavior
remain unchanged. Authorized empty remains distinct from unavailable; this audit
adds no read or write effect.

- Static contract harness, Node syntax, targeted lint, typecheck and diff check:
  required for this package.
- Vercel Preview: required on the exact Draft PR head.
- PostgreSQL, Auth/TOTP/AAL2, runtime and Production: **`NOT_RUN_NOT_PASS`** because
  this package contains no implementation.

The delivery result is `contract_defined_implementation_blocked`. Documentation
acceptance does not accept runtime semantics, activate a Country Pack, permit a
Remote write, or authorize any follow-up package.
