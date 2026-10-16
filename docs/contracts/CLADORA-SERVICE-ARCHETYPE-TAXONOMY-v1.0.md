# SERVICE archetype taxonomy contract v1.0

Status: **pure contract and static conformance; no persistence or runtime acceptance**

Package: `SV-SERVICE-ARCHETYPE-TAXONOMY-04`

Contract: `service-archetype-taxonomy.v1`

Owner: **Platform SERVICE taxonomy governance**
(`platform_service_taxonomy_governance`)

Baseline: `main@75b7a2e3ba4c548f9a86bf52d9651de1e5e5d9d1`
(`tree e258b99e2ed5d63c2ede86d086e05eec45edc746`)

Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**

This contract defines country-neutral SERVICE primitives and archetypes for
optional services that a Workspace member may order, book or purchase. It is
the first dependency from the topological plan in
`CLADORA-SERVICE-MEMBER-VALUE-CATALOG-AND-TEMPLATES-03-v1.0.md`.

The TypeScript contract is pure, strict and has no I/O. It does not register a
taxonomy, write a row, publish a template, create an Offering or grant an
authority. The identifiers and hashes used by the conformance harness are
synthetic fixtures, not platform records.

## 1. Domain boundary

| Domain | Canonical rule | Taxonomy effect |
| --- | --- | --- |
| **SERVICE** | Optional member-directed service with an independent Order, Booking or Purchase, terms, consent, idempotency and receipt. | Only member-orderable primitives and archetypes are admitted. |
| **Maintenance** | Technical, preventive, corrective or mandatory work on assets and shared infrastructure. | Maintenance primitives are forbidden. A technical Work Order or statutory plan cannot be relabelled as SERVICE. |
| **CE** | Included experience or benefit governed by separate funding, eligibility, allowance/redemption and receipt, with no member per-use charge on that exact path. | No CE entitlement, funding or redemption primitive exists in this taxonomy. |

SERVICE classification follows the member-directed operation, not the person
performing it or the asset nearby. An optional in-unit repair ordered by a
member may be SERVICE. Preventive, corrective or statutory work on shared plant
remains Maintenance. A purpose-limited technical evidence reference may later
connect histories, but it does not merge domain ownership.

CE may show an independently published SERVICE Offering after an allowance
ends. It creates no automatic SERVICE Order or charge. SERVICE and CE keep
separate aggregate identity, authority, consent, idempotency and receipt.
Benefit definition and ownership remain `OPEN_PRODUCT_DECISION`.

## 2. Country-neutral contract

The taxonomy describes what a service is. It does not decide whether, where or
under which legal, financial or operational conditions it can be offered.

- Primitive and archetype revisions always carry
  `country_scope=country_neutral`.
- Country comes from the canonical Property jurisdiction decision.
- Currency, tax, invoice, payment rail and country-specific constraints come
  from accepted versioned Country Pack artifacts and their canonical owners.
- Locale, language, IP address, timezone and Workspace default never create a
  country or legal conclusion.
- A destination template/Offering flow must fail closed when the required
  Country Pack evidence is missing, expired, unsupported or incompatible.
- Country Pack rules never enter primitive or archetype bytes.

Passing this taxonomy schema is not a Country Pack compatibility decision.

## 3. Identity, immutability and exact references

Every accepted primitive revision binds:

```text
contract / contract_version
owner
primitive_id
primitive_code
primitive_version
content_hash
classification
country_scope
technical_effect
contexts
labels (ro/en/fa)
published_at
```

Every accepted archetype revision binds:

```text
contract / contract_version
owner
archetype_id
archetype_code
archetype_version
content_hash
classification
country_scope
technical_effect_policy
contexts
exact primitive references
labels (ro/en/fa)
published_at
```

Identity is `(id, code)`. A revision is `(id, code, positive version,
content_hash)`. Published bytes for an existing revision are immutable.

- Same identity, version and exact bytes is `EXACT_REPLAY`.
- Same identity/version with changed bytes or hash is
  `IMMUTABLE_REVISION_CONFLICT`.
- A lower version is `STALE_VERSION`.
- A skipped version is `VERSION_GAP`.
- A new revision advances exactly by one and is `NEW_VERSION`.
- Changing ID or code is `IDENTITY_MISMATCH`, not a version update.

A template must use `service-template-archetype-reference.v1` and pin exact
`archetype_id`, `archetype_code`, `archetype_version` and `content_hash`.
`latest`, a missing version, a code-only lookup or a floating range is invalid.

