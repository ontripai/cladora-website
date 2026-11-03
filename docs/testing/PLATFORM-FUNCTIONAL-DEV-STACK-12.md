# PLATFORM-FUNCTIONAL-DEV-STACK-12 — independent infrastructure delivery

Shared Base `ec639884452cc0cb6dfef520339791a5c20e9b39` was merged normally into
the assigned branch. The integration commit is
`26ad9b1f9ed0fe94df54330d0fc314fdd5c8e8d1`, with parents task11
`864ffa05eec12f463330c4a21d14640fc6423ac9` and Shared Base. This source delivery
is a direct child of that integration. No reset/rebase/force/new branch occurred.

## What actually works

Real PostgreSQL17.11, GoTrue2.197.0, PostgREST16.4, nginx1.28.0 and Storage1.82.1
run on the owned `cladora-functional-dev-v1` internal Docker network. All images
are immutable amd64 digest pins in `scripts/functional-dev-stack-v1/profile.json`.
Container root filesystems are read-only, capabilities dropped, no-new-privileges,
bounded resources, no Docker socket mount or host credential inheritance. No
container port is published. Runtime proxy variables are explicitly empty: these
services only communicate inside the internal fixture network. Image acquisition
uses the managed daemon's existing proxy/TLS and policy.

In this environment Docker did not activate published ports on an internal
network. Rather than enabling external networking, one owned host process binds
only `127.0.0.1:55421` (fixed HTTP routes) and `127.0.0.1:55422` (fixed PG endpoint).
It relays through official docker-exec into this owned network. There is no
caller-selected host/port/shell, external forwarding or token in process argv.
HTTP uses bounded lossless pipes and a fixed 20s deadline; PG has 64KiB buffers,
120s connection deadline and no SQL parsing or replay. Admission/custody/source
checks run before connections; eight concurrent transport slots are shared.
The HTTP relay never logs request URLs/headers/bodies. Closing a relay is NOT
an asserted rollback ACK. Core's actual client must settle its own transaction.

Two synthetic users were created by real GoTrue; password logins issued real
AAL1 sessions. No user JWT/AAL2 was manufactured. GET/user and the actual
auth.sessions row matched each synthetic actor/session. Local autoconfirm is
deliberate for isolated synthetic development; no SMTP or outbound email is
configured, and the internal network prevents external delivery. This is NOT
email ownership/delivery or hosted signup evidence.

Two workspaces and a durable note live ONLY in `platform_dev`. They are not
canonical product principals, Contexts, memberships or Workspaces. Real REST
reads/writes proved own-scope access, anonymous401, unrelated-write403 and empty
foreign reads. A note and both users survived real PG/service stop/start;
postmaster start changed while system identifier/database OID and durable record
identity stayed equal, followed by new password logins/readback.

Real host PG access was verified with existing pg8.23.0/Node24.19.0 and exact
existing cached library hashes. The ordinary login is authenticator; session
and local role are asserted. It has no superuser/BYPASSRLS/CREATEDB/CREATEROLE/
replication. Real Auth tokens supply only synthetic fixture claims, set LOCAL
inside a transaction; these GUCs do not establish canonical authority. The same
physical backend was used sequentially for both actors. Successful rollback,
RLS error and server statement-timeout cancellation each produced actual driver
CommandComplete ROLLBACK and ReadyForQuery I; after settlement role and claims
were clean. Those parser events are persisted with fsync privately.
An intentionally lost socket had NO terminal ACK: outcome remains UNKNOWN,
that client was destroyed/not reused, and a new observer had clean identity and
independently observed the old backend absent. An intermediate EOF relay had
left that backend open; this counterexample was recorded, corrected with graceful
input EOF/remote-reader closure, and rechecked. Restart cleared only the earlier
owned test sessions while preserving persistent data; no guessed backend PID was
terminated and no disconnect was relabelled rollback ACK.
This is not a production Core lease adapter, HTTP-abort proof or unknown-COMMIT
recovery proof. No domain command was sent.

## Official commands

From the exact delivered source, using existing Docker/Compose and Python:

```sh
python -I -B scripts/functional-dev-stack-v1/stack.py init
python -I -B scripts/functional-dev-stack-v1/stack.py pull
python -I -B scripts/functional-dev-stack-v1/stack.py bootstrap
python -I -B scripts/functional-dev-stack-v1/stack.py start
python -I -B scripts/functional-dev-stack-v1/stack.py users
python -I -B scripts/functional-dev-stack-v1/stack.py verify
python -I -B scripts/functional-dev-stack-v1/stack.py status
```

