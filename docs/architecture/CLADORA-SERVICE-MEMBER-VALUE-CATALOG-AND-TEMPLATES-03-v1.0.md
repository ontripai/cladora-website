# SERVICE member value catalogue and reusable templates 03

Status: **documentation/static-contract-only; no runtime acceptance**

Package: `SERVICE-MEMBER-VALUE-CATALOG-AND-TEMPLATES-03`

Baseline: `main@8cffa7d95e0088c30fd5b2e6f6b5ee57ee8a79aa`
(`tree 09c68456c8fc33d35e771dd5186fe64294692a67`)

Benefits/Commerce/Loyalty owner: **`OPEN_PRODUCT_DECISION`**

This package defines SERVICE as an optional member-value catalogue. A member
may independently order, book or purchase a Workspace Offering with its own
terms, consent, identity and receipt. A Workspace may also design a service
definition from approved platform primitives and propose an immutable,
versioned template that another Workspace may explicitly adopt.

The template model is a definition-sharing contract. It is not a marketplace,
provider network, executable extension, payment rail, permission grant or
Country Pack. No table, migration, route, handler, grant, credential, adapter,
Remote operation or Production activation is delivered here.

## 1. Live inventory

The inventory below describes repository evidence at the stated baseline. It
does not assert that a migration is installed remotely or that a route is
active in Production.

| Surface | Observed repository state | Consequence for this package |
| --- | --- | --- |
| Public positioning | `/service` now describes Member Services & Bookings, optional Workspace configuration, six commercial models and the Maintenance/CE boundaries in RO/EN/FA. | The architecture contract must preserve that wording and cannot reintroduce “Services & Benefits” as SERVICE ownership. |
| Catalogue entities | `service_catalog.definitions`, `service_catalog.offerings` and immutable `service_catalog.revisions` are present in product migrations. Definitions are Workspace-scoped; Offerings bind a local definition and provider party. | Existing entities are retained. They do not prove an archetype or reusable-template aggregate. |
| Catalogue commands | Existing contracts model create/revise/submit/publish/suspend/archive, explicit Workspace scope, current authority, lock versions, idempotency, audit/outbox and separate publication approval. | A later template writer must reuse the canonical transaction and authority boundaries rather than create parallel ledgers. |
| Existing commercial shape | `service-catalog-schema.ts` supports acquisition modes `direct`, `pre_quote`, `on_site`, `project`, `reservation` and price kinds `fixed`, `unit`, `quote_required`. | These fields partially express the required commercial models, but are not the canonical six-model taxonomy defined below. Migration and compatibility design remain future work. |
| SERVICE v1.4 contracts | Offering, Order, Delivery, Booking, Portfolio, Finance and CE coordination consumers use bounded versioned receipts and injected canonical providers. | Contract tests are not runtime acceptance and do not create a reusable-template provider. |
| Reusable templates | No SERVICE template identity, version, lifecycle, adoption, fork lineage, moderation decision or upgrade acceptance was found. | All four concepts remain proposed. No existing generic import/role/content template store may be reused by name alone. |
| Maintenance | Maintenance owns assets, preventive/corrective/statutory work, plans and Work Orders. | A SERVICE Offering may reference technical fulfilment, but cannot relabel Maintenance or become its canonical writer. |
| CE included experiences | The merged CE funding contract keeps benefit definition, allowance and redemption ownership at `OPEN_PRODUCT_DECISION`; CE owns presentation/orchestration and purpose-limited references. | SERVICE cannot own or mint an included benefit or CE entitlement. |
| Jurisdiction and Country Pack | Core Jurisdiction Profile, Selector and versioned domain artifact contracts exist; the SERVICE payment discovery records typed payment-artifact and adapter gaps. | A template compatibility decision must consume canonical Property jurisdiction and Country Pack artifacts. It cannot infer country or copy policy. |
| Runtime state | Existing catalogue/runtime components have their own activation and Remote-installation evidence requirements. | This package changes no activation state and issues no SERVICE runtime acceptance. |

### Inventory conclusion

The repository has a usable Workspace-local definition/offering foundation and
strong transaction boundaries. The missing capability is not another Offering
schema with a `template` label. It is an owner-aware, immutable and moderated
definition exchange that preserves destination control and country-specific
validation without transferring operational or private configuration.

## 2. Official domain boundary

