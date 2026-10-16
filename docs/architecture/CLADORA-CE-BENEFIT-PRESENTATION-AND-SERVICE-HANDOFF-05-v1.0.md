# CE benefit presentation and SERVICE handoff 05

Status: **presentation contract and static evidence; implementation and activation not authorized**

Baseline: `main@536a9526222a36a1fd5d28e4267ca4b2d783786c`
(`tree 83947ebd1278b5c3af65fb1e43a07a1f8e30a21d`)

Ownership dependency: `CLADORA-DYNAMIC-WORKSPACE-PRODUCT-COMPOSITION-RECONCILIATION-v1.1.md`, as reconciled by merged PR #454. This package consumes its current `OPEN_PRODUCT_DECISION` status and bounded CE domain row without restating or changing that ownership contract. It does not create a benefit engine, choose a product owner, persist an allowance, redeem a benefit, create a SERVICE transaction or activate an editor or command.

## Findings

The live baseline has no active included-benefit projection in CE. The public
and authenticated Community, Event and Guide surfaces contain no approved
positive benefit phrase and consume no benefit outcome. The public SERVICE page
already describes the only present handoff correctly in Romanian, English and
Persian: an included CE experience remains separate, and an exhausted allowance
can lead only to an independently selected SERVICE Offering with a new identity,
price, terms, explicit consent and receipt.

The authenticated SERVICE catalogue displays published SERVICE Offerings and
creates a Request only through its own explicit member interaction. It is not a
CE benefit renderer. Its `Tax included` copy describes tax presentation and is
not evidence of benefit coverage. Dictionary fields named `included` are
internal product-plan flags, not member-benefit outcomes.

No public copy correction is required by this review. The path-level inventory
is stored in:

`docs/architecture/references/CLADORA-CE-BENEFIT-PRESENTATION-AND-SERVICE-HANDOFF-05-INVENTORY.json`

The inventory pins the reviewed commit, tree and SHA-256 of every covered file.
The static harness verifies the inventory and contract without network or Git
history.

## Presentation boundary

A future CE presentation adapter may consume only a current, purpose-limited
projection issued by the selected canonical Benefits/Commerce/Loyalty owner.
The owner decision and current authority checks stay server-owned. CE does not
infer a positive outcome from historical receipts, public labels, role names,
locale, price or absence of a charge.

A bounded input needs these facts:

- exact Context and Workspace;
- opaque benefit identity and positive revision;
- exact local placement identity and positive revision;
- current outcome: `eligible`, `unavailable`, `withheld` or `exhausted`;
- one owner-issued presentation key when the outcome is `eligible`;
- current decision version and `evaluated_at`;
- safe public sponsor label only when that label is separately approved;
- safe expiry or remaining allowance only when disclosure policy permits it;
- an optional purpose-limited SERVICE Offering identity and revision only when
  the current outcome is `exhausted`.

The CE projection may expose only the localized label, bounded availability,
safe expiry/remaining value when authorized, and an explicit navigation choice
to a separate SERVICE Offering. It must not expose or accept:

- tier or programme internals;
- membership ID or relationship row identity;
- eligibility reason or authority evidence;
- funding decision/reference, funding classification or source versions;
- budget, balance, sponsor contract or sponsor commercial terms;
- rent or service-charge composition;
- accounting, journal, tax or settlement detail;
- participant, Workspace or decision data from another scope.

`unavailable`, `withheld`, stale, revoked, ambiguous or missing outcomes never
produce positive included/sponsored wording. They reveal no hidden reason and
do not create a mutation. `exhausted` is an outcome, not a persisted CE benefit
state; it permits only the bounded SERVICE navigation described below.

## Approved member-facing vocabulary

The semantic keys are closed. Translation changes presentation only and cannot
change outcome, funding, entitlement, country, currency, tax or accounting.

The only vocabulary source is the **Canonical terminology policy** table in
`CLADORA-CE-MEMBER-BENEFIT-TERMINOLOGY-AUDIT-04-v1.0.md`. This contract stores
no second English, Romanian or Persian wording table and defines no fallback
translation. Its presentation keys resolve to these canonical concepts:

| Presentation key | Canonical terminology concept |
| --- | --- |
| `included_membership` | membership inclusion |
| `included_workspace` | Workspace inclusion |
| `included_occupancy` | occupancy inclusion |
| `sponsored_public_label` | sponsorship |
| `included_limited_time` | limited promotion |

The static harness parses those rows and uses the exact canonical cells for all
three languages. Any missing concept, changed key mapping or local translated
copy fails the contract instead of selecting a second vocabulary.

