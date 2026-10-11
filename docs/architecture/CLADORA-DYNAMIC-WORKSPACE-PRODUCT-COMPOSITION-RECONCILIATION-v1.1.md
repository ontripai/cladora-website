# CLADORA Dynamic Workspace and Product Composition Reconciliation v1.1

**Status:** Revised architecture and implementation proposal; no migration authorized
**Review date:** 2026-10-07
**Reviewed baseline:** `main` at `436e7a6`
**Scope:** DW-01, DW-02 and PC-01
**Consumers:** Core/Operations, AIRPROP, SERVICE, Community & Experience

**Revision note:** v1.1 incorporates architecture review decisions for non-limiting taxonomy, legacy entitlement continuity, shared capacity/time contracts, typed entitlement aggregation, and an independently deliverable Community first slice. The executable DW-01A contract and PR boundary are specified in `docs/contracts/CLADORA-DW-01A-WORKSPACE-CAPABILITY-READ-CONTRACT-v1.0.md`.

## 1. Decision summary

The current platform already contains the correct security and composition spine: a tenant-bound Workspace, independent property profile and operating model, temporal Workspace-to-property bindings, a versioned module catalogue, contract entitlements, local roles, scoped assignments, delegation, canonical parties/ownership/occupancy, and purpose-bound Workspace/property authority. These components must be reused.

The required next step is not a second Workspace engine. It is a forward-only completion package that:

1. declares the legacy `workspace_type` as an administrative/commercial origin classification, never a capability ceiling;
2. completes resource topology and typed Workspace/resource participation without replacing current property/building/unit IDs;
3. introduces a versioned product-offer and bundle catalogue above modules and entitlements;
4. separates contractual right, product activation and user permission in the effective-access projection;
5. converges the private multi-unit-owner inventory toward canonical parties/resources through verified links while preserving the private records as historical source evidence;
6. gives AIRPROP, SERVICE and Community & Experience one shared set of versioned reference/read contracts.

No existing posted journal, accepted allocation, ownership interval, lease, role assignment, Workspace taxonomy assignment, module activation, entitlement or audit event may be rewritten by a later configuration change.

## 2. Verified baseline

### Repository and Production

- Git `main`: `436e7a6` (`feat(website): comprehensive redesign ... (#312)`).
- Supabase Production project: `jyomlehahwlyqzoacrvp`.
- Production contains migrations `20260915120000` through `20260919120000` for taxonomy, dynamic composition, local roles and delegation, and the later shared lifecycle/AIRPROP chain through `20261007112219`.
- Production inventory at review time: 16 property profiles, 8 operating models, 21 space kinds, 16 module definitions, 9 active Workspace modules, 13 Workspace roles and 19 member-role assignments.
- All five current Production Workspaces have legacy `workspace_type = ASSOCIATION`; this does not reflect the already-populated independent taxonomy assignments.
- All 36 current Workspace entitlements have no `contract_id`; no `platform` table named for a product or bundle exists.
- One private owner unit exists; verified owner-to-canonical unit links are currently zero.

These counts are operational evidence only. They do not authorize backfill or customer-data mutation.

## 3. Cardinal model

The following dimensions remain independent:

| Dimension | Meaning | Must not imply |
| --- | --- | --- |
| Workspace identity | Security and operational collaboration context | Building, owner, product or permission |
| Administrative Workspace type | Onboarding/commercial origin such as association or owner portfolio | Capability ceiling |
| Property profile | Physical/operational topology | Ownership or management authority |
| Operating model | How a property is operated | Application role or legal title |
| Resource identity | Canonical property, building, unit/space, asset or service point | Access merely because it is linked |
| Relationship/right | Ownership, occupation, mandate, employment or participation for a period | Workspace administrator role |
| Product offer | Commercially offered collection of capabilities | Immediate activation |
| Contractual entitlement | Effective right/limit purchased or approved | User permission |
| Module activation | Enabled technical capability and configuration | Authority for every user |
| Role and assignment | What a principal may do, where and when | Ownership or payment responsibility |

Effective capability is therefore:

`active Workspace ∩ compatible taxonomy ∩ active product right ∩ active module ∩ valid entitlement ∩ permission ∩ scoped assignment ∩ required relationship/mandate ∩ assurance/approval`.

