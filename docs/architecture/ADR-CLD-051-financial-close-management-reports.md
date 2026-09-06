# ADR-CLD-051 — Financial Close & Management Reporting Foundation

Status: Implemented
Date: 2026-09-06
Package: P1 (`Financial Close & Management Reporting Foundation`)

---

## 1. Context

In the CLADORA Residential Asset Operating System, managing property finances requires strict accounting controls, immutable auditability, and clear separation of duties. While the basic accounting ledger foundation (`finance.get_customer_ledger`) previously allowed viewing individual posted journals, the platform lacked:
1. **Official Period Close Engine**: The ability to check period readiness, validate all journals, and atomically seal an accounting period with an immutable snapshot.
2. **Management Financial Reporting**: Authoritative, real-time generation of Trial Balance, Profit & Loss (Income Statement), and Balance Sheet reports directly from double-entry journal records.
3. **Strict Separation of Duties**: The supervisory `president` and auditing `censor` personas require full transparency into close readiness and financial statements without possessing the authority to execute period closures. Private residents (`owner`, `tenant_resident`) must be strictly segregated from complex-wide financial statements.
4. **Currency Discipline**: Real-world Romanian associations operate primarily in RON or EUR. Cross-currency aggregation or arbitrary synthetic conversions within financial statements violate accounting standards and tenant isolation.

---

## 2. Architectural Decisions

### A. Strict Role & Permission Access Matrix

We defined three granular permissions in migration `20260906150000_customer_financial_close_reporting.sql`:
* `finance.reports.read`: Authority to inspect Trial Balance, Profit & Loss, and Balance Sheet reports.
* `finance.periods.read`: Authority to inspect accounting periods and evaluate close readiness blockers.
* `finance.periods.close`: Authority to execute the atomic closure of an accounting period.

#### Role Capability Bindings

| Role | Persona Type | `finance.reports.read` | `finance.periods.read` | `finance.periods.close` | Can Close Period |
|---|---|:---:|:---:|:---:|:---:|
| `association_admin` | Management | Yes | Yes | Yes | **Yes** |
| `property_manager` | Management | Yes | Yes | Yes | **Yes** |
| `president` | Supervisory Oversight | Yes | Yes | **No** | **No (Read-Only)** |
| `censor` | Financial Audit / Inspection | Yes | Yes | **No** | **No (Read-Only)** |
| `owner` | Property Resident | **No** | **No** | **No** | **Blocked** |
| `tenant_resident` | Unit Tenant | **No** | **No** | **No** | **Blocked** |

- **Fail-Closed Gatekeeper**: Database RPCs strictly assert `auth.uid()`, active time-bounded membership, valid context grant, `w.lifecycle_status = 'ACTIVE'`, and `app_private.customer_mfa_required()` with AAL2 verification.
- **Client DOM Safety**: For `president`, `censor`, and resident personas, the UI strictly omits Close Period mutation controls from the DOM entirely.

---

### B. Fail-Closed Financial Context Scoping (`app_private.resolve_financial_context_scope`)

To ensure strict tenant isolation and fail-closed security across financial close and reporting RPCs, all scope resolution logic is unified in `app_private.resolve_financial_context_scope(p_context_id uuid)`:
1. **Authentication & Membership**: Verifies `auth.uid()`, active time-bounded membership, active context grant, and tenant workspace lifecycle (`w.lifecycle_status = 'ACTIVE'`).
2. **MFA Gate**: Enforces `app_private.customer_mfa_required(v_membership.tenant_id, v_membership.user_id)` with AAL2 verification.
3. **Context Type Segregation**:
   - `association` or `portfolio`: Operates at the association level (`p_scope_type = 'association'`). Resolves `association_id`. Queries match `j.association_id = v_association_id`.
   - `property`: Operates at the property level (`p_scope_type = 'property'`). Strictly requires `context.property_id IS NOT NULL`. Queries match `j.property_id = v_property_id` and `a.property_id = v_property_id`. Property context never accesses tenant-wide records (`property_id IS NULL`) or records belonging to other properties.
   - `building` or `unit`: **Fail-Closed Rejection**. Financial reporting and close operations require property or association level scope. Contexts with `scope_type in ('building', 'unit')` are immediately rejected with SQLSTATE `42501` (`financial_reporting_requires_property_or_association_scope`).

