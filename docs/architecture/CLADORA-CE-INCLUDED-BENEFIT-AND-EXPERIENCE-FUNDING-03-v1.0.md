# CLADORA CE Included Benefit and Experience Funding v1.0

Package: `CE-INCLUDED-BENEFIT-AND-EXPERIENCE-FUNDING-03`

Owner: Community & Experience

Status: proposed boundary contract; documentation only

Runtime status: unavailable until separately implemented and accepted

## 1. Decision

Community & Experience (CE) owns benefits and experiences a Workspace offers to strengthen brand,
community, membership value and a sense of belonging. Examples include welcome benefits,
breakfast or community meals, events, workshops, seasonal experiences, premium-member benefits,
sponsored activities and community recognition.

An included CE experience has a declared funding source and a current entitlement. The member pays
no per-use amount when redeeming it. This does not mean that the experience has no cost: budget,
allowance, capacity, quota, expiry, sponsor and provenance remain explicit and auditable.

SERVICE owns independently offered services that a member may request, book or purchase. When an
included allowance is exhausted, any paid continuation is a separate SERVICE Offering with its own
terms, price, explicit member consent and receipt. A guide, translated label, historical receipt or CE
presentation must never create that Offering or authority.

This document defines a future contract boundary. It creates no table, ledger, route, payment flow,
grant, provider, entitlement, accounting entry or runtime activation.

## 2. CE and SERVICE boundary contract

| Concern | CE included benefit | SERVICE Offering |
| --- | --- | --- |
| Purpose | Membership, community, brand or sponsored experience | Service a member can request, book or purchase |
| Member charge at use | No per-use member payment | Price or commercial terms may apply and require explicit consent |
| Eligibility authority | Current membership, tier or program entitlement | Current SERVICE eligibility and Offering rules |
| Funding | One explicit CE funding source | Offering price and financial terms owned by SERVICE/Finance contracts |
| Consumption | Budget, entitlement, quota and capacity consumption | Order quantity, booking, usage or contracted scope |
| Receipt | CE redemption receipt with funding and entitlement provenance | Separate SERVICE order and service receipt |
| Accounting | Delegated to canonical Finance policy | Delegated to canonical Finance policy |
| Historical evidence | Proves the past redemption only | Proves the past order/delivery only |
| Authority on replay | Current authority and entitlement must be rechecked | Current SERVICE authority and Offering validity must be rechecked |

One experience must not be ambiguously recorded as both CE and SERVICE. When both an included and a
paid version exist, they are two explicit Offerings:

1. the CE Offering declares an included funding source, entitlement rule, allowance and CE receipt;
2. the SERVICE Offering declares independent pricing, consent, order and SERVICE receipt;
3. the identifiers, idempotency domains, consumption records and accounting evidence are distinct;
4. a CE denial or exhausted allowance cannot silently fall through to the SERVICE Offering.

## 3. Funding source contract

Every included experience selects exactly one value from this closed set:

```text
membership_bundled
service_charge_bundled
rent_bundled
owner_budget
workspace_budget
sponsor_funded
promotional_budget
```

No `unknown`, inferred, inherited, default or client-supplied funding source is accepted. Changing the
funding source creates a new version of the experience terms and does not rewrite prior redemptions.

| Funding source | Economic source represented | Required provenance | Member-facing family |
| --- | --- | --- | --- |
| `membership_bundled` | Current membership package | Membership/program and version | Included with membership |
| `service_charge_bundled` | Approved Workspace service-charge package | Package, effective period and Workspace | Included in your Workspace benefits |
| `rent_bundled` | Current occupancy/rent package | Occupancy contract reference and version | Included in your Workspace benefits |
| `owner_budget` | Declared owner-funded allocation | Owner funding decision and budget version | Included in your Workspace benefits |
| `workspace_budget` | Approved Workspace allocation | Workspace budget decision and version | Included in your Workspace benefits |
| `sponsor_funded` | Identified sponsor commitment | Sponsor identity, agreement and funding version | Sponsored by {public sponsor name} |
| `promotional_budget` | Time-bounded promotional allocation | Promotion identity, campaign version and expiry | Complimentary promotional benefit |