Missing or ambiguous evidence denies access.

## 4. DW-01 — Workspace definition and configuration

### 4.1 Existing implementation

| Existing capability | Source evidence | Test evidence |
| --- | --- | --- |
| Tenant-bound Workspace with lifecycle and four legacy administrative types | `20260825002300_customer_workspaces_assignments_lifecycle.sql`; `src/app/api/platform/v1/workspaces/route.ts` | `013_workspace_lifecycle_entitlements_provisioning.test.sql`, `018_workspace_onboarding_completion_activation_gate.test.sql` |
| Versioned property profiles, operating models and space kinds | `20260915120000_workspace_taxonomy.sql` | `087_workspace_taxonomy.test.sql` — 55 assertions |
| Controlled, temporal taxonomy assignment with compatibility and idempotency | `20260916120000_workspace_taxonomy_mutation.sql`; customer taxonomy routes | `088_workspace_taxonomy_mutation.test.sql` — 66 assertions plus real concurrency runner |
| Versioned module catalogue, dependencies, incompatibilities and taxonomy compatibility | `20260917120000_workspace_dynamic_composition.sql` | `089_workspace_dynamic_composition.test.sql` — 96 assertions |
| Transactional module activation/deactivation and immutable history | `activate_workspace_module_v1`, `deactivate_workspace_module_v1`; composition/module API routes | Test 089 and `test-workspace-dynamic-composition-slice.mjs` |
| Workspace-local roles and scoped member assignments | `20260918120000_workspace_local_roles_permissions.sql`; role API routes | `090_workspace_local_roles.test.sql` — 101 assertions plus concurrency |
| Delegation, grantor ceiling, independent acceptance/approval and expiry | `20260919120000_workspace_delegations_approvals.sql` | `091_workspace_delegations.test.sql` plus delegation concurrency |

### 4.2 Gaps and conflicts

1. `platform.workspace_type` is a fixed enum and the Platform API treats it as a required type. The independent taxonomy engine prevents it from being a technical ceiling, but this semantic rule is not encoded in one authoritative read contract.
2. A Workspace taxonomy assignment contains one profile and one operating model. That is suitable as a Workspace default, but mixed portfolios require property/resource-level overrides without mutating historical defaults.
3. `workspace_modules.config_json` currently enforces `{}` only. Versioned module configuration schemas described by the architecture are not implemented.
4. Module compatibility is profile/model-based and currently acts as an activation gate. This is too broad when a taxonomy label is used as a proxy for capability. Compatibility may only express a versioned, evidence-backed prerequisite: required resource kind/capacity, technical dependency, active contractual right, or approved policy. A prohibition on one action or resource scope must not disable the whole product unless that product is technically indivisible and the rule records that fact explicitly.
5. Application navigation consumes modules/entitlements/permissions in multiple projections; a single versioned `workspace_capability_snapshot` contract does not yet exist.
6. Current Production Workspaces show why legacy type cannot drive menus or capabilities: all are `ASSOCIATION`, while their taxonomy/module compositions differ.

### 4.3 Proposed change package

**DW-01A — Semantic stabilization, documentation/read model only**

- Preserve `workspace_type` and every existing value. Define it as `administrative_origin_type` in API documentation and projections; do not rename or backfill the column in the first slice.
- Add a versioned read projection that returns separately: Workspace identity/lifecycle, legacy origin type, effective taxonomy assignment, bound-resource summary, active modules and entitlement keys.
- Require every consumer/UI to derive capability from this projection, never from `workspace_type`.
- Return compatibility as a list of typed prerequisite evaluations rather than a single taxonomy verdict. Property profile and operating model remain descriptive inputs; their names cannot authorize or deny a capability.
- Represent partial prohibition at action/resource scope. A denied action does not imply product denial, and a product-level denial requires an explicit product-scoped rule and reason.

**DW-01B — Versioned module configuration**

- Add a platform-owned configuration-schema version to module definitions and immutable Workspace module configuration revisions.
- Activation points to the exact accepted revision. New revisions never update an earlier activation or historical action.
- Validate allowed configuration server-side with size limits, stable schema version and audit/outbox evidence.

**DW-01C — Resource-aware composition**

