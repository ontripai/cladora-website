# CLADORA core lifecycle reference 013 v0.1

Date: 2026-10-05. Source baseline: `main` at `1503c1a1a380719e978b8e51d0caf2b7eef29459`. Owner: stable Core and Operations workstream. Requirement: LC-C01 of the [lifecycle package v1.1](references/CLADORA-Lifecycle-Implementation-Package-v1.1.docx), supplemented by the [UX directive v1.0](references/CLADORA-UX-Background-Controls-Directive-v1.0.docx).

This is a source-backed reference map for AIRPROP and SERVICE. It identifies current canonical records, access boundaries and a blocking mismatch. It makes no schema, permission, pilot-data or production change. A document alone does not complete LC-C01 or authorize either consumer to connect a new flow.

## Current identity and authority map

| Concept | Existing authority and identifier | Current rule | Consumer boundary |
|---|---|---|---|
| Property, building, entrance, unit | `portfolio.properties`, `portfolio.buildings`, `portfolio.entrances`, `portfolio.units`; stable UUID primary keys and parent foreign keys | The property is a subject; codes are attributes unique within their current parent, not cross-system identity | AIRPROP and SERVICE reference canonical UUIDs only after the server verifies the exact subject and tenant |
| Party and current unit ownership | `portfolio.parties`, `portfolio.ownerships` | Ownership has `valid_from`, `valid_to`, share and evidence reference; a party is distinct from a user or membership | Do not infer ownership from workspace membership, presale, payment or an AIRPROP opportunity |
| Whole-property interest | `airprop.property_interests` references `portfolio.properties` and `portfolio.parties` | Dated interest with a kind and evidence reference; it is not a unit ownership transfer | AIRPROP owns its commercial interpretation; Core owns the shared subject and effective permission boundaries |
| Customer workspace | `platform.customer_workspaces` with its own UUID, tenant, lifecycle status, version and environment | Workspace lifecycle status describes the operating subscription, not physical or commercial property stage | Never use workspace ID as property ID or infer property end-of-life from workspace suspension |
| Property-to-workspace binding | `platform.workspace_property_bindings` with property/workspace UUIDs, status and validity interval | Tenant consistency and active-period overlap are enforced per property; history identity cannot be rewritten | Current live binding resolves a property context to at most one active workspace. No simultaneous multi-workspace claim is supported by this rule |
| Actor context | `identity.memberships` and `identity.context_grants` | Active user membership and time-limited scope grant identify actor/context; tenant/property/building/unit scopes differ | A context ID supplied by the browser is a lookup key, not proof of authority |
| Workspace-native authority | `app_private.resolve_workspace_native_context_v2`, `app_private.check_effective_permission_v2` and `app_private.check_workspace_native_permission_v2` | Explicit target workspace, current role assignment, module/entitlement/taxonomy and deny-first checks apply | Each API/domain command must enforce its own target-specific permission and business preconditions server-side |
| Context-to-workspace resolution | `app_private.resolve_workspace_from_customer_context_v1` and taxonomy binding resolver | Scoped context follows unit/building to property then current binding; mutation requires an explicit property scope; ambiguous bindings fail | Do not substitute tenant-only fallback or a client-selected workspace for this validation |

Evidence: `20260825000300_portfolio_properties_buildings_units.sql`, `20260825000200_identity_roles_memberships_contexts.sql`, `20260825002300_customer_workspaces_assignments_lifecycle.sql`, `20260915120000_workspace_taxonomy.sql`, `20260917120000_workspace_dynamic_composition.sql`, `20260914144417_airprop_core_foundation.sql`, and `20261003122445_workspace_native_context_authority_v2.sql`. These are checked source definitions. A read-only remote catalog check on project `jyomlehahwlyqzoacrvp` confirmed that the deployed binding guard contains the overlap rejection and the deployed context resolver contains the ambiguity rejection. Remote migration history includes `20261005122509` for the prior maintenance authority slice. No pilot records or personal data were read. Existing domain gateways may add stricter checks.

## Contract consumers can use now

