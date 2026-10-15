# CLADORA Core Jurisdiction Profile v1.0

**Package:** `CORE-JURISDICTION-PROFILE-01`

**State:** inactive foundation
**Activation:** prohibited by this package

## Decision

Country law is bound to a property, not inferred from a language, user IP,
currency, Tenant, or Workspace. One Owner Portfolio or Workspace may contain
properties in several countries. Every country-sensitive command must select
the exact active profile revision for its target property and preserve that
revision in durable evidence.

The registry is an open country catalog. Romania and Iran may be used as test
fixtures or later Country Packs, but they do not define a two-country product
model. Any country can be added through its own reviewed and versioned pack.

## Invariants

1. `locale != country != jurisdiction profile`.
2. A property has at most one active jurisdiction assignment at an instant.
3. A Workspace may contain properties with different country codes.
4. The first validated or active country binding is permanent for that
   property. Later assignments may only advance the profile version for the
   same country.
5. An active assignment requires an active profile, exact address-country
   agreement, an active canonical Workspace/property binding, legal signoff,
   accounting signoff, and active required domain artifacts.
6. Profile definitions and domain artifact hashes are immutable. A policy or
   law change creates a new profile version.
7. Historical receipts keep the profile and artifact hashes used at commit.
   A newer law does not rewrite an older transaction.
8. Country-sensitive operations fail closed when a property is unbound, the
   profile is inactive, a required domain is unavailable, or the requested
   country differs.
9. Evidence is metadata-only and never becomes command authority.
10. No country is seeded or activated, no legacy row is backfilled, and no
    Remote installation is performed by this package.
11. Every new address states its country explicitly. Core does not supply a
    default country and never derives it from locale, currency, Tenant,
    Workspace, user location or IP address.
12. Postal codes are country-specific text. They are not global identifiers,
    are not unique, and do not share one worldwide format. Syntax validation,
    when required, belongs to the activated Country Pack for that address.
13. Payment rules are jurisdiction domains bound to the Property and effective
    profile revision. Currency, local rails, settlement, invoice/receipt,
    refund and regulatory constraints cannot be selected from UI locale or a
    global payment default.

## Registry

`platform.jurisdiction_profiles` stores immutable profile identity, country,
version, currency/timezone/calendar defaults and a SHA-256 manifest. Status and
signoff fields may advance only through the controlled lifecycle.

`platform.jurisdiction_profile_domains` pins each domain contract and artifact
hash. Example domain codes include `finance.statutory`, `tax.reporting`,
`governance`, `documents.retention`, `payments`, `assets.compliance` and
`airprop`.

`platform.property_jurisdiction_assignments` binds one Property and its
canonical Workspace to an exact profile revision. It does not reuse the legacy
Workspace taxonomy `country_code` as governing-law evidence.

`portfolio.addresses.country_code` remains the explicit physical-country input
for each address. Its old Romanian default is removed. `postal_code` remains
optional, non-unique free-form text so numeric, alphanumeric, spaced and
hyphenated national forms can coexist.

## Payment boundary

A Country Pack may require versioned artifacts such as
`payments.local_rails`, `payments.settlement` and `payments.regulatory`. These
artifacts describe the country's allowed currencies and rails, settlement and
rounding rules, refund constraints, required invoice/receipt evidence and
regulatory checks for the effective transaction date.

Payment-provider accounts, merchant onboarding, bank/PSP credentials, secrets,
Remote connectivity and execution capability are deployment-specific. They are
never stored in the jurisdiction profile and are not activated by this package.
A payment command must have both an accepted country-domain artifact and a
separately authorized runtime adapter; absence of either fails closed.

## Iran profile boundary

An eventual Iran pack must independently version accounting, tax/e-invoice,
IRR/toman presentation policy, working calendar, legal identifiers, governance,
document retention/e-signature, banking/Sheba and data-residency adapters.
Persian UI and RTL support are localization evidence only.

## Acceptance boundary

This package proves repository schema and fail-closed binding behavior. It does
not prove any country's laws, Remote DB installation, regulatory acceptance,
HTTP/AAL2, payment connectivity or Production activation.
