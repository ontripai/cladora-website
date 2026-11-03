# PLATFORM-STORAGE-ACL-RECOVERY-RACE-R2

Source/offline successor of `a8ccef2b537f8b3e2b393c16686f41afed64a75a`, on
`codex/program-local-runtime-lane-01`. Reviewer acceptance is pending. This is
not permission to execute the proposed SQL. **Native Storage/Auth/PG: NOT_RUN.**

R1 delivery/history remains at [6610315861](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6610315861).
The existing private catalog, provider review, synthetic-user custody, preflight,
restore13 receipts, five sealed stack files and all prior candidates remain
unchanged. No target inspection/query, Docker operation, ACL mutation, native
fixture/session, dependency installation, Core/Docs edit or image change occurred.

## Finding and preserved counterexample

R1 read `recovery-prestate` and sent `acl-recover` on different Wire instances.
Its recovery SQL guarded physical identity and function definitions, not the
ACL/policy snapshot at the mutation. An independent ACL change after the read
could therefore be followed by recovery before the final observer rejected it.
That was an effect-before-detection defect, **not a false PASS**.

`scripts/test-storage-acl-recovery-r2.py::test_01` loads the exact R1 harness from
the fixed Git base and checks its SHA256
`a32774e9a518fdbdac4af2657b3bdbf206976cbad078a83f74c76dfb82b027d9`.
It calls the original `Run.execute` with modeled SQL/catalog boundaries: one
recovery effect, followed by `EFFECTIVE_ACL_GRANTOR_RECOVERY_MISMATCH` and failure.
The after case calls current `Run.execute` and the actual R2 adapter with a
modeled Wire: the same drift produces **zero recovery-body sends**, an observed
modeled ROLLBACK/idle ACK and failure. This preserves the counterexample; fake
locks/ACKs are not a PostgreSQL concurrency experiment.

## Atomic effect boundary

`recovery.py::AtomicRecovery` uses the existing, unchanged
`scripts/acl02_pg_wire.py::Wire`. It owns no alternative transport. The harness
reconstructs every named SQL material from the closed renderer and verifies its
bytes/hash immediately before use. The old standalone `Run.sql('acl-recover',…)`
and direct begin/body/commit materials through that path are rejected.

On one physical connection, after existing CID/source/review/SDK/tool/target
gates and PostgreSQL identity verification:

| Order | Fixed material | Required durable terminal state | Decision |
| --- | --- | --- | --- |
| 1 | `recovery_begin` | BEGIN, three SETs, LOCK TABLE; ReadyForQuery=T | All catalog locks acquired in one READ COMMITTED transaction |
| 2 | `recovery_state` | SELECT 1; ReadyForQuery=T | Full catalog fingerprint equals independently derived expected prestate |
| 3 | `acl_recover` | Two DO guards, SET, two REVOKEs, seven GRANTs, RESET; ReadyForQuery=T | Existing identity/definition/helper guards plus exact original recovery body; no COMMIT |
| 4 | Same `recovery_state` | SELECT 1; ReadyForQuery=T | Full poststate equals original privileges/options/grantors/owners/metadata, explicit owner-only schema ACL and exactly retained owned policies |
| 5 | `recovery_commit` | CommandComplete=COMMIT and ReadyForQuery=I on that backend | Commit ACK only; independent observer still pending |
| 6 | Existing independent catalog observer | Own verified backend, different PID, same system/database/OID/version | Exact full expected state; no policy stripping, no raw-NULL equivalence silently substituted |

Every response is bound to the initially verified Wire PID. The reader persists
each complete wire frame and fsyncs it before interpreting an ACK. New receipt
entries retain phase/tags/ready/PID, row fingerprints and the wire-chain reference;
the original complete private wire bytes remain primary evidence. No hash-only
replacement or XID guess is introduced.

Prestate is derived from the pinned original plus the exact owned delta, or the
already acknowledged fixture state when owned policies must remain. A fresh
diagnostic snapshot does not become the expected baseline. No approval can be
created by a request flag, GUC, this report or a string identifying a window.

## Locks, waiting and the exclusive window

The fixed `SHARE ROW EXCLUSIVE` barrier locks these catalog relations:

`pg_attribute`, `pg_attrdef`, `pg_authid`, `pg_auth_members`, `pg_class`,
`pg_collation`, `pg_database`, `pg_default_acl`, `pg_enum`, `pg_language`,
`pg_namespace`, `pg_operator`, `pg_policy`, `pg_proc`, `pg_range`, `pg_rewrite`,
`pg_trigger`, `pg_type`.

