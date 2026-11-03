# PLATFORM-CORE12-ORDINARY-FIXTURE-SOURCE-11

Status: source candidate delivered; **registry=EMPTY, live=HOLD**. No native result.

Parent: `3d8cc8f757babbb986762318be81b01eed522442`.
Branch: `codex/program-local-runtime-lane-01`.
Core producer: `1eb8b5a1e522a529b39af02e32748756ee04dfec`.

This version adds a closed ordinary-role fixture alongside Source10 and ACL02.
Existing tracked files, including postgres/postgres startup, ACL02, Source10,
Documents profiles, registries and private materializations, remain unchanged.
The executable runner subclasses the existing PurePGLane and its physical Wire;
it reuses container lifecycle, reader, capture, bounded settlement and finalizer.
No second generic provisioner, arbitrary query API or `--exec` was added.

## Fixed actors and setup source

| Actor | Startup | Effect |
| --- | --- | --- |
| Custodian root | postgres / postgres | Fresh-target checks, exact synthetic setup, limited system/PID metadata |
| Custodian target | postgres / core_sqlstate_boundary_proof | One fixed local ACL setup, then close |
| Executor | core12_boundary_executor / core_sqlstate_boundary_proof | Ordinary identity and exact Core witness once |
| Observer | core12_boundary_observer / same database | Read-only baseline; a new physical connection for post-rollback observation |

The inactive setup consists of four exact pinned payloads: roles, standalone
CREATE DATABASE, database ACL, local ACL, in that order. Roles are LOGIN,
NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOINHERIT.
Public database privileges are revoked; only executor CONNECT/TEMPORARY and
observer CONNECT are granted. Public schema privileges are revoked. Executor
has plpgsql USAGE. Setup transactions commit separately; their removal is owned
fixture cleanup, not an asserted rollback of the entire setup chain.

Startup selects the actual user/database/options in the PG v3 startup packet.
Executor's fixed latch is an accidental-execution guard, never authorization.
Application names are compact, versioned and shorter than PostgreSQL's limit;
the full run/attempt/CID/request/connection binding is in the durable journal.
Identity checks reject privilege flags, unexpected membership/default function
ACL, wrong database/role/session/version/latch and inappropriate read-only state.

The ordinary actors never call pg_control_system. No broad grant or SECURITY
DEFINER wrapper is created. The custodian observes system_identifier and actual
pg_stat_activity PID/datid/user/application/backend_start/client identity in the
same inspected owned CID. Actual ordinary BackendKeyData PID, observed database
OID, startup application and custodian observation must all agree. Missing,
extra, mismatched or foreign sessions fail closed; request data is not proof.

## Baseline, witness and evidence

An independent READ ONLY repeatable-read observer snapshot is durably recorded
after setup and before witness dispatch. Its immutable protected hash covers
complete metadata aggregates for roles (without password), memberships,
namespaces, functions, default ACL, relation/column/type/language metadata,
database ACL and dependencies. Candidate output cannot replace the baseline.
The same exact source runs on a fresh observer after an acknowledged rollback.
The observer must have a different PID from executor and the same actual
CID/database OID/system identifier/version. Partial snapshots, nonzero witness
objects or protected hash drift fail. No automatic temp-namespace exclusion is
used. Native behavior of internal catalog/temp namespaces remains untested;
drift must be investigated, not hidden or accepted automatically.

Core witness stays 20744 bytes, SHA256
`07072fdae234825786709260befa0b2c5337b0379ce852f072fdbfb9d17a9158`.
It is sent in exactly one SimpleQuery frame of 20750 bytes. Partial OS writes
do not split or render SQL. The specialization rechecks custody/current review
after waits and immediately before each write. No retry or second witness is
allowed. The existing per-connection raw limit is 1MiB/4096 frames; startup,
witness and observer deadlines and bounded cleanup remain unchanged.