- Add compatibility between module definitions and registered resource kinds.
- Allow a module activation to be Workspace-wide or explicitly scoped to registered resources.
- Maintain deny-first behavior for an unsupported or unresolved resource kind.

### 4.4 Shared contracts

- `WorkspaceIdentityRefV1`: `tenant_id`, `workspace_id`, lifecycle, legacy origin type only.
- `WorkspaceConfigurationSnapshotV1`: version/effective timestamp, taxonomy assignment, module activations/config revisions and product-right references.
- `WorkspaceCapabilityDecisionV1`: allowed/denied, bounded reason code, exact Workspace/resource/principal, source versions and evaluated time.
- `CapabilityPrerequisiteV1`: prerequisite kind (`resource`, `technical`, `contract`, `policy`), subject, result, source/version and optional action/resource scope. Taxonomy labels are never a prerequisite kind.
- Consumers may read snapshots; only shared Workspace commands write taxonomy, composition, role or activation state.

### 4.5 Acceptance and order

1. Freeze semantics and add contract tests proving two Workspaces with the same `workspace_type` can have different products/modules.
2. Prove a Workspace can contain zero, one or multiple property/resource bindings.
3. Prove taxonomy/config changes create new effective records and leave earlier actions reproducible.
4. Prove module activation cannot exceed contract rights, real resource/technical prerequisites, valid policy or administrator authority; a taxonomy name alone never denies activation.
5. Prove AIRPROP/SERVICE/Community UI never authorizes from `workspace_type` or labels.
6. Prove denial of one action/resource scope leaves unrelated actions in the same product independently evaluable.

## 5. DW-02 — Resource identity, ownership, operation and management

### 5.1 Existing implementation

| Existing capability | Source evidence | Test evidence |
| --- | --- | --- |
| Canonical property/building/entrance/unit and person/company/association/public-body parties | `20260825000300_portfolio_properties_buildings_units.sql` | broad database suite; context and lifecycle tests |
| Effective-dated fractional unit ownership | `portfolio.ownerships` | LC-C03/T06 connected acceptance in test 151 and ownership transfer contract tests |
| Occupancy, occupants, leases, payer responsibility and access assignments | `20260825000400_occupancy_parties_leases_access.sql` and later lifecycle hardening | tests 041, 051, 115 and T07 acceptance |
| Temporal Workspace-to-property binding | `platform.workspace_property_bindings` | tests 087/088 and context-ceiling tests |
| Purpose-bound Workspace/property authority for operations, investment or service delivery | `20261005161945_lifecycle_workspace_property_authority.sql`; mandate resolver | tests 154/155 |
| Immutable ownership transfer and lease handover/termination | migrations `20261007085249` and `20261007101000` | tests 151/152 and CI clean-room pgTAP |
| Multi-unit-owner private intake and verified canonical-unit link | migrations `20260925131751` and `20260925135527`; owner portfolio APIs | tests 115 and owner-portfolio application tests |

### 5.2 Gaps and conflicts

1. The canonical topology remains property → building → entrance/unit. The 21 space kinds are catalogue metadata, not first-class canonical instances for zone, floor, lot, common area, amenity, service point or provider location.
2. `portfolio.properties.type` remains a residential-only enum. It duplicates some profile semantics and cannot represent all profiles, but replacing it would break existing records.
3. `workspace_property_bindings` expresses connection, while `workspace_property_authorities` expresses purpose-bound authority. Consumers still use both legacy context grants and newer mandate resolution; the convergence status must be explicit per API.
4. Ownership is currently unit-specific. Broader asset interests, organization portfolios and non-unit resources need a common relationship subject without cloning ownership tables per product.
5. The private owner tables duplicate unit labels, leases and cash entries. Verified links prevent silent merging, but linked private records do not yet converge to a shared party identity and canonical relationship lineage.
6. The relationship model covers ownership/lease and property mandates, but a generic, typed, effective-dated participation/right reference for employee, merchant, operator, sponsor and Community member eligibility is absent.

### 5.3 Proposed change package

**DW-02A — Canonical resource graph extension**

