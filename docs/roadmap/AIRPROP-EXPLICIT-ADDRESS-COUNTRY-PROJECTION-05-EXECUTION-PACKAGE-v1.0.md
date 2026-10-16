# AIRPROP explicit address-country projection 05

Status: **`core_extension_required`**.

This execution package defines the inactive AIRPROP read projection boundary. It
does not change the B2 response schema, SQL function, Core implementation,
migration history, guard, route, grant, Country Pack data, or activation state.

## Reviewed baseline

- Live main: `e11cfda735f50a8969b8f6f791183db9047e2fa4`.
- Tree: `bfa5b1228648a70fd54015b64b0487427811bad8`.
- Merged readiness audit: `AIRPROP-MULTI-COUNTRY-ADDRESS-READINESS-AUDIT-04`.
- Merged Core resolver dependency: PR #431, accepted head
  `9927f1ee674ed7aa7f949150e00c95df52d2f881`, tree
  `e66df31dde3fc533afad76c707547e51210c7e85`.

The #431 merge establishes an inactive, command-transaction-bound jurisdiction
artifact resolver. It does not establish an AIRPROP read selector, an AIRPROP
schema change, a Remote installation, a grant, or runtime activation.

## Compatibility decision

The current projection cannot safely add `country_code` at the consumer layer.

1. `managementPortfolioResponseV1Schema` is strict and permits only property
   `id` and `label`.
2. `customer_api.read_airprop_management_portfolio_v1` reads the mandate,
   Property label and owner, but does not join the canonical Property address or
   current jurisdiction assignment.
3. `readAirpropB2Portfolio` deliberately invokes only that Artifact A RPC. A
   second client query would have a different statement snapshot and would not
   inherit its current Context, Workspace, permission or Property decision.
4. `selectCurrentPropertyJurisdictionProfileV1` is bound to a serializable Core
   command, current command authority receipt, aggregate lock and provider-source
   set. AIRPROP must not fabricate a command to obtain read metadata.
5. The #431 artifact resolver is also command-bound and returns bounded Country
   Pack artifact evidence. AIRPROP needs only the stored address country for this
   projection and must not expose or infer artifact/compliance state.

Making the field optional, defaulting it, retaining a stale cached value, or
querying with a privileged fallback would turn missing authority into apparently
valid data. The current response therefore remains unchanged and unavailable is
preserved until Core supplies the read-bound extension below.

## Required Core dependency

Dependency ID: **`CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01`**.

Owner: Core/Platform. AIRPROP consumes the accepted artifact after independent
Core review; it does not create a parallel selector or authority interface.

Core may extend its existing jurisdiction selection capability or provide one
internal batch read selector. The accepted shape is Core-owned, but it must:

- execute inside the same database transaction and statement-consistent read as
  `read_airprop_management_portfolio_v1`;
- derive actor from the verified database session and bind exact Context,
  Workspace, current authority revision and `airprop.asset.read` permission;
- accept only Property IDs already selected by the authorized mandate read;
- require exactly one current Workspace/Property binding, active Property,
  canonical address and current jurisdiction assignment;
- require address country, assignment country and profile country to match, and
  retain the assignment ID/version internally as freshness evidence;
- deny NULL, missing, malformed, ambiguous, stale or cross-Workspace bindings;
- return status-only denial and, on acceptance, only exact Property identity and
  uppercase two-letter `country_code` needed by the consumer;
- perform SELECT-only work with no audit, outbox, idempotency, assignment,
  address, Property, Building or Unit writes;
- expose no Country Pack artifact, manifest, compliance, signoff, activation or
  internal denial detail to AIRPROP output; and
- be unusable as command authority.

The extension must not accept locale, language, currency, timezone, phone,
request IP, browser headers, tenant defaults or Workspace defaults as inputs or
fallbacks. It must not offer a service-role, owner-pool or cached-authority path.

## Future AIRPROP consumption boundary

