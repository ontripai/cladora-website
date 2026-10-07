# ADR-CLD-031 — Primary administrators for owner portfolios and hybrid workspaces

Status: **Architecture baseline v1, role activation pending**  
Version: 1.0 — 2026-09-25  
Supersedes: none. Existing association and property-manager roles remain intact.

## Decision

An email address may hold several independently granted roles. Primary customer
administration is scoped to a workspace, its tenant, its operating model, its
active commercial basis and its time-bound membership. A system role alone never
grants access to another workspace under the same tenant.

| Workspace structure | Proposed primary role | Authority | Explicitly excluded |
| --- | --- | --- | --- |
| `ASSOCIATION` | `association_admin` (existing) | Statutory association administration, subject to country pack | Other tenants and unassigned workspaces |
| `PROPERTY_MANAGER` | `property_manager` (existing) | Operations under a management mandate | Ownership rights without a mandate |
| `OWNER_PORTFOLIO` | `owner_portfolio_admin` (new) | Own-portfolio onboarding, property inventory and scoped operational configuration | Association governance, resident voting, statutory HOA accounting, financial close and payments |
| `HYBRID` | `hybrid_workspace_admin` (new) | Coordination of separately authorized residential/commercial scopes | Assuming association legal powers from a mixed-use label; cross-scope financial approval |

For a hybrid workspace, operational authority must derive from a recorded mandate
for the particular property or business scope. The primary role does not bypass
four-eyes controls, country-pack rules, signed contracts or activated modules.
No implicit mapping from `OWNER_PORTFOLIO` or `HYBRID` to `association_admin`
or `property_manager` is allowed.

## Release gates for the two new roles

1. Seed new **system role codes with no copied permissions**. Specify and review
   each permission by code, including the module entitlement and property scope.
   Start with read-only onboarding and taxonomy; add mutations by separate
   reviewed slices. Do not clone either existing administrator role.
2. Teach the commercial access-basis function, invitation-role view, tokenless
   invitation acceptance and primary-admin collision check the exact
   `workspace_type → role_code` mapping. Keep AAL2, confirmed email, seven-day
   approval validity, paid-through checks and invitation expiry.
3. Add the new persona codes to the customer access matrix, dashboard response
   validator, role-aware dashboard SQL and navigation. Every route/API with an
   existing hard-coded role allowlist needs explicit allow/deny review. Unreviewed
   endpoints must deny the new roles.
4. Resolve identity by **membership + context grant + customer workspace**, not
   merely tenant or email. Verify concurrent grants for one email on several
   workspaces and reject another tenant's context.
5. Only after the first four gates pass, remove the deny rules introduced in
   `20260925120244_restrict_undefined_primary_roles_v1.sql` for the *matching*
   new role. Preserve denial for association/property-manager credentials in
   portfolio and hybrid workspaces.

### Concrete change inventory

| Boundary | Current implementation to update |
| --- | --- |
| Commercial basis and role compatibility | `supabase/migrations/20260924161209_workspace_access_bases.sql`; replace the existing `PROPERTY_MANAGER` versus `association_admin` fallback with exact type-role mapping. |
| Invitation discovery and acceptance | `supabase/migrations/20260924104415_platform_primary_admin_invitation_roles.sql`, `supabase/migrations/20260924131045_20260924113547_tokenless_invitation_customer_api_gateway.sql`; extend the primary-admin collision rules. |
| Customer persona and route policy | `src/lib/customer/access-matrix.ts`, `src/lib/customer/dashboard-schema.ts`; define bounded menu, capabilities and validated role codes. |
| Customer dashboard | `supabase/migrations/20260906120000_customer_role_aware_dashboard.sql`, `src/app/api/customer/v1/dashboard/route.ts`; emit valid new-role responses with no association-only data. |
| Workspace-local role management and taxonomy | `supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql`, `supabase/migrations/20260918120000_workspace_local_roles_permissions.sql`; assign only reviewed permissions. |
| Existing service allowlists | Financial close, payments, statutory exports, governance, occupancy, communications, maintenance and security migrations; audit individual server checks instead of widening a shared predicate. |
| UI approval | `src/components/platform/WorkspaceAccessBasisDialog.tsx`, `src/components/platform/OperationalWorkspacesTable.tsx`, `src/components/cases/CasePortal.tsx`; offer only compatible roles and explain missing mandates. |

## Acceptance scenarios

| Scenario | Expected result |
| --- | --- |
| One email is portfolio admin in workspace A and association admin in workspace B | Both contexts appear; each exposes only its own approved permissions |
| Portfolio admin requests statutory association close, bank matching or voting | Denied by server permission and omitted from menu |
| Hybrid admin requests a residential service without mandate for that property | Denied even if commercial scope in the same workspace is active |
| Wrong primary role is selected in invitation or access basis | Rejected before sending or activation |
| Approval expired or paid period ended | No new case link or primary activation |
| Membership expires or is revoked | Context and every customer API reject access |
| Case has two workspaces under one tenant | Each workspace needs its own access basis and role assignment |
| Member has a second tenant | No automatic access across tenants |

## Current implementation and limits

PRs #131–#134 permit preparation of a workspace, maintain case history, require
separate commercial approval and prevent inappropriate primary administrator
grants. The two proposed role codes are **not active**. Production currently
has no customer case on which to perform an authenticated real-user end-to-end
test. Database transaction tests provide synthetic coverage of preparation,
approval expiry and linking, but do not prove the browser journey.

The next implementation slice must deliver the read-only customer context for
the two roles plus a complete API/menu allowlist inventory before either role
may be activated. Subsequent slices can add property operations and delegated
financial actions following the same case and mandate checks.
