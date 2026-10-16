# SERVICE taxonomy extension governance contract v1.0

Status: **pure schema/evaluator/static conformance; no persistence or runtime acceptance**

Package: `SERVICE-TAXONOMY-EXTENSION-GOVERNANCE-05`

Baseline: `main@ffdad59c5771916d66ce0311c6f61322d123fa6b`
(`tree 752e5eb031da3ad11143b357f73d80b712a615e5`)

Canonical taxonomy dependency: PR #449, merge
`536a9526222a36a1fd5d28e4267ca4b2d783786c`

Governance owner: `platform_service_taxonomy_governance`

Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**

This contract defines the review boundary between a Workspace innovation
proposal and a possible future immutable SERVICE taxonomy revision. It imports
and consumes `service-taxonomy-extension-proposal.v1` directly from the merged
taxonomy contract. It does not copy that proposal schema and does not make a
proposal orderable, publishable or executable.

## 1. Domain boundary

SERVICE remains an optional member-directed service with its own later Order,
Booking or Purchase, terms, consent and receipt. Maintenance remains technical,
preventive, corrective or mandatory work on shared assets and infrastructure.
CE remains an included experience or benefit with separate funding,
eligibility, redemption and receipt.

- A freight-elevator move reservation is a possible SERVICE concept.
- Technical elevator maintenance remains Maintenance even when submitted with
  a friendly or custom label.
- An included benefit remains CE even when its label resembles a paid service.
- Proposal text, translation, compatibility hints or prior receipts never
  change this ownership boundary.

Country-neutral taxonomy meaning remains separate from Property jurisdiction,
Country Pack compatibility, currency, tax, invoice and payment-rail decisions.

## 2. Proposal boundary

The only accepted input shape for Workspace innovation is the existing
`service-taxonomy-extension-proposal.v1` contract. It binds an exact proposal
ID/version and complete proposal fingerprint.

A proposal is always:

- `proposal_only=true`;
- nonorderable and unpublished;
- unable to create an Offering, Order, Booking, Purchase or template;
- unable to assign authority, eligibility or availability;
- unable to carry price, provider, credential, payment rail or activation;
- unable to change the canonical taxonomy by itself; and
- evaluated without durable writes by this package.

Changing any proposal field without advancing its proposal version is an
immutability conflict. Reviewing an older proposal version is a stale denial.

## 3. Review lifecycle

The closed lifecycle is:

```text
pending
rejected
accepted
```

| Lifecycle | Meaning | Taxonomy output |
| --- | --- | --- |
| `pending` | Exact proposal entered review. No governance acceptance exists. | None |
| `rejected` | Review, authority, version, collision or boundary check denied. | None; zero side effects |
| `accepted` | Exact proposal passed current governance and semantic review. | One inactive candidate for exactly `current_taxonomy_revision + 1` |

There is no `published`, `active`, `orderable` or `available` proposal state.
An accepted result is still a candidate. A later separately reviewed taxonomy
package must add the new immutable primitive/archetype revisions to the closed
canonical registry.

## 4. Governance authority

Only current authority evidence owned by
`platform_service_taxonomy_governance` may produce `accepted`. The evidence
binds actor party, positive authority revision, outcome and evaluation time.

The schema rejects another owner. The evaluator rejects denied authority. The
proposal's source Workspace, label, author or desired availability is never
authority. This package defines no authority provider or role assignment; it
consumes injected evidence in a pure evaluator.

`pending` needs no acceptance authority because it changes nothing. Explicit
governance rejection may record the governance owner but still produces no
taxonomy candidate or side effect.

## 5. Semantic review and collision rules

An acceptance command binds a semantic review for the same exact proposal.
The primitive and archetype semantic fingerprints are recomputed from the
proposal rather than trusted from the caller.

Acceptance fails closed when:

- primitive or archetype code collides with any current registry code;
- primitive and archetype suggestions collide across taxonomy kinds;
- semantic review identifies an existing primitive or archetype duplicate;
- the registry already contains either semantic fingerprint;
- semantic classification is Maintenance, CE or unknown;
- proposal ID/version/fingerprint is stale or changed;
- current taxonomy revision differs from the expected revision; or
- proposed taxonomy revision is not exactly current revision plus one.

Code uniqueness does not establish semantic uniqueness. A renamed breakfast,
catering, loading, vehicle-care, Maintenance or included-benefit concept still
requires semantic review and must be rejected when it duplicates or
masquerades as another domain.

## 6. Immutable taxonomy candidate

An `accepted` decision may output one
`NEXT_TAXONOMY_REVISION_CANDIDATE_ACCEPTED` candidate. It binds:

```text
candidate_only=true
executable=false
taxonomy_revision=current+1
owner=platform_service_taxonomy_governance
country_scope=country_neutral
orderability=not_orderable
publication=not_published
activation=inactive
```

The primitive and archetype candidates each receive a new stable identity,
version `1`, explicit content hash, exact semantic definition, semantic
fingerprint and RO/EN/FA labels. The archetype carries the exact primitive
identity/version/hash. Definitions are copied from the reviewed proposal and
cannot be edited through the decision result.

This evaluator does not publish those candidate bytes into the canonical
taxonomy and does not advance a stored registry revision.

## 7. Compatibility hints

All eight canonical hints remain available:

