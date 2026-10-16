# CE included benefit and experience funding 03

Status: **design contract; implementation and activation not authorized**

Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**

CE scope: placement, presentation, experience orchestration and purpose-limited
references to owner-issued decisions

Baseline: `main@e11cfda735f50a8969b8f6f791183db9047e2fa4`
(`tree bfa5b1228648a70fd54015b64b0487427811bad8`)

This document defines the candidate boundary for an included benefit surfaced
through Community & Experience: a Workspace presents an experience funded for
eligible members under its brand, membership programme and budget. The member
incurs no per-use charge when using that exact benefit. Internal cost, provider
settlement, tax and budget consumption can still be non-zero. Ownership of the
benefit definition, allowance persistence and redemption receipt remains an
open Benefits/Commerce/Loyalty product decision. This package defines no
accounting treatment, tax rule, price, migration, route or runtime activation.

## Boundary contract

### Community & Experience

CE owns local placement and presentation, the member-facing experience
orchestration and purpose-limited references to decisions issued by canonical
owners. CE does not currently own the benefit identity/definition, programme,
member allowance, redemption aggregate or redemption receipt. Those artifacts
remain candidate contracts until `OPEN_PRODUCT_DECISION` is resolved.

An included-benefit action is permitted only after the server proves current
Workspace scope, membership, tier/program eligibility, funding coverage,
expiry, quota and any required capacity through owner-issued decisions. CE may
display and orchestrate that result, but cannot mint it or create a charge to
the member.

### SERVICE

SERVICE owns independently published commercial Offerings, Requests, Quotes,
Orders, delivery acceptance and the per-use commercial/financial path. A zero
numeric price does not turn a SERVICE Offering into an included benefit. A
benefit surfaced by CE does not become a SERVICE Offering merely because an
external provider fulfils it.

When an allowance is exhausted, CE may present a separately published SERVICE
Offering through a purpose-limited safe reference. The member must explicitly
select and confirm that new path. SERVICE then performs its own current
authority, provider agreement, eligibility, pricing, cancellation, acceptance
and financial checks. CE cannot create an Order, reuse a candidate redemption
as payment approval or silently convert an attempted use into a charge.

### Maintenance and Operations

Maintenance owns technical asset, plan, Work Order, dispatch, completion and
operational evidence. CE may request or reference technical fulfilment through
an approved adapter, while Maintenance remains the canonical writer. Work
Order completion does not prove member redemption, SERVICE acceptance,
provider settlement or accounting recognition. Routine corrective or statutory
maintenance is not reclassified as a member benefit merely because the member
does not receive an invoice.

### Shared ownership

| Fact | Canonical owner | CE use |
| --- | --- | --- |
| Actor, membership, Workspace and current authority | Core/Identity | Consume exact current decision; never copy membership or permission truth. |
| Tier/program membership and effective version | Canonical membership/program owner; contract still required | Consume a bounded eligibility decision. CE must not infer a tier from role, rent, language or past redemption. |
| Workspace product/module entitlement | Core platform composition | Consume current entitlement; capability availability is separate from action permission. |
| Benefit definition, allowance persistence and redemption receipt | `OPEN_PRODUCT_DECISION` — Benefits/Commerce/Loyalty | Candidate contracts only. CE may retain purpose-limited references after an owner is selected. |
| Capacity hold | Shared capacity owner/BK01 when capacity is allocated | Consume an exact hold/release receipt; do not build a CE capacity ledger. |
| SERVICE Offering, Request and Order | SERVICE | Store only an optional explicit fallback Offering reference/version. |
| Technical fulfilment | Maintenance/Operations | Reference canonical Work Order/evidence only when required. |
| Budget, journals, tax, currency and provider settlement | Finance/accounting and canonical agreement owners | Consume bounded funding/financial receipts; do not post or infer accounting entries. |
| Idempotency, audit and outbox | Shared infrastructure | Use the existing transaction envelope; no parallel ledgers. |

## Funding contract

Every published candidate benefit must receive exactly one current
`funding_coverage_decision`, server-verified for its exact revision and local
placement. A client label, amount, price or locale is never proof of funding.
The decision exposes one bounded member-facing funding classification from this
closed vocabulary:

```text
membership_bundled
service_charge_bundled
rent_bundled
owner_budget
workspace_budget
sponsor_funded
promotional_budget
```

