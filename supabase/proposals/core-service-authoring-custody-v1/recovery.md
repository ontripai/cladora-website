# Platform adoption and recovery contract17

No SQL has run. delta.sql is a guarded executable function/table proposal, not an
admitted target installer. Keep55000 guard and ROLLBACK. Platform owns a future
exact hashed send-image/owner/role/default-ACL/RLS/install admission. No caller may
select SQL/schema/role/target. Runtime binding remains NULL until that admission.

Required closure: existing canonical auth.uid/jwt, locked current session,
canonical authority epoch, resolver and services.catalog.manage/publish evaluator;
existing platform/platform_dev schemas, PG17 SHA256 and same accepted backend
marker/OID/name. Public Auth ACL/owner/evaluator and customer_api stay unchanged.
Use a dedicated non-login/non-superuser/non-BYPASSRLS custodian. Give only exact
function EXECUTE and necessary source row-lock/SELECT column privileges (never a
superuser or shared outbox grant). FORCE RLS metadata policies must bind the real
actor/tenant/Context/Workspace from the existing resolver/GUC envelope; do not infer
that a policy-less table is install-ready. Only tenant/key existence SELECT on existing C03 is needed to reject an old key
without custody; no receipt payload or C03 write grant. No UPDATE/DELETE of custody, no receipt/
domain/audit/outbox grants. No exposure of the table to authenticated/PUBLIC.
The profile/runtime-grantor/owner exact names and effective role graph require
Platform evidence and remain unbound here, not fabricated into this proposal.

Order: fresh target/principal/ACL/defaults protected snapshot; preflight source and
collision/hash check; single reviewed atomic adoption transaction; owner transfer
with prior role options exactly restored; verify exact definitions/ACL/RLS and
protected metadata; positive same-backend COMMIT + ReadyForQuery receipt before
calling this installed. Unknown COMMIT/cancel/timeout -> UNKNOWN, stop, no blind
retry, no new key/IDs. A known failed installation may ROLLBACK on the same backend
and compare residue. A committed installation with custody/business data cannot be
recovered by DROP/replay-all or deleting rows. Use a reviewed forward correction.

Runtime custody is durable BEFORE business dispatch. On missing RPC, malformed/
expired row, drift, missing ACK or unavailable source: no replacement and no
business fallback. A read-only recovery of exact key is admitted only under current
verified original actor/session/scope and independent current canonical authority;
it cannot erase or replace unresolved custody. The function returns the original
wire, never updates old authority/version/IDs. Real public retention/abandonment is
not decided: this source is technical-test-only, unresolved rows are held, no TTL,
purge/cancel/automatic migration. expired non-NULL is denied, not recreated.

The original C03 host still compares command.authority_version to current epoch.
If it rejects an old original command after an unrelated epoch bump, hold/denial
is safe; this custody adapter does not rewrite it to pass. Allowing recovery under
a separately current observation needs a reviewed C03 dual-binding ABI; it is not
silently enabled here. Keep QFW closure and full SERVICE-C03 native proof distinct.

## Same-root post-wait source correction (not a new independent finding)

The two former legacy wrapper calls (Core22 delta.sql74/90) shared the
QFW-DOCS15-01 temporal cause. After advisory/custody row waits and after INSERT or
other effective wait before the return, the RPC now samples a server instant,
re-resolves the same tenant/member through canonical `_at_v1` and checks the whole
canonical permission chain with that instant, as well as the current session.
The final actual metadata expiry uses that instant. Original stored record_wire,
public fingerprint, actor/authority tuple/IDs/key and retention policy are unchanged.
Neither new current authority nor clock causes a replacement command or TTL.

Preflight/verify require the same13 exact canonical helper prosrc bodies and
security/search_path/volatility, plus observed owner OID and normalized ACL hashes
from `cladora.service.authoring_custody_binding` under fresh_helper_owner_oid and
fresh_helper_acl_sha256. Canonical ACL hash encoding is documented in the sibling
Documents recovery contract. This proposal still selects no installer/custodian,
grantor or positive runtime privilege. Platform's future specific role grant needs
an explicit before/after ACL delta, not replacing protected preimage hashes.
The55000 source-adoption guard and final ROLLBACK remain. No SQL/parser/native
execution or separate bypass/C03 effect has been demonstrated.
