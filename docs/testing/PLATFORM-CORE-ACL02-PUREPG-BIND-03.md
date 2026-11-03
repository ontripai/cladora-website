# ACL02 pure-PG binding source handoff

Status: SOURCE_READY_FOR_EXACT_COORDINATOR_REVIEW; CORE_SQL_NOT_RUN.
Parent: `10b840b023d62fd59ba265cd3fea6d325066fe70`.
Producer: `3cbfc877e5334c5189778b2003e308e3dddf0b2e`.
Assignment: <https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573617800>.

## Exact source and target

The separate `runtime-pg-only-acl02-v1.json` profile uses the already reviewed
PG image. It has one fresh PG17 container, network=none, only loopback, no ports,
binds, named volumes, Auth, provider keys or host credentials. Rootfs is read-only,
UID/GID999, cap-drop ALL/no-new-privileges. Three bounded tmpfs destinations supply
only PGDATA/socket/tmp. Existing PG/Auth profile and historical receipts are
byte-preserved; this does not remove Auth from an existing fixture.

The dedicated immutable producer directory holds exactly request.json,
witness.sql and verify-clean.sql, byte-identical to the producer. The original
request's false authorization and NULL bindings remain unchanged. The separate
`acl02-pg-only.envelope.json` binds producer, exact payload order and executable
source seal. No request-provided SQL, shell, import, path, target URL or `--exec`
is accepted. catalog-projection.sql, app/native installers and Auth are excluded.
The runner's CLI envelope path identifies structured input only; it never selects
executable code or SQL.

## Concrete entry points

Provision-only (no consumer):

```sh
python scripts/run-acl02-pg-only.py --run-directory <fresh-private-run-directory>
```

Future consumer invocation, only after the exact coordinator binding is reviewed:

```sh
python scripts/run-acl02-pg-only.py --run-directory <fresh-private-run-directory> \
  --consumer-envelope supabase/local-profiles/acl02-pg-only.envelope.json
```

The delivered curated registry `acl02-pg-only-reviews.json` is EMPTY. The latter
command returns HOLD/exit2 before directory allocation or Docker. No delivery
file, approved flag, user-supplied review URL or environment variable authorizes
execution. Future activation requires an explicit code-reviewed curated record
matching the exact raw envelope, producer and full seal. The review-record digest
is retained and rechecked too. The invocation must then be coordinator-issued;
this source handoff is not a witness invocation. A fresh UUID run and attempt,
exclusive write-ahead provision claim and separate exclusive consumer claim
prevent reuse of an existing run/directory/attempt, including interrupted calls.
This is a per-run claim, not a distributed cross-Seat execution lease.

## Physical connection and evidence

`acl02_pg_wire.py` is a real PostgreSQL v3 helper using only Python stdlib. Its
fixed Docker exec relay runs Bash/cat inside the owned pinned PG container as
UID999. `/dev/tcp/127.0.0.1/5432` stays in network=none; there is no host TCP
listener, mount or external endpoint. No psql marker/exit status is used as
transaction proof. The relay is bounded/closed (forced if necessary); destruction
of the exact owned container separately settles all of its child processes.
Python optimized mode is rejected before allocation, so inspection assertions
cannot be disabled with `-O`/PYTHONOPTIMIZE.

Startup AuthenticationOk/BackendKeyData/ReadyForQuery and a fixed identity query
bind the actual backend PID, database/OID, system_identifier, PG version and
current/session user. The backend cancellation secret is discarded, never logged.
Run/attempt/CID/phase accompany every received frame. Ordered private evidence
contains frame bytes (except that discarded secret), sequence and SHA256 chain;
CommandComplete/ReadyForQuery are interpreted only after a flushed/fsynced record.
Captured ACK and chain references are also persisted in the private receipt.
Same-backend means one physical stream with no reconnect/retry. Identity is not
inferred from an adapter-supplied constant. XID is observed by the identity query
before the witness; no post-DDL XID observation or continuity claim is invented.

The adapter sends the exact witness bytes as one simple-query message. It requires
actual final CommandComplete ROLLBACK, ReadyForQuery=I, no outer ErrorResponse and
the exact assertion result/case IDs/PID. Only then is normal witness success
recorded. Expected 42501 denials are caught by the unchanged producer SQL.

