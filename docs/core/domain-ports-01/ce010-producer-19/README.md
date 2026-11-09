# Independent CE010 request-local producer — source handoff23

Implementation parent7e80988a99a9bfc02214db87a01ac6821ce8dc13. This completes the
preserved CE19 WIP as a separate source handoff after higher-priority20/21/22.
Consumer989e35a78363908357f65460011492e0472dc047 is read from its exact Git source;
Parent284a4640b8f4eaed919f7ba69c881673fbeb26bf, Treef08fa1e403a706a1f25cc928c725e1ea89b5352e.
No CE runtime/handler/provider file or its NULL default is changed/copied into Core.
No SQL, native Auth/DB, role/grant, installation or activation has run.

## Consumption and capabilities

`createCoreCe010RequestRuntimeV1({runtime_pool,target,connection_model})` from
src/lib/core/ce010-request-binding-v1.ts returns the runtime-compatible resolve.
CE may explicitly pass that object to its actual createAnnouncementHandlersV1.
No env discovery, registration or automatic route cutover exists. The same original
Request and canonical selected Context/Workspace produce ce010-request-binding.v1,
verified actor/SID and a request-only pool. POST's full command is projected to its
two scope fields; CE's own strict command validation is not changed. JSON scope is
a selection, never proof. An original binding cannot move to another actor/session.

Core's official request Auth client verifies getUser plus signed claims at resolve,
each connect and BEGIN: same actor/SID, authenticated, actual AAL2 and exp. Invalid/
AAL1 aborts before checkout. Every physical checkout checks actual PG17 target
OID/name/marker, principal and nonprivileged flags against the private owned-dev
target. Guide/SERVICE/authenticator/service_role are not fallback principals.

The existing fixed-role-pool primitive gets a separate CE010 profile, with fixed
source-proposed role names cladora_ce010_runtime / cladora_ce010_executor. BEGIN
carries verified claims/SID/exp and selected scope transaction-locally; the canonical
session barrier, epoch and fresh-time Context/permission gates run before product
queries and after waits. Canonical resolver tenant/member overwrite claim hints;
caller time, user_metadata, allow or grant assertions are not accepted. Backend PID
and real server expiry are checked. GET needs community.community.read, not publish.
POST requires community.announcement.publish; module community_basic and entitlement
module.community_basic are fixed. Publish authorization is not inferred from login.

Alias cleanup occurs after RESET ALL and locally before safety lease. The request
binding destroys every physical lease on release (including clean read ROLLBACK),
rather than relying on asynchronous scrub to return it to the pool. This has a
capacity cost for Platform to measure. Scope use after settlement/release, duplicate
BEGIN and concurrent same-request checkout fail closed. Abort, pending backend
error/end or unhealthy cleanup poison/destroy the lease; first error and the exact
40001 survive. The existing C03 engine owns bounded retry, effect, receipt, audit,
outbox and UNKNOWN. No command identity is prepared or rewritten by this producer.

## Query and role admission

ce010-query-profile-v1.json is a fixed31-query closure derived from the actual CE
handler/provider and existing Core C03/canonical-provider inventory. One dynamic
workspace query is explicitly expanded for the ordinary C03 execute/replay path;
terminal/CE012 and jurisdiction-artifact branches are excluded. Unknown SQL,
query objects, wrong argument counts, foreign scope, ledger actor/key/tenant or
GET DML/COMMIT are rejected before wire. This is a trusted server boundary, not a
sandbox for malicious server code. Query presence is not a grant or RLS proof.

The new profile's TWO safety helper functions do NOT exist by inference. Their
required ABI and semantics are in profile-contract.json; their implementation,
owner/ACL pins, target role graph and install/adoption are still Platform gates.
No stub true function, Guide helper/profile or generic grant is substituted.
Missing/false/malformed safety stops checkout before product SQL. Source factory
and controlled coupling are delivered; native producer activation is NOT_READY.

## Evidence and limits

14 new targeted producer groups use actual CE989 HTTP/provider, real Core factory,
C01/C03 and modeled SDK/PG only. They cover read with publish denied, real command
and same-key replay one effect, lost COMMIT/UNKNOWN same-wire recovery, three
serialization rollback attempts, AAL1/Auth/target errors before checkout, postwait
revoke/expiry, wrong scope/entitlement, abort/SID drift, unknown SQL/GET DML,
postsettlement reuse, original error/cleanup, async backend first-error and unchanged
Guide/SERVICE profile behavior. Old CE23 and Core17/13/12 suites were not executed;
only their fixture definitions were reused. Existing synthetic fixture rows are not
native data or a new registration. Role-safety booleans are modeled primitive
responses, not evidence of a real installed role graph/helper implementation.

Full existing ES5 typecheck, focused lint/syntax/diff, typed assignment to the ACTUAL
CE989 runtime interface (virtual compiler input, zero owner files written), and real
scratch apply/reverse are recorded in the delivery. Source compatibility is not
install admission. Platform must review exact privilege/helper closure, owner/RLS,
actual expiry/concurrency/40001/UNKNOWN/restart and capacity before any execution.
Documents clock20 awaits QA;22 revise policy and all other work remain independent.
Automation: نیازمند بررسی؛ source/type/query checks can be automated, native role/
helper/install and business acceptance require Platform/Coordinator/QA.