The internal funding binding needs a decision identity, positive decision and
source versions, validity interval, Workspace, benefit/version, local placement
and `evaluated_at`. Fulfilment is an independent concern and does not appear in
this funding binding. Finance may combine several budgets, agreements or
accounting sources behind its boundary to issue one current coverage decision;
the decision does not expose or collapse those sources into CE. Contract terms,
member tier details, sponsor commercial terms, rent, service-charge composition
and ledger accounts stay in their canonical domains.

### Funding and entitlement matrix

| Funding source | Canonical proof before publication/redemption | Eligible member basis | Safe member-facing wording | Accounting boundary |
| --- | --- | --- | --- | --- |
| `membership_bundled` | Current membership programme and funded benefit revision | Current membership plus exact tier/program decision | **Included with membership** | Programme owner funds the benefit; Finance owns expense, settlement and tax. |
| `service_charge_bundled` | Current service-charge coverage decision for the exact Workspace/benefit period | Current member relationship covered by the programme; no charge detail disclosure | **Included in your workspace benefits** or an owner-approved equivalent | Billing/Finance owns charge composition and accounting. CE cannot claim the member has paid a specific amount. |
| `rent_bundled` | Current agreement/occupancy coverage decision, purpose-limited to benefit eligibility | Current eligible membership derived through the canonical relationship provider | **Included with your occupancy benefits** | AIRPROP/Occupancy owns agreement facts; Finance owns accounting. Rent amount and terms remain private. |
| `owner_budget` | Current approved owner-funded allocation for the exact Workspace and benefit revision | Current programme eligibility | **Provided by your property team** | Finance owns the budget source and posting; CE exposes no owner account or mandate details. |
| `workspace_budget` | Current approved Workspace allocation and effective period | Current programme eligibility | **Included for members of this workspace** | Governance/Finance owns approval and posting. CE does not treat budget approval as member authority. |
| `sponsor_funded` | Current sponsor agreement and funded allocation; public sponsor label separately approved | Current programme eligibility and any disclosed sponsor conditions | **Sponsored by _public sponsor label_** | Agreement/Finance owners retain terms and settlement. Internal sponsor identity is withheld unless approved for display. |
| `promotional_budget` | Current promotion/programme revision and funded allocation | Current programme audience and expiry | **Included as a limited-time benefit** | Programme/Finance owners retain campaign cost and posting. Promotion does not bypass quota or capacity. |

Funding and entitlement are independent gates. A valid budget cannot grant
membership, and an eligible member cannot redeem an unfunded, expired or
suspended benefit. Provider fulfilment is also independent: a provider agreement
does not create a member entitlement.

## Benefit Network boundary

A Benefit Network is a candidate multi-Workspace distribution contract, not a
Workspace, tenant, authority source, membership programme or shared allowance.
It binds a stable `network_id` and positive `network_version` to an ordered set
of participating Workspace references. Each participation has its own positive
version, validity interval, local placement reference and status.

Network presence never grants access. Before CE displays or orchestrates a
network benefit, the canonical owner must issue a current local eligibility
decision for the actor, exact Context, participating Workspace, network/version,
benefit/version and local placement. Each participating Workspace retains its
own funding coverage, audience, permission, expiry and purpose. A network-level
label or sponsor does not override any of those local gates.

Cross-tenant authority is forbidden. A network may name participating
Workspaces from several tenants only as separately authorized opaque
references; no membership, role, tier, programme eligibility, allowance,
capacity, budget or receipt crosses a tenant boundary. Evaluation occurs under
the selected local Workspace and current local authority. A denial in one
Workspace discloses no existence, participation, member, quota or budget data
from another. Network/version changes do not rewrite prior local placements or
historical owner-issued receipts.

CE owns the local placement and safe presentation of an accepted network
reference. The final Benefits/Commerce/Loyalty owner must own or nominate the
canonical network definition, participation and eligibility decisions.

## Architecture reconciliation

This boundary follows `CLADORA-CE-PHASE-0-EXECUTION-MATRIX-v1.2`: CE-CL-01 and
CE-F04 keep Benefits/Commerce/Loyalty ownership open and limit CE to placement,
audience context, presentation and experience orchestration. CE-010/011/012
remain independently activatable and do not become benefit, commerce or loyalty
stores through this design.