---

### C. Safe & Atomic Accounting Period Close

#### 1. Close Readiness Evaluation (`finance.get_close_readiness`)
- Read-only RPC returning a structured assessment:
  - Period identification (`starts_on`, `ends_on`, `status`, `closed_at`, `closed_by`).
  - `draft_journals_count`: Count of unposted draft journals in the period (`status = 'draft'`).
  - `unbalanced_journals_count`: Count of journals where debit != credit across entries.
  - `posted_journals_count`: Count of canonical journals (`status in ('posted', 'reversed')`).
  - `unclosed_preceding_periods_count`: Count of unclosed periods prior to this period (`ends_on < target.starts_on`).
  - `currency_summaries`: Array of segregated summaries per currency (`currency`, `total_debit`, `total_credit`, `difference`), stably sorted by `currency ASC`.
  - Future period validation: If `ends_on >= current_date`, raises blocker `period_not_ended` (a period cannot be sealed until its duration has fully concluded).
  - `can_close`: Boolean flag indicating whether closure is permissible.
  - `blocking_reasons`: Descriptive array of blocking reasons (`period_not_ended`, `has_draft_journals`, `has_unbalanced_journals`, `period_already_closed`, `preceding_periods_open`).

#### 2. Atomic Close Execution (`finance.close_accounting_period`)
- Evaluates role permissions; strictly rejects `president`, `censor`, `owner`, `tenant_resident`, and unauthorized callers.
- Locks the target accounting period row using `SELECT ... FOR UPDATE`.
- Enforces strict idempotency and immutability:
  - If already closed, raises `period_already_closed` (409 conflict).
  - If `ends_on >= current_date`, raises `period_not_ended` (400).
  - If any draft journals exist, raises `period_has_draft_journals` (400).
  - If any unbalanced journals exist, raises `period_has_unbalanced_journals` (400).
  - If any unclosed preceding period exists, raises `preceding_periods_unclosed` (400).
- **Multi-Currency Snapshot Version 2**:
  - Segregates debit and credit summaries per currency into `currency_summaries` array without cross-currency summation or synthetic conversions.
  - Generates immutable trial balance summary per account and currency.
  - Assigns `snapshot_version: 2`, `close_reason: p_reason`, `closed_at`, `closed_by`.
- Updates `finance.accounting_periods`:
  - `status = 'closed'`
  - `closed_at = statement_timestamp()`
  - `closed_by = auth.uid()`
  - `metadata = jsonb_set(..., '{close_snapshot}', v_snapshot)`
- **Atomic Audit Event**: Direct insert into `audit.events` within the same transaction:
  - `action = 'accounting.period.closed'`
  - `resource_type = 'accounting_period'`
  - `resource_id = p_period_id::text`
  - Records closing user, timestamp, period boundaries, and Version 2 snapshot payload.
- Closed periods are permanent and non-reopenable.

---

### D. Standardized Reversed Journal Contract

In the CLADORA ledger, journal entries are strictly append-only and immutable once posted. Corrections are executed by posting compensating journals with `status = 'reversed'` and `reversal_of_id = <original_id>`.
All financial reporting queries and period close calculations adhere to the canonical condition:
```sql
j.status in ('posted', 'reversed')
```
Draft entries (`status = 'draft'`) are excluded from reports and act as blockers during period close.

---

### E. Server-Authoritative Management Financial Reporting (`finance.get_customer_financial_report`)

1. **Parameters & Strict Validation**:
   - `p_context_id`: Verified customer context.
   - `p_report_type`: Strictly `'trial_balance'`, `'profit_loss'`, or `'balance_sheet'`.
   - `p_from`, `p_to`: Strict ISO calendar date boundaries verified via `z.iso.date()` (rejects impossible calendar dates like `2026-02-30`, with `p_from <= p_to`).
   - `p_currency`: Exact currency filter (e.g. `'RON'`, `'EUR'`).
2. **Currency Segregation**:
   - Every financial statement executes against a single requested currency.
   - No currency conversions or multi-currency sum aggregations are performed, guaranteeing data integrity.
