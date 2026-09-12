# CLADORA Master Product Roadmap v1.0

**Document ID:** `CLADORA-DOC-ROADMAP-001`  
**Status:** Authoritative roadmap baseline  
**Effective date:** 2026-09-12  
**Product position:** `CLADORA — Residential Asset Operating System`  
**Long-term thesis:** `Operating System for Shared Real Assets`  
**Reviewed repository baseline:** `ontripai/cladora-website@b78d6465a0b1b194e05c1170e966dd1c7a5fb4f8`

## 1. Decision and authority

This document is the canonical source for CLADORA's three principal product phases and seven-stage residential execution roadmap. It resolves the prior documentation gap without changing the approved product direction.

The following boundaries are mandatory:

- CLADORA remains a residential product until the Residential Pilot Exit Gate passes.
- The three principal phases retain their order and authority.
- The seven stages retain their order and authority.
- `CLADORA-ARCH-REAL-ASSET-001` is a cross-cutting architecture guardrail. It is not Phase 4 and not Stage 8.
- ONE Community, Commercial, Industrial, Land, Agriculture and Energy are future candidate vertical packs only.
- Candidate verticals do not authorize implementation, database mutation, marketing claims or customer onboarding.
- Shared engines—identity, tenant isolation, finance, billing, payments, documents, maintenance, communications, assets and audit—must not be forked by vertical.
- All future database evolution is additive, versioned and forward-only.

## 2. The three principal product phases

| Phase | Canonical name | Purpose | Current state | Exit condition |
| --- | --- | --- | --- | --- |
| **Phase 1** | Secure Operational Foundation | Establish tenant isolation, identity, role-aware access, audit, canonical finance, customer API boundaries and production-safe foundations | **Closed** under the accepted Phase 1 closeout | Security, authorization, financial invariants and core operational contracts proven |
| **Phase 2** | Residential Product Completion | Convert the foundation into complete end-to-end residential building workflows across accounting, utilities, maintenance, governance, communications, documents, assets and payments | **In progress**; major vertical slices delivered | All mandatory Stage 1–6 residential capabilities pass integrated acceptance without open Critical/High defects |
| **Phase 3** | Residential Pilot, Assurance & Scale Readiness | Onboard controlled real buildings, run real monthly cycles, validate recovery/compliance/support and prove repeatable deployment | **Not yet opened** | Residential Pilot Exit Gate in Section 6 passes for two buildings without building-specific code |

Phase 3 may begin only after a formal Phase 2 closure report. Architecture preparation for future verticals may run in parallel as documentation and analysis, but cannot replace Phase 2 work or satisfy a Phase 3 gate.

## 3. Official seven-stage residential roadmap

| Stage | Canonical name | Mandatory outcome | Entry gate | Exit gate |
| --- | --- | --- | --- | --- |
| **1** | Pilot Prerequisites & Controlled Onboarding | Financial safety, real import/migration and a building setup wizard | Phase 1 closed; clean production baseline | A building can be configured and dry-run imported with reconciled opening balances and no uncontrolled writes |
| **2** | Complete Monthly Financial Cycle | Supplier invoices, allocation, monthly list, review, publication, trial balance and period close form one auditable workflow | Stage 1 evidence accepted | One synthetic month completes from source documents to immutable close with continuous GL/subledger parity |
| **3** | Collections & Bank Reconciliation | Direct-to-association collection, bank statement import, matching, partial/split/unmatched handling and reconciliation | Stage 2 accounting contract stable | All test collections reconcile without CLADORA holding funds and without ledger drift |
| **4** | Auditable Outputs & Evidence | Romanian operational PDFs/Excel/CSV, document vault, snapshots, hashes and controlled retention | Stages 2–3 produce stable records | Required reports and supporting evidence can be reproduced, verified and exported by authorized roles |
| **5** | Owner & Resident Operational Experience | Unit ledger, charges, payments, meter readings, notices, documents and minimal service-request workflow | Published data contracts stable | Owner/resident journeys pass RO/EN/FA, privacy, accessibility and tenant-isolation acceptance |
| **6** | Management Approval & Governance Control | Dual control, president/censor review, approval trails, actionable dashboards and exception queues | Stages 2–5 integrated | Sensitive workflows have explicit requester/approver separation, evidence and no unauthorized bypass |
| **7** | Production Readiness, Trust & Residential Pilot | Backup/restore, observability, GDPR/pilot contracts, support runbooks and repeatable real-building operation | Stages 1–6 closed; owner authorizes controlled real-data pilot | Section 6 Residential Pilot Exit Gate passes and Phase 3 closure is approved |

Stages are sequential release gates, not isolated feature buckets. Work may be prepared ahead of sequence, but a later stage cannot be declared complete while an earlier exit gate is open.

## 4. Current evidence-based stage status