It also follows `CLADORA-DYNAMIC-WORKSPACE-PRODUCT-COMPOSITION-RECONCILIATION-v1.1`
and `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-v1.0`: shared identity, Workspace,
authority, product/module entitlement, capacity, finance and infrastructure
remain canonical; product domains keep independent state and receipts. The
composition statement that CE can present multi-Workspace benefits permits
administration and local placement only. It does not grant cross-Workspace or
cross-tenant authority and does not settle the open Benefits/Commerce/Loyalty
owner decision.

The transaction sequence below follows `CLADORA-CORE-TRANSACTION-HOST-v1.0`
and the live `postgres-transaction-host-v1.ts`: Core owns its transaction,
idempotency advisory lock and row lookup, canonical authority, retries,
audit/outbox and readback. This document does not authorize a CE variant.

## Terminology policy

The member-facing contract describes whether a per-use charge will be created;
it does not make a claim about economic cost.

### Approved meanings

- **Included with membership**: the current membership/tier/program decision
  covers this redemption and no member per-use charge is created.
- **Included in your workspace benefits**: a current Workspace programme funds
  the redemption without exposing the member's private funding basis.
- **Included with your occupancy benefits**: a canonical relationship decision
  establishes coverage; the UI does not expose rent or agreement terms.
- **Sponsored by _label_**: the sponsor has an approved public label and the
  current sponsor funding decision covers the benefit revision.
- **Limited-time included benefit**: promotional funding and entitlement are
  current until the displayed expiry.
- **Allowance used** or **Allowance unavailable**: the current included path is
  exhausted or unavailable. This wording does not imply a paid alternative.

### Prohibited meanings

- Do not derive **free**, **complimentary** or **included** from `amount = 0`, a
  missing price, a waived invoice, a discount, a test value or absence of a
  payment row.
- Do not describe budget-funded fulfilment as costless. The member charge and
  the Workspace/provider cost are separate facts.
- Do not expose private tier names, eligibility reasons, rent/service-charge
  terms, remaining group budget, sponsor contract details or accounting codes.
- Do not label a SERVICE Offering as included unless it participates through a
  separately accepted owner-issued funding/entitlement contract. The SERVICE
  Offering remains independently identifiable and priced.
- Locale and translation select presentation only. They do not select funding,
  governing country, currency, tax, accounting treatment, tier or programme.

## Candidate contracts pending product ownership

The names in this section are owner-neutral candidate identifiers, not existing
runtime APIs. They do not assign Benefits, Commerce or Loyalty ownership to CE.
Their final names, schemas and owner remain blocked on `OPEN_PRODUCT_DECISION`.

### `candidate-included-benefit-definition.v1`

One immutable revision binds:

```text
workspace_id, local_placement_id/version,
network_id/version | null, benefit_id, benefit_version, capability_code,
public labels/description, programme reference/version,
funding_coverage_decision_id/version, funding classification,
allowance quantity/unit/window, expiry policy,
capacity policy reference/version | null,
service_fallback offering_id/revision_id | null,
status, valid_from, valid_until | null
```

The candidate revision contains no member identity, price, tax result or ledger
account. Funding, network, programme and fallback references are evidence
pointers, not authority. Changing funding coverage, network participation,
allowance, expiry, capability or fallback creates a new positive revision.
CE consumes only the accepted local placement and bounded presentation fields.

### `candidate-benefit-entitlement-decision.v1`

A canonical owner-issued decision binds the current Context, Workspace, actor,
opaque membership subject, local placement, optional Benefit Network/version,
benefit/revision, current membership/tier/program versions, authority revision,
allowance window and evaluation time. Its public projection is only `eligible`,
`unavailable` or `withheld`, plus a safe expiry/remaining allowance when
disclosure policy permits. Tier code, membership ID, programme rules and reason
rows remain private.

Revoked membership, stale tier/program, wrong Workspace, expired programme,
ambiguous relationship, unavailable funding or missing authority fail closed.
A historical receipt never substitutes for a current decision. Network
participation cannot widen the local Workspace or tenant decision.

### `candidate-member-allowance-persistence.v1`

The selected product owner needs versioned, auditable member allowance state
bound to the exact member subject, benefit/revision, programme/version,
Workspace, allowance window, quantity/unit and expiry. Reservation,
consumption, release and reversal advance positive versions and retain history.
This candidate must not use or extend `platform.entitlement_usage_ledger`, which
remains limited to product/module entitlement and Workspace-level limits.

The product decision must choose the canonical store and writer. CE receives a
purpose-limited current decision or receipt and does not persist an allowance
copy, usage ledger or balance cache.