3. **Double-Entry Source Truth**:
   - Reports compute figures strictly from `finance.journal_entries` joined to `finance.journals` where `j.status in ('posted', 'reversed')`.
   - Never generates mock entries or synthetic zero-balance accounts.
4. **Account Class Mapping**:
   - Aligned with the Romanian Chart of Accounts (`plan de conturi`):
     - **Balance Sheet**: Assets (Class 2 Non-current, Class 3 Inventories, Class 5 Treasury/Cash, select Class 4 Debtor Receivables) vs Liabilities & Equity (Class 1 Capital/Reserves, Class 4 Payables/Suppliers).
     - **Profit & Loss**: Operating/Financial Revenues (Class 7) vs Expenses (Class 6), deriving Net Surplus / Deficit.
     - **Trial Balance**: Sourced accounts displaying Opening Balance, Period Debits, Period Credits, and Ending Balance, asserting ledger equilibrium.

---

### F. Central Access Matrix & Route Classification

- All customer routes are classified centrally in `src/lib/customer/route-classifier.ts` and `src/lib/customer/access-matrix.ts`.
- The total customer pages count **38** (35 permission-protected, 1 pre-context, 1 explicitly allowed, and 3 explicitly unavailable).
- Route `/app/accounting/reports` is protected by `finance.reports.read` + `module.accounting`.
- Route `/app/accounting/month-close` is un-mocked and protected by `finance.periods.read` + `module.accounting`.
- `access-matrix.ts` enforces that supervisory roles (`president`, `censor`) have read capabilities, management roles have full capabilities, and residents receive zero accounting navigation links.
- API Route `/api/customer/v1/accounting/periods/[id]/close` enforces:
  - Trusted mutation origin check (`hasTrustedMutationOrigin`, 403)
  - Strict Content-Type check (`isApplicationJson`, 415)
  - Stream/byte-level payload limit (`parseJsonWithLimit(request, 10 * 1024)`, 413 / 400)
  - Sanitized error responses without internal Zod stack trace exposure.

---

### G. Closed Period Ledger Seal, GiST Overlap Constraints & Concurrency Lock Protocol

To eliminate race conditions and guarantee immutable accounting integrity at the database storage engine layer (implemented in migration `20260906190000_closed_period_ledger_seal.sql`):

#### 1. Physical GiST Exclusion Constraints
- **Property Periods**: `accounting_periods_property_no_overlap` enforces `EXCLUDE USING gist (tenant_id WITH =, property_id WITH =, (daterange(starts_on, ends_on, '[]'::text)) WITH &&) WHERE (property_id IS NOT NULL)`.
- **Tenant-Wide Periods**: `accounting_periods_tenant_no_overlap` enforces `EXCLUDE USING gist (tenant_id WITH =, (daterange(starts_on, ends_on, '[]'::text)) WITH &&) WHERE (property_id IS NULL)`.
- **Cross-Scope Overlap Policy**:
  - A Tenant-Wide period (`property_id IS NULL`) cannot overlap with any tenant or property period of the same tenant.
  - Property periods of **different properties** can be concurrent.
  - Serialization is enforced by locking the parent `platform.tenants` row `FOR UPDATE` in `finance.assert_accounting_period_no_overlap()`, preventing concurrent insertion races across tenant-wide and property scopes.

#### 2. Row-Level Concurrency Locking Protocol (`FOR SHARE` vs `FOR UPDATE`)
- When creating, updating, or deleting journals or entries, `finance.assert_scope_date_not_in_closed_period()` locks covering periods using `FOR SHARE`.
- `finance.close_accounting_period()` locks the target period row using `FOR UPDATE`.
- Mutual exclusion guarantees:
  - **Journal first**: Holds `FOR SHARE` lock $\implies$ Close's `FOR UPDATE` query blocks and waits $\implies$ once Journal commits, Close unblocks and captures the new Journal in its authoritative snapshot.
  - **Close first**: Holds `FOR UPDATE` lock $\implies$ Journal's `FOR SHARE` query blocks and waits $\implies$ once Close commits and sets `status = 'closed'`, Journal unblocks, re-evaluates the committed row, and fails-closed with SQLSTATE `25000` (`cannot_modify_journal_in_closed_period`).
