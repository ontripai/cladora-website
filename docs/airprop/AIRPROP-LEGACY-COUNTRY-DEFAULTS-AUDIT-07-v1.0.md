# AIRPROP legacy country defaults audit 07

Status: **`audit_complete_no_active_inference_fix_required`**.

Baseline: live `main@8cffa7d95e0088c30fd5b2e6f6b5ee57ee8a79aa`, tree
`09c68456c8fc33d35e771dd5186fe64294692a67`.

Static inventory refresh: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`.
Later documentation/fixture additions do not change the audit result or its
original runtime baseline.

This is a documentation and static-audit package. It changes no migration,
product source, route, runtime, registry, Country Pack, seed, grant, AIRPROP
guard, package manifest, workflow or activation state.

## Method and classification rule

The audit searched AIRPROP TypeScript, customer UI and routes, every migration
whose name or effective definition touches AIRPROP, AIRPROP pgTAP and Node
fixtures, the generic address formatter, Workspace taxonomy, controlled import,
canonical address storage and the inactive B2 projection. Signals included
`AIRPROP-RO`, `RO` country literals, country/pack/version defaults, two-letter
country patterns, Romanian address tokens, and possible country inference from
locale, language, currency, timezone, phone, IP, request headers, Workspace or
tenant defaults.

The static inventory also freezes every repository source, SQL and test file
whose path or contents identify AIRPROP and whose contents carry a country
signal. The refreshed boundary is 56 files; additions cannot silently escape
classification.

Each finding below has exactly one classification from the required set. “Live”
means the last effective SQL definition after applying migrations in filename
order, not merely text that still exists in an older immutable migration.

## Classified findings

| ID | Finding and exact evidence | Classification | Runtime status and boundary |
| --- | --- | --- | --- |
| C01 | `portfolio.addresses.country_code`: historical declaration at `supabase/migrations/20260825000300_portfolio_properties_buildings_units.sql:6-10`; effective default removal and two-letter check at `supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql:7-21`; assignment/address guards at `:247-348` | canonical address authority | The address row plus accepted Core binding/guards is the only inspected canonical address-country source. The check proves uppercase two-letter syntax only; no Core country registry currently proves canonical membership. |
| L01 | `customer_api.create_airprop_opportunity_v1` wrapper at `20260914144417_airprop_core_foundation.sql:314-316`; final `app_private.create_airprop_opportunity_internal_v1` at `20261003151604_20261003083859_workspace_scoped_effective_permission.sql:230-257` | legacy AIRPROP configuration | **Live.** The final internal function requires opportunity payload country `RO` and stores an opportunity snapshot. It never reads or writes `portfolio.addresses` and is not address authority. |
| L02 | `src/lib/airprop/opportunity-contract-v2.ts:17-35`, `src/components/customer/CustomerAirpropWorkspace.tsx:33-68`, `src/lib/airprop/opportunity-idempotency-v2.ts:17-49`, route `src/app/api/customer/v2/airprop/opportunities/route.ts:20-58`, and SQL `20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql:22-123` | legacy AIRPROP configuration | **Live.** UI, contract and SQL deliberately restrict the commercial opportunity snapshot to `RO`; idempotency preserves that input. This is a fixed legacy product restriction, not inference and not canonical address or Country Pack authority. |
| L03 | `customer_api.configure_airprop_property_v1` at `20260914144417_airprop_core_foundation.sql:320-322`; final `app_private.configure_airprop_property_internal_v1` at `20261003151604_20261003083859_workspace_scoped_effective_permission.sql:292-315` | legacy AIRPROP configuration | **Live.** Public parameters default to `AIRPROP-RO`/`1.0`; the final internal function rejects every other pack/version and stores an operating-model label. It does not resolve address country, an installed Core artifact, or compliance status. |
| L04 | `docs/airprop/AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md:1-81`, `AIRPROP-CORE-001-DISCOVERY-AND-IMPLEMENTATION.md:15-38`, and `AIRPROP-MIGRATION-TEST-PLAN-v1.0.md:7-30` | legacy AIRPROP configuration | Design/history describes a Romania synthetic pilot and a Dubai placeholder. Documentation and identifiers are not executable Country Pack installation, canonical recognition or compliance evidence. |
| P01 | `src/config/formatters.ts:180-199`; callers are only `src/components/home/PortfolioIntelligenceSection.tsx:103` and `src/components/demo/DemoDashboardPage.tsx:425` | presentation-only | `formatAddress` rewrites Romanian-shaped string tokens for display. AIRPROP source and routes do not call it. It cannot parse, normalize or authorize stored address country. |
| P02 | AIRPROP-adjacent country or Romania copy in `src/app/[lang]/{ai,industries,platform/architecture,resources/glossary,resources/guides,solutions}/page.tsx`, `src/components/contact/ContactForm.tsx`, and `src/config/routes-metadata.ts` | presentation-only | Marketing, explanatory text, translated labels and location placeholders only. No listed file supplies an AIRPROP address, resolver input, pack installation or compliance decision. Text that describes a Romania baseline is not runtime evidence. |
| P03 | `src/lib/airprop/address-structure-presentation-evaluator-v1.ts` and `docs/contracts/AIRPROP-ADDRESS-STRUCTURE-PRESENTATION-EVALUATOR-v1.0.md` | presentation-only | Inactive pure evaluator of an already supplied, hash-valid `address.structure` artifact and explicit address country. It has no resolver, route, database, default-country source, command authority, compliance output or activation wiring. |
| T01 | Node fixtures containing both AIRPROP and country signals: fifteen `scripts/test-airprop-*.mjs` files frozen by the harness, four `scripts/test-core-jurisdiction-{profile-selector,domain-artifact-resolver}{,-postgres}-v1.mjs` fixtures, three `scripts/test-documents-country-retention-*.mjs` fixtures, `scripts/test-workspace-role-assignment-runtime.mjs`, and `scripts/test-workspace-taxonomy-slice.mjs` | synthetic/test fixture | Test inputs and negative assertions only. Core/Documents fixtures use AIRPROP permission/purpose labels while exercising their canonical boundaries; Workspace fixtures exercise isolation. None supplies Production defaults or runtime authority. |
| T02 | AIRPROP pgTAP fixtures containing country/pack/location signals: `supabase/tests/{086,133,134,135,146,149,151,170,172,173,174,175,176,177,178,179}_*.test.sql` | synthetic/test fixture | Transaction-wrapped/synthetic evidence only. `086` explicitly proves `AIRPROP-AE-DU` fails closed while `AIRPROP-RO/1.0` is the legacy configuration accepted by that gateway. |
| D01 | Original `app_private.create_airprop_opportunity_internal_v1` and `app_private.configure_airprop_property_internal_v1` in `20260914144417_airprop_core_foundation.sql:232-315` | dormant or superseded definition | **Superseded.** Both exact signatures are replaced later by `20261003151604_...`; the original bodies are not the effective runtime definitions. The public v1 wrappers remain live and dispatch to the replacement functions. |
| D02 | Historical `country_code char(2) not null default 'RO'` in `20260825000300_portfolio_properties_buildings_units.sql:8` | dormant or superseded definition | **Superseded.** `20261015183000_core_jurisdiction_profile_v1.sql:11` drops the default. It must remain immutable migration history and must not be treated as the current schema default. |
| D03 | `src/lib/airprop/valuation-contract-v1.ts:21-36` accepts any uppercase two-letter `country_code`; its consumers are contract/quality modules and static tests, with no AIRPROP product route | dormant or superseded definition | **Dormant contract.** The regex is syntactic only. Activation before Core registry recognition would be unsafe; this audit does not activate or rewrite it. |
| U01 | Controlled import schema and commit at `src/lib/customer/onboarding-import-schema.ts:3-17` and `supabase/migrations/20260913063638_residential_pilot_import_completion.sql:134-205` | unsafe runtime dependency | The live Property import requires only `name` and creates an addressless Property. It provides no country default or inference, but cannot be used as multi-country address evidence. A future address consumer must fail closed. |
| U02 | Repository-wide Core/schema inventory contains no canonical-country registry; current storage and Workspace taxonomy validate only `[A-Z]{2}` | unsafe runtime dependency | A token such as `ZZ` is syntactically valid but is not canonical. Canonical recognition is `DEPENDENCY_UNAVAILABLE` until `CORE-CANONICAL-COUNTRY-REGISTRY-01` exists. AIRPROP must not substitute its `RO` literals or pack labels. |

No finding is assigned to more than one classification. The presence of legacy
configuration beside canonical address storage does not merge their authority.

## Effective SQL definition order

Migrations are applied in filename order. The relevant sequence is:

1. `20260825000300_portfolio_properties_buildings_units.sql` creates the
   historical address `RO` default.
2. `20260914144417_airprop_core_foundation.sql` creates AIRPROP tables, original
   v1 internal functions and live public v1 wrappers. The configuration wrapper
   defaults `AIRPROP-RO`/`1.0`.
3. `20261003151604_20261003083859_workspace_scoped_effective_permission.sql`
   replaces the two v1 internal functions using their exact signatures. These
   replacement bodies are the effective v1 runtime. They retain the opportunity
   `RO` restriction and property configuration `AIRPROP-RO`/`1.0` restriction.
4. `20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql`
   adds a separate live v2 opportunity function. It validates an exact `RO`
   payload and serializes `"country_code":"RO"` into its idempotency input.
5. `20261009121000_airprop_management_portfolio_report_v1.sql` adds the inactive
   B2 portfolio read. It projects no address, country, postal, pack or compliance
   field and leaves EXECUTE revoked for product roles.
6. `20261015183000_core_jurisdiction_profile_v1.sql` drops the historical address
   default, adds a syntactic two-letter check and adds current country-binding
   guards. It does not add a canonical-country registry.

The public v1 wrappers were not redefined. PostgreSQL name resolution therefore
invokes the latest `CREATE OR REPLACE` internal body with the same signature. The
old bodies remain migration history, not parallel live implementations.

## Inference audit

No active AIRPROP product source or route derives country from locale, language,
currency, timezone, phone prefix, IP/geolocation, `Accept-Language`, forwarding
headers, browser language/timezone, tenant metadata or Workspace defaults.

- `CustomerAirpropWorkspace` inserts the explicit literal `RO`; changing UI
  language does not change it. This is a legacy restriction, not inference.
- Workspace taxonomy initializes country from its explicit input/current stored
  taxonomy and otherwise uses an empty string. It has no `RO` fallback. Its
  country is Workspace configuration and never address authority.
- Currency inputs remain commercial/financial fields. `RON` or `EUR` does not
  select an address country or a Country Pack.
- The generic Romanian-shaped formatter changes display text only and has no
  AIRPROP caller.
- Controlled import supplies neither a country nor an address. Absence remains
  unsafe/unavailable; it is not repaired from a default.

Result: **`active_country_inference=NONE`**. The task authorizes a product change
only for a real active inference. None exists, so product code remains unchanged.

## Authority and fail-closed invariants

### Address country

`AIRPROP-RO`, opportunity `country_code='RO'`, city `București`, currency `RON`,
Workspace taxonomy and formatter output are not address authority. The only
inspected address-country source is the canonical `portfolio.addresses` row under
the current Core Property/Workspace/jurisdiction binding. The existing check is
only uppercase two-letter syntax. Even though the migration comment names ISO,
the database has no canonical registry proving that membership.

### Country Pack and compliance

An `AIRPROP-RO` string or `1.0` default proves only that the legacy AIRPROP
configuration function accepted those input labels. It does not prove that a
Core Country Pack artifact is installed, current, hash-matched, reviewed or
active. Opportunity country and address country likewise create no pack or
compliance status. No AIRPROP read projection emits pack identity or compliance.

### Postal data

`postal_code` remains optional text. No migration creates a global unique
constraint/index over it, and no global SQL regex, length or numeric-only rule is
attached to it. Repeated postal text across countries and Properties remains
valid. Only a future accepted exact country artifact may supply local validation;
postal text cannot select country or a pack.

### Projection and activation

The current management portfolio RPC does not join `portfolio.addresses` or emit
country/postal/pack/compliance. Production B2 keeps `runtime=null`,
`portfolio=null`, `commands=null`, `can_edit=false` and `state=pre_activation`.
The isolated loopback read returns `AIRPROP_UNIT_SCOPE_UNRESOLVED` for any
unit-linked row. Missing canonical country resolution therefore remains
unavailable rather than becoming a literal/default-derived result.

## Dependency graph

```text
CORE-CANONICAL-COUNTRY-REGISTRY-01
  -> CORE-COUNTRY-MOVE-REBINDING-CONTRACT-01
  -> CORE-COUNTRY-MOVE-GUARD-IMPLEMENTATION-01
  -> CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01
  -> AIRPROP-PROPERTY-COUNTRY-MOVE-09
```

The registry must recognize a country before Core defines cross-country history
and rebinding semantics. Core then implements the guards and same-transaction
read selector. AIRPROP consumes the accepted artifacts last; it does not create a
parallel registry, selector or authority.

## Validation classification

- Static repository/effective-definition harness, Node syntax, targeted ESLint,
  typecheck, diff check and exact-head Vercel Preview: required.
- PostgreSQL, Remote DB, HTTP/Auth/AAL2, runtime activation and Production:
  **`NOT_RUN_NOT_PASS`** because this package changes no executable product path.
- Result: **`audit_complete_no_active_inference_fix_required`**.
