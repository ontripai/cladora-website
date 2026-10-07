# AIRPROP commercial lifecycle 018 v1.0

Date: 2026-10-07. Baseline: `main` at `bbd0b68ba9fa7b8972e6f7b1ace3b76bba581d6b`.

## Decision

This AIRPROP-owned slice closes the previously identified application-layer gaps without changing the shared property, party, document, ownership, lease, payment, workspace-authority or event foundations. Every property-bound command requires the existing current AIRPROP investment mandate and the existing native AIRPROP module permission. Resale, lease and management records link to independently completed Core facts; they never recreate or mutate those facts.

## Requirement evidence

| Requirement | AIRPROP implementation | Shared source reused | Acceptance boundary |
|---|---|---|---|
| LC-A01 listing | `airprop.market_listings` and `publish_airprop_listing_v1` | Canonical property, unit and investment opportunity | One active listing per unit and kind |
| LC-A01 applicant | `airprop.applicants` and `submit_airprop_applicant_v1` | Existing canonical party | Applicant does not receive ownership, tenancy or workspace access |
| LC-A01 reservation | `airprop.exclusive_reservations` and `reserve_airprop_listing_v1` | Existing unit identity | GiST exclusion plus row locking rejects competing active periods; retry is idempotent |
| LC-A02 obligations | `airprop.purchase_obligation_schedules` and `record_airprop_obligation_schedule_v1` | Existing signed presale and external financial-source reference | Schedule total must equal its terms; recording does not post a payment or journal entry |
| LC-A03 resale | `airprop.commercial_execution_links` with kind `resale` | Existing verified `portfolio.ownership_transfers` fact | Commercial terms cannot execute title transfer |
| LC-A03 lease | `airprop.commercial_execution_links` with kind `lease` | Existing verified `occupancy.lease_handover_receipts` fact | Commercial terms cannot activate or terminate a lease |
| LC-A03 management | `airprop.commercial_execution_links` with kind `management_mandate` | Existing active `platform.workspace_property_authorities` fact | A business mandate cannot create software authority |

## Security and recovery

The five tables have RLS enabled and no direct `anon`, `authenticated` or `service_role` table grants. Authenticated clients can call only the bounded `customer_api` functions. Commands require AAL2, current native workspace permission, current investment mandate, stored subject ancestry and server-derived tenant. Each command stores an actor-bound request hash and rejects a reused key with different content. The reservation command expires stale reservations while holding the listing lock and relies on a database exclusion constraint for the final concurrency guarantee.

## API and tests

`POST /api/customer/v2/airprop/commercial-lifecycle` accepts a strict versioned union for listing, applicant, reservation, obligation schedule and bounded execution links. It rejects client-supplied authority fields, enforces trusted mutation origin, bounds the body, authenticates before RPC execution and redacts database details.

Evidence in this branch:

- `scripts/test-airprop-commercial-lifecycle-route-018.mjs`: 18 route and contract checks.
- `supabase/tests/171_airprop_commercial_lifecycle.test.sql`: 32 database contract assertions.
- TypeScript typecheck, focused ESLint and static database-package validation.

The migration has not been applied to Production and the branch has not been deployed. Live concurrency, role, mobile, keyboard and end-to-end customer tests remain release gates after Preview is available.
