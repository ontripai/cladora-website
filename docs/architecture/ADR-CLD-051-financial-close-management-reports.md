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

## 3. Explicit Boundaries (Out of Scope)

The following items are intentionally excluded from this P1 foundation:
1. **SAF-T (Standard Audit File for Tax)**: Romanian statutory electronic export (D406) is deferred to future enterprise compliance iterations.
2. **Statutory Tax Filings**: Forms D300 (VAT), D394, and annual statutory balance sheets are out of scope.
3. **File Export Engines**: Client/server generation of PDF, XLSX, or CSV report files is deferred.
4. **Period Reopening**: Reopening closed periods is prohibited to ensure strict accounting immutability.
5. **Scheduled/Automated Period Close**: Month close remains an intentional, dual-audited manual operational workflow.
6. **Production Deployments & Migrations**: Local development and verification only; production environments remain untouched.