- **Fail-Closed Matching**: For any journal date, at most one period may match. If multiple periods match (`v_total_matching > 1`), the system aborts fail-closed with SQLSTATE `23P01` (never picking a period with `LIMIT 1`).

#### 3. Complete Trigger Coverage on Journals and Entries
- `finance.journals`: Trigger `trg_assert_journal_not_in_closed_period` covers `BEFORE INSERT OR UPDATE OR DELETE`:
  - On `INSERT`: Validates `NEW.occurred_on` and validates property belongs to tenant.
  - On `DELETE`: Validates `OLD.occurred_on`.
  - On `UPDATE`: Validates **both** `OLD.occurred_on` and `NEW.occurred_on` (and validates property belongs to tenant on `NEW`).
- `finance.journal_entries`: Trigger `trg_assert_journal_entry_closed_period` covers `BEFORE INSERT OR UPDATE OR DELETE`:
  - On `INSERT`: Validates parent journal for `NEW.journal_id`.
  - On `DELETE`: Validates parent journal for `OLD.journal_id`.
  - On `UPDATE`: Validates parent journal for `OLD.journal_id` and, if `journal_id` changed, validates `NEW.journal_id`.

#### 4. Structural Integrity Enforcement (`trg_assert_journal_entry_integrity`)
- `entry.tenant_id = journal.tenant_id = account.tenant_id` (SQLSTATE `42501`: `Cross-tenant journal entry denied`)
- `account.property_id IS NOT DISTINCT FROM journal.property_id` (SQLSTATE `42501`: `Cross-property journal entry denied`)
- `account.currency = journal.currency` (SQLSTATE `42501`: `Journal currency mismatch`)
- Property belongs to same tenant (`properties.tenant_id = journal.tenant_id`)
- Unit belongs to same tenant and journal property (`units.property_id = journal.property_id`)

#### 5. Deterministic Aggregation
- `finance.get_close_readiness` and `finance.close_accounting_period` enforce `ORDER BY cs.currency ASC` inside `jsonb_agg(...)`, guaranteeing deterministic ordering of `currency_summaries` arrays across calls.

#### 6. API Error Mapping and Sanitization
- Database SQLSTATE exceptions are mapped cleanly in the Route Handler:
  - `25000` $\to$ `ACCOUNTING_PERIOD_CLOSED` (HTTP 409)
  - `23P01` $\to$ `ACCOUNTING_PERIOD_OVERLAP` (HTTP 409)
  - `42501` $\to$ `PERIOD_CLOSE_DENIED` (HTTP 403)
  - `P0002` $\to$ `PERIOD_NOT_FOUND` (HTTP 404)
  - `22023` / `23514` $\to$ `PERIOD_CLOSE_BLOCKED` (HTTP 400)
  - `40001` $\to$ `PERIOD_ALREADY_CLOSED` (HTTP 409)
- Raw PostgreSQL exception messages are strictly prevented from leaking to API clients.

---

### H. Financial Close Final Corrective Hardening (Migration `20260906210000_financial_close_final_corrective_hardening.sql`)

Following independent audit findings, the following definitive corrective hardening was enacted:

#### 1. Scope Isolation & Period Listing Endpoint
- **Dedicated Period List RPC (`finance.list_customer_accounting_periods`)**:
  - Association/Tenant scope: returns periods of the active tenant.
  - Property scope: strictly returns `property_id = context.property_id` (zero tenant-wide or cross-property leakage).
  - Building/Unit scopes: fail-closed with SQLSTATE `42501`.
- **Dedicated Route (`GET /api/customer/v1/accounting/periods`)**:
  - Validates `context_id` UUID, verifies authenticated claims, invokes `finance.list_customer_accounting_periods`, and formats response via strict schema.
  - Replaces legacy ledger period listing in `CustomerMonthClose.tsx`.
- **Legacy Ledger Periods Leak Remediation**:
  - In `finance.get_customer_ledger`, property scope is updated in the forward migration to strictly match `p.property_id = v.property_id` (never `property_id IS NULL`).