A second physical connection stays independent while the installer connection
remains open. Its actual PID must differ and system/database identity must match.
It sends the exact verify-clean bytes, requires native final ROLLBACK/idle ACK,
exact typed zero roles/schemas counts and correct phase/database/PID/version.
Missing, nonzero, malformed or interrupted evidence is never residue success.

## Effect gates, failure and cleanup

The source seal covers both reused runner/admission code and every new executable
adapter/observer/runner, profile and immutable producer byte input. It has no
self-hash loop. Core files themselves are not edited. Profile and source are
checked before provisioning effects, and review admission/CID/config/run are
checked again before each physical connection or query dispatch. Adapter choice
is fixed in source; there is no callback/module registry supplied by the envelope.

One image acquisition/create(--pull=never)/start/initdb/server maximum per run;
health polling is bounded. Container inspection occurs before start and live,
with fixed CID/label/name/image/network/resources/tmpfs/argv. Children use no
workload egress. Caller-supplied run/CID/database identity is never used.

Startup deadline35s; identity5s; witness30s; observer15s; known-backend settlement5s;
relay close2s; Docker command/each cleanup20s; pull180s; health65s. Wire capture
hard-stops at1MiB/4096frames per connection (including identity and all phases on
that connection), rejecting oversized framing before allocation. This is a
fail-closed bound for this synthetic witness, not proof of arbitrary catalog
capture bounds or streaming quota readiness.

First error stops normal progression and remains primary. A completed
ErrorResponse is drained, within deadline, to native ReadyForQuery on the known
stream. Only known T/E permits explicit bounded same-stream ROLLBACK settlement;
unknown stream/PID, capture fsync failure, timeout or disconnect quarantines it
and forbids rollback/replay. No transaction state/XID is guessed. Observer after
error is possible only with independently acknowledged rollback, and does not
convert that failed witness to PASS. Observer not safely run is explicit NOT_RUN;
its residue remains UNKNOWN. Missing acknowledgement is not proof of an open
transaction. Safe closure/destruction still proceeds and cannot prove residue.

The shared lifecycle closeout has an explicit `pg_only=True` contract (one PG,
one image), retaining the existing PG/Auth default contract. Health is distinct
from lifecycle. Every owned container and newly acquired image must have exact
identity/acknowledged absence; pre-existing image skip is allowed only as such.
Unknown/incomplete/failed cleanup or consumer error produces nonzero exit.
Health and first error are retained. Private artifacts remain mode0600 in a
fresh mode0700 directory; raw logs/capture/identities stay private for30days.

## Validation and boundaries

19 focused new tests passed (initial14, four added failure/CLI cases and one shared-hook interaction). Protocol
replay and mocked adapter traversal are offline evidence only. Covered: PG/Auth
mismatch; every sealed input altered; source/profile/observer and review changes;
request-driven exec/SQL/approval rejection; rollback versus marker/idle; error
drain/known-stream settlement; missing/nonzero/wrong-database observer; disconnect,
oversized frames, persistence failure; ordered hash-chain/secret exclusion;
claim reuse; CLI admission before allocation; actual CLI/receipt lifecycle success,
unknown/missing cleanup and joint health/cleanup failure; optimized Python rejection.
The old26/7tests and previous PG/Auth health were not replayed.

A separate first PG-only provision/health/isolation/cleanup run succeeded. The
fixed native helper obtained real PG17 identity and observed absence of Auth and
application namespaces in this fresh fixture. All resources acquired by that run
were acknowledged removed. The final source also replaces static hook aliases with dynamic wrappers to preserve
shared-runner binding lookup semantics; that interaction passed a targeted offline
test. The provision receipt is historical proof of the unchanged profile/native
helper, not a fresh health result for this last wrapper edit. Its exact executed
source snapshot/seal is retained privately, separate from the final handoff seal.
Full receipt/CID/system identity/raw frames are private;
none are published as source evidence. This does not execute or accept Core SQL.
Witness, Core observer/residue, native/domain install, staging/Production,
Auth/session/email and application acceptance remain NOT_RUN.

Coordinator must review the final source/profile/envelope seal before admitting
this consumer. A witness success later would prove synthetic ACL semantics only,
not native privilege bypass or hosted/application readiness. No Core/S01 source,
staging controller, native300 or consumed historical requests were modified.