After the Core dependency is merged and separately accepted, a later inactive
AIRPROP candidate may version the response and SQL projection. For every
authorized Property row, it may expose only the resolved `country_code` as
read-only metadata alongside the existing Property ID and label.

The public projection must not include postal code, address lines, assignment
identity/version, profile identity, default currency/timezone, artifact hash,
Country Pack fields, validation claims or compliance status. `commands=null`,
`can_edit=false`, `state=pre_activation`, Production `runtime=null` and
Production `portfolio=null` remain unchanged.

If the authorized mandate set is empty, the result is an authorized `200` empty
projection and no country selector result is invented. If any returned Property
has a missing, ambiguous, stale, mismatched or cross-Workspace country binding,
the whole read is unavailable; partial rows and NULL countries are not emitted.

Unit-linked output remains unavailable until the canonical unit/property
selector and move/revocation semantics are accepted for this read path. The
country dependency does not relax that earlier gate.

## Country, postal and move invariants

- The sole country source is `portfolio.properties.address_id` joined to the
  canonical `portfolio.addresses.country_code`, checked against the current
  jurisdiction assignment in the same read transaction.
- Locale or presentation language may change labels only. Currency, timezone,
  phone, IP, browser headers and Workspace configuration cannot select country.
- Postal code is not projected by this package, is not globally unique, and is
  not constrained by a global regex. Two countries and multiple Properties may
  use identical postal text.
- A bound address country cannot change in place. A Property address move cannot
  cross the bound country. Any future supported country move requires a new
  reviewed Workspace binding and jurisdiction assignment/version; this package
  creates neither.
- No Country Pack artifact or compliance state is implied by a visible country
  code. Country is physical-address metadata, not product activation evidence.

## Acceptance matrix

| ID | Case | Required result |
| --- | --- | --- |
| AC-01 | DE and RO Properties use identical postal text | Both preserve their explicit countries; no collision |
| AC-02 | Locale/language/currency/timezone/phone/IP/header/default changes | Country remains the canonical stored value |
| AC-03 | Address country is NULL, missing or malformed | Entire projection unavailable |
| AC-04 | More than one current address/binding/assignment | Entire projection unavailable |
| AC-05 | Property or address belongs to another Workspace/tenant | Entire projection unavailable; no existence detail |
| AC-06 | Assignment country/version is absent, stale or mismatched | Entire projection unavailable |
| AC-07 | In-place country change or cross-country address replacement | Storage denial; no read fallback |
| AC-08 | Authorized mandate set is empty | `200` with `properties=[]`, distinct from unavailable |
| AC-09 | Unit-linked action exists | Unavailable pending the canonical unit selector |
| AC-10 | Actor/session changes while an older response is pending | Old response remains request-bound and is not shown in the new identity |
| AC-11 | Accepted Property row | Only metadata `country_code` may be added; no postal/Country Pack/compliance fields |
| AC-12 | Every accepted, denied, empty or unavailable read | `ZERO_WRITE` across all domain and shared ledgers |

## Validation classification

- Static execution-package contract and fixture matrix: required now.
- Existing synthetic loopback actor/session, authorized-empty/unavailable and
  unit fail-closed contracts: required regression evidence now.
- Lint, typecheck, diff-check and exact-head Preview: required now.
- PostgreSQL projection harness: **`NOT_RUN_NO_IMPLEMENTATION`**. It becomes
  mandatory for the later consumer candidate after the Core selector exists.
- Real local Auth/TOTP/AAL2 and Production HTTP: **`NOT_RUN_NOT_PASS`** for this
  package. Earlier evidence retains only its original scope.

## Stop condition and delivery order

Stop with `core_extension_required` if Core offers only the command-bound
profile/artifact selectors, requires a second transaction, exposes Country Pack
or compliance data, permits inference/defaults, or delegates authority checks to
AIRPROP.

Delivery order is: Core read-selector candidate and Core review; AIRPROP hash
guard registration if required; inactive AIRPROP response/RPC version with
PostgreSQL and multi-country evidence; independent activation review. None of
those later steps is authorized by this package.
