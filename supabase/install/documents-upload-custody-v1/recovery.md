# Documents canonical prepared custody v1 — inactive install/recovery

No SQL/parser/PG/Auth/Storage call or install ran in this delivery. Platform alone
admits the owned development target/actual custodian/window/backup, exact helper
identities and effective role graph. Source acceptance is not execution authority.

Composition: BEGIN; SET LOCAL search_path=pg_catalog; lock_timeout=5s;
statement_timeout=30s; preflight.sql; install.sql; verify.sql; COMMIT.
One transaction, never commit role/bootstrap independently. Use an actual admitted
lifecycle custodian (preflight checks actual rolsuper), never assume a role name,
promote ordinary installer, modify provider roles or weaken guard300. Missing
capability -> STOP / request narrower reviewed delegation, not fallback.
No broad migration replay, table repair, customer_api exposure or runtime selector.

Fixed new role is NOLOGIN/NOINHERIT/no memberships/no bypass, only fixed
schema/helper rights. Temporary CREATE on three fixed schemas is revoked before
verify/COMMIT. Other roles/default ACL/provider owners/PUBLIC Auth ACL stay intact.
FOR SHARE requires effective UPDATE permission on at least a column: new custody
role gets UPDATE(key) on C03 and UPDATE(revision) on epoch for row locking, with
WITH CHECK(false) policies. It gets no ledger INSERT/DELETE/TRUNCATE and cannot
make a successful UPDATE. Existing C03 mutation/receipt/audit/outbox stay untouched.
Platform must verify this ACL/RLS behavior natively; source assertions are not proof.

Preparation data is a canonical Core source, NOT a parallel command engine or
receipt ledger. Before any fresh dispatch it commits the immutable original plan,
wire/hash and a one-time dispatch admission. Lost ACK of admission is UNKNOWN,
never permission to dispatch again: subsequent calls use the original command in
replay-only mode. A missing receipt holds the original plan, not a replacement.
Receipt reference is retained only after querying the actual matching C03 row.
Stream admission is an atomic row transition before bytes; no automatic release,
expiry renewal, purge, cancel, resend or key/version/authority epoch substitution.
Existing intent writer's maximum15minutes defines initial expires_at; this adds
no general retention/abandonment policy. Expired records stay held for reconciliation.

Recovery reads original custody under current original Context/Workspace/actor
and current C01/session. Resume reconstructs an actual exact-replay issue handle
through Documents adapter + existing host, not JSON. It cannot create/upload an
intent. The consumer may finalize the SAME persisted finalization plan/key/version
through its existing C03 writer after private object verification, including exact
replay when a prior finalization committed. No new IDs on restart or UNKNOWN.
Actual fresh handles have an optional bounded process cache. The cache provides
only the original function object, never DB admission/commit proof. Cross-request
CAS is DB-owned. A cold/evicted handle never streams again; recovery may read the
existing immutable object and reconcile/finalize. Missing object stays UNKNOWN;
there is no implicit reupload or timeout-based reclaim.

Known install failure: require same-backend ROLLBACK CommandComplete + ReadyForQuery
I and independent protected snapshot/residue comparison. Timeout/cancel/connection
loss/unknown COMMIT -> UNKNOWN; no blind rerun. Read-only catalog/receipt recovery
must bind original execution attempt/backend. All-after catalog is not COMMIT ACK.
After committed business use, DROP is not recovery: new reviewed forward delta;
preserve custody, original receipt and data, no destructive general reverse.

Native gates: helper-definition/owner/ACL pins; schema/default/PUBLIC ACL snapshot;
managed Auth/session barriers; FORCE RLS and row-lock privileges; two-connection
prepare/claim races; revoke/expiry after each wait; process restart and immutable
Storage verification; original-plan C03 rollback/lostACK/replay. NOT_RUN_NOT_PASS.
Scanner is not an initial-intent dependency; clean-dependent read/download remains
closed without actual scan/attestation, custody and post-Storage current recheck.
