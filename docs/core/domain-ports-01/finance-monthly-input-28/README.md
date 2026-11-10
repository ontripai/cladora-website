# FIN-INPUT-02 — Utilities source producer v1 (inactive)

Parent `57a1525d35ba4bcfbe4d998bd48e37e9f9dee547`. The same workspace was
read-only checked after resume: exact HEAD, no tracked WIP, only pre-existing
`scripts/__pycache__/`. Accepted57/planner and its11 tests are untouched. Page
sequence52 still describes Finance changes as OWNER_REPORTED_LOCAL_SOURCE; no
vendor payable schema/bridge or approval/receipt is invented here.

## Actual producer and consumption

`src/lib/utilities/monthly-input-producer-v1.ts` exports:

- `utilitiesMonthlyInputV1Schema`: strict discriminated input described below.
- `fingerprintUtilitiesMonthlyInputV1`: SHA256 of validated, sorted-object canonical
  input; arrays retain order. Decimal values are strings, never binary floats.
- `mutateUtilitiesMonthlyInputV1(scope, originalCoreCommand, input)`:
  domain hook for the **existing** C03 host. It checks full original actor/Workspace/
  transaction, aggregate/source IDs, exact permission/module/purpose/fingerprint
  before its one fixed SQL query. Only `{mutation_id}` returns to the host.
- `readUtilitiesInvoiceReviewSourceV1(readScope, selection)`: fixed read-only SQL
  preparation on an existing SERIALIZABLE lock-capable read scope, settled by
  rollback without command/reservation/receipt. Selection is context_id,
  workspace_id, authority_version, source_id from trusted server resolution.
  Result is actual source_id, review_task_id, source_sha256; neither approval nor
  authority. Utilities-specific query/role admission remains open; AIRPROP or
  SERVICE host profiles cannot be substituted.
- `UTILITIES_MONTHLY_INPUT_RUNTIME_BINDING = null`.

This is executable source for the domain mutation, not a registered public runtime,
HTTP route, authority provider, command custody, host, receipt or retry engine.
Construct original command identity from the existing trusted server resolver;
never from approved:true or client actor/authority. Compose only inside existing
C01/C03 after Platform's exact role/query admission and independent source review.
`resolveAuthority`, reservation, lock/retry, canonical matched receipt, audit/outbox,
COMMIT/ROLLBACK and unknown recovery remain with that existing host. Never invoke
this hook as lookup/replay. Native replay/host composition remains untested/unbound.

The mutation SQL is `select utilities.produce_monthly_input_v1($1::uuid,$2::uuid,
$3::bigint,$4::jsonb) as result`; args are original Context, Workspace, authority
revision and validated input JSON. No SQL, role, target, URL or allow callback can
be selected by input. Source results are INTERNAL, not disclosure or settlement
proof. Any error including the exact40001 object propagates; no local retry.

## ABI and actor/approval boundaries

All inputs include `contract_version=utilities-monthly-input.v1`, `operation`,
`source_id`. Strict objects reject extra actor/tenant/Workspace/status/approved/
receipt/hash/version/SQL fields. No default-zero money, fake source version or
caller time exists.

| Operation | Body | Exact authority / C03 identity | Canonical effect |
| --- | --- | --- | --- |
| ingest_invoice | contract_id; ingestion_document_id; external_invoice_no; issued_on; due_on(nullable); period_start; period_end; currency; lines[] with service_type, description, line_subtotal, line_tax | **Proposed** utilities.invoices.ingest / utilities / utilities.invoice.ingest; aggregate utilities.provider_invoice / source_id; provider IDs source+contract+document | Actual existing contract→ingestion source→document, same tenant/provider/currency and active contract dates; lock parents before child; existing document SHA/path used, never caller file provenance; insert invoice review_required + canonical lines + open review task and link document. No approval, journal or payment. |
| review_invoice | review_task_id; expected_source_sha256; decision approved/rejected; reason | **Proposed** utilities.invoices.review / utilities / utilities.invoice.review; same invoice aggregate; provider IDs source+task | Lock actual contract/invoice/lines/task; compare full persisted invoice+ordered-line preimage hash, current task/assignment; actual auth.uid writes approved_by/at or void, task decision and review_decisions before/after. Existing invoice/line totals and immutability triggers remain in control. |
| approve_reading | expected_source_sha256; note(nullable) | Existing utilities.readings.approve / utilities / utilities.reading.approve; aggregate utilities.meter_reading / source_id; provider IDs source | Lock meter then actual captured reading, match full actual preimage hash; invoke **existing utilities.approve_reading** preserving its role/MFA and validation behavior. Recheck canonical current authority afterward. |

Source input schemas are in code; dates are ISO date-only and period end must be
strictly later than start. Monetary line decimals: up to16 integer and4 fractional
digits; required, nonnegative. SQL numeric accumulation can reject overflow; no
rounding/default silently fixes invalid data. New invoice source permission keys
are proposed and **not registered/granted** by this package. Do not substitute
utilities.manage, reading permissions, SERVICE or role-name shortcuts. Policy
owner/Coordinator must approve exact module/action mapping and role bindings;
absence denies. This source does not claim an independently approved invoice
reviewer: existing task assignment is enforced and actual actor recorded; whether
invoice maker/reviewer separation must additionally be required is an explicit
policy decision, distinct from unchanged monthly president+censor independence.

