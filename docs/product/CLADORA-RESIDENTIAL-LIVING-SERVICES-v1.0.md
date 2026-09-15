# CLADORA Residential Living & Services v1.0

**Status:** Product architecture baseline
**Date:** 2026-09-15
**Reference benchmark:** ONE residential ecosystem, Romania
**Scope:** Documentation only; no implementation, integration or affiliation claim

## Purpose

Define the resident-facing service layer for residential buildings, compounds and villa communities. This layer sits above CLADORA's canonical property, accounting, maintenance, access and communications engines and turns them into a coherent day-to-day living experience.

## ONE benchmark clarification

The earlier product discussion used ONE/One United Properties as a Romanian market example. Two distinct patterns must not be conflated:

1. **One United Smart Home pattern — residential operations:** administrative and utility payments, payment notifications, useful contacts and direct communication with the residential administrator. ONE also described future-facing metering, access and temperature-control capabilities.
2. **One Community pattern — lifestyle and community:** a digital membership experience for residents, tenants, employees and eligible clients, including partner benefits, discounts, events, updates, digital cards, membership tiers, rewards and O Points.

CLADORA uses these only as comparative product evidence. It does not copy ONE branding, proprietary design, content, loyalty rules or software, and it does not claim partnership or integration.

Official public references reviewed:

- <https://www.one.ro/en/blog/one-united-smart-home-application/>
- <https://www.one.ro/en/community/>

## Product boundary

CLADORA separates the residential experience into three connected but independently entitled layers:

| Layer | Responsibility | Canonical systems reused |
| --- | --- | --- |
| Residential Operations | charges, utilities, maintenance, documents and administrator communication | billing, payments, metering, maintenance, documents, communications |
| Building Services | access, visitors, parking, amenities, parcels, concierge and emergency workflows | security access, assets, work orders, notifications, audit |
| Community & Lifestyle | events, benefits, partner offers, optional membership and rewards | communications plus future bounded service catalog |

Community or commercial benefits must never alter accounting balances, governance rights or building access unless a separately authorized operational command succeeds.

## Residential service catalog

### Financial and administrative

- monthly statement, shared charges and utility lines;
- payment, receipt and payment-status history;
- transparent allocation basis and owner/tenant responsibility;
- reserve fund, repair fund and approved capital projects;
- issue or clarification request against a charge;
- administrative contacts and secure communication.

### Utilities and smart-building experience

- resident meter submission with evidence;
- consumption history and anomaly notification;
- administrator review and monthly reconciliation;
- optional BMS, temperature, EV charging and smart-meter adapters;
- no direct device control until a separately secured integration is approved.

### Maintenance and in-unit services

- incident and maintenance request with location, severity and evidence;
- emergency classification and building-wide impact flag;
- assignment to internal staff or an approved vendor;
- SLA, estimate, approval, completion and resident feedback;
- explicit payer and legal-debtor determination;
- optional hand-off to REZOLVIO for resident-requested marketplace services.

### Access, visitors and mobility

- resident and household credentials;
- time-bound guest, contractor and delivery access;
- vehicle, parking bay and barrier permissions;
- lost, suspended, expired, revoked and returned credential states;
- access-event history bounded by role and legitimate purpose;
- optional QR, mobile or Bluetooth adapters behind separate security approval.

### Amenities, concierge and parcels

- bookable rooms, gym, pool, sports, rooftop, barbecue and guest facilities;
- availability, capacity, eligibility, fee, deposit and cancellation rules;
- parcel arrival, custody acknowledgement and collection notification;
- concierge requests and approved building services;
- damage, no-show and exception handling with audit evidence.

### Communications and community

- building, entrance, zone or audience-scoped notices;
- read acknowledgement for important messages;
- meetings, agendas, decisions, surveys and eligible voting;
- community events and optional interest groups;
- verified service-provider directory;
- emergency and planned-interruption broadcasts.

### Optional lifestyle and partner benefits

- partner directory, offers and eligibility;
- digital membership card and tier display;
- events, experiences and benefit redemption;
- optional points/rewards ledger that is strictly separate from financial accounting;
- consent-controlled commercial communication and unsubscribe controls.

This layer is optional. A condominium can use CLADORA fully without loyalty, advertising or partner programs.

## Developer-sponsored service and benefit network

The ONE example represents more than a list of building amenities. A developer, parent company, portfolio owner or operating brand may sponsor a benefit network across several properties and participating service providers. Eligibility originates from a verified relationship with that ecosystem—for example ownership, current residence, tenancy, employment or an approved client relationship.

Typical participants include:

- cafés and restaurants inside the development;
- grocery, convenience and specialist shops;
- gyms, pools, wellness and beauty providers;
- childcare, education and family services;
- cleaning, repairs and home services;
- mobility, parking, charging and transport services;
- events, experiences and external partner businesses.

This becomes a distinct CLADORA product system named **Workspace Services & Benefits**. It supports both services physically located in a property and benefits shared across a developer or operator's wider portfolio.

### Network hierarchy

`Sponsor Organization → Benefit Network → Participating Workspaces → Service Providers → Locations → Offers/Services → Eligible Members`

- **Sponsor Organization:** developer, parent company, portfolio owner, association group or operator.
- **Benefit Network:** the branded program and its rules.
- **Participating Workspace:** eligible building, block, estate, mall or managed site.
- **Service Provider:** internal operator or approved external partner.
- **Location:** café, shop, gym, reception, facility or online service point.
- **Offer/Service:** discount, included service, paid service, reservation, reward or event.
- **Eligible Member:** verified owner, resident, tenant, employee, client or delegated family member.

