# Superadministrator dashboard testing center v1

Date: 2026-09-26

## Use

Open `/fa/platform/dashboard-lab`, `/ro/platform/dashboard-lab` or `/en/platform/dashboard-lab` from **Test dashboards** in the platform navigation. Sign in with the existing superadministrator account and MFA. No additional Auth users or customer memberships are required.

Select a role and a data state: sample, empty or loading error. Switch language or use Reset test to start again. Back to super administrator returns to the production platform overview. Your actual authenticated role is never changed.

## Coverage

The catalog is the six production customer personas (`association_admin`, `property_manager`, `president`, `censor`, `owner`, `tenant_resident`), `multi_unit_owner`, and all five platform roles. It reuses CustomerDashboard, OwnerPortfolioPanel/OwnerOverviewPanel and OperationalOverviewPanel instead of the legacy public demo dashboards. Custom workspace roles inherit a base persona; this release does not load their live assignments or validate every custom permission combination.

The center covers dashboard home screens, their loading/empty/error states, and local owner forms: add unit, draft/activate/end/cancel lease, record cash/full payment, simulated link request/withdrawal, annual CSV. Official-charge examples are fictional. Customer and platform detail pages are outside this release and links show this explicitly. It is not a full end-to-end replacement for production API/database authorization tests. Fixture validation is illustrative and does not reproduce all database constraints.

## Isolation

The server page requires an authorized PLATFORM_SUPER_ADMIN at AAL2, in addition to the protected platform layout. The sandbox does not alter auth claims, RLS, support-access policy, roles, users, invitations or database records. ADR-023 and ADR-055 remain unchanged.

A scoped React transport supplies in-memory responses to the actual dashboard components. There is no network fallback for missing fixture routes, no global fetch override, no service-role credential and no write API. Fixture state is scoped to the mounted session and reset on role/state/language change, reset or exit. Customer sessionStorage selection is neither read nor written in preview. Preview links carry fragment targets, avoiding production prefetch and modifier-click navigation; CSV is downloaded from the fixture response as a local blob. Owner sign-out controls are omitted inside the preview; the surrounding real platform shell remains the actual superadministrator shell.

## Verification

Executable tests render 12 roles × 3 languages × sample/empty/error states using the actual React components. They assert zero native network calls, preserved production context storage, no production customer links, localized role titles and Persian RTL. Additional tests cover fixture reset/payment transitions, blocked unknown/external routes, and denial of unauthenticated, AAL1 and non-superadministrator identities at the page boundary. Existing application, routing and owner-unit isolation tests remain required.

These tests use jsdom, not a browser layout engine. This environment previously blocked Chromium process sockets, so mobile screenshots and authenticated human acceptance remain separate checks; no successful browser rendering is claimed.
