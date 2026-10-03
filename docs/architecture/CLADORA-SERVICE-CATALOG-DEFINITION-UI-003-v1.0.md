# CLADORA SERVICE definition command and catalogue UI 003 — v1.0

Decision: CLADORA-ARCH-SERVICE-CATALOG-DEFINITION-UI-20261003-01

Parent: completed persistence/API slice #222; base main `39d1696ac77d3eeec044df3223a51b26e00219eb`.

## Delivery

Adds an audited, authenticated, exact-Workspace definition creation command and scoped definition discovery under `/api/customer/v1/services/catalog/definitions`. It uses the existing `services.catalog.manage` canonical permission gate and shared idempotency, audit and outbox tables. No module activation, entitlement, taxonomy compatibility, Context or role grant is created. Definition creation itself does not publish any offering.

SQL derives tenant/actor, validates the strict localized payload, fingerprints trusted input, serializes canonical retry claims and atomically creates the definition plus audit/outbox/stored response. Same key with changed actor/content or an expired claim conflicts. Duplicate code in the exact workspace conflicts. HTTP gateways expose bounded errors and private/no-store responses.

Adds the authenticated RO/EN/FA consumer catalogue page at `/<lang>/app/services`, using the existing customer layout/context provider and preview-aware dashboard transport. The user explicitly chooses among canonical native Workspace targets before any catalogue read. No first Workspace is chosen automatically. Labels/descriptions/tax/terms are localized, Persian is RTL, and money remains an exact decimal string rather than a JavaScript number. The UI offers published-service discovery and terms, with no order/reservation action that the backend cannot yet fulfill.

Context and selected Workspace key separate component lifetimes; pending requests abort on unmount and aborted results cannot update current state. Context changes reset selection and published cards. Denied, empty, loading and failed states are distinct. No sensitive payload is stored in browser storage.

## Verification

Actual Next gateway tests now include definition read/create, malformed fields, forged authority and missing authentication. Actual PostgreSQL fixture tests include definition creation, exact retry, atomic audit/outbox evidence, content conflict and cross-Workspace rejection. Existing catalogue mutation and independent-connection race tests continue to run. Seven actual React/JSDOM scenarios exercise all three locales, exact large decimal amounts, explicit selection, context switching, obsolete responses, access denial and no-context/no-network behavior.

The page compiles and its mounted component is tested. A live signed-in production browser acceptance run has not been performed. The storage tests use a bounded authority fixture; the canonical native engine has its separate actual PostgreSQL regression suite and the full migration chain is tested by Database CI. No production migration is applied by this slice.

## Remaining integration

Native Context/role/module provisioning and dashboard/menu integration remain shared-core prerequisites. The new route is present, but this change does not insert a navigation entry whose legacy dashboard permission proof cannot yet establish native Workspace access. Workspace targets have no canonical human-readable name field in the existing contract; the UI uses ordered localized Workspace labels without inventing schema fields.

Management forms for creating/revising/submitting/publishing offerings and definition editing/deactivation are not supplied here. Authorized secure document linking is still blocked by #222. Orders, reservations, reception/custody and benefits remain later SERVICE runtime packages. These limitations are explicit; this slice is not full product completion.

## Scope

New SERVICE definition migration, gateway, consumer component/page, UI test and this versioned document; updates only the SERVICE-owned test scripts/workflow from #222. No AIRPROP or Operations source/configuration is changed. No main package or lockfile change. No production data, invitation, email or financial transaction is created.
