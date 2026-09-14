# CLADORA Master Product Roadmap v1.1

**Document ID:** `CLADORA-DOC-ROADMAP-001`  
**Status:** Authoritative reconciled roadmap  
**Effective date:** 2026-09-14  
**Supersedes for current execution:** v1.0 (retained as immutable historical baseline)  
**Reviewed repository baseline:** `ontripai/cladora-website@6011c5fb4354bac02b58d8d50fd1fbb42eb0b96a`

## 1. Authority and unchanged boundaries

CLADORA remains the `Residential Asset Operating System`. The three principal phases and seven residential stages retain their names, order and exit gates from v1.0. `CLADORA-ARCH-REAL-ASSET-001` remains a cross-cutting guardrail, not a fourth phase or eighth stage. Future real-asset packs remain separately governed and cannot fork shared identity, finance, payment, document, maintenance or audit engines.

## 2. Phase status

| Phase | Status | Decision |
| --- | --- | --- |
| Phase 1 — Secure Operational Foundation | `CLOSED` | Accepted Phase 1 closeout remains authoritative |
| Phase 2 — Residential Product Completion | `IN PROGRESS` | Stage 1 is closed; Stages 2–4 have bounded open gates; Stages 5–6 require integrated acceptance |
| Phase 3 — Residential Pilot, Assurance & Scale Readiness | `NOT OPEN` | Requires formal Phase 2 closure and Stages 1–6 closed |

## 3. Reconciled seven-stage status

| Stage | Status at v1.1 | Proven outcome | Remaining gate |
| --- | --- | --- | --- |
| 1 — Pilot Prerequisites & Controlled Onboarding | **CLOSED** | Versioned import, preview/dry run, reconciliation, building setup, zero-write opening rehearsal, AAL2 dual control and synthetic zero-residue acceptance | None for Stage 1; real pilot remains separately authorized |
| 2 — Complete Monthly Financial Cycle | **PARTIAL** | Canonical end-to-end synthetic month, source binding, allocation, review, publication, trial balance, GL/subledger parity and immutable close | `ROADMAP-S2-ACC-001`: independent Romanian accountant acceptance |
| 3 — Collections & Bank Reconciliation | **PARTIAL** | Technical exit gate satisfied through direct-to-association settlement, controlled import, exact/split matching, exceptions and zero-difference finalization | `ROADMAP-S3-SEQ-001`: formal closure after Stage 2 closes |
| 4 — Auditable Outputs & Evidence | **PARTIAL** | Deterministic Romanian PDF/XLSX/CSV, snapshots, hashes, private vault, retention boundary and quarantine gate | `ROADMAP-S4-SCAN-001`: approved scanner integration, clean attestation and authorized signed-download proof |
| 5 — Owner & Resident Operational Experience | **PARTIAL** | Role-aware portal, unit charges/payments, meters, notices, documents, maintenance and RO/EN/FA foundations exist | Integrated owner/resident journey acceptance for RO/EN/FA, privacy, accessibility and cross-unit/tenant isolation |
| 6 — Management Approval & Governance Control | **PARTIAL** | AAL2, dual control, governance, audit and module-level approval workflows exist | Unified approval inbox, management-review acceptance and exception-oriented operational dashboard |
| 7 — Production Readiness, Trust & Residential Pilot | **NOT OPEN** | Production deployment and extensive synthetic technical evidence exist | Stages 1–6 closed, backup/restore, observability, GDPR/DPA, incident/support runbooks and two-building pilot authorization |

## 4. Controlled execution order from v1.1

1. Execute `CLADORA-P2-MONTHLY-ACCOUNTANT-001` as a bounded, synthetic evidence-review package and close `ROADMAP-S2-ACC-001`.
2. Reconcile the already-passing Stage 3 technical evidence into a formal closure record; no new bank runtime is implied.
3. Execute a separately authorized scanner-provider integration and clean-download rehearsal to close Stage 4.
4. Run the integrated RO/EN/FA Owner/Resident acceptance package for Stage 5.
5. Close the cross-module approval inbox and management-control surface for Stage 6.
6. Produce a formal Phase 2 closure report before any Phase 3 or real-building pilot action.
7. Open Phase 3 only under the controlled Residential Pilot gate.

Preparation or discovery may run ahead, but later stages cannot be declared `CLOSED` while an earlier exit gate is open.

## 5. Residential Pilot Exit Gate

The v1.0 Pilot Exit Gate remains unchanged: controlled onboarding; reconciled opening balances; one complete real monthly cycle; president/censor evidence; private owner inspection; bank reconciliation and immutable close; Romanian exports; backup restoration; no unresolved Critical/High defect; a second building without bespoke code; and recorded legal, accounting and owner approval.

No current synthetic result authorizes real customer data, funds movement, live-provider activation or a general-availability claim.

## 6. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-09-12 | Established authoritative phases, seven stages and Residential Pilot gates |
| 1.1 | 2026-09-14 | Reconciled merged evidence through Migration 95; closed Stage 1; distinguished technical completion from sequential formal closure for Stages 2–4; set the accountant-acceptance package as the next gate |

## 7. Traceability

The detailed evidence and unresolved-gate matrix is recorded in `CLADORA-ROADMAP-RECON-001-EVIDENCE-v1.0.md`. Version 1.0 remains preserved for historical comparison.

## 8. Verdict

`PASS-CLADORA-DOC-ROADMAP-001-v1.1-RECONCILED`

