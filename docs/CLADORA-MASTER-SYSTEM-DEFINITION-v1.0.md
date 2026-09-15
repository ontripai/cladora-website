# CLADORA Master System Definition v1.0

**Document ID:** `CLADORA-DOC-SYSTEM-001`
**Status:** Authoritative system-scope and architecture reference
**Effective date:** 2026-09-15
**Repository:** `ontripai/cladora-website`
**Reviewed production baseline:** `9b561e87823d920c93c4143f7d65e1e0c684a266`
**Change class:** Documentation; no migration, remote configuration or production mutation

## 1. Authority

This document is the parent definition of the CLADORA product system and its AIRPROP extension. It governs product scope, bounded contexts, shared-core ownership, dynamic workspace composition and the distinction between implemented capability and target architecture.

Existing ADRs, roadmaps, implementation plans, closure reports and tests remain preserved as subordinate evidence. Where earlier documents describe CLADORA only as a Residential Asset Operating System, that wording remains historically correct for the current pilot roadmap; this document expands the authoritative product scope to a Universal Property Operations & Services OS without declaring unimplemented profiles production-ready.

Authority order:

1. applicable law, executed contracts and approved security policies;
2. immutable database/accounting/audit evidence for actual runtime state;
3. this Master System Definition for product and architecture scope;
4. accepted ADRs and versioned domain contracts;
5. current roadmap and separately approved implementation/release packages;
6. marketing, demo and illustrative content.

Code or documentation never overrides law or an executed customer agreement. Target architecture does not prove implementation.

## 2. Canonical product definition

> **CLADORA is a configurable operating system for the management, operation, accounting, servicing and accountable governance of any managed property—from one villa or a small multi-unit owner to residential associations, developer portfolios, mixed-use estates, malls, offices, warehouses, townships and industrial parks. AIRPROP is the investment, ownership, underwriting and asset-lifecycle system built on the same shared core.**

Canonical positioning:

- **CLADORA — Universal Property Operations & Services OS**
- **AIRPROP — Property Investment & Asset Lifecycle OS**

CLADORA answers: **How is this property operated, serviced, accounted for and experienced?**
AIRPROP answers: **Why and under what ownership, investment, mandate or exit strategy is this property acquired, held, operated or sold?**

## 3. System principles

1. **One shared truth:** one identity foundation, property registry, ledger, payment/reconciliation system, document vault and audit trail.
2. **Dynamic composition:** workspaces are composed from registered objects, modules, entitlements, roles and scoped assignments.
3. **Configuration over forks:** property types adapt the same core; they do not create separate applications or duplicate ledgers.
4. **Fail-closed authority:** the server and database revalidate identity, context, scope, entitlement, role, relationship and assurance.
5. **Explainable finance:** every charge, allocation, payment, reconciliation and close is reproducible and auditable.
6. **Human authority for high impact:** legal acts, money movement, ownership, bank changes and sensitive approvals remain controlled.
7. **Country packs:** legal, fiscal, document and terminology rules are versioned and effective-dated outside the shared core.
8. **Incremental proof:** a profile is production-supported only after its migration, tests, security review and acceptance gate pass.

## 4. Product system map

| System | Responsibility | Examples |
| --- | --- | --- |
| Platform Control Plane | internal platform operation | tenants, contracts, plans, provisioning, support, audit oversight |
| Workspace & Identity | customer operational boundary | memberships, context grants, roles, assignments, MFA/AAL |
| Property & Occupancy | canonical physical and relationship truth | properties, buildings, spaces, ownership, leases, occupants |
| Finance & Collections | accountable money and period truth | ledger, billing, allocations, payments, bank reconciliation, close |
| Property Operations | physical operation | assets, maintenance, vendors, procurement, utilities, documents |
| Governance & Communications | decisions and information | meetings, votes, notices, evidence and approvals |
| Security & Access | people and entry lifecycle | credentials, visitors, contractors, delivery, vehicles and logs |
| Living & Occupant Services | day-to-day user experience | requests, amenities, concierge, parcels and resident services |
| Workspace Services & Benefits | sponsor/portfolio service ecosystem | providers, locations, cards, offers, discounts, events and rewards |
| Export & Assurance | controlled output and evidence | Romanian packs, private storage, malware scanning and observability |
| AIRPROP | investment and asset lifecycle | opportunity, underwriting, property interest, mandate and disposal |

