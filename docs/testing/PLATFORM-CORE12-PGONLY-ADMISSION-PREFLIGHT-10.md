# Core12 PG-only admission preflight10

Parent `bec76c530db8b0922d008eb0c60c1f0831cd5659`; branch
`codex/program-local-runtime-lane-01`. Delivery is **inactive source/preflight**,
not execution readiness. Target, executor, observer, authority and execution
binding are NULL; dedicated registry EMPTY; live HOLD.

## Exact producer input

Core commit `1eb8b5a1e522a529b39af02e32748756ee04dfec`:
`supabase/proposals/core-canonical-sqlstate-boundary-v1/pg-only-boundary.test.sql`.
20744bytes; SHA256
`07072fdae234825786709260befa0b2c5337b0379ce852f072fdbfb9d17a9158`;
Git blob `0a187e6d8d8025108578583b5401c78114883c64`.
Official GitHub source was read and privately cached; these three identities
matched. Only bytes were read/hashed: no SQL parser/generator/PG/SQL execution.
The original Core file and all other owners' source remain unchanged; this branch
contains only its reference, not another rendered/copied SQL payload.

Core's exact caseplan at the same commit identifies11 cases x8 boundaries x2
versions =176 PLANNED calls. No executed-call count is asserted. The witness
creates16 temporary invoker wrappers and a temp matrix in one SERIALIZABLE
transaction, checks its synthetic exception oracles, then ROLLBACKs. Its purpose
is extracted exception-clause behavior. It does not evaluate canonical authority,
install native schemas, prove real concurrent SSI or close either historical slot.

## Delivered fixed contract

- `core12_pg_preflight.py`: pure exact-byte/request/profile validation; no send,
  connection or dispatch implementation. Its only CLI reads/hash-checks the fixed
  Core source: `--inspect-source OWNER_PRIVATE_EXACT_SOURCE`. No --exec/--run/SQL
  path from a request. Arbitrary payload, source/hash/target/executor changes,
  extra/duplicate JSON keys and nonexact request serialization reject.
- `core12-pg-only.request.json`:8189bytes, SHA256
  `ef3ba1b76086537ad4a6a447e21e2a19630da3223df7d530722c9f750096b26a`.
  Exact source seal/profile/payload, transaction order, budgets, custody,
  rollback/observer/residue and complete cleanup plan; all actual bindings NULL.
- `runtime-pg-only-core12-preflight-v1.json`:3098bytes, SHA256
  `3daa756dc51c6f86c30231954775a639a766adcb6d75564f713041ad58600cac`.
  Copies only the existing accepted PG17 image/isolation requirements into an
  inactive Core12-specific contract. It does not replace/modify the ACL02 profile.
- `core12-pg-only-reviews-v1.json`: EMPTY. Admission always HOLDs while this source
  has no reviewed target/executor/adapter. Adding an inline approved flag, GUC,
  nonempty URL or even a registry record cannot activate the inactive draft.

The source seal covers six unchanged existing lane/adapter/wire/profile inputs,
the new profile and this new preflight module. Request and manifest hashes are
external to that seal; no circular self-hash. Request regeneration is exact and
does not alter SQL bytes. The registry is separate from execution source.

## Required target and ordinary principal

Only an owner-custodied disposable PG17-only fixture, database exactly
`core_sqlstate_boundary_proof`. No Auth, cloud target, staging or Production URL.
Use the same pinned postgres image/ImageID, network=none, OS999:999, read-only
rootfs, drop ALL capabilities, no-new-privileges, no ports/binds/named volumes,
existing tmpfs and512MiB/0.5CPU/128pids limits. These are requirements, not observed
inventory/health or permission to provision.

Database role is independent of OS UID and must be observed, not named postgres
by default. Require matching current_user/session_user, non-superuser,
non-BYPASSRLS and no CREATEROLE/CREATEDB/replication, CONNECT/TEMP, own pg_temp
function rights and PL/pgSQL USAGE. Function default-ACL rows must be absent and
auth/app_private/identity/platform namespaces absent. No SET ROLE, default ACL
repair, positive grant or management-role fallback. All actual observations NULL.
The Core GUC is only an accidental-execution latch, never authority.

## Future sequence and finite bounds — NOT_RUN

| Stage | Required input/output and stop condition |
| --- | --- |
| Review/admission | Exact request/payload/profile/source seal, independent review and scoped owner authorization; missing binding stops before mutation. |
| Disposable provision/setup | Existing Lane lifecycle; actual fresh run/attempt/CID/image custody and exact separately reviewed DB/ordinary-role producer. Setup payload is NULL today. |
| Identity/baseline | Physical startup role/database, PG17, actual CID/database OID/system identifier/PID/stream, privileges and independent protected-catalog baseline. Unknown stops. |
| Witness | One exact20744-byte payload, one attempt, unchanged BEGIN/ROLLBACK, no splitting/rendering/added COMMIT. Guard latch transport binding is pending. |
| Terminal | Durable same-stream CommandComplete DO then ROLLBACK and ReadyForQuery I, no errors, actual backend PID and request/payload/run/attempt/CID/connection correlation. Exit/printed marker alone is insufficient. |
| Observer | Separate physical connection/PID, same owned CID/DB OID/system identity. Only after real rollback ACK; zero witness functions/matrix and protected roles/schemas/ACL/defaults equal independent pre-witness baseline. |
| Cleanup | Close exact relays, destroy only owned CID, remove newly acquired unused pinned image if safe. Complete custody-derived absence records. Empty/partial/skipped/unknown records cannot be success. |

