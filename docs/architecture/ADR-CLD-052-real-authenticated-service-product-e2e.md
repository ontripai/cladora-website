# ADR-CLD-052: Real Authenticated Service Product E2E Interface Specification

- **Status:** PROPOSED_INTERFACE_SPECIFICATION / CONTROLLED_SIMULATION_PASS / HOLD_CONNECTED_BROWSER_E2E
- **Task ID:** `ANTIGRAVITY-REAL-AUTHENTICATED-SERVICE-08`
- **Task Verdict:** `CHANGES_REQUESTED_SCOPED_EVIDENCE` (Task remains OPEN until connected browser acceptance)
- **Package:** `CLADORA-FIRST-SERVICE-PRODUCT-E2E-01`
- **Owner:** Antigravity (AppShell, Context/Workspace discovery, and interface guards)
- **Consumed Core Revision:** `ee883b62cf4a318af3450c506931a969623b8987`
- **Consumed Contract:** `docs/contracts/CORE-SERVICE-REAL-APP-ASSEMBLY-17.md`
- **Evidence Qualification:**
  - **Source Contracts & Static Verification:** PASS
  - **Controlled JSDOM AppShell/Service Lifecycle Simulation:** PASS
  - **Connected Browser Playwright E2E against live Core/Platform:** NOT_RUN (Pending consumable delivery of Core15/Platform12)
  - **Physical Device & Viewport Geometry Measurement:** NOT_RUN
  - **Automated WCAG Complete Scan:** NOT_RUN
- **Domain Boundaries & Ownership:**
  - **Service Domain Owner:** Service catalog schema, offerings, service request forms, quotes, publications, and `/api/customer/v1/services/*` API endpoints. Antigravity does NOT modify Service domain files.
  - **Core Domain Owner:** Shared producer, PostgreSQL transaction host, authenticated session runtime, Core17 assembly bootstrap and read ports (`src/lib/core/*`). Antigravity consumes Core via standard merge.
  - **Antigravity Owner:** Customer application shell (`CustomerAppShell`), Login/MFA routing, session refresh, logout, context switching, workspace discovery bridging, route guarding, active navigation highlighting, and responsive multilingual presentation.

---

## 1. Context & Objective

In package `CLADORA-FIRST-SERVICE-PRODUCT-E2E-01`, a test user authenticates with real Auth (not mock, not browser authority injection, not fake responses), selects an authorized Context/Workspace discovered from official bootstrap reads, and navigates via the existing application navigation (`CustomerAppShell`) to the SERVICE catalog and request form (`/app/services`).

This ADR defines and enforces the strict ownership boundaries, interface contracts, lifecycle guarantees, and data isolation requirements across the end-to-end journey.

> [!IMPORTANT]
> **Evidence Scope Notice:**
> Source contracts, route classifications, and controlled JSDOM component lifecycle executions (including `CustomerAppShell` dynamic mounting, context switching, account switching, 403/401 denial eviction with pre-denial presence proof, logout, and verified in-flight late response fencing) have PASSED in test suite `scripts/test-real-authenticated-service-08.mjs`.
> Live connected browser execution (Playwright against deployed Core/Platform backend) is classified as `NOT_RUN` and will proceed once the integrated Core15 + Platform12 consumable stack is delivered. Task remains OPEN until connected browser acceptance.

---

## 2. Core17 Assembly Consumption Contract & Interface Connection

In the approved development profile (`CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1'`), Antigravity binds the product entry to Core's official assembly bootstrap selections:

| Step / Endpoint | Consumer Interface | Producer / Guard | Response / Boundary Rule |
|---|---|---|---|
| `GET /api/customer/v1/services/assembly-bootstrap` | Gateway read | `coreServiceAppReadV1(request, 'selections')` | `{ contract_version: 'core-service-app-read.v1', selections: [...] }` |
| `GET /api/customer/v1/contexts` | `CustomerContextProvider` | Assembly discovery bridge | Unique tenant contexts projected from official bootstrap selections. In non-assembly profiles, standard `list_contexts_v1` RPC is preserved. |
| `GET /api/customer/v1/workspace/targets?context_id=...` | `CustomerServiceCatalog` | Assembly discovery bridge | Workspace tuples matching `context_id` from official bootstrap selections. In non-assembly profiles, standard `list_workspace_targets_v2` RPC is preserved. |
| `GET /api/customer/v1/services/catalog?context_id=...&workspace_id=...` | `CustomerServiceCatalog` | Core17 canonical catalog read | `{ offerings: [...] }` with SQL projection; no fabricated fields. |
| `GET /api/customer/v1/services/requests?context_id=...&workspace_id=...` | `CustomerServiceRequests` | Core17 request read | `serviceRequestReadSchema`: `can_request`, `beneficiaries`, `requests`. |
| `GET / POST /api/customer/v1/services/offering-request-flow` | Request Flow | Core17 C03 host | Preflight validation and transactional non-reservation request submission (`{ request_id, status: 'submitted' }`). |

**Key Assembly Rules:**
1. **Explicit Choice:** Bootstrap selections are discovery only. The user must make an explicit choice of context in `CustomerAppShell` and workspace in `CustomerServiceCatalog`. The system never guesses or auto-promotes tenant/workspace fields to request authority.
2. **Authority Preservation:** Real Supabase Auth / MFA / Session cookies are validated on each read via server `getUser`/`getClaims` and current database session. No JSON or user_metadata authority spoofing is permitted.
3. **Preservation of Other Profiles:** In default, hosted, preview, and production profiles, `contexts/route.ts` and `workspace/targets/route.ts` retain their exact standard RPC logic.
4. **Service Code Independence:** `CustomerServiceCatalog.tsx` and all Service domain files remain untouched by Antigravity.
5. **Dashboard Authority Decoupling:** In the approved Service assembly profile, the legacy dashboard (`/api/customer/v1/dashboard`) is NOT an authority reference. The development Core17 assembly profile yields bootstrap selections, catalog, and requests, but intentionally does not produce a legacy dashboard. If context is authorized in Core selections, `/api/customer/v1/dashboard` returns 404 cleanly (`DASHBOARD_NOT_IN_ASSEMBLY_PROFILE`), neither generating a fake dashboard nor falsely reporting 403. `CustomerContextProvider` does not promote legacy dashboard 403/404 into `error: 'forbidden'`, ensuring native discovery routes like `/app/services` are guarded by actual Core session authority.
6. **Workspace Targets Contract:** Discovery returning `selections: []` represents an authenticated session without authorized context selections. Querying targets returns 403 `WORKSPACE_ACCESS_DENIED`, preserving 401 `UNAUTHORIZED` strictly for missing/invalid auth cookies.

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

## 4. Data Isolation, Eviction & Fencing Guarantees

The following strict guarantees are enforced on all account, context, and session transitions:

1. **Context Switch (Same Account, Different Tenant Context):**
   - In `CustomerContextProvider`: `state.select(nextId)` immediately sets `dashboard: null`, increments sequence counters, and updates `activeIdRef.current = nextId`.
   - In `CustomerServiceCatalog`: `<WorkspaceChoice key={active.context_id}>` remounts via its React `key`, resetting `targets` to `null` and `selected` to `''`. All previous offerings and request form inputs are unmounted.
   - User identity and session cookies remain unchanged.
2. **Account Switch (Different Authenticated User Identity):**
   - User session transition (e.g. User 1 logs out, User 2 signs in with different `actor_id` / email).
   - `sessionStorage` is completely purged.
   - All previous account profile data, tenant contexts, active selection, and cache are evicted before mounting the new account's distinct contexts.
3. **Workspace Switch:**
   - In `<WorkspaceChoice>`: changing the select dropdown sets `selected = event.target.value`.
   - `<Offerings key={`${contextId}:${selected}`}>` remounts with a fresh key, resetting `items` to `null`.
4. **Session Logout:**
   - `<SignOutButton>` calls `sessionStorage.removeItem('cladora.customer-context.v1')`.
   - Calls `supabase.auth.signOut({ scope: 'local' })`.
   - Redirects router to `/${lang}/login`.