| Domain | Canonical meaning | Required identity/evidence | Explicit exclusion |
| --- | --- | --- | --- |
| **SERVICE** | Optional service a member independently orders, books or purchases. | Exact Workspace Offering/version, current actor authority, terms, price or assessment basis, explicit consent, idempotency and SERVICE receipt. | Does not own included benefits, maintenance plans, technical statutory truth or Country Pack policy. |
| **Maintenance** | Technical, preventive, corrective or mandatory work on assets and shared infrastructure. | Asset, plan/Work Order, technical authority, schedule, execution evidence and Maintenance history. | Member-facing absence of a charge does not turn Maintenance into SERVICE or CE. |
| **CE** | Experience or included benefit governed by an independent funding and eligibility decision, with no member per-use charge on that exact path. | Owner-issued funding/eligibility, allowance/redemption and CE presentation references; final product ownership remains `OPEN_PRODUCT_DECISION`. | CE does not create a SERVICE Order, reuse a SERVICE receipt or own SERVICE commercial consent. |

The member-visible category follows the canonical operation, not the label,
provider or location. A building engineer performing in-unit work may fulfil a
SERVICE Order; that does not move the Order into Maintenance. Conversely,
mandatory lift inspection remains Maintenance even when a member sees its
schedule.

## 3. SERVICE taxonomy

### In-scope member services

The taxonomy must be able to describe, without making any item mandatory:

- cleaning inside a unit;
- repair or installation of equipment inside a unit;
- car wash and vehicle care;
- dry cleaning;
- food, catering and breakfast ordering;
- everyday shopping and morning bread delivery;
- concierge and parcel handling;
- reserving a space, desk, room or equipment;
- reserving a freight elevator for a move;
- unloading, loading, packing and movement of goods; and
- custom office, commercial, industrial and hospitality services.

These examples classify a member-requested operation. They do not prove that a
provider, price, schedule, payment rail or runtime path exists in a Workspace.

### Out of SERVICE

The following remain Maintenance when performed as technical, preventive,
corrective or statutory work for assets or shared infrastructure:

- lift repair and periodic lift servicing;
- fire-safety system maintenance;
- repair of pumps, generators, boilers and central plant; and
- preventive or statutory maintenance of common areas and infrastructure.

Booking a freight elevator for a move is a SERVICE reservation. Servicing or
certifying that elevator is Maintenance. The shared physical asset does not
collapse the two records.

## 4. Four-layer entity and ownership model

```text
Service Archetype
  -> Workspace Service Definition
    -> Reusable Service Template (optional publication/adoption)
      -> Workspace Offering
```

### 4.1 Service Archetype

A Service Archetype is a platform-owned primitive and base taxonomy. It names a
bounded service family, allowed primitive capabilities, fulfilment shapes and
classification constraints. It contains no Workspace provider, price,
credential, member entitlement or country policy.

Minimum future identity:

```text
archetype_id
archetype_code
archetype_version
primitive_set/version
status
valid_from / valid_until
owner = platform_service_taxonomy
```

Changing the meaning or allowed primitives creates a new positive version. A
display translation never changes the archetype identity.

### 4.2 Workspace Service Definition

A Workspace Service Definition is a source Workspace's authored description,
assembled only from approved Archetype primitives. It may add local labels,
description, requested outcomes, input requirements and a commercial-model
allowlist. It is not yet orderable and has no provider, final price, capacity,
payment rail or member entitlement.

Minimum future identity:

```text
definition_id / definition_version
source_workspace_id
archetype_id / archetype_version
approved_primitive_references
localized public definition fields
allowed_commercial_models
owner_party_reference
provenance
status
```

The current `service_catalog.definitions` row is Workspace-scoped but lacks
this versioned archetype/provenance contract. It must not be described as
conformant until an additive compatibility and persistence design is accepted.

### 4.3 Reusable Service Template

A Reusable Service Template is an immutable published revision of a definition
that other Workspaces may discover and explicitly adopt. SERVICE owns the
template aggregate and version semantics. The source Workspace/party owns its
authorship and provenance. A named moderation/safety owner must approve public
publication. Core remains the authority and transaction host; Country Pack
owners remain the source of jurisdiction policy.

Minimum future identity:

```text
template_id / template_version
source_definition_id / source_definition_version
source_workspace_id
owner_party_reference / owner_version
provenance_chain
archetype_id / archetype_version
primitive references and public definition payload
lifecycle
moderation_decision_reference / version
published_at | null
deprecated_at | null
withdrawn_at | null
content_hash
```

