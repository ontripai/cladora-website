# Finance continuation30 — independent Core source candidate

Parent: `1f13741d729cec0e2aff6d6b964e7196ee3ba18e`. Checkpoint1f and accepted
controls unchanged. Runtime/binding/activation are NULL, no target operation.

## Actual input and adoption

Finance effective source: `622054afe7f47ba92c7c47159c7af4d1e38fe57d`, Parent
`e849162296c9d3ca63d38e281019040911d49d18`, Tree
`47c040b38017b858e4b325d9d49094f453c219ef`. Owner's private Page delivers
909→7fa→e849→622 exact source afterimages; Core verified bytes/hash and the
changed effective modules, not merely filenames/report text. Full Git ancestry
of the private Finance bundle is not claimed: prerequisite7fa object is not in
this worktree. Source-afterimage verification is distinct from native acceptance.
Three finding fixes belong Finance; QA closure remains pending. Core does not
modify Finance owner files, codec, general C03 host or monetary calculations.

## Consumer assembly — real exports, no copied Finance implementation

Use `createCoreFinanceMonthlyBindingV1` from
`src/lib/core/finance-monthly-binding-v1.ts` at trusted server composition:

```ts
const runtime = createCoreFinanceMonthlyBindingV1({pool, target, domain: {
  canonicalMonthlyCommandV1, // Finance schema.ts
  monthlyCommandFingerprintV1, // fingerprint.ts
  createFinanceMonthlyProvidersV1, readFinanceMonthlyCommandV1, // provider.ts
  readFinanceMonthlyPlanV1, // plan.ts
}});
```

Use EXACT pinned Finance622 exports. `domain` is a server CODE dependency, never
an HTTP capability/callback, Auth evaluator, actor supplier or caller allow.
Core's existing host always replaces resolveAuthority with canonical C01.
No route is activated by constructing this source factory. Target must come from
Platform's actual owned-development manifest/pool and canonical role mapping;
no service_role, configured-principal assertion or client JSON substitutes. Finance extends the actual schema CREATE/table-owner census to finance/billing/utilities; a declared role name is not least-privilege proof.
The compiler proof assigns this actual factory to Finance's real
`FinanceMonthlyVerifiedRuntimeV1`; the HTTP handler/plan reader/provider/fingerprint
are actual owner source loaded from verified afterimages, with SDK/PG controlled.

| Method | Identity / capability | Effect / settlement |
|---|---|---|
| executeVerified(Request,input) | real SDK getUser/getClaims, actor match, AAL2 before checkout; original expected revision retained | existing C03 only; fixed validation+domain effect; atomic receipt/audit/outbox; existing bounded40001 |
| readbackVerified(Request,input) | current canonical authority independent of original command revision | exact original envelope/hash and canonical matched receipt through real Finance reader; SELECT-only, ROLLBACK, no C03 reservation/execute |
| readPlanVerified(Request,cycle,query) | finance.allocations.read / accounting | exact cycle/run query and DBtx/actor/tenant/workspace arguments; SELECT-only lock-capable SERIALIZABLE, ROLLBACK |

Stages/calculate use `finance.allocations.calculate`, approve uses
`finance.allocations.approve`, all module accounting. Bill requires BOTH
billing.manage and billing.issue; consume uses finance.monthly.manage. No
capability is granted by this matrix or borrowed from monthly/SERVICE. Unknown
query, arguments, effect SQL, cross-request Context/Workspace change or scope use
after settlement fails closed. C03 retains original IDs/key/body/revision. A
current revision8 may authorize historical receipt7 readback, never rewrite it
or manufacture a replacement command. An UNKNOWN must first call readback of
that exact envelope; absent/expired receipt stays READBACK_REQUIRED, not evidence
that the effect did not happen. Retain the exact unresolved HTTP envelope,
including its original Context/key/IDs/body/expected revision. Canonical Context
resolution binds the actual server actor, and Finance compares that actor with
the original stored command/receipt. Recovery never dispatches or substitutes a
new Context/actor/envelope. If original identity cannot be recovered, safe hold
remains; this packet does not infer it from current GET or create a parallel store.


## Source capture planner — explicit new version

`src/lib/core/monthly-source-handoff-v2.ts` exports `planMonthlySourceCaptureV2`.
The actual Finance622 `monthlyCycleActionSchema` accepts vendor_payable and all
four canonical source kinds. This v2 planner produces references only; no money,
approved flag, receipt, permission or source-currentness is supplied. Its consumer
must adopt that exact Finance source and actual capture runtime. Accepted57/v1
planner is byte-identical, including its historical NOT_READY branch. v2 does not
rewrite old stored commands or permit capture before invoice-v2/role/RLS gates.

## Final observation / error boundary

The opt-in Finance transport uses only
`app_private.core_finance_monthly_checkpoint_v1`. It first consumes the EXISTING
lock checkpoint; samples actual DB clock afterward; then rechecks canonical
session/Context/workspace/member/role/entitlement/permission through accepted
fresh-time ABI. Both billing permissions share that observation. It runs after
domain/C03 receipt/audit/outbox waits and after final principal lookup, immediately
before raw COMMIT. No claim of authority until durable commit or client ACK. An observed readback uses the same wrapper with exact original key/request-hash/receipt: it locks the canonical C03 row before fresh clock and checks expiry plus full response_ref at that final observation. No hidden wire follows before ROLLBACK.
The read scope checks again after the reader's final await and before ROLLBACK;
no scope survives settlement and no result is returned before its positive ACK.
40001 from read propagates as the same error object. Mutation uses existing C03's
three bounded attempts. Uncertain COMMIT is UNKNOWN; a later cleanup ACK does not
undo it. First failure/settlement evidence stays in the existing Core error port.
No retry engine, clock, authority evaluator or transaction engine is added.
Finance reuses accepted alias hygiene (clear legacy request.jwt.claim/email at checkout and locally before identity/session); SERVICE behavior stays unchanged. Other domain profiles do not opt in to these new Finance-only branches.