- Keep existing property/building/entrance/unit UUIDs unchanged.
- Add a shared resource identity/edge layer that can reference legacy canonical rows and introduce missing resource instances such as site, zone, floor/section, lot/space, common area, shared asset, amenity and service point.
- Every edge is tenant-bound, typed, effective-dated, non-overlapping where exclusive, and immutable after supersession.
- Do not represent common areas as fake units or users.

**DW-02B — Typed relationship/right ledger**

- Reuse `portfolio.parties` as the business-person/organization identity.
- Add a shared relationship projection/ledger for rights not already authoritatively represented, referencing a canonical resource, party, relationship kind, source evidence, effective period and responsible writer.
- Existing `portfolio.ownerships`, `occupancy.leases/occupancies` and Workspace property authorities remain authoritative sources; the new layer references or projects them rather than duplicating them.

**DW-02C — Multi-asset owner convergence**

- Preserve all `owner_private_*` records as owner-authored source history.
- After verified party matching and canonical unit linkage, create an immutable mapping from private source IDs to canonical party/resource/relationship IDs.
- New canonical operations use the shared identities; never auto-copy private cash entries into official books and never infer Workspace administration from ownership.
- Support one party owning multiple resources across multiple Workspaces through repeated ownership relationships, without granting cross-Workspace access.

**DW-02D — Mandate convergence**

- Publish one `resolve_resource_authority_v1` contract that wraps current native context, Workspace/property mandate, role, module, entitlement and assurance checks.
- Migrate consumers incrementally; retain old resolvers until each consumer has compatibility tests. No flag-day replacement.

### 5.4 Shared contracts

- `ResourceRefV1`: tenant, canonical resource ID, kind, optional legacy source type/ID and current version.
- `ResourceEdgeV1`: parent/child relation, effective interval and evidence/version.
- `PartyRefV1`: canonical party ID; account/membership mapping is separate.
- `RelationshipRefV1`: kind, party, resource, effective period, evidence and authoritative writer.
- `WorkspaceResourceParticipationV1`: Workspace, resource, purpose and effective interval; not itself authority.
- `ResourceAuthorityDecisionV1`: exact mandate/relationship, permission, module, entitlement, scope and assurance result.

AIRPROP writes commercial rights and mandate proposals through shared commands. Operations writes technical assets/work orders. SERVICE references the resource and owns user service/request/booking state. Community & Experience references eligibility relationships and owns events/memberships/redemptions, never title, lease, credentials or journals.

### 5.5 Acceptance and order

1. Inventory every consumer of property bindings, context grants and mandates; classify as canonical, compatibility or legacy.
2. Introduce the resource reference/edge contract and map existing property/building/unit records without changing IDs.
3. Test one Workspace with multiple properties and one property participating in distinct purpose-bound Workspaces.
4. Test one person/company owning several resources across several Workspaces with strict per-Workspace denial.
5. Test ownership transfer, lease termination, mandate revocation and private-owner link expiry without historical loss.
6. Test concurrent edge/right changes, stale expected versions, cross-tenant IDs and ambiguous party matching.

## 6. PC-01 — Independent products, bundles, rights and activation

### 6.1 Existing implementation

| Existing capability | Source evidence | Test evidence |
| --- | --- | --- |
| Versioned subscription plans and Workspace contracts | `20260825002400_subscription_plans_contracts_entitlements.sql`; platform contract APIs | tests 013/027 and control-plane application tests |
| Typed Workspace entitlements and quota ledger | same migration; entitlement route | test 013 and domain entitlement tests |
| Versioned module definitions and compatible activation | `20260917120000_workspace_dynamic_composition.sql` | test 089 |
| Permission catalogue/bindings, local roles and assignments | `20260918120000_workspace_local_roles_permissions.sql` | test 090 |
| AIRPROP commercial lifecycle reuses shared identity/authority | `20261007104000_airprop_commercial_lifecycle_v1.sql` | test 171 and route test 018 |
| SERVICE catalogue/request/quote contracts reuse Workspace, modules, roles and entitlements | SERVICE migrations and customer API routes | SERVICE contract, persistence, route and UI tests |

### 6.2 Gaps and conflicts

