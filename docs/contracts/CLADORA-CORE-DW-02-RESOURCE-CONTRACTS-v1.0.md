# CLADORA Core DW-02 resource contracts v1.0

**Baseline:** `feat/core-dw-01a-capability-reader@81fb0744d7ffb1ce682dbb8ae96541da4ffe7b3f`

**Owner:** Core/Platform owns shared identity, canonical references and relationship envelopes. Domain works own their records, commands and state machines.

**Delivery boundary:** additive TypeScript contracts and static verification only. No migration, endpoint, remote database operation, registry replacement, manifest rewrite or Production effect.

## Existing sources reused

DW-02 adapts the existing `portfolio.parties`, `portfolio.properties`, `portfolio.buildings`, `portfolio.entrances`, `portfolio.units`, `portfolio.ownerships`, Workspace property bindings and Workspace-native authority. It creates no second party, property, ownership, membership, role, permission, audit, outbox or idempotency source.

Workspace is not a resource type and is not assumed to be a building. The same person, company or asset may participate in several versioned relationships across several Workspaces. Ownership, management, operation, occupancy, representation, provider status and access are separate relationship kinds. None implies another.

## `canonical-resource-reference.v1`

The input pins `context_id`, `workspace_id`, `resource_type`, `resource_id`, `resource_version`, exact `permission_code` and bounded `purpose`. Resource types are `party`, `property`, `building`, `entrance`, `unit` and `asset`; party references separately identify person, company, association or public body.

The server-derived result is `verified`, `stale`, `not_found` or `withheld`. Every result states `action_authorization = not_evaluated`. A verified reference proves canonical identity/version and bounded disclosure only; it grants no ownership, management, access, entitlement or command authority.

A withheld response exposes no tenant, Workspace, resource type/id/version, party kind, display name or lifecycle status. A stale result is returned only when the caller may know that the resource exists. Historical domain records retain their pinned type/id/version when the resource later changes.

## `resource-relationship.v1`

The relationship pins its own ID/version, party, canonical resource, Workspace, relationship kind, scope, validity interval, status and optional evidence reference. The allowed kinds are ownership, management, operation, occupancy, representation, provider and access.

The envelope never treats ownership as management or access. A relationship in one Workspace does not grant visibility or action authority in another. `valid_until` must follow `valid_from`; expired, revoked and superseded relationships remain historical evidence and are not rewritten. Consumers must still run the exact current authority check for the requested action.

## `provider-agreement-verification.v1`

The command supplies only agreement ID/version, requested service scopes and exact permission within an explicit context and Workspace. Provider party, effective dates, allowed scope and status are server-derived from an accepted canonical agreement/mandate source.

Effective verification is a prerequisite result, not action authorization. Expired, revoked, not-yet-effective, superseded, cross-tenant or out-of-scope agreements cannot support a new provider command. Replay rechecks current authority and agreement effectiveness. A withheld result returns null for every agreement, party, tenant, Workspace, date and source reference and returns no scope entries.

No provider-agreement table or verifier RPC is created by this contract slice because the Repository has no accepted canonical provider-agreement persistence source. Provider-backed publication remains narrowly blocked; provider-free definition drafting and Workspace-wide flows remain independent.

## `geographic-coverage-resolution.v1`

The input contains an uppercase two-letter country code, optional bounded region code, optional source version, exact permission and purpose. The output is `verified`, `stale`, `unsupported` or `withheld` and pins an approved geography source/version when disclosed.

Geography is never inferred from descriptive Workspace taxonomy. A country/region code does not prove service coverage, resource presence or action authority. A withheld result exposes no tenant, Workspace, country, region, source or version. No new geography registry is created in this slice because an approved canonical source has not been accepted.

## Consumer and ownership boundaries

- SERVICE may consume these envelopes but owns offering, request, quote, order and delivery state.
- Community & Experience may consume canonical references but owns its domain lifecycle.
- AIRPROP may consume canonical references/relationships but owns commercial and valuation state.
- Core owns the shared envelope and adapters over accepted canonical sources only.
- Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.

## Acceptance and remaining implementation gates

This slice is complete when the schemas are strict, withheld variants structurally prohibit identifiers/source details, relationship validity is checked, static contract tests pass, TypeScript passes, and existing DW-01A/minimum-consumer tests remain green.

Executable resolvers remain a later narrow slice. Before a resolver is enabled it requires an accepted source mapping, Workspace-native authority integration, permitted/stale/withheld/cross-tenant tests, zero-write denial evidence and an isolated database test. A schema or successful CI run is not acceptance, merge authorization, remote migration authorization or Production release.
