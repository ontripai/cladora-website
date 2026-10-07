# AIRPROP internal architecture and delivery matrix v1.0
Date: 2026-10-03
Decision: CLADORA-ARCH-SHARED-WORKSPACE-20261003-03
Parent decisions: -01 shared workspace; -02 workspace-native opportunity.
Status: Complete domain architecture specification; runtime delivery remains phased.
Baseline: main 7f7ea716a97e9c9ae29e7cbdbcd905c8391246c3.
Applies to Operations, AIRPROP and SERVICE. Preserve earlier architecture versions.

## Domain boundary
AIRPROP owns the complete commercial lifecycle within the workspace world: supply and demand, evaluation, negotiation, commitments, acquisition/disposal, use rights, operating arrangements, management mandates, handover acceptance, commercial obligations and termination.
Its records reference shared workspace, subjects, parties, contracts, evidence and financial infrastructure. Operations owns technical execution; SERVICE owns user service coordination and bookings. An AIRPROP commercial operating arrangement is distinct from platform workspace taxonomy.

## Executable entity and ownership matrix
Names below describe aggregates, not newly deployed table names. Reuse existing implementations before introducing a new entity.

| Aggregate | Identity / authoritative path | Key invariant | Required core |
|---|---|---|---|
| Commercial case / opportunity | Existing AIRPROP opportunity; persisted workspace | One immutable workspace; optional subject under explicit authority | CORE-01/02/03/04 |
| Offer and demand | AIRPROP extension, separate public projection | Public data explicitly approved; no private-case exposure | CORE-04/05/09/10 |
| Negotiation | AIRPROP versioned proposals | Expiry, version and approval are explicit; acceptance binds exact proposal | CORE-05/06/09 |
| Diligence / evaluation | Existing underwriting plus evidence references | Immutable assumptions/results versions; approval does not auto-post money | CORE-06/09 |
| Commercial agreement | Shared contract identity and AIRPROP terms | Exact parties, subjects, dates, obligations, signatures and amendments | CORE-04/05/06 |
| Commercial right | Existing interests extended to shared subjects | Scope/time/share conflicts validated under concurrency | CORE-04/06/10 |
| Operating arrangement | Existing commercial models extended by subject | One unambiguous effective arrangement per applicable scope/time | CORE-04/06 |
| Management mandate | AIRPROP business mandate | Principal, agent, powers, limits, expiry and fee terms; no automatic software authority | CORE-05/06/07 |
| Handover acceptance | AIRPROP acceptance referencing Operations evidence | Condition/readings/access inventory, exceptions and party acceptance | CORE-09/11 |
| Charge/deposit/fee schedule | AIRPROP source terms; shared finance effects | Unique financial source, legal book/currency and approval | CORE-06/07 |
| Service request | SERVICE | One user request referencing canonical technical work order where needed | CORE-10/11 |
| Technical work order | Operations | Technical record written only through existing authoritative gateway | CORE-11 |
| Owner statement | Authorized derived financial projection | Rebuildable; official ledger distinguished from private bookkeeping | CORE-07/12 |
| Acquisition / disposal | AIRPROP case and agreement references | Approval, execution, payment and right transfer are separate transitions | CORE-05/06/07/09 |
| Settlement / closure | AIRPROP coordination; shared financial engine | Preserve history, pending disputes and unrelated valid rights | CORE-06/07/11 |

## Lifecycle and command matrix
The following command semantics require implementation mapping; they are not existing RPC claims.

| Flow | States | Authorized transition | Preconditions / side effects |
|---|---|---|---|
| Opportunity | draft → qualified → underwriting → diligence → approved/rejected/cancelled → converted | Create, qualify, evaluate, approve, convert | Valid scope; immutable evaluation; conversion links agreement, not duplicate case |
| Offer | draft → review → published → withdrawn/expired/closed | Publish / withdraw | Explicit projection approval; availability check; withdrawal removes public visibility |
| Demand | draft → submitted → matched → closed/cancelled | Submit / match | Consent and scoped party; matching does not authorize a commitment |
| Proposal | draft → sent → accepted/rejected/expired/superseded | Accept exact version | Party authority, expiry, terms hash; competing acceptance serialized |
| Agreement | draft → review → signed → active → amended/ended → settled/closed | Activate exact signed version | Required approval/evidence; rights and obligations effective by date |
| Mandate | draft → approved → active → suspended/expired/revoked → settled | Activate / revoke | Explicit authority and limits; application delegation separately approved |
| Handover | planned → inspected → exception_pending/accepted → closed | Accept / accept with exceptions | Operational evidence and recipients; unresolved exceptions tracked |
| Commercial use | scheduled → active → suspended/ended | Begin / end use | Agreement/right, availability and accepted handover where required |
| Settlement | open → calculated → reviewed → approved → posted → closed/disputed | Approve / post | Shared finance source idempotency; correction by adjustment/reversal |
| Acquisition/disposal | proposed → evaluated → approved → contracted → executed → settled | Execute | Counterparty, legal evidence, finance approval and explicit right transfer |

Do not collapse signature, activation, handover, payment and settlement into a single success flag. Dates use explicit time-zone/effective-date rules; money uses decimal and ISO currency.