#### 2. Period Property-to-Tenant Mandatory Integrity
- Trigger `a_assert_accounting_period_property_tenant` on `finance.accounting_periods`:
  - Executes `BEFORE INSERT OR UPDATE OF tenant_id, property_id`.
  - Asserts that if `property_id IS NOT NULL`, `properties.tenant_id = accounting_periods.tenant_id`.
  - Rejects mismatches with SQLSTATE `42501`.

#### 3. Parent-Update Structural Integrity Triggers
- Trigger `a_assert_journal_parent_update_integrity` on `finance.journals`:
  - Intercepts updates of `tenant_id`, `property_id`, `currency`.
  - Rejects updates if child `finance.journal_entries` exist.
- Trigger `a_assert_account_parent_update_integrity` on `finance.accounts`:
  - Intercepts updates of `tenant_id`, `property_id`, `currency`.
  - Rejects updates if child `finance.journal_entries` exist.

#### 4. Authoritative Reason Redaction (`app_private.redact_audit_text`)
- Sanitizes reasons before insertion into `snapshot_json` and `audit.events`.
- Trims control characters and applies regex filtering against sensitive patterns: passwords, bearer tokens, cookies, authorization headers, API keys, and service-role secrets (returning `[REDACTED]`).
- Caps maximum text length at 500 characters.

#### 5. Strict Snapshot Version 2 Schema & Error Sanitization
- `snapshotVersion2Schema`: Enforces exact JSON structure from `finance.close_accounting_period`.
- Rejects Version 1 snapshots, untyped records, and optional fields for mandatory properties.
- Full route error sanitization across all 4 endpoints (`financial-reports`, `periods`, `close-readiness`, `close`), never exposing raw database errors or stack traces to clients.

#### 6. Complete DOM Mutation Gating (`canRenderCloseAction`)
- In `CustomerMonthClose.tsx`, the Close button, modal dialog, confirmation form, and reason input only enter the DOM when:
  1. `role ∈ {'association_admin', 'property_manager'}`
  2. `finance.periods.close` permission exists
  3. `module.accounting` entitlement is active
  4. `readiness.status === 'open'`
  5. `readiness.can_close === true`

#### 7. Byte-Based 10KB Stream Defense
- `parseJsonWithLimit` enforces 10KB limit with immediate stream reader cancellation (`await reader.cancel()`).
- Tests cover multi-byte UTF-8, missing/spoofed/invalid Content-Length.
- Atomic audit event rollback verified in pgTAP.

---

### I. Readiness Contract, Ledger Detail Scope & Independent Concurrency Runner (Migration `20260906220000_financial_ledger_detail_scope_correction.sql`)

Following independent audit findings on readiness schema compatibility, ledger detail scope, and concurrency validation:

#### 1. Contract Separation: Readiness Summary vs Snapshot Summary
- **Readiness Summary (`readinessCurrencySummarySchema`)**:
  - Validates `finance.get_close_readiness` output: `currency`, `posted_journals_count`, `draft_journals_count`, `total_debit`, `total_credit`, `difference`, `is_balanced`.
  - Top-level `is_balanced` boolean is explicitly required.
  - `trial_balance` is omitted from readiness (readiness is pre-close inspection check).
- **Snapshot Summary (`snapshotCurrencySummarySchema`)**:
  - Validates immutable close snapshot: includes mandatory `trial_balance` array (Romanian chart of accounts compliant) and excludes `draft_journals_count` (drafts are prohibited in closed periods).

#### 2. Empty Accounting Period Close Policy
- Closing an empty eligible accounting period (0 journals) is fully permitted.
- `snapshotVersion2Schema` accepts `currency_summaries: []` with `is_balanced: true`.
- Zero synthetic amounts or placeholder currencies are injected.
- Re-closing an empty period is rejected with conflict (`period_already_closed`).

#### 3. Authoritative Ledger Detail Scope & Zero Disclosure
- In `finance.get_customer_ledger`, passing `p_journal_id` invokes an authoritative scope check before reading child entries.
- Property context is strictly limited to `property_id = context.property_id` (rejecting cross-property and tenant-wide `property_id IS NULL` journals).
- Resident contexts are strictly limited to journals touching their assigned `unit_id` and party.
- Any non-existent or out-of-scope journal uniformly raises SQLSTATE `P0002` / `ledger_journal_not_found`, which the API maps to HTTP 404 (`LEDGER_JOURNAL_NOT_FOUND`) with zero disclosure of out-of-scope journal existence.

