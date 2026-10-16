# CE included benefit and experience funding 03

Status: **design contract; implementation and activation not authorized**

Owner: Community & Experience, consuming canonical Core, Finance, SERVICE and
Operations contracts

Baseline: `main@e11cfda735f50a8969b8f6f791183db9047e2fa4`
(`tree bfa5b1228648a70fd54015b64b0487427811bad8`)

This document defines an included Community & Experience benefit as something
a Workspace funds for eligible members under its brand, membership programme
and budget. The member incurs no per-use charge when redeeming that exact
benefit. Internal cost, provider settlement, tax and budget consumption can
still be non-zero. This package defines no accounting treatment, tax rule,
price, migration, route or runtime activation.

## Boundary contract

### Community & Experience

CE owns the benefit identity and version, member-facing experience, programme
placement, eligibility policy reference, allowance/redemption lifecycle and CE
receipt. A CE redemption is permitted only after the server proves current
Workspace scope, membership, tier/program eligibility, funding validity,
expiry, quota and any required capacity. It does not create a charge to the
member.

### SERVICE

SERVICE owns independently published commercial Offerings, Requests, Quotes,
Orders, delivery acceptance and the per-use commercial/financial path. A zero
numeric price does not turn a SERVICE Offering into a CE benefit. An included
CE benefit does not become a SERVICE Offering merely because an external
provider fulfils it.

When an allowance is exhausted, the product may present a separately published
SERVICE Offering. The member must explicitly select and confirm that new path.
SERVICE then performs its own current authority, provider agreement,
eligibility, pricing, cancellation, acceptance and financial checks. CE cannot
create an Order, reuse a CE redemption as payment approval or silently convert
an attempted redemption into a charge.

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
| Benefit definition, allowance policy and redemption state | CE | Own exact versioned benefit and redemption lifecycle. |
| Capacity hold | Shared capacity owner/BK01 when capacity is allocated | Consume an exact hold/release receipt; do not build a CE capacity ledger. |
| SERVICE Offering, Request and Order | SERVICE | Store only an optional explicit fallback Offering reference/version. |
| Technical fulfilment | Maintenance/Operations | Reference canonical Work Order/evidence only when required. |
| Budget, journals, tax, currency and provider settlement | Finance/accounting and canonical agreement owners | Consume bounded funding/financial receipts; do not post or infer accounting entries. |
| Idempotency, audit and outbox | Shared infrastructure | Use the existing transaction envelope; no parallel ledgers. |

## Funding contract

Every published benefit has exactly one current, server-verified funding source
for its benefit revision. A client label, amount, price or locale is never proof
of funding. The closed vocabulary is:

```text
membership_bundled
service_charge_bundled
rent_bundled
owner_budget
workspace_budget
sponsor_funded
promotional_budget
```

The internal funding binding needs an opaque funding reference, positive source
version, validity interval, Workspace, benefit/version, budget or coverage
decision, provider code and `evaluated_at`. CE stores only the bounded evidence
needed for audit and replay. Contract terms, member tier details, sponsor
commercial terms, rent, service-charge composition and ledger accounts stay in
their canonical domains.

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
  separately accepted CE funding/entitlement contract. The SERVICE Offering
  remains independently identifiable and priced.
- Locale and translation select presentation only. They do not select funding,
  governing country, currency, tax, accounting treatment, tier or programme.

## Proposed contracts

The names in this section are design identifiers for owner review, not existing
runtime APIs.

### `ce-included-benefit.v1`

One immutable revision binds:

```text
workspace_id, benefit_id, benefit_version, capability_code,
public labels/description, programme reference/version,
funding_source, opaque funding reference/version,
allowance quantity/unit/window, expiry policy,
capacity policy reference/version | null,
service_fallback offering_id/revision_id | null,
status, valid_from, valid_until | null
```

The revision contains no member identity, price, tax result or ledger account.
Funding, programme and fallback references are evidence pointers, not authority.
Changing funding, allowance, expiry, capability or fallback creates a new
positive revision.

### `ce-benefit-entitlement-decision.v1`

A server-owned decision binds the current Context, Workspace, actor, opaque
membership subject, benefit/revision, current membership/tier/program versions,
authority revision, allowance window and evaluation time. Its public projection
is only `eligible`, `unavailable` or `withheld`, plus a safe expiry/remaining
allowance when disclosure policy permits. Tier code, membership ID, programme
rules and reason rows remain private.

Revoked membership, stale tier/program, wrong Workspace, expired programme,
ambiguous relationship, unavailable funding or missing authority fail closed.
A historical receipt never substitutes for a current decision.

### `ce-benefit-redemption-receipt.v1`

An accepted receipt binds receipt identity, Workspace, benefit/revision,
redemption identity/version, action, quantity/unit, allowance window,
funding-source classification, bounded result, capacity receipt reference when
used, idempotency binding and `evaluated_at`. It records `member_charge=none` as
a categorical result; it does not record a zero price.

