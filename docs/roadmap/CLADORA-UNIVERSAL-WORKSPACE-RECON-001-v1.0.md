# CLADORA-UNIVERSAL-WORKSPACE-RECON-001 — Evidence and Gap Matrix v1.0

**Verdict:** `ARCHITECTURE-READY / IMPLEMENTATION-NOT-AUTHORIZED`  
**Baseline:** `origin/main` at `9b561e8`  
**Review date:** 2026-09-15  
**Change class:** Documentation only

## Objective

Reconcile the previously described Building DNA, workspace, resident experience and multi-property concepts with the repository's current production-backed structures, then establish a controlled implementation boundary for residential, commercial, mixed-use, logistics, township and industrial property operations.

## Repository evidence reviewed

| Evidence | Finding |
| --- | --- |
| `portfolio.properties`, `buildings`, `entrances`, `units` | Canonical physical registry exists and is tenant-bound, but its property enum and hierarchy are residential/unit-centric. |
| `platform.customer_workspaces` and workspace entitlements | Reusable operational boundary, lifecycle and module-entitlement foundation exist. |
| `identity.context_grants` and customer context RPCs | Property/building/unit-scoped, AAL2 and server-authoritative context foundation exists. |
| `BuildingArchetypesSection` | Six technical/residential archetypes are presented: legacy block, rehabilitated block, transition building, modern complex, gated villas and individual villa. |
| `SavingsCalculator` | Building DNA coefficients exist as marketing/interactive estimates for five residential archetypes; they are not authoritative operational configuration. |
| Accounting, billing, allocation, payments and reconciliation ADRs | Reusable immutable financial and allocation engines exist. |
| Metering, maintenance, procurement, documents and security-access ADRs | Reusable operational engines exist. |
| Occupancy registry and role-aware dashboard | Owner, resident and tenant-resident experiences exist; general commercial operator personas do not. |
| AIRPROP shared-core ADR and domain model | Investment and management semantics explicitly reuse CLADORA property, identity, ledger and audit truth. |

## Reconciliation matrix

| Capability | Status | Evidence/current boundary | Required controlled extension |
| --- | --- | --- | --- |
| Tenant isolation | `MATCH` | tenant-bound schemas, RLS and validated context | Preserve unchanged; add negative tests for every new scope. |
| Workspace lifecycle | `MATCH` | customer workspace, provisioning, assignments and entitlements | Add profile and operating-model configuration without using them as authorization. |
| Dynamic object composition | `PARTIAL` | workspaces, entitlements, modules and fixed property objects exist | Add registered object types, dependency validation and versioned object schemas. |
| Workspace-local role design | `PARTIAL` | canonical roles, permission mappings and scoped assignments exist | Allow constrained local roles without permitting new capability codes or privilege escalation. |
| Residential property registry | `MATCH` | property/building/entrance/unit | Preserve identifiers and backward compatibility. |
| Residential Building DNA | `MATCH-PRESENTATION` | six archetypes and five calculator coefficients | Promote only through a versioned, reviewed operational contract. |
| Villa/HOA operations | `PARTIAL` | gated-community types and parcel-oriented copy exist | Add parcel/lot scope, common infrastructure and HOA acceptance fixture. |
| Mixed-use property | `PARTIAL` | `mixed_residential` exists | Separate residential, retail, office and shared-service participation. |
| Mall/retail centre | `MISSING` | no canonical retail premises or mall-zone profile | Add retail-space vocabulary, zones, loading/access and commercial allocations. |
| Office/business centre | `MISSING` | no office suite or organization-occupant profile | Add office space, company occupancy and employee access relationships. |
| Warehouse/logistics | `MISSING` | no warehouse bay, yard or loading topology | Add logistics space kinds, vehicle/loading scopes and safety assets. |
| Township/managed estate | `PARTIAL` | property can contain multiple buildings | Add site/estate and shared infrastructure above/between buildings. |
| Industrial park | `MISSING` | no plot, factory or industrial-zone scopes | Add plots, halls, shared utilities, service points and industrial operator roles. |
| Common areas | `PARTIAL` | operational modules infer building/unit scope | Model common areas directly; never as synthetic apartments. |
| Shared assets | `PARTIAL` | asset/maintenance engine exists | Add canonical attachment to site, zone, common area and service point. |
| Generic space taxonomy | `MISSING` | `unit` is the only private-space abstraction | Introduce compatible space-kind codes or a mapped extension. |
| Owner/tenant responsibility | `MATCH` | versioned allocation evidence and legal debtor/operational payer separation | Extend to lessor, lessee/operator and management mandate without rewriting history. |
| Non-residential charge bases | `PARTIAL` | generic rule/evidence engine exists | Add area, coefficient, service participation, contract and composite bases. |
| Residents and occupants | `MATCH-RESIDENTIAL` | parties, ownership, leases, occupancies and residents | Generalize presentation and relationships for merchants, companies and operators. |
| Resident self-service | `PARTIAL` | statements, meters, dashboard, communications and access views exist | Add request, reservation, parcel and concierge journeys under entitlements. |
| ONE residential benchmark | `RECONCILED` | Smart Home operations and the developer-sponsored One Community service/benefit ecosystem were reviewed as distinct public examples | Model on-site cafés, shops, gyms and wider partners through a separate sponsor network; no copying, affiliation or integration claim. |
| Amenities and booking | `DOCUMENTED / MISSING CORE` | referenced in product positioning and modern-complex profiles | Define resource, availability, booking, approval, fee and cancellation contracts. |
| Visitor/contractor/delivery access | `MATCH` | visitor passes, credential lifecycle and access events | Extend location scopes and operator vocabulary. |
| Governance | `MATCH-ASSOCIATION` | meetings, decisions and role separation | Do not impose HOA voting on single-owner or contract-managed workspaces. |
| AIRPROP integration | `MATCH-BOUNDARY` | shared-core ADR and Migration 99 core | Link canonical property interest/operating model; avoid duplicate operations. |
| Country packs | `PARTIAL` | Romania/Dubai AIRPROP contract exists | Add property-operation applicability and qualified legal review gates. |