The first group covers relation/column/schema/function ACLs and owner/definition,
policy, role/membership/default-ACL mutations; the remaining catalogs protect
metadata used by type/signature/default/view/trigger expression rendering.
These are locks and SELECTs, **never direct catalog content edits**. The original
REVOKE/GRANT statements remain the only proposed ACL mutation and use the original
owner grantor through the unchanged local-role body, followed by RESET ROLE.
No owner/role alteration, broad grant or new permission to lock a catalog is added.
If the existing custodian cannot acquire the exact barrier, recovery fails closed.

This intentionally has a wider scheduling impact than locking Storage data
tables: concurrent catalog writers in the database can wait, and role catalogs
are shared cluster-wide. Ordinary catalog readers remain compatible. The
coordinator must reserve an explicit exclusive Storage ACL/DDL cleanup window on
the owned development target, including this catalog/role-writer impact. There
is **no claim that such a window is currently granted or held**. This design must
not be extrapolated to populated staging/Production or managed provider Auth.

The barrier conflicts with PostgreSQL catalog writers' RowExclusive locks,
including uncooperative GRANT/REVOKE writers; it is not merely advisory. It also
serializes another recovery barrier. READ COMMITTED ensures the following SELECT
observes a writer that committed while the barrier waited. Drift before lock
acquisition is rejected before sending the body. A writer arriving after lock
acquisition waits until commit/rollback, so cannot race between the guarded
snapshot and this transaction's mutation. A postcondition defect aborts all
**own recovery-transaction** changes. This is not an atomicity claim for the
earlier SDK/fixture-policy cleanup transactions or for the entire native workflow.

A waiting independent writer can commit after recovery releases its locks. Its
later changes are never silently undone; the independent final observer can
reject the resulting drift. The barrier supplies a serialization point, not an
everlasting no-writer claim. Deadlock is possible with differently ordered DDL;
timeout/deadlock aborts, with no retry, reduced lock mode or fallback.

The Engine rationale is pinned to official PostgreSQL **REL_17_11**, commit
`083ac033419f690758508e08c1736089384bbee8`; exact file bytes/SHA256/Git identities
and source lines are in `platform-storage-acl-recovery-r2.engine-evidence.json`:

- `aclchk.c`: table/column ACL mutation opens pg_class/pg_attribute RowExclusive;
  generic schema/function ACL mutation opens its catalog RowExclusive. Its
  superuser permission check and `lockcmds.c` describe the existing custodian
  requirement; no permission repair is proposed.
- `policy.c`: CREATE/ALTER/DROP policy use pg_policy RowExclusive and target-table
  locking; `alter.c` shows generic owner changes with catalog RowExclusive.
- `user.c`: role and membership writes use pg_authid/pg_auth_members RowExclusive.
- `lock.c`: the conflict matrix makes RowExclusive incompatible with the chosen
  barrier. Engine-source analysis is separate from actual PG17 lock behavior,
  which remains NOT_RUN in this source task.

## Deadline, expiry and UNKNOWN

Lock wait: **3s**. Statement timeout: **10s**. Server idle-in-transaction timeout:
**5s**. Adapter hard window: **20s** from its creation after physical identity.
Each frame's terminal wait is bounded by **5s** and the remaining hard window.
Known-backend rollback has its own existing **5s** settlement deadline. Relay
close retains the unchanged bounded Wire close/kill behavior.

The gate is repeated after material reads and durable intent persistence, just
before every send. The hard monotonic deadline is checked before and after the
potentially slow gate and after snapshot hash/persistence work; equality expires.
An expired normal review cannot authorize further fixture or SDK effects. The
existing **explicitly reviewed cleanup-only-after-expiry** capability can settle
only the original run's recovery, without renewing normal authority, changing
the request or ignoring source/record revocation. It does not extend the new
hard recovery window. After that window no further body or COMMIT is sent;
only bounded rollback on the exact known T/E backend is permitted.

If COMMIT was validly dispatched before expiry, its bounded terminal ACK can
arrive after the window. Clock expiry alone does not determine commit outcome.
Loss of stream/backend identity, malformed terminal state or capture failure
quarantines the connection. No rollback is sent on an unknown backend, and no
reconnect, resend, replacement candidate or retry is performed. Known T/E errors
can be rolled back on that same stream. `skipped`, `unknown`, failed persistence,
close uncertainty, COMMIT ACK and observer status stay distinct. Primary native
failure is retained when a later recovery/cleanup also fails. Relay-close
uncertainty forces the overall result to failure/UNKNOWN, even with a commit ACK.
An independent-observer mismatch is not relabeled recovery success or repaired.

Existing finite capture ceilings are unchanged: 1MiB raw per Wire connection,
4096 frames and <=12KiB outgoing frame. Two full catalog reads now share the
recovery connection. The local ceiling is **not a bound proof** for future catalog
growth or disk quota. A breach is UNKNOWN/quarantine, never truncation or a
claim that closing the relay proves rollback/residue. Custodian: Platform,
immediate follow-up on uncertainty, within one hour; evidence private for30days.

