# CLADORA UX UI and CSS registry

Baseline observed: main commit 436e7a634020a846da212aa60501f25455d39850 on 2026-10-08. This registry points at existing assets; it does not assert that every interface conforms or silently revise them.

| Scope | Existing source | Responsibility |
| --- | --- | --- |
| Brand tokens | [design-tokens.json](../../public/brand/design-tokens.json) | Core shared design |
| Global CSS and RTL | [globals.css](../../src/styles/globals.css) | Core shared styles |
| Background controls directive | [UX directive](../architecture/references/CLADORA-UX-Background-Controls-Directive-v1.0.docx) | All four works |
| Context recovery | [UX018](../architecture/CLADORA-UX-018-unsaved-context-guard.md) | Core and consuming UI |
| Service request UX | [SERVICE UX017](../architecture/CLADORA-SERVICE-REQUEST-UX-017.md) | SERVICE |
| Existing underwriting UI | [AIRPROP UI008](../architecture/CLADORA-AIRPROP-UNDERWRITING-UI-008-v1.0.md) | AIRPROP |
| New unified requirements | [v1.4 plan](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md) sections 12 and 30 | Core shared, each domain UI |

A component inventory must map actual component paths, token usage, states and owner before declaring a universal component kit. No new CSS framework is mandated.

Required acceptance: RO/EN/FA and RTL, mobile/desktop, keyboard and focus, named resource/person selectors, meaningful empty/loading/error/disabled states, preserved form input on error, no cross-context leakage, explicit costs/consent where consequential, no exposed permission codes or UUID entry in public flows, direct API authorization independent of menu visibility.

Shared token/component changes require impact review across four works, visual evidence and versioned migration guidance. Domain-only styles must not overwrite global behavior. A passing build or horizontal overflow clipping alone does not prove UX acceptance.

## Pilot Presentation Evaluation Registry: ANTIGRAVITY-BUILDING-SETUP-UI-PILOT-01

- **Pilot Scope**: Presentation-only enhancements for Building Setup components (`CustomerBuildingSetupWizard.tsx`, `CustomerBuildingSetupProgress.tsx`). No operational workflow, schema, SQL, token, or permission changes.

### Evaluated External Resources

| Resource | Version / Commit | License | Evaluation Status & Scope of Use |
| :--- | :--- | :--- | :--- |
| **UI UX Pro Max** | `v2.15.0` (`9a3f14f7423037ccb8feeb4fee7482291b9c820e`) | MIT | **Consulted as design & accessibility guidance only**: Form grouping, 44px touch targets, focus rings, mobile single-column stacking, and semantic status messaging. No CLI installation, no new skill, no new master font/palette generated. Authoritative brand, color tokens, and components remain strictly CLADORA's existing design system. |
| **21st-dev/1code** | `v0.0.72` (`9f1bc76fa4372c18c565b5a4f8daf38ae3595f0e`) | Apache-2.0 | **Evaluated, Not Imported**: Direct component copying rejected due to package overlap, external dependency requirements, and conflicting design tokens. Zero code or color system imported into this pilot. Notice and provenance maintained for audit compliance. |
