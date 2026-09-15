# ADR-CLD-052 — Universal Managed-Property Workspaces

**Status:** Accepted for staged implementation  
**Date:** 2026-09-15  
**Decision owner:** CLADORA product architecture  
**Scope:** Architecture and product taxonomy only; no database or production change

## Context

CLADORA began with Romanian residential associations, but its shared operational core is also applicable to any managed property that has private spaces, common areas, shared costs, occupants or operators, facilities, access control and accountable management. The target therefore includes residential buildings and villa communities as well as mixed-use estates, shopping centres, offices, warehouses, logistics sites, townships and industrial parks.

The current repository already has tenant and workspace isolation, property/building/unit records, contextual authorization, accounting, billing, allocation, metering, maintenance, procurement, documents, communications, governance, occupancy and security-access capabilities. Those engines remain canonical. Expanding the addressable property types must not create a second identity, ledger, payment, maintenance or audit system.

The current `portfolio.property_type` enum is residential-only:

`condominium`, `residential_complex`, `villa`, `gated_community`, `mixed_residential`.

The current physical hierarchy is also unit-centric: property → building → entrance → unit. It cannot yet express zones, floors, retail premises, warehouse bays, industrial plots, common areas or shared infrastructure as first-class operational scopes.

## Decision

CLADORA adopts a universal managed-property workspace model. **Workspace** is the operational and security context; it is not a synonym for a physical building and it is not proof of legal ownership.

### Canonical hierarchy

The target hierarchy is:

`Portfolio → Workspace → Site/Estate → Building/Zone → Floor/Section → Space/Lot/Unit`

`Common Area`, `Shared Asset`, `Service Point` and `Meter` attach to the narrowest appropriate scope. Intermediate levels are optional so a small condominium is not forced to model an industrial estate's complexity.

Existing `portfolio.properties`, `portfolio.buildings`, `portfolio.entrances` and `portfolio.units` remain canonical identities. A forward-only implementation must extend or map them; it must not replace them or invalidate existing identifiers.

### Property profiles

| Profile code | Managed-property form | Typical private space | Typical shared scope |
| --- | --- | --- | --- |
| `RESIDENTIAL_CONDOMINIUM` | condominium or apartment block | apartment | entrance, lift, roof, plant room |
| `RESIDENTIAL_COMPLEX` | multi-building residential estate | apartment | roads, gardens, parking, amenities |
| `GATED_VILLA_COMMUNITY` | villa/HOA community | villa or parcel | perimeter, roads, pumps, landscape |
| `MIXED_USE_COMPLEX` | residential, retail and office mix | unit or premises | podium, parking, utilities, public areas |
| `RETAIL_CENTRE` | shopping mall or retail park | shop/premises | mall areas, advertising, loading, security |
| `OFFICE_CENTRE` | office building or business campus | suite/office | reception, meeting space, HVAC, access |
| `WAREHOUSE_LOGISTICS` | warehouse or logistics centre | bay/warehouse | yard, loading docks, gates, fire systems |
| `INDUSTRIAL_PARK` | industrial estate or zone | plot, hall or factory | roads, substations, security, common utilities |
| `MANAGED_TOWNSHIP` | multi-use managed district | parcel/unit/premises | roads, landscape, community infrastructure |
| `SERVICED_RESIDENCE` | student, co-living or serviced housing | room, bed or unit | shared living, services and amenities |
| `SHARED_FACILITY` | standalone parking or managed facility | bay/licence area | access, equipment and shared service |

Property profile describes operational topology. It does not determine legal ownership, accounting entity or management authority.

### Operating models

Each workspace independently selects an effective-dated operating model:

- condominium association or HOA;
- single owner;
- group-owned property;
- master-leased or leased-and-operated property;
- third-party fee/contract management;
- facility-management mandate; or
- hybrid governance and management.

AIRPROP owns investment, property-interest, underwriting and management-mandate semantics. CLADORA owns day-to-day property operations. Both reuse the shared `platform`, `identity`, `portfolio`, accounting, payment, document and audit foundations.

