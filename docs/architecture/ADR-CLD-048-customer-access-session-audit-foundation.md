# ADR-CLD-048 — Customer Access, Session & Audit Foundation

Status: Implemented
Date: 2026-09-06
Task: Package P1 (`Access, Session & Audit Foundation`)

## Context

Prior to this architectural change:
1. Session signout in both Customer App and Platform Control Plane shells used static navigation links that navigated to the login screen without terminating the active Supabase authentication session or purging cached tenant context from client storage (`sessionStorage`).
2. Customer app routes lacked an authoritative presentation guard, permitting navigation to demo or mock routes (`/app/portfolio`, `/app/settings`, `/app/accounting/month-close`, `/app/migration/shadow-ledger`) in production that exposed hardcoded mock data.
3. Mobile layout in `CustomerAppShell` completely hid the sidebar navigation with no alternative navigation affordance.
4. The customer audit trail view displayed hardcoded mock log records (`LOG-88219`, etc.) rather than live, tenant-isolated, scoped database audit records.

## Decisions

### 1. Unified Real Logout (`SignOutButton`)
- Created a shared `SignOutButton` component (`src/components/auth/SignOutButton.tsx`) for Customer App and Platform Control Plane.
- Calls `supabase.auth.signOut({ scope: 'local' })` to terminate the active session locally without interrupting concurrent sessions on other devices.
- Explicitly deletes `cladora.customer-context.v1` from `sessionStorage` on signout.
- Redirects to the localized login route `/${lang}/login`.
- Implements visual loading states and accessible trilingual ARIA live region error alerts (`ro`, `en`, `fa`).
- Removed all legacy mock Exit links in `PlatformShell.tsx` and `CustomerAppShell.tsx`.

### 2. Presentation Route Guard & Mock Isolation (`CustomerRouteGuard`)
- Implemented `CustomerRouteGuard` (`src/components/customer/CustomerRouteGuard.tsx`) wrapping customer app content.
- Enforces route permissions, module entitlements, and active customer context:
  - `accounting` -> `finance.ledger.read`
  - `accounting/allocations` -> `finance.allocations.read`
  - `billing` / `billing/receivables` -> `billing.receivables.read`
  - `payments` / `reconciliation` -> `payments.reconciliation.read`
  - `meters` -> `utilities.metering.read` + `module.utilities`
  - `assets` / `maintenance` -> `maintenance.assets.read` + `module.maintenance`
  - `procurement` / `vendors` -> `maintenance.procurement.read` + `module.maintenance`
  - `governance` / `meetings` -> `governance.meetings.read` + `module.governance`
  - `communications` / `notifications` -> `communications.feed.read` + `module.communications`
  - `documents` -> `documents.vault.read` + `module.documents`
  - `occupancy` / `ownership` -> `occupancy.registry.read` + `module.occupancy`
  - `security-access` -> `security.access.read` + `module.security`
  - `audit` -> `audit.events.read`
- Fail-closed isolation: Unimplemented preview pages (`/app/portfolio`, `/app/settings`, `/app/accounting/month-close`, `/app/migration/shadow-ledger`) are blocked fail-closed, rendering a trilingual `AccessRestrictedCard` with a return link to `/${lang}/app/dashboard`.
- Public demo pages under `/demo` remain untouched.

### 3. Mobile Navigation Architecture
- Updated `CustomerAppShell` to introduce a horizontal scrollable navigation bar (`overflow-x-auto`, `whitespace-nowrap`) visible exclusively on mobile breakpoints (`md:hidden`).
- Preserved desktop sidebar (`hidden md:block`) while sharing the unified, permission-gated navigation item list.
- Added `/app/audit` link dynamically revealed when `audit.events.read` is present.

### 4. Real Customer Audit Access & Scoped RPC
- Database Migration: `20260906090000_customer_audit_access.sql`:
  - Created permission `audit.events.read` in `identity.permissions`.
  - Granted `audit.events.read` strictly to management roles: `association_admin`, `property_manager`, `president`, `censor`.
  - Strictly withheld from `owner` and `tenant_resident`.
  - Implemented `audit.get_customer_events` RPC:
    - Requires authentication (`auth.uid() is not null`).
    - Enforces customer MFA policy (`app_private.customer_mfa_required()` + AAL2 check).
    - Requires active, time-bounded context grant and membership (`statement_timestamp()`).
    - Requires `ACTIVE` customer workspace lifecycle status.
    - Enforces tenant isolation (`e.tenant_id = v.tenant_id`).
    - Enforces property, building, and unit scoping matching the active context.
    - Caps pagination at 100 entries (`p_limit > 100` rejected).
    - Enforces date range validation (`p_from > p_until` rejected).
    - Redacts sensitive text in reasons via `app_private.redact_audit_text`.
    - Omits raw actor UUIDs and snapshot payloads (`before_snapshot`, `after_snapshot`) from output.
    - Revokes execute from `public` and `anon`; grants execute strictly to `authenticated`.
- API Route: `src/app/api/customer/v1/audit/route.ts`:
  - Validates `getClaims()` and parameters via Zod.
  - Sets `Cache-Control: no-store, private`, `Pragma: no-cache`, `Vary: Cookie`.
  - Uses Supabase User Client (no service role).
  - Translates PostgreSQL error `42501` to HTTP 403 `AUDIT_ACCESS_DENIED`.
- UI: `src/components/customer/CustomerAuditDashboard.tsx`:
  - Real-time search, pagination, refresh, and multilingual support (`ro`, `en`, `fa`).
  - Displays Timestamp, Actor Role, Action, Entity, and Redacted Reason.
  - Replaced hardcoded logs in `src/app/[lang]/app/audit/page.tsx`.

## Verification & Compatibility

- Automated test suites in `scripts/test-p1-access-foundation.mjs` verify logout semantics, context deletion, mobile navigation, route guard rules, fail-closed mock isolation, audit API contracts, and non-disclosure guarantees.
- pgTAP test `supabase/tests/047_customer_audit_access.test.sql` verifies database permissions, RLS, and RPC security constraints.
- Static package contract `scripts/check-database-package.mjs` verifies migration ordering, transaction boundaries, and assertion counts.
