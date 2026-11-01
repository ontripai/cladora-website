# Building Setup UI Presentation Pilot (ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01)

- **Task ID:** `ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01`
- **Executor:** Antigravity
- **Reviewer / Coordinator:** CLADORA coordinator
- **Independent Workflow Reviewer:** PROCEDURE
- **Repository:** `ontripai/cladora-website`
- **Reference:** [Issue #463](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6534195967) / [Parent #476](https://github.com/ontripai/cladora-website/issues/476)
- **Base Commit:** `0ed7f4c9e52ae68a05f73bd3c71f8bbcc2a94e24`
- **Branch:** `feat/cladora-building-setup-ui-pilot-01`
- **Delivery Protection:** `delivery/cladora-demo-95f31251` remains fixed on Base `0ed7f4c9` for PROCEDURE09 review; pilot isolated on dedicated feature branch.

---

## 1. Executive Summary & Presentation Scope

This pilot executes a targeted presentation refinement of the Building Setup interface to enhance visual hierarchy, readability, mobile responsiveness, and accessibility without altering operational logic, state machines, wire contracts, schemas, permissions, or API handlers.

### Ownership Boundary
- **Presentation Ownership (Antigravity):**
  - `src/components/customer/CustomerBuildingSetupWizard.tsx`
  - `src/components/customer/CustomerBuildingSetupProgress.tsx`
- **Workflow & Contract Ownership (PROCEDURE):**
  - Workflow helpers (`building-workspace-onboarding.ts`)
  - Schemas (`building-setup-schema.ts`)
  - Storage keys, idempotency keys, command receipts, AAL2 gating, and review routes remain unmodified and governed by PROCEDURE.

---

## 2. Resource Evaluation & Registry Record

Per directives, evaluated external resources were recorded in `docs/control/UX-UI-CSS-REGISTRY-v1.0.md` without modifying predecessor text:

| Resource | Version / Commit | License | Evaluation & Scope |
| :--- | :--- | :--- | :--- |
| **UI UX Pro Max** | `v2.15.0` (`9a3f14f7423037ccb8feeb4fee7482291b9c820e`) | MIT | **Consulted for guidance only**: Form grouping, 44px mobile touch targets, focus rings, mobile single-column stacking, and status messaging. Authoritative brand tokens, color palettes (`#102A43` navy, `#0E9F8E` teal), and typography remain strictly CLADORA's existing design system. No CLI, skill, or new font palette installed. |
| **21st-dev/1code** | `v0.0.72` (`9f1bc76fa4372c18c565b5a4f8daf38ae3595f0e`) | Apache-2.0 | **Evaluated, Not Imported**: Direct component copy rejected due to component overlap, conflicting dependencies, and foreign design tokens. Status: *Evaluated, Not Imported*. Zero code or color system imported into this pilot. |

---

## 3. Before vs. After Presentation Analysis

### 3.1 Card Architecture & Visual Segmentation
- **Before:**
  - Highly compressed, dense, border-heavy layout (`rounded-xl border p-4`).
  - No visual distinction between building details, accounting period, unit breakdown, and preview calculations.
  - Progress card was an unstyled gray box (`bg-slate-50 border-slate-200 p-3 sm:p-4`) with unstyled `<dt>`/`<dd>` elements.
- **After:**
  - Modern card architecture with distinct sections:
    1. **Header & Context Notice**: Enhanced advisory card with icon indicator and high-contrast typography (`text-[#102A43]`).
    2. **Progress Section**: Card featuring a status badge pill with animated pulse, and a responsive 4-column stat grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) where each saved field is rendered in a dedicated stat tile (`p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs`).
    3. **Building Details Card**: Clean `rounded-2xl border border-slate-200 bg-white p-5 shadow-xs` with structured labels and inputs.
    4. **Accounting Period Card**: Dedicated card with visible, localized labels for start and end dates.
    5. **Unit Breakdown Card**: Dedicated card with descriptive subtitle, clear Add unit CTA, and cleanly spaced unit rows.
    6. **Opening Balances Card**: Dedicated card displaying Debits, Credits, and a prominent reconciliation status badge (Balanced vs. Unbalanced).

### 3.2 Visual & Accessible Labels (FA, EN, RO)
- **Period Start & End Dates:**
  - **Before:** Raw `<input type="date">` elements with only English `aria-label="period start"` and `aria-label="period end"`. Sighted users saw no visual labels distinguishing the two date pickers.
  - **After:** Sighted and screen-reader users receive explicit, localized visual labels wrapping each date picker:
    - **EN:** "Accounting period start" / "Accounting period end"
    - **RO:** "Data de început a perioadei contabile" / "Data de sfârșit a perioadei contabile"
    - **FA:** "تاریخ شروع دورهٔ حسابداری" / "تاریخ پایان دورهٔ حسابداری"
    - Programmatic accessibility preserved: `aria-label="period start"` and `aria-label="period end"` maintained for full compatibility with existing automation.
- **Localized State Text (Converting internal wire `EDIT`):**
  - **Before:** Live status region displayed raw internal string `'EDIT'` (`stage==='edit'&&!runId?'EDIT':''`).
  - **After:** Internal state converted into user-friendly localized text:
    - **EN:** "Drafting building details"
    - **RO:** "Editare detalii clădire"
    - **FA:** "در حال تنظیم اطلاعات ساختمان"
    - Underlying wire values, state transitions, and revision tracking remain 100% unchanged.

