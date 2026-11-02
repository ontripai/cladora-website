# V14-CORE-01 / AIRPROP-READ-HOST-MINIMUM-08

Base/direct parent: `ef69fa82e19ab269701d6df9abd7bdfd67e3e50e`.
Consumer: `2981ec440e5978724c8da373800e9b1913f63905`,
`src/lib/airprop/listing-native-read-v1.ts` and its proof request.
Status: inactive source for independent review; runtime binding NULL.
This is the minimum Core host component, not a completed canonical Listing read.

## Core-owned versioned ABI

`createCoreAirpropReadHostV1({pool, principal})` returns
`core-airprop-read-host.v1`, with:

```
withScope<T>(actorId, requested, read): Promise<{value: T; completed_at: string}>
```

The callback receives the existing `CoreTransactionScopeV1` and a frozen server
object containing ONLY actor/tenant/Context/Workspace. The AIRPROP-proposed
interface is structurally compatible, independently typechecked against its exact
Git source; this newly documented Core ABI does not accept its proposal as blanket
approval of privilege/currentness/native behavior.

The supplied `pg` Pool connect/query/release port is the same transport used by
Core's existing command host. This module constructs no pool, connection string,
role, credential, server or alternate authority store. It creates no C03 command,
reservation, audit, outbox or domain write. It does not invoke the command host.
The logical scope transaction UUID identifies this read only; it is NOT a command
ID, command reservation, aggregate lock or authority receipt. Attempt is1, with
no retry engine. A later call creates a distinct scope and physical checkout.

ActorId is a comparison precondition, never authentication. Auth comes exclusively
from the existing Supabase SSR createClient boundary, actual getUser and verified
getClaims. User and verified sub must agree. Only sub/session_id/exp/aal/role are
projected from verified claims; user_metadata and client allow/tenant flags are
not read. Non-authenticated/service_role identity is rejected. No injected Auth
callback exists in the product factory; tests substitute the SSR module only in
their controlled loader, not via this ABI. No Auth operation has actually run.

Requested JSON accepts only the selected Context and Workspace IDs. The actual
`app_private.resolve_workspace_native_context_v2` resolves membership/tenant/
Workspace under that authenticated identity. Canonical row locks and fresh guard
revalidate the tuple, current membership/Context intervals, active Workspace,
canonical revision, real session checker and existing permission evaluator:
`airprop.asset.read` / `airprop_commercial`. AAL/MFA policy remains the canonical
resolver/evaluator's decision. There is no synthesized command receipt or new
permission engine. Raw historical claims are not current authority proof.

## Closed callback capability and lifecycle

| Phase | Source behavior |
|---|---|
| Authenticate/checkout | verified SSR user/claims; private supplied pool/profile; no service-role fallback; reject mismatching or directly powerful principal |
| Begin | SERIALIZABLE, lock-capable; no PG READ ONLY. Session deadlines10s statement/5s lock/15s idle also cover post-COMMIT observation. Local search_path=pg_catalog and transaction-local verified request identity |
| Resolve/lock | canonical revision SHARE → official resolver → actual Context/membership/Workspace SHARE → canonical session/evaluator guard |
| Callback | frozen one-attempt scope and server binding. Only exact accepted AIRPROP page SQL/hash and exact owner database-clock SQL/hash; page parameters tenant/Workspace-bound, bounded keyset/limit. Arbitrary SELECT/function calls, CTE DML, transaction/GUC control and other SQL rejected before pg |
| Close callback | invalidate scope, drain outstanding admitted queries; a caught query failure still poisons the read. Detach returned values before settlement |
| Final guard | same resolver/session/evaluator, exact revision/tuple/transaction/backend, fresh server time and token/Context/membership temporal bounds after callback waits. No cached allow supplied by callback |
| Commit/observe | require COMMIT tag, not ROLLBACK; await the same checked-out backend's post-COMMIT clock query, verify PID and exact six-digit UTC timestamp/order and remaining observed temporal bound |
| Cleanup/publish | request physical destruction using existing pg release(true), require end observation within budget; no successful result if cleanup fails. Return only after all preceding conditions |