## Exact recovery semantics

The full snapshot comparison includes raw/expanded/effective ACL, grantor and
grant options, owner and role attributes, role reachability/membership/default
ACL, policies, relation/column/function metadata and triggers from the existing
catalog ABI. Every preserved owned policy remains exact in both comparisons.
The renderer still rejects unsupported initial grantors/options rather than
attempting a lossy reconstruction. The original privilege/grantor recovery body
has not changed.

The original schema ACL is raw NULL. Ordinary REVOKE restores owner-only effective
USAGE/CREATE with the same grantor but leaves an **explicit owner ACL**. Both
states remain separately recorded; `namespace_raw_null_restored=false` is the
expected successful semantic case. Exact raw restoration is not claimed and no
pg_catalog UPDATE is used. Acceptance of this representation difference remains
a separate execution gate.

## Reproducible request and preservation

Final private request: **7926 bytes**, SHA256
`b6bc312a7745efe87f64952662b47355d7f57ca9af1cd064cce8e732b5535483`.
Source seal covers **25 files**:
`33b8012891c8ea72d24b89f5806fd917524dc96cb0b54c14af07c12f6c39d6d2`.

The fixed offline `rebind.py --materialize` reconstructs from the frozen R1
request6177bytes/SHA256
`6bdfe4ab4504dd39fd41f1bf434d103ec2c01c0ae0f071d79c4a93def4d2339c`,
its four verified private SQL materials and pinned private catalog. It checks
existing cached SDK bytes/tool-file pins without executing Docker or reading
credentials. It archives R1 unchanged before creating R2 and refuses an existing
candidate. `--verify` verifies exact reconstruction and all seven named materials.
The fresh deterministic run identifier is derived from the fixed predecessor;
no claim is created. Fixture identifiers change with that fresh run, not policy
semantics. ACL apply remains byte-identical. Public manifest records only safe
hashes; private actor/target identifiers and SQL request values are not published.

All target/service values copied from R1 are **declared expected pins**, not fresh
observations or proof of current custody. Runtime gate must independently match
them in a future separately authorized attempt. R1 and two intermediate
unexecuted R2 candidate drafts are preserved; final R2 replaces the candidate,
not a stack/replay. Registry **EMPTY**, authority **NULL**, execution binding
**NULL**, attempt claims **0**. No one-use authority has been consumed.

## Affected controls and remaining gates

**19 new R2 groups PASS**; **4 R1 groups affected by the versioned request/material
ABI PASS**. The other accepted R1 controls and all unrelated health/bootstrap,
restore, SDK/ABI/capture suites were not rerun. New groups cover before/after
counterexample, nine prestate-drift dimensions, positive zero/seven-policy cases,
queued writer, postcondition rollback, lock timeout/deadlock, hard expiry after
gate/fsync and equality, revocation, stream/PID/tag/ready uncertainty, COMMIT ACK
after expiry/lost ACK, persistence failure, fixed guards/frame limits, actual
Run lifecycle/close uncertainty, adapter bypass/foreign target, retained primary
error, independent postcommit drift and wrong observer PID/database/system.
Python syntax is checked in memory; no PG parser/SQL execution or dependency
installation. Early offline materializer validation rejected a registry-format
expectation; the exact existing format was then bound, the nonauthorizing draft
preserved and final request regenerated. No authority or guard was weakened.

Next: coordinator reviews F01 closure and the exact new catalog-lock scope and
window; approves or rejects the unchanged underlying ACL delta/raw-NULL semantic
recovery difference and final private request. Only then can a separate native
execution be authorized. Real lock acquisition, SQL parse/compile, real Auth
session, Storage SDK/denial/bytes and real cleanup remain NOT_RUN. Canonical
Documents authority, AAL2, verified-object brand/non-overwrite verifier, conditional
delete/restore, scanner and durable custody remain independent gates. Core15 is
not blocked by this source package.

قابل خودکارسازی: **نیازمند بررسی**. Input: pinned original catalog, closed recovery
renderer, source/SDK/tool pins. Automatable: deterministic rebind, state/policy
comparison, gate/deadline checks and private ACK receipts. Human decision:
Platform/coordinator for exact ACL/recovery/lock-window/execution approval;
Documents for canonical authority. Conditions: owned dev target, unchanged pins
and separately accepted request. Exceptions/UNKNOWN go to Platform/coordinator,
no automatic retry. Dependency: current provider behavior and exact native review.
Value: prevent recovery overwriting independent changes; estimate UNKNOWN.
