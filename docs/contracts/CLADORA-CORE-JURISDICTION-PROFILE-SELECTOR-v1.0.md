# CLADORA Core Jurisdiction Profile Selector v1.0

Status: inactive integration contract  
Package: `CORE-JURISDICTION-PROFILE-SELECTOR-02`

## Purpose

This selector binds a property to its current versioned Country Pack inside an
existing Core transaction. It lets legal, accounting, tax and payment providers
request exact jurisdiction-domain artifacts without deriving country from UI
locale, currency, user location, Workspace or postal-code format.

The contract supports any ISO 3166-1 alpha-2 country. A Workspace may contain
properties in several countries, and an actor may use several Workspaces. The
property address remains the canonical country source. Postal code remains
country-specific free-form text and is neither globally unique nor normalized
to one international shape.

## Inputs

The selector consumes:

1. the existing `CoreTransactionScopeV1`;
2. the command already accepted by the Core host;
3. the canonical post-lock current-authority receipt for that command;
4. `property_id`, an optional expected country and an ordered unique list of
   required domain codes.

`property_id` must be present in `command.provider_source_ids`. This ensures the
Core host locks the property source before provider validation. The selector
does not introduce a transaction host, authority store, ledger or lock engine.

## Current-state checks

All checks occur in the supplied serializable transaction. The selector:

- matches transaction, command, attempt, aggregate lock, actor, Context,
  Workspace, authority revision, permission, module and purpose exactly;
- requires a current authority entitlement for the same Workspace, module and
  revision;
- rechecks the canonical authority revision and current permission after locks;
- locks the current Context, membership, Workspace and scope ancestry;
- locks the active Workspace-to-property binding, property and address;
- requires one current active property jurisdiction assignment;
- requires one current active profile with immutable matching manifest,
  explicit legal signoff and explicit accounting signoff;
- requires the address, assignment and profile country codes to match;
- locks and returns only the explicitly requested, current active domain
  artifacts in canonical order.

Normal stale, missing, ambiguous, cross-Workspace, revoked, unsigned, inactive
or domain-incomplete cases return bounded denial decisions. SQLSTATE `40001` is
never translated; it propagates to the Core host for a fresh transaction retry.

## Output and privacy

An accepted decision contains only bounded integration metadata:

- current Context, Workspace, actor and authority revision;
- property and assignment identity/version;
- profile identity/code/version, country, currency, timezone, calendar and
  manifest hash;
- requested domain code, contract version and artifact hash.

It excludes addresses, postal codes, legal/accounting signoff references,
payment account data, tax identifiers, authority rows and private source data.
Every decision uses `source_disclosure=status_only` and
`reusable_as_command_authority=false`.

## Inactive boundary

This package adds no migration, Country Pack seed, jurisdiction assignment,
payment rail adapter, accounting or tax engine, route, UI, grant, Remote DB
operation or runtime activation. Country Packs remain separately reviewed,
signed and versioned artifacts. A consumer must request its precise domains,
for example `tax.vat`, `accounting.invoice` or `payments.local_rails`, and must
fail closed when any required domain is unavailable.

## Acceptance evidence

The package requires static and disposable PostgreSQL evidence for:

- exact command/authority/source-lock binding;
- multi-country selection without country hardcoding;
- country mismatch and missing-domain denial;
- revoked Workspace or permission denial with zero durable writes;
- shared-lock serialization of profile suspension;
- rejection of historical receipts;
- propagation of a real PostgreSQL `40001` and evaluation in a fresh attempt;
- SELECT-only behavior and bounded output.