Session/epoch/Context rows are locked by the existing checkpoint before source
locks. Order: contract→ingestion source→document→new invoice→review task for ingest;
contract→invoice→lines→task for review; meter→reading for approval. Initial unlocked
reads locate parent IDs only and are rechecked after locks; they are not proofs.
After effective source waits, **fresh DB clock** feeds accepted canonical session,
native Context/Workspace resolver, derived Workspace equality and property-target
permission evaluator. No standalone role/permission evaluator is added. It checks
actor AAL2, current tenant/member/workspace/property and permission with the existing
at-time chain. The final domain checkpoint repeats after domain/trigger waits.
Later C03 audit/outbox/receipt/clock/COMMIT waits are the host's responsibility;
this source hook is NOT the final host seal and does not prove currentness through
ACK or durable COMMIT. Runtime stays unbound until that composition is accepted.

Returned result ABI `utilities-monthly-input-result.v1` is exact source relation,
source UUID, server-computed full-row source_sha256, status, mutation_id, tenant,
actor, actual txid_current. Adapter checks real scope identity before/after await
and exact result cardinality/identity/status. For this new writer ABI only,
mutation_id is explicitly source_id; **Core receipt ID remains independent**.
The review preparation hash covers the real invoice plus full lines ordered by
canonical row ID, so a line-only change cannot evade the original review input.
Approval persists that actual preimage in approved_snapshot; the returned post-
mutation hash covers the actual resulting invoice row (including its snapshot).
The phase-specific hashes are not interchangeable. The hash is not fabricated
version/revision or a receipt. Ingest cannot return
approved. Rejection produces void, not approved evidence. No private labels,
contact details, document content or source path are returned by the hook.

## Installation, readback and gates

New source only: `supabase/proposals/utilities-monthly-input-v1/` contains preflight,
producer, verify and recovery. Historical migrations and all accepted helpers,
roles, RLS, triggers and Auth definitions are unchanged. Two new SECURITY INVOKER
functions have closed owner-only direct ACL. No grants, role assignments, public
customer_api exposure, RLS bypass, alternate transaction or parallel ledger exists.
This is not an installer permit: helper closure, exact owner/role options, effective
ACL/inheritance, RLS writer policies, table/sequence permissions and triggers must
be bound from actual target observation by Platform before admission. Existing
read-only RLS policies do not magically authorize these writes. Missing closure
is STOP; never switch to table owner/service_role to make tests pass.

Dependency order: approved invoice capability policy → exact canonical tables/
FKs/triggers and full fresh-time C01/session/C03 → Platform owner/executor/query/RLS
admission → source preflight → three-function installation → metadata verify →
authenticated domain/C03 composition → individually approved synthetic campaign.
Verify direct/inherited ACL and exact helper definitions against source pins; a
function name, table or trigger is not acceptance. Preflight/verify are **not run**.

Two costs/one reading are not created or resolved now. The later independent
Finance campaign must identify canonical contract/document and captured meter/
reading IDs, actual approved actor/session/role/AAL and exact target/window/budget.
Evidence document producer/custody provenance is also required: an arbitrary
caller-created ingestion_documents row is not accepted as validated file custody.
If this upstream record is absent, ingest remains unavailable; this package does
not fake it. Existing capture_reading_v1 and approve_reading_v1 routes remain the
record/reading lifecycle; scanner availability does not turn manual reading into
invoice/document proof. No successful financial command, receipt or approved row
is seeded. Monthly source capture, Finance period/currency/hash bridge, allocation
and billing are unchanged and remain Finance-owned.

Authorized future readback: original C03 canonical matched receipt plus actual
invoice/lines and task/decision IDs (or validated reading/validator), scoped source
snapshot/hash, tenant/property/period/currency and observer. Invoice GET uses
existing get_utilities_v1(view=invoices, id=source); reading GET uses existing
view=readings. The preparation reader resolves the exact review task/hash; additional disclosure
and exact C03 replay composition must
be admitted separately, not inferred from a synthetic result. Internal mutated
rows are not public before positive host settlement. UNKNOWN retains the original
key/body/actor/revision; do not resend with changed authority or a new source ID.

## Verification boundary

New15 distinct controlled adapter/static-source groups passed (13 initial +2 new
review-source groups); real module and Core command
schema loaded, only SQL boundary controlled. Final SQL/read edits got only the two new read groups and affected
static recheck. Full project ES5 typecheck, focused lint/syntax/diff checks passed.
No SQL parser/compile/query, PG/Auth, fixture, install/grant or target activation.
Native lock/expiry/revoke/concurrency/RLS/COMMIT/restart proof is NOT_RUN. Healthy
57/SERVICE/Finance suites were not rerun. Invoice policy mapping, upstream evidence,
role/RLS closure and C03 native composition are **open**, not accepted by this source.

Automation: **نیازمند بررسی** — strict source input/binding and pins are mechanical;
invoice approval policy and Platform campaign authority require the named human
owners. Invalid/missing provenance goes to Utilities/Coordinator, Finance schema to
Finance; value criterion is source traceability without duplicate cost posting.
