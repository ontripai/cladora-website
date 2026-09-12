# CLADORA Residential Pilot Readiness v1.0

**Document ID:** `CLADORA-P3-RES-PILOT-001`  
**Status:** Planning baseline — execution not authorized by this document  
**Parent roadmap:** `CLADORA-DOC-ROADMAP-001`  
**Reviewed baseline:** `ontripai/cladora-website@b78d6465a0b1b194e05c1170e966dd1c7a5fb4f8`

## 1. Purpose

This document converts Stage 7 of the master roadmap into a controlled Residential Pilot work package. It does not authorize real customer data, production mutations, account creation, email delivery, payment movement or building onboarding.

## 2. Pilot topology

| Cohort | Purpose | Data rule |
| --- | --- | --- |
| Synthetic rehearsal building | Prove workflows and failure recovery | Synthetic data only |
| Pilot Building A | First owner-approved real operational cycle | Minimum necessary data under signed pilot/DPA |
| Pilot Building B | Prove repeatability | No bespoke code or schema; same released workflow as Building A |

## 3. Entry gates

- Master roadmap v1.0 approved and merged.
- Phase 2 closure report accepted.
- Stages 1–6 marked `CLOSED` with linked evidence.
- Import preview, dry run, approval and reconciliation are production-ready.
- Backup and restore rehearsal passes before real data import.
- GDPR/DPA, controller/processor matrix, retention rules and subprocessor list are approved.
- Pilot association provides written authorization for data, named operators, bank account configuration and operational scope.
- Live PSP, malware scanner, email/SMS or other deferred providers remain fail-closed unless separately approved and configured.
- Production incident owner, support channel, rollback criteria and stop authority are named.

## 4. Pilot execution sequence

1. Read-only baseline and signed scope confirmation.
2. Synthetic full-cycle rehearsal and restore test.
3. Pilot Building A configuration without customer data.
4. Data mapping, minimization, preview and dry-run reconciliation.
5. Dual-controlled final import and opening-balance sign-off.
6. One complete monthly operational cycle.
7. Owner/resident, manager, president and censor acceptance.
8. Close, export, evidence, backup and recovery verification.
9. Defect remediation through normal PR/release controls.
10. Repeat unchanged workflow for Pilot Building B.
11. Independent pilot closure review and owner decision.

## 5. Mandatory measurements

| Area | Required evidence |
| --- | --- |
| Onboarding | Duration, rejected rows, duplicates, manual corrections and reconciliation delta |
| Finance | GL/subledger parity, balanced journals, closed-period enforcement and exact allocation totals |
| Operations | Missing readings, invoice exceptions, open tickets, approvals and time-to-close |
| Experience | Task completion by role, RO usability, accessibility and support requests |
| Reliability | Error rate, latency, alert delivery, backup age and restore result |
| Security/privacy | Cross-tenant denial, least privilege, AAL2, audit completeness and unresolved findings |
| Repeatability | Building B completed without schema fork, special branch or building-specific business logic |

## 6. Hard-stop conditions

Stop the pilot without bypass when any of the following occurs:

- Ledger/subledger drift or an unbalanced posted journal.
- Cross-tenant or cross-unit data disclosure.
- Unrecoverable import ambiguity or opening-balance mismatch.
- Missing authorization for real data or bank-account configuration.
- Critical/High security finding without containment.
- Backup restore failure.
- Use of deferred malware-unscanned evidence as authoritative proof.
- Any attempt to route or hold customer funds through CLADORA.
- Need for bespoke Building B code that bypasses the canonical model.

## 7. Exit decision

The pilot verdict is one of:

- `PASS-CLADORA-RESIDENTIAL-PILOT-REPEATABLE`
- `CONDITIONAL-PASS-CLADORA-RESIDENTIAL-PILOT`
- `BLOCKED-CLADORA-RESIDENTIAL-PILOT`
- `FAIL-CLADORA-RESIDENTIAL-PILOT`

Only the first verdict satisfies the Master Roadmap Residential Pilot Exit Gate. General availability, expansion to another country, or activation of a future real-asset vertical requires a separate decision.

## 8. Immediate next implementation task

`CLADORA-P2-ONBOARD-001 — Controlled Residential Data Import, Shadow Ledger Reconciliation & Building Onboarding`

Required scope:

- Versioned Excel/CSV templates.
- Preview and validation without persistence.
- Duplicate and tenant-scope controls.
- Staged import with explicit approval.
- Opening-balance and bank/fund reconciliation.
- Provenance and immutable audit evidence.
- Abort/rollback before activation; forward correction after activation.
- Synthetic rehearsal first; no real customer data in automated tests.

This task is the first open gate toward the Residential Pilot. It is not permission to execute the pilot itself.

## 9. Verdict

`READY-FOR-CLADORA-P2-ONBOARD-001-DISCOVERY`