The table describes provenance, not accounting treatment. Recognition, tax, invoicing, sponsor
disclosure and posting rules come only from the canonical Finance contract and applicable Country Pack.

## 4. Member-facing terminology policy

The default word **“free”** is prohibited. It hides who funds the experience and may misstate tax,
sponsor or membership terms. Member-facing copy uses one of these evidence-backed forms:

- **Included with membership**
- **Included in your Workspace benefits**
- **Sponsored by {public sponsor name}**
- **Complimentary promotional benefit**

The label must follow the verified funding source. It must not upgrade `promotional_budget` to a
membership promise, hide a sponsor that must be disclosed, or imply that a rent- or service-charge-
bundled benefit has no economic source. When the public sponsor name is unavailable or cannot be
disclosed, the benefit remains unavailable rather than displaying a guessed label.

Member-facing responses may show the experience, applicable label, remaining member allowance where
disclosure is permitted, capacity status, expiry and redemption outcome. They must not reveal:

- another member or another member's consumption;
- the actual individual cost or internal negotiated cost;
- a private membership tier, internal eligibility score or denial rule;
- private sponsor terms, budget totals or accounting treatment;
- cross-Workspace membership, participation or funding data.

## 5. Entitlement and authority

Eligibility comes only from a current, canonical membership, tier or program observation scoped to the
same Workspace and experience version. The redemption transaction rechecks:

- active Workspace and exact experience/version;
- current member relationship and action authority;
- current membership/tier/program entitlement and its source version;
- funding source and funding version;
- allowance and entitlement consumption;
- capacity and quota;
- effective interval and expiry;
- required sponsor/provenance evidence;
- replay fingerprint and prior outcome.

A Guide, content page, translation, notification, cached projection, client claim or historical receipt
is never an authority source. A historical receipt remains immutable evidence of a past outcome; it
cannot prove current eligibility. Revocation, expiry or a changed source version fails closed before a
new redemption.

## 6. Redemption lifecycle

The future redemption flow is ordered as follows:

1. Resolve the explicit Workspace and exact experience version.
2. Bind the authenticated actor to the member/party without accepting client-owned authority fields.
3. Read current membership, tier or program entitlement from its canonical owner.
4. Recheck the declared funding source, funding version, effective interval and required provenance.
5. Lock the scoped experience, entitlement/allowance, capacity and idempotency key in canonical order.
6. Recheck authority, quota, capacity, expiry and budget availability after the locks are held.
7. Commit entitlement consumption, budget consumption, capacity use, CE redemption receipt, audit and
   outbox atomically, or commit none of them.
8. Return a bounded redeemed, denied, conflict or readback-required result without private internals.

Exact replay with the same normalized command and idempotency key returns the original outcome without
consuming allowance, budget or capacity again. Changed replay is denied. An unknown commit is recovered
by readback with the original command and key; it must not be retried as a new redemption.

Denial before commit produces zero redemption, budget, entitlement, capacity, audit and outbox writes.
This document does not implement that transaction and does not designate a new persistence owner.

## 7. Exhausted allowance and SERVICE upsell

When allowance, quota, budget or capacity is exhausted, CE returns a bounded unavailable outcome. It
does not create a charge, payment intent, SERVICE order or implied consent.

An upsell is permitted only when an independently published SERVICE Offering is currently valid for
the same Workspace and member. The UI must present the SERVICE identity, scope, price and terms, then
obtain explicit consent through the SERVICE flow. The CE redemption key, receipt and entitlement are
not reused as the SERVICE order key, receipt or authority.

## 8. Accounting and audit boundary

| Owner | Canonical responsibility | Must not be inferred by CE |
| --- | --- | --- |
| Core/Identity | Current Workspace, membership, party and authority observations | Role or eligibility from labels/content |
| Community & Experience | Experience definition, funding declaration, entitlement consumption and redemption evidence | Payment, tax or general-ledger result |
| SERVICE | Independent paid/included service Offering, member consent, order and service receipt | CE allowance or sponsorship authority |
| Finance | Accounting classification, recognition, settlement and posted financial evidence | Funding label as a posting instruction |
| Country Pack | Applicable tax, sponsor disclosure and country-specific accounting policy | Country inferred from locale or language |
| Audit/Outbox | Canonical transaction evidence and event delivery | Parallel CE audit or outbox ledger |

