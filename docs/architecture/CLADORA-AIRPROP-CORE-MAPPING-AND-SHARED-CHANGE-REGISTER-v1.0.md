# AIRPROP / CLADORA Core Mapping and Three-Work Change Register v1.0
Date: 2026-10-03
Baseline main: 7f7ea716a97e9c9ae29e7cbdbcd905c8391246c3
Parent decision: CLADORA-ARCH-SHARED-WORKSPACE-20261003-01 (PR #213)
Status: Repository evidence review and proposed implementation backlog. No runtime/production certification.

## Scope and evidence
Inspected repository tree and selected authoritative migrations for AIRPROP, workspaces, taxonomy, modules, local roles, delegations, owner-private portfolio/verified links, financial foundations, maintenance gateway, document foundation and billing redaction. Read existing AIRPROP ADR and permission matrix.
Only PR #213 appeared in the open PR collection at inspection time. This does not exclude work in other branches or conversations.
No production SQL, remote migration application, data mutation or test execution occurred. Findings describe inspected source; deployment parity and overrides in all later migrations remain a separate verification gate.
Existing names containing property are retained as implementation identities; the workspace-first product model does not require mass renaming.

## Entity mapping
| Matrix capability | Verified source entities or gateways | Verdict / required delta |
|---|---|---|
| Workspace identity | platform.customer_workspaces; platform.workspace_property_bindings; platform.workspace_taxonomy_assignments | Reuse; workspace, security tenant and physical property remain distinct |
| Dynamic composition | platform.module_definitions, workspace_modules, module dependencies and compatibility tables | Reuse; map new AIRPROP/SERVICE capabilities to runtime definitions and entitlements |
| Physical topology | portfolio.properties/buildings/entrances/units in foundational schema; platform.space_kinds taxonomy | Extend only after full topology audit; taxonomy catalogue is not an instance registry for zones/resources/capacity |
| Parties and relationships | portfolio.parties/ownerships; occupancy.occupancies/occupants/leases/cost_responsibilities | Reuse canonical parties and base lease; extend authorized projections and subjects |
| Whole-workspace commercial rights | airprop.property_interests, property_operating_models | Existing physical-property scope; add explicit workspace/subject linkage and mixed scope semantics |
| Opportunity and evaluation | airprop.investment_opportunities, underwriting_cases, underwriting_versions | Reuse; add general offer/demand and due-diligence lifecycle rather than fork underwriting |
| Public offer and demand | No AIRPROP offer/listing aggregate or application route located by tree inspection | New domain capability and explicit public projection; check differently named implementations before coding |
| Agreements and amendments | occupancy.leases; public.owner_private_leases | Reuse where applicable; generic multi-subject commercial agreement, schedules and amendments need mapping/design |
| Owner private portfolio | public.owner_private_units/leases/cash_entries; platform.owner_unit_links | Existing standalone/private records plus verified canonical links; retain both purposes and avoid duplicate posting |
| Handover | occupancy.access_assets/access_assignments; planned handover in AIRPROP model | New accepted handover aggregate referencing operational readings, assets and vault |
| Commercial mandate | AIRPROP ADR/permission matrix specifies mandate; inspected AIRPROP foundation has no mandate table | New domain aggregate; reuse workspace delegation only for software authority |
| Money | finance.accounts/journals/journal_entries; billing.invoices/invoice_lines/receivables; payments.bank_transactions/payments/reconciliation_matches | Reuse shared financial engine; add contractual source, deposits, fees and owner balances with separate accounting scopes |
| Service/technical execution | maintenance request/work-order/procurement/payable gateways | Reuse authoritative technical workflow; SERVICE request links to it |
| Evidence | documents.documents/document_versions/document_links; audit.events | Reuse controlled gateways and scanned-document access; table existence does not authorize direct reads |
| Exchange | platform.outbox_events and platform.idempotency_keys | Existing foundation; extend envelope/consumer receipts as needed and verify worker delivery before claiming runtime support |

## Existing AIRPROP commands
customer_api.create_airprop_opportunity_v1
customer_api.add_airprop_underwriting_version_v1
customer_api.configure_airprop_property_v1
These wrap internal functions in the AIRPROP foundation. No AIRPROP-named application files/routes appear in the inspected main tree. SQL presence alone does not establish a usable product flow.

## Permission mapping
| Layer | Verified implementation | Decision |
|---|---|---|
| Identity | identity.roles/permissions/role_permissions/memberships/context_grants | Reuse user and membership identities |
| Local roles | platform.workspace_roles/role_modules/role_permissions/member_roles | Reuse published scoped roles |
| Delegation | platform.workspace_delegations/delegation_permissions/delegation_approvals | Reuse time-bounded software authority with business mandate reference |
| Effective authorization | app_private.check_effective_permission_v1 in delegation migration | Reuse canonical deny-first module/entitlement/taxonomy/context checks |
| AIRPROP legacy authorization | app_private.require_airprop_context_v1 | Align with effective authorization before expanding AIRPROP |
| Navigation | Existing customer persona allowlists inspected earlier | Extend from server capability projection; menu visibility is not authorization |

### Verified AIRPROP seed
Three roles: airprop_portfolio_director, airprop_acquisition_manager, airprop_asset_manager.
Five permissions: airprop.opportunity.read, airprop.opportunity.manage, airprop.underwriting.manage, airprop.asset.read, airprop.asset.manage.
The earlier documented matrix lists 11 roles and 17 permission rows. Eight roles and most documented actions are design intent, not seeded by the inspected foundation. airprop.asset.manage is seeded but absent from that matrix. Read/propose cells under manage/approve rows cannot be implemented as one boolean permission; split actions or expose separate read projections.
New permission codes remain proposals until a catalogue mapping is accepted. Owner and tenant self-service should reuse existing personas/relations where possible.

## Concrete alignment findings
F01: require_airprop_context_v1 checks AAL2, active membership/context and base identity role allow. It does not call check_effective_permission_v1, and does not evaluate local-role deny/allow, delegations or workspace module/entitlement gates. Proposed shared policy is therefore not uniformly enforced in this path.
F02: Its property predicate accepts a building/unit grant whose parent is the requested property. For configure_airprop_property_v1 this can permit a narrow grant to authorize a whole-property mutation if its base role has airprop.asset.manage. Add a negative scope test and explicit whole-subject scope ceiling.
F03: create_airprop_opportunity_internal_v1 calls the permission helper without target property, then checks only property tenant equality. Add target context binding checks when property_id is supplied.
F04: AIRPROP read RLS uses tenant/context predicates, but does not explicitly require airprop.opportunity.read or airprop.asset.read. Opportunities with null property are tenant-scoped. Design confidential case assignments and permission-controlled read projections; confirm active-context handling and later overrides before release.
F05: AIRPROP property_operating_models enforces one overlapping model per physical property. The new mixed-workspace requirement needs subject-scoped arrangements while preserving unambiguous effective configuration. Do not overwrite platform.operating_models with AIRPROP commercial model enums.
F06: AIRPROP module permissions are not in the inspected local-role/delegation seed bindings. Register runtime module, compatibility, entitlement and bindings together; do not activate catalog_only entries as a shortcut.
F07: Owner-private cash records are not the shared posted ledger. Retain provenance and distinguish private bookkeeping from official financial transactions. Verified unit linkage does not convert historical private entries into official postings.
F08: platform.outbox_events already exists. No second event bus is justified. Worker/consumer recovery and idempotent business effects require verification, not merely a table.
F09: The foundation integrity trigger totals overlapping shares without visible subject locking. Concurrent configuration requires targeted contention tests and serialized/constraint-backed integrity before expansion.
These are source-review findings, not proof of a production exploit or deployed state.

## Shared change register
| ID | Priority | Shared change | Responsible implementation path | Dependencies / acceptance |
|---|---|---|---|---|
| CORE-01 | P0 | Workspace/tenant/context/subject resolver contract | Shared core | Narrow grant cannot mutate broader subject; ambiguous/unbound context denied |
| CORE-02 | P0 | Align AIRPROP read/write authorization with effective permission engine | Shared core + AIRPROP | CORE-01; deny, local roles, delegation expiry, module and entitlement tests |
| CORE-03 | P0 | Runtime module and permission bindings; capability projection | Shared core; AIRPROP/SERVICE supply catalogues | CORE-02; document roles vs seeded roles reconciled |
| CORE-04 | P1 | Common subject references for space, resource and capacity | Shared registry | Full latest-schema audit; no parallel topology or generic unchecked polymorphic IDs |
| CORE-05 | P1 | Canonical party/relationship and owner-link reuse | Shared identity/registry | CORE-01/04; verified matching; no global cross-tenant personal-data registry |
| CORE-06 | P1 | Shared agreement references and version/effective-date rules | Shared contracts; AIRPROP commercial extension | CORE-04/05; retain occupancy lease and platform subscription boundaries |
| CORE-07 | P1 | Financial source and responsibility contract | Shared finance | CORE-06; unique source, currency/book separation; no duplicated invoice or private-cash repost |
| CORE-08 | P1 | Durable event envelope and consumer processing | Shared infrastructure | Existing outbox; replay/out-of-order/retry/recovery checks |
| CORE-09 | P1 | Document/message/audit links to commercial subjects | Shared evidence/communications | Authorized gateways; malware gate; limited owner/tenant visibility |
| CORE-10 | P1 | Shared availability policy for commercial use and SERVICE booking | Shared registry with AIRPROP/SERVICE | CORE-04/06; capacity and exclusive-use conflict checks |
| CORE-11 | P1 | Handover/service/work-order linkage | Operations + SERVICE + AIRPROP | CORE-06/09; one technical work order and explicit payer approval |
| CORE-12 | P2 | Uniform navigation, reporting and locale/currency projection | Shared UI; domain views | CORE-03; scoped RO/EN/FA, stale-context tests |

## Domain changes after shared prerequisites
AIRPROP: offer/demand, negotiation, diligence, commercial agreement extensions, interests by subject, handover acceptance, schedules/deposits, mandates/fees/owner statements, acquisition/disposal and read-only portfolio projections.
SERVICE: service catalogue, eligibility, bookings/capacity, request coordination and result acceptance linked to existing maintenance where relevant.
Operations: authoritative equipment/reading/technical workflow extensions required by handover and service execution.
Each domain writes only its owned data. Financial and legal effects require authorized commands, not blind event reactions.

## Execution sequence and coordination
First: CORE-01/02/03 with synthetic negative access tests. Then CORE-04/05/06; follow with finance, evidence, events and execution linkage. Availability policy precedes public commitments/bookings.
Shared prerequisites use a dedicated PR; domain branches rebase on merged prerequisites. Reserve migration filenames through CLI when implementation begins and check all three works before merge.
This report does not reserve files or notify other conversations automatically. Each work must read PR #213 and declare touched shared files before implementation.

## Validation still required
Inspect later overrides across the complete migration chain; compare remote migration history/catalogue read-only; run database/security tests on synthetic local data; verify API and three-language flows; check current main/open branches immediately before edits.
No remote schema or customer data should be changed merely to complete this discovery.

## Implementation progress — 2026-10-03
Draft PR #214 implements the whole-physical-subject scope ceiling.
Stacked draft PR #216 aligns the three existing AIRPROP commands and all five table read policies with shared authorization, runtime module bindings and entitlement gates. At commit 5780fff691e8b15426e46d68c05dbfd56c611f44, its 169 focused pgTAP assertions and both CI workflows passed. This is branch validation, not production deployment or complete AIRPROP product delivery.
CORE-01/02/03 remain partial: explicit workspace mutation authority, capability UI and further domain catalogues are still required.
Workspace-native opportunity behavior is now specified in [CLADORA-WORKSPACE-NATIVE-OPPORTUNITY-CONTRACT-v1.0.md](CLADORA-WORKSPACE-NATIVE-OPPORTUNITY-CONTRACT-v1.0.md). This contract separates workspace authority from physical grants, defines persisted identity and legacy resolution, and assigns shared changes across the three works. No other conversation is automatically synchronized by this update.

Complete internal domain architecture is specified in [CLADORA-AIRPROP-INTERNAL-ARCHITECTURE-AND-DELIVERY-MATRIX-v1.0.md](CLADORA-AIRPROP-INTERNAL-ARCHITECTURE-AND-DELIVERY-MATRIX-v1.0.md), decision -03. It includes entities, lifecycle transitions, action permissions, shared event ownership, application surfaces and completion evidence.
PR #216 subsequently added persisted opportunity workspace identity and regression coverage for physical rebinding. Its focused assertion count is now 182; the earlier 169 figure is evidence for the prior commit only. Explicit workspace-native mutation authority and audited historical resolution remain prerequisites for the broader flow.


## Explicit native authority implementation — PR #221, 2026-10-03

Owner: shared core, consumed by SERVICE #217/#218 and AIRPROP #219. Decision CLADORA-ARCH-WORKSPACE-NATIVE-AUTHORITY-20261003-01 refines the existing -02 Context contract using canonical tenant Context plus an explicitly assigned, current workspace-scoped local role. This is not tenant-only mutation authority. No Context enum or grant store is added and no assignment is fabricated.

Changed shared runtime functions: new native membership-scope proof and exact target resolver; canonical direct/effective engines extended with an explicit target; v1 signatures preserved as legacy-mode wrappers; native module permission adapter. New target discovery RPC and GET gateway are scoped to current Context ownership and role assignment. Existing physical resolver and scope ceiling are unchanged. Complete path and consumer contract: [CLADORA-SHARED-WORKSPACE-NATIVE-AUTHORITY-003-v1.0.md](CLADORA-SHARED-WORKSPACE-NATIVE-AUTHORITY-003-v1.0.md).

Evidence at code head `4c587861fe4c1a69ee9cf4ea404af342b4806468`: dedicated shared CI [37123737137](https://github.com/ontripai/cladora-website/actions/runs/37123737137) succeeded with 60 SQL cases, 91 pre/post legacy evaluations, 11 gateway cases, full typecheck and existing unit tests; AIRPROP scope CI [37123737087](https://github.com/ontripai/cladora-website/actions/runs/37123737087) succeeded; complete clean Supabase migration/pgTAP/concurrency/advisor workflow [37123737130](https://github.com/ontripai/cladora-website/actions/runs/37123737130) succeeded. Application Foundation [37123737026](https://github.com/ontripai/cladora-website/actions/runs/37123737026) failed at the unchanged npm audit gate. Shared dependency remediation/proposed exception belongs to #220, not a second SERVICE patch.

Status: CORE-01/02 explicit-target implementation proposed and tested, **not merged or deployed**. CORE-03 catalogue/capability UI, generic provisioning/role issuance, domain persistence/UI and downstream cutovers remain open. No exact changed-path overlap was found with inspected #215/#219; independent chats are not automatically synchronized. Consumer work must depend on this core result, retain current authorization on retries and preserve mandatory AIRPROP AAL2. Any merge/deployment must use the final head and completed checks. Branch deletion remains after confirmed completed merge.
