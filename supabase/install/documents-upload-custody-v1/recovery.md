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

## QFW-DOCS15-01 successor — explicit fresh-time source boundary

The legacy permission wrapper is STABLE and its downstream temporal chain reads
statement_timestamp. Calling that wrapper again inside the same RPC cannot renew
Context/member/role/entitlement validity. A current session or custody/C03 TTL alone
is insufficient. This is a source-derived schedule finding, not a native exploit
or a general C03 bypass.

After custody/advisory row waits, after the C03 receipt row wait and again after
possible custody/unique/trigger write waits, the RPC samples clock_timestamp and
passes that SAME fresh instant to the accepted canonical session check, explicit
Context/Workspace resolver and permission evaluator `_at_v1`. Tenant/member must
still equal the original resolved scope. No client time/provider/callback is used.
Final custody and actual locked C03 expiry are checked at that final instant; no
expiry or historical command/authority/key/IDs/wire/hash is updated or extended.
The existing table and immutable trigger definitions are byte-identical. The
runtime RLS wrapper is not treated as an after-lock authorization checkpoint; C03
and consumer checkpoints remain independently responsible for their own scopes.

New install binding fields for the13 canonical helper closure signatures:
`fresh_helper_owner_oid` and `fresh_helper_acl_sha256`. The latter is SHA256 of
UTF8 canonical jsonb text of sorted [grantor,grantee,privilege_type,is_grantable]
ACL rows from aclexplode(coalesce(proacl,acldefault('f',proowner))); ordering uses
those same four columns. Read these from admitted Platform metadata; never infer
owners from a role name or invent values. Fixed canonical prosrc hashes/security/
volatility/search_path are in custody-fresh-time-20/helper-pins.json. Preflight
requires the exact existing13 bodies/owners/ACLs; no helper is installed/replaced.
Only two fresh-time ENTRY functions get EXECUTE for the dedicated custodian.
No PUBLIC, managed Auth or transitive-helper grant is introduced. Postverify removes
only those two exact new-grantee entries when comparing the protected preimage;
extra grant-option or unrelated ACL/owner/body drift stops the packet.

Same atomic installer transaction/deadlines, exact target binding and recovery
rules remain. Fresh install source is a complete successor, not replay-all over an
already populated/installed target. For any installed prior custody version,
Platform needs an explicit additive/replace-function adoption with exact before
body/ACL metadata; do not apply a fresh CREATE ROLE/TABLE image to it. A failure
ROLLBACK of this install is distinct from recovery of committed business data.
Native two-connection lock/expiry and exact owner/ACL/RLS/closure installation are
NOT_RUN_NOT_PASS and still need their own reviewed admission. CE010 WIP is separate.
