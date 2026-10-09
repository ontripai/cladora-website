# AIRPROP Architecture Documentation

**Package:** `AIRPROP-ARCHITECTURE-001`  
**Version:** 1.0  
**Status:** Proposed — Draft PR review required  
**Baseline:** `ontripai/cladora-website@6f788247dbb898f669c1dc0e1180d3e4b02aece5`

This package defines AIRPROP as a real-estate investment and management operating system built on the shared CLADORA platform core. It is documentation only: it introduces no migration, runtime code, remote configuration, credential, integration or customer data.

## Controlled documents

1. [`ADR-AIRPROP-001-platform-boundary.md`](ADR-AIRPROP-001-platform-boundary.md) — architecture and bounded contexts.
2. [`AIRPROP-DOMAIN-MODEL-v1.0.md`](AIRPROP-DOMAIN-MODEL-v1.0.md) — aggregate and lifecycle model.
3. [`AIRPROP-PERMISSION-MATRIX-v1.0.md`](AIRPROP-PERMISSION-MATRIX-v1.0.md) — roles, scopes and dual-control requirements.
4. [`AIRPROP-AUTOMATION-APPROVAL-MATRIX-v1.0.md`](AIRPROP-AUTOMATION-APPROVAL-MATRIX-v1.0.md) — automation authority boundaries.
5. [`AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md`](AIRPROP-COUNTRY-PACK-CONTRACT-v1.0.md) — Romania-first and Dubai-ready localization contract.
6. [`AIRPROP-MIGRATION-TEST-PLAN-v1.0.md`](AIRPROP-MIGRATION-TEST-PLAN-v1.0.md) — forward-only implementation sequence and acceptance gates.

## Lifecycle alignment added 2026-10-05

The additive [AIRPROP lifecycle alignment 014 v1.1](../architecture/CLADORA-AIRPROP-LIFECYCLE-014-v1.1.md) records the later implementation baseline, LC-A01–A03 gaps, shared-core requests and acceptance order. The original package status below is historical and is not the current runtime status. No previous architecture document is replaced.

## Original governing verdict

`READY-FOR-AIRPROP-CORE-DISCOVERY-NOT-IMPLEMENTATION`

Implementation remains blocked until this package is reviewed and a separate execution task authorizes a numbered migration and test.

## UX directive adopted 2026-10-05

[UX-DEC-001: user directive v1.0](UX-DEC-001-source-v1.0.md) complements lifecycle v1.1. [AIRPROP UX-015: gaps, first fixes and verification](UX-015-adoption-and-gaps.md) is part of the permanent workstream handoff. Open UX and security checks remain explicit; attachment does not mean full implementation conformity.

AIRPROP diligence protects its local unsaved edits against both in-module navigation and shared workspace-context changes. See [CLADORA UX-018](../architecture/CLADORA-UX-018-unsaved-context-guard.md) for the shell contract and registered forms.

## Commercial lifecycle implementation added 2026-10-07

[AIRPROP commercial lifecycle 018 v1.0](../architecture/CLADORA-AIRPROP-COMMERCIAL-LIFECYCLE-018-v1.0.md) records the AIRPROP-owned LC-A01 listing, applicant and reservation runtime, LC-A02 obligation schedule, and bounded LC-A03 resale, lease and management links. It consumes the existing Core facts and does not duplicate shared ownership, lease, authority, document or payment records.

## CLADORA v1.4 execution added 2026-10-08

[AP-VAL-01A valuation contract and domain baseline](AP-VAL-01A-CONTRACT-AND-DOMAIN-v1.0.md) defines the independent AIRPROP Slice A contracts without a migration, production model or automatic listing-price publication. [AP09](AP09-MANAGEMENT-PORTFOLIO-WIZARD-v1.0.md) and [AP10](AP10-MULTI-UNIT-MANAGEMENT-E2E-v1.0.md) record the three-language management wizard, rendered multi-unit integration and authenticated-browser blocker. The [v1.4 AIRPROP execution report](V14-AIRPROP-EXECUTION-REPORT.md) records status, evidence, blockers and next steps until PM-01 is available.

[AP01-LC-01 listing controls](AP01-LISTING-CONTROLS-v1.0.md) add versioned edit, withdrawal and republish commands to the existing commercial listing lifecycle. Production migration and deployment require separate authorization.

[AP02-RSV-01 reservation controls](AP02-RESERVATION-CONTROLS-v1.0.md) add versioned cancel, expiry, extension and commercial handoff transitions while preserving the existing exclusive-winner constraint. They do not create ownership, membership, canonical leases or financial postings.