### `candidate-benefit-redemption-receipt.v1`

The candidate domain receipt semantics bind receipt identity, Workspace, local
placement, optional Benefit Network/version, benefit/revision, redemption
identity/version, action, quantity/unit, allowance window, funding-coverage
decision identity/version and bounded classification, capacity receipt reference
when used, Core idempotency binding and `evaluated_at`. The selected product
owner supplies this bounded domain result through the Core host; the host owns
the canonical transaction receipt envelope and persistence. The result records
`member_charge=none` as a categorical value; it does not record a zero price.

The member-facing projection omits membership/tier/program identifiers,
eligibility reason, private funding reference, provider agreement, budget
balance, journal, tax and other participants. Finance and audit consume
purpose-limited internal source references through their own authorization
boundaries. CE may present this projection but does not issue or relabel the
receipt.

## Redemption lifecycle

Candidate persisted states are `requested`, `reserved`, `fulfilled`, `released`
and `reversed`. `denied` and `unknown` are command outcomes only and must never
be persisted as aggregate states or treated as allowance consumption.
Cancellation of a candidate redemption is not SERVICE Order cancellation and is
not Maintenance Work Order cancellation.

The canonical Core transaction host owns transaction/session control,
serializable retry, lock ordering, authority, idempotency, audit/outbox and
unknown-commit handling. A future benefit provider supplies only read-phase
validation and owner-approved mutation callbacks. CE must not create a benefit
ledger, idempotency table, authority evaluator or transaction envelope.

The host order is:

1. Begin one serializable attempt and set the bounded transaction-local session.
2. Acquire the Workspace-scoped idempotency advisory lock.
3. Lock the active Workspace row and derive its tenant.
4. Acquire the aggregate advisory lock and then sorted unique provider-source
   advisory locks.
5. Resolve and bind current Core authority, then independently verify the actor
   and canonical Workspace permission/module on the same connection.
6. Compute the complete command hash and lock/read the existing idempotency row.
   Exact replay is validated here; changed payload or binding conflicts before
   any provider mutation.
7. In the read phase, invoke owner-approved providers for local benefit and
   network participation, current local membership/tier/program eligibility,
   the exact `funding_coverage_decision`, member allowance/version and any
   required shared capacity receipt. Every denial is zero-write.
8. Only after all read gates pass, the host stages its idempotency row and enters
   mutation phase. The selected product owner atomically advances its candidate
   redemption and allowance state; CE does not perform this mutation.
9. The host appends the canonical audit and outbox effects, builds the immutable
   Core receipt binding the owner mutation and provider evidence, stores that
   receipt in the idempotency response and commits the whole effect set.

Same-key/same-payload replay obtains a fresh host-owned authority decision and,
when required, owner current-state validation before returning the original
receipt without new allowance, capacity, audit or outbox effects. Changed
payload conflicts. Revoked/stale/cross-Workspace/expired/unfunded requests leave
zero persisted command/domain/ledger effects. Core alone retries a genuine
`40001` in a fresh transaction. A lost commit acknowledgement returns
`unknown_commit/READBACK_REQUIRED`; it is read back before any new attempt.
Release/reversal uses the exact prior receipt and version; it never deletes
history or manufactures allowance.

When the allowance is exhausted, the selected product owner returns a bounded
`allowance_unavailable` outcome. If an independently published SERVICE Offering
reference is current and safe to disclose, CE may show it as a separate action.
No SERVICE Request or Order exists until the member explicitly starts and
confirms that SERVICE flow.

## Parallel capability examples

| Capability | Included-benefit path surfaced by CE | SERVICE per-use path | Required separation |
| --- | --- | --- | --- |
| Breakfast | Breakfast covered by current membership/programme allowance | Individually ordered paid breakfast | Separate benefit and Offering revisions, funding, entitlement decisions, redemption/Order IDs and receipts. |
| Car wash | One Premium programme wash per quarter | On-demand paid car wash Offering | Private tier result is not displayed; quarterly allowance expiry does not create an Order. |
| Catering | Workspace event refreshments funded from an approved Workspace or sponsor budget | Custom catering request/quote/order | Event attendance is not delivery acceptance; sponsor funding is not SERVICE payment approval. |
| Industrial unloading | Included operational allowance for an eligible industrial programme | Paid unloading service for a specific request | Exact resource/capacity and allowance receipts remain distinct from SERVICE provider, Order and financial receipts. |