SQL-local lock2s/statement10s are source requirements. Existing candidate budgets:
startup35s/witness30s/observer15s/settlement5s/relay2s/cleanup20s each; source-pinned
wire1MiB/4096frames per connection. These are finite failure ceilings, not proven
capture bounds for an unbound observer. Timeout, drift, error or unknown ACK stops
later stages; first error retained; no replay. Rollback settlement only on a
known same backend in T/E, never a quarantined/unknown stream. Skipped is not ACK.
XID is observed only if actually captured; none inferred after DDL/opaque payload.

Observer addresses must be actual catalog addresses, not the observer's pg_temp
alias. Partial snapshots mean residue UNKNOWN. Destroying the fixture never
substitutes for a residue observation. Exact observer/identity SQL payloads and
baseline binding remain NULL, so this is not an executable request.

## Concrete integration gaps and owners

1. **Platform:** existing `PurePGLane`/Wire startup and identity hardcode
   postgres/postgres. They cannot be relabelled as this database/ordinary role.
   A separately reviewed narrow binding to those primitives is needed; no generic
   runner/parallel transport was created. Wire.identity's pg_control_system read
   also needs a legitimate ordinary-principal identity/custody design, not a grant
   inferred from this task.
2. **Platform/coordinator:** exact disposable database/ordinary-role fixture
   producer/setup payload, ownership, startup latch option, observer payload and
   independently sourced baseline are unbound. No guessed setup/observer SQL or
   grant was generated. Existing ACL02 source/envelope/consumed authority untouched.
3. **Platform reviewer:** review the fixed20750-byte simple-query frame for the
   new20744-byte payload within the reused wire/deadline/capture contract; the old
   send comment describes<=12KiB. No SQL chunking/fallback or larger budget assumed.
4. **Coordinator/owner:** independent acceptance of these exact artifacts, then
   versioned execution scope tied to real target/executor/custody. No such authority
   is created by this delivery. Missing target/executor/authority remains NULL.

## Actual evidence and preservation

12 NEW offline test groups PASS: exact inactive draft; wrong bytes/source/hash and
arbitrary payload; wrong target/executor/inline authority; duplicate/reformatted
request and profile drift; empty registry/GUC not authority; ordinary identity
requirements; positive explicitly-labelled model; partial/unknown/duplicate/skip
cleanup; same-stream/backend/durable ACK; independent complete zero-residue model;
first error with cleanup failure; no --exec/--run CLI. The new cleanup contract
exercises existing pure `finalize_lifecycle`, never instantiates Lane/Wire or calls
Docker/subprocess. Models return OFFLINE_MODEL_NOT_RUNTIME_PROOF, even if all
criteria are satisfied. Synthetic unit metadata is not an actual fixture/receipt.

CLI byte-only inspection: DRAFT_BYTES_VALID_NOT_EXECUTABLE, planned176,
executed_calls=NULL. Python syntax/JSON/hash/inventory/diff checks PASS. No SQL
parser, SQL, query, PG, Docker/container, Auth/session, install/grant/activation.
Inspector09, materialization, health and accepted suites were NOT repeated.

Runtime=NULL, registry=EMPTY, live=HOLD and both historical slots BLOCKED are
preserved. Core/canonical source, package/lock, profiles/registries for existing
consumers, custody/transport and active work of other lanes are unchanged.

خودکارسازی: نیازمند بررسی؛ ورودی source/hash و request دقیق؛ فرصت کنترل byte/seal
و پیش‌شرط/closeout؛ تصمیم انسانی coordinator برای پذیرش و owner برای اجرای
نسخه‌دار؛ شرط target/executor/custody معتبر؛ mismatch/UNKNOWN به Platform و
coordinator بدون retry؛ وابستگی رسمی Core12 و adapter/observer/fixture مصوب؛
معیار ارزش زمان آماده‌سازی و خطا، هنوز اندازه‌گیری‌نشده و نیازمند بررسی.
این طبقه‌بندی اختیار یا پذیرش ایجاد نمی‌کند؛ Tracker دیگری تغییر نکرد.

Skills: Cloud Environment Runtime and networking reference read, visible version
UNKNOWN; AGENTS/current#463 and CLADORA-SKILLS-USAGE v1.1.0 read:
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482.
Source/contract-only; no execution authority expanded.