## 5. Universal workspace model

A Workspace is the active operational and security context. It may represent one property, part of a property, a managed estate or an authorized portfolio view. It is not automatically a legal entity, ownership claim or physical building.

Target physical hierarchy:

`Portfolio → Workspace → Site/Estate → Building/Zone → Floor/Section → Space/Lot/Unit`

`Common Area`, `Shared Asset`, `Service Point`, `Meter`, `Amenity`, `Provider Location` and other registered objects attach at the narrowest valid scope. Intermediate layers are optional.

### 5.1 Independent configuration axes

Every workspace is determined through independent, versioned axes:

| Axis | Question | Examples |
| --- | --- | --- |
| Property Profile | What environment is managed? | condominium, mall, warehouse, industrial park |
| Operating Model | Under whose authority is it operated? | HOA, single owner, master lease, management mandate |
| Building DNA | How do its technical systems behave? | risers, BMS, HVAC, pumps, meters, access infrastructure |
| Service Profile | What services are offered? | essential, secure, comfort, smart building, lifestyle |
| Country Pack | Which jurisdictional rules apply? | Romania, future Dubai |

No axis may silently infer authorization, ownership or another axis.

### 5.2 Supported target profiles

- residential condominium or apartment block;
- multi-building residential complex;
- gated villa/HOA community;
- individual villa or small landlord portfolio;
- mixed residential, retail and office estate;
- shopping mall or retail centre;
- office/business centre;
- warehouse and logistics centre;
- managed township or district;
- industrial park or industrial zone;
- student, co-living or serviced residence;
- standalone parking or shared facility;
- developer, institutional owner or third-party manager portfolio.

The current production property enum remains residential-oriented. Non-residential profiles are target architecture until separately implemented and accepted.

## 6. Dynamic object and module composition

The canonical composition is:

`Workspace → Scoped Objects → Enabled Modules → Effective Entitlements → Workspace Roles → User/Group Assignments`

### 6.1 Dynamic objects

Workspace administrators create instances from platform-registered object types. An object type has a versioned schema, allowed parents, owning module, lifecycle, validation rules, vocabulary and authorization projection. Dynamic does not mean arbitrary SQL tables, executable code or unrestricted JSON.

Examples include building, block, entrance, floor, zone, apartment, shop, office, warehouse bay, industrial lot, common area, shared asset, meter, amenity, café, gym, provider location and service point.

### 6.2 Modules

A module declares supported profiles/object types, dependencies, incompatibilities, permissions, entitlement keys, limits, configuration schema, approval policy, localization keys, audit events and data-retention behavior.

Modules include accounting, billing, payments, bank reconciliation, maintenance, utilities, assets, occupancy, governance, communications, documents, procurement, security access, amenities, concierge, benefits and AIRPROP experiences.

### 6.3 Entitlements

Entitlements are effective-dated rights and limits derived from platform policy and workspace contract. They may enable a module, feature or capacity such as maximum properties, users, storage, bookings or benefit networks. A property profile alone never activates a module.

### 6.4 Workspace roles and assignments

An authorized workspace administrator may create local role names, select delegable permissions available to the workspace and assign the role to users or groups at tenant, property, site, building, zone, space or object scope.

The administrator cannot:

- create platform permission codes;
- enable unavailable modules;
- exceed contracted entitlements;
- delegate more authority than their own delegable authority;
- assign platform-internal or reserved roles;
- bypass AAL2, independent approval or audit requirements;
- expand scope across another tenant.

Effective authorization is:

`Platform Policy ∩ Active Workspace ∩ Module ∩ Entitlement ∩ Role ∩ Assignment ∩ Scope ∩ Relationship/Condition ∩ AAL/Approval`

Any missing mandatory factor results in denial.

## 7. Property operations

The common property-operation layer supports:

- double-entry accounting and immutable journals;
- billing, receivables and explainable cost allocation;
- collections, bank import, matching, exceptions and zero-difference reconciliation;
- monthly cycle, approvals, reporting and immutable close;
- utilities, meter readings, consumption validation and evidence;
- assets, planned/reactive maintenance and SLA;
- vendors, service contracts, procurement and purchase orders;
- documents, retention, private storage and scan attestations;
- access points, credentials, visitors, contractors, deliveries and vehicles;
- communications, meetings, resolutions, voting and audit evidence;
- onboarding, setup, opening-balance rehearsal and activation gates.

Profile-specific vocabulary and scope adapt these engines without replacing them.

## 8. Charge and responsibility model

Allocations may use ownership share, floor area, occupant count, measured consumption, parking/storage rights, commercial coefficients, zone or service participation, contractual schedules, fixed fees or composite formulas.

Every accepted allocation must identify source, period, scope, basis, formula version, responsible legal debtor, operational payer, amount and reconciliation evidence. Profile or configuration changes cannot rewrite accepted evidence or posted journals.

Ownership, occupancy, operating authority, benefit membership, physical access and payment responsibility remain separate relationships.

## 9. Living and occupant services

The service experience supports owners, residents, tenants, household members, merchants, office tenants, warehouse operators, employees, facility teams, contractors, visitors and delivery agents according to role and context.

Service families include:

- statements, payments, receipts and allocation explanations;
- meter submission and consumption history;
- maintenance and in-unit service requests;
- notices, documents, meetings, surveys and eligible voting;
- visitor, contractor, delivery, vehicle and parking access;
- amenity and shared-space reservations;
- concierge, parcel custody and emergency services;
- community events and approved service directories.

The current repository has production-backed foundations for financial, metering, maintenance, communications, documents, governance and security-access experiences. Amenity booking, concierge and parcel custody remain target bounded contexts.

## 10. Workspace Services & Benefits

A developer, parent company, portfolio owner, association group or operator may sponsor services and benefits across one or many participating workspaces.

Canonical network:

`Sponsor → Benefit Network → Participating Workspace → Provider/Location → Offer/Service → Eligible Member → Redemption`

Examples include cafés, restaurants, shops, gyms, pools, wellness, childcare, cleaning, home services, mobility, parking, charging, events and external partners. Eligibility may derive from verified ownership, residence, tenancy, employment, client status or controlled family delegation.

The system may provide digital cards, membership tiers, included services, discounts, reservation priority, events and non-cash rewards. Membership does not prove ownership, occupancy or access authority. A benefit scan cannot directly post a journal or move money. Sponsor/provider settlement requires separately authorized financial evidence.

Cross-workspace benefits never create cross-tenant access to operational records.

## 11. AIRPROP

AIRPROP is a product experience on the shared CLADORA platform. It supports:

- purchase and sale of group-owned real estate;
- letting and operation of owned or leased real estate;
- third-party property management for a fee or under contract;
- opportunities, versioned underwriting and due diligence;
- property interests and operating models;
- acquisition, asset-management and disposal lifecycles;
- management mandates, approval limits and evidence;
- effective-dated Romania and future Dubai country packs.

AIRPROP does not create a second identity system, property registry, ledger, payment rail, document vault, maintenance engine or audit log. AI and automation remain advisory until accepted by an authorized human where financial or legal consequences exist.

## 12. Security and assurance

- authenticated, active and time-valid membership;
- server-authoritative context selection;
- tenant, property and object-scope isolation;
- role plus contextual relationship controls;
- explicit module entitlement;
- AAL2/TOTP for designated sensitive actions;
- segregation of duties and independent approval;
- idempotency and transactional zero-partial-write behavior;
- no-store, same-origin and request-size controls;
- immutable and privacy-bounded audit evidence;
- private export storage, quarantine and fail-closed scan gates;
- deterministic denial/error codes suitable for RO/EN/FA presentation.

## 13. Automation model

Automation may classify, calculate, recommend, route, notify, expire, reconcile and prepare evidence within an approved policy. Automation may not independently perform a legal act, change ownership, approve its own work, alter bank details, move client money, finalize a controlled payout or conceal unresolved exceptions.

