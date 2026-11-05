# Task17 / CORS-COMPAT-01 / PORT-ADMISSION-RECOVERY-01

This is an additive SOURCE successor of Platform
`b20d0bf33a01e5f846421d852c7e778aaa26f4e6`, whose parent is guard
`1db6ce6c4095efed9a34dc088cf3b8ef8cbaf805`. It changes no original sealed input,
claim, result, installation, credential, application source or launcher. It is
not another Task/package/branch and never calls the consumed `activate` command.

## Exact compatibility and source

App remains `b696ff211daabd4be3989522c569f24ccccd0dce`, tree
`534ec94f21699a65686bade5539517dfd818ec1e`. Launcher SHA256 remains
`5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092`.
ABI remains `platform17.relay-cors-preflight.v2`; relay source-seal file SHA256
remains `c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02`.
Installed Core remains `ee883b62cf4a318af3450c506931a969623b8987`.

The new independently sealed controller verifies its own exact commit/tree and
closed six-file inventory plus seal before effects. It verifies the App commit,
tree, clean worktree, launcher and closed nine-file relay inventory before
import; the relay verifies its original five and environment filter dependencies.
There is no alternate adapter/path/SQL/shell/target selection or new transport.
The existing exact relay `serve` argv is used once. Consequently the existing
launcher/preflight accepts the actual process without changing its ABI, rewriting
old seals, faking old PID records or relaxing to arbitrary descendants.

## Port admission

Python3.12 listener defaults are checked against the actual stdlib. The immutable
reviewed `serve` sets the PG instance's `allow_reuse_address=True`; HTTP already
has it. Both actual servers are AF_INET/SOCK_STREAM/protocol0, backlog5, with
SO_REUSEADDR=1, and no SO_REUSEPORT. The probe uses the SAME options and calls
both `bind` and `listen`, in actual server order PG55422 then HTTP55421 on
127.0.0.1. It holds all probe sockets together. Every exit, including a collision
on the second port, closes all sockets in reverse order. There is no wildcard,
port substitution or modification to the two exact old and one3008 CORS origins.

The port-release gate has a10second monotonic deadline. Only EADDRINUSE can be
observed again within that bounded readiness wait, at at most100ms intervals;
this is not another create/start/dispatch attempt. Other errors and expiry stop
immediately. An active listener that remains present is rejected. Admission
failure records stage, host, exact failing port and errno, the first obstruction,
the last observation and deadline exhaustion separately. No child is created.
The already-stopped App3008 is also checked by bind/listen before relay admission;
the controller does not signal App or any backend process.

Probe success is only instantaneous admission. Sockets close before Popen; the
inherent handoff race is NOT claimed solved. If another listener wins after the
probe, the actual unchanged relay exits before its two-listener record and there
is NO startup ACK, no replacement child and no retry. The actual child writes its
fsynced process record only after both sockets bind/listen. Acceptance also needs
Popen child still alive, exact child PID/start/argv/source/binding/backend from
the original v2 preflight, the BOTH_FIXED_LOOPBACK_SOCKETS_BOUND marker and another
live-child check. The marker alone or probe success alone is insufficient.

The unchanged child CLI exposes generic error type, not exact failing socket.
For a post-probe child failure the controller truthfully records startup stage
and child exit, with socket host/port/errno UNKNOWN unless the source actually
provides them; it must not infer a port from later availability. The exact port
fields above are guaranteed for admission exceptions, where they are observed.
Changing the child's diagnostic ABI would require separate reviewed source, not
an invented value in this controller. The original real incident remains a
pre-create EADDRINUSE with unknown port/transient cause. This source's real
ephemeral TIME_WAIT counterexample does NOT establish that historical cause.

## Manual continuation and authority boundary

No active native request is created by this packet. The template is intentionally
invalid (NULL pins/run/target); registry/authority/bindings are not fabricated.
Review and exact owner execution authority must precede native continuation.
After that review, an operator creates only the fixed private selector
`relay-cors-v2/port-admission-recovery-v1/request.json`, owned0600 beneath owned
0700 directories. No alias/symlink/hardlink, extra field, approved:true, arbitrary
URL, callback, shell or SQL is accepted. The full request digest is pinned in
that external authorization; possession of a digest is not authority.

The request binds a new32hex run ID, controller commit/tree/seal file SHA256,
the exact App worktree, existing activation-binding digest, exact hashes of the
old claim/result/gateway record, and a current custody-checked backend snapshot.
Its maximum lifetime is600seconds, using the host clock; equality with expiry
is expired. Currentness/request bytes are rechecked throughout admission, after
effects of metadata checks and at creation/startup boundaries. Expiry does not
renew itself or establish an operation's outcome.

Eligibility requires ALL of the following:

* The pinned prior result explicitly says new_start=NOT_RUN,
  old_stop=ACK_PROCESS_ENDED, cleanup=NOT_REQUIRED, and the actual pre-create
  EADDRINUSE first error. UNKNOWN, ATTEMPTED, changed errors or incomplete cleanup
  are not eligible, even if some later port is free.
* Prior claim, original gateway pointer and its archived bytes agree exactly;
  all three hashes are checked, along with old binding/run/backend/source.
* The old relay is absent or its exact recorded PID/start is an ended zombie.
  The current same five-service internal backend and named volumes pass the
  existing custody checks; nothing is provisioned/reinstalled/restarted.
* There is no prior process.json or process.private.log and no live relay_v2.py
  serve child among ALL processes owned by this OS actor. An unreadable owned
  process inventory is UNKNOWN and fails closed; no process is killed by scan.

Before any probe/process effect the controller durably creates one fixed
`continuation.claim.json` with O_EXCL and file/directory fsync. It binds the new
run/request and pinned prior evidence/current backend, separately from the old
activation binding's historical run ID. The old claim/result/pointer/archive
are never deleted, overwritten, reset or relabeled. A changed run/request does
not reopen the one fixed claim. Failure, expiry or missing receipt leaves that
claim consumed. Independent review must approve any subsequent recovery; this
controller has no automated successor or fallback operation.

After exact review and owner execution authority, the only manual entrypoint is:

```
python3 -I -B scripts/functional-dev-relay-port-recovery-v1/recovery.py continue-once EXACT_REVIEWED_REQUEST_SHA256
```

The operand is the NEW continuation request digest, not the old activation-binding
digest. No native request, claim or invocation is produced during source delivery.

Only after actual same-target/source/currentness and no-child checks are repeated
after admission can one Popen launch the exact previously reviewed relay_v2.py
serve argv with the existing activation binding. The child uses the unchanged
original transition claim only for its existing serve/preflight ABI; this new
operation's authority/provenance is the separate manual continuation claim and
receipt. The source does not reinterpret the old failed attempt as success.

## Deadline, first error, custody and cleanup

Startup ACK deadline20s; cleanup of only the actual Popen child10s. A startup
failure/timeout/drift/expiry stops. Cleanup may terminate only that actual child,
never the backend or unrelated resources. If already ended, cleanup is SKIPPED
with observed end, not an attempted termination ACK. Unknown cleanup is explicitly
UNKNOWN with Platform custody and600second follow-up to reconcile that child.
No second child, automatic fallback, database rollback claim or broad session
cleanup is allowed. First error survives cleanup and result persistence failure.
Failure to persist a successful receipt is non-success; the consumed claim stays.
In that case the controller attempts bounded cleanup of its actual child and
retains the persistence error and any cleanup uncertainty in the private
in-process diagnostic. It never retries/overwrites an ambiguously persisted
receipt or interprets an unsynced success-shaped file as authority to continue.

After reviewed native continuation ACK, and only then, the ordinary operator may
run the ORIGINAL preflight and official build/start with the same two v2 selectors
and actual activation-binding digest. This controller does not build/start App,
perform login, issue sessions, send SQL or execute restart. Actual UI/AAL2,
Request/refresh/denial/logout/UNKNOWN/same-command retry/reload recovery and the
new browser Request restart phase still belong to the unchanged Task09 plan.
Task17/08/09 and native acceptance stay OPEN. Prior UI login and historical
Docker restart ACK stay UNKNOWN; private traces/binding/session/receipts stay
private. No SQL/ACL/role/DB/storage change follows from this source.

## Reconstruction and evidence limits

Apply this additive successor ONCE to the exact b20d0bf source; do not stack full
packets or change the App b696ff checkout. Verify the source bundle prerequisite,
commit/tree and independent source-seal file. The public manifest contains exact
source inventory, hashes and test outcomes, no actual request/binding/target IDs,
session, private runtime trace or historical execution receipt.

Tests use real kernel ephemeral loopback sockets for TIME_WAIT/listen/options and
in-memory/mocked subprocesses for continuation faults, source/target drift,
unknown prior state, used claims, post-probe collision and cleanup/persistence.
No actual backend is started/contacted and no SQL/Auth runs. A modelled child ACK
or receipt in tests is not a native execution receipt, Auth proof or product PASS.

Automation: نیازمند بررسی. Input is pinned source and existing private evidence;
mechanical parts are exact hash/port/lineage checks; Coordinator reviews source
and exact future authority, Platform owns one native attempt and UNKNOWN custody;
exceptions return to those owners. Formal dependencies are the reviewed App/v2
ABI and real same-target receipts; value is preventing false ACK/repeated effects,
with no new operational authority or parallel engine.
