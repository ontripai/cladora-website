# CLADORA-P2-ONBOARD-001 — Implementation Plan v1.0

## Controlled Residential Data Import, Shadow Ledger Reconciliation & Building Onboarding

**Status:** Discovery complete; implementation branch authorized  
**Parent roadmap:** `CLADORA-DOC-ROADMAP-001`, Stage 1  
**Baseline:** `ontripai/cladora-website@d694ce92c5981340dbc532f1b6f42f5ea06ed354`  
**Next database change:** Forward-only Migration 84  
**Next pgTAP suite:** Test 068  
**Product boundary:** Residential only; no Shared Real Asset vertical activation

## 1. Goal

Deliver a production-grade onboarding workflow that can take a Romanian residential association from controlled source files to an activated CLADORA workspace while proving tenant isolation, source provenance, duplicate safety and exact opening-balance reconciliation.

The workflow must support:

1. Downloadable, versioned import templates.
2. Bounded upload and server-side validation.
3. Preview with row-level errors and no domain writes.
4. Deterministic dry run with immutable input/result hashes.
5. Dual-controlled approval at AAL2.
6. Atomic commit into canonical domain tables.
7. Exact reconciliation and activation checkpoint.
8. Pre-activation cancellation without domain residue.
9. Forward corrections only after activation.

## 2. Discovery verdict

### Reuse

| Existing capability | Decision |
| --- | --- |
| `platform.provisioning_runs` and `platform.provisioning_tasks` | Extend as the orchestration parent; do not create another workspace-provisioning engine |
| `platform.customer_workspaces` lifecycle and activation gate | Reuse; onboarding activation remains fail-closed |
| `portfolio.properties`, `buildings`, `entrances`, `units`, `parties`, ownership structures | Canonical final targets |
| `occupancy.occupancies`, `occupants`, `leases`, cost responsibility | Canonical final targets |
| `finance.accounts`, `journals`, `journal_entries`, periods and ledger seal | Canonical opening-balance target and reconciliation source |
| `finance.allocation_*`, `billing.invoices`, `billing.receivables` | Canonical allocation and open-receivable targets |
| `documents` vault | Source-file evidence reference only; no duplicate file store |
| `audit.events` | Canonical audit sink |

### Missing

- Import batch, source, row, mapping and validation-result contracts.
- Versioned template registry.
- Preview/dry-run state machine.
- Deterministic natural-key resolution and duplicate classification.
- Opening-balance control totals and reconciliation certificate.
- Dual-control final commit.
- Customer-facing setup wizard joined to platform provisioning.
- Import-specific permission and restricted projections.

### Conflict to avoid

- The existing `app/onboarding` page completes the primary administrator security gate; it is not a building-data wizard and must remain intact.
- The existing Shadow Ledger marketing experience is not an accounting engine and must not become a second ledger.
- A staged row is untrusted input, not a domain record.
- Uploaded Excel/CSV files are not statutory evidence merely because they are present in the document vault.

## 3. Mandatory architecture decisions

### 3.1 Staging is not a parallel domain

Migration 84 adds staging/control records under `platform`:

- `platform.import_templates`
- `platform.import_template_versions`
- `platform.import_runs`
- `platform.import_sources`
- `platform.import_rows`
- `platform.import_row_issues`
- `platform.import_entity_mappings`
- `platform.import_reconciliation_results`
- `platform.onboarding_checkpoints`

The tables contain source payloads, validation output, hashes and canonical ID mappings only. Final business data is written exclusively to existing canonical schemas.

### 3.2 State machine

`draft → uploaded → validating → validation_failed | preview_ready → dry_running → dry_run_failed | dry_run_passed → pending_approval → committing → committed | commit_failed → reconciled → activated`

Additional terminal state before commit: `cancelled`.

- Transitions are monotonic and trigger-guarded.
- A row lock and expected version protect every mutation.
- One live import run per workspace/property is enforced with a partial unique index.
- A request ID and idempotency key make create, validate, dry run, submit and commit retries deterministic.

### 3.3 File boundary

