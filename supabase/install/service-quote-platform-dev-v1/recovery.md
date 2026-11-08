# SERVICE Quote target packet — recovery / executor boundary

SOURCE ONLY. No part has been executed against the target. This is one additive,
one-shot, missing-object plan, not a replay-all installer or an activation.

The trusted Platform executor must re-admit the owned development target from
its actual connection identity (project/endpoint, database OID, namespace marker,
backend PID and execution receipt); do not accept a browser/caller-selected
schema/role/SQL/target. A GUC claiming a target or role is not authentication.
`cladora.quote.install_binding` is an administrative plan input, not authority.
Its packet_sha256 must be checked by the executor against the transferred SQL
bytes BEFORE sending anything; the SQL itself cannot prove its transport bytes.
Helpers must be pinned to the actual private metadata and independently admitted
canonical source, not hashes of whichever definitions happen to be installed.

Required lifecycle principal: actual authenticated owner/custodian with the
capability checked in preflight (this narrow plan currently requires actual
superuser). This is NOT the ordinary cladora_core_installer or runtime login,
not a role-name assumption, and never a request to promote either. If this
custodian is unavailable, STOP: a differently scoped delegation plan requires
separate review. No managed Auth/provider role is altered. Existing ordinary
installer REFERENCES(auth.users.id) is used only as effective DDL privilege;
it is not assumed to carry grant option. Auth users table/column ACLs are not
changed. Only the new dedicated role receives specified schema USAGE and helper
EXECUTE. Existing PUBLIC Auth function ACLs and consumers are preserved.

Preparation (offline): import the exact private SERVICE bundle using its sole
prerequisite, then use the Core composer. No PG driver, env/credential read or
connection is performed by this composer. It emits a PRIVATE composed SQL image,
a read-only preflight image and a read-only verify image via its exported APIs.
Never publish the generated canonical private input/image as a workaround for
an earlier publication refusal. Default is no execute.

Execution request (NOT AUTHORIZATION; future Platform lane):
1. Confirm source/payload hashes, target, maintenance window and exact recovery
   receipt. Take bounded schema/ACL/dependency snapshots and the existing backup
   reference; no Auth/business rows need be printed. Ensure no competing DDL.
2. Run only generated readonlyPreflight() on the admitted target, bound to the
   expected six helper definition hashes, owner names and ACL hashes; ROLLBACK + same-backend ReadyForQuery I/close ACK.
   It is strict missing-state admission. Existing owner/table/function/policy/
   index collision, wrong owner/RLS, missing C03/provider privilege => STOP.
3. Send the exact composed install as ONE transaction. 5s lock_timeout and 30s
   statement_timeout precede catalog reads. Custodian snapshots then creates the
   one NOLOGIN/NOINHERIT owner; temporary ADMIN+SET, INHERIT FALSE membership and
   CREATE on four fixed schemas are bounded to this transaction. SET LOCAL ROLE
   ordinary installer creates canonical objects; fixed owner creates façades;
   RESET ROLE returns to the actual grantor for cleanup and verification.
4. Require CommandComplete COMMIT and ReadyForQuery I on the SAME backend/attempt
   plus durable response record. Then run generated readonlyVerify() from an
   independent admitted connection, ROLLBACK/I/close ACK. No runtime/positive
   grants, PostgREST exposure change, actor capability or activation is implied.
5. SERVICE separately adopts the fixed platform_dev transport under its owner.
   Only then schedule affected Auth/MFA/RLS/C03/native tests and safe restart
   readback. Reservations are identities, not committed Quote/receipt proof.

Known failure before COMMIT: stop sending subsequent statements; obtain same
backend ROLLBACK/I ACK; independently compare bounded protected snapshot and
absence of all new objects and temporary role edges. An aborted transaction
must not commit bootstrap as a separate stage. Never use DROP/IF EXISTS to hide
collision or grant/ACL repair-as-applied.

Timeout/cancel/disconnect/unknown COMMIT: UNKNOWN, no blind resend or assumption
that interruption rolled back. Reconcile same execution receipt/backend using
read-only identity + catalog snapshots. All-before with confirmed rollback can
be proposed for a new reviewed attempt; all-after requires positive settlement
and full verify. Mixed state/missing ledger/uncertain backend => STOP and owner
review. Catalog shape alone is not COMMIT ACK or business receipt.

After a known committed installation: no automatic destructive reverse. Once
business data exists, removing store/role/functions is not rollback and cannot
undo committed C03 effects. Any correction is a new versioned forward delta;
retain original command identity, historical receipt and current-authority
checks. No retention, TTL purge, cancellation or abandonment policy is added.

Native test lane remains NOT_RUN_NOT_PASS: ordinary installer/ownership transfer,
managed Auth grantor, actual FORCE RLS, two-connection wait/revoke/expiry, same-key
and changed-body concurrency, 40001 identity, lost ACK, effect+receipt+audit/outbox
atomic rollback, restart/readback and exposed-schema routing. Offline source
invariants do not establish any of these.