Status values: `CLOSED`, `PARTIAL`, `NOT-OPEN`, `DEFERRED-BY-CONTRACT`.

| Stage | Status at v1.0 | Proven strengths | Remaining gate items |
| --- | --- | --- | --- |
| 1 | **PARTIAL** | Canonical ledger safety and controlled tenant/workspace foundation | Production-grade import/migration workflow; building setup wizard; opening-balance onboarding rehearsal |
| 2 | **PARTIAL** | Billing, receivables, allocation foundations, utilities and GL parity controls | One unified monthly close workflow; Romanian trial balance acceptance; integrated review/publication gate |
| 3 | **PARTIAL** | Direct association bank instructions; canonical settlement and allocation; non-custodial boundary | Bank statement import/reconciliation; live PSP remains deferred; reversal provider boundary remains deferred |
| 4 | **PARTIAL** | Secure evidence vault, immutable versions, retention model and signed access | Required production PDF/Excel/CSV report pack; malware scanner integration before authoritative evidence use |
| 5 | **PARTIAL** | Role-aware customer portal, communications, meters, maintenance and trilingual/RTL support | Integrated owner/resident journey acceptance against a pilot dataset; external delivery providers where approved |
| 6 | **PARTIAL** | AAL2, dual control, governance, audit and role separation | Cross-module approval inbox; monthly management review acceptance; exception-oriented operational dashboard |
| 7 | **NOT-OPEN** | Production deployment and extensive technical test evidence exist | Tested backup/restore, operational monitoring, GDPR/DPA package, incident/support runbooks and two-building pilot |

No `PARTIAL` status is a production or legal-compliance claim.

## 5. Controlled execution order from this baseline

1. Close Stage 1 through `CLADORA-P2-ONBOARD-001` (import and controlled onboarding) and `CLADORA-P2-SETUP-001` (building setup wizard).
2. Close Stage 2 through one canonical monthly-cycle orchestration and Romanian accountant acceptance.
3. Complete bank statement import and reconciliation for Stage 3; retain the non-custodial model.
4. Produce the statutory/operational export pack and connect an approved malware-scanning service for Stage 4.
5. Run integrated RO/EN/FA owner/resident acceptance for Stage 5.
6. Close the approval inbox and management control surface for Stage 6.
7. Prepare and execute the controlled Residential Pilot under the gate in Section 6.

Each implementation task requires its own discovery, authorization, forward-only migration decision, tests, PR and release evidence. This roadmap itself authorizes documentation only.

## 6. Residential Pilot Exit Gate

The Residential Pilot is complete only when all conditions below have objective evidence:

- One building is onboarded from zero through the controlled setup workflow.
- Source data is imported through preview and dry run before final approval.
- Opening balances, bank, receivables, advances and funds reconcile exactly.
- At least one real monthly operational cycle completes end to end.
- Supplier costs, meter readings and allocations produce the monthly list.
- President and censor record their authorized review acknowledgements.
- Owners receive the published list and can inspect their own calculation without seeing other units' private data.
- Bank transactions are reconciled and the accounting period is immutably closed.
- Required Romanian PDF/Excel outputs and audit evidence are generated.
- Backup restoration is successfully rehearsed and recorded.
- No unresolved Critical or High security, privacy, financial or data-integrity defect remains.
- A second building completes the same workflow without bespoke application code or a parallel data model.
- Owner approval, legal/accounting review boundaries and pilot contracts are recorded.

Failure of any condition keeps Phase 3 open and prevents a general-availability claim.

## 7. Shared Real Asset expansion boundary

After the Residential Pilot Exit Gate, the next decision is discovery—not automatic implementation—for:

1. ONE Community capability pack.
2. Commercial shared-property pack.
3. Industrial and warehouse leasing pack.
4. Shared land and agricultural-rights pack.
5. Energy/community infrastructure pack.

Every pack must reuse the shared core and introduce jurisdiction, scope, rights and operational rules as versioned policies or adapters. A vertical-specific duplicate ledger, payment engine, document vault, identity model or maintenance engine is prohibited.

## 8. Governance, change control and traceability

- Roadmap owner: CLADORA Product Governance.
- Architecture reference: `CLADORA-ARCH-REAL-ASSET-001`.
- Roadmap changes require a version increment, change log and explicit owner approval.
- Stage numbers and phase numbers cannot be repurposed.
- A task report may use internal execution steps, but those steps must not be called product roadmap stages.
- When another document conflicts with this roadmap, this document controls until superseded by a later approved version.

## 9. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-09-12 | Established the authoritative three-phase and seven-stage roadmap; bound the Shared Real Asset architecture work as a non-stage overlay; defined Residential Pilot entry/exit controls |

## 10. Verdict

`PASS-CLADORA-DOC-ROADMAP-001-AUTHORITATIVE-BASELINE`