### 3.3 Mobile Readability & Touch Targets (375px / 390px)
- **Before:**
  - Inputs had default height (`py-2`, ~36px), below mobile accessibility recommendations.
  - Buttons had height ~34px.
  - Unit rows squeezed code, floor, area, and remove button into 4 cramped columns on narrow screens.
- **After:**
  - All interactive elements enforce `min-h-[44px]` touch targets via Tailwind (`min-h-[44px]`).
  - Responsive single-column stacking on mobile: unit rows gracefully stack into single-column cards on viewports under 640px, with mobile-only micro-labels (`sm:hidden text-[11px]`) so users on 375px/390px screens immediately identify Code, Floor, and Area fields.
  - Remove button stretches full-width on mobile for easy thumb reach (`w-full sm:w-auto min-h-[44px]`).
  - Zero overflow clipping: inputs utilize `w-full min-w-0` to eliminate horizontal scrollbars.

### 3.4 Distinct State Feedback & Inline Explanation
- **Before:**
  - Disabled buttons had only `disabled:opacity-40` with no inline explanation of why an action was disabled.
  - Errors and notices were displayed as unstyled text strings.
- **After:**
  - **Balanced / Unbalanced Indicator:**
    - Balanced: Emerald/teal card (`bg-teal-50/80 border-teal-200 text-teal-900`) with a "Balanced" ("Echilibrat" / "تراز") badge.
    - Unbalanced: Red/rose card (`bg-red-50/80 border-red-200 text-red-800`) with an "Unbalanced" ("Neechilibrat" / "ناتراز") badge and inline explanation.
  - **Inline Disabled Feedback:**
    - When "Create draft" is disabled due to non-zero difference, a clear helper message explains: "Opening debits and credits must balance (difference: 0.00 RON) before creating a draft."
    - When "Run rehearsal" is disabled due to dirty units, an inline warning card highlights: "Save units" (`t.save`).
    - When in Submitted stage, an indigo reviewer card explains that review requires an independent operator with AAL2 verification, featuring a direct link to `/${lang}/pilot-reviewer`.
  - **Clear Status Badges:**
    - Loading / Checking: Subtle card with spinner and `{r.loading}`.
    - Access Denied: Red alert card with `{r.denied}` and `{r.check}` action.
    - Unknown: Amber warning card with `{r.unknown}` and `{r.retry}` action.
    - Conflict: Red/amber alert indicating data divergence.

### 3.5 Focus Management & Keyboard Navigation
- **Unit Deletion Focus Handling:**
  - Implemented `pendingUnitFocusRef` and `unitsSectionRef`. When a unit row is deleted, programmatic focus moves to the adjacent unit's code input or the "Add unit" button rather than resetting to `<body>`.
  - Full keyboard traversal (Tab, Shift+Tab, Enter, Space) operates seamlessly across all form fields and action triggers.

---

## 4. Invariant Preservation & Guardrails

The following architectural invariants were verified untouched:
1. **Payload & Wire Schemas:** `createBuildingSetupSchema`, `buildingSetupPayloadSchema`, and `buildingSetupReceiptSchema` remain untouched.
2. **Request Counts & Idempotency:** Exactly 1 POST on creation with client-generated idempotency key; zero duplicate dispatches; synchronous double-click protection via ref locks preserved.
3. **Receipt Validation & Confirmation:** `hasSetupConfirmation()`, `creation_request_hash`, `payload_hash`, and expected revision validation preserved.
4. **Session Storage & Context Isolation:** `setupStorageKey(contextId, membershipId, workspaceId)` and `SetupSession` schema serialization preserved.
5. **No Demo Permissions:** Public demo remains strictly read-only; no operational setup permissions created.
6. **No New Dependencies:** Zero animation libraries, component kits, or packages added to `package.json`.

---

## 5. Verification & Test Evidence

### 5.1 Test Execution Results

| Test Suite | Command | Result | Assertions | Details |
| :--- | :--- | :---: | :---: | :--- |
| **Presentation Pilot Suite** | `node scripts/test-building-setup-ui-pilot-01.mjs` | **PASS** | 82 checks | Verified cards, 44px targets, labels, states, and focus |
| **Onboarding UI Regression** | `node scripts/test-building-workspace-onboarding-ui.mjs` | **PASS** | 882 checks | Full lifecycle, persistence, double-click, denial, recovery |
| **Setup Contract 001** | `node scripts/test-building-setup-001.mjs` | **PASS** | Static | Contract & migration parity |
| **Setup Hardening 001** | `node scripts/test-building-setup-hardening-001.mjs` | **PASS** | Static | Closure report & hardening |
| **Workspace Onboarding 001** | `node scripts/test-workspace-onboarding-001.mjs` | **PASS** | Static | RO/EN/FA + RTL + rollback |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 errors | Full workspace typecheck |
| **ESLint Scoped Audit** | `npx eslint <affected_files>` | **PASS** | 0 warnings | Clean code quality |
| **Git Diff Whitespace Check** | `git diff --check` | **PASS** | 0 warnings | Clean whitespace, no EOF trailing lines |

---

## 6. Explicit NOT_RUN Tests

Per test governance directives ("تست‌های موفق نامرتبط و ۵۵ آزمون تاریخی از ابتدا تکرار نشوند"):
- Unrelated 55 unit test suites (`test:unit` aggregate) and concurrent finance tests (`test:statutory-funds:concurrency`, `test:cash-discipline:concurrency`) were **NOT_RUN** to avoid non-deterministic concurrency interference.
- Zero live Auth/DB network requests were made; all verification executed against controlled mock transport.
- Zero manual deployments, hosted installations, or config changes.
