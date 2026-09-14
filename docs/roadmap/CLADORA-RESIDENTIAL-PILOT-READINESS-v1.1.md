# CLADORA Residential Pilot Readiness v1.1

**Document ID:** `CLADORA-P3-RES-PILOT-001`  
**Status:** Reconciled planning baseline — Phase 3 execution not authorized  
**Parent roadmap:** `CLADORA-DOC-ROADMAP-001 v1.1`  
**Reviewed baseline:** `ontripai/cladora-website@6011c5fb4354bac02b58d8d50fd1fbb42eb0b96a`  
**Supersedes for current planning:** v1.0 (retained for history)

## 1. Current readiness

Stage 1 is closed. Stage 2 remains open only for independent Romanian accountant acceptance. Stage 3 has passed its technical exit gate but awaits sequential formal closure after Stage 2. Stage 4 has a complete fail-closed export/vault/quarantine foundation but awaits an approved scanner provider and a clean signed-download rehearsal. Stages 5–6 remain integrated-acceptance work. Phase 3 is therefore `NOT OPEN`.

## 2. Pilot topology

| Cohort | Purpose | Data rule |
| --- | --- | --- |
| Synthetic rehearsal building | Prove complete workflows and failure recovery | Synthetic data only; transactions roll back unless a separately approved disposable fixture is required |
| Pilot Building A | First owner-approved real operational cycle | Minimum necessary data under signed pilot/DPA and explicit owner authorization |
| Pilot Building B | Prove repeatability | Same released workflow; no bespoke branch, schema or business logic |

## 3. Remaining entry gates

- Stages 2–6 are formally `CLOSED` with linked evidence.
- A formal Phase 2 closure report is accepted.
- Backup and restore rehearsal passes before real-data import.
- GDPR/DPA, controller/processor matrix, retention rules and subprocessor list are approved.
- Pilot association authorization covers data, operators, bank configuration and operational scope.
- Production incident owner, support channel, rollback criteria and stop authority are named.
- Every external provider required by the pilot is explicitly authorized and configured; all others remain fail-closed.
- No unresolved Critical or High security, privacy, finance or data-integrity finding remains.

## 4. Immediate next gate

`CLADORA-P2-MONTHLY-ACCOUNTANT-001 — Romanian Accountant Acceptance of the Canonical Monthly Cycle`

Required evidence:

1. A synthetic Romanian association monthly pack generated from the released canonical workflow.
2. Traceability from supplier source documents and meter readings through allocation, unit list, receivables, trial balance and immutable close.
3. Exact GL/subledger parity and balanced journals before and after close.
4. Review of Romanian account presentation, rounding, dates, currencies, labels and export usability by an identified independent accountant.
5. Findings classified as accepted, correction-required or legally deferred; no silent waiver.
6. Signed or otherwise attributable acceptance evidence stored under the controlled evidence boundary.
7. No real customer data, live payment, tax filing or statutory-compliance claim.

This package should prefer evidence and acceptance work. A migration is created only if discovery proves a deterministic product defect requiring a forward-only correction.

## 5. Subsequent sequence

After the accountant gate: formal Stage 3 closure record; Stage 4 scanner-provider integration and clean-download rehearsal; Stage 5 integrated Owner/Resident RO/EN/FA acceptance; Stage 6 management-control closure; Phase 2 closeout; backup/restore and compliance readiness; then separately authorized Building A and Building B pilots.

## 6. Hard stops retained

Ledger drift, cross-tenant or cross-unit disclosure, unreconciled opening balances, missing authorization, failed restore, uncontained Critical/High findings, malware-unscanned authoritative evidence, CLADORA custody of customer funds, or Building B bespoke code stops progression without bypass.

## 7. Verdict

`READY-FOR-CLADORA-P2-MONTHLY-ACCOUNTANT-001-DISCOVERY`