1. A subscription plan contains JSON feature/limit catalogues; there is no normalized, versioned product-offer or bundle-composition contract.
2. `workspace_entitlements` has a unique `(workspace, entitlement_key)` row. Updating it can obscure which product/contract/version supplied a right and cannot naturally represent overlapping grants from multiple products.
3. Production currently has 36 entitlements without contract references. They are valid operational state but not sufficient commercial provenance for PC-01.
4. Product right and module activation are adjacent but not explicitly linked by an immutable activation receipt.
5. Product availability, contract entitlement, module activation and user permission are enforced in pieces; there is no shared explainable decision object across all domains.
6. SERVICE `reservation` acquisition mode is catalogued but excluded from the current request UI/runtime. Community & Experience has no production model. AIRPROP exclusive reservation must not be reused as amenity/event capacity booking.

### 6.3 Proposed change package

**PC-01A — Product catalogue**

- Add immutable/versioned definitions for `product_definition`, `product_offer_version` and `bundle_component`.
- A component references existing module definitions and entitlement definitions/values; it does not duplicate module code or permission codes.
- Support standalone products, additive bundles and complete suites. Bundle composition is a commercial template, not an authorization grant.

**PC-01B — Contract-right grants**

- Materialize each accepted contract/pilot/approved exception as an append-only product-right grant with source type/ID, offer version, Workspace/resource scope, effective interval and status.
- Preserve current entitlement rows during transition. Introduce a derived effective-entitlement projection that aggregates active grants deterministically and labels legacy unprovenanced values.
- Never silently attach the 36 existing Production entitlements to a contract; reconciliation requires an explicit reviewed decision.

**Legacy entitlement compatibility and disposition**

- Treat an active entitlement with `contract_id is null` as `legacy_unprovenanced`, not invalid and not contract-backed. Existing runtime behavior remains unchanged during the compatibility window.
- The first read contract exposes provenance state, entitlement row ID, effective interval and override state; it does not infer a contract, product, bundle or commercial owner.
- Produce a review queue with one record per legacy entitlement and a non-mutating classification: `retain_legacy`, `link_after_evidence`, `replace_by_approved_grant`, `expire_at_reviewed_date`, or `disputed_hold`.
- `link_after_evidence` requires an exact accepted contract/version or an approved exception source plus reviewer identity and evidence reference. Similar dates, keys, plan names or Workspace ownership are insufficient.
- `replace_by_approved_grant` is a forward-only cutover: create the approved grant first, verify equivalent effective access, then close the legacy interval. Never update historical actions or activation receipts.
- `disputed_hold` preserves current access and raises operator visibility; it does not silently widen scope. Emergency suspension remains an explicit, individually authorized security action, not a batch cleanup mechanism.
- No bulk revoke is permitted. Each disposition is idempotent, independently reviewable, and reports before/after effective access. The 36 current Production rows remain untouched until a separately authorized migration and reviewed disposition plan exist.

**PC-01C — Activation receipts**

- Module activation records the exact product-right grant(s), entitlement evaluation and configuration revision used.
- Suspension/expiry disables future capability but preserves receipts and all historical actor/resource/version references.
- An exact replay is idempotent; a changed replay conflicts.

**PC-01D — Unified capability evaluation**

- One shared read contract explains product availability, contractual right, module state and user authority separately.
- Domain commands still enforce their own legal/business preconditions; a positive product decision cannot approve a payment, title transfer, booking, credential or publication.

**Typed right aggregation rules**

| Right value kind | Default aggregation | Required constraints |
| --- | --- | --- |
| Boolean capability | `allow` when at least one active in-scope grant allows and no applicable explicit deny wins | Deny precedence must be scoped and carry policy/source/version; absence is not a deny unless the command is fail-closed by contract |
| Consumption limit | Policy-declared operator only: `sum`, `shared_pool`, `min`, `max`, `replace` or `non_aggregable` | Unit, period, reset boundary, subject and double-counting key must match; otherwise fail as ambiguous |
| Scope | Set union/intersection/difference only as declared by the right definition | Tenant/Workspace/resource/action boundaries remain explicit; broader scope cannot be inferred from membership or ownership |
| Valid time | Evaluate interval intersection with the requested action time | Grants are not merged into a timeless value; future, expired and suspended intervals remain visible but ineffective |
| Explicit prohibition | Deny only the declared action/resource/scope and interval; precedence is definition/policy-specific | A narrow deny never disables unrelated product capabilities; product-wide deny must be explicit and justified |