The template payload is declarative data only. It cannot contain executable
code, SQL, a route, permission assignment, grant, role membership, provider
credential or opaque executable expression.

### 4.4 Workspace Offering

A Workspace Offering is the destination Workspace's local, orderable instance.
It binds one local definition or exact adopted template version to destination
provider, beneficiary/eligibility, service area, delivery point, schedule,
capacity, price, currency, tax/invoice treatment, payment rail, cancellation,
acceptance/dispute and SLA decisions. Each binding must come from its canonical
owner and current exact version.

An Offering is not a template revision. A source-template change cannot mutate
an Offering. A destination may create a new Offering revision only through its
own authority, validation and consent flow.

### Ownership matrix

| Fact | Canonical owner | Template permission |
| --- | --- | --- |
| Archetype primitive and taxonomy version | Platform SERVICE taxonomy governance | Reference exact accepted version only |
| Workspace definition and authorship | Source Workspace under current SERVICE authority | Publish a reviewed immutable projection |
| Template identity, revision, lifecycle and lineage | SERVICE template aggregate | Persist exact owner/provenance/version; no executable payload |
| Public moderation and safety decision | Named platform moderation/safety owner, contract required | Publish only with current exact approval evidence |
| Adoption intent and destination acceptance | Destination Workspace | Pin one exact template version; no implicit upgrade |
| Local provider and provider agreement | Destination Workspace plus canonical agreement owner | Never transferred by template |
| Local price and fulfilment terms | Destination Workspace with Finance/Operations owners as applicable | Never inherited as authoritative destination terms |
| Membership/benefit entitlement | `OPEN_PRODUCT_DECISION` and canonical membership/programme owners | Reference is forbidden as template authority |
| Property jurisdiction | Core Property/Jurisdiction Profile Selector | Consume exact canonical decision; no locale inference |
| Currency, tax, invoice and payment rail | Country Pack/Finance/Payments canonical owners | Resolve for destination; never copy source policy |
| Identity, authority, idempotency, audit and outbox | Core transaction host/shared infrastructure | Reuse only; never create parallel stores |

## 5. Template lifecycle

The closed lifecycle vocabulary is:

```text
draft
private
shared
submitted_for_review
approved
published
deprecated
withdrawn
```

| Current state | Allowed next state | Meaning and gate |
| --- | --- | --- |
| `draft` | `private` | Author completes a bounded definition; visible only to authorized source-Workspace editors. |
| `private` | `draft`, `shared`, `submitted_for_review` | Private revisions may be edited by creating a new positive version. `shared` remains limited to an explicit authorized audience. |
| `shared` | `private`, `submitted_for_review` | Sharing never grants adoption or cross-Workspace data access. |
| `submitted_for_review` | `private`, `approved` | Review may request changes by returning the proposal to a non-public state. No approval is inferred from elapsed time. |
| `approved` | `published`, `private` | Approval is version-bound. Any content change invalidates it and creates a new version. |
| `published` | `deprecated`, `withdrawn` | Published bytes and content hash are immutable. |
| `deprecated` | `withdrawn` | Existing pinned adoptions remain valid subject to current destination checks; new adoption is denied. |
| `withdrawn` | none | Discovery and new adoption stop. Historical references and accepted destination Offerings remain. |

Lifecycle status is not authority. Every transition requires current source
Workspace authority, exact expected version, moderation evidence where
applicable, a stable idempotency key, bounded denial and zero-write failure.

## 6. Publication, adoption, fork and upgrade rules

1. Owner, provenance, positive version and lifecycle are mandatory.
2. Every published revision is immutable and content-hash bound.
3. Adoption pins `template_id + template_version + content_hash`.
4. Source edits create a new template version and never change destination
   Offerings or adoption records.
5. Upgrade requires an explicit destination-Workspace command, current
   authority, compatibility evaluation, review of changed terms and a new
   destination Offering revision.
6. A fork creates a new definition identity and retains its complete lineage:
   source template/version/hash, fork owner, fork instant and later local
   versions. The fork is not falsely presented as the original publisher's
   current revision.
7. Deleting, deprecating or withdrawing a template cannot delete an accepted
   adoption or Offering. Historical receipts keep their exact reference.
