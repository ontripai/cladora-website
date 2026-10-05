# AIRPROP lifecycle alignment 014 v1.1

Date: 2026-10-05. Reviewed main: `b126b7bf6574424ba75654bfc471ad1223a65b38`.

This additive record maps the lifecycle implementation package v1.1 to existing AIRPROP and shared CLADORA code. It preserves prior architecture versions. The source package is a design input, not property evidence or authorization for a commercial transaction. Its original attachment is retained in the work conversation; it is not copied into the public repository.

## Findings and evidence limits

AIRPROP currently supports workspace-scoped investment opportunities, immutable underwriting, diligence revisions/submissions, and independent internal acquisition decisions. Internal approval does not execute a purchase, transfer ownership, sign an agreement, post money or perform handover. The broader lifecycle below remains incomplete.

The complete main tree was inspected for lifecycle implementation paths. Relevant existing source and migration definitions were read. This record does not claim that absence of a similarly named file proves every possible implementation is absent. No end-to-end lifecycle test was run for this documentation change.

PR #252 delivered internal acquisition decisions. PR #260 delivered property selection through the existing document vault. Those slices do not establish completion of LC-A01, LC-A02 or LC-A03. Live diligence submission still needs eligible independently verified property evidence; a design document does not satisfy that gate.

## Requirement matrix

| Requirement | Actual state | Code and test evidence | Conflict or risk | Change owner | Dependency | Remaining action |
|---|---|---|---|---|---|---|
| LC-A01 listing and applicant | New AIRPROP runtime required; investment opportunity exists | `airprop.investment_opportunities`; `src/app/api/customer/v2/airprop/opportunities/route.ts`; `scripts/test-airprop-native-runtime-004.mjs` | An internal investment opportunity is not a published listing or applicant record | AIRPROP | LC-C01, LC-C02, LC-C03 | Define authorized listing and applicant commands referencing canonical subjects and parties |
| LC-A01 exclusive reservation | No reservation command, persistence or conflict test located in the inspected AIRPROP paths | Existing opportunity idempotency is implemented in `src/lib/airprop/opportunity-idempotency-v2.ts` | Request replay prevention does not prevent two different actors reserving the same exclusive right | AIRPROP, shared subject/availability owner | LC-C02, LC-C03; agreed exclusive-right and period semantics | Implement atomic competing-reservation enforcement and expiry/cancellation; acceptance T02 |
| LC-A02 presale and buyer case | New transaction flow required; evaluation and internal proposal are reusable prerequisites | `src/lib/airprop/acquisition-decision-v1.ts`; acquisition API; `20261004181830_airprop_acquisition_decision_v1.sql`; runtime/route/UI tests 013 | `internally_approved` is not a signed presale or closing | AIRPROP | LC-A01; shared agreement/version and financial-source contract | Define presale case and contractual-buyer relationship without granting final ownership; T03 |
| LC-A02 obligations | Shared accounting and payment foundations exist; property-purchase obligation schedule not located in AIRPROP | `finance.journals/journal_entries`, `billing.invoices/receivables`, `payments.payments`; existing underwriting is an estimate | Estimated cash flow is not an obligation, invoice or payment; financial books must remain distinct | AIRPROP commercial terms; shared finance posting | Shared agreement and financial-source contract | Record proposed schedule semantics and ask core for canonical posting/source references |
| LC-A03 resale and rights | Unit ownership and whole-property interests exist; complete resale execution not located | `portfolio.ownerships`; `airprop.property_interests`; foundation `20260914144417`; scope-ceiling tests | Existing property-level interests cannot silently become a unit-level transfer workflow | AIRPROP commercial case; core relationship mutation | LC-A02, LC-C03, LC-C05 | Bind seller authority, evidence and effective relationship transition; T06 |
| LC-A03 lease | Shared lease and owner-private lease flows exist; AIRPROP commercial integration incomplete | `occupancy.leases`; `20260925142203_multi_unit_owner_lease_lifecycle_v1.sql`; `supabase/tests/115_multi_unit_owner_lease_lifecycle.test.sql` | Owner-private bookkeeping is not the official ledger; lease end, access end and settlement are separate | Core lease/relationships; AIRPROP terms | LC-C03, LC-C05 and shared lease command contract | Reuse lease identities; integrate schedules, handover and termination; T07 |
| LC-A03 management mandate | Planned in the domain model; no AIRPROP mandate runtime located | `docs/airprop/AIRPROP-DOMAIN-MODEL-v1.0.md`; existing workspace delegations | Software delegation alone is not a business management mandate | AIRPROP mandate; core effective permission | LC-C03 and agreement contract | Define principal, agent, subject, validity, permitted actions and revocation link |
| Shared evidence | Existing vault reused by AIRPROP | `documents.documents/document_versions`; `20261004123006_airprop_diligence_review_v1.sql`; `20261005071500_document_upload_property_choices.sql` | General upload or clean scan alone is not independent evidence verification or transferable consent | Core documents; AIRPROP evidence references | LC-C05 for handover transfer policy | Keep version-pinned access, scanner and independent verification; define allowed handover manifest |
| Cross-domain delivery | Existing outbox and domain idempotency reused; complete lifecycle recovery not demonstrated | `platform.outbox_events`, `platform.idempotency_keys`; acquisition migration emits outbox metadata | Event insertion is not proof of consumer delivery, ordering or recovery | Core event contract; each consumer owns its effect | LC-C04 | Publish versioned event envelope and receipt/retry semantics; T09 |

