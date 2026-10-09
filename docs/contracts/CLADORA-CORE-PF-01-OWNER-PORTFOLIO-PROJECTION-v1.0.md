# CLADORA Core PF-01 owner portfolio projection v1.0

**Baseline:** `feat/core-pc-01-typed-rights@599ff8d09631413c94a06c394e9ac55f8e147e26`

**Owner:** Core Portfolio owns the privacy-bounded projection envelope. AIRPROP, SERVICE, Operations, Finance and Communications retain ownership of their records and commands.

**Delivery boundary:** additive TypeScript contracts and static verification only. No migration, endpoint, remote database operation, parallel ledger, central manifest rewrite or Production effect.

## Existing sources reused

PF-01 projects the existing `public.owner_private_units`, `public.owner_private_leases`, `public.owner_private_cash_entries`, `platform.owner_unit_links`, `portfolio.units`, `portfolio.ownerships`, `billing.invoices` and `billing.receivables`. It preserves the current owner portfolio pilot/invitation lifecycle and Workspace-native authority.

The projection creates no second owner identity, party registry, resource registry, ownership ledger, lease lifecycle, financial ledger, role, permission, audit, outbox or idempotency source.

## `owner-portfolio-projection.v1`

The request pins the personal portfolio context and Workspace, exact `as_of`, permission, cursor and bounded page size. The server derives the owner subject and evaluates each source Workspace independently. The personal portfolio is not tenant-wide authority and is not a building Workspace.

An available projection contains private or canonical resource items. A private record may remain `private_only` or `requested` without pretending to be a canonical unit. A `verified` private link requires both a disclosed `canonical-resource-reference.v1` and a matching `resource-relationship.v1`. Revocation removes future linked access without rewriting the private record or historical attribution.

A canonical item pins its source Workspace/context and must match the resource type/id and Workspace in its relationship snapshot. `not_found` and `withheld` canonical references cannot appear inside a visible item. An entirely withheld projection returns no Workspace, owner, resource, balance or cursor identifiers.

## Source separation and balances

Every record declares one source class:

- `private_owner_record` is self-reported and isolated to the owner.
- `official_workspace_record` is read from the authoritative source Workspace.
- `domain_owned_record` remains owned by its domain and is only summarized through an accepted adapter.

`owner-portfolio-balance.v1` distinguishes `recorded` from `unavailable`; a recorded amount is always present, so decimal zero is never confused with missing data. Private cash requires a private source. Official charges require an official Workspace source. A projected amount never posts, reverses or reconciles a journal, invoice, receivable or payment and always states `action_authorization = not_evaluated`.

Private lease and cash records never become official Workspace books. Official charges remain sourced from `billing.invoices` and `billing.receivables`; the projection cannot copy them into the private ledger or mutate their status.

## Permitted action links

An allowed action link requires all of the following evidence references:

1. a PC-01 product/capability decision;
2. a current AUTH-01 authority decision for the exact permission and source scope;
3. an explicit domain owner and relative application route.

Every link has `current_authority_recheck_required = true`. The destination command must re-resolve current authority and its domain prerequisites; the projection is never a bearer capability. An unavailable action exposes no route and carries reason codes. A withheld action exposes no action code, domain, route, permission or decision references.

Action links do not merge state machines. AIRPROP owns lease/commercial actions, SERVICE owns request/order actions, Operations owns Work Orders, Finance owns posting/reversal, and Communications owns delivery. PF-01 only renders a permitted navigation decision.

## Security and implementation gate

- one source Workspace grant never becomes a tenant/building grant or access to another owner;
- current ownership, membership, context, entitlement and action permission are rechecked per source;
- private records are never disclosed to association administrators through this projection;
- expired/revoked relationships disappear from future actionable views but remain historical evidence;
- cursor contents are opaque and cannot be used as authority;
- a visible item never contains a withheld canonical reference.

This contract slice does not add an executable resolver because combining the current private and official readers requires an accepted AUTH-01 decision mapping and consumer review. A future resolver must prove two-tenant isolation, multi-Workspace deduplication, revoked access, missing-versus-zero, source parity and zero-write denial in disposable database tests.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