8. Public publication requires moderation and safety review for the exact
   immutable version. A prior version's approval cannot approve a changed one.
9. Cross-Workspace discovery exposes only approved public template fields and
   provenance. It exposes no source members, units, internal provider details,
   private moderation notes or destination adoption data.
10. Exact replay returns the original transition/adoption receipt. A changed
    template, destination binding or command under the same key conflicts.

### Adoption/fork/upgrade/versioning matrix

| Scenario | Required decision | Result | Forbidden shortcut |
| --- | --- | --- | --- |
| Adopt current published revision | Current destination authority, exact source version/hash, moderation and country compatibility | New destination adoption/version; no Offering until local configuration completes | “Latest” floating reference |
| Source publishes a newer revision | None for existing destination | Existing adoption and Offering remain pinned and unchanged | Automatic upgrade |
| Destination accepts upgrade | Re-evaluate diff, archetype/primitives, moderation, country compatibility and every local binding | New adoption version and local Offering revision after explicit acceptance | Rewriting historical Order/receipt |
| Destination forks | Current destination authority and exact source lineage | New destination definition identity with preserved lineage | Claiming original ownership or dropping provenance |
| Source deprecates template | Current source authority and lifecycle version | Block new adoption; retain existing adoption/Offering | Cascading disable of destination Offering |
| Source withdraws template | Current source authority plus required governance evidence | Remove public discovery/new adoption; retain history | Deleting destination data |
| Template incompatible with destination country | Exact canonical compatibility denial | Bounded denial and zero writes | Using source country, locale or Workspace default |
| Template owner loses authority | Current authority denial | No new transition/adoption; existing history remains | Historical author receipt as current authority |

## 7. Template payload boundary

A template may carry approved, non-private, declarative definition material:

- exact archetype and primitive references;
- localized name, description and member-visible input requirements;
- allowed commercial models;
- generic fulfilment capabilities and evidence requirements;
- generic cancellation/acceptance/SLA fields that the destination must fill or
  explicitly accept; and
- public provenance and moderation evidence references.

A template must not transfer:

- final price;
- currency or tax assumption;
- provider account;
- merchant ID;
- bank account;
- API key, token or secret;
- active payment rail;
- member entitlement;
- private member or unit data; or
- Country Pack authority.

The destination Workspace must determine and validate:

- internal or external provider;
- beneficiary and eligibility;
- service area and delivery point;
- schedule, capacity and time slot;
- price and currency;
- tax and invoice treatment;
- payment rail;
- cancellation;
- acceptance and dispute handling; and
- SLA.

Missing destination configuration returns a bounded unavailable result with
zero writes. Template content cannot be used as a fallback.

## 8. Commercial and fulfilment model

The canonical SERVICE commercial vocabulary proposed for future alignment is:

```text
fixed_price
usage_based
subscription
booking
quotation
post_assessment
```

| Model | Member decision | Required destination binding | Template-safe content |
| --- | --- | --- | --- |
| `fixed_price` | Accept exact current price and terms | Currency, tax/invoice, provider, validity and acceptance terms | Model eligibility and generic fields only |
| `usage_based` | Accept metered unit/rule and cap where required | Canonical unit, measurement source, precision/rounding, price and dispute rule | Permitted measurement primitive; no source price |
| `subscription` | Accept recurring scope, cadence, cancellation and renewal | Provider, period, price/currency, invoice/payment and capacity policy | Generic cadence/coverage shape only |
| `booking` | Select exact resource/time/capacity under current availability | Canonical resource, half-open interval, capacity receipt, price and cancellation | Required resource/capacity primitive only |
| `quotation` | Request/accept a separately versioned Quote | Quote authority, scope, expiry, price/tax snapshots and explicit acceptance | Required quote inputs only |
| `post_assessment` | Consent to assessment before final scope/price acceptance | Assessment authority/evidence followed by separate final terms and consent | Assessment requirements; no automatic charge |

Funding or discount references may be attached as independently verified
evidence. SERVICE does not own or produce an included benefit, CE entitlement,
allowance or redemption receipt. A zero price is not proof of an included
benefit.

## 9. CE handoff

