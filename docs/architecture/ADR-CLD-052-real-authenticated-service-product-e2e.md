# ADR-CLD-052: Real Authenticated Service Product E2E Interface Specification

- **Status:** Accepted / Verified
- **Task ID:** `ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08`
- **Package:** `CLADORA-FIRST-SERVICE-PRODUCT-E2E-01`
- **Owner:** Antigravity
- **Domain Boundaries:**
  - **Service Domain Owner:** Service catalog schema, offerings, service request forms, quotes, publications, and `/api/customer/v1/services/*` API endpoints.
  - **Core Domain Owner:** Shared producer, PostgreSQL transaction host, authenticated session runtime, and private development bindings (`src/lib/core/*`).
  - **Antigravity Owner:** Customer application shell (`CustomerAppShell`), Login/MFA routing, session refresh, logout, context switching, route guarding, active navigation highlighting, and responsive multilingual presentation.

---

## 1. Context & Objective

In package `CLADORA-FIRST-SERVICE-PRODUCT-E2E-01`, a test user authenticates with real Auth (not mock, not browser authority injection, not fake responses), selects an authorized Context/Workspace, and navigates via the existing application navigation (`CustomerAppShell`) to the SERVICE catalog and request form (`/app/services`).

This ADR defines and enforces the strict ownership boundaries, interface contracts, lifecycle guarantees, and data isolation requirements across the end-to-end journey.

---

## 2. Domain Ownership & Boundaries

| Domain | Responsible Team | Artifacts Owned | Boundary Rules |
|---|---|---|---|
| **Service Domain** | Service Team | `src/lib/customer/service-catalog-schema.ts`<br>`src/components/customer/CustomerServiceCatalog.tsx`<br>`src/components/customer/CustomerServiceRequests.tsx`<br>`src/components/customer/CustomerServiceQuotes.tsx`<br>`src/components/customer/CustomerServiceQuotePublications.tsx`<br>`src/components/customer/CustomerServiceManagement.tsx`<br>`src/app/api/customer/v1/services/*` | Form fields, catalog items, quote publications, and service domain routes. Code of other owners is not modified independently. |
| **Core Domain** | Core Team | `src/lib/core/service-functional-binding-v1.ts`<br>`src/lib/core/private-service-development-binding-v1.ts`<br>`src/lib/core/authenticated-session-runtime-v1.ts`<br>`src/lib/customer/service-v14-execution/runtime-binding.ts` | Shared producer, session locking (`core_runtime.lock_request_session_v1()`), and transactional C03 host execution. |
| **AppShell & Access** | Antigravity | `src/app/[lang]/app/layout.tsx`<br>`src/app/[lang]/app/services/page.tsx`<br>`src/components/customer/CustomerAppShell.tsx`<br>`src/components/customer/CustomerContextProvider.tsx`<br>`src/components/customer/CustomerRouteGuard.tsx`<br>`src/components/auth/LoginForm.tsx`<br>`src/components/auth/SignOutButton.tsx`<br>`src/lib/customer/route-classifier.ts`<br>`src/lib/customer/access-matrix.ts` | Login and MFA requirement gating, session refresh, logout, context switching, route guarding, active nav highlighting, safe context labels, and RTL/mobile responsiveness. |

---

## 3. Interface Contracts & Navigation Flow

### 3.1 Real Auth & Layout Gate
1. **Login (`LoginForm`):**
   - Submits credentials via `supabase.auth.signInWithPassword({ email, password })`.
   - Calls `resolvePostAuthRoute(supabase, lang)`.
   - Inspects `supabase.auth.mfa.listFactors()` and `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
   - If MFA factor enrolled or required, routes to `/${lang}/mfa` (or `/mfa/setup`).
   - If authenticated at required assurance, replaces location to `/${lang}/app/dashboard`.
2. **App Layout Gate (`src/app/[lang]/app/layout.tsx`):**
   - Server Component verifies `supabase.auth.getClaims()`. Redirects unauthenticated to `/${lang}/login`.
   - Inspects `supabase.auth.mfa.listFactors()`.
   - Inspects `customer_api.my_mfa_requirement_v1()`.
   - Inspects `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. If MFA required and `currentLevel !== 'aal2'`, redirects to `/${lang}/mfa`.
   - Once verified, renders `<CustomerAppShell lang={lang}>{children}</CustomerAppShell>`.

### 3.2 CustomerAppShell Navigation to SERVICE
1. **Navigation Entry:**
   - Route path: `/${lang}/app/services`
   - Label: `t.services` ("خدمات فضای کاری" / "Workspace services" / "Servicii în spațiul de lucru")
   - Icon: `BriefcaseBusiness`
   - Visibility: `state.active?.scope_type === 'tenant'`
   - Evaluated by `isAllowedForRole('/app/services')`:
     `(state.active?.scope_type === "tenant" && ["/app/airprop", "/app/services", "/app/ownership/relationships"].includes(path))`
