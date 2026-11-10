# QFW-FIN75-ENTRY-01 — Core scope/selector/lock contract

Core parent c39824bc0cd77cf52f8a831c14d4d186ca477b0a. Finance owns the caller/domain
fix; Core owns the private capability. Shared Page ENTRY-01 and actual Finance75
source read. No corrected Finance ENTRY successor is available at this checkpoint;
Finance197cb86/cde134f concerns separate allocation work and a compile diagnostic,
not evidence that this finding is fixed. Pair remains CHANGES_REQUIRED pending real
consumer source and affected QA. No native/runtime/role/target admission is implied.

## Decision: ENTRY needs no Core ABI or RLS change

The six-argument SETOF review_decisions primitive and its exact two RLS predicates
remain the contract. Current Core reader saves the caller's four selector values,
authorizes/locks its selected scope, establishes its own values, buffers every
canonical task/decision, restores its caller values and checks current authority
again before returning. Empty caller values are deliberately restored to empty.
Moving reader before the task SELECT by itself therefore does NOT solve later
caller reads. Extending reader lifetime beyond RETURN, a public setter/callback,
TO authenticated/membership, policy widening or owner fallback is unnecessary.

Finance's EXISTING PRIVATE `finance.monthly_invoice_snapshot_v2` must own an outer
canonical source scope spanning its first task query and all subsequent task/
decision use. It may set selectors INLINE inside that actual private function,
AFTER real canonical validation. This is NOT preseed outside canonical scope;
there is no new API, standalone setter or authority flag. Text permissions/GUCs
remain selectors; actual Finance/C01/session/property checks authorize each row.

## Exact corrected consumption order for Finance

1. Authenticate through the existing trusted request-local Core/C01 path; require
   AAL2, current session and canonical tenant/member/role/entitlement/permission.
   Parameter Context/Workspace must match the actual official transaction scope,
   not merely a second authorized Context. Validate exact Finance action pair;
   billing.manage also needs billing.issue. No utilities.review capability alias.
   After that canonical validation, save the previous four transaction-local selector strings.
2. INSIDE that same private authorized function, BEFORE the first domain source/task
   query, set LOCAL selectors to exactly
   p_invoice, p_cycle, p_permission, p_module:
   request.cladora.finance_invoice_v2 / finance_cycle_v2 /
   finance_permission_v2 / finance_module_v2.
   No domain source/task/decision query may precede this point (the canonical
   authorization queries themselves are the preceding guard). A supplied selector
   cannot replace canonical scope or actual visibility; unknown/mismatched scope
   and incomplete RLS still fail closed.
3. Keep cycle/period and contract→source→document/run→invoice write-intent→ordered
   line locks in the existing order. Renew canonical scope after the waits.
4. Execute the existing task SELECT/FOR UPDATE and validate the actual unique
   approved task. Call the actual Core reader with exactly the same six arguments.
   Core saves these already-valid OUTER selector values, establishes its nested
   scope and restores the same outer values before it returns. All invoice tasks
   and all required actors/decision rows stay complete; Finance remains responsible
   for task count, independent actors, full image/hash/provenance and ambiguity.
5. Any later task/decision DB read must remain INSIDE the outer lifetime. Do not
   copy JSON as evidence of a task row, infer task fields from a receipt, filter
   extra tasks/actors, or replace the physical reader with a fixture/callback.
   Preserve real locked rows; no command/receipt/approval/effect is manufactured.
6. Restore all four saved caller values before the LAST canonical fresh-time scope
   validation and return. No RLS-dependent task/decision query is allowed after
   restore. All effective waits—including restore/source reads if any—must precede
   renewed server-time session/current C01/property checks in the same transaction.
   No assertion of authority until COMMIT/client ACK; later C03 final guards stay.
7. On error/40001/cancel, do not return success or partial data. Let the existing
   statement/transaction rollback restore local settings; if a private exception
   block cleans up explicitly, preserve the original error and rethrow, never mask
   it as ready/unavailable or a new command. UNKNOWN keeps original key/body/IDs/
   authority/TTL and existing host recovery. A new request must start without a
   stale selector; successful nested scopes must restore a legitimate caller scope.