1. Preserve the canonical `portfolio` UUID and tenant ID in each domain reference. Resolve building and unit ancestry on the server. Treat display codes, names, provisional numbers and opportunity IDs as separate values.
2. Pin the requested subject and explicit workspace where a workspace-native command applies. Recheck active actor context, current assignment, module entitlement and domain permission at command time. Use the existing gateway and private permission engine; no direct table access from the browser.
3. Represent opportunity, request, draft quote, asset, work order and document as their own records referencing the canonical subject. A linked record does not itself establish title, mandate, handover, acceptance, settlement or permission.
4. Preserve the existing one-active-binding behavior in current APIs. A read projection may show only the subject and fields allowed by the current context; no automatic cross-workspace history sharing follows from the shared property UUID.
5. Keep the customer UI task-oriented: choose a context, show the subject and current report scope, and explain an unavailable action without surfacing permission-engine jargon. Server denial remains authoritative.

These rules describe safe reuse of current foundations. They do not grant the missing lifecycle transitions.

## Blocking mismatch before multi-workspace lifecycle integration

The v1.1 package requires one property to remain traceable while several authorized workspaces can serve it. Today `app_private.guard_workspace_property_binding_v1` rejects overlapping active bindings for the same property, and the context resolver treats multiple active bindings as ambiguous. A new AIRPROP or SERVICE flow must not bypass that rule or invent a second property registry. A single workspace's various roles may coexist, but that is not equivalent to several workspaces.

Core must first specify an explicit authoritative binding/mandate model: the acting workspace, purpose and authority source, subject, valid interval, lifecycle state, and revocation. Resolution must select the intended workspace deterministically from an authorized context and exact target, reject unbound or ambiguous requests, and prevent one workspace from reading another's private documents or financial records. Migration, backfill, API and policy changes require a separate reviewed implementation with concurrent-binding and revocation tests. Until then, concurrent workspace access and the package's T08 whole-lifecycle acceptance remain **open**.

## Cross-workstream release evidence

| Gate | Core and Operations | AIRPROP | SERVICE | Shared acceptance |
|---|---|---|---|---|
| Identity and scope | LC-C01 map here; multi-workspace behavior open | LC-A01 listing/applicant must reference canonical subjects; no parallel registry | LC-S01 eligibility must use Core subject and stage | T01/T08 require actual version and isolation tests, not this map |
| Relationships | LC-C03 dated authority/transfer contract open | LC-A02 presale is contractual buyer, LC-A03 transfer/lease/mandate are separate | Quote requester and order payer require independent authority | T03/T06/T07 require current and revoked actors |
| Delivery and documents | LC-C04 event recovery and LC-C05 handover manifest open | Consume versioned evidence and transfer boundaries | LC-S02 links service order to dossier; Operations owns work order | T04/T05/T09 require connected replay and partial-handover tests |
| UX and release | Core dashboard UX #267 and authority #258 shipped; other flows remain to audit | Report UX status in the AIRPROP workstream | Report UX status in the SERVICE workstream | Each row records route, role/context, test, PR, SHA and environment |

For every T01–T10 claim, the owning workstream records exact code/API/UI path, migration or no migration, test result and fixtures, CI run, PR, deployed commit and environment, plus open limits. A green slice test is not whole-lifecycle acceptance. The three workstreams can continue independent tasks, but dependent integration waits for the corresponding Core contract.

## Next Core implementation order

1. Extend the deployed catalog check to all workspace-native permission call sites. Design the explicit multi-workspace authority model and migration compatibility before modifying the current one-active-binding rule. Do not reapply an earlier migration.
2. Specify LC-C02 provisional identity, specification versions and split/merge lineage without rewriting historical references. Exercise T01 with two planned units.
3. Specify LC-C03 time-bounded party relationships, verified evidence and revocation, then LC-C04 consumer receipts/recovery and LC-C05 partial handover/transfer manifest. Keep property, commercial, physical, occupancy and subscription states independent.
4. Bind the Operations defect/warranty/work-order references to the shared handover and SERVICE execution-step contract. Run the synthetic two-unit T01–T10 scenario only after the dependencies exist and report each outcome separately.

No real property transfer, payment, invitation or pilot work-order mutation was performed for this mapping. The handoff document `CLADORA-CORE-OPERATIONS-HANDOFF-012.md` records historical observations; PR #258 and #267 are subsequently merged and their release status must not be inferred from its older open rows.