#### 4. Real Independent Multi-Connection Concurrency Runner (`scripts/test-financial-close-concurrency.mjs`)
- **Authoritative Fixture Architecture**:
  - Sets up complete entity hierarchy in PostgreSQL before launching scenarios: `auth.users`, `platform.tenants`, `portfolio.properties` (A, B, C), `identity.roles`, `identity.role_permissions`, `identity.memberships`, `identity.context_grants`, `platform.customer_workspaces`, `platform.workspace_entitlements`, `finance.accounts`, and `finance.accounting_periods`.
  - Decoupled properties and past-concluded accounting periods (2025-01-01 to 2025-01-31) guarantee that each scenario executes independently without false failures from preceding periods.
- **Connection Roles & Execution Paths**:
  - **Internal Writer Connection**: Executes backend journal creation and posting within an isolated transaction (Draft Journal $\to$ Balanced Entries $\to$ Post Journal $\to$ Commit), acquiring and holding a `FOR SHARE` lock on the accounting period.
  - **Authenticated Closer Connection**: Sets session context to role `authenticated` with claims `{ sub: F_USER, role: 'authenticated', aal: 'aal2' }`, invoking the real `finance.close_accounting_period` RPC which acquires a `FOR UPDATE` lock on the accounting period.
  - **Independent Observer Connection**: Continuously inspects `pg_blocking_pids($1)` with strict PID matching (`blockers.includes(expectedBlockerPid)`), preventing any false-positive pass on unrelated locks.
- **Strict Scenario Specifications & Exact SQLSTATEs**:
  - **Scenario A (Journal First)**: Writer holds `FOR SHARE` on period; Close `FOR UPDATE` is observed waiting with exact PID; Writer commits; Close unblocks, seals the period, produces a Version 2 snapshot with the 450 RON total, and records exactly 1 close audit event.
  - **Scenario B (Close First)**: Closer executes RPC and holds transaction open (`FOR UPDATE`); Writer attempts draft journal insertion and is observed waiting on `FOR SHARE`; Closer commits; Writer unblocks and is rejected with exact SQLSTATE `25000` (`Cannot modify journal in closed period`); zero illicit journals persist.
  - **Scenario C (Double Close)**: Closer 1 executes RPC and holds open; Closer 2 attempts close concurrently; Observer proves Closer 2 is waiting behind Closer 1; Closer 1 commits; Closer 2 unblocks and is rejected with exact SQLSTATE `40001` (`period_already_closed`); exactly 1 snapshot and 1 audit event remain.
- **Ephemeral Database Lifecycle & CI Integration**:
  - Executed in `.github/workflows/database-tests.yml` (`postgres-runtime` job) after migrations are applied against a dedicated ephemeral database container.
  - Clean rollback is executed on all connections in `finally`, followed by `supabase stop` teardown on `if: always()`.
  - **Fail-Closed & Negative Verification**: Offline runs fail immediately with exit code 1 (`ECONNREFUSED`); connection failure is strictly isolated from concurrency validation; assertion logic rejects mismatched PIDs, invalid error codes, or altered audit counts.


---

## 3. Explicit Boundaries (Out of Scope)

The following items are intentionally excluded from this P1 foundation:
1. **SAF-T (Standard Audit File for Tax)**: Romanian statutory electronic export (D406) is deferred to future enterprise compliance iterations.
2. **Statutory Tax Filings**: Forms D300 (VAT), D394, and annual statutory balance sheets are out of scope.
3. **File Export Engines**: Client/server generation of PDF, XLSX, or CSV report files is deferred.
4. **Period Reopening**: Reopening closed periods is prohibited to ensure strict accounting immutability.
5. **Scheduled/Automated Period Close**: Month close remains an intentional, dual-audited manual operational workflow.
6. **Production Deployments & Migrations**: Local development and verification only; production environments remain untouched.
