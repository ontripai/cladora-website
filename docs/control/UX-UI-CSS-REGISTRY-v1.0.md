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