The pure comparator proves contract behavior for two supplied revisions. It is
not a persistence lock or authoritative registry. A future writer must enforce
the same rules transactionally.

## 4. Deprecation without rewriting history

Deprecation is a separate immutable
`service-taxonomy-deprecation-decision.v1`, not a mutable field on the
primitive or archetype revision. It pins the exact target revision and may name
one later exact successor with the same stable ID/code and a greater version.

Deprecation:

- never changes target bytes, version or hash;
- never rewrites a template, Offering, Order or receipt already pinned to the
  target;
- does not make a successor an automatic template upgrade;
- may prevent new authoring/adoption under a later policy package; and
- reveals no Workspace, member, provider or country data.

This package defines the decision shape but no lifecycle store, writer, policy
resolver or effective-state projection.

## 5. Primitive contract

Primitives are the smallest approved country-neutral member-service concepts.
They are not workflow steps, executable capabilities, permissions or provider
skills. The v1 vocabulary is closed:

```text
unit_cleaning
in_unit_repair
in_unit_equipment_installation
car_wash
vehicle_care
dry_cleaning
prepared_food
catering
breakfast_order
daily_shopping
bread_delivery
concierge_assistance
parcel_handling
space_reservation
desk_reservation
room_reservation
equipment_reservation
freight_elevator_move_reservation
move_assistance
goods_unloading
goods_loading
goods_packing
goods_movement
custom_office_service
custom_commercial_service
custom_industrial_service
custom_hospitality_service
```

Each primitive is classified only as `member_orderable_service`. Its
`technical_effect` is either `none` or
`possible_incidental_asset_effect`. The second value is an evidence warning,
not a Maintenance classification or permission to update asset history.

The following concepts are intentionally absent and invalid as SERVICE
primitives:

- lift inspection, lift repair or periodic lift servicing;
- fire-safety maintenance or statutory inspection;
- pump, generator, boiler or central-plant repair;
- preventive/statutory common-infrastructure maintenance;
- CE benefit, entitlement, allowance, funding or redemption; and
- price, tax, invoice, payment or provider execution.

## 6. Archetype contract and exact primitive sets

An archetype groups one exact approved primitive set. The v1 mapping is closed:

| Archetype | Exact primitive codes | Typical contexts |
| --- | --- | --- |
| `unit_care_and_cleaning` | `unit_cleaning` | Residential, hospitality |
| `in_unit_repair_and_installation` | `in_unit_repair`, `in_unit_equipment_installation` | Residential, office, retail, hospitality |
| `vehicle_care` | `car_wash`, `vehicle_care` | Residential, office, industrial, retail, hospitality |
| `garment_and_laundry` | `dry_cleaning` | Residential, office, hospitality |
| `food_catering_and_breakfast` | `prepared_food`, `catering`, `breakfast_order` | Residential, office, industrial, retail, hospitality |
| `daily_essentials_and_bread_delivery` | `daily_shopping`, `bread_delivery` | Residential, office, industrial, retail, hospitality |
| `concierge_and_parcel_handling` | `concierge_assistance`, `parcel_handling` | Residential, office, industrial, retail, hospitality |
| `space_and_equipment_booking` | `space_reservation`, `desk_reservation`, `room_reservation`, `equipment_reservation` | Residential, office, industrial, retail, hospitality |
| `move_and_freight_elevator_booking` | `freight_elevator_move_reservation`, `move_assistance` | Residential, office, industrial, retail, hospitality |
| `goods_handling_and_logistics` | `goods_unloading`, `goods_loading`, `goods_packing`, `goods_movement` | Office, industrial, retail, hospitality |
| `custom_workspace_service` | `custom_office_service`, `custom_commercial_service`, `custom_industrial_service`, `custom_hospitality_service` | Office, industrial, retail, hospitality |

The schema rejects a missing, additional, duplicate or mismatched primitive
reference. Each reference includes exact ID, code, version and content hash and
must resolve to the catalog supplied to the pure catalog validator.

### Required example classification

