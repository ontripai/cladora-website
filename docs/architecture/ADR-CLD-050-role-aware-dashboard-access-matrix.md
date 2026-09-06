# ADR-CLD-050 — Role-Aware Customer Dashboard & Persona Access Matrix

Status: Implemented  
Date: 2026-09-06  
Package: P1 (`Role-Aware Dashboard & Access Matrix`)  

---

## 1. Context

The CLADORA Residential Asset Operating System previously served a single, uniform customer dashboard containing generic metrics (total complex properties, buildings, units, work orders, unread notifications, and outstanding receivables) across all roles.

This presented critical architectural and security deficiencies:
1. **Tenant & Scope Exposure**: Property owners and residential tenants were exposed to whole-building and complex-wide aggregate operational counters rather than their own units' records.
2. **Lack of Persona Differentiation**: Supervisory personas (`president`), financial inspection personas (`censor`), management personas (`association_admin`, `property_manager`), and private residents (`owner`, `tenant_resident`) saw identical UI presentations.
3. **Module Guessing in API**: The Customer Dashboard API route (`/api/customer/v1/dashboard`) previously executed speculative RPC calls to `finance.get_customer_ledger`, `billing.get_customer_billing`, and `payments.get_customer_payments` to guess active modules from RPC error outcomes.
4. **Mutating Surface for Auditing Personas**: The `censor` role was not strictly constrained to a non-mutating, read-only inspection interface.

---

## 2. Architectural Decisions

### A. Authoritative Server-Side Persona Classification (`platform.get_customer_dashboard`)
- Re-implemented `platform.get_customer_dashboard(uuid)` in migration `20260906120000_customer_role_aware_dashboard.sql` as a `security definer` function with explicit search path.
- Enforces:
  1. Valid authenticated JWT (`auth.uid()`).
  2. Customer MFA policy enforcement (`app_private.customer_mfa_required()` + `aal2` verification).
  3. Active, time-bounded context grant and membership (`statement_timestamp()`).
  4. Active customer workspace lifecycle (`w.lifecycle_status = 'ACTIVE'`); fails closed if inactive.
  5. Canonical role allowlist: strictly `('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident')`; any other role raises `unknown_role` (42501).
  6. Server-authoritative derivation of active workspace modules based on verified permissions and entitlements. Speculative client or API RPC guessing has been completely removed.
  7. Persona-specific KPI queries and section payload generation.

### B. Strict Role × Capability Matrix

| Role / Persona | Persona Type | Read-Only | Primary Scopes | Allowed Dashboard Sections | Forbidden Data & Boundaries |
|---|---|---|---|---|---|
| **`association_admin`** | Management | No | `tenant`, `property`, `building` | `operations`, `financials`, `maintenance`, `communications`, `documents`, `modules`, `audit`* | Private resident personal diaries |
| **`property_manager`** | Management | No | `tenant`, `property`, `building` | `operations`, `financials`, `maintenance`, `communications`, `documents`, `modules`, `audit`* | Private resident personal diaries |
| **`president`** | Governance / Supervisory | Yes (Non-operational) | `tenant`, `property`, `building` | `governance`, `financial_summary`, `contracts`, `operations_summary`, `audit`* | No operational mutating action triggers |
| **`censor`** | Financial Audit / Inspection | Yes (Strict Read-Only) | `tenant`, `property` | `financial_controls`, `control_documents`, `discrepancies`, `audit_trail`* | No mutating actions, approvals, registrations, or work order management |
| **`owner`** | Property Owner | No | `unit` (or owned property units) | `my_units`, `my_financials`, `my_documents`, `my_voting`, `service_requests` | Other units' private info, resident directory, credentials, access logs, general audit |
| **`tenant_resident`** | Resident / Occupant | No | `unit` | `my_residence`, `my_expenses`, `my_payments`, `my_consumption`, `my_tickets`, `resident_notices` | Owner equity/capital, property ownership records, owner votes, other units' data, credentials, access logs, general audit |

*\*Note: `audit` and `audit_trail` sections are strictly projected only when the caller holds `audit.events.read` permission.*

---

## 3. Server Authorization vs. Client Presentation Boundary

1. **Server/Database Authoritative (L1 Defense)**:
   - The PostgreSQL RPC enforces tenant isolation, context active status, workspace lifecycle, role validation, and unit-level data filtering.
   - The API route `/api/customer/v1/dashboard` uses the Supabase User Client (never Service Role) and forwards the caller's JWT claims.
   - PostgreSQL error `42501` is translated to HTTP 403 `CONTEXT_ACCESS_DENIED`.

2. **Client Presentation & Defense-in-Depth (L2 Defense)**:
   - Central access matrix defined in `src/lib/customer/access-matrix.ts` (`PERSONA_ACCESS_MATRIX`).
   - `CustomerDashboard.tsx` checks both `isSectionAllowed(role, section)` and `dashboard.sections?.includes(section)` before evaluating JSX. Forbidden sections are completely omitted from the rendered DOM, not merely hidden with CSS (`display: none`).
   - `CustomerAppShell.tsx` filters navigation links using `isForbiddenByPersona` against the persona's `forbiddenNavLinks`.
   - `CustomerRouteGuard.tsx` rejects non-canonical roles and intercepts direct URL navigations to persona-forbidden routes.

---

## 4. Specific Persona Enforcements

### A. Censor Strict Read-Only Mode
- Censor persona displays the prominent "Mod Inspecție — Exclusiv Citire" / "حالت بازرسی — کاملاً فقط خواندنی" badge.
- All mutating capabilities (`can_manage_work_orders`, `can_mutate_financials`, `can_approve_requests`, `can_register_items`) are rejected.
- All CTAs are purely inspect/review links (`Inspect Ledger`, `Review Documents`, `View Audit Log`).

### B. Owner & Tenant Data Privacy Guarantees
- **Owner**: Receives `my_units_count`, `outstanding_amount` strictly for own unit(s), `my_open_requests` for own unit(s). Never receives other units' resident info, building-wide owner rosters, credentials, or audit logs.
- **Tenant Resident**: Receives `outstanding_amount` strictly for their allocated residency charges, `my_open_tickets` for their unit, and operational notices. Never receives owner capital accounts, ownership deeds, owner voting records, credentials, or audit logs.

### C. Exclusion of the `contractor` Role
- A dedicated `contractor` role is **intentionally excluded** from this PR.
- Third-party contractors require external dispatch tokens, ticket-scoped work order signoffs, and dual-party acceptance protocols that will be implemented in a dedicated Procurement & Vendor Extranet package.
- Any request with role `contractor` or unapproved roles is rejected fail-closed with PostgreSQL error code `42501` (`unknown_role`).

---

## 5. Next Steps: Financial Reports & Export Foundation

In subsequent phases (P2):
1. **Financial Reports Engine**: Scheduled generation of association balance sheets, trial balances, and owner account statements.
2. **Export Subsystem**: Cryptographically signed PDF/CSV export pipelines with tenant isolation and audit logging of generated exports.
