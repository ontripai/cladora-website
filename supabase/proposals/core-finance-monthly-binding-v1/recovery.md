# Inactive Finance composition checkpoint

Installation order (each unit independently settled):
1. Existing accepted C01/C03/session/authority epoch and fresh-time helper closure,
   exact effective definitions/owners/ACL/RLS checked against source pins and fresh
   private Platform observation. No historical installer replay.
2. Existing Utilities input-v2/origin-integrity source acceptance and installation,
   separately admitted Finance622 schema/domain kernel/capture/bank amendments.
3. This owner-only INVOKER `checkpoint.sql` additive function; preflight first,
   verify body/security/search_path/closed ACL and dependency pins afterward.
4. Consumption-allocation guard proposal, under its original actual owner and
   complete claim visibility. Its installer and recovery are independent.
5. Only after actual role mapping, least-privilege query/profile admission and
   Finance invoice-v2 adoption: owner composition and independent native tests.

This is not an admitted installer actor or target. An actual narrowly privileged
installer must have schema CREATE and access to the exact dependencies; no login,
SET membership, grant option, owner transfer or provider role alteration is assumed.
Runtime needs exactly the existing C03 privilege closure, the five fixed domain
queries/roles documented in the source profile, and EXECUTE/USAGE on this wrapper
and its existing callees. Owner-only DDL does NOT grant a runtime capability.
Platform supplies actual canonical role mapping and tenant/property/period RLS,
including authorized cross-actor submission provenance access. Neither title nor
association_admin/monthly/SERVICE permission is an alias for accounting keys.

Preflight/verify are bounded read-only catalog proposals with 5s/30s local deadlines.
Absence, unexpected overload, source hash, owner, ACL/default ACL, RLS, principal,
server version or target mismatch is STOP. Source pins are not live observations.
No public role grants or automated binding configuration are included.

Failed checkpoint installation: positive ROLLBACK / CommandComplete / ReadyForQuery I
on the same backend proves rollback of that unit only. Timeout/cancel/lost COMMIT
ACK is UNKNOWN; do not repeat CREATE or next unit. Reconcile exact signature/OID,
body hash, owner and ACL in a separately authorized read-only observation, then
classify absent / exact postimage / mismatch. No blind retry or repair-as-applied.
Never remove a checkpoint used by an active consumer as automatic rollback.
C03 business effects already committed remain committed; readback of the original
command is the only permitted recovery here, without rebuilding actor/key/body.

The source factory remains NULL in application runtime. Controlled SDK/PG tests
exercise actual modules and host; SQL compilation/PG/Auth/RLS/install/target tests
are NOT_RUN_NOT_PASS. Real wait/revoke/expiry, same-key concurrency, exact invoice
approval content, role mapping, COMMIT/ReadyForQuery and restart persistence are
Platform/QA gates, not inferred from this packet.