The referenced test files are evidence that test coverage exists for their named slices. This documentation does not extend their results to the new lifecycle requirements.

## Shared core requests

These requests are recorded for the stable core/Operations workstream. This file does not notify or assign another conversation automatically. No shared schema or workflow is changed by this PR.

| Request | Existing structure to reuse | Contract needed before AIRPROP consumes it | Acceptance |
|---|---|---|---|
| LC-C01 reference map | `portfolio.properties/buildings/units/parties`; workspace property bindings | Canonical subject identity, owning authority and authorized cross-workspace projection | One subject remains traceable while workspace memberships change; T08 |
| LC-C02 planned identity and lineage | Existing property/building/unit identifiers | Versioned provisional identifiers/specifications; split/merge lineage; physical stage independent of commercial state | Renumbering preserves transaction references; no history reassignment; T01 |
| LC-C03 relationships and authority | `portfolio.ownerships`, occupancy relations, memberships and effective permission engine | Contractual buyer versus owner; effective dates; revocation; explicit mandate proof and transition command | Presale grants no owner rights; expiry revokes current operational access; T03/T07/T08 |
| LC-C04 event contract | Existing outbox and idempotency stores | Actor/context/subject, expected version, request identity, schema version, occurrence/record times, consumer receipts and recovery | Duplicate or reordered delivery produces no duplicate financial or relationship effect; T09 |
| LC-C05 handover | Existing vault, assets, readings and access assignments | Versioned handover snapshot, partial acceptance, open defects and allowed document-transfer manifest | Acceptance is independent of full settlement; prior party's private documents stay private; T04/T06 |

AIRPROP does not create a second property registry, person directory, document vault, lease ledger or event bus to work around these dependencies. Core-owned contract changes require coordination with the core workstream before implementation.

## AIRPROP implementation order

1. Obtain versioned LC-C01/C02/C03 subject and authority contracts. Prepare listing/applicant schemas against those actual references.
2. Implement LC-A01 listing and reservation, with explicit authorization, expected versions and atomic exclusive-right conflicts. Exercise two competing sessions, expiry, cancellation, revoked authority and uncertain retries.
3. Integrate LC-A02 presale case with the shared agreement and financial-source contracts. Record signature, contractual right, payment and handover as separate events. Never infer final ownership from payment or internal approval.
4. Integrate LC-A03 resale, lease and management mandate after the relationship and handover contracts are ready. Keep historical records and apply corrections as new audited transitions.
5. Run the package's two-unit scenario with labeled synthetic data in an isolated environment, including partial handover, a defect service and Operations work order, lease, sale, manager change and duplicate handover delivery. Record exact commits and environments for each result.

AI matching and sourced property answers follow the testable commercial flow. Market-price claims require licensed, dated and quality-assessed data; no accuracy claim is established by this record.

## Coordination and completion

At inspection, open PR #258 concerned maintenance dashboard authority and #261 concerned SERVICE quote presentation. This change touches only this AIRPROP record and its documentation index. It creates no migration, permission, workspace, customer record or runtime route.

Each subsequent implementation must record requirement ID, actual code/API/UI paths, migration or no migration, test result, PR, deployed commit, environment and remaining blocker. A documentation PR closes the mapping task only; it does not close any runtime row above.

The stable AIRPROP workstream owns LC-A01 through LC-A03 across numbered work conversations. The handoff must preserve this matrix, current code and deployment evidence, unfinished acceptance, exact account needed for any login, and the scope of existing permissions. Conversation rollover does not expand authorization or repeat completed migrations.