There is no universal `sum` or `max` rule. Every entitlement definition declares its value kind, unit, aggregation policy, scope algebra, deny precedence and ambiguity behavior. Unknown or incompatible combinations fail closed for the requested action without revoking stored grants.

### 6.4 Shared capacity and time contract

Core owns resource identity, authority evaluation, availability-policy identity and the atomic capacity hold ledger. It does not own the domain lifecycle that requests capacity.

- `BookableResourceRefV1`: canonical `ResourceRefV1`, capacity dimension/unit, timezone and availability-policy version.
- `CapacityRequestV1`: tenant/Workspace/resource, requested interval, quantity, domain owner, domain process ID/version, actor and idempotency key.
- `CapacityHoldReceiptV1`: hold ID, exact interval/quantity, policy/resource versions, status, expiry, correlation and causation IDs.
- Commands: `quote_capacity_v1` (non-binding), `hold_capacity_v1` (atomic), `confirm_capacity_hold_v1`, `release_capacity_hold_v1`, and `get_capacity_hold_v1`. Conflicting holds are serialized; identical retries return the same receipt; changed retries conflict.
- Authority is checked by Core for the exact principal/Workspace/resource/action. The domain remains responsible for its own business eligibility and state transition.
- SERVICE booking, Community Event registration and AIRPROP commercial reservation retain separate IDs, state machines, cancellation rules and evidence. They may reference a Core capacity receipt but never mutate one another or reuse AIRPROP exclusivity as general booking.
- Phase-one CE does not require this ledger for a free Event that allocates no capacity, time or resource. Interest is not a reservation, confirmed place or admission guarantee. Capacity-backed registration is a later consumer after the shared contract is approved and implemented.

### 6.5 Domain consumer contracts

| Consumer | Must use | Owns | Must not create |
| --- | --- | --- | --- |
| AIRPROP | Workspace/resource refs, parties, relationship/mandate refs, product-right decision, evidence, finance source refs, outbox | opportunity, underwriting, listing, commercial reservation, presale/acquisition/disposal and management-mandate workflow | parallel property/party/role/payment/document identity |
| SERVICE | Workspace/resource refs, provider party, product-right decision, availability policy, shared finance/work-order refs | service definition/offering, request, quote, user-facing booking coordination and acceptance | parallel user, resource, work order, invoice or payment registry |
| Community & Experience | Workspace/resource refs, eligibility relationship snapshot, product-right decision, event/offer/capacity contract, shared finance/access refs | community, event, experience, membership/benefit eligibility, attendance/redemption state | title/lease, general building credential, payment journal, SERVICE order or AIRPROP reservation |
| Operations | same shared refs and decision; authoritative technical asset/work-order and finance APIs | daily management, maintenance, utilities, governance and operational evidence | product-specific duplicate identities |

All cross-domain events use a versioned envelope with event ID/type, occurred time, tenant/Workspace, canonical subject/version, actor, correlation and causation IDs. Events notify; they do not grant authority. Consumers deduplicate and preserve recovery visibility.

### 6.6 Community first-stage minimum contracts

This list deliberately avoids a dependency on complete PC-01 or DW-02 delivery.

| Slice | Required now | May remain compatibility-backed | Explicitly deferred |
| --- | --- | --- | --- |
| Community base | Existing context-to-Workspace resolution; `WorkspaceIdentityRefV1`; current member/account identity; current scoped permission check; existing document/message references; audit/outbox envelope | Current module entitlement row, including `legacy_unprovenanced`, exposed read-only with provenance state | Generic relationship ledger, product catalogue/bundles, cross-Workspace network membership, benefits/loyalty, physical credentials |
| Event base | Workspace/context identity; event identity/version; organizer authority; visibility/audience snapshot; immutable publication receipt; interest/withdrawal and manual attendance for a free Event with no capacity/time/resource allocation | Eligibility from current Workspace membership/roles with source/version captured at decision time | Community activation, SERVICE, shared capacity ledger, paid ticketing, waitlist, seating and AIRPROP reservation reuse |
| Experience Guide | Community-base contracts; guide entry identity/version; canonical or external place/resource reference; visibility/locale; editorial authority; publication receipt | External/unresolved place reference clearly labelled and non-authoritative | Commerce, booking, payment, provider order, benefit redemption and inventory |

