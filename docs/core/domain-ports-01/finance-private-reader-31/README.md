# Finance75 private decision reader — Core source handoff31

Core parent ef5beb10900b04a85cb75ceb6f9c0301a969b945; same branch, WIP retained.
Finance75 head 75c51eac67408b181b014749a393997c8363cda4, Parent622054a,
declared Tree08c6e5ed334e3fde6b494eae0c576280fc2c6f38. Exact214090-byte
private source envelope SHA2569c62f7a444cfad0eefa4dac2e10ab5b5e2f4348d3da3518df05b420724ba5fb8
and ten owner postimages/seven Core inputs verified. Actual bundle20514bytes,
SHA256537a55d3aa4557c5e05174ae7d0e0294916717f1ece6386cef6d189b8efeb828;
header HEAD75/prerequisite622 match. Full upstream Git ancestry/Tree reconstruction
not claimed. Owner files are not copied into or modified in this Core repository.

Three historical Finance findings on622 are CLOSED_SCOPED_SOURCE per Coordinator;
not reopened or rerun. That closure says nothing about invoice-v2/RLS/install/native.

## Exact ABI / domain ownership

`app_private.lock_finance_invoice_decisions_v2(uuid context,uuid workspace,
text permission,text module,uuid cycle,uuid invoice) returns setof utilities.review_decisions`.
SQL implementation is `supabase/proposals/core-finance-invoice-decisions-v2/reader.sql`.
Security: private, VOLATILE INVOKER, search_path=pg_catalog. No owner/service_role
fallback, role/grant creation, DML, approval, receipt, journal, new host or HTTP route.
All records are real stored canonical rows, raw PRIVATE input to Finance's snapshot
routine. They are not a public actor/review projection or permission/approval grant.

Two ancillary INVOKER predicates implement only RLS projection of the same existing
canonical Finance/C01 family: finance_invoice_origin_scope_v2(uuid,uuid) and
finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb). No independent evaluator,
caller verifier, permission flag, client actor, clock or supplied JSON proves access.
Exact pair allowlist: finance.monthly.manage/accounting,
finance.allocations.calculate/accounting, finance.allocations.approve/accounting,
billing.manage/billing PLUS billing.issue. No utilities.invoices.review borrowing.
Actual role mapping and entitlement permission registration are NOT supplied here.

Canonical current actor/session/AAL2, tenant/Context/Workspace/member/role/entitlement
and exact cycle/property/invoice must be valid. Context/Workspace selectors match
the official request-local Core30 scope; real Finance75/C01 and fresh-time canonical
helpers independently reauthorize. Original commands/authority/key/body/IDs/TTL are
not modified. Reader creates no transaction or C03 reservation and sends no rows
before final post-wait validation. Only historical integrity rows are returned;
Finance remains owner of full-content approval validation and monthly effects.

## Completeness, locks and RLS

Read ALL submitted utilities.invoice.origin.v1 and approved
utilities-invoice-review-decision.v2 rows across ALL tasks of the same invoice and
tenant. There is no actor predicate, selected-task reduction, LIMIT or truncation.
Order: existing caller cycle/contract/source/document/invoice/lines/task locks →
reentrant invoice write-intent → metadata RowShare → all invoice tasks by UUID
write-intent → all required decisions by UUID FOR SHARE → restore private selectors →
last fresh canonical scope/property/session check → buffered stored rows. The
caller already locks the invoice; reentrant FOR UPDATE also prevents new task FKs,
and all-task FOR UPDATE prevents new decision FKs while the set is consumed.
No broad SHARE table lock serializes business writers or creates a new lock engine.
Legacy/nonparticipating writer and two-connection behavior still need native proof.

PG17 upstream source confirms policy CREATE/ALTER/DROP takes AccessExclusiveLock;
ROW SHARE protects policy definitions through the scan. It also confirms SELECT
FOR SHARE/UPDATE uses BOTH SELECT and UPDATE USING policies. Thus a SELECT-only
cross-actor policy is insufficient. Source references/digests are in the manifest;
this is upstream source reasoning, not installed-provider/native evidence.

RLS contract: two exact private role-specific policies per table for SELECT and
UPDATE USING, plus one restrictive UPDATE USING(true)/WITH CHECK(false) fence.
Six policies total on review_tasks/review_decisions. Minimum column UPDATE(id) is
only for row locks; WITH CHECK(false) denies business updates even if a separate
permissive policy exists. No UPDATE of other columns or INSERT/DELETE/TRUNCATE is
accepted. Exact deparsed predicates, current principal OID, helper body/security/
search_path and absence of other effective restrictive SELECT/UPDATE/ALL predicates
are checked in the real reader. Owner/BYPASS/non-RLS/partition/inheritance shortcuts
are NOT_READY; mere SELECT/grant option or an actor-only view is not completeness.