The existing reader owns the physical stream; ACK requires durable raw capture,
same backend PID, final CommandComplete ROLLBACK and ReadyForQuery I, without
SQL errors. The fixed witness also requires the final DO/ROLLBACK tag pair.
Operation journals add ordered hash-bound request/actor/payload/frame evidence;
they do not substitute model data for raw wire evidence. Cancellation secrets
are discarded by the unchanged reader. No XID is guessed.

Unknown/quarantined streams are never replayed or sent rollback. Recovery can
only settle a known same-stream T/E transaction and perform bounded read-only
observation of the already owned fixture. A skipped rollback is not an ACK.
Frontend Terminate is only a bounded close, never rollback evidence. Close and
receipt failures preserve the first error and still reach owned-resource cleanup.
The unchanged finalizer accounts for each owned container and image; partial,
missing, duplicate, failed or unknown cleanup cannot produce exit zero. A
pre-existing image's permitted skip is not container-deletion evidence.

## Admission and custody

The separate versioned request/profile and 17-file executable/source seal are
listed in `PLATFORM-CORE12-ORDINARY-FIXTURE-SOURCE-11.manifest.json`. Seal excludes
request, registry and manifest to avoid self-hash cycles; each is independently
identified in delivery evidence. Witness bytes are checked independently.

The fixed CLI accepts only its two defined modes, not arbitrary SQL/path/exec
selection. Its witness source path supplies bytes only and must match the exact
Core hash. Before allocation, admission requires a separate curated registry
record matching request/source/profile/producer/scope, an unexpired review and
the exact fresh private run directory. A one-use claim and in-memory initial
grant are bound to run/attempt, then to one live inspected CID. A typed shell
object or approved:true cannot manufacture that grant. Future activation is a
separate reviewed change; no registry entry, approval or runtime identity exists
in this delivery. Target, executor, observer, authority and execution binding
remain NULL.

## Offline evidence and limits

21 source tests were initially completed across scoped runs; one additional
cleanup/persistence interaction test brought coverage to **22 distinct tests**.
The final orchestration changes reran only affected admission/cleanup controls.
Coverage includes startup actor/latch, default-profile byte compatibility,
exact one-frame/partial-write behavior, privilege/foreign-target rejection,
wrong or missing terminal/PID/idle ACK, canned protocol EOF/malformed frames,
custodian correlation, partial/nonzero observer, immutable baseline,
source/profile/payload drift, self-declared owner rejection and incomplete
cleanup/error-receipt preservation. Test protocols, identities and receipts are
explicit mock inputs, not native provenance or 176-case results.

One preliminary invariant test matched a forbidden name in a SQL comment; the
check was corrected to inspect non-comment source text. One scoped invocation
used the wrong unittest class name; corrected invocation passed. Both logs are
preserved privately. No product assertion, witness, guard or capture limit was
weakened. No old accepted suite, provision, health or inspector09 was replayed.
Python syntax, JSON integrity, exact request reconstruction, new source-only
inspection and byte preservation are separately checked. SQL was read as bytes
only: no SQL parser, compile, query, PG, Docker, Auth, install, grant, activation
or native case ran. Query verification suggested by database skills is deferred
under this task's explicit source-only boundary.

Open gates: independent review of this exact source/admission; explicit scoped
one-use execution authorization; fresh Docker/image/custody checks; actual setup
and ordinary-role catalog privileges; real startup/PID/system correlation; actual
baseline, 176 planned calls, rollback/idle ACK, observer residue and cleanup.
Native semantic claims remain NOT_RUN_NOT_PASS. This synthetic exception-clause
proof does not establish canonical authorization, genuine SSI, hosted/staging,
S3/S4/G2, domain installation or Auth readiness. Historical slots stay BLOCKED.

Automation classification: **نیازمند بررسی**. Input is the pinned Core witness
and this versioned request; hash/pin/admission checks are automatable. Coordinator
reviews source and the owner authorizes a specific one-use execution. Conditions
are exact pins, fresh owned fixture and current custody; drift/UNKNOWN is referred
to Platform/coordinator without retry. Formal dependency is reviewed Core12 source
and this source delivery; value is repeatable evidence, with no invented estimate.