Exact callback SQL hashes are pinned to the consumer module. The consumer's
LISTING_NATIVE_PAGE_SQL performs FOR SHARE; its clock query is separately admitted.
This is closed admission of known read queries, NOT the unsafe assumption that
arbitrary SELECT is side-effect-free. Future canonical producers need separately
reviewed query admission; this slice intentionally cannot run their unknown SQL.
No SQL parser/AST/controller or permissive regex sandbox is introduced.

Scope methods are bound to the original frozen object and live callback only;
rebinding to another attempt/Context/object, mutation, late continuation and
use-after-settlement cannot query. The host withholds its return until settlement;
the callback is trusted server code and must not itself publish/stream private
values. No untrusted plugin/client callback belongs at this boundary.

## ACK, completion clock, failures and duration bounds

The pinned pg8.23.0 Query promise completes from handleReadyForQuery, after result
command parsing. A COMMIT command result through THAT admitted non-pipelined pg
transport is the source contract for positive settlement; SQL text alone is not
an ACK. The same held checkout and PID bind the post-COMMIT SELECT. Custom
wrappers/proxies/pipeline/transaction-poolers that do not preserve this contract
are NOT admitted automatically. Driver/backend/protocol behavior needs native
proof; a synthetic command tag is not that proof.

`completed_at` is the real server clock sample AFTER successful COMMIT/wait, not
transaction-start time, a JS clock, or a receipt timestamp. The exact UTC
microseconds survive unchanged. It is a database-pipeline completion observation,
not the timestamp of socket destruction, client ACK/delivery/display. Cleanup is
awaited after the observation and can suppress the result, not fabricate another
clock. No claim of authority/currentness through that later delay is made.

The post-COMMIT check uses the actual observed minimum of JWT expiry and locked
Context/membership ends, not a minted TTL. This internal bound is NOT the producer's
all-source current_until: managed-session not_after, Offering/resource/relationship,
role/delegation/module expiry, all-writer participation and authority through
settlement require their separate canonical/native contracts. The real session
checker/evaluator is invoked at the final guard. SERIALIZABLE alone proves neither
managed Auth invalidator participation nor revocation freshness outside its snapshot.
A native full read remains NOT_READY rather than silently reducing those gates.

Wire/Auth/checkout/callback duration budgets15s and cleanup5s are failure deadlines
only, never clocks or authorization leases. Actual SQL deadlines are server-local;
pg timeouts, lock contention and cancellation are native proof gates. Timers never
mint completed_at. Timeout does not imply server cancellation/rollback. A late
checkout is destroyed if it eventually arrives; cleanup remains UNKNOWN until
observed, no output is released and no retry is made.

Physical client error events are captured before cleanup and poison the read;
no COMMIT is dispatched after an observed earlier failure.
Original errors, including the same40001 object, escape to the trusted caller.
`coreReadFailureInfoV1(error)` records stage, settlement and secondary cleanup
errors/status without replacing the first error. Do not serialize these private
error objects to clients or publish SQL/claim/credential diagnostics.

- Before COMMIT, positive same-driver ROLLBACK can establish rolled_back.
- A failed/lost COMMIT ACK stays unknown even if a later ROLLBACK tag arrives;
  a known40001 abort is distinct. No blind retry/resend is implemented.
- Positive COMMIT followed by clock/correlation/expiry/cleanup failure yields no
  partial value; transaction settlement remains committed, with disclosure denied.
- In-flight timeout destroys the connection rather than queuing blind cleanup
  behind unknown work. Lack of rollback ACK leaves settlement unknown.
- Connection release returning void is not cleanup ACK. An end event is required;
  cleanup errors/timeouts discard all values. This observes transport closure,
  not native residue/custody or proof of every server-side role safety condition.