- Maximum raw source size: 20 MiB per source and configurable lower row limits per template.
- CSV is the executable import format in R1, decoded as UTF-8 with BOM handling.
- Downloadable XLSX may be generated as a convenience template, but XLSX upload cannot reach validation/commit while the malware scanner remains deferred.
- Macro-enabled Office formats, formula execution, external links, archives and embedded active content are rejected.
- CSV cells beginning with `=`, `+`, `-` or `@` are escaped in exports and treated as plain data on import.
- Raw file bytes are hashed server-side with SHA-256; client hashes are never authoritative.
- Parsing is streaming/bounded; request bodies and row/cell lengths have explicit limits.

### 3.4 Template packs

The initial residential template pack is versioned and contains:

1. Association and property.
2. Buildings and entrances.
3. Units and ownership shares (`cota-parte indiviză`).
4. Parties: owners, tenants and companies.
5. Ownership and occupancy periods.
6. Chart of accounts.
7. Opening GL balances.
8. Unit receivable/credit balances.
9. Current and repair funds.
10. Meters and last accepted readings.
11. Active vendor/service contracts.
12. Open supplier/customer documents where supported by the canonical contract.

Every template version defines exact headers, types, required fields, natural keys, dependency order and validation rules. Once used, a version is immutable.

### 3.5 Natural keys and mappings

- Source identifiers never become tenant-global authority.
- Each row has a stable `(run_id, template_code, source_row_no)` identity.
- Natural keys are normalized and resolved inside the target tenant/property only.
- Conflicts classify as `new`, `exact_existing`, `update_candidate`, `ambiguous`, `duplicate_in_file` or `invalid`.
- `exact_existing` is idempotently mapped; `ambiguous` and unapproved `update_candidate` fail closed.
- No cross-tenant lookup result is disclosed.

### 3.6 Financial import contract

- Opening balances are control totals, not direct balance-column updates.
- Final commit creates balanced canonical journals through a dedicated internal routine using `finance.journals` and `finance.journal_entries`.
- The accounting date must fall inside an open period.
- Posted or closed-period history is never edited.
- Unit receivables and advances must reconcile with control accounts 4111 and 419.
- Bank/cash/fund control totals must match their GL accounts.
- Required invariant after commit: total debits = total credits, `ar_delta = 0`, `clearing_delta = 0`, and every imported subledger row traces to one source row and journal.
- Any mismatch rolls back the entire commit transaction.

### 3.7 Approval and activation

- Preview and validation require `onboarding.import.manage`.
- Dry run requires AAL2 and `onboarding.import.manage`.
- Final commit requires a different AAL2 actor with `onboarding.import.approve`.
- Creator/importer cannot approve their own final commit.
- Platform Operations may supervise provisioning but cannot silently assume the association approver role.
- Activation requires: committed import, reconciliation certificate, primary-admin onboarding completion, required workspace entitlements and zero blocking issues.

## 4. Migration 84 scope

Migration name: `controlled_residential_import_onboarding`

Migration 84 will:

- Create the staging/control tables and covering foreign-key indexes.
- Define enums/check constraints and non-overlap/live-run uniqueness.
- Add immutable input/result hashes and version columns.
- Add lifecycle and immutability triggers.
- Bootstrap `onboarding.import.read`, `onboarding.import.manage`, and `onboarding.import.approve` permissions using canonical roles.
- Add internal functions for validation, mapping, dry run, commit, reconciliation and activation readiness.
- Add versioned `customer_api` wrappers with `SECURITY INVOKER`, `search_path = pg_catalog`, PUBLIC/anon revoked and authenticated-only invocation.
- Extend provisioning task catalogue additively with import-validation, reconciliation and activation-check tasks.
- Contain DDL/functions only: no Tenant A, P1TEST, customer fixture, source file or opening-balance seed DML.
- Leave Migrations 1–83 byte-identical.

## 5. API and application changes

### Libraries

- `src/lib/customer/onboarding-import-schema.ts`: strict Zod contracts.
- `src/lib/customer/onboarding-import-helper.ts`: auth, AAL2, origin, body limit and deterministic error mapping.
- `src/lib/onboarding/csv-stream-parser.ts`: bounded RFC-compatible parsing without formula execution.
- `src/lib/onboarding/import-hash.ts`: canonical serialization and server SHA-256.