| Example | Archetype | Boundary note |
| --- | --- | --- |
| Cleaning inside a unit | `unit_care_and_cleaning` | SERVICE when ordered by the member |
| Optional in-unit repair or equipment installation | `in_unit_repair_and_installation` | Technical effect may require a separate asset-history reference; shared/statutory maintenance stays outside |
| Car wash and vehicle care | `vehicle_care` | SERVICE; no Maintenance record by default |
| Dry cleaning | `garment_and_laundry` | SERVICE |
| Food, catering and paid breakfast order | `food_catering_and_breakfast` | Paid order is SERVICE; membership-included breakfast is CE |
| Everyday shopping and morning bread delivery | `daily_essentials_and_bread_delivery` | SERVICE |
| Concierge and parcel handling | `concierge_and_parcel_handling` | SERVICE; parcel content/private data are outside taxonomy |
| Space, desk, room or equipment reservation | `space_and_equipment_booking` | SERVICE; actual capacity comes from the canonical booking provider |
| Freight elevator reservation for a move | `move_and_freight_elevator_booking` | SERVICE reservation; elevator repair/servicing remains Maintenance |
| Loading, unloading, packing and movement of goods | `goods_handling_and_logistics` | SERVICE for office, industrial, retail and hospitality contexts |
| Custom office/commercial/industrial/hospitality service | `custom_workspace_service` | Requires a later Workspace definition built from approved primitives |

The five context values are `residential`, `office`, `industrial`, `retail`
and `hospitality`. Context is descriptive compatibility, not Workspace
authority, availability, activation or country.

## 7. Forbidden authority and commercial content

Primitive and archetype schemas are strict objects. They reject unknown fields,
including:

- price, amount, currency, tax or invoice treatment;
- provider/provider account, merchant ID, bank account or provider agreement;
- credential, API key, token, secret or endpoint configuration;
- payment method or active payment rail;
- CE funding, benefit, entitlement, allowance or redemption;
- member, party, unit or private customer data;
- Workspace, tenant, role, permission, authority or module activation;
- Property, country code, Country Pack payload or jurisdiction decision;
- SQL, route, handler, executable code or expression; and
- schedule, live capacity, time slot or SLA.

Those facts belong to a later Workspace Definition, template adoption,
Workspace Offering or canonical provider decision as specified by their owners.
No absent field receives a default.

## 8. Ownership model

| Fact | Canonical owner | Taxonomy behavior |
| --- | --- | --- |
| Primitive/archetype identity, revision and allowed mapping | Platform SERVICE taxonomy governance | Defines immutable country-neutral contract |
| Workspace Service Definition | Source Workspace under SERVICE authority | References exact archetype revision; outside this package |
| Reusable Service Template | SERVICE template aggregate | References exact archetype revision; no floating lookup |
| Provider, price, fulfilment and local terms | Destination Workspace plus canonical domain owners | Forbidden in taxonomy |
| Maintenance asset/plan/Work Order | Maintenance/Operations | Never copied or reclassified |
| CE funding/eligibility/redemption | Future Benefits/Commerce/Loyalty owner plus CE presentation | `OPEN_PRODUCT_DECISION`; forbidden in taxonomy |
| Property jurisdiction | Core Property/Jurisdiction owner | Consumed later; forbidden in taxonomy bytes |
| Currency/tax/invoice/payment rail | Country Pack, Finance and Payments owners | Consumed later; forbidden in taxonomy bytes |
| Current identity/authority | Core | Required by future writers; not carried by a taxonomy revision |
| Idempotency/audit/outbox/unknown commit | Core transaction host/shared infrastructure | Reused by future persistence; not implemented here |

## 9. Threat model

| Threat | Static control | Future transactional requirement |
| --- | --- | --- |
| Maintenance concept enters SERVICE | Closed primitive/archetype enums and conformance cases | Governance review and exact version writer |
| Included benefit becomes SERVICE primitive | No benefit/funding/entitlement codes or fields | Independent CE/owner decision remains mandatory |
| Same revision is changed | Exact content hash plus immutable comparator conflict | Unique identity/version and immutable bytes |
| Template follows “latest” | Exact archetype reference schema | Persist exact ID/code/version/hash |
| Deprecation mutates history | Separate exact-target decision | Append-only decision and historical readback |
| Source country policy enters taxonomy | `country_scope=country_neutral`; strict unknown-field rejection | Country Pack compatibility evaluated separately |
| Provider/price/credential leaks | Strict schemas reject operational/private fields | Purpose-limited projections and secret scanning |
| Context becomes authority | Context is a closed descriptive enum only | Current Workspace authority rechecked by future writer |
| Primitive reference is tampered | Exact reference resolved within catalog validator | Canonical registry resolver and lock in one transaction |
| Version is stale/unsafe/skipped | Positive safe integer and comparator | CAS/locking, idempotency and zero-write denial |
| Unknown commit causes duplicate revision | Not executable in this package | Core `READBACK_REQUIRED` with original command/key |

## 10. Pure TypeScript surface

