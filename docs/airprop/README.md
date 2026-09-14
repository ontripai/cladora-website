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

## Governing verdict

`READY-FOR-AIRPROP-CORE-DISCOVERY-NOT-IMPLEMENTATION`

Implementation remains blocked until this package is reviewed and a separate execution task authorizes a numbered migration and test.