Budget consumption is operational evidence. It is not itself a posted accounting entry. CE must retain
the canonical Finance reference when Finance later produces one, without calculating tax, currency,
rounding, liability or sponsor treatment locally.

Locale controls presentation only. It never chooses country, jurisdiction, tax treatment, currency,
sponsor disclosure or accounting policy. Missing, expired or unsupported Country Pack/Finance evidence
is a bounded denial for the affected financial decision and produces zero financial side effects.

## 9. Experience examples

The examples describe product boundaries, not active runtime inventory.

| Workspace context | CE included experience | Possible funding | Separate SERVICE path after allowance |
| --- | --- | --- | --- |
| Residential | Welcome breakfast, seasonal family event, resident workshop | `membership_bundled`, `workspace_budget`, `sponsor_funded` | Independently priced catering or additional meal Offering |
| Office | Community breakfast, skills workshop, team recognition event | `rent_bundled`, `workspace_budget`, `sponsor_funded` | Separately ordered catering, room or equipment service |
| Industrial | Shift meal, safety-community workshop, sponsored recognition | `service_charge_bundled`, `owner_budget`, `sponsor_funded` | Separately priced extra meals or operational support service |
| Retail | Merchant welcome kit, seasonal campaign, community showcase | `owner_budget`, `sponsor_funded`, `promotional_budget` | Independent promotional production or staffing Offering |
| Hospitality | Welcome benefit, hosted local experience, member event | `membership_bundled`, `owner_budget`, `promotional_budget` | Independent excursion, catering or premium service Offering |

Each example requires explicit Workspace configuration. No experience, funding source, entitlement,
sponsor or SERVICE upsell is mandatory across all Workspaces.

## 10. Funding and entitlement decision matrix

| Funding valid | Current entitlement | Allowance/budget | Capacity | Decision | Durable effect |
| --- | --- | --- | --- | --- | --- |
| Yes | Yes | Available | Available | Redeem | One atomic consumption and receipt |
| Yes | Yes | Exhausted | Any | Deny; optional separate SERVICE presentation | Zero CE write |
| Yes | Yes | Available | Full/unavailable | Deny or waitlist only under a separate accepted contract | Zero redemption write |
| Yes | Revoked/expired | Any | Any | Deny | Zero write |
| Missing/expired | Any | Any | Any | Deny | Zero write |
| Sponsor mismatch | Any | Any | Any | Deny without sponsor internals | Zero write |
| Exact replay | Rechecked | Original state | Original state | Return original result | Zero additional consumption |
| Changed replay | Any | Any | Any | Conflict/deny | Zero write |
| Commit outcome unknown | Rechecked for recovery | Readback | Readback | Readback required | No blind retry |

## 11. Future conformance matrix

Any implementation package must prove, with real provider and persistence evidence:

1. the seven funding values are closed, explicit and version-bound;
2. each funding source produces only its permitted member-facing terminology;
3. no default `free`, hidden sponsor or guessed funding label appears;
4. entitlement comes only from current membership/tier/program providers;
5. content, translation and historical receipts cannot grant authority;
6. allowance, budget, quota, capacity and expiry are checked after locks;
7. exact replay consumes nothing twice and changed replay is denied;
8. stale/revoked authority and cross-Workspace references fail with zero writes;
9. exhausted allowance cannot create a SERVICE order or payment intent;
10. an upsell requires a separate current SERVICE Offering and explicit consent;
11. the same experience cannot share ambiguous CE/SERVICE identities or receipts;
12. member responses do not expose peers, private tier, individual cost or internal eligibility;
13. locale cannot choose country or financial policy;
14. tax, sponsor disclosure and accounting use exact canonical Country Pack/Finance evidence;
15. commit, rollback, concurrency and unknown-commit recovery are proven in disposable persistence;
16. API and browser tests distinguish included redemption from the separate SERVICE purchase path.

Contract tests, documentation review or green CI alone do not constitute runtime, financial or Release
acceptance.