The same human-readable capability may exist in both domains, but the selected
Benefits/Commerce/Loyalty owner and SERVICE retain distinct Offering/benefit
identity, funding coverage, entitlement, state machine, cancellation policy,
idempotency binding and receipt. CE holds purpose-limited placement and
orchestration references only. A shared capability code supports discovery and
presentation only and cannot authorize or merge records.

## Accounting and audit boundary

`member_charge=none` answers only whether this redemption creates a per-use
member charge. It does not set consideration, fair value, tax, currency,
expense classification, sponsor recognition, settlement or invoice policy.
Finance/accounting derives those results from the canonical funding agreement,
budget and fulfilment evidence for the relevant jurisdiction and period.

The selected product owner records candidate operational quantity and lifecycle,
not journals. CE references the bounded result for presentation/orchestration.
Provider payment, internal cost allocation or reimbursement uses a Finance-owned
receipt linked to the exact owner-issued redemption/version. Reversal follows
the Finance correction policy; CE never edits benefit or posted financial
history. Locale, translated text and a zero display amount cannot select a
country, currency or accounting treatment.

Audit needs exact benefit/funding/programme versions, actor and Workspace,
quantity/unit, expiry window, decision/receipt identity, capacity and fulfilment
references, correlation/causation, idempotency and timestamps. Member-facing
read models redact private eligibility and funding evidence. Cross-Workspace
reads disclose neither existence nor counts.

## Repository inventory and gaps

| Existing capability | Reuse decision | Gap before implementation |
| --- | --- | --- |
| `platform.workspace_entitlements` and current module/permission evaluation | Reuse for Workspace product activation. | Workspace entitlement is not member/tier/program benefit eligibility. |
| `platform.entitlement_usage_ledger` and `enforce_entitlement_quota` | Keep limited to platform product/module entitlements and Workspace-level limits. | It must not store or calculate member allowance, benefit redemption, network participation or a redemption receipt. The selected product owner needs separate candidate allowance persistence after ownership review. |
| Shared `platform.idempotency_keys`, `audit.events` and outbox | Reuse only through the canonical Core transaction host. | The future product owner supplies domain callbacks; CE must not implement another transaction/idempotency/receipt envelope. |
| CE Event audience, interest and attendance | Reuse current audience/membership concepts where applicable. | Interest is not entitlement, capacity, admission or redemption. Attendance alone cannot consume or restore an allowance. |
| CE `service-experience-coordination-receipt.v1` | Keep for SERVICE experience coordination. | It is Order/component coordination, not included-benefit funding or redemption. Do not overload it. |
| SERVICE catalogue/Offering/Request contracts | Reuse for paid fallback only. | Needs an explicit, safe CE-to-SERVICE fallback reference/read projection; no automatic conversion. |
| Shared capacity contract design | Consume when runtime is accepted. | Confirmed implementation/transactional provider evidence is required before capacity-backed redemption. |
| Maintenance Work Orders and adapters | Consume only for genuine technical execution. | A purpose-limited fulfilment adapter is required; Work Order state cannot become candidate redemption truth. |
| Finance receipts and canonical journals | Consume for cost/settlement evidence. | A purpose-limited owner-issued redemption funding/settlement receipt contract is required; CE must not post money. |
| Current identity memberships | Reuse exact membership and revocation state. | Canonical current tier/program selector with versioned, privacy-bounded output is missing. |
| Benefit Network | No canonical network/participation/eligibility contract was found. | Owner decision, positive network/participation versions, local placement and current local eligibility are required; cross-tenant authority is forbidden. |
| CE public UI | Keep inactive until contracts and runtime are accepted. | CE owns placement/presentation/orchestration only; terminology, safe remaining allowance and explicit SERVICE handoff require mounted RO/EN/FA acceptance. |

## Proposed execution packages

1. **Benefits/Commerce/Loyalty ownership decision**: select the canonical owner
   for definition, network participation, member allowance, redemption state and
   receipt. Until then every schema remains a candidate and CE remains a
   placement/presentation/orchestration consumer.
2. **Owner-neutral candidate contract and static policy**: strict schemas for
   benefit/network definition, funding-coverage decision, entitlement decision,
   allowance persistence, redemption receipt and terminology. Reject
   price-derived inclusion, private fields and locale/accounting inference.
