# PLATFORM-DOCS-CE012-PGAUTH-BIND-05

Status: SOURCE_CANDIDATE_DELIVERED; FINAL_BINDING_NOT_READY; ALL_LIVE_ACTIONS_NOT_RUN.
Base: `254b7fd604dc0718b37c4b145821922cdf6bd597`.
Branch: `codex/program-local-runtime-lane-01`.
Consumer dependency: DOCS-CE012-NATIVE-RUNTIME-BINDING-01 / Documents LIVE-SCOPE-04.
Current exact producer: `c0caf3e70d97c3d09b16cbff91188367804cba6b`,
`documents-ce012-live-connection-request.v2`.
Request:2819bytes/SHA256`3ca7a18b4789d262565dc3289cf029d633b36a0fa155c5f3a575dfeedc619873`.
Native closure:49022bytes/SHA256`55093d835a860ceeb414fbd097d3b62af2520e60cee5b093763ff7f983f928ee`.
Producer historical reference: `f3b0a7626de1ffcbbe1b01350a252b92c3e841dc`.
Review of its excessive installation dependency:
<https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573930500>.

## Executable source, not a live admission

The new fixed worker and Python owner hook are implemented, with no changes to
Documents/Core/CE source, existing runtime-lane-v1, the shared runner or any ACL02
sealed input. The Python hook exports the existing pinned `Lane` class, consumes
an actual active PG/Auth Lane, and reuses its existing cleanup and lifecycle
closeout. It is not an installer or a new provisioning framework.

Fixed owner entry: `scripts/run-docs-ce012-pgauth.py:consume_and_cleanup`.
Fixed child entry: `scripts/docs-ce012-platform-v1/worker.mjs --run-owned`.
Fixed producer entry: `scripts/docs-ce012-live-connection-v1/run.mjs --run`.
Neither consumer JSON nor a CLI selects a module, source path, shell, SQL or exec.
The owner-facing CLI offers **only offline --inspect**. No standalone health,
provision or domain installer is provided. The owner hook belongs after separately
accepted health/native-fixture preparation and before resource destruction.
Calling the old health-only runner does not install that prerequisite or establish
this phase; it always performs its own finally-cleanup as before.

The v2 producer source/request/inventory/native-closure/five-executable binding is
pinned to the exact updated Head. The separate Node/dependency runtime binding,
private plan/target and execution authority are still NULL, and the registry is EMPTY.
Even an added Core review entry or a relabelled Core request cannot admit this
consumer. The exact old Documents request and historical Head are rejected
explicitly. Source integrity of 322 historical inputs, including 300 migration
files, is not a requirement to install/replay all 300. The historical request,
inventory and four executable identities are recorded as reference-only; none
is activated or substituted for the pinned v2 successor.

Offline inspection (does not read private fixture inputs or contact Docker):

```sh
python scripts/run-docs-ce012-pgauth.py --inspect
```

## Exact binding and authority boundary

The nine-file Platform seal includes every new executable adapter/observer module,
Python hook, the unchanged shared runner/admission/profile and the dedicated
producer-binding file. Its manifest is outside the seal, avoiding self-hashing.
The exact v2 request, inventory, native closure and all five executable pins have
been independently read back from official GitHub and bytes/SHA256/Git identities
matched. The v2 closureBytes are forwarded unchanged to producer admission, and
its admitted runtimeClosure object is forwarded to v2 measurement.preflight.
The independent Node/package/tool runtime closure still needs its final binding;
that is distinct from the now-pinned native dependency closure. A private plan is bound by exact bytes/hash in the invocation and registry;
no plan, native installation or session is synthesized by this source delivery.

The exact canonical invocation is independently matched to a coordinator-curated
registry record: source/seal, raw producer input hashes, plan, descriptor,
prerequisite evidence, immutable expiry and trusted coordinator public-key hash.
Only that registry can establish admission. approved:true, a supplied review URL,
a consumer-generated signature or embedded key cannot create it. The producer's
existing secondary Ed25519 admission is also executed using the independently
pinned coordinator public key; it does not replace Platform admission/custody.
No production key generation, private signing key, new credential or self-signed
execution decision is implemented.