## Permission action matrix
Current seeded permissions: opportunity.read/manage, underwriting.manage, asset.read/manage.
Additional actions below require catalogue review and explicit permissions before exposing commands. They are not granted by broad manage menus.

| Capability | Read | Draft/propose | Approve | Execute | Scope |
|---|---|---|---|---|---|
| Opportunity | Existing opportunity.read | Existing opportunity.manage | Separate approval action proposed | Conversion action proposed | Exact workspace/subject |
| Underwriting | Opportunity-authorized projection | Existing underwriting.manage | Evaluation approval proposed | No financial effect | Inherit opportunity |
| Offer/demand | Private scoped view / approved public view | Catalogue action proposed | Publication approval proposed | Publish / withdraw proposed | Exact workspace/subject |
| Agreement/right | Commercial view proposed | Terms proposal proposed | Signature/activation approval proposed | Authorized shared-contract command | Parties and subject scope |
| Mandate | Principal/agent scoped view | Mandate proposal proposed | Principal approval proposed | Activate/revoke proposed | Named mandate and limits |
| Handover | Participating party scoped view | Inspection supplied by Operations | Party acceptance proposed | Coordinate access through authoritative gateway | Named handover |
| Obligation/fees | Authorized financial projection | Source submission proposed | Shared finance approval | Shared finance posting | Legal book and source |
| Service/work order | Existing domain permissions | SERVICE/Operations commands | Existing payer/technical approvals | Existing technical workflow | Canonical request/work order |

Separation of duties is evaluated server-side for actions requiring independent approval. Legal owner, mandate agent, workspace administrator and finance approver are distinct relationships. Local roles compose published module permissions; deny remains authoritative. Delegation never exceeds source authority.

## Shared exchange matrix
Use platform.outbox_events; no second bus. These are proposed event contracts.

| Producer | Event semantic | Consumer | Authorized response |
|---|---|---|---|
| AIRPROP | agreement activated/amended/ended | Operations, SERVICE, finance | Refresh eligible rights/obligations; independently authorize effects |
| AIRPROP | handover accepted | Operations, SERVICE | Coordinate accepted inventory/access/service readiness |
| SERVICE | service requested/completion approved | Operations, finance, AIRPROP | Reuse work order; approve source-linked charge when applicable |
| Operations | work order completed / condition recorded | SERVICE, AIRPROP | Present technical result; no automatic customer acceptance |
| Shared finance | obligation posted / receipt allocated / settlement corrected | AIRPROP, SERVICE, Operations | Refresh authorized balances and status |
| Shared registry | subject binding/version changed | All domains | Invalidate derived projections; never silently move historical commercial records |

Envelope includes event identity/type/version/time, tenant/workspace, aggregate ID/version, actor, correlation and causation. Publish atomically with source transition. Consumers deduplicate by event/handler, handle ordering and retries, and retain visible failures. Financial effects use their own unique source reference, not event delivery count.

## Internal application surfaces
Workspace commercial overview; opportunity pipeline; offer/demand matching; evaluation and evidence; proposal comparison; agreement/version timeline; rights and operating arrangements; mandates/fees; handover and exceptions; financial schedules and owner statements; acquisition/disposal; settlement/disputes; authorized portfolio reporting.
All surfaces use server capability projections and the same active context. RO/EN/FA include RTL, accessible controls and shared formatting. Navigating between workspaces cancels stale requests and prevents previous-context data from rendering or submitting.

## Delivery sequence and completion evidence
| Slice | Dependency | Required evidence | Current status |
|---|---|---|---|
| A: Shared scope and effective authorization | CORE-01/02/03 | Actual command/RLS denial tests | Draft #214/#216; branch implementation |
| B: Persist commercial workspace identity | A | Immutable scope, tenant FK, rebinding/read/retry denial | Being validated in #216 |
| C: Explicit workspace mutation context | Core grant/resolver consumer audit | Same-tenant workspace isolation; unchanged legacy consumers | Specified in -02; not implemented |
| D: Shared subject/party/contract mapping | CORE-04/05/06 | Canonical identities, conflicts, signed version | Pending implementation audit |
| E: Offer/demand/proposals/agreements | C/D plus availability | Complete authorized commercial flow | Architecture specified |
| F: Rights/models/mandates/handover | D/E/CORE-09/11 | Scope/time concurrency, approval, evidence | Architecture specified; legacy subset exists |
| G: Finance/events/services | CORE-07/08/10/11 | Unique sources, replay recovery, one work order | Shared infrastructure exists; integration pending |
| H: UI and full lifecycle acceptance | All previous slices/CORE-12 | Three locales, stale contexts, renewal/termination/settlement | Pending product implementation |

Completion means the complete authorized path runs through the application and authoritative gateways with reproducible tests. Documentation, SQL functions and green isolated tests each prove only their own scope. Merge/deployment and production migration reconciliation remain explicit integration steps.

## Three-work coordination rule
AIRPROP changes commercial records; Operations changes technical records; SERVICE changes service/booking records. Shared prerequisites have one owning PR and explicit consumer dependencies. Register touched shared paths before work. Rebase and rerun integration tests after core changes. Repository contracts are discoverable coordination evidence; independent conversations must explicitly adopt them.
