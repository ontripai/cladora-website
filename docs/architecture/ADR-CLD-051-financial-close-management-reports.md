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

### B. Safe & Atomic Accounting Period Close

#### 1. Close Readiness Evaluation (`finance.get_close_readiness`)
- Read-only RPC returning a structured assessment:
  - Period identification (`starts_on`, `ends_on`, `status`, `closed_at`, `closed_by`).
  - `draft_journals_count`: Count of unposted draft journals in the period (blocker).
  - `unbalanced_journals_count`: Count of posted journals where debit != credit (blocker).
  - `total_posted_journals`: Count of valid posted journals.
  - `unclosed_preceding_periods_count`: Count of unclosed periods prior to this period (blocker).
  - `is_ready`: Boolean flag indicating whether closure is permissible.
  - `blockers`: Descriptive array of blocking reasons (`has_draft_journals`, `has_unbalanced_journals`, `period_already_closed`, `preceding_periods_open`).

#### 2. Atomic Close Execution (`finance.close_accounting_period`)
- Evaluates role permissions; strictly rejects `president`, `censor`, `owner`, `tenant_resident`, and unauthorized callers.
- Locks the target accounting period row using `SELECT ... FOR UPDATE`.
- Enforces strict idempotency and immutability:
  - If already closed, raises `period_already_closed` (409 conflict).
  - If any draft journals exist, raises `period_has_draft_journals` (400).
  - If any unbalanced journals exist, raises `period_has_unbalanced_journals` (400).
  - If any unclosed preceding period exists, raises `preceding_periods_unclosed` (400).
- Computes an immutable trial balance snapshot across all accounts active in the period.
- Updates `finance.accounting_periods`:
  - `status = 'closed'`
  - `closed_at = statement_timestamp()`
  - `closed_by = auth.uid()`
  - `metadata = jsonb_set(..., '{close_snapshot}', v_snapshot)`
- Emits canonical audit event via `audit.record_event`:
  - `p_action = 'accounting.period.closed'`
  - `p_resource_type = 'accounting_period'`
  - `p_resource_id = p_period_id::text`
  - Records closing user, timestamp, and period boundary metadata.
- Closed periods are permanent and non-reopenable in this foundation.

---

### C. Server-Authoritative Management Financial Reporting (`finance.get_customer_financial_report`)

1. **Parameters & Validation**:
   - `p_context_id`: Verified customer context.
   - `p_report_type`: Strictly `'trial_balance'`, `'profit_loss'`, or `'balance_sheet'`.
   - `p_from`, `p_to`: Strict ISO date boundaries (`p_from <= p_to`).
   - `p_currency`: Exact currency filter (e.g. `'RON'`, `'EUR'`).
2. **Currency Segregation**:
   - Every financial statement executes against a single requested currency.
   - No currency conversions or multi-currency sum aggregations are performed, guaranteeing data integrity.
3. **Double-Entry Source Truth**:
   - Reports compute figures strictly from `finance.journal_entries` joined to `finance.journals` where `status = 'posted'`.
   - Never generates mock entries or synthetic zero-balance accounts.
4. **Account Class Mapping**:
   - Aligned with the Romanian Chart of Accounts (`plan de conturi`):
     - **Balance Sheet**: Assets (Class 2 Non-current, Class 3 Inventories, Class 5 Treasury/Cash, select Class 4 Debtor Receivables) vs Liabilities & Equity (Class 1 Capital/Reserves, Class 4 Payables/Suppliers).
     - **Profit & Loss**: Operating/Financial Revenues (Class 7) vs Expenses (Class 6), deriving Net Surplus / Deficit.
     - **Trial Balance**: Sourced accounts displaying Opening Balance, Period Debits, Period Credits, and Ending Balance, asserting ledger equilibrium.

---

### D. Central Access Matrix & Route Classification

- All customer routes are classified centrally in `src/lib/customer/route-classifier.ts` and `src/lib/customer/access-matrix.ts`.
- The total customer pages now count **38** (35 permission-protected, 1 pre-context, 1 explicitly allowed, and 3 explicitly unavailable).
- Route `/app/accounting/reports` is protected by `finance.reports.read` + `module.accounting`.
- Route `/app/accounting/month-close` is un-mocked and protected by `finance.periods.read` + `module.accounting`.
- `access-matrix.ts` enforces that supervisory roles (`president`, `censor`) have read capabilities, management roles have full capabilities, and residents receive zero accounting navigation links.

---

## 3. Explicit Boundaries (Out of Scope)

The following items are intentionally excluded from this P1 foundation:
1. **SAF-T (Standard Audit File for Tax)**: Romanian statutory electronic export (D406) is deferred to future enterprise compliance iterations.
2. **Statutory Tax Filings**: Forms D300 (VAT), D394, and annual statutory balance sheets are out of scope.
3. **File Export Engines**: Client/server generation of PDF, XLSX, or CSV report files is deferred.
4. **Period Reopening**: Reopening closed periods is prohibited to ensure strict accounting immutability.
5. **Scheduled/Automated Period Close**: Month close remains an intentional, dual-audited manual operational workflow.
6. **Production Deployments & Migrations**: Local development and verification only; production environments remain untouched.