2. **Active Highlighting:**
   - `aria-current={isActive ? 'page' : undefined}`
   - Desktop sidebar styling: `bg-[#EAF8F5] text-[#0A6E62] border border-[#B2E5DF]`
   - Mobile navigation styling: `bg-[#EAF8F5] text-[#0A6E62] border-[#0E9F8E]`

### 3.3 Route Guard (`CustomerRouteGuard`)
- Classified under `ROUTE_REQUIREMENTS`:
  `{ pathPrefix: "/app/services", exactOnly: true, nativeWorkspaceDiscovery: true }`
- Evaluated under native workspace discovery:
  `state.active?.scope_type === 'tenant' ? <>{children}</> : <AccessRestrictedCard lang={lang} reason="context" />`

### 3.4 Service Catalog & Request Form Mounting
1. **Context Consumption:**
   - `<CustomerServiceCatalog lang={lang} />` consumes `const { active } = useCustomerContext()`.
   - If `!active`: renders `<Notice text={copy[lang].noContext} />`.
   - If `active`: renders `<WorkspaceChoice key={active.context_id} contextId={active.context_id} lang={lang} />`.
2. **Workspace Target Discovery:**
   - Calls `GET /api/customer/v1/workspace/targets?context_id={context_id}`.
   - Populates workspace selector `<select aria-label={t.choose}>`.
3. **Offerings & Requests Mount:**
   - On workspace selection: renders `<Offerings key={`${contextId}:${selected}`} contextId={contextId} workspaceId={selected} lang={lang} />`.
   - Calls `GET /api/customer/v1/services/catalog?context_id={context_id}&workspace_id={workspace_id}`.
   - Renders offering cards with price, acquisition mode, cancellation and acceptance criteria details.
   - Renders `<CustomerServiceRequests contextId={contextId} workspaceId={selected} lang={lang} offerings={items} />`.

---

## 4. Data Isolation & Stale Data Eviction Guarantees

The following strict guarantees are enforced on all account, context, and session transitions:

1. **Context Switch:**
   - In `CustomerContextProvider`: `state.select(nextId)` immediately sets `dashboard: null`, increments sequence counters, and updates `activeIdRef.current = nextId`.
   - In `CustomerServiceCatalog`: `<WorkspaceChoice key={active.context_id}>` remounts via its React `key`, resetting `targets` to `null` and `selected` to `''`. All previous offerings and request form inputs are unmounted.
2. **Workspace Switch:**
   - In `<WorkspaceChoice>`: changing the select dropdown sets `selected = event.target.value`.
   - `<Offerings key={`${contextId}:${selected}`}>` remounts with a fresh key, resetting `items` to `null`.
3. **Session Logout:**
   - `<SignOutButton>` calls `sessionStorage.removeItem('cladora.customer-context.v1')`.
   - Calls `supabase.auth.signOut({ scope: 'local' })`.
   - Redirects to `/${lang}/login`.
4. **Access Denial (401 / 403):**
   - In `CustomerContextProvider`: on 401 (`session_expired`) or 403 (`forbidden`), immediately clears `contexts: []`, `activeId: ''`, `dashboard: null`, `unsavedGuards.clear()`, and removes storage key.
   - In `CustomerRouteGuard`: renders `AccessRestrictedCard` (Lock icon for session expiration, ShieldAlert for permission denied). Previous dashboard/service content is completely evicted.
   - In `CustomerServiceCatalog`: on 401/403, immediately renders `<Notice>` with access denial message; no catalog items or form inputs are rendered.
5. **Late-Arriving Response Protection:**
   - In `CustomerContextProvider`: sequence check `if (seq !== dashboardSeq.current || cancelled || activeIdRef.current !== targetContextId) return;` discards any delayed response from previous contexts.
   - In `CustomerServiceCatalog`: `AbortController.abort()` cancels in-flight fetches, and `if (!controller.signal.aborted)` guards state setters. Remounting via React `key` guarantees unmounted components do not retain or render late responses.

---

## 5. Multilingual, Accessibility & Responsive Layout

- **Multilingual Support:** Supported across `fa`, `en`, and `ro`. All labels, notices, and error messages are localized.
- **RTL Direction:** `dir="rtl"` applied for `fa` in `CustomerAppShell`, `CustomerRouteGuard`, `CustomerServiceCatalog`, and `CustomerServiceRequests`.
- **Keyboard Navigation:** Native interactive elements (`<select>`, `<button>`, `<textarea>`, `<Link>`) with standard tab navigation and visible focus outlines.
- **Mobile Display:** Dedicated horizontal scrollable navigation bar (`aria-label="Mobile Navigation"`, `className="flex md:hidden items-center gap-2 overflow-x-auto whitespace-nowrap"`) across viewports (375px, 390px, 768px, 1365px). Zero horizontal document overflow (`scrollWidth <= width + 1`).