```text
residential
office_workplace
retail
hospitality
industrial
logistics
automotive
mixed_use
```

Hints are optional, unique and nonauthoritative. They do not decide taxonomy
validity, member eligibility, local availability, provider coverage, country,
price or activation. A destination Workspace re-evaluates its own facts.

## 8. Reusable template contract

Only a template with `lifecycle=accepted` can enter the pure adoption/fork
evaluator. Its minimum immutable identity is:

```text
template_id
template_version
content_hash
source_workspace_reference
taxonomy_revision
exact archetype identity / code / version / hash
accepted archetype and primitive semantic fingerprints
source proposal identity / version / fingerprint
governance decision identity / version
parent template identity / version / hash | null
country_scope=country_neutral
compatibility hints
accepted_at
```

The template's public semantic definition must reproduce the accepted
archetype semantic fingerprint. A fork uses a new template identity and keeps
the exact parent lineage. The schema rejects a template that names itself as
its parent.

An accepted template carries no provider, final price, tax, currency, payment
rail, entitlement, eligibility, availability, authority or activation. Public
discovery and persistence are outside this package.

## 9. Adoption and fork boundary

Another Workspace may submit `adopt` or `fork` only with the full accepted
template snapshot. The decision pins exact `template_id + template_version +
content_hash` and preserves provenance.

Both outcomes remain inactive planning candidates:

```text
local_eligibility=not_evaluated
local_price=not_set
local_availability=not_evaluated
local_activation=inactive
executable=false
zero_side_effects=true
```

Adoption does not create a Workspace Offering or inherit source-Workspace
authority. Forking does not claim original authorship or discard the parent
lineage. A later destination-owned package must independently evaluate current
authority, Country Pack compatibility, provider, terms, price, availability
and explicit activation.

## 10. Replay and failure behavior

The evaluator computes a stable input fingerprint over the exact command and
registry snapshot.

- Same idempotency key and same fingerprint returns the exact prior decision.
- Same key with changed proposal, review, candidate bytes or registry evidence
  returns bounded `REPLAY_CONFLICT`.
- Stale proposal, changed proposal bytes, denied authority, code collision,
  semantic duplicate, boundary masquerading and revision conflicts produce a
  rejected decision with `zero_side_effects=true`.

There is no unknown-commit recovery because this package performs no commit.

## 11. Required conformance examples

| Scenario | Expected result |
| --- | --- |
| Residential balcony plant-care innovation | May become an inactive next-revision candidate after exact governance acceptance |
| Office breakfast/catering relabel | Semantic duplicate denial |
| Industrial loading relabel | Semantic duplicate denial |
| Automotive vehicle-care relabel | Semantic duplicate denial |
| Hospitality guest-convenience innovation | May become a country-neutral inactive candidate after review |
| Technical elevator servicing under member-friendly label | `MAINTENANCE_MASQUERADE` |
| Membership-funded welcome benefit under service label | `COMMUNITY_EXPERIENCE_MASQUERADE` |
| Code already used by an accepted extension | `CODE_COLLISION` |
| Proposed revision is current or skips one | `TAXONOMY_REVISION_CONFLICT` |
| Older proposal version | `STALE_PROPOSAL` |
| Same exact retry | Exact prior decision |
| Changed retry with same key | `REPLAY_CONFLICT` |

## 12. Ownership and dependencies

| Fact | Owner | This package |
| --- | --- | --- |
| Proposal content and provenance | Source Workspace | Consumes exact v1 proposal; grants no authority |
| Taxonomy acceptance | Platform SERVICE taxonomy governance | Requires exact verified authority evidence |
| Primitive/archetype semantic definition | Platform SERVICE taxonomy governance | Freezes candidate text/fingerprint; does not publish |
| Template identity/version/provenance | SERVICE reusable-template aggregate | Defines pure accepted snapshot only |
| Destination eligibility/availability | Destination Workspace and canonical owners | Leaves unevaluated |
| Price/tax/currency/payment rail | Finance, Country Pack and Payments owners | Leaves unset and carries no fallback |
| Benefits/Commerce/Loyalty | `OPEN_PRODUCT_DECISION` | Never inferred or claimed |
| Persistence/idempotency/audit/outbox | Core transaction host/shared infrastructure | No store or ledger is created |

The semantic-review evidence and governance-authority evidence require future
canonical providers before any runtime writer can exist. Passing this package
does not accept those providers or runtime behavior.

## 13. Pure implementation surface

`service-taxonomy-extension-governance-v1.ts` exports:

- strict governance authority, semantic review and registry snapshot schemas;
- strict submit/reject/accept command schemas;
- strict pending/rejected/accepted decision schemas;
- deterministic proposal and semantic fingerprint helpers;
- a pure governance evaluator with bounded denials and replay behavior;
- strict accepted reusable-template identity/provenance schema; and
- a pure adopt/fork candidate evaluator that creates no local business facts.

It imports the merged proposal schema directly. It uses no filesystem,
environment, clock, network, database or runtime-composition import.

## 14. Explicit non-acceptance

This package creates no persistence, migration, template store, marketplace, route,
payment wiring, grant, Remote database operation or activation. It creates no
Offering, Order, authority, availability, price, provider binding or Country
Pack decision. It performs no Remote apply, Production action or Merge and
issues no runtime acceptance.