Community commands must capture the exact context, actor, Workspace, permission result and source versions used. They do not grant building access, post finance, create SERVICE orders or create AIRPROP rights.

### 6.7 Acceptance and order

1. Catalogue tests: standalone product, two-product bundle and complete suite all resolve to existing module IDs without duplication.
2. Provenance tests: legacy null-contract rights remain effective and labelled; no inferred link or bulk revoke occurs. Two concurrent/overlapping rights aggregate according to their declared value-kind policy; an undeclared combination is ambiguous, not silently summed/maximized.
3. Activation tests: no right, expired right, incompatible taxonomy/resource, inactive Workspace and stale configuration all fail with zero partial writes.
4. User-authority tests: active product/module without a scoped role denies; role without a product right denies.
5. Historical tests: changing a bundle, taxonomy or configuration cannot change an earlier receipt/action projection.
6. Cross-domain tests: AIRPROP reservation, SERVICE booking and Community event registration are distinct state machines and may share only versioned resource/authority/capacity receipts.
7. Financial tests: a redemption/booking/service completion can only propose source-linked financial work; it cannot directly post an unauthorized journal.

## 7. Coordinated execution sequence

| Gate | Package | Owner | Dependency | Exit criterion |
| --- | --- | --- | --- | --- |
| G0 | Contract freeze and consumer inventory | Architecture/Core | Current `main` | All shared readers/writers and legacy paths classified; no mutation |
| G1 | DW-01A semantic read contract | Core | G0 | Additive v1 read route/projection; same legacy type supports different effective compositions; existing APIs remain unchanged |
| G2 | DW-02A resource reference/edge foundation | Core | G1 | Existing IDs mapped; multi-property/multi-Workspace and cross-tenant tests green |
| G3 | DW-02B/D relationship and authority projection | Core + domain review | G2 | Ownership, management and access independently resolved; old consumers compatibility-tested |
| G4 | PC-01A/B product catalogue and rights | Platform/Core | G1–G3 | Standalone/bundle rights are versioned, effective-dated and provenance-complete |
| G5 | DW-01B/C configuration and resource-scoped activation | Core | G2, G4 | Activation receipt pins right/config/resource versions |
| G6 | Domain adoption | AIRPROP, SERVICE, Community & Experience, Operations | G3–G5 | Each domain uses shared refs/decisions; no parallel identity/financial stores |
| G7 | Historical and multi-domain acceptance | Architecture/QA/Security | G6 | clean-room pgTAP, concurrency, negative authorization, event recovery and RO/EN/FA UI pass |

Every gate requires a separate reviewed PR. Any shared migration or change to a consumed contract requires explicit coordination with all three domain owners before implementation and a separately authorized Production release.

## 8. Non-goals and prohibited shortcuts

- Do not replace lifecycle package v1.1 or UX directive v1.0.
- Do not rename or reinterpret historical records in place.
- Do not make Workspace type, property profile, product or ownership a permission shortcut.
- Do not backfill contract provenance from guesses or attach legacy entitlements automatically.
- Do not merge private owner records with canonical parties/resources without verified evidence and review.
- Do not use AIRPROP exclusive reservation as SERVICE/Community capacity booking.
- Do not let product or Community membership issue physical credentials, transfer title, create leases or post journals.
- Do not build a second operations, finance, metering, document, role or audit engine.

## 9. Review decisions required before implementation

1. Approve the semantic treatment of legacy `workspace_type` as administrative origin only.
2. Approve the canonical resource-reference/edge shape and which missing topology kinds enter the first slice.
3. Select the authoritative party-matching and private-owner convergence review process.
4. Approve normalized product/right entities and per-value-kind entitlement aggregation policies; there is no universal sum/max behavior.
5. Approve Core ownership of the resource/authority/capacity ledger contract while SERVICE booking, Event registration and AIRPROP commercial reservation remain domain-owned processes.
6. Approve the event envelope/consumer recovery contract and transport after repository/operations review.

Until these decisions are approved, this report authorizes no migration, backfill, remote write, role grant, customer activation or consumed API replacement.
