# FIN-MONTHLY-E2E-01 — first Core input handoff

Parent: `8d64bc5b868567edb32494d187feaf65fc03382f`. This is an independent
source slice. SERVICE/Core26 is unchanged. The Viewer Page task attachment was
read as exact UTF-8 source: 24492 bytes,
SHA256 `70033eeae132efd6dc24b8175594ee0efa1d6dc24ad18b2e01a05e7800b45bd1`.

## Executable reference adapter

`src/lib/core/monthly-source-handoff-v1.ts` exports
`planMonthlySourceCaptureV1(input: unknown)`. Strict input:

```json
{
  "contract_version": "monthly-source-reference-handoff.v1",
  "context_id": "canonical context UUID supplied for lookup",
  "cycle_id": "canonical cycle UUID supplied for lookup",
  "source_relation": "utilities.provider_invoices",
  "source_id": "persisted source UUID supplied for lookup"
}
```

The example describes fields; its placeholder strings are deliberately invalid
UUIDs and are not dispatchable fixtures. The other accepted relations are
`utilities.meter_readings`, `finance.allocation_runs` and
`maintenance.vendor_payables`. Unknown fields (including `approved`, amounts,
receipt, hash, invented version and tenant/Workspace overrides) are rejected.

For the three currently supported monthly families the result is
`request_prepared_source_unverified`, with the exact existing authenticated POST
route/body. It imports the existing monthly API schema. No automatic dispatch,
retry, SDK, SQL, money calculation or authority evaluation occurs. These are
reference requests, not canonical data, receipts, proof of approval or a new
Finance admission profile. Revalidate by the real route/DB gateway; never persist
this output as evidence that the source exists. Supplying an invoice namespace
with a payable UUID cannot turn that record into an invoice: the existing DB
query must actually resolve the invoice table and reject absence.

For maintenance payable the result is `not_ready`, `request=null`, dependency
`FINANCE_MAINTENANCE_MONTHLY_SOURCE_BRIDGE_REQUIRED`. No retagging takes place.
`action_authorization=not_evaluated` in every returned result.

## Canonical source paths and effects

All exact bytes/hashes are in `manifest.json`; these identify repository source,
not installed schema or a new replay/install recipe.

| Input | Existing caller / routine | Source acceptance and effect |
| --- | --- | --- |
| Utility invoice | `customer_api.capture_monthly_cycle_source_v1(uuid,uuid,text,uuid)` → `app_private.capture_monthly_cycle_source_internal_v1` | Joins `utilities.provider_invoices` to `supply_contracts`; same tenant/property; invoice approved/posted. Captures full row snapshot/hash, not a payment. Invoice/line immutability trigger is in `20260825000900_utilities_contracts_invoices_ocr.sql`. |
| Reading | POST `/api/customer/v1/utilities/readings` → `capture_reading_v1`; POST `readings/[id]/approve` → `approve_reading_v1` | Captured reading is not automatically approved evidence. Approval authenticates actor, checks configured MFA and association_admin/property_manager context, locks reading, writes validated/approved status and validator metadata. Monthly capture joins meter, requires tenant/property and validated status. |
| Consumption | `calculate_consumption_v1` → `approve_consumption_v1` → `bill_consumption_v1` | Owner Utilities lifecycle. Consumption is not an extra cost merely because a reading allocated a utility invoice. No invented monthly consumption source type. |
| Maintenance cost | POST `/api/customer/v1/work-orders/[id]/payable` → `customer_api.create_maintenance_payable_v1` → `maintenance.create_maintenance_payable` | Latest repository body is `20261004130036_maintenance_payable_context_authority.sql`, not the older installer body. Requires `finance.payables.create` plus scoped `maintenance.procurement.manage`, resource-lock recheck, verified work order; optional PO must belong to work order and be approved/ordered/received. |
| Existing payable effect | Same canonical maintenance call | Checks closed period, resolves existing account chart, creates/posts balanced journal, creates vendor_payable, links PO if provided, inserts work_order_cost and two audit events. Returned payable/journal IDs do not mean payment or settlement. Do not post again downstream. |
| Monthly capture | Existing monthly action route and internal routine | Requires `finance.monthly.manage` and AAL2 through existing context helper. Locks collecting cycle. Captures only invoice/reading/allocation; unique cycle/type/source prevents another captured row. This does not by itself prove modern C01/currentness, Workspace binding or actual target availability. |

Full payable wire (existing ABI): `p_context_id, p_work_order_id,
p_purchase_order_id, p_invoice_ref, p_invoice_date, p_due_date, p_subtotal,
p_tax_amount, p_currency, p_expense_account_id, p_idempotency_key`.
Financial values remain decimal under the canonical implementation; this adapter
does not parse, default, add or round them. The existing JSON-only FIN01
`financial-proposal-posting-receipt.v1` schema is pinned unchanged; a valid object
is not a persistent source or financial posting. No fake FIN01 receipt is made.

## Owner requests and campaign resume

1. **Finance + Operations, FIN-INPUT-01:** add a versioned monthly reference
   bridge for the existing payable and posted journal, not another posting. Match
   payable/work_order/work_order_cost/PO/vendor/journal and tenant/property/period/
   currency to current canonical context/Workspace. Read the actual immutable
   source identity/snapshot/hash; no fabricated `source_version=1`. API and source
   constraint adoption belong to Finance. Tests must show one cost origin, no
   journal/payment duplication, denial and read-only unknown recovery. Until
   this owner implementation exists, the adapter returns no request.
2. **Utilities + Finance, FIN-INPUT-02:** deliver the approved invoice ingestion/
   review gateway and its actor/authority contract. The tables and approval
   triggers found in source are not a callable, authorized input producer. No
   fixture is seeded directly. Approved run must resolve at least two distinct
   costs and one validated reading; a linked reading is an allocation basis,
   not a second charge. New IDs are resolved privately by Platform's approved run.
3. **Finance, FIN-INPUT-03:** current capture filters tenant/property/status but
   does not compare invoice currency/period to the cycle. On conflict it returns
   the newly computed hash, not the existing captured row's hash. Source
   counterexample: invoice captured at approved, then status posted, same cycle/
   type/ID captured again; `to_jsonb(i)` changes, INSERT does nothing and returned
   hash may differ from stored hash. This is source analysis, not a PG execution
   witness. Define period/currency eligibility and return canonical stored
   snapshot/hash on repeats before treating a capture response as evidence.

The native campaign is **NOT_READY**. No shared guard or role is borrowed from
SERVICE. Finance must identify any actual shared C01/C03 gap with exact capability
and scope; this handoff changes none. Platform must bind its independent source/
App/Tree/migration set, target, roles, AAL/session, observer, capacity/budget and
serialized execution window. No target IDs or permit values are fabricated.
ACC01–ACC22 and human accountant verdict remain separate acceptance gates.

## Checks and limits

Run only `node scripts/test-core-monthly-source-handoff-v1.mjs`. It loads the new
planner, real existing monthly handler/schema and real validation modules, with
SDK persistence boundary controlled. Synthetic successes establish exact wire
compatibility only. They do not establish source approval, hosted persistence,
Auth/RLS, SQL compilation, native expiry/revoke/concurrency or a monthly E2E.
The test never dispatches SQL and does not run Finance072–076 or SERVICE17.

Automation opportunity: **نیازمند بررسی**. Input: qualified source references;
automatable part: strict request preparation and source pin validation; human
Finance/Utilities approval and Platform run authorization remain required.
Exceptions go to the named owner requests; value criterion is avoiding source
relabeling and duplicate posting, not a fabricated time saving estimate.
