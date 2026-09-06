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
5. **Entitlement State Misinterpretation**: Inactive entitlements with `boolean_value = false` could be treated as active if date filters alone were applied without evaluating boolean or override values.

---

## 2. Architectural Decisions

### A. Authoritative Server-Side Persona Classification (`platform.get_customer_dashboard`)
- Implemented `platform.get_customer_dashboard(uuid)` in migration `20260906120000_customer_role_aware_dashboard.sql` as a `security definer` function with explicit search path.
- Enforces:
  1. Valid authenticated JWT (`auth.uid()`).
  2. Customer MFA policy enforcement (`app_private.customer_mfa_required()` + `aal2` verification).
  3. Active, time-bounded context grant and membership (`statement_timestamp()`).
  4. Active customer workspace lifecycle (`w.lifecycle_status = 'ACTIVE'`); fails closed if inactive.
  5. Canonical role allowlist: strictly `('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident')`; any other role raises `unknown_role` (42501).
  6. Server-authoritative derivation of active workspace modules based on verified permissions and entitlements. Speculative client or API RPC guessing has been completely removed.
  7. Persona-specific KPI queries and section payload generation.

### B. Entitlement Override Semantics
Workspace entitlements are evaluated using the project's canonical precedence rule:
1. Entitlement must belong to the active workspace.
2. `valid_from` has commenced and `valid_until` has not expired.
3. If an unexpired override exists (`override_value_json IS NOT NULL AND override_expires_at > statement_timestamp()`), its boolean representation (`override_value_json = 'true'::jsonb`) determines whether the entitlement is active.
4. If an override has expired, it is discarded and the underlying `boolean_value IS TRUE` is evaluated.
5. Entitlements with `boolean_value = false` without an active `true` override are never emitted in `v_entitlements` or `v_modules`.
6. Entitlements belonging to another workspace are never applied.

### C. Deep Resident Validation (Owner & Tenant-Resident)
For `owner` and `tenant_resident` personas, the RPC enforces strict resident integrity:
1. **Unit Context Requirement**: `scope_type` must equal `unit` and `unit_id` must not be null. Any context with scope `tenant`, `property`, or `building` is rejected with `unit_context_required` (42501).
2. **Membership-to-Party Mapping**: The membership must resolve to a valid party in `identity.membership_parties`. Missing mappings raise `resident_party_mapping_required` (42501).
3. **Owner Ownership Verification**: An active ownership record in `portfolio.ownerships` matching the active tenant, context unit, and mapped party with valid date range is required. Missing ownership raises `ownership_required` (42501).
4. **Tenant Active Lease Verification**: An active lease record in `occupancy.leases` matching the active tenant, context unit, mapped tenant party, status `'active'`, and valid dates is required. Missing lease raises `active_lease_required` (42501).
5. **No Property Fallbacks**: Resident KPIs never aggregate property-wide or building-wide figures. Owners and tenants see only invoices, receivables, work orders, and notices tied directly to their validated unit and party.

### D. Strict Role × Capability Matrix

| Role / Persona | Persona Type | Read-Only | Primary Scopes | Allowed Sections | Allowed Capabilities |
|---|---|---|---|---|---|
| **`association_admin`** | Management | No | `tenant`, `property`, `building` | `operations`, `financials`, `audit`* | `can_view_operations`, `can_view_financials`, `can_view_audit`* |
| **`property_manager`** | Management | No | `tenant`, `property`, `building` | `operations`, `financials`, `audit`* | `can_view_operations`, `can_view_financials`, `can_view_audit`* |
| **`president`** | Governance / Supervisory | Yes (Non-operational) | `tenant`, `property`, `building` | `governance`, `financial_summary`, `audit`* | `can_view_governance`, `can_view_financial_summary`, `can_view_audit`*, `is_read_only` |
| **`censor`** | Financial Audit / Inspection | Yes (Strict Read-Only) | `tenant`, `property` | `financial_controls`, `audit`* | `can_view_financial_controls`, `can_view_audit`*, `is_read_only` |
| **`owner`** | Property Owner | No | `unit` (strictly owned unit) | `my_units`, `my_financials` | `can_view_my_units`, `can_view_my_financials` |
| **`tenant_resident`** | Resident / Occupant | No | `unit` (strictly leased unit) | `my_residence`, `my_expenses`, `my_consumption` | `can_view_my_residence`, `can_view_my_expenses`, `can_view_my_consumption` |

*\*Note: `audit` section and `can_view_audit` capability are strictly projected only when the caller holds `audit.events.read` permission.*

### E. Section Pruning & Contract Consolidation (Future Work)
Sections without active database tables or production routes (`contracts`, `operations_summary`, `control_documents`, `discrepancies`, `my_documents`, `my_voting`, `service_requests`, `my_payments`, `my_tickets`, `resident_notices`, `maintenance`, `communications`, `documents`, `modules`) have been pruned from the contract and deferred to dedicated future work packages. No placeholders or empty stubs remain in the production surface.

---

## 3. Server Authorization vs. Client Presentation Boundary

1. **Server/Database Authoritative (L1 Defense)**:
   - The PostgreSQL RPC enforces tenant isolation, context active status, workspace lifecycle, role validation, and unit-level data filtering.
   - The API route `/api/customer/v1/dashboard` uses the Supabase User Client (never Service Role) and forwards the caller's JWT claims.
   - PostgreSQL error `42501` is translated to HTTP 403 `CONTEXT_ACCESS_DENIED`.
   - Payload is strictly versioned (`version: 1`).

2. **Client Presentation & Defense-in-Depth (L2 Defense)**:
   - Central access matrix defined in `src/lib/customer/access-matrix.ts` (`PERSONA_ACCESS_MATRIX`).
   - `CustomerDashboard.tsx` checks:
     - `dashboard.version === 1`
     - `dashboard.persona.toLowerCase() === roleCode`
     - `canRenderDashboardSection(section, reqCap, reqMod, reqPerm)` which requires both the TypeScript persona matrix allowance AND the server `dashboard.sections` array.
     - Forbidden sections are completely omitted from the rendered DOM, not merely hidden with CSS.
   - `CustomerAppShell.tsx` filters navigation links using `isRouteAllowedForPersona(roleCode, path)` against the persona's allowlist.
   - `CustomerRouteGuard.tsx` enforces the strict authorization sequence:
     `Known customer route -> Canonical role -> Persona route allowlist -> Active context -> Required permission -> Required entitlement/module -> Allow`. Any failure results in immediate fail-closed restriction.

---

## 4. Specific Persona Enforcements

### A. Censor Strict Read-Only Mode
- Censor persona displays the prominent "Mod Inspecție — Exclusiv Citire" / "حالت بازرسی — کاملاً فقط خواندنی" badge.
- All mutating capabilities (`can_manage_work_orders`, `can_mutate_financials`, `can_approve_requests`, `can_register_items`) are rejected.
- All CTAs are purely inspect/review links (`inspectLedger` linking to `/app/accounting`, `viewAudit` linking to `/app/audit`).

### B. Owner & Tenant Data Privacy Guarantees
- **Owner**: Receives `my_units_count`, `outstanding_amount` strictly for own unit, `my_open_requests` for own unit. Never receives other units' resident info, building-wide owner rosters, credentials, or audit logs.
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