Four transaction-local invoice/cycle/permission/module selectors narrow RLS to the
selected source. They are selectors, NOT a claimed allow or authority receipt.
Every target policy invocation calls actual Finance75/C01 and fresh server-time
checks. Denial raises, instead of false-filtering some rows during an expiry→new
permission window and accepting the rest later. Previous selectors restore before
the final check; statement/transaction failure rolls them back in the existing host.
No origin or approval after full admission is still55000 NOT_READY, not proof of
absence. Query/error/cancel/expiry after a lock gives no partial result. Original40001
is not caught or changed. Generic transport/settlement semantics remain Core-owned
and unchanged; authority until COMMIT/ACK is not claimed.

Finance75 intentionally rejects any row belonging to a task other than its chosen
approved task. Core returns every required row instead of hiding that history;
Finance can therefore fail closed on multi-task ambiguity. This is not a new rule
that an arbitrary task/actor supplied by the caller may filter the canonical set.

## Actual Platform inputs — no guessed role/grant

Platform/custodian supplies actual target/role receipts, canonical business-role
mapping and private runtime-role OID/name. The offline renderer requires those
identity fields and produces source proposals only; no SQL connection/execution.
Its input digest or role name alone is not admission. It cannot select SQL/schema/
relation/permission or create a role/grant. Existing shared Auth and actor policies
are preserved; policies target only the actual admitted private principal.

Required actual privileges: USAGE schemas; EXECUTE three Core functions and pinned
Finance75/Core30 canonical dependencies; SELECT complete review row types and
UPDATE(id) for row locks; other Finance/source SELECT/lock rights needed by the
invoker capture/snapshot. No sequence/DML rights come from this reader. Capture
changed from DEFINER to INVOKER in Finance75: old ACL/signature preservation is NOT
proof that the ordinary runtime has that larger domain write/RLS closure. No
owner/delegation or positive grant is guessed. Preflight records effective ACL,
grantor/inheritance/default privileges independently from grant option; verify
checks exact function security/body/owner/ACL and six policy shapes.

Source install and recovery order are in recovery.md. Actual role selection,
policy/native admission and execution stay with Platform. Neither this packet nor
a rendered policy grants a permit, source approval, registration or activation.

## Limited rebind / checks

Core30 TS/HTTP/schema/provider/plan/fingerprint/query SQL+args remain byte-identical.
Only effective Finance identity metadata advances to75; of ten prior pins nine
are identical and the kernel changes. New invoice SQL/image/migration/seal and
private capability/dependency pins are additive in this new overlay manifest.
The old Core30 manifest/checker remain historical and validate the old checkout;
use check-core-finance-invoice-decisions-v2.mjs for this successor, not a rewritten
historical622 baseline. Neither21/8 nor policy12, Finance19 or622 accepted controls
are rerun. Source verification confirms Finance75's exact private call and INVOKER
security change; it does not fix owner SQL or turn that change into least privilege.

New controls: source/negative and reference-model scope/completeness/wait/denial,
including actor-only filtered zero, UPDATE-USING omission, multiple actors/tasks,
wrong scope, both billing keys, temporal deny followed by re-grant, same40001,
selector restore and offline role-renderer injection negatives. These are NOT
SQL/PGlite/PG/Auth/RLS execution or native security evidence. Runtime stays NULL.

Commands:
- node scripts/test-core-finance-invoice-decisions-v2.mjs
- node scripts/check-core-finance-invoice-decisions-v2.mjs --finance-source=VERIFIED_FINANCE75_ROOT
- node scripts/render-core-finance-invoice-decisions-rls-v2.mjs --binding=PRIVATE_PLATFORM_SOURCE_BINDING --out=REVIEW_ONLY_SQL

No target/source SQL, Auth, install, grant or activation was executed. No fixture
or successful approval/receipt is seeded. Native PG17 compile, RLS/delegation,
concurrency, expiry/revoke/currentness and independent QA remain NOT_RUN_NOT_PASS.
Automation: نیازمند بررسی؛ source pin/policy/ABI/negative checks are automatable,
actual custodian role/RLS/delegation and native acceptance require Platform/QA.