3. **Core membership/program eligibility provider**: current exact
   membership/tier/program/version decision inside the shared transaction host,
   with revoked/stale/cross-Workspace/withheld zero-write tests.
4. **Funding coverage providers**: purpose-limited decisions from the canonical
   membership, Billing, AIRPROP/Occupancy, budget or sponsor owner. Finance may
   resolve multiple sources behind one decision and owns accounting consequences;
   CE consumes only its bounded classification/presentation.
5. **Owner-selected member allowance persistence**: add a versioned candidate
   store and writer under the chosen product owner. Keep it separate from
   `platform.entitlement_usage_ledger`; do not create a CE allowance ledger.
6. **Owner-selected redemption provider**: run the chosen owner's aggregate and
   receipt callbacks inside the existing Core host, using host-owned authority,
   idempotency, retry, audit/outbox and optional canonical capacity receipt.
7. **Benefit Network provider**: versioned network and local participation with
   current per-Workspace eligibility, privacy-bounded output and no cross-tenant
   authority or shared member balance.
8. **Fulfilment adapters**: separate SERVICE provider and Maintenance Work Order
   adapters only for actual fulfilment, without sharing state machines.
9. **SERVICE fallback read contract**: safe current Offering reference and
   explicit handoff after allowance denial. SERVICE owns all subsequent writes.
10. **Inactive CE placement/UI package**: private read projection, local/network
    placement, orchestration and RO/EN/FA mounted terminology tests. Activation
    requires separate authorization and production acceptance.

## Future acceptance matrix

| Area | Required scenarios | Expected result |
| --- | --- | --- |
| Funding vocabulary | All seven classifications; absent/unknown classification; expired or stale evidence | One current coverage decision with a bounded classification, or fail-closed zero-write denial. |
| Current eligibility | Active membership and programme; stale tier; revoked member; ambiguous/cross-Workspace relation | Only current exact decision can redeem; private tier/reason withheld. |
| Inclusion wording | Non-zero internal cost, zero/missing SERVICE price, sponsor label, translated labels | Included status comes only from an owner-issued current decision; no `free` inference. |
| Quota and expiry | Fresh, boundary-time expiry, concurrent final unit, same-key replay, changed payload | At most one final unit; deterministic replay/conflict; complete audit. |
| Capacity | No-capacity benefit; held capacity; unavailable/revoked/expired hold; release | Shared receipt required when applicable; no CE capacity ledger. |
| Redemption recovery | Failure before commit, genuine `40001`, acknowledgement loss and unknown commit | Fresh transaction retry/readback; no duplicate allowance, receipt, audit or outbox. |
| Revocation | Membership, programme, funding or permission revoked before command/replay | Bounded denial and zero additional writes/effects. |
| Paid fallback | Allowance exhausted with/without safe current SERVICE Offering | No automatic Order; explicit handoff starts a separate SERVICE flow. |
| Benefit Network | Same-tenant and multi-tenant participants; stale network/participation; local revoke; actor eligible elsewhere | Exact local placement and eligibility required; no cross-Workspace or cross-tenant authority, balance or disclosure. |
| Dual-domain capability | Breakfast, car wash, catering and unloading exist in both paths | Separate identity, funding, entitlement, lifecycle, idempotency and receipts. |
| Maintenance fulfilment | Included experience needs a Work Order; Work Order completes/fails/reopens | Operations state remains canonical; CE presentation/orchestration changes only through accepted adapter evidence. |
| Accounting | Budget/provider cost non-zero while member charge is none; reversal/correction | Finance-owned entries and receipts; CE stores no journal/tax inference. |
| Privacy | Member, manager, sponsor and cross-Workspace projections | No tier, membership ID, eligibility reason, budget balance, agreement, ledger code or unrelated participant leakage. |
| Locale | RO/EN/FA and locale changes with the same benefit/funding evidence | Wording changes only; country, currency and accounting treatment remain canonical and unchanged. |

## Activation boundary

This design does not resolve `OPEN_PRODUCT_DECISION` or prove a runtime
membership/tier/program provider, Benefit Network, funding coverage, member
allowance store, redemption issuer, capacity implementation, accounting
treatment, Remote database installation, HTTP/AAL2 behavior or Production
acceptance. Those states remain **NOT_RUN_NOT_PASS**. No member-facing
redemption or paid fallback may be activated until the product owner and every
canonical dependency, atomic host-level test and privacy projection have been
accepted by their owners.