| Member proposition | Domain | Required separation |
| --- | --- | --- |
| Paid breakfast order | SERVICE | Independent Offering, terms, consent, Order and receipt |
| Breakfast included with membership | CE plus the future Benefits/Commerce/Loyalty owner | Independent funding, eligibility, allowance/redemption and receipt; no SERVICE charge |
| Paid car wash | SERVICE | Independent Offering, booking/order and receipt |
| Seasonal car-wash allowance | Candidate benefit outside SERVICE ownership | Owner-issued entitlement/redemption decision; CE may present it |

When an allowance ends, CE may display a safe reference to an independently
published SERVICE Offering. It must not create an Order or charge. The member
must enter the SERVICE path and give new consent under current price and terms.
The CE and SERVICE paths have separate aggregate identity, idempotency key,
command fingerprint, consent and receipt. Replay or failure in one path cannot
execute the other.

## 10. Records and history

- Every accepted SERVICE purchase, reservation or order has a SERVICE Order
  identity/version and SERVICE receipt.
- SERVICE history records definition/Offering version, provider, terms,
  consent, delivery and acceptance appropriate to that operation.
- Only a service with a real technical effect on an asset may reference the
  canonical asset history through an accepted adapter and technical evidence.
- Food, bread, catering, dry cleaning and car wash are not recorded as
  Maintenance merely because they occur at a property.
- SERVICE history and asset Maintenance history remain separate canonical
  records. A purpose-limited reference does not merge ownership.
- Template withdrawal, adoption upgrade or country-policy change cannot rewrite
  a historical Order, receipt, Offering or technical evidence reference.

## 11. Multi-country contract

1. Service identity and availability come from the exact destination
   Workspace and Offering.
2. Country comes only from the canonical Property jurisdiction decision.
3. Currency, tax, invoice and payment rail come from accepted, versioned
   Country Pack domain artifacts and their canonical providers.
4. Locale, language, IP address, timezone, browser settings and Workspace
   defaults cannot select or fabricate country.
5. Adoption must fail closed when a required destination Country Pack artifact
   is missing, expired, unsigned, unsupported or incompatible.
6. The compatibility receipt binds destination Property/Workspace, jurisdiction
   profile/version, required artifact contracts/hashes, template/version/hash,
   evaluated instant and bounded result. It contains no secret or private
   artifact payload.
7. Source-Workspace price, currency, tax, invoice, rail and country policy are
   never imposed on the destination.
8. An adopted Offering pins its historical decisions. A later Property country
   or Country Pack change does not rewrite prior intents, Orders or receipts.

Compatibility is a gate, not an authority grant. Passing it does not prove
member permission, provider availability, price acceptance or payment success.

## 12. Threat model and fail-closed controls

| Threat | Required control | Denial effect |
| --- | --- | --- |
| Template carries executable code, SQL, route or expression | Strict declarative schema and content allowlist | Reject version; zero writes |
| Credential or merchant/bank data is embedded | Recursive secret/private-field scan plus typed schema | Reject without echoing value |
| Source price/currency/tax/rail becomes destination truth | Destination fields forbidden in template authority; canonical local resolution required | Compatibility/configuration denial |
| “Latest” template silently changes an Offering | Exact version/hash pin and immutable published bytes | Reject floating reference |
| Source edit cascades to adopters | New source version; explicit destination upgrade command | Existing adoption unchanged |
| Withdraw/delete cascades to Orders | History and destination ownership protected | Discovery stops; accepted data remains |
| Cross-Workspace author or adopter probe | Current Workspace authority and purpose-limited public projection | Uniform bounded denial; no existence leak |
| Unmoderated public content | Exact-version moderation/safety receipt before `published` | Publication denied |
| Fork drops or falsifies provenance | Immutable lineage and owner/version binding | Fork rejected |
| CE allowance becomes SERVICE Order | Separate identity, consent, idempotency and receipt | No Order or charge |
| Maintenance is relabelled as member service | Archetype constraints and canonical Work Order/asset classification | Classification denied or review required |
| Locale/IP selects country | Canonical Property jurisdiction provider only | Country unavailable; zero writes |
| Country-incompatible template is adopted | Exact destination compatibility evaluation | Bounded incompatibility; zero writes |
| Same key with changed version/binding | Complete command fingerprint and Core idempotency | Replay conflict; zero writes |
| Provider or authority changes before commit | Recheck on the same Core transaction/connection | Full rollback |
| Commit acknowledgement is lost | Core `READBACK_REQUIRED` with original key/command | No blind retry or duplicate Offering |

Normal denials reveal no source private data, moderation notes, destination
configuration, provider account, Country Pack payload, alternative rail or
authority detail.

