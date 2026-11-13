# Same-card Core capture and postwriter S01 seam25

Parent: d17d52e14be5eda7153083aceb1781e48ca840fd. Same branch/card; no runtime
registration, permit, owner SQL, target or helper installation change.

## Actual source ABI

createCoreFunctionalCommandRuntimeV1({...serverOptions,offering:null,agreement_family:'revise'})
now returns reviseSource: the EXACT Core-owned source port/capture used internally
by runtime.host.execute's canonical resolveAuthority. This is not a newly supplied
allow/callback. Other families return reviseSource=NULL; their host/readers keep
existing behavior. SERVICE's existing createServiceOfferingReviseProvidersV1 can
receive runtime.reviseSource and the actual SERVICE writer. The default a988
createServiceOfferingCoreReviseProviderV1 still creates its own capture and must
not be presented as adopted; SERVICE owns its factory/composition update.

Core source contract remains core-service-revise-source-port.v1 with an additive
method requireCurrentAgreementAfterWriterWaitV1(scope,originalCommand):Promise<void>.
It requires the same official capture, exact actor/Context/Workspace/transaction/
command/aggregate/authority and exact source identity metadata previously validated
on that SAME scope by readCurrentOfferingRevisionForAuthoringV1. The WeakMap stores
comparison metadata only, never an allow. Copied/uncaptured scope or changed command
identity cannot invoke it. No external time, authority result, provider callback or
cached S01 response is accepted. It creates no query capability, receipt or command.

After writer wait, call this method on the ORIGINAL live C03 scope before treating
the writer result as accepted. It calls the existing canonical S01 authoring reader
for the same agreement/version/party/tenant/Workspace and service.offering.revise.
That reader owns canonical session/current-authority evaluation, source row locks,
final DB time and UTC operational start-inclusive/end-exclusive policy. Denial,
revocation, expiry or mismatch throws a redacted failure; exact40001 propagates to
existing C03. The method returns void, not an authority/settlement receipt.

It deliberately does not re-read the old Offering head: a successful revise has
already advanced that head. New terms validation and exact body/hash/result remain
in SERVICE and the Core24 closed candidate. Nothing changes old commercial window
policy or Request/read/publish behavior. No historical command/key/authority/TTL is
rewritten. No new SQL helper/body/permission or transaction host is introduced.

## Consumption and remaining terminal boundary

The test uses ACTUAL SERVICEa988 provider/SQL writer with runtime.reviseSource and
a transparent test-only writer adapter that awaits the Core method after real
writer invocation on controlled transport. That adapter is NOT installed product
code and does not modify the owner source. SERVICE must adopt the seam in its
combined143+a988 successor; the exact final loaded source needs coupling/pins.

A postwriter check is NOT automatically the last host wait. Later C03 audit/outbox/
receipt/clock/settlement waits require the relevant premise to be renewed by the
official host/composition; no claim of authority through COMMIT/ACK is made here.
Replay's scope has no prior old-head source validation; this new writer-only method
must not be used to re-create it from JSON or re-read an obsolete old head. A proper
replay checkpoint must bind the matched canonical C03 receipt/original command in
the existing host. That internal replay/final-settlement coupling stays OPEN with
Core/SERVICE until the real combined consumer is available; no arbitrary callback,
receipt JSON, new authority engine or CE terminal-profile substitution is allowed.

Operation admission, permit and public runtime remain NULL. Source24 review and
its findings are historical and unchanged: shared-capture Core seam is now supplied,
consumer adoption is pending; postwriter primitive is supplied, full final-wait/
replay closure remains pending; SERVICE partial-NULL constraint and combined source,
Platform owner/ACL/RLS/role/lease/lock/native/install checks remain pending.

## Evidence / verify / recovery

Six new affected groups use actual Core runtime/source/S01 + SERVICEa988 provider
and writer on modeled SDK/PG transport: shared-capture positive; writer wait crosses
UTC expiry denial without old-head read; revoke/current permission/session denial;
Context/actor/agreement/command drift; exact40001 to bounded existing host rollback;
and uncaptured scope before any query. Modeled writer result/effect is not SQL
execution, native durable persistence or PG rollback evidence. No old13 or other
accepted suite ran. Full existing ES5, scoped lint/syntax/diff and scratch apply/
reverse are recorded in the manifest/external delivery.

No target installation is needed for this TypeScript seam alone. Before any native
use, pin the combined SERVICE consumer, adopt closed Core24 queries and terminal
checkpoint, and verify actual helper/role/ACL/RLS closure under Platform authority.
If consumer identity/source drifts or a checkpoint fails: stop the existing C03
attempt, preserve first error/40001/UNKNOWN and let the existing host settle it.
Do not repair by new key, extend TTL or reinstall historical SQL. Earlier valid
receipts and all CE/20/21 artifacts remain unchanged.

Automation: نیازمند بررسی؛ typed coupling and unchanged-source checks are
repeatable; semantic terminal/replay admission and native proof need owner review.
