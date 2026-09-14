# AIRPROP-CORE-001 — Discovery and Implementation Report

**Status:** Local candidate

**Baseline:** `30dd1cdd06b58ed42704bccbfa84ff5303eafc94`

**Migration:** `20260914144417_airprop_core_foundation.sql`

**Test:** `086_airprop_core_foundation.test.sql`

## Discovery verdict

The CLADORA shared core already owns tenant/context isolation, canonical properties and parties, immutable accounting, payments, documents, maintenance and audit. AIRPROP Core therefore introduces only investment-specific aggregates and never creates a parallel property registry or ledger.

## Implemented bounded scope

- Romania-only opportunity creation with an idempotency contract.
- One underwriting case per opportunity with immutable, hash-deduplicated versions.
- Deterministic annual NOI, gross yield and net yield calculations.
- Whole-property legal/economic interest records separate from unit ownership.
- One non-overlapping effective operating model per property.
- Three canonical AIRPROP roles and five permissions.
- AAL2, membership, permission and context-scoped command gateways.
- Redacted audit evidence for opportunity, underwriting and property configuration.
- `AIRPROP-RO` v1.0 is accepted; Dubai fails closed as not activated.

## Explicit exclusions

- acquisition closing, title transfer or fund movement;
- lease schedules, deposits, mandates, client money or owner statements;
- journals or changes to the existing accounting engine;
- live country, cadastral, bank, DLD, Ejari, RERA or Trakheesi integration;
- real property/customer data and credentials;
- remote migration application and merge.

## Test 086 contract

The transaction-wrapped synthetic Bucharest test proves schema/gateway existence, direct-write denial, AAL2 command execution, opportunity and underwriting idempotency, two-version coexistence, deterministic NOI, owned-asset configuration, inactive Dubai failure, audit evidence, cross-tenant denial, immutable underwriting and overlapping-model rejection. All fixture writes roll back.

## Release gate

Remote apply is prohibited until CI is green and separately authorized. A future approved release must apply Migration 99 exactly once, reconcile the remote timestamp if necessary, confirm `Local 99 / Remote 99 / Drift 0`, run Security Advisor, and only then make the PR Ready for a separately authorized merge.