## 13. Gap analysis

| Gap | Current status | Canonical owner/dependency | Required evidence before runtime |
| --- | --- | --- | --- |
| Archetype/primitive registry | Missing for this template contract | Platform SERVICE taxonomy governance | Versioned schema, immutable identity and compatibility tests |
| Versioned Workspace definition | Current local row is not the proposed versioned entity | SERVICE | Additive migration design, CAS/concurrency and history tests |
| Template aggregate/lifecycle | Missing | SERVICE | Contract, persistence, authority, lifecycle and immutable-version tests |
| Moderation/safety provider | Missing/named owner required | Platform governance/moderation | Exact-version decision contract and bounded projection |
| Adoption and fork lineage | Missing | SERVICE destination Workspace | Persistence, explicit acceptance, lineage and no-cascade tests |
| Upgrade diff/acceptance | Missing | SERVICE | Semantic diff, country re-evaluation and explicit destination consent |
| Canonical six-model mapping | Contract vocabulary defined here; current catalogue is only partially compatible | SERVICE + Finance/Booking owners | Backward-compatible mapping and no historical reinterpretation |
| Destination country compatibility | Required provider composition not implemented | Core Country Pack/Jurisdiction + SERVICE consumer | Typed artifact resolution and exact hash/version receipt |
| Pricing/tax/invoice/rail resolution | Existing discovery reports gaps | Finance/Payments/Country Pack | Accepted local artifacts, adapter/config binding and zero-fallback tests |
| Benefits/Commerce/Loyalty ownership | `OPEN_PRODUCT_DECISION` | Product governance | Owner selection and separate entitlement/redemption contracts |
| Runtime API/UI | Not authorized by this package | SERVICE after prior dependencies | DB/API/browser/concurrency, role-bound pool and unknown-commit evidence |

## 14. Topological execution packages

The next packages must preserve this order; parallel work is allowed only where
it does not consume an unresolved owner or contract.

1. **`SV-SERVICE-ARCHETYPE-TAXONOMY-04` — contract only.** Define primitive,
   archetype identity/version, classification and Maintenance/CE exclusion
   rules with Platform taxonomy governance.
2. **`SV-REUSABLE-TEMPLATE-CONTRACT-05` — pure schemas and conformance.** Define
   strict declarative template, lifecycle, lineage, immutable hash and adoption
   command shapes. No persistence or route.
3. **`CORE-TEMPLATE-MODERATION-DECISION-01` — owner package.** Name the
   moderation/safety owner and provide an exact-version bounded decision. This
   may proceed beside step 2 but public publication cannot consume it early.
4. **`CORE-COUNTRY-TEMPLATE-COMPATIBILITY-01` — owner package.** Compose Property
   jurisdiction and typed Country Pack artifacts into an exact destination
   compatibility receipt. It must not copy policy into SERVICE.
5. **`SV-TEMPLATE-PERSISTENCE-06` — separately authorized migration.** Add the
   minimum versioned definition/template/adoption/lineage state using Core
   transaction, authority, idempotency, audit/outbox and unknown-commit
   contracts. No route or activation.
6. **`SV-TEMPLATE-ADOPTION-07` — inactive provider composition.** Bind exact
   moderation and country compatibility providers, destination authority and
   explicit adoption/fork/upgrade commands on disposable PostgreSQL.
7. **`SV-OFFERING-MODEL-ALIGNMENT-08` — compatibility package.** Map the six
   canonical commercial models onto existing Offerings without rewriting
   historical revisions; obtain Finance/Booking acceptance where required.
8. **`SV-TEMPLATE-MANAGEMENT-09` — inactive API/UI package.** Add discovery,
   review and destination configuration behind reviewed roles and a disabled
   rollout. It cannot create a payment, benefit redemption or provider account.
9. **`SV-TEMPLATE-RUNTIME-ACCEPTANCE-10` — evidence package.** Only after
   separately authorized migration/grants and provider acceptance, run real
   DB/API/browser/concurrency, cross-Workspace, replay, rollback and
   unknown-commit tests before any runtime claim.

`OPEN_PRODUCT_DECISION` may be resolved independently, but SERVICE must not
block its own paid Offering work by inventing a temporary benefit owner.

## 15. Future conformance matrix