## Canonical three-axis model

Every managed workspace is configured through three independent axes:

1. **Property profile:** what physical environment is managed.
2. **Operating model:** who owns, governs, leases or manages it.
3. **Building DNA:** how its technical systems and shared infrastructure behave.

No single axis may infer the other two. For example, an industrial property may be owner-operated or third-party managed; a mixed-use estate may have an association for residential areas and contractual management for retail areas.

## Module activation principle

Module availability is determined by explicit workspace entitlements and applicability rules, not merely by a profile label. The same maintenance, finance or access engine may be reused with different scope and vocabulary. Unsupported combinations fail closed and require an explicit configuration decision.

## Implementation backlog

| Priority | Controlled package | Deliverable | Migration/Test expectation |
| --- | --- | --- | --- |
| P0 | `CLADORA-WORKSPACE-TAXONOMY-001` | profile, operating-model and space-kind compatibility contract | Next available migration/test; no record rewrite |
| P0 | `CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001` | registered object types, module dependencies, entitlements, local roles and scoped assignments | Privilege-escalation, AAL2, concurrency and cross-tenant tests |
| P1 | `CLADORA-PROPERTY-TOPOLOGY-001` | site, zone, section, space, common area and shared asset scopes | Forward-only migration plus isolation tests |
| P1 | `CLADORA-OCCUPANT-PERSONA-001` | organization/operator/employee relationships and terminology | Migration only if existing party/occupancy model cannot extend safely |
| P1 | `CLADORA-NONRES-ALLOCATION-001` | commercial and shared-service allocation bases | Transactional pgTAP and zero-difference acceptance |
| P2 | `CLADORA-AMENITIES-SERVICES-001` | reservations, concierge, parcel and shared services | Separate bounded context and synthetic fixtures |
| P2 | `CLADORA-WORKSPACE-SERVICES-BENEFITS-001` | sponsor networks, participating workspaces, providers, eligible members, digital cards, offers and redemptions | Separate non-financial ledger, settlement boundary and synthetic acceptance |
| P2 | `CLADORA-MIXED-USE-PILOT-001` | Bucharest synthetic mixed-use acceptance | RO/EN/FA end-to-end acceptance |
| P3 | `CLADORA-LOGISTICS-INDUSTRIAL-PILOT-001` | synthetic warehouse/industrial acceptance | Safety, access, utilities and allocation acceptance |

Migration and test numbers are intentionally not reserved in this document. They must be allocated from the repository's canonical sequence at implementation time.

## Product and legal guardrails

- Existing residential production behavior remains unchanged until a separately approved migration is applied.
- Marketing must not state that mall, logistics or industrial workflows are production-complete.
- Romanian Law 196/2018 language remains scoped to eligible condominium associations.
- Dubai is an architecture-ready country pack only; it is not activated by this work.
- No real customer, provider, credential, Supabase configuration or Vercel configuration is changed.

## Acceptance of this documentation package

- [x] Existing evidence inventoried.
- [x] Residential foundations separated from universal target capabilities.
- [x] Workspace, property profile, operating model and Building DNA distinguished.
- [x] Resident experience generalized without weakening authorization.
- [x] Mall, office, warehouse, township and industrial gaps made explicit.
- [x] AIRPROP boundary preserved.
- [x] No migration, remote apply, production data or integration change.
- [ ] Implementation package separately approved.