5. **Access Denial (401 / 403) with Pre-Denial Presence Proof:**
   - **Pre-Denial Proof:** Before triggering denial, data presence is proven in DOM/state.
   - **Post-Denial Eviction:**
     - On 401 (`session_expired`): `contexts: []`, `activeId: ''`, `dashboard: null`, `unsavedGuards.clear()` are set immediately; storage key is removed. `CustomerRouteGuard` renders `AccessRestrictedCard` with Lock icon and login redirect action.
     - On 403 (`forbidden`): `dashboard: null`, `contexts: []` are set immediately. `CustomerRouteGuard` renders `AccessRestrictedCard` with ShieldAlert icon.
     - In both denial scenarios, 100% of previous service catalog offerings, prices, and inputs are verified to be evicted from the DOM.
6. **Late-Arriving Response Fencing (Verified In-Flight with Readable State Probe):**
   - **In-Flight Guarantee:** Context A's fetch is proven to be actively in-flight (`pendingRequestsA === 1`) before switching to Context B.
   - **Readable State Probe:** The consumer component renders an explicit state probe in the DOM (`<div id="consumer-probe" data-active-id={active?.context_id} data-dashboard-id={dashboard?.id} data-marker={dashboard?.marker}>{dashboard?.marker}</div>`).
   - Context B resolves with marker `MARKER_CONTEXT_B`; DOM reflects Context B's active ID and marker while A remains pending.
   - Context A is released with marker `MARKER_CONTEXT_A`.
   - Sequence check `if (seq !== dashboardSeq.current || cancelled || activeIdRef.current !== targetContextId) return;` discards Context A's stale response.
   - Consumer DOM inspection asserts that Context B's marker remains rendered and Context A's marker is never injected.
   - **Negative Control:** Test 5.8 intentionally simulates an unfenced state update lacking sequence/cancellation checks, demonstrating that state is corrupted by A's stale marker when unprotected. This proves our guards are actively detecting and preventing corruption.

---

## 5. Multilingual, Accessibility & Viewport Scope Classification

- **Static Dictionary Inspection (FA / EN / RO):** Source inspection verifies all localized translation dictionaries in `CustomerAppShell`, `CustomerServiceCatalog`, and `LoginForm` are populated with exact approved copy.
- **Dynamic 3-Language DOM Rendering:**
  - `fa`: Rendered with `dir="rtl"` in DOM; verifies Persian strings (`خدمات فضای کاری`, `فضای کاری را انتخاب کنید`).
  - `en`: Rendered with `dir="ltr"` in DOM; verifies English strings (`Workspace services`, `Choose a workspace`).
  - `ro`: Rendered with `dir="ltr"` in DOM; verifies Romanian strings (`Serviciile spațiului de lucru`, `Alege un spațiu de lucru`).
- **Viewport Layout Geometry Measurement (NOT_RUN):**
  - JSDOM does not calculate physical CSS bounding boxes, layout reflow, or screen pixel geometry.
  - Responsive layout validation across viewports (375px, 390px, 768px, 1365px) is classified as `NOT_RUN` pending connected browser execution.

---

## 6. Review Addendum: Successor to Head `a6561b66`

In response to reviewer feedback on Head `a6561b66b18b0ff680ef0f2d9ff274ccf82d999a`:
1. **Connection Blocker (Dashboard as False Authority):**
   - Decoupled legacy dashboard from being an authority reference in the approved Service assembly profile (`NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY === 'v1'` / `CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1'`).
   - No fake dashboard was created; no global bypass was introduced. Genuine 401/403 Core session errors and other route guards remain strictly intact.
2. **Targets Route Contract:**
   - Corrected `/api/customer/v1/workspace/targets` handling of `selections: []` to return 403 `WORKSPACE_ACCESS_DENIED` instead of 401 `UNAUTHORIZED`.
   - Added real route handler tests verifying unauthenticated 401, empty selections 403, wrong context 403, and matching context 200.
3. **Late-Arriving Response Evidence:**
   - Added DOM-level `ConsumerStateProbe` with `data-marker` and `data-dashboard-id` to verify Context B remains intact after A resolves.
   - Added negative control Test 5.8 verifying that removing the guard corrupts state, confirming the assertions actively validate the protection.
4. **Line Endings & Whitespace:**
   - Reverted modified route files from CRLF to strict repository LF (`\n`).
   - Confirmed 0 trailing whitespace warnings via `git diff --check`.