### Occupant and beneficiary model

Resident is one persona, not the universal identity model. The target experience must support owner, tenant, resident, household member, occupant, merchant, office tenant, warehouse operator, employee, facility manager, contractor, security officer, supplier, visitor and delivery driver.

Authorization remains derived from authenticated membership, role, effective context and scoped relationships. A label change in the UI never broadens database authorization.

### Resident and occupant experience

The common experience layer may expose, subject to role and workspace entitlement:

- profile, household or organization context;
- statements, charges, payments, receipts and allocation evidence;
- meter readings, consumption history and anomaly review;
- maintenance requests, SLA progress and resident/operator feedback;
- announcements, documents, meetings, voting and decisions;
- visitor, contractor, delivery, vehicle and parking access;
- credentials, keys, fobs and access history;
- amenity, shared-space and service reservations;
- concierge, parcel, emergency and community services.

Terminology is profile-aware: for example `unit` may be presented as apartment, shop, office, warehouse, bay or industrial lot. Presentation vocabulary does not change canonical IDs or accounting meaning.

### Charge and cost-allocation model

The existing versioned allocation and owner/tenant responsibility engines remain authoritative. Future extensions may add bases for floor area, ownership share, occupant count, measured consumption, parking or storage rights, commercial coefficients, zone/service-point participation, fixed fees, contractual schedules and composite formulas.

Every allocation must remain explainable, effective-dated, reproducible and zero-difference. Profile selection must never silently change a posted allocation or journal.

### Building DNA

Building DNA remains the technical configuration layer, separate from property profile and operating model. It describes characteristics such as age, envelope, heating, risers, BMS, metering, EV charging, pumps, wastewater, loading infrastructure, fire systems and shared amenities. Rules may consume an approved Building DNA version; automated recommendations remain advisory until accepted by an authorized actor.

## Non-negotiable invariants

- Tenant isolation, active workspace and context grants remain fail closed.
- One physical or legal record has one canonical identity; profile-specific modules may not duplicate it.
- Posted journals and accepted allocation evidence remain immutable.
- Shared charges must identify source, scope, basis, formula version and responsible party.
- Common areas and shared assets cannot be represented as fake residents or fake apartments.
- Legal ownership, occupancy, operating authority and payment responsibility remain separate relationships.
- A property profile cannot confer permission or management authority.
- Country-specific legal and fiscal rules belong to versioned country packs.
- Romanian condominium-law claims apply only to eligible Romanian association workspaces.
- No autonomous system may approve legal acts, bank changes, payouts or high-impact financial decisions.

## Staged implementation boundary

1. **Taxonomy and compatibility contract:** introduce stable profile, space-kind and operating-model codes without changing existing behavior.
2. **Topology extension:** add optional site, zone, floor/section, space, common-area, shared-asset and service-point scopes.
3. **Authorization extension:** extend context grants and read/write projections to the new scopes with cross-tenant negative tests.
4. **Allocation extension:** add versioned non-residential allocation bases and deterministic reconciliation.
5. **Experience profiles:** expose entitlement-driven vocabulary and modules in RO/EN/FA.
6. **Synthetic pilots:** accept residential, mixed-use, retail/logistics and industrial fixtures before any real customer activation.

Each stage requires its own migration, pgTAP suite, application tests, security review and separately approved release gate.

## Deferred boundaries

- No schema migration or Supabase apply is authorized by this ADR.
- No existing residential enum value or record is rewritten.
- No real mall, warehouse, township or industrial customer data is created.
- No legal compliance is claimed for a new property class or country without qualified review.
- Amenity booking, parcel handling and concierge workflows are target capabilities, not declared production-complete by this decision.

## Consequences

CLADORA can evolve from Residential Asset OS into a configurable Managed-Property Operating System while preserving the proven residential core. The cost is a controlled topology and vocabulary extension, broader role modelling, new allocation bases and additional acceptance fixtures. Product marketing must continue to distinguish implemented production behavior from documented target capability.

