# CLADORA Core OPS-01 execution request/receipt v1.0

**Baseline:** `feat/core-fin-01-financial-receipt@aa959e43b5835a56110231ca509aa98ee63edaac`

**Owner:** Core Operations owns technical execution, canonical Work Orders and their lifecycle. Domain owners may request work and observe bounded receipts but do not advance Work Order state directly.

**Delivery boundary:** additive TypeScript contracts and static mapping only. No migration, endpoint, Work Order, financial posting, central manifest rewrite or Production effect.

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

## Existing evidence and future runtime gate

Repository evidence already covers Work Order integrity, transition legality, checklist completion, independent verification, context/tenant scope, dashboard reads, procurement/payable linkage, idempotent payable creation and concurrent behavior through:

- `supabase/tests/037_customer_assets_maintenance_dashboard.test.sql`;
- `supabase/tests/057_maintenance_work_orders_execution.test.sql`;
- `supabase/tests/058_maintenance_procurement_integration.test.sql`;
- `supabase/tests/117_work_order_checklist_command.test.sql`;
- `supabase/tests/150_maintenance_payable_context_authority.test.sql`;
- `supabase/tests/152_work_order_context_authority.test.sql`;
- `supabase/tests/153_maintenance_dashboard_context_authority.test.sql`;
- `scripts/test-work-order-checklist.mjs` and `scripts/test-work-order-lifecycle-ui.mjs`.

This slice does not claim a new database run. A future adapter requires a selected first consumer and disposable tests for accepted/rejected replay, source-version conflict, cross-tenant/resource denial, cancelled source behavior, independent completion/verification, Finance reference parity and proof of zero direct Work Order mutation by the consumer.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