The member-facing receipt omits membership/tier/program identifiers, eligibility
reason, private funding reference, provider agreement, budget balance, journal,
tax and other participants. Finance and audit consume purpose-limited internal
source references through their own authorization boundaries.

## Redemption lifecycle

Proposed CE states are `requested`, `reserved`, `fulfilled`, `released`,
`reversed`, `denied` and `unknown`. `denied` and `unknown` are outcomes rather
than proof of entitlement consumption. Cancellation of a CE redemption is not
SERVICE Order cancellation and is not Maintenance Work Order cancellation.

The command transaction order is:

1. Bind the current actor, Context and exact Workspace.
2. Recheck current action permission, module and Workspace entitlement.
3. Resolve current membership and exact tier/program eligibility.
4. Lock the exact CE benefit/revision and recheck lifecycle and expiry.
5. Validate the exact funding source/version and its current coverage.
6. Lock the member allowance window; verify positive requested quantity and
   exact expected redemption/allowance versions.
7. Acquire or validate an exact shared capacity hold when capacity applies.
8. Claim the shared idempotency key and compare the full input fingerprint.
9. Persist the CE redemption/version and immutable bounded CE receipt.
10. Append shared audit/outbox effects and finalize the idempotent response in
    the same transaction; commit.

Same-key/same-payload replay rechecks current disclosure authority and returns
the original result without new allowance, capacity, audit or outbox effects.
Changed payload conflicts. Revoked/stale/cross-Workspace/expired/unfunded
requests create zero domain and shared-ledger effects. A genuine unknown commit
uses receipt readback before any retry. Release/reversal uses exact prior receipt
and version; it never deletes history or manufactures allowance.

When the allowance is exhausted, CE returns a bounded `allowance_unavailable`
result. If an independently published SERVICE Offering reference is current and
safe to disclose, the UI may show it as a separate action. No SERVICE Request or
Order exists until the member explicitly starts and confirms that SERVICE flow.

## Parallel capability examples

| Capability | CE included path | SERVICE per-use path | Required separation |
| --- | --- | --- | --- |
| Breakfast | Breakfast covered by current membership/programme allowance | Individually ordered paid breakfast | Separate benefit and Offering revisions, funding, entitlement decisions, redemption/Order IDs and receipts. |
| Car wash | One Premium programme wash per quarter | On-demand paid car wash Offering | Private tier result is not displayed; quarterly allowance expiry does not create an Order. |
| Catering | Workspace event refreshments funded from an approved Workspace or sponsor budget | Custom catering request/quote/order | Event attendance is not delivery acceptance; sponsor funding is not SERVICE payment approval. |
| Industrial unloading | Included operational allowance for an eligible industrial programme | Paid unloading service for a specific request | Exact resource/capacity and allowance receipts remain distinct from SERVICE provider, Order and financial receipts. |

The same human-readable capability may exist in both domains, but CE and
SERVICE retain distinct Offering/benefit identity, funding source, entitlement,
state machine, cancellation policy, idempotency scope and receipt. A shared
capability code supports discovery only and cannot authorize or merge records.

## Accounting and audit boundary

`member_charge=none` answers only whether this redemption creates a per-use
member charge. It does not set consideration, fair value, tax, currency,
expense classification, sponsor recognition, settlement or invoice policy.
Finance/accounting derives those results from the canonical funding agreement,
budget and fulfilment evidence for the relevant jurisdiction and period.

CE records operational quantity and lifecycle, not journals. Provider payment,
internal cost allocation or reimbursement uses a Finance-owned receipt linked
to the exact CE redemption/version. Reversal follows the Finance correction
policy; CE never edits posted financial history. Locale, translated text and a
zero display amount cannot select a country, currency or accounting treatment.

Audit needs exact benefit/funding/programme versions, actor and Workspace,
quantity/unit, expiry window, decision/receipt identity, capacity and fulfilment
references, correlation/causation, idempotency and timestamps. Member-facing
read models redact private eligibility and funding evidence. Cross-Workspace
reads disclose neither existence nor counts.

## Repository inventory and gaps

| Existing capability | Reuse decision | Gap before implementation |
| --- | --- | --- |
| `platform.workspace_entitlements` and current module/permission evaluation | Reuse for Workspace product activation. | Workspace entitlement is not member/tier/program benefit eligibility. |
| `platform.entitlement_usage_ledger` and `enforce_entitlement_quota` | Preserve as canonical shared infrastructure; do not fork it. | Current rows are Workspace/key/delta based and do not bind benefit/member/program/window/version, reservation/release, capacity or a CE receipt. A Core-owned versioned consumption contract or compatible extension is required. |
| Shared `platform.idempotency_keys`, `audit.events` and outbox | Reuse atomically. | CE benefit command/provider composition and bounded receipt do not yet exist. |
| CE Event audience, interest and attendance | Reuse current audience/membership concepts where applicable. | Interest is not entitlement, capacity, admission or redemption. Attendance alone cannot consume or restore an allowance. |
| CE `service-experience-coordination-receipt.v1` | Keep for SERVICE experience coordination. | It is Order/component coordination, not included-benefit funding or redemption. Do not overload it. |
| SERVICE catalogue/Offering/Request contracts | Reuse for paid fallback only. | Needs an explicit, safe CE-to-SERVICE fallback reference/read projection; no automatic conversion. |
| Shared capacity contract design | Consume when runtime is accepted. | Confirmed implementation/transactional provider evidence is required before capacity-backed redemption. |
| Maintenance Work Orders and adapters | Consume only for genuine technical execution. | A purpose-limited fulfilment adapter is required; Work Order state cannot become CE redemption truth. |
| Finance receipts and canonical journals | Consume for cost/settlement evidence. | A purpose-limited CE redemption funding/settlement receipt contract is required; CE must not post money. |
| Current identity memberships | Reuse exact membership and revocation state. | Canonical current tier/program selector with versioned, privacy-bounded output is missing. |
| CE public UI | Keep inactive until contracts and runtime are accepted. | Terminology, safe remaining allowance and explicit SERVICE handoff require mounted RO/EN/FA acceptance. |