## Invoice-v2 contract to Finance — adoption still required

Utilities checkpoint1f already supplies actual ingestion/review producer and
`utilities.invoice_content_image_v2`, plus immutable
`utilities-invoice-approval.v2`. Its approval is document acceptance only.
Finance622's `20261110104345_fin_monthly_e2e_source_and_close_guards.sql:19`
still captures `to_jsonb(i)` by approved/posted status. The effective kernel
`finance.assert_monthly_source_current_v1` at `domain-kernel-v1.sql:20–26`
checks a subset (total/currency/source_sha256), not the full approval-v2 image.
Therefore this integration does NOT mark invoice-v2 capture adopted.

Finance must lock the current supply contract→invoice→ordered invoice lines and
canonical ingestion document/source in the accepted source order (matching the
Utilities producer); recompute the DB JSONB content image using the actual pure
helper from these REAL locked rows and Workspace. Require approval contract
`utilities-invoice-approval.v2`, hash contract `utilities-invoice-content.v2`,
DB SHA256 of that image's JSONB text, exact stored source_image, source/scope/
contract/property/period/currency/amount/items/provenance, canonical origin record,
independent reviewed_by≠ingested_by and actual approved_by. Recheck authority
and scope after waits; any content/actor/version drift denies. A stored hash
or browser image alone is not current locked content or provenance. Do not use
the review-preparation helper as Finance authority: it requires the distinct
utilities.invoices.review permission. Finance's own capture scope remains required.
Legacy snapshots/UNKNOWN are not upgraded, backfilled, cleared or resent.

## Final source policies and actual remaining inputs

| Item | Owner / precise closure |
|---|---|
| Invoice roles | Platform/custodian map actual roles to ingest/review permissions in Utilities and authorized property membership; no invented role keys. Origin RLS must let an independently authorized reviewer observe required submission provenance of another actor, without general actor-data disclosure. |
| Allocation roles | Platform/custodian map appointed accountant/financial officer to calculate, independent qualified accountant/reviewer to approve, authorized preparer/reviewer/observer to read. Each requires its explicit accounting permission + tenant/workspace/property/period. No title/admin/monthly alias. |
| Allocation provenance | Finance owns cycle.prepared_by and every stage/calculation/recalculation actor for the approved version; no actor from browser or current session guess. Actual622 uses cycle.prepared_by + batch.created_by/calculated_by. Canonical schema makes prepared_by non-null; calculator permits only draft→calculated, so historical actor overwrite/recalculation must NOT be introduced without durable same-version provenance. Approver differs from all these actors even across session/Context/role/revision. |
| Exact approval | Finance owns same cycle↔run/version/input hash/evidence/rules/basis/item bindings, recheck after relevant waits. Core preserves this body and does not simulate it in codec. Invoice/allocation approval is not billing/payment/publish/period close; independent president/censor/accountant cycle gates stay unchanged. |
| C03/helper/ACL | Platform observes actual principal, effective helper definitions/owners/ACL, RLS, source/profile admission and exact query closure; this packet creates no role or positive grant. |
| Native | Platform/QA authorize separate campaign, enforce exact target/real clock/concurrency/40001/UNKNOWN/restart/readback and independent Finance finding closure. All NOT_RUN_NOT_PASS here. |

## Utilities reverse double-billing guard

`consumption-allocation-guard.sql` adopts the real Finance assertion in the
EXISTING bill_consumption after its consumption row FOR UPDATE and before billing.
Whole old body is recoverable byte-for-byte by removing only the added block;
actual catalog header/defaults/owner/ACL/security/search_path preserved and checked.
The helper's exact body/INVOKER/VOLATILE and complete claim visibility are required;
row-level filtering cannot falsely prove no claim. READ COMMITTED fresh volatile
SPI and SERIALIZABLE SSI require native proof; REPEATABLE READ is rejected.
The source/scheduling model is not a PG concurrency or successful install witness.
Installation rollback does not roll back previously committed business effects.

## New checks only

- 9 original new coupling groups +4 additional late-wait/SSI/scope groups +2 final-receipt-wait groups +1 first-failure/UNKNOWN cleanup
  group +1 read-as-write admission negative +1 actual-schema planner control
  +1 poisoned-alias hygiene control +1 foreign-Context/Workspace resolver denial
  +1 actual Finance schema/owner principal-census negative, actual
  Core/Finance modules and controlled SDK/PG transport; no native SQL/Auth.
- 8 source-equivalence/negative/scheduling model groups, no SQL parser/PG.
- Full current ES5 typecheck and real Finance virtual-overlay type assignment;
  focused lint/syntax/diff and patch apply/reverse. Healthy1f/57/Finance suites
  and previous shared-host/SERVICE/072–076 are not rerun.

Commands (supply the verified Finance622 afterimage root, never raw credentials):
`node scripts/test-core-finance-monthly-binding-v1.mjs --finance-source=ROOT`
`node scripts/check-core-finance-monthly-types-v1.mjs --finance-source=ROOT`
`node scripts/test-utilities-consumption-allocation-guard-v1.mjs`
No SQL/parser/compiler/install/activation is run by these commands.

Automation: needs review. Inputs are pinned domain modules and approved private
Platform observations; source pin/query/type/equivalence checks are automatable;
role/RLS/target admission and independent Finance/native acceptance remain human
Coordinator/Platform/QA decisions. Value is early rejection of mismatched source
without installing or fabricating approval/authority.