Before any effective pool/connection/query/HTTP/worker import, the host checks
source/input currentness, review identity/ceiling and actual current custody of
both containers. Each awaited verification is followed by another check; fsync or
import completion is not an authorization lease. The producer's signed expiry
can only shorten the original Platform ceiling, never extend or revive it.
Expiry equal to now fails. Existing terminal recording and bounded destruction
are not authorization to dispatch another query. An expiry does not determine a
COMMIT outcome.

## Platform-owned private fixture

The private descriptor binds actual run/attempt/nonce, PG and Auth CIDs/names,
exclusive synthetic ownership, current safe configuration hashes, database/OID/
system identifier, approved observer/conflict roles, Auth origin/issuer/path and
synthetic subject. It contains no token or provider signing key. It must derive
from the actual current Platform Lane and independently observed/accepted fixture
outputs. Typed handoff and exclusive durable dispatch/lifecycle claims reject
old/ended/mismatched/reused runs without rewriting historical receipts.

`runtime-lane-v1` retains its accepted PG17.11/GoTrue2.197.0 image pins. The profile
is unmodified: PG network=none, Auth shares the actual PG network namespace,
loopback only, no published ports, binds/named volumes, extra capability, host
credential or external delivery. Fresh Docker inspection compares actual
CID/name/run label/image/isolation/config seal at effect time. Inspection excludes
Config.Env, so the Auth signing secret does not enter the new custody ledger.

The descriptor is not independently sufficient: current native preflight via the
consumer observer verifies the actual database/OID/system identity and accepted
minimum native catalog/lineage contract. The independently reviewed installer,
fixture and committed-receipt outputs must be acknowledged, scope-pinned and
correlated to the same run, PG/Auth CIDs and database/system. Missing producer
outputs are NOT_READY. This adapter has no migration loop, repair, setup callback,
seed or receipt writer.

## Concrete transport and real-session interface

Node `pg` uses fixed role-bound Pool/Client wrappers and a real Duplex transport
through `docker exec -i --user 999:999 <actual PG CID>` with a fixed loopback relay.
Only PG5432 and Auth9999 inside that namespace are reachable. No host TCP port,
container mount, copied Node binary or additional network is required. Runtime
and dependency bytes are verified against a separately accepted local runtime
closure; module resolution outside that pinned closure fails. Host credentials
and generic Supabase selectors are not inherited by the consumer. There is no
service_role/postgres/managed-principal fallback or native libpq fallback.

The Auth path is fixed GET /user (or its explicitly bound /auth/v1/user equivalent),
with exact origin/issuer, no redirects, signup, admin, MFA enrollment, email or
/token endpoint. The real Node HTTP parser runs over the same controlled relay.
All ordinary external net/tls/http/https/dns/dgram/WebSocket/child-process paths
are fenced; only closed-over fixed Docker operations remain available.

A separately authorized Platform fixture/session producer supplies an existing
real AAL2 token over a private owner-opened FD/memfd. The worker accepts no token
from caller environment or consumer request, does not write it to a session file,
and deletes transient token selectors after the child run. The packet must match
the run/attempt/synthetic subject. The unchanged consumer verifySession function
performs real Auth /user verification of that token, issuer/role/expiry/AAL2
checks, and a matching current auth.sessions row through the read-only observer.
The actor must be the exact synthetic subject. Verification repeats through the
consumer's own pre-case checks. Decoding, user_metadata, admin-confirmation or an
assumed AAL2 value is not authority. Password-only/AAL1/missing/revoked/other-user
sessions block. Session creation/enrollment/login is not done by this adapter.

## Measurements, bounds and settlement

The worker consumes the real accepted admission/run/live/measure modules; it does
not transform their source or replace Core/Documents/CE functions. The producer's
independent observer, row/sequence digests, staged tuple counters, native lock and
serialization witnesses remain intact. Fixture id=id conflict is the existing
explicit exception outside provider measurement; it is not permission for domain
writes. All nine named case results and NONE commit/activation are required.
Missing/duplicate labels, failed cases, unknown outcome or incomplete evidence
cannot become zero-write or overall PASS. The first failed result is retained.

Fixed limits: nine cases, five lifetime PG physical connections, 15s per producer
case, 180s total, 800ms lock probe; 3s connect/Auth read, 2s per custody inspection,
12s maximum driver query timeout, 3s per pool/relay settlement. Parent worker
supervision is 200s, covering the total and bounded settlement. It never retries.
Each relay has 8MiB sent/received hard caps; private ACK/control ledger has its own
8MiB cap and 16KiB maximum record, checked before writes. Breach is UNKNOWN and
quarantine, not truncation or success. This is a transport safety bound, not a
claim that unresolved bulk/catalog capture quotas are proven.