### Eligibility and digital card

Eligibility is derived from an effective, verified relationship and must not be asserted only by the browser. A membership record references its source relationship and effective period. The digital card may expose a rotating QR or other revocable presentation token, but it is not itself proof of ownership or a general building-access credential.

Supported examples include:

- owner card while an ownership interest is effective;
- resident or tenant card while occupancy/lease eligibility is effective;
- family card delegated by an eligible member;
- employee or operator card issued by an authorized sponsor;
- invited client tier approved through a controlled workflow.

When the source relationship expires, the system recalculates or ends benefit eligibility without deleting historical redemption evidence.

### Offer and service types

| Type | Example | Accounting boundary |
| --- | --- | --- |
| Included benefit | free gym access for eligible residents | entitlement evidence; no resident charge unless contract says otherwise |
| Percentage discount | 15% at an on-site café | provider transaction; discount evidence only |
| Fixed-price service | preferred cleaning package | provider/service order; separate from building charges |
| Reservation priority | early access to a shared facility | booking entitlement |
| Event access | resident-only event | attendance/eligibility evidence |
| Points/reward | points earned on eligible interaction | non-cash rewards ledger, isolated from GL |
| Building-sponsored subsidy | developer covers part of a service | explicit sponsor liability and approved settlement evidence |

### Redemption flow

1. Resolve the member and active workspace relationship server-side.
2. Validate network, tier, offer, location, time window and usage limits.
3. Present or scan a short-lived card token without exposing resident data.
4. Record an idempotent redemption and the applied benefit.
5. If financial settlement is required, create a bounded settlement intent for independent accounting—not a direct journal from the scan.
6. Preserve consent, audit and dispute evidence.

### Multi-workspace rule

A benefit network can span many workspaces, while each property continues to have independent tenant, accounting, access and governance boundaries. Cross-portfolio eligibility is an explicit sponsor entitlement; it does not create cross-tenant data visibility.

### Automation boundary

The system may automatically calculate eligibility, display applicable offers, enforce limits, expire memberships and record redemptions. It may not autonomously change ownership, occupancy, building-access authority, provider bank details, settlement approval or posted accounting entries.

## Personas

| Persona | Typical access |
| --- | --- |
| Owner | legal charges, ownership evidence, governance and unit services |
| Tenant/resident | permitted charges, consumption, requests, access and amenities |
| Household member | delegated access and selected services only |
| Association administrator/property manager | operations, service configuration and case handling |
| President/censor | approval and oversight according to law and role |
| Concierge/security | bounded parcel, visitor and incident operations |
| Contractor/vendor | assigned work and time/location-limited access |
| Community member | optional benefits and events; no automatic property authority |

Membership in a lifestyle program is not evidence of residency, ownership, occupancy or authorization.

## Service-package model

| Package | Illustrative capabilities |
| --- | --- |
| `ESSENTIAL` | statements, notices, meters, documents and maintenance requests |
| `SECURE` | credentials, visitors, deliveries, parking and access evidence |
| `COMMUNITY` | meetings, surveys, voting, events and shared communication |
| `COMFORT` | amenities, parcels, concierge and resident-requested services |
| `SMART_BUILDING` | BMS, smart meters, EV and approved device adapters |
| `LIFESTYLE` | partner offers, benefits, membership and optional rewards |

Packages are commercial presentation. Runtime access is granted only by explicit workspace entitlements, role permissions and valid context.

## Safety, privacy and accounting rules

- The database, not the browser, authorizes every property operation.
- Household delegation is explicit, time-bound where appropriate and revocable.
- Visitor, access and parcel data follow minimization and retention rules.
- Marketing consent is separate from operational notices and security alerts.
- Rewards or points are not cash, resident balances, reserve funds or posted journals.
- A marketplace provider never gains general building or resident access.
- Device-control integrations require a separate threat model, credential boundary and fail-safe behavior.
- Sensitive actions retain audit evidence and require AAL2/independent approval where applicable.

## Current-state classification

| Area | Repository status |
| --- | --- |
| Statements, allocations, payments and receipts | Production-backed foundation exists |
| Metering and utility validation | Production-backed foundation exists |
| Maintenance and vendor workflows | Production-backed foundation exists |
| Notices, governance and documents | Production-backed foundation exists |
| Credentials, visitors and access logs | Production-backed foundation exists |
| Resident/owner/tenant contextual dashboards | Production-backed foundation exists |
| Amenity reservations | Target capability; bounded context not yet implemented |
| Concierge and parcel custody | Target capability; not yet implemented |
| Developer-sponsored benefit networks, cards, tiers and rewards | Comparative target capability; separate bounded system not yet implemented |
| Smart-home device control | Deferred integration; not implemented |

## Proposed staged packages

1. `CLADORA-RESIDENT-SERVICE-CATALOG-001` — service definitions, entitlements and profile applicability.
2. `CLADORA-AMENITIES-BOOKING-001` — resources, availability, reservations, approvals, fees and exceptions.
3. `CLADORA-CONCIERGE-PARCELS-001` — requests, parcel custody and resident notification.
4. `CLADORA-WORKSPACE-SERVICES-BENEFITS-001` — sponsor networks, participating workspaces, providers, eligibility, digital cards, offers and redemption evidence.
5. `CLADORA-SMART-BUILDING-ADAPTERS-001` — provider-neutral device and BMS contract.

Each package requires separate approval, synthetic fixtures, RO/EN/FA acceptance and an explicit release gate. No migration or test number is reserved by this document.