The sponsor placeholder is replaced only by an approved public label. CE never
uses an internal sponsor identity or contract label. `amount = 0`, a missing
price, a waived invoice, a discount or a zero-value fixture never selects any
key in this table and never produces `free`, `complimentary` or `included`.

Romanian, English and Persian share the same semantic key and current decision.
Persian renders right-to-left through the shared localized layout and component
boundaries; RTL changes layout only.

## Independent SERVICE handoff

An exhausted allowance can expose a purpose-limited link to one currently
published SERVICE Offering. The handoff is discovery/navigation, not a Request,
Order, booking, charge, consent or payment instruction. CE cannot submit the
SERVICE form, preselect consent, copy a prior idempotency key or represent that
the Offering is included.

The member must deliberately enter the SERVICE surface and accept its current
price, terms and consent. SERVICE then rechecks its own Workspace, authority,
Offering revision and commercial rules and creates its own transaction.

| Concern | CE benefit side | SERVICE side |
| --- | --- | --- |
| Identity | Canonical benefit identity referenced opaquely | Independent Offering, Request and Order identities |
| Revision | Current benefit and placement revisions | Current Offering revision and later aggregate versions |
| Consent | No commercial consent is created or carried | New explicit consent under current SERVICE terms |
| Idempotency | Owner-issued benefit/redemption key, if one exists; never copied by CE | New SERVICE command idempotency key scoped to that command |
| Receipt | Owner-issued benefit/redemption receipt candidate | Independent SERVICE Request/Order/delivery receipt |
| Price and charge | No price or charge inference | SERVICE-owned current price, tax display and payment path |

No automatic Request, Order, charge, booking or receipt is created when the CE
outcome changes to `exhausted`, when the link is displayed or when the member
opens the SERVICE page. Cancellation or failure on either side does not mutate
the other aggregate.

## Locale, privacy and failure behavior

Locale selects the approved string and layout direction only. It cannot select
a benefit, programme, funding decision, eligibility, sponsor, SERVICE Offering,
country, currency, tax or accounting treatment. Regional defaults in shared
locale configuration are not inputs to this contract.

A stale decision/revision, revoked authority, wrong Context or Workspace,
missing safe sponsor label, unavailable owner provider, malformed projection or
ambiguous handoff fails closed. The UI may show a bounded unavailable state but
must not expose why a member failed eligibility, another participant, a private
tier or funding detail. Every denial and unknown outcome is zero-write.

## Existing inactive controls

This package adds no runtime projection or route. The current Guide path remains
read-only:

- `CustomerExperienceGuidePage` passes `commands={null}`;
- `toExperienceGuideView` forces `can_edit: false`;
- the component requires both `guide.can_edit` and `commands` before rendering
  the editor.

These controls remain closed until a separately reviewed activation package.
They must not be interpreted as a benefit outcome or SERVICE authority.

## Static acceptance matrix

| Scenario | Required result |
| --- | --- |
| Current `eligible` outcome plus approved semantic key | Render only the matching localized presentation; disclose no private evidence. |
| `amount=0`, absent price, waived invoice or discount | No positive benefit wording and no CE classification. |
| Missing/stale/revoked/cross-Workspace decision | Bounded unavailable/withheld result and zero mutation. |
| Sponsor funding without approved public label | No sponsor name and no positive sponsor phrase. |
| Locale changes RO ↔ EN ↔ FA | Same decision and semantic key; presentation and direction only change. |
| Persian presentation | Equivalent meaning with RTL rendering; no authority or funding change. |
| Exhausted allowance with no Offering | Bounded unavailable result; no SERVICE object created. |
| Exhausted allowance with current Offering reference | Show an explicit navigation choice only. |
| Member follows handoff | SERVICE rechecks current Offering and asks for its own explicit consent. |
| Handoff merely rendered/opened | No Request, Order, booking, charge, idempotency record or receipt. |
| Guide public/read path | `commands=null`, `can_edit=false`; no editor or command activation. |

## Dependencies and non-goals

A runtime presentation remains blocked on the final
Benefits/Commerce/Loyalty owner decision and owner-issued current outcome
contract. Any allowance persistence, redemption ledger or receipt belongs to
that selected owner. SERVICE keeps its existing Offering/Request/Order boundary.
Core/Identity keeps Context, Workspace and authority. Finance keeps funding,
budget and accounting. CE creates none of those stores or truths.

This package adds no allowance store, redemption ledger, payment, route,
migration, grant, Remote DB operation, runtime wiring, notification, editor
activation or production action.