## Proposed execution packages

1. **CE benefit contract and static policy**: strict schemas for benefit/funding
   revisions, entitlement decision, redemption receipt and terminology. Reject
   price-derived inclusion, private fields and locale/accounting inference.
2. **Core membership/program eligibility provider**: current exact
   membership/tier/program/version decision inside the shared transaction host,
   with revoked/stale/cross-Workspace/withheld zero-write tests.
3. **Funding evidence providers**: purpose-limited decisions from the canonical
   membership, Billing, AIRPROP/Occupancy, budget or sponsor owner. Finance owns
   accounting consequences; CE consumes a bounded decision.
4. **Canonical allowance consumption extension**: extend or wrap the existing
   shared entitlement/quota infrastructure to bind benefit/member/program/window
   and reversible versioned consumption. Do not add a second entitlement truth
   or generic usage ledger.
5. **CE redemption persistence/provider**: CE-owned aggregate and receipt in the
   Core transaction host, using shared idempotency/audit/outbox and optional
   canonical capacity receipt.
6. **Fulfilment adapters**: separate SERVICE provider and Maintenance Work Order
   adapters only for actual fulfilment, without sharing state machines.
7. **SERVICE fallback read contract**: safe current Offering reference and
   explicit handoff after allowance denial. SERVICE owns all subsequent writes.
8. **Inactive route/UI package**: private read projection and RO/EN/FA mounted
   terminology tests. Activation requires separate authorization and production
   acceptance.

## Future acceptance matrix

| Area | Required scenarios | Expected result |
| --- | --- | --- |
| Funding vocabulary | All seven sources; absent/unknown source; expired or stale evidence | Exact accepted source or fail-closed zero-write denial. |
| Current eligibility | Active membership and programme; stale tier; revoked member; ambiguous/cross-Workspace relation | Only current exact decision can redeem; private tier/reason withheld. |
| Inclusion wording | Non-zero internal cost, zero/missing SERVICE price, sponsor label, translated labels | Included status comes only from CE contract; no `free` inference. |
| Quota and expiry | Fresh, boundary-time expiry, concurrent final unit, same-key replay, changed payload | At most one final unit; deterministic replay/conflict; complete audit. |
| Capacity | No-capacity benefit; held capacity; unavailable/revoked/expired hold; release | Shared receipt required when applicable; no CE capacity ledger. |
| Redemption recovery | Failure before commit, genuine `40001`, acknowledgement loss and unknown commit | Fresh transaction retry/readback; no duplicate allowance, receipt, audit or outbox. |
| Revocation | Membership, programme, funding or permission revoked before command/replay | Bounded denial and zero additional writes/effects. |
| Paid fallback | Allowance exhausted with/without safe current SERVICE Offering | No automatic Order; explicit handoff starts a separate SERVICE flow. |
| Dual-domain capability | Breakfast, car wash, catering and unloading exist in both paths | Separate identity, funding, entitlement, lifecycle, idempotency and receipts. |
| Maintenance fulfilment | Included experience needs a Work Order; Work Order completes/fails/reopens | Operations state remains canonical; CE fulfilment changes only through accepted adapter evidence. |
| Accounting | Budget/provider cost non-zero while member charge is none; reversal/correction | Finance-owned entries and receipts; CE stores no journal/tax inference. |
| Privacy | Member, manager, sponsor and cross-Workspace projections | No tier, membership ID, eligibility reason, budget balance, agreement, ledger code or unrelated participant leakage. |
| Locale | RO/EN/FA and locale changes with the same benefit/funding evidence | Wording changes only; country, currency and accounting treatment remain canonical and unchanged. |

## Activation boundary

This design does not prove a runtime membership/tier/program provider, funding
coverage, capacity implementation, accounting treatment, Remote database
installation, HTTP/AAL2 behavior or Production acceptance. Those states remain
**NOT_RUN_NOT_PASS**. No member-facing redemption or paid fallback may be
activated until each canonical dependency, atomic host-level test and privacy
projection has been accepted by its owner.
