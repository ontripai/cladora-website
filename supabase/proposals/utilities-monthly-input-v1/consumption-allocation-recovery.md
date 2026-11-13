# Consumption claim guard — source executor contract

Inactive, one-function proposal; no automatic migration or target permission.
Prerequisites: Finance622 actual `finance.assert_consumption_not_allocated_v1(uuid)`
installed; its exact source-body hash/INVOKER/VOLATILE/search_path and actual
owner/executable ACL verified. Finance claim tables are the existing canonical
ones; this proposal creates no store/ledger/role/grant.

Run only under the EXISTING owner of `utilities.bill_consumption`, through a
separately authorized Platform installer. No SET/membership assumed. Preflight
must pin actual object OID, owner, complete catalog definition/ACL/defaults,
security/search_path and source body hash. Current function body must exactly
match the embedded historical preimage. A mismatch is STOP; do not overwrite a
later successor. Helper visibility must be complete under that SECURITY DEFINER
owner, not merely SELECT=true or permission to grant SELECT. The sufficient
predicate accepts no RLS, or actual table owner without FORCE RLS, plus SELECT.
Other visibility cases require separately reviewed proof; no bypass is created.
The same predicate is checked on every business invocation, before the assertion.

Order: existing consumption FOR UPDATE → existing already-billed rejection →
isolation/visibility guard → real Finance assertion → unchanged meter/tariff/
closed-period/liable-party/billing/audit sequence. Finance takes that consumption
row lock before inserting its statutory allocation claim. READ COMMITTED uses
the VOLATILE assertion's fresh SPI snapshot after the wait. SERIALIZABLE uses
existing SSI and same40001 handling. REPEATABLE READ is explicitly unsupported:
a snapshot preceding a wait cannot establish absence of a subsequently committed
claim. These are design/source conclusions, not a PG concurrency proof.

Installation is one transaction with 5s lock /30s statement deadlines. The actual
catalog header is reused, preserving signature/defaults, owner/ACL, language,
security and search_path; all pg_proc metadata except body must remain identical.
The poststate equality is fail-closed and may reveal catalog rendering differences
on real PG; this has not been compiled/executed. A failed installation requires
positive ROLLBACK and ReadyForQuery I from the same backend. UNKNOWN COMMIT is
not a failure receipt: stop, read only the exact OID/body digest/owner/ACL and
compare with before/after; reconcile before a new attempt. No blind replay.

After a successful installation, removing the guard is not normal recovery.
Business commits in either canonical ledger are not undone by installer rollback.
No deletion, unbilling, claim cancellation or source rebilling is authorized.
Native acceptance: both lock order schedules, RLS-hidden claim, owner/ACL drift,
repeatable-read rejection, SSI40001, lock timeout/cancel, unknown COMMIT and
post-restart exact catalog/readback. All remain NOT_RUN_NOT_PASS for Platform.
