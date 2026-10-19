# CLADORA Core PF-01 owner portfolio projection v1.0

**Baseline:** `5ca9dc3ef768850c8053bc781815ad6c247bde33`

**Owner:** Core Portfolio owns the privacy-bounded projection envelope. AIRPROP, SERVICE, Operations, Finance and Communications retain ownership of their records and commands.

**Delivery boundary:** one local-tested, read-only vertical slice: RPC, bounded API and the existing Owner Dashboard consumer. No remote database operation, parallel ledger, central manifest rewrite or Production effect.

## Existing sources reused

PF-01 projects the existing `public.owner_private_units`, `public.owner_private_leases`, `public.owner_private_cash_entries`, `platform.owner_unit_links`, `portfolio.units`, `portfolio.ownerships`, `billing.invoices` and `billing.receivables`. It preserves the current owner portfolio pilot/invitation lifecycle and Workspace-native authority.

The projection creates no second owner identity, party registry, resource registry, ownership ledger, lease lifecycle, financial ledger, role, permission, audit, outbox or idempotency source.

## `owner-portfolio-projection.v1`

The runtime reader returns a bounded collection of this same contract, one projection per source Workspace. The server derives the owner subject and a current tenant context for each verified link; it accepts no caller-supplied Workspace, relationship or owner identity. Each source Workspace is evaluated independently. The personal portfolio is not tenant-wide authority and is not a building Workspace.

This minimal runtime slice emits canonical Unit items only. Private resources continue to use the existing private dashboard paths and never enter an official item. A linked item requires the existing owner link, a current ownership row, current AUTH-01 authority and a disclosed DW-02 `canonical-resource-reference.v1`. Revocation removes future disclosure without rewriting the private record, ownership row or historical attribution.

A canonical item pins its source Workspace/context and must match the resource type/id and Workspace in its relationship snapshot. `not_found` and `withheld` canonical references cannot appear inside a visible item. An entirely withheld projection returns no Workspace, owner, resource, balance or cursor identifiers.

## Source separation and balances

Every record declares one source class:

- `private_owner_record` is self-reported and isolated to the owner.
- `official_workspace_record` is read from the authoritative source Workspace.
- `domain_owned_record` remains owned by its domain and is only summarized through an accepted adapter.

`owner-portfolio-balance.v1` distinguishes `recorded` from `unavailable`; a recorded amount is always present, so decimal zero is never confused with missing data. Private cash requires a private source. Official charges require an official Workspace source. A projected amount never posts, reverses or reconciles a journal, invoice, receivable or payment and always states `action_authorization = not_evaluated`.

Private lease and cash records never become official Workspace books. PF-01 returns no balance in this slice: FIN-01 remains the prerequisite for a future official balance adapter. Official charges remain sourced from `billing.invoices` and `billing.receivables`; the projection cannot copy them into the private ledger or mutate their status.

## Permitted action links

The only accepted action candidate in this slice is navigation to the existing Service Catalog, because PC-01 currently accepts only `module.services_catalog`. An allowed link requires all of the following evidence references:

1. a PC-01 product/capability decision;
2. a current AUTH-01 authority decision for the exact permission and source scope;
3. an explicit domain owner and relative application route.

Every link has `current_authority_recheck_required = true`. The destination re-resolves its own context, Workspace and authority; the projection is never a bearer capability and performs no mutation. If the canonical Unit is stale, PC-01 is unavailable/inactive, or AUTH-01 denies `services.catalog.read`, PF-01 emits a fully withheld link with no guessed permission or route.

Action links do not merge state machines. AIRPROP owns lease/commercial actions, SERVICE owns request/order actions, Operations owns Work Orders, Finance owns posting/reversal, and Communications owns delivery. PF-01 only renders a permitted navigation decision.

## Security and implementation gate

- one source Workspace grant never becomes a tenant/building grant or access to another owner;
- current ownership, membership, context, entitlement and action permission are rechecked per source;
- private records are never disclosed to association administrators through this projection;
- expired/revoked relationships disappear from future actionable views but remain historical evidence;
- cursor contents are opaque and cannot be used as authority;
- a visible item never contains a withheld canonical reference.

The executable resolver is `customer_api.list_my_owner_portfolio_projections_v1(jsonb)`. Its optional version map only pins expected Unit versions for freshness evaluation; it cannot select an owner, relationship, Unit or Workspace. The production API always sends an empty map and lets DW-02 resolve the current canonical version. The function is `STABLE`, has no DML, caps the candidate set at 100 and exposes execution only to `authenticated`.

The bounded endpoint is `GET /api/owner-portfolio/v1/projection`. It authenticates the session, calls the single RPC, validates every returned `owner-portfolio-projection.v1` envelope and uses private/no-store caching. The existing Owner Dashboard displays the official projection in a visually and semantically separate section from self-reported leases and cash.

## Minimal acceptance boundary

The delivered path is: real owner account → current AUTH-01 native Workspace authority → canonical Unit from DW-02 → current ownership and property-management mandate → one projection per Workspace → official/private source separation → PC-01-backed navigation or a withheld link → zero writes and no cross-owner/cross-tenant disclosure.

FIN-01 and OPS-01 remain dependencies of the complete commercial PF-01 product. They do not block this read-only projection and no Finance or Operations engine is recreated here.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