Native backend PID, CommandComplete and ReadyForQuery events are recorded with
ordered hash-chain/fsync before pg accepts them. Cancellation keys, token values,
rows/catalog and query parameters are not written to this ledger. The unchanged
consumer retains its own zero-write measurement semantics; this metadata ledger
is not substituted for its snapshots. Protocol/custody/persistence/timeout loss
quarantines every normal lane. The producer's explicitly scoped native40001 case
remains its own read-probe witness, not an operator retry grant.

Pool/relay settlement and existing Lane destruction are independent steps; their
errors do not suppress later cleanup or replace the primary error. The owner
hook retains historical health while the real PG/Auth lifecycle closeout requires
acknowledged cleanup for both containers and applicable images. Missing, failed,
unknown or incomplete cleanup gives nonzero/UNKNOWN. A pre-existing image skip
is not deletion of an owned container. Destruction cannot establish residue or
zero writes. Raw receipt/descriptor/custody/catalog/token material stays private.

## Results and precise open gates

27 focused Node groups and 8 Python owner-slot groups passed (35 unique groups). They cover missing/
expired/equal-time review, immutable expiry through await/fsync, old request,
source/request/plan/profile/closure/issuer/role/target mismatch, missing/foreign
prerequisites, custody loss, effect expansion, fixed transport, external egress
fence, private session packet, AAL1/wrong actor/current-session rejection,
ACK persistence/capacity, module/source resolution, duplicate case results,
exclusive run claims and complete/unknown/missing cleanup with primary-error
preservation. Tests use mock transports/fixture/session verification; the actual
Node HTTP parser is exercised only with an in-memory Duplex, without a socket.
Documents’ already-successful 8scope/5admission/inspect-request checks were consumed as coordinator-reported evidence and not rerun. The former 19/26/7 suites, ACL02 eleven cases and health/provision were not rerun.

An initial child-process CLI test was sandbox-blocked (EPERM); it ran successfully
with tool permission for subprocess/network primitives. No test used external
network or a real Docker/PG/Auth/session. Python/Node syntax and diff checks pass.
Skills applied: cloud-environment-runtime and Supabase Auth guidance. The changelog
fetch returned unsupported content type; no retry/bypass was used. Official AAL
reference was obtained via documentation search. User's source-only scope
supersedes generic instructions to run a verification SQL query.

| Required output | Producer / owner | Current status |
| --- | --- | --- |
| Corrected FullSHA, v2 request, source inventory, minimum native closure and five executable pins | Documents LIVE-SCOPE-04 + coordinator | SOURCE_PINNED c0caf3e; official full readback/identity MATCH; old request forbidden, target compatibility still open |
| Exact nine-case commands/fixture plan and matching plan hash | Documents FIXTURE-PLAN-COMPILER-05 | NOT_READY; case semantics remain Documents-owned |
| Accepted existing dependency/runtime closure and actual Node/Python/Docker pins matching that source | Platform, using existing tools only | NOT_READY_FINAL_SOURCE; no install authorization inferred |
| Minimum native installer source/lineage/catalog acknowledgement for the admitted closure | Documents/Core producer + Platform fixture owner | NOT_READY; no native300/global replay substitute |
| Exact synthetic fixture, roles/observer rights and current database/system evidence | Platform runtime owner with independently accepted native source and Documents case plan | NOT_READY; no setup/repair callback here |
| Real committed CE save receipt/setup and CE/Core mapping/neutral-label decision | Core/CE/Documents + coordinator | NOT_READY; no fabricated JSON receipt |
| Actual same-fixture synthetic subject with a current provider-issued AAL2 session | Platform/Auth fixture producer | NOT_RUN; token supplied only over private FD, no fallback |
| Exact private plan/descriptor/review and one bounded invocation | Platform + coordinator | NULL/EMPTY; requires later exact binding/review |

All Docker/provision/health/SQL/native/session/Auth/live dispatch remains
NOT_RUN_NOT_PASS in this task. These source tests do not close any native,
staging, hosted, S3/S4/G2 or actual Documents/CE012 connection acceptance gate.
The machine-readable proposed next request pins v2 source but is explicitly non-executable pending
these runtime/plan outputs; it does not authorize startup, installation or session issuance.
