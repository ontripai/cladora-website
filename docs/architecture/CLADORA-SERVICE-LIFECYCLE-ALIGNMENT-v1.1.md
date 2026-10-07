# SERVICE lifecycle alignment v1.1

User-supplied reference received 2026-10-05: [CLADORA Lifecycle Implementation Package v1.1](references/CLADORA-Lifecycle-Implementation-Package-v1.1.docx). The attached file is preserved byte-for-byte. Local decision identifier `CLD-LC-DEC-001` is retained as a local identifier, not assigned an invented official ADR number. Prior architecture and migrations remain historical references.

The stable SERVICE workstream owns LC-S01 and LC-S02 regardless of session numbering. CLADORA serves a property's lifecycle from planned identity and pre-sales through its lifetime; construction project execution remains outside scope. SERVICE owns service orders, Operations owns work orders, and shared Core owns identities, relationships, handover dossiers, documents and Finance. This register records dependencies for the Core workstream; it does not claim a message was delivered to another chat.

## Evidence and gaps

| Requirement | Actual status | Code and test evidence | Conflict | Change owner | Dependency | Remaining action |
| --- | --- | --- | --- | --- | --- | --- |
| LC-S01 subject/stage eligibility | Partial catalogue foundation; lifecycle eligibility not implemented | `service-catalog-schema.ts`, `service_catalog_persistence_v1` migration, `test-service-catalog-contract-001.mjs` and catalogue persistence tests | Workspace eligibility is not lifecycle/subject eligibility | SERVICE | LC-C01 canonical subject mapping | Map catalogue eligibility to versioned Core subject/state contracts; do not invent parallel property identities |
| LC-S02 handover inspection/defect/rental-readiness orders | Requests and non-binding drafts exist; linked orders not implemented | `service_request_persistence_v1`, `service_quote_draft_runtime_v1`, request and quote DB/API/UI tests | A request or presented draft is not an order or work order | SERVICE | LC-C05 handover dossier and LC-S01 | Connect authorized dossier and service order, then per-execution-step Operations link |
| LC-X01/T05 duplicate prevention | Partial at request/draft/presentation boundary only | 010/014 and new 015 DB tests; 015 tests atomic audit/outbox rollback and same-key publication | Does not prove order/work-order deduplication or customer acceptance | SERVICE + Operations | Shared order-to-work-order event contract | Add integrated replay tests when both references exist |
| LC-X01/T08 isolation | SERVICE unit/fixture coverage; whole-lifecycle acceptance pending | Catalogue context isolation tests; 015 requester AND membership/current party-link checks, workspace denial and revoked-publication replay | Fixture tests are not evidence for every Core lifecycle path | All three workstreams | LC-C03 current relationships/authority | Test transfer/revocation with canonical relationships in shared integration suite |
| LC-X01/T09 event recovery | Atomic outbox creation and command retry covered; consumer/out-of-order processing not implemented here | 015 publication transaction and concurrency tests | An outbox record is not delivery or downstream success | Core event contract; SERVICE consumer | LC-C04 | Integrate shared consumer result/deduplication contract |
| Commercial quote acceptance | Not enabled | 013 and 014 explicitly defer tax/provider authority; 015 presents only for review | Presenting a coordinator proposal cannot approve a provider, payer share or contract | SERVICE + shared Finance/relationships | Verified tax treatment, contracting/provider authority, independent payer approval | Implement explicit version-bound acceptance after shared contracts are ready |

## Effect on current change 015

The current scoped presentation API/UI can proceed independently: it consumes the existing canonical workspace/party authority and adds no lifecycle identity, financial obligation or Operations execution. It retains exact immutable quote versions and explicit non-binding wording. No assumption of ownership is made from a request or proposed payer. LC-S01/LC-S02 are not declared complete by shipping 015.

Before any handover/order integration, consume the Core contract owned by the stable Core/Operations workstream (called CLADORA 11 in the reference, including its successors). Do not implement LC-C01–C05 independently in this branch. Preserve distinctions among completion, acceptance, dispute and settlement. Each order execution step may reference at most one corresponding work order; consultancy need not create one.

## Handoff checkpoint

Repository: `ontripai/cladora-website`. Baseline `7d317d3` (#259). Current branch `cladora-service-quote-publication-015`. Source reference attached unchanged. Local checks for 015 cover DB/API/mounted UI/typecheck; CI, remote migration and production status must be recorded from release evidence and not inferred here. Existing temporary pilot permission does not authorize the new publication permission. Required account for future pilot validation: Mahmoud, as explicitly named in the user session; no credentials are stored in this document.

## UX directive and successor handoff

The user-supplied [UX and Background Controls Directive v1.0](references/CLADORA-UX-Background-Controls-Directive-v1.0.docx) supplements this lifecycle reference. Local decision `UX-DEC-001` applies to existing and new SERVICE flows and must accompany successor sessions. See [SERVICE UX 016](CLADORA-SERVICE-UX-016-v1.0.md) for observed gaps, ownership and validation limits. No independent chat notification is claimed.

Release 015 checkpoint: PR #261 squash merged as `23014127c4d3f4ca5b8eaeaa60c58637eb6d0b40`; Production deployment `dpl_7wpdhcqkevEvyBs5duxn15uFiuML` READY; migration remote version `20261005075657` applied; completed branch deleted. Publication permission was not granted and live presentation was not exercised.
