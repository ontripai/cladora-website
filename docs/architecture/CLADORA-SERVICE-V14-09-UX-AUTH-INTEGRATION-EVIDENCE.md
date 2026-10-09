# CLADORA SERVICE v1.4 — SV01O/P/Q evidence

Baseline: CLADORA v1.4 commit `2fb9d7d`, stacked after SERVICE experience head `4ab4a86`. This package closes the contract-level UX, authorization and integration evidence for the independent SERVICE slices. It adds no product route, persistence, authority resolver, resource registry, ledger, outbox, migration or deployment.

## Executable evidence

| Concern | Evidence | Boundary |
| --- | --- | --- |
| SV01O UX | `test-service-resource-picker-v14.mjs` exercises the existing named-resource selector in Romanian, English and Persian, including RTL, mobile width, retained selection and accessible errors. | This is component-level JSDOM evidence, not an end-to-end browser workflow. Contract-only slices expose no new runtime UI. |
| SV01P authorization | Each slice test denies spoofed actor/tenant/server-owned state and exercises current authority, exact Workspace, exact version and unavailable/revoked references. | Pure evaluators are pre-write guards; they are not an authorization service. Runtime writes must re-read authority in the owning transaction. |
| SV01Q integration | `test-service-v14-integration.mjs` runs one common fail-closed matrix across Order acceptance, collaboration, delivery, booking, portfolio, Finance and Experience boundaries. | It proves strict intent composition and named-receipt failure, not database/API integration. |

The aggregate `npm run test:service-v14` includes every SERVICE v1.4 contract test, the resource-picker regression and the cross-slice integration matrix. The SERVICE CI workflow runs that aggregate, targeted lint, typecheck and existing unit regressions.

## Named runtime dependencies

| Slice | Contract | Owner | Required runtime output |
| --- | --- | --- | --- |
| SV01A/B/C/D | `provider-agreement-verification.v1` and canonical DW-02 resource/geographic resolution | Core authority/resource owners with SERVICE as consumer | Versioned provider agreement, resource type and coverage resolution; current authority; bounded denial; atomic SERVICE link/audit/outbox/idempotency; zero-write denial. |
| SV01E/F | `financial-proposal-posting-receipt.v1` | Core Finance / FIN01; SERVICE owns the commercial Order | Versioned price/tax/receipt decision, exact Quote binding, bounded denial/conflict, replay checks and atomic Order persistence. |
| SV01K/L | `service-subject-link-adapter.v1` | Core Communications and Core Vault/Documents | Canonical reference resolution without payload/path exposure, current audience/read authority and atomic subject-link receipt. |
| SV01G/J | `service-delivery-evidence-receipt.v1`; optional `service-order-stage-work-order-adapter.v1` | Core Vault/Documents; Core Operations / OPS01 when technical execution is required | Versioned evidence resolution and, only where needed, one canonical Work Order binding without conflating execution, acceptance or settlement. |
| SV01H | `shared-capacity-allocation-receipt.v1` | Core Booking/Capacity / BK01 | Atomic hold/confirm/reschedule/release receipt with deterministic locking, expiry, exact replay and zero-write denial. |
| SV01I | `portfolio-service-action-projection.v1` | Core Portfolio / PF01 | Current-authority projection receipt for canonical portfolio/resource/Order references without copying identity or ownership. |
| SV01M | `service-financial-operation-receipt.v1` | Core Finance / FIN01 | Canonical invoice/payment/refund/settlement decision and posting receipt without a SERVICE ledger or money engine. |
| SV01N | `service-experience-coordination-receipt.v1` | Community & Experience / CE01 with SERVICE as Order owner | Versioned component/cancellation/compensation coordination receipt, exact Order/subject binding and separation of compensation from financial effect. |

## Evidence limits and continuation

No database, API, browser workflow, concurrency, migration or Production test is represented by this package. Those tests remain blocked per slice until the named owner supplies the exact runtime contract above. A missing dependency blocks only its operational slice; it does not justify a mock authority, resolver, financial engine, resource registry or parallel runtime.

All SERVICE PRs remain Draft/in review. Merge, Supabase remote migration, Production deployment and Production settings require separate authorization.
