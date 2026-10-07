# ADR-CLD-032 — Multi-unit owner across buildings and workspaces

Status: **Approved product direction; implementation and role activation pending**  
Version: 1.0 — 2026-09-25  
Related: ADR-CLD-031 (primary workspace administrators)

## Decision

Add a customer persona `multi_unit_owner` for a person or company managing its
own units across one or more buildings. This is distinct from
`owner_portfolio_admin`, the primary administrator of an `OWNER_PORTFOLIO`
workspace. One account may hold both roles and additional independently granted
roles. `multi_unit_owner` does not administer a building, association or another
owner's units.

The owner's home screen is a personal portfolio, not a tenant-wide context. It
aggregates authorized unit views across separately selected customer workspaces;
each underlying operation runs against its source workspace with its own
membership, context grant, entitlement and ownership evidence. A unit appearing
in two contexts has one verified source identity and is displayed once, with
source-specific financial records retained separately. Switching workspaces
must never turn a unit grant into a building or tenant grant.

## Unit registration and connection

| State | Owner action | Source of truth |
| --- | --- | --- |
| Privately recorded | Add a building and unit to a personal inventory; record address and notes | Owner's isolated portfolio; no `portfolio.units` or association ledger mutation |
| Connection requested | Ask to connect a recorded unit to a CLADORA workspace | Pending claim, visible to that workspace's authorized administrator |
| Verified and linked | Administrator checks ownership/mandate and matches the canonical unit; owner accepts the link | Workspace `portfolio.units` and dated `portfolio.ownerships`; scoped membership/context |
| Disputed or ended | Suspend the link and stop future access; preserve dated history and evidence | Audit trail and time-bounded ownership |

Do not match by address or email alone. A user cannot create or edit a canonical
unit in another organization's workspace by entering a building name. If the
building does not use CLADORA, the privately recorded unit can still hold the
owner's own lease and payment records, clearly marked as self-reported; it has
no live charges or building-level information. A building using CLADORA may
provide charges/receipts only after the link is verified and the association's
disclosure policy permits that item.

## Role responsibilities

| Capability | Boundary |
| --- | --- |
| Unit portfolio | List owned units, occupancy and owner-managed tasks across buildings; limit every record to a verified linked unit or private inventory |
| Lease management | Track tenant, rent, deposit, start/end dates, renewals, signed documents and payment schedule for own units; protect tenant personal information |
| Rental cash flow | Record rent due and received, arrears and unit-level expenses; reconcile only payments for which the owner is the payee |
| Building charges | View charges, receipts and outstanding amounts attributed to own units when the source workspace grants access; record private payments separately |
| Taxes | Record tax-relevant amounts, expense categories and supporting documents; produce a reviewable export, not an automatically approved tax return |
| Notifications | Optional reminders for rent, lease expiry, charges and tax-related deadlines; no notification grants access to source documents |

Explicitly deny association accounting/close, other owners' balances, building
resident directory, governance administration, unrelated units, cross-tenant
financial approval and workspace provisioning. Tax rules and filing require a
country-specific reviewed module; amounts shown before that are bookkeeping
records, not tax advice or a declaration.

## Implementation order and activation gates

1. Create owner-isolated portfolio, private buildings/units and an auditable
   claim/link lifecycle. Enforce unique active links, dated ownership evidence,
   tenant/workspace isolation and revocation. No automatic unit creation in an
   existing workspace.
2. Seed `multi_unit_owner` with zero inherited permissions. Add explicit
   unit-scoped read permissions and a portfolio API that resolves each unit's
   source context independently. Confirm concurrent roles for one email.
3. Add self-managed lease, rent, expenses and documents with per-unit access,
   payer/payee separation, version history and private-versus-sourced labels.
4. Integrate association charges and payment status as authorized read models;
   keep workspace ledger authoritative and prevent duplicate posting.
5. Add country-specific tax calculation only after legal/accounting review and
   evidence-based tests; add optional reminders after consent controls.

Before enabling the new role, audit every current RPC that treats only
`owner`/`tenant_resident` as unit-limited: an unknown role must not fall into
an administrator `else` branch. Required tests cover two buildings in the same
workspace, two workspaces under one tenant, two unrelated tenants, one email
with multiple roles, disputed ownership, revoked membership, unknown building,
and private records that must never appear to an association administrator.

## Existing boundaries and limits

`portfolio.units` and `portfolio.ownerships` are tenant-bound;
`identity.context_grants` grants a single scope; `occupancy.leases` is likewise
tenant-bound. The existing `owner` dashboard is not a cross-workspace
portfolio. Marketing/demo mentions `portfolio_owner`, but that string is not a
production authorization role. The current database and UI must not claim this
feature is live until the gates above are implemented and tested.
