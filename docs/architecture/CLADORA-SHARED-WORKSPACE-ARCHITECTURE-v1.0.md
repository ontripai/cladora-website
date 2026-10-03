# CLADORA Shared Workspace Architecture v1.0
Date: 2026-10-03
Decision ID: CLADORA-ARCH-SHARED-WORKSPACE-20261003-01
Status: User-approved principles; proposed repository contract pending review and implementation mapping.
Applies to: Operations, AIRPROP, SERVICE.
This document supplements existing architecture; it does not replace prior decisions or rename database entities.

## 1. Shared vision
Workspace is the shared context for spaces, parties, resources, rights, activities and economic obligations. It supports residential, industrial, retail, office, storage, hospitality and mixed profiles. Profile, operating model, space topology, service profile, country pack, module, entitlement and permission are independent dimensions.
A workspace is not necessarily a building or a legal owner. A portfolio may group workspaces without granting access. Organization, security tenant, workspace and physical space must remain distinct.
AIRPROP covers the complete commercial lifecycle: opportunities, evaluation, acquisition/disposal, lease/use, operation and third-party management. SERVICE covers amenities, booking, user services and execution coordination. Operations covers everyday administration, utilities, maintenance and governance.

## 2. Evidence and limits
Read on main: AGENTS.md, README.md, package.json, scripts/test-module-registry.mjs, scripts/test-owner-portfolio-context.mjs, scripts/test-workspace-dynamic-composition-slice.mjs.
Existing test source references a module registry, taxonomy, owner portfolio, context-isolated reads/writes, workspace module activation, canonical context resolver, idempotency, temporal records and authorization gates.
The composition test references core_property_registry and contracts_tenancy as catalog_only in its historical migration. This does not prove their current production lifecycle.
Tests were read, not executed. Complete schema, runtime RPC implementations, open PRs and production database were not audited. Table counts in README are not treated as current catalog evidence.
No new table name or migration is mandated by this document.

## 3. Authoritative ownership
| Information | Responsible capability | Consumers |
|---|---|---|
| Workspace identity, taxonomy, topology and cross-workspace links | Shared registry | All modules |
| Person, organization, user account | Shared identity | All modules |
| Time-bound party relationship and business right | Shared relationships; commercial rights managed through AIRPROP | Authorization, Operations, SERVICE |
| Effective permissions and context resolution | Shared authorization | Every read/write |
| Commercial agreements and mandates | AIRPROP through shared contract primitives | Operations, SERVICE, finance |
| Platform subscription and provisioning agreements | Platform control plane | Entitlements; separate from commercial workspace agreements |
| Obligations, invoices, payments and ledger | Shared financial capabilities | Domain modules submit source-linked requests |
| Equipment, preventive plans and work orders | Operations | AIRPROP and SERVICE |
| Amenity bookings and user service requests | SERVICE | Operations, AIRPROP, finance |
| Documents, messages, notifications and audit | Shared capabilities | All authorized domain records |

A business role is a relationship, not a duplicate person record. Legal/business ownership does not automatically confer an application administrator role.
Each authoritative record has one responsible write path. Other modules use scoped references or authorized read projections. No parallel party, space, document, invoice or payment registries.
Read caches/projections are permitted if derived, rebuildable and versioned. Contract snapshots may intentionally preserve historical facts; label source and effective version.
Existing private owner records require explicit matching and ownership verification before linking to shared spaces. Do not silently merge or rewrite existing identifiers.

## 4. Shared context and access
Resolve existing customer context server-side; do not assume context_id equals workspace_id or security tenant.
Validate security tenant, workspace, space, principal, temporal relationship, module, entitlement, permission, scope and required assurance level.
Deny missing or ambiguous bindings. Cross-workspace grouping never bypasses authorization.
Public listings use an explicit publishable projection, with consent/approval and withdrawal. Private contracts, financial details and identities remain separately authorized.
Use existing localized formatting and currency mechanisms. UI language does not determine accounting currency.

## 5. Proposed exchange contract
These are semantic event examples, not claims of existing APIs:
commercial.agreement.activated; space.handover.accepted; service.request.created; service.completion.approved; finance.receipt.recorded; commercial.agreement.ended.
Envelope: event_id, event_type, schema_version, occurred_at, security tenant and workspace references, subject ID/version, actor reference, correlation_id, causation_id.
Include scoped space/contract references where applicable. Carry minimal data; consumers resolve current authorized detail.
Commit domain change and durable event atomically where asynchronous exchange is used. Use existing infrastructure where available; choose outbox/queue implementation after audit.
Consumers deduplicate by event and handler, retry safely, preserve failure visibility, and handle version conflicts and out-of-order delivery. Exactly-once business effects require unique source references/idempotency.
An event informs a consumer; it does not itself approve a charge, payment or access grant. Consumers enforce their own authorized transition and approval policy.
Synchronous commands return a confirmed result or explicit error; never report success before authoritative persistence.

## 6. Lifecycle and financial consistency
Contract activation, handover, use, service delivery, billing, settlement and termination have separate state machines.
Ending an agreement initiates settlement and access review; it does not erase history or revoke unrelated valid rights.
A service linked to maintenance reuses the authoritative work order; SERVICE owns the user request and Operations owns technical execution.
Every financial entry retains its originating agreement/request/work order and accounting scope. One shared financial infrastructure can contain distinct legal books, currencies and permissions.
Booked corrections follow existing reversal/adjustment policy rather than destructive edits.

## 7. Three-work development protocol
Each work uses an isolated branch and PR and references this decision and the base main commit.
At task start inspect latest main, existing migrations and relevant open PRs. Maintain a change register: scope, touched shared files, schema/API effects, dependencies and implementation status.
Shared-core changes land in a prerequisite PR; domain PRs depend on it. One coordinated sequence for migration versions and merges; rebase and revalidate before integration.
Documentation version and consumer compatibility must accompany shared API/event changes.
This file is discoverable coordination evidence, not automatic synchronization between conversations. Each work must explicitly read/reference it. No claim is made that other works have adopted it.

## 8. Implementation gates
1. Inventory current tables, RPCs, identifiers, relationships, entitlements, permissions and open changes.
2. Map each requirement to reuse, extend or new capability, with responsible writer.
3. Resolve existing owner/private-unit linkage and commercial/platform agreement boundaries.
4. Implement shared gaps first, then a complete AIRPROP path: context -> parties/rights -> agreement -> handover -> obligations -> renewal/termination.
5. Validate cross-tenant denial, stale-context isolation, concurrent edits, duplicate-event replay, financial source uniqueness, termination without history loss, and RO/EN/FA rendering.
6. Apply production changes only under the relevant authorized deployment scope.

## 9. Remaining design decisions
Workspace/portfolio relationships and topology constraints; shared person matching; conflicting rights by scope/time; booking capacity and availability ownership; public publication workflow; existing financial book boundaries; actual event transport and recovery operations.
Resolve these against current code and controlled architecture before schema implementation.

## Change log
v1.0: Establishes workspace-wide shared data ownership and coordination for Operations, AIRPROP and SERVICE; records evidence limits, reuse boundaries, exchange semantics and implementation gates.