`src/lib/customer/service-archetype-taxonomy-v1.ts` exports:

- closed context, primitive and archetype vocabularies;
- the exact archetype-to-primitive and archetype-to-context maps;
- strict primitive and archetype revision schemas;
- strict exact primitive and archetype reference schemas;
- strict template-to-archetype reference schema;
- separate deprecation-decision schema;
- strict in-memory catalog conformance schema; and
- a pure immutable-revision comparator.

It imports only Zod and the existing shared UUID validator. It has no database,
network, environment, filesystem, route, handler, clock or runtime-composition
import. `published_at` and hashes are explicit inputs; the contract does not
fabricate them.

## 11. Static conformance matrix

| ID | Case | Required result |
| --- | --- | --- |
| TAX-01 | Valid country-neutral primitive revision | Accepted |
| TAX-02 | Unknown primitive code | Rejected |
| TAX-03 | Missing/zero/negative/decimal/unsafe primitive version | Rejected |
| TAX-04 | Duplicate primitive contexts | Rejected |
| TAX-05 | Price/tax/currency injected into primitive | Rejected |
| TAX-06 | Provider/credential/payment rail injected | Rejected |
| TAX-07 | Entitlement/member/Workspace authority injected | Rejected |
| TAX-08 | Country/Country Pack field injected | Rejected |
| TAX-09 | Valid archetype with exact primitive/context sets | Accepted |
| TAX-10 | Missing/additional/wrong primitive | Rejected |
| TAX-11 | Duplicate primitive reference | Rejected |
| TAX-12 | Wrong context set | Rejected |
| TAX-13 | Archetype carries commercial/private/authority field | Rejected |
| TAX-14 | Catalog resolves every exact primitive reference | Accepted |
| TAX-15 | Referenced hash/version/code/ID mismatch | Rejected |
| TAX-16 | Duplicate primitive or archetype identity/version | Rejected |
| TAX-17 | Template pins exact archetype revision | Accepted |
| TAX-18 | Template uses `latest`, range or omits version/hash | Rejected |
| TAX-19 | Same revision and bytes | `EXACT_REPLAY` |
| TAX-20 | Same revision with changed bytes/hash | `IMMUTABLE_REVISION_CONFLICT` |
| TAX-21 | Version advances exactly once | `NEW_VERSION` |
| TAX-22 | Stale or skipped version | `STALE_VERSION` / `VERSION_GAP` |
| TAX-23 | ID/code changes during revision | `IDENTITY_MISMATCH` |
| TAX-24 | Valid exact deprecation decision | Accepted without changing target |
| TAX-25 | Successor has another ID/code or non-greater version | Rejected |
| TAX-26 | Technical lift servicing appears as primitive/archetype | Absent and rejected |
| TAX-27 | Freight-elevator move reservation mapping | SERVICE archetype accepted |
| TAX-28 | Residential/office/industrial/retail/hospitality coverage | All present in exact maps |
| TAX-29 | SERVICE/Maintenance/CE documentation drifts | Static harness fails |
| TAX-30 | Persistence/route/runtime import appears | Static safety scan fails |

## 12. Dependencies and next package

This package satisfies only `SV-SERVICE-ARCHETYPE-TAXONOMY-04` from the merged
topological plan. It does not satisfy:

1. `SV-REUSABLE-TEMPLATE-CONTRACT-05` strict declarative template/adoption
   schemas;
2. `CORE-TEMPLATE-MODERATION-DECISION-01` exact-version moderation evidence;
3. `CORE-COUNTRY-TEMPLATE-COMPATIBILITY-01` destination Country Pack evidence;
4. `SV-TEMPLATE-PERSISTENCE-06` separately authorized persistence;
5. `SV-TEMPLATE-ADOPTION-07` transaction/provider composition;
6. `SV-OFFERING-MODEL-ALIGNMENT-08` commercial-model compatibility; or
7. any API/UI/runtime acceptance package.

The next SERVICE-owned independent package is
`SV-REUSABLE-TEMPLATE-CONTRACT-05`. It may consume only exact accepted
archetype references from this contract and must remain persistence-free unless
separately authorized.

## 13. Explicit non-acceptance

This package creates no migration, taxonomy persistence, template persistence,
handler, route, marketplace, provider network, payment wiring, grant,
credential, Remote database operation, runtime activation or Production
change. It performs no remote apply and issues no SERVICE, Maintenance, CE,
Country Pack or runtime acceptance. It does not resolve
`OPEN_PRODUCT_DECISION` and does not Merge itself.
