# Operations: integrated application source, task 234-1

Status: `SOURCE_INTEGRATED_BUILD_VERIFIED / INDEPENDENT_SOURCE_REVIEW_REQUIRED / INSTALL_RUNTIME_HOLD`.

This is the real `/{lang}/app` application path. It does not extend `/demo`, start a server, install a database, or prove a deployed journey. All accepted source outside the new Operations delta is preserved. Completing work is not invoice approval, payment, financial close, or proof of contractor attendance.

## Reproducible candidate and precedence

The patch targets BASE `8c8225fb3297035a2349357bd968d60779388063`, tree `4bb17830fe9d38dc833e1cb4dcba17da0d166c69`. It incorporates the accepted 48-path assembly: patch `60d0b97a4cf231332e9711a126cb859957dce77b`, delivery manifest `453ae7da6fe79332cd2fea1fe083d482b595c589`, [PM203 acceptance](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6418778996). Its Operations predecessor is the accepted PM200 successor, not an earlier full patch stacked on top of it. Every selected output and BASE preimage was checked independently before composition.

The local checkout is `56c957adbc3dae712827dd5bdd1f760951facfe9`. It is not relabeled as this BASE. Its 2,098 tracked paths are all contained in the 2,228-path BASE. Historical ancestry through `51fdf2e30916e1ff48c5567230dae9b7b6f05029` is UNKNOWN because that parent object is unavailable locally. The resolution is a separate, ordinary candidate directory reconstructed from the exact BASE blobs, followed by the verified 48 selected outputs. No checkout, reset, stash, new branch, commit, or published demo change occurred. Applying this artifact to another commit needs its own preimage-aware integration; this is not a merge claim.

The roadmap input is `docs/roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md`, Git blob `010a2648ce1d8f4e90cc1105a0c949088e3e8234`; sections 7, 13, 14 and 26 inform the Operations boundary. This task does not repeat the closed product inventory or claim completion of other v1.4 domains. Later unrelated producer/proof/demo packets are not silently stacked into this candidate.

## What is connected, and what remains unproved

All paths below are existing product paths unless explicitly marked as new wiring. RPC names are in `customer_api`. Backend route/RPC implementations remain unchanged by the new wiring.

| Stage | Actual source connection | Installation / dependency | Actual verification and remaining gate |
| --- | --- | --- | --- |
| Login, MFA, current Context | Existing login/AppShell and `CustomerContextProvider` read contexts and dashboard; the dashboard now admits reads only with a matching committed Context dashboard. MFA link uses `/{lang}/mfa`. | Real provider configuration, issued session, current membership/permissions and module activation. | Mounted readiness/late-response checks and actual Next handler denial/error mapping passed offline. Real login/AAL2/currentness/revoke is NOT RUN. Claims validation is not proof of strict concurrent logout serialization. |
| Building and equipment | Navigation to `/{lang}/app/assets`; `CustomerAssetsDashboard` uses `/api/customer/v1/assets/registration` and `get_asset_registration_choices_v1` / `register_equipment_v1`. A building comes from the selected authorized Context and existing registration choices; no fictional building record is introduced. | Installed Context/building/asset source, scoped write permission and suitable active building. Existing building onboarding remains separate accepted source. | Navigation and source boundary checked. Equipment registration in an issued session and persisted readback are NOT RUN. No new claim that a building was created. |
| Contractor | Navigation to `/{lang}/app/vendors`; existing `CustomerProcurementDashboard` / `ContractorRegistrationPanel` call `/api/customer/v1/procurement/contractors`, `list_contractors_v1`, `register_contractor_v1`, `approve_contractor_v1`. | Existing approval authority and an approved scoped contractor. | Source connection retained; actual registration/approval and tenant isolation need the authorized runtime lane. The UI does not substitute a locally approved contractor. |
| Maintenance plan | `CustomerMaintenanceDashboard` mounts the accepted `PreventiveMaintenancePanel`; `/api/customer/v1/maintenance-plans` calls `list_calendar_plans_v1` and `save_calendar_plan_v1`. | Installed calendar/asset/vendor schema and canonical permission/MFA checks. | Actual mounted form through actual Next handler to explicit fake RPC passed. Database revision conflicts/ACL/revoke remain NOT RUN. |
| Due occurrence -> draft order | Same route calls `generate_calendar_order_v1`; validated history now opens `WorkOrderLifecyclePanel` by exact work-order ID. | Existing unique occurrence and transaction/locking behavior, eligible plan and contractor. | Controlled simultaneous clicks dispatched one canonical RPC offline. Actual unique constraint, concurrent generation and commit behavior are NOT RUN. Draft creation is not assignment. |
| Issue / assignment | `/api/customer/v1/work-orders/[id]/issue` -> `issue_work_order_v1`; recorded contractor is used. | Current scoped issue authority and approved recorded contractor. | Actual mounted form/handler wiring passed offline; recorded vendor/scope enforcement still requires PG/runtime proof. |
| Start | `/api/customer/v1/work-orders/[id]/start` -> `start_work_order_v1`. | Canonical lifecycle and authority checks. | Mounted start/receipt/current readback passed with fake RPC. Real transaction behavior is NOT RUN. |
| Checklist and completion | Existing `WorkOrderChecklistPanel` -> checklist route -> `work_order_checklist_v1`; completion form -> complete route -> `complete_work_order_v1`. | Installed checklist/order state, current authority and required-item enforcement. | Required item blocks premature completion in the mounted journey; real handler wiring and validated completion readback passed. Actual concurrent checklist/complete/rollback/audit proof is NOT RUN. |
| Authorized verification | Existing verify form -> verify route -> `verify_work_order_v1`; success uses validated receipt plus current readback. | Current canonical verify permission and eligible completed order. | Denied operator and authorized verifier paths passed through the real handler with an explicit fake authority result. No new separation-of-duties/self-approval policy is claimed. Real verification authority and revoke must be tested after installation. |
| Revisit record | New validated `work_order` query on `/{lang}/app/maintenance`; existing exact-ID `get_maintenance_v1` read; current title, contractor, completion text and execution timestamps are displayed. | Existing authorized read API/schema; access rechecked on reopen. | Exact-ID navigation works even when the order is outside the bounded list page. Valid/invalid server-page input and current history display passed offline. Persisted history after a new login/browser reload is NOT RUN. This is current state, not a fabricated durable command receipt or a new audit ledger. |

