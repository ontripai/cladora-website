# CLADORA Core OPS-01 execution request/receipt v1.0

**Baseline:** `feat/core-fin-01-financial-receipt@aa959e43b5835a56110231ca509aa98ee63edaac`

**Owner:** Core Operations owns technical execution, canonical Work Orders and their lifecycle. Domain owners may request work and observe bounded receipts but do not advance Work Order state directly.

**Delivery boundary:** the accepted first runtime consumer is an existing immutable SERVICE request. One additive receipt/link table and one bounded RPC map that source to the existing Work Order engine after current AUTH-01, exact source-version and DW-02 canonical Unit checks. The API exposes only the request/receipt contract. There is no financial posting, central manifest rewrite or Production effect.

## Existing sources reused

OPS-01 maps to the existing `maintenance.work_orders`, `maintenance.work_order_events`, `maintenance.work_order_checklist_items`, `maintenance.work_order_assignments`, `maintenance.work_order_costs`, `maintenance.purchase_orders`, `maintenance.vendor_payables`, `audit.events`, `platform.outbox_events` and customer Work Order gateway functions.

It creates no parallel Work Order, ticket, asset, vendor, procurement, payable, audit, outbox or idempotency engine. SERVICE delivery, AIRPROP lifecycle and Community/Event state remain owned by their domains and only retain the Operations receipt reference.

## `operations-execution-request-receipt.v1`

The request pins an idempotent ID/key, explicit context/Workspace, immutable domain source ID/version/reference, `canonical-resource-reference.v1` input, execution kind, bounded title/scope reference, priority, optional desired interval and optional FIN-01 proposal ID/version.

Desired dates are a request, not a schedule. An end requires an earlier start. A Finance proposal reference is only accepted as an ID/version pair and never authorizes a payable or journal.

An accepted receipt proves that Operations accepted or replayed the request and provides the canonical Work Order ID/version/current status reference. The allowed statuses exactly match the existing Work Order lifecycle: `draft`, `scheduled`, `assigned`, `in_progress`, `blocked`, `completed`, `verified` and `cancelled`.

An accepted request does not mean approved, issued, started, completed, verified, financially posted or paid. Every later transition remains an Operations command with current scope, permission, lifecycle, checklist, independent verification and concurrency checks. `action_authorization = not_evaluated` is invariant.

A rejected receipt exposes no Work Order, status or Finance receipt identifiers. FIN-01 receipts may be linked only after their independent financial gateway succeeds; Work Order cost snapshots and vendor payables remain Operations/Finance records and cannot be fabricated by a requesting domain.

## Atomicity and replay

A future adapter must resolve current AUTH-01 authority and resource scope, validate the exact source version, enforce the current Operations entitlement/permission, and use the existing idempotency/audit/outbox pattern. In one transaction it records or replays the source-bound request and canonical Work Order receipt. A repeated key with a different source, resource, scope or payload fingerprint fails closed.

Request cancellation does not delete a Work Order. Domain cancellation and Work Order cancellation are separate state transitions. A terminal verified Work Order remains immutable; correction uses the existing explicit lifecycle/financial correction paths rather than rewriting history.

## Existing evidence and runtime gate

Repository evidence already covers Work Order integrity, transition legality, checklist completion, independent verification, context/tenant scope, dashboard reads, procurement/payable linkage, idempotent payable creation and concurrent behavior through:

- `supabase/tests/037_customer_assets_maintenance_dashboard.test.sql`;
- `supabase/tests/057_maintenance_work_orders_execution.test.sql`;
- `supabase/tests/058_maintenance_procurement_integration.test.sql`;
- `supabase/tests/117_work_order_checklist_command.test.sql`;
- `supabase/tests/150_maintenance_payable_context_authority.test.sql`;
- `supabase/tests/152_work_order_context_authority.test.sql`;
- `supabase/tests/153_maintenance_dashboard_context_authority.test.sql`;
- `scripts/test-work-order-checklist.mjs` and `scripts/test-work-order-lifecycle-ui.mjs`.

The selected first consumer is `service_catalog.requests`. The adapter records linkage/replay evidence in `maintenance.execution_request_receipts`, but creates execution only through `maintenance.create_work_order`; SERVICE receives a receipt and never updates the Work Order. The adapter accepts only a current own SERVICE request/version and a verified DW-02 Unit in the same explicit Workspace. It rechecks AUTH-01 and source/resource currentness before replay. Until FIN-01 is connected, a supplied proposal reference returns a rejected receipt with no Work Order or Finance identifiers.

Disposable pgTAP covers accepted/rejected replay, stale source/resource versions, cross-tenant/resource denial, current-authority replay denial, immutable receipts and zero direct table access by the consumer. Existing lifecycle suites remain the evidence for completion, verification and cancellation boundaries; this adapter grants no lifecycle action.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