Each automated action declares its input evidence, policy version, confidence or deterministic rule, human approval requirement, idempotency key, resulting state and audit event.

## 14. Country-pack model

Core objects and workflows remain country-neutral. Country packs provide versioned terminology, legal applicability, accounting mappings, taxes, document templates, retention rules and approval requirements.

Romania is the first operational jurisdiction. Dubai is architecture-ready but not activated merely by this document. Qualified local legal and accounting review remains mandatory before jurisdiction-specific production claims.

## 15. Current-state classification

| Classification | Meaning |
| --- | --- |
| `PRODUCTION-BACKED` | implemented, migrated and supported by accepted evidence |
| `IMPLEMENTED-PENDING-GATE` | code exists but a release, external review or operational gate remains |
| `ARCHITECTURE-READY` | accepted design and boundaries exist; implementation is not claimed |
| `DEFERRED-INTEGRATION` | provider, credential, device or legal activation intentionally deferred |
| `NOT-AUTHORIZED` | no implementation or external mutation may occur without separate approval |

The residential pilot roadmap and closure reports determine exact production readiness for their stages. This master document does not upgrade any capability's status.

## 16. Delivery and release governance

Every implementation package follows:

1. read-only discovery and immutable baseline;
2. independent branch and bounded scope;
3. forward-only migration when required;
4. transactional pgTAP and application tests;
5. RO/EN/FA and RTL acceptance where user-facing;
6. CI and one controlled preview where applicable;
7. separately authorized remote apply;
8. Local/Remote migration parity and zero drift;
9. security-advisor and production verification;
10. separately authorized Ready and Squash Merge;
11. closure report with evidence links and deferred boundaries.

Real customer data, external providers, credentials, money movement and legal/compliance claims require explicit additional authorization.

## 17. Controlled subordinate documents

| Document | Role |
| --- | --- |
| `architecture/ADR-CLD-052-universal-managed-property-workspaces.md` | universal property and workspace decision |
| `architecture/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-v1.0.md` | objects, modules, entitlements, roles and assignments |
| `product/CLADORA-RESIDENTIAL-LIVING-SERVICES-v1.0.md` | resident services and developer-sponsored benefit model |
| `roadmap/CLADORA-UNIVERSAL-WORKSPACE-RECON-001-v1.0.md` | repository evidence and implementation gap matrix |
| `roadmap/CLADORA-MASTER-PRODUCT-ROADMAP-v1.1.md` | current residential execution stages and gates |
| `airprop/ADR-AIRPROP-001-platform-boundary.md` | AIRPROP boundary and shared-core ownership |
| `airprop/AIRPROP-DOMAIN-MODEL-v1.0.md` | AIRPROP lifecycle and domain model |
| `airprop/AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md` | Romania/Dubai jurisdiction contract |

All prior ADRs, migration plans, acceptance reports and closure evidence remain valid within their original scope unless a later accepted version explicitly supersedes them.

## 18. Controlled implementation sequence

1. `CLADORA-WORKSPACE-TAXONOMY-001`
2. `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001`
3. `CLADORA-PROPERTY-TOPOLOGY-001`
4. `CLADORA-OCCUPANT-PERSONA-001`
5. `CLADORA-NONRES-ALLOCATION-001`
6. `CLADORA-RESIDENT-SERVICE-CATALOG-001`
7. `CLADORA-AMENITIES-BOOKING-001`
8. `CLADORA-CONCIERGE-PARCELS-001`
9. `CLADORA-WORKSPACE-SERVICES-BENEFITS-001`
10. synthetic mixed-use and logistics/industrial acceptance packages.

Sequence numbers do not reserve migration or test numbers. Each package remains blocked until separately authorized.

## 19. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-09-15 | Established the authoritative universal CLADORA/AIRPROP system definition; reconciled dynamic workspace composition, property profiles, resident services and sponsor benefit networks with the existing residential core. |

## 20. Governing verdict

`CLADORA-MASTER-SYSTEM-DEFINITION-v1.0-AUTHORITATIVE`

`ARCHITECTURE-READY / IMPLEMENTATION-BY-SEPARATE-CONTROLLED-PACKAGE`
