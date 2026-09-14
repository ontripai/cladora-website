# AIRPROP Migration and Test Plan v1.0

## Status

Planning only. No migration number or timestamp is reserved by this document. The next migration must be created through the repository's canonical Supabase migration workflow after separate approval.

## Forward-only delivery sequence

| Package | Schema objective | Acceptance objective |
| --- | --- | --- |
| `AIRPROP-CORE-001` | opportunities, underwriting versions, interests and operating model | tenant isolation and lifecycle foundation |
| `AIRPROP-ACQUISITION-001` | due diligence, acquisition, cost and approval records | blocking findings, idempotency and dual control |
| `AIRPROP-LEASING-001` | commercial schedules, deposits, handover and lease events | rent/deposit accounting and cross-unit isolation |
| `AIRPROP-MANAGEMENT-001` | mandates, owner approvals, fees, payables and statements | client-money segregation and reconciled statement |
| `AIRPROP-ASSET-001` | plans, KPI, valuation, CapEx and disposal | immutable valuation and controlled disposal |
| `AIRPROP-RO-PILOT-001` | Romania pack v1 and synthetic fixtures | three complete Bucharest journeys |
| `AIRPROP-AE-DU-CONTRACT-001` | Dubai pack contract fixtures only | fail-closed capability tests; no integration |

## Migration design rules

1. Forward-only; existing CLADORA migrations remain byte-identical.
2. New schema objects use tenant foreign keys and explicit property/legal-entity scope.
3. RLS is enabled as defense in depth; authenticated clients receive no broad direct writes.
4. Commands use narrow gateways with context, permission, AAL, lifecycle and idempotency checks.
5. `SECURITY DEFINER` is limited to private/internal functions, fixed search paths and revoked PUBLIC execution.
6. Accepted snapshots and posted financial evidence are immutable.
7. Monetary rows carry ISO currency; conversions preserve rate/source/date.
8. Country rules are effective-dated and referenced by evidence records.
9. New foreign keys receive supporting indexes where required.
10. Security Advisor must be clean before remote apply approval.

## Required pgTAP coverage

### Foundation

- schema, table, constraint, index, trigger and gateway existence;
- direct anonymous/authenticated writes denied;
- tenant/property/case isolation;
- role and permission denial paths;
- AAL2 enforcement and proposer/approver separation;
- deterministic errors and zero partial writes;
- retry/idempotency and concurrent-command behavior;
- audit evidence without personal-document leakage.

### Accounting

- balanced immutable journals;
- deposit receipt remains a liability;
- owner receipt remains owner payable/client money;
- only management fee becomes management income;
- owner payout cannot exceed reconciled payable;
- acquisition/disposal events do not drift GL/subledger parity;
- currency and rounding rules are deterministic.

### Country packs

- missing, expired and unsupported rules fail closed;
- historical evidence remains bound to its original pack version;
- Romania and Dubai data cannot invoke each other's rules;
- license-required capabilities block without verified evidence.

## Synthetic Bucharest acceptance

One transaction-wrapped fixture must prove:

1. acquire and operate an owned apartment;
2. operate a leased asset under a head lease and permitted sublease assumption;
3. manage a third-party apartment under a bounded mandate;
4. invoice and reconcile rent;
5. receive and return/allocate a deposit under independent approval;
6. approve an owner expense within and above mandate limits;
7. calculate management fee separately from owner funds;
8. produce a zero-difference owner statement;
9. simulate valuation and disposal without moving real funds or title;
10. roll back all fixture writes.

## Application tests

- RO/EN/FA copy and Persian RTL;
- role-aware navigation and field redaction;
- no-store, same-origin and request-size controls;
- accessibility for tables, alerts, forms and approval states;
- API schema validation and deterministic localized error mapping;
- no service-role secret in browser bundles;
- production build and existing CLADORA regression suite.

## Release gates

Each implementation package requires: local database package PASS, transaction-wrapped pgTAP PASS, typecheck/lint/unit/build PASS, clean Security Advisor, one independently approved remote migration application, `Local N / Remote N / Drift 0`, squash merge, matching Production SHA and a closure report. Real data, real funds, external providers and jurisdictional activation each require separate authorization.

## Explicitly deferred

- real customer/property data;
- live bank or payment instructions;
- e-signature and identity-verification providers;
- land-registry/cadastral integrations;
- DLD/Ejari/RERA/Trakheesi integrations;
- automated legal notices;
- production country-pack activation;
- legal or accountant certification claims.