### Route handlers

- `GET /api/customer/v1/onboarding/templates`
- `GET /api/customer/v1/onboarding/templates/[code]/download`
- `GET/POST /api/customer/v1/onboarding/imports`
- `GET/DELETE /api/customer/v1/onboarding/imports/[id]`
- `POST /api/customer/v1/onboarding/imports/[id]/sources`
- `POST /api/customer/v1/onboarding/imports/[id]/validate`
- `GET /api/customer/v1/onboarding/imports/[id]/preview`
- `POST /api/customer/v1/onboarding/imports/[id]/dry-run`
- `POST /api/customer/v1/onboarding/imports/[id]/submit`
- `POST /api/customer/v1/onboarding/imports/[id]/approve-commit`
- `GET /api/customer/v1/onboarding/imports/[id]/reconciliation`
- `POST /api/customer/v1/onboarding/imports/[id]/activate`

All mutation routes require same-origin checks, no-store responses and bounded bodies. Raw database errors and cross-tenant existence are never exposed.

### UI

- Add a dedicated `CustomerBuildingSetupWizard` under the protected customer app.
- Preserve the existing primary-admin security onboarding page.
- Provide RO/EN/FA copy and Persian RTL.
- Steps: association → structure → people/rights → finance → meters/contracts → validation → dry run → approval → reconciliation → activation.
- Display source-row issues, blocking/warning classification, control totals and before/after counts.
- Never expose another unit's personal or financial data to owner/resident roles.

## 6. Test 068 minimum manifest

At least 70 pgTAP assertions plus application contract tests must cover:

- Object, constraint, index, routine and grant existence.
- PUBLIC/anon denial and direct staging/domain-write denial.
- Tenant/property isolation and non-enumerating errors.
- AAL2 and dual-control enforcement.
- Template immutability after first use.
- File, row, column and cell limits.
- Duplicate rows, ambiguous natural keys and dependency-order failure.
- Stable hashes and idempotent retries.
- Five concurrent commit attempts: exactly one commit/journal/mapping winner.
- Full rollback on one invalid financial row.
- Balanced opening journal and exact 4111/419 parity.
- Closed-period and backdated/future-date rejection.
- No direct mutation of posted journals or issued invoices.
- Cancel-before-commit leaves zero canonical residue.
- Post-commit cancellation denied; corrections are forward-only.
- Activation denied before reconciliation.
- Zero real-customer fixture DML and P1TEST independence.

## 7. Verification and release sequence

1. Read-only repository/Supabase preflight: clean baseline, 83/83, drift 0.
2. Create feature branch from exact `origin/main`.
3. Implement Migration 84 and Test 068 locally.
4. Run static database contract, pgTAP runtime and concurrency harness.
5. Run unit, i18n, typecheck, lint and production build.
6. Open Draft PR; review migration safety and privacy boundaries.
7. Transactional rehearsal against linked database with `BEGIN ... ROLLBACK` only.
8. Apply Migration 84 once after approved dry run and green CI.
9. Merge through normal PR gates and verify 84/84 drift 0.
10. Run synthetic-only E2E; no real building data.
11. Verify P1TEST lockdown and continuous financial parity.
12. Produce a Stage 1 readiness report; real pilot remains separately authorized.

## 8. Deferred boundaries

- `DEFERRED-XLSX-IMPORT-UNTIL-MALWARE-SCANNER`
- `DEFERRED-AUTOMATIC-OCR-IMPORT`
- `DEFERRED-THIRD-PARTY-MIGRATION-CONNECTORS`
- `DEFERRED-REAL-BUILDING-PILOT-DATA`
- `DEFERRED-POST-ACTIVATION-DESTRUCTIVE-ROLLBACK`

## 9. Acceptance verdict for this plan

`READY-TO-IMPLEMENT-CLADORA-P2-ONBOARD-001-WITH-SYNTHETIC-DATA-ONLY`