| ID | Case | Required result |
| --- | --- | --- |
| MVC-01 | SERVICE Order/Booking/Purchase has exact Offering, terms and consent | Independent SERVICE identity and receipt |
| MVC-02 | Technical/statutory lift service submitted as SERVICE | Rejected or routed to Maintenance review; zero SERVICE Order |
| MVC-03 | Freight-lift move reservation | Valid SERVICE archetype candidate; no maintenance claim |
| MVC-04 | CE included breakfast shown beside paid breakfast | Two identities, consents, idempotency keys and receipts |
| MVC-05 | Allowance exhausted | Safe SERVICE Offering reference only; no automatic Order/charge |
| MVC-06 | Workspace authors definition from approved primitives | Exact archetype/primitive versions preserved |
| MVC-07 | Definition includes unknown primitive | Bounded contract denial; zero writes |
| MVC-08 | Publish without owner/provenance/version | Denied |
| MVC-09 | Publish without exact moderation decision | Denied; no public discovery |
| MVC-10 | Mutate published bytes | Denied; new version required |
| MVC-11 | Adopt a floating latest version | Denied |
| MVC-12 | Adopt exact published version/hash | Pinned destination adoption only |
| MVC-13 | Source publishes update | Existing adoption/Offering unchanged |
| MVC-14 | Destination explicitly upgrades | New adoption/Offering revision after full revalidation |
| MVC-15 | Fork accepted version | New identity with immutable lineage |
| MVC-16 | Source withdraws template | New adoption blocked; accepted Offering/history retained |
| MVC-17 | Template contains final price/currency/tax | Rejected as authoritative destination content |
| MVC-18 | Template contains provider, merchant, bank or secret | Rejected without disclosure |
| MVC-19 | Template contains entitlement or member/unit data | Rejected |
| MVC-20 | Template contains executable code/SQL/route/permission | Rejected |
| MVC-21 | Destination lacks provider/schedule/capacity | Configuration unavailable; zero writes |
| MVC-22 | Destination lacks canonical country | Jurisdiction unavailable; zero writes |
| MVC-23 | Locale/IP/timezone suggests country | Ignored; canonical Property jurisdiction required |
| MVC-24 | Required Country Pack artifact expired/unsupported | Compatibility denial; zero writes |
| MVC-25 | Source and destination countries differ | Destination policy wins; source policy transfers nothing |
| MVC-26 | Source template changes after destination Order | Historical Offering/Order/receipt unchanged |
| MVC-27 | Same adoption key and same full command | Exact replay; one effect set |
| MVC-28 | Same key with changed template/country/provider binding | Replay conflict; zero writes |
| MVC-29 | Authority revoked before mutation/replay | Current-authority denial; zero writes |
| MVC-30 | Two concurrent identical adoptions | One commit and one exact replay |
| MVC-31 | Provider/moderation failure before commit | Adoption, audit, outbox and idempotency completion roll back |
| MVC-32 | Commit acknowledgement lost | `READBACK_REQUIRED`; original key/command retained |
| MVC-33 | Food/bread/catering/car wash record | SERVICE history only unless separate technical evidence exists |
| MVC-34 | Technical service affects an asset | Purpose-limited canonical asset-history reference; histories remain separate |
| MVC-35 | Public template discovery probes another Workspace | Approved public projection only; no private existence/data leak |
| MVC-36 | Any test fixture passes | No runtime, legal, provider or country acceptance inferred |

## 16. Static drift contract

`scripts/test-service-member-value-catalog-templates-v1.mjs` enforces the
closed boundaries in this document and verifies the CI wiring. It is a static
architecture regression. It does not validate persistence, authority, provider
connectivity, payments, moderation decisions or Country Pack correctness.

The contract fails when the document drops the four layers, closed lifecycle,
six commercial models, prohibited template fields, destination-owned fields,
CE separation, Maintenance exclusions, country-source rule, immutable version
semantics or topological dependency order. It also verifies that the current
public SERVICE page retains capability wording and its CE handoff.

## 17. Explicit non-acceptance

This design does not create or authorize a migration, handler, route,
marketplace, provider network, payment wiring, permission, grant, credential,
Remote database operation, Production activation or merge. It does not prove
that the current catalogue migrations are remotely installed. It does not
resolve `OPEN_PRODUCT_DECISION`, publish a template, adopt a template, activate
an Offering or issue SERVICE, CE, Maintenance, Finance or Country Pack runtime
acceptance.
