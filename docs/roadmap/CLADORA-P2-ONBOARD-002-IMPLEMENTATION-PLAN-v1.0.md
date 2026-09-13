# CLADORA-P2-ONBOARD-002 — Implementation Plan v1.0

## Residential Pilot Import Completion & Reconciliation Acceptance

**Status:** Implementation authorized; local-first execution  
**Baseline:** `ontripai/cladora-website@420b4c49566a8ecac672eb7873c34dc843d388dd`  
**Database baseline:** Local/Remote 85; next forward-only change is Migration 86  
**Next pgTAP suite:** Test 070  
**Release budget:** one consolidated Preview and one Production deployment maximum  
**Data boundary:** synthetic fixtures only until the owner separately authorizes a named real-building dataset

## 1. Outcome

Complete the controlled-import engine required to rehearse a Romanian residential association end to end without creating a parallel portfolio, occupancy, utilities, billing or accounting domain.

The package upgrades ONBOARD-001 from a control-plane foundation into a pilot-ready residential importer with deterministic template versions, dependency-aware validation, tenant-scoped natural-key matching, atomic canonical writes and exact financial reconciliation.

## 2. Canonical template pack

| Order | Template code | Canonical target | Pilot status |
| ---: | --- | --- | --- |
| 10 | `property` | `portfolio.properties` | Existing handler retained and hardened |
| 20 | `building` | `portfolio.buildings` | Add handler |
| 30 | `entrance` | `portfolio.entrances` | Add handler |
| 40 | `unit` | `portfolio.units` | Add handler |
| 50 | `party` | `portfolio.parties` | Add handler with protected contact fields excluded from CSV R1 |
| 60 | `ownership` | `portfolio.ownerships` | Add effective-period and share-total validation |
| 70 | `occupancy` | `occupancy.occupancies` and `occupancy.occupants` | Add handler |
| 80 | `account` | `finance.accounts` | Existing handler retained and hardened |
| 90 | `opening_gl` | `finance.journals` and `finance.journal_entries` | Add one balanced posted opening journal |
| 100 | `open_receivable` | `billing.invoices`, `invoice_lines`, `receivables` | Add traceable opening documents |
| 110 | `meter` | `utilities.meters` | Add handler |
| 120 | `meter_reading` | `utilities.meter_readings` | Add captured opening reading; validation remains explicit |

Vendor contracts, asset registers and fund configuration remain separate follow-on templates because their canonical legal and accounting contracts require independent acceptance. They must fail closed in ONBOARD-002.

## 3. Migration 86

Migration `residential_pilot_import_completion` will contain DDL and routines only. It must not contain tenant IDs, P1TEST references, sample IBANs, people, balances or other fixture DML.

It will:

1. Add immutable `natural_key`, `dependency_key`, `match_status`, `canonical_snapshot` and `expected_version` data required for safe matching.
2. Add a versioned template-registration API so templates are configured through a controlled administrative transaction rather than seed data in a migration.
3. Add private `app_private` handlers for each supported template and retain `customer_api` wrappers as `SECURITY INVOKER` with `search_path = pg_catalog`.
4. Validate the complete dependency graph before dry run and commit.
5. Classify rows as `new`, `exact_existing`, `update_candidate`, `ambiguous`, `duplicate_in_file` or `invalid` within the run tenant/property only.
6. Reject update candidates and ambiguity in R1; no existing canonical row is silently modified.
7. Create exactly one balanced opening journal and one mapping for every committed financial source row.
8. Reconcile imported receivables to account 4111 and imported advances to account 419; require `ar_delta = 0` and `clearing_delta = 0`.
9. Check that the accounting date belongs to an open period and reject closed/future dates.
10. Keep the full commit in one transaction under a run-level row lock and advisory scope lock.

## 4. Security and privacy

- Only active tenant context grants are authoritative; source tenant/property fields never grant scope.
- Manage operations require `onboarding.import.manage`; commit and activation require independent `onboarding.import.approve` plus AAL2.
- `creator_user_id`, submitter and approver must satisfy dual control.
- Direct staging-table writes remain denied to authenticated clients.
- Privileged implementations live only in non-exposed `app_private`; no exposed `SECURITY DEFINER` routine is permitted.
- CSV R1 excludes raw CNP, passport numbers, bank credentials and plaintext secrets.
- Error responses do not reveal cross-tenant entity existence.
- P1TEST accounts are never enabled or mutated by this package.

## 5. Atomicity and recovery

- Preview and dry run perform zero canonical writes.
- Five concurrent approvals must produce exactly one winner and one canonical write-set.
- A failure in any row rolls back every canonical row, mapping, journal and reconciliation record.
- Cancellation is permitted only before commit.
- After commit or activation, corrections are forward-only; destructive rollback remains deferred.
- Every canonical row created by the import is traceable through `platform.import_entity_mappings`.

## 6. Test 070 acceptance matrix

Test 070 and the real multi-connection harness must verify:

- all 12 template contracts and their dependency order;
- tenant/property-scoped natural-key matching;
- duplicate, ambiguity and update-candidate fail-closed behavior;
- ownership share bounds and effective-period integrity;
- unit/building/entrance relationship correctness;
- meter scope and reading monotonicity constraints;
- exact opening-journal balance and open-period enforcement;
- 4111/419 subledger parity;
- five-request concurrency with one winner;
- zero partial writes after injected failure;
- stable hashes and idempotent retries;
- invoker-only exposed RPCs, pinned search paths and anon denial;
- zero fixture DML and zero P1TEST dependency.

## 7. Application delivery

- Extend the existing building setup wizard; do not create another onboarding UI.
- Provide downloadable RO/EN/FA CSV headers and field guidance.
- Add dependency progress, row issues, match classification and reconciliation views.
- Require an explicit confirmation screen before submission and a separate approver screen.
- Preserve no-store, same-origin mutation checks, bounded uploads and streaming parsing.

## 8. Controlled release sequence

1. Complete all code and tests locally without pushing.
2. Run static DB contract, full pgTAP runtime, concurrency, unit, i18n, typecheck, lint and build.
3. Create one consolidated commit and one Preview deployment.
4. Apply Migration 86 only after green CI and Security Advisor review.
5. Squash merge once, producing one Production deployment.
6. Run synthetic E2E and verify zero customer/P1TEST mutation.
7. Issue a pilot-readiness report; real data remains separately authorized.

## 9. Deferred boundaries

- `DEFERRED-REAL-BUILDING-DATA-UNTIL-OWNER-AUTHORIZATION`
- `DEFERRED-XLSX-UNTIL-MALWARE-SCANNER`
- `DEFERRED-VENDOR-CONTRACT-IMPORT`
- `DEFERRED-ASSET-REGISTER-IMPORT`
- `DEFERRED-FUND-CONFIGURATION-IMPORT`
- `DEFERRED-DESTRUCTIVE-POST-ACTIVATION-ROLLBACK`

## 10. Acceptance target

`READY-TO-IMPLEMENT-CLADORA-P2-ONBOARD-002-SYNTHETIC-RESIDENTIAL-PILOT`