Lock order is unchanged. Existing Core invoice write-intent/all-task deterministic
locks/decision FOR SHARE remain; actual legacy-writer/concurrency proof is still
Platform/QA work. No role/ACL/RLS/owner/transaction-host change is authorized here.

## Required consumer witness, only after actual successor

Start from actual Finance function entry, private principal not authenticated and
not a member, empty selectors, exact proposed SELECT+UPDATE USING policies. Prove
same-scope first task lock becomes reachable, actual reader executes, full domain
validation stays real, successful and failing calls restore caller selectors, and
the next request does not inherit them. Test only affected denial/expiry-after-wait,
incomplete visibility, original40001/UNKNOWN and relevant later DB reads. A preseeded
fixture/direct reader pass is not entry closure. Do not rerun QA's historical three
models or accepted Core15/21/8/policy12/Finance19/622 controls just for status.

## Separate real Core compile blocker — minimal syntax successor

Finance supplied an actual28369-byte receipt SHA256
b413f605d69460c450e10a3e5c02fe0adaede5a2536a5c33d83cdfb26d6a5879:
FIN-CORE31-COUPLING-01 reports embedded PGlite42601 at position13190/line171,
`IS DISTINCT FROM CASE ... END`, in the exact Core reader SHA256
6eb71c153839f3774fb9a04930e30830c3c3e0fa816a69a793fe8465e56deaa8.
No business coupling was reached; rollback left zero partial Core functions.
The original failure is owner-reported embedded compilation, not PG-server/native execution.

This successor adds parentheses around the same three SQL CASE expressions in
reader.sql and verifier.sql. Removing ONLY those parentheses reconstructs the
entire original reader exactly. Verifier additionally changes ONLY its reader-body
hash. Headers/ABI, both RLS projection bodies, predicates, locks, selectors, final
checks, ACLs, errors, actor visibility and runtime stay unchanged. No guards are
removed to pass. The delimiter source model demonstrates the earlier top-level
CASE THEN could be consumed as the IF terminator; it is NOT SQL compile proof.
The exact original Finance cde harness SHA256
322440a82dcbdede7301195f8ee369d153fca31f549c42dc9c1a2a906de85f3d was
run against the real new source and unchanged Finance75 fixture/image. ONLY its
two expected reader-file/body hash literals changed. New source compiled/loaded
successfully in isolated PGlite0.3.14 / PostgreSQL17.5 WASM; four newly reachable checks PASS: actual
reader body, actual Finance→reader missing-RLS NOT_READY, official Context mismatch
denial, and zero monthly capture/receipt after failures. Auth/C01/session/schema/
ordinary-role fixtures remain synthetic; no fixture reader was substituted.
A compile-only probe asserts check_function_bodies=on before loading and confirms all three functions afterward. An earlier0.5.16/PG18.6 probe is retained but is not PG17 evidence. Tooling was installed outside the repository with scripts disabled; project
package/lock unchanged. Exact owner toolchain version is still unconfirmed, so
same-version reproduction is not claimed. Evidence/pins are in compile-evidence.json.
Only this limited embedded compile/coupling ran; PostgreSQL server/native and
actual role/RLS/install/activation remain NOT_RUN_NOT_PASS. ENTRY consumer
successor/empty-selector real-policy composition is still pending.
ENTRY remains a Finance consumer fix, separately from this syntax correction.

Unchanged/new pins are in manifest.json. Historical Core31 manifest remains intact;
use this narrow overlay to validate the syntax successor. No TS/HTTP/host/evaluator,
Finance-owned file, policy, role, target or activation changed. SQL executed only
in the explicitly authorized ephemeral embedded harness, never on a target/server.
Three622 findings remain CLOSED_SCOPED_SOURCE and are not extended to invoice-v2,
actual role/RLS/install/native. Runtime NULL. Source counterpart acceptance and
consumer FullSHA remain pending; there is no guessed successor pin.

Automation: نیازمند بررسی؛ exact before/after/unchanged pin checks can be automated;
real consumer entry/canonical scope acceptance and native role/RLS/locks remain
Finance/Core/Platform/QA decisions on the actual source/campaign inputs.