`init` and bootstrap/users are not replay commands. Existing private state or
unknown dispatch refuses regeneration. On this delivered instance they already
completed; consumers must not run them again. Source drift holds rather than
silently replacing configuration. Closed start/stop/status/backup are the normal
persistent lifecycle. No generic exec, arbitrary payload or reset/destroy exists.

```sh
python -I -B scripts/functional-dev-stack-v1/stack.py stop
python -I -B scripts/functional-dev-stack-v1/stack.py start
python -I -B scripts/functional-dev-stack-v1/stack.py backup
python -I -B scripts/functional-dev-stack-v1/stack.py start
```

Backup stops HTTP writers and makes private PG custom-format/globals archives
plus a read-only archive of the stopped Storage volume. Hashes, pg_restore's
archive listing and tar structure were verified. Full restore is NOT_RUN; restore
must target a separately reviewed empty owned instance, never overwrite this
product volume or staging. A failed backup leaves writers stopped and reports
failure; do not infer backup completeness or restart automatically after UNKNOWN.

## Persistence, permissions and custody

PG data and Storage objects use separately labelled named volumes. Stop, test
cleanup and helper removal never delete these product volumes. The sole storage
ownership bootstrap uses one empty owned volume, a network-none/read-only helper
with only CHOWN capability, then exits/removes the helper. It does not chmod a
shared workspace or run the service as root. Storage runs UID1000, PG/Auth/REST
UID999, gateway UID101. A nonsensitive config copy is read-only inside the
gateway; its host directory remains private. Historical initial startup errors,
applied compatibility deltas and previous private descriptors are preserved.
One helper-created anonymous PG volume was identified by its Engine mount/
unmount events and helper CID, checked unused, then removed; named volumes were
preserved. Current helper cleanup and volume inventory were checked.

Role values/passwords and sessions are never printed. All non-custodian runtime
roles were observed NOSUPERUSER/NOBYPASSRLS. Authenticator can assume only anon/
authenticated, not service_role. The private provider server key is a Storage/
GoTrue administrative bootstrap key, never a user session or Service fallback;
no user/Service/RLS verification uses it. Provider credentials must not be handed
to a product request. Native setup uses postgres only as the owned local
custodian. Installer/domain roles are not guessed from that principal.

## Private consumption and cross-environment boundary

The owner-private guide and process-scoped client configuration are under the
Platform-owned private directory, outside Git. Only the responsible backend
owner receives those files in the SAME environment. Use the real Auth-issued
user session for requests; Service receives no provider/admin key or raw session
secret. The host PG endpoint accepts a scoped login and actual database password;
it is not a shell or role-selection API. Do not use postgres as a product runtime.

Loopback is NOT reachable from another Seat/machine. Same-environment HTTP and
PG consumption were actually tested. No Tailscale/VPN/tunnel or cross-Seat route
was established. Another executor must fetch this exact source, read its own
Docker/network instructions, verify capabilities and free fixed names, then run
the documented init/pull/bootstrap/start/users/verify in its own private state.
That creates independent keys/users/data; do not copy secrets through Git/chat.
Fresh reconstruction in a second executor has NOT_RUN status. The current
instance was developed with additive, recorded corrections, not falsely claimed
as an untouched first-pass fresh bootstrap of the final source. This limitation
must be checked in the consuming environment before it claims READY.

The native ordinary-connection probe uses an already pinned local pg cache; its
path is Seat-specific. It does not run the Documents consumer, alter its 601-file
materialization, install packages or approve its historical request. Another
owner must supply an equivalent verified pg8.23.0 toolchain or its reviewed Core
driver. The product package/lock are unchanged.

## Core15 / Service09 handoff

Producer dependency consumed exactly from Service Head
`4c3abd7c26d8ae393fdb6acb3f88330c7b887097`, path
`supabase/hosted-service-v14-execution/functional-request-runtime-dependency-v1.json`.
It is not a Core install manifest. Core15's accepted FullSHA/minimal install
manifest/order/privileges/verify/recovery have not been delivered. No historical
installer or entire migration set was substituted.