## Real consumer coupling and unresolved selector

The test loads the actual AIRPROP query/reader from the exact consumer Git objects.
Positive coupling invokes queryListingNativePageV1 through the new Core host;
synthetic Listing rows exercise the real owner query/validator and host lifecycle.
It does NOT provide Unit/spec/party/relationship/label data or full canonical read.
Calling the actual createListingNativeReadV1(host, null) still rejects with
CANONICAL_PRODUCER_NOT_READY before checkout. No fake producer is substituted.

Counterexample: currentUnitPropertySelectorRequestV1Schema requires command_id,
command_aggregate portfolio.unit lock and a real bound authority transaction
receipt. The current selector rejects a genuine read-host scope/request lacking
those fields with BINDING_MISMATCH before SQL. Supplying synthetic fields or
relabeling the read ID as a command is forbidden. Current selector stays unchanged.

Minimum proposed contract delta, NOT implemented/approved here: Core adds a
read-specific selector entry in current-unit-property-selector-v1.ts accepting
an opaque same-live-read-scope canonical authority observation, verified against
its host's identity/attempt/Context/Workspace/tenant/epoch and actual server
checkpoint. It reuses the existing canonical unit/property predicates and physical
SHARE locks, with no command ID/aggregate reservation. The existing command
signature and guards remain intact. The opaque observation must be host-issued,
not JSON or a public allow boolean. Query admission expands only for the reviewed
selector SQL. Core owns this delta; AIRPROP consumes it after separate approval.
Canonical Unit/spec/party/relationship/disclosure/real expiry producer stays a
separate AIRPROP/Core producer dependency; this task implements neither.

## Remaining admission and proof inputs

- Platform: actual AIRPROP read-only-effective principal/role graph, schema USAGE,
  SELECT and managed/canonical EXECUTE, default ACL/RLS, stable physical/session
  checkout and clean end-event lifecycle. Existing CE/SERVICE role-bound profiles
  are evidence of an available transport pattern, not AIRPROP grants/admission.
- Core/coordinator: exact driver/protocol profile, query closure, lock/implicit
  wait/revision ordering and every relevant writer/session invalidator; no native
  currentness assertion from a serializable snapshot or this controlled transport.
- AIRPROP/Core: accepted read selector and real canonical producer, including its
  all-gate expiry/disclosure bound; no proposed dataset/profile assumed approved.
- Runtime bind/admission fields remain NULL; no activation target or run identity
  is invented. Target remains existing staging only under a later explicit grant.

47 new targeted controls PASS; full existing ES5 typecheck, exact consumer ABI
scratch typecheck, limited lint/syntax/pin/inventory checks PASS. Node/Next/Zod/pg
come from the existing unchanged lock. Prior accepted S01/CE/Operations suites
were not rerun. Controlled SSR and pg responses are NOT issued Auth, PostgreSQL,
ACL/RLS, native contention/currentness or hosted-install evidence.

Supabase skill applied for SSR verification/current-session pitfalls; official
getClaims documentation was read via the docs connector. Direct public changelog
fetch was denied403; no alternate egress was attempted for it. User restrictions
override the skill's generic suggestion to run SQL. NOT_RUN: SQL parser/compile/
execute, real Auth/DB/PG/native role/lock/writer proof, install/grant/activation,
Release-wide security suite, merge/deploy/staging/Production. Those gates remain
required before Release, not implied PASS by this source handoff.

Self-automation: نیازمند بررسی؛ input=trusted read intent/canonical scope;
opportunity=bounded read validation and exception routing; human=Core/Platform/
coordinator admission; execution=accepted producer/selector/profile and unchanged
scope/revoke/expiry/idempotency; exception=UNKNOWN/currentness to Core/Platform;
dependency=official AIRPROP read producer/selector/profile; value=unmeasured read
failure/reconciliation time. No automation execution or new acceptance authority.