## New source delta

Before editing, exact paths and purpose were recorded in `docs/worklogs/CORE-OPERATIONS-234-1.md` and the external evidence worklog.

1. `src/app/[lang]/app/maintenance/page.tsx`: validate locale and optional UUID before selecting an order. Query input is not authorization. Optional `searchParams` keeps existing callers compatible.
2. `src/components/customer/CustomerMaintenanceDashboard.tsx`: actual journey navigation, committed Context readiness, plan/history selection and exact-ID detail independent of the 20-row page. Retain the plan component when changing tabs so its in-memory uncertain attempt survives. Hide and disallow its reads/actions when inactive.
3. `src/components/customer/PreventiveMaintenancePanel.tsx`: readiness/full Context binding and validated history callback. Keep the existing frozen wire, revision, occurrence, strict receipt and recovery contract.
4. `src/components/customer/WorkOrderLifecyclePanel.tsx`: display validated current completion/timestamps and a revisit link. Command, checklist, admission, permission, receipt and UNKNOWN semantics are unchanged.
5. `scripts/test-operations-app-journey.mjs`: new mounted application/real-handler offline integration checks.
6. This verification document.
7. The pre-edit worklog.

There is no new database effect, migration, authority engine, service-role fallback, command queue, demo state, or installer in this delta. Previously accepted SQL files carried by the 48-path baseline remain source-only and byte-identical. They are not evidence that their migrations ran.

## Verification performed

Commands run against the integrated candidate with already installed dependencies; no dependency or lockfile changes:

- `node node_modules/next/dist/bin/next build --webpack`: production compile/type checks and static generation passed. Backend connection environment variables were removed from this build process; no dummy credentials were supplied. This did not start an application server or test a deployed backend.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Scoped existing ESLint on the maintenance page, three changed components and the new test, with `--max-warnings 0`: passed.
- `node scripts/test-operations-app-journey.mjs`: 64 checks in eight scenarios passed. It mounts the actual React components in JSDOM and loads actual Next handlers, schemas and origin/error mapping. The Supabase client/Auth return and RPC transport are explicitly fake dependencies; tests do not execute SQL, authenticate a user, or test Postgres/RLS.
- Full patch application and reverse application on exact BASE preimages, output identities and preservation checks are recorded in the delivery manifest. They prove artifact reproducibility, not runtime readiness.

The new integration scenarios cover plan -> deduplicated generation -> exact-ID -> issue -> start -> required checklist -> completion -> denied verification -> authorized verification -> revisit; UNKNOWN plan across view switches; lost write response with matching readback; foreign Context; malformed/partial read; uncommitted Context readiness; late prior-building response; and actual handler unauthenticated/origin/MFA error boundaries. Closed predecessor suites and other owners' successful suites were not rerun.

React review covered unconditional hooks, cleanup/abort of stale work, stable attempt ownership, action admission, labeled controls, localized text and flexible layouts. This is a source review, not a browser accessibility or responsive-device PASS.

## Install/runtime hold and explicit limits

No fresh database query was authorized or performed. The current staging catalog, installed Functions/ACL/RLS and real data prerequisites are UNKNOWN. The accepted Building-only hosted lineage is not a complete installer for maintenance, assets and procurement. Blindly replaying historical migrations, marking them applied, weakening guards, or modifying managed Auth is not an installation plan. A separately authorized Operations-compatible install/bootstrap decision and execution lane must resolve those dependencies before the journey can be accepted as operational.

The next real acceptance lane needs provider-issued AAL1/AAL2 sessions, an authorized current building Context, real asset and approved contractor, plan/occurrence persistence, current permission/revoke/foreign-building denials, duplicate/concurrent requests, checklist revision race, transactional audit/rollback and fresh-session history readback. Do not report the mock as these tests. Existing ordinary plan/lifecycle recovery is in-memory only: closing/reloading can lose an uncertain attempt. A matching GET is not a receipt, and no automatic replay or successful completion is inferred from it. Durable cross-reload UNKNOWN recovery remains a separate product/backend dependency.

Installation, backend acceptance, browser end-to-end, performance, deployment and activation remain `NOT_RUN_NOT_PASS`. This candidate is ready for independent source review; it is not evidence of completed building operations on staging.