Core receives: real PG17.11/GoTrue2.197.0 identity; database postgres; auth,
storage, extensions and platform_dev schemas; internal-only Docker plus fixed
loopback PG55422/HTTP55421; exact image pins; private credential selectors;
ordinary role flags and proven infrastructure lifecycle. Core must specify its
runtime login, schema USAGE, exact SELECT/EXECUTE/write-through-host privileges,
native source/fixture/membership/session producers and compatibility preflight.
Only then install that reviewed slice and expose required API schemas.

Service's request-local platform12-service-request-database.v1 composition is
still HOLD: authenticate_http_request with canonical currentness; leased fixed
role; Core's transaction scope/settlement/cancellation/quarantine; domain history
readback and ACL. Existing Core host/authority/store semantics are not reimplemented
in Platform. Node native context evidence above does not close these gates.
Core retains session identity/assurance/currentness; Service sees only the
contracted actor_id/authority_version and never shares a principal/lease across
requests. No service_role/BYPASSRLS fallback or runtime activation occurred.

AIRPROP input is pinned to `4b8d1e9e305f44268688197246d34ac65d972b40`,
`docs/airprop/AIRPROP-FUNCTIONAL-LISTING-06.dependencies.json`. Its Core minimum
explicitly rejects authenticator/authenticated/anon and provider/admin executor
profiles. The tested infrastructure login therefore MUST NOT be passed to that
Core host or labelled an admitted AIRPROP executor. Core15 must deliver the
dedicated role/closure, real read-selector/canonical authority, C03 mutation and
receipt ABI before connection. Native privilege graph/typed-role compatibility
is a separate gate. AAL1 synthetic sessions do not authorize sensitive AAL2
commands; enrollment/verification must use real Auth and its actual assurance,
not a JWT field override. Listing/receipt persistence and current-authority
behavior after restart remain NOT_RUN with Core/AIRPROP; only infrastructure
note/session persistence has passed.

## Storage / Documents / scanner

Storage1.82.1's actual provider health through gateway is200; real provider
migrations and a writable UID1000 persistent volume exist. No Documents bucket,
upload/download, immutable-version ACL, Core receipt or queue was installed or
accepted. Those require Documents11/Core exact slice and role policy. Tightened
provider roles remain NOBYPASSRLS; object behavior is NOT_RUN, not inferred from
health or an administrative key.

The official pinned ClamAV image actually returned ClamAV1.4.4; the version helper
exited0 and was removed. There is no validated signature database. No file scan,
EICAR verdict, freshness, scanner queue or Documents worker was run. Effective
network policy does not grant the ClamAV signature CDN; no bypass/download was
attempted. Documents/Platform need a reviewed official signature acquisition or
verified offline CVD/CLD input, exact hashes/freshness/resource limits and accepted
queue/attestation integration with the existing document-clamav-worker. The
declared signatures volume is reserved in configuration, not provisioned proof.
Engine version is not scanner readiness.

## Evidence, limitations and automation

Nine new targeted source tests passed across initial and affected runs; Python
syntax/JSON and new MJS syntax pass. No task11/ACL02/old health/materialization/
backend suite was replayed. Native task12 evidence is new real infrastructure,
with failures and source corrections retained, not retrospective relabelling.
The first CID selector error preceded setup SQL; a diagnostic aggregate that
returned no row was corrected before asserting empty namespaces. Provider owner,
gateway mode/temp paths, Storage ownership and HTTP EOF handling were corrected
without role/authority bypass or deleting data. The first signup returned500;
its error and zero-user observation preceded the changed-transport attempt.
One backup variable-shadowing error preceded dump creation; final backup passed.

Safe manifest/receipt contain source pins and aggregate outcomes only. Raw Auth,
DB/catalog, token, descriptor, private session and backup files remain private.
No staging/Production, real mail/payment, domain deployment, cloud project,
expense, manual CI, merge-to-release or hosted acceptance is claimed.

قابل خودکارسازی: **نیازمند بررسی**. Input: pinned stack and accepted domain plan;
repeatable start/status/backup/identity/RLS checks are automatable. Human decisions:
Core/Platform/owner accept privileges and scope; Documents accepts scanner inputs.
Conditions: owned target, exact pins/custody and private secrets. Exception owner:
Platform/coordinator on drift/UNKNOWN, no blind retry. Dependency: Core15/Service09/
Documents11 exact contracts. Value: durable role-isolated product-development
access; estimate UNKNOWN. No new automation system or parallel Tracker was made.
