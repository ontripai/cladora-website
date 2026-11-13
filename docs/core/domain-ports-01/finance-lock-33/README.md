# Core33 — FIN-CORE32-LOCK-PRIVILEGE-01

Direct child of a2ad62a29e522745e91fb6f2170c97ce892131f8 on existing Core branch.
Finance caller is the actual 7638f9145f17785ad4bb29108e6c30ac6479e86f,
Parent197cb86, Tree9e86efa2bc65c9fccd27806d7c5c556c4840e236. Private Page
manifest/failed receipt and nine afterimages were obtained and checked by hash;
no Finance-owned file or original fixture/harness was edited. This packet does
not publish that private source. Inventory and original harness pins are in evidence.

## Cause and same-mode replacement

The actual private nonowner/nonmember role has SELECT and column UPDATE(id).
PG17 explicit LOCK ROW SHARE requires an applicable TABLE-level privilege;
SELECT alone only admits ACCESS SHARE. Column UPDATE(id) admits row-locking SELECT
but not that explicit LOCK. Finance's real receipt is42501, not RLS incompleteness.
No table UPDATE, MAINTAIN, membership, owner, SECURITY DEFINER or fallback is added.

Replace only the explicit LOCK and its comment by two fixed zero-tuple statements:

```sql
PERFORM rt.id FROM utilities.review_tasks rt WHERE false FOR SHARE OF rt;
PERFORM rd.id FROM utilities.review_decisions rd WHERE false FOR SHARE OF rd;
```

This is still RowShareLock on BOTH relations, tasks then decisions, acquired BEFORE
policy proof. WHERE false returns/locks no tuple even with empty/filtered relations.
PG17 parser opens a FOR SHARE relation with RowShareLock independently of row
count or plan simplification; cached plans retain relation lock mode. Locks stay
through the transaction, including the later scan/final checkpoint/settlement.
CREATE/ALTER/DROP POLICY requires conflicting AccessExclusiveLock. The zero-query
neither evaluates a forged allow nor substitutes for RLS/canonical checks.
Source references and hashes: policy.c, parse_relation.c, lockcmds.c in evidence.
The same original exclusion of helper/role/DDL changes from an admitted window
remains; this does not freeze upstream definitions permanently or prove a provider.

All other reader bytes are preserved: six-argument SETOF ABI, both policy helper
bodies/pins, RLS predicates, restrictions, source locks, complete task/decision
ordering, buffer-only output and final fresh-time checks. Authority is not derived
from selectors. No C03 mutation/receipt/audit/outbox/host/TS/HTTP behavior changes.
Existing RLS/helper/body pin checks and all-task FOR UPDATE/decision FOR SHARE stay.

## Actual affected execution

Ephemeral @electric-sql/pglite0.3.14 PostgreSQL17.5 WASM, Nodev24.19.0;
check_function_bodies=on. Previous runtime match is reused, no identity suite rerun.
Actual Finance763 wrapper + actual revised reader + exact six role-specific RLS
policies, under SELECT+UPDATE(id) only and empty initial selectors:12 checks PASS.
Includes snapshot/approval image, empty restore, next request, nested legitimate
scope, Context denial, simulated post-wait expiry/denial/40001 and policy omission.
Same role's old explicit LOCK returns42501; zero-tuple FOR SHARE succeeds with no
business rows and no table UPDATE/MAINTAIN. Zero monthly capture/C03 receipt effects.
Synthetic input was created/reviewed through actual Core producer, not a fake approval.
Auth/session/C01/minimal schema/role fixture and post-wait failpoint are explicit
substitutes. No real two-session wait or native Auth/RLS/currentness is claimed.
Original harness's first diagnostic still says 'a2ad'; actual new file/body pins
were substituted and asserted. That label is not a claim that old bytes were run.

Initial added pg_locks retention assertion FAILED: WASM returned an empty set even
after successful actual row locks. That failed receipt is preserved by hash; it is
not a lock-proof PASS. The accepted coupling continues without claiming WASM lock
retention, and a READ-ONLY pg_locks observation remains in the prepared harness.
Native gate remains: isolated PG17 two connections, observer must see RowShareLock
on BOTH relations through scan; policy DDL in B must wait until A commits/rolls back.
Cancellation/denial must release locks via existing rollback; UNKNOWN is not rollback.
No failing native assertion was converted to native PASS.

Guarded a2ad upgrade compiled/executed in a separate disposable embedded test:
new body/security checked; repeat application rejected55000 (2 controls).
Three new source groups + syntax/focused lint/diff PASS. Healthy15/19/21/8,
622 source closures and runtime identity controls were not repeated. Historical
runtime cde remains UNPROVEN; native/install/runtime admission remain open/NULL.

## Install, verify, recovery — inactive contract

Platform owns actual principal/target/role/RLS/window admission. No target changes
are authorized by this packet. Full details are in existing recovery.md plus its
Core33 section. Choose ONE path, not both:

- Absent three routines, separately admitted fresh unit: new reader.sql.
- Existing exact a2ad body: preflight, then upgrade-rowshare-v3.sql; existing owner
  must execute it. Exact old hash required; only the reader is replaced. Same OID,
  owner, ACL, security, search_path, volatility, argument/return/SETOF are asserted.
- New verify.sql then actual role/RLS/native acceptance. Do not replay migrations,
  policies, helper CREATEs or grants. Existing policies remain unchanged.

Each installer unit commits independently. Unknown COMMIT stops the next unit;
authorized read-only catalog recovery matches old/new signature/body/owner/ACL.
No blind retry or DROP/CREATE. Rollback installation is not undoing committed invoice
or approval data. Reversal needs reviewed new->old exact-body guard and a quiescent
window; reverting to a2ad reintroduces its lock-admission limitation.

## Reproduce only this delta with actual Finance input

Obtain the exact private Finance763 source-inventory, combine part text WITHOUT
separators (SHA256 ed8c1d4412a94fea01c077a128de47340cdd4dabe7a3ab03b723f617b9f1cf2f).
Use actual Finance75 invoice-v2-fixture.sql (SHA25694b70de...d5bec58). Neither source
is reconstructed from reports. With existing exact PGlite module and private paths:

```sh
node scripts/check-core-finance-lock-v3.mjs --source-only
node scripts/check-core-finance-lock-v3.mjs --inventory="$PRIVATE_INVENTORY" --finance-base="$PRIVATE_FINANCE75" --pglite-module="$PRIVATE_PGLITE" --out="$PRIVATE_NEW_OUTPUT"
# Separate upgrade-only test; does not rerun the business coupling:
node scripts/check-core-finance-lock-v3.mjs --inventory="$PRIVATE_INVENTORY" --finance-base="$PRIVATE_FINANCE75" --pglite-module="$PRIVATE_PGLITE" --out="$PRIVATE_UPGRADE_OUTPUT" --upgrade-only
```

The driver hashes all received afterimages and original harness; edits only its
two expected source pins plus the focused ACL/zero-tuple check (not its domain
logic), and allowlists child env. --prepare-only generates without instantiating
PGlite; prepared runner byte-matches the actual executed runner. Original source
and failed receipts stay outside repository; no credentials or raw catalog are
embedded. Project package/lock unchanged. runtime=NULL, independent QA pending.

Automation: نیازمند بررسی؛ exact delta/pins and disposable coupling are automatable;
real Platform role/RLS/two-connection evidence and QA acceptance remain human gates.
