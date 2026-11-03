# CLADORA Core DW-02 resource contracts v1.0

**Baseline:** `feat/core-dw-01a-capability-reader@81fb0744d7ffb1ce682dbb8ae96541da4ffe7b3f`

**Owner:** Core/Platform owns shared identity, canonical references and relationship envelopes. Domain works own their records, commands and state machines.

**Delivery boundary:** the canonical Unit-reference vertical slice is accepted on a disposable local database and authenticated API. Other resource kinds and relationship/provider/geography resolvers remain withheld or contract-only. No remote database operation, registry replacement, manifest rewrite or Production effect is authorized.

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

## Accepted Unit vertical slice

The implemented slice is intentionally narrow and connected:

- `customer_api.resolve_canonical_resource_reference_v1` maps the existing Core Unit and Unit specification history only;
- `app_private.resolve_workspace_native_context_v2` and `app_private.check_workspace_native_permission_v2` remain the only authority resolver/evaluator;
- `core.units.identity.read` and `core_unit_identity` are fixed server-side for the accepted purpose `core.unit_identity.history`;
- the existing property-operations mandate remains mandatory;
- `customer_api.get_core_unit_identity_history_v1`, already exposed by `/api/customer/v1/core/unit-identity`, consumes the DW-02 resolver and returns its bounded `resource_reference`;
- `/api/customer/v1/core/resources/unit-reference` exposes the strict authenticated read API without a service-role path;
- `supabase/tests/202_dw02_canonical_unit_reference_v1.test.sql` proves verified, stale, not-found, withheld, AUTH-01 deny, cross-tenant denial, zero writes and real-consumer behavior with 37 pgTAP assertions;
- `supabase/tests/162_lifecycle_core_identity_history_read.test.sql` remains green with 8 pgTAP assertions after the consumer cut-over.

## Remaining blockers without widening this slice

- `party`, `property`, `building`, `entrance` and `asset` remain withheld until each has an accepted integer version source, exact permission/purpose and a real consumer. They do not block the accepted Unit slice or existing operations.
- `resource-relationship.v1` remains a schema over existing domain-owned relationship sources; no parallel relationship engine is introduced.
- Provider-agreement verification remains blocked on an accepted canonical agreement/mandate source.
- Geographic coverage remains blocked on an approved source/version mapping and is never inferred from Workspace taxonomy.
- PC-01 and PF-01 may proceed independently against accepted DW-01/DW-02 surfaces; completing all PC-01 projections is not a gate for PF-01 or existing operations.
- BK-01 is only a prerequisite for C13 shared-resource reservation and is not on the DW-02, PC-01, PF-01, COM-01, FIN-01 or OPS-01 path.

This local acceptance is not merge authorization, remote migration authorization or Production release.
