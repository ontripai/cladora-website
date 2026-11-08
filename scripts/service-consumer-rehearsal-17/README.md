# SERVICE17 owned development continuation

Status: **OPEN_ON_SERVICE_FRONTEND_ADOPTION**. The API assembly is real; the
product browser flow has not run. This directory is a fixed test/lifecycle
adapter, not an alternative SERVICE command, policy or authority implementation.

Accepted Core source: `ee883b62cf4a318af3450c506931a969623b8987`.
Original shared base: `29ed18541c602dae4e6db5c98a96201250af630b`.
The containing commit adds only this Platform directory. Core and frontend source
remain byte-identical to the accepted parent. No remote branch was recreated and
no push is part of this delivery.

## Actual execution

The existing owned PG/Auth/REST/gateway/Storage resources and volumes were
recovered in place. A stale host relay was reconciled only after PID absence,
source identity and both loopback ports being free were established. Existing
accounts, backup13, Storage ACL evidence and all historical receipts remain.

The authorized fresh SERVICE slice used Core's v3 producer/consumer binding:
session setup, prerequisites, Core300 Foundation only, the eleven ordered domain
units, private runtime binding, catalog compatibility, read access, real MFA and
the versioned synthetic fixture/addon. No historical v2 credential was copied.
No full migration replay, Assets/Maintenance/Building install or Storage R2 ran.

The production build used the existing clean237 dependency cache, actual
Next16.4.1/Zod4.6.6, and Core's official build/start launcher. The first build was
blocked by read-only Next telemetry storage; a scoped write permission to that
directory resolved the environment error without source or framework changes.
The actual API proof passed thirteen checks using real GoTrue AAL2 sessions.
This includes discovery, canonical catalog, C03 Request receipt, same-key replay,
changed-body conflict, anonymous/foreign-actor denial and expiry/revoke checks.

`api-continuation.mjs` added a deliberately withheld **client** ACK, followed by a
separately invoked exact-key/exact-body retry. This is a controlled boundary
fault, not a claim that the network actually lost a response. The independent
read-only operator observer verified canonical receipt, Request and audit/outbox
identities, one effect, ROLLBACK and ReadyForQuery=I on its own backend. It is not
a newly granted least-privilege product observer. GET is not used as old-COMMIT
proof. Two real synthetic Requests now persist and are intentionally retained.

Both Request/receipt sets were unchanged after an actual restart of the same PG
container/volume/system/database and a fresh start of the same built application.
The Docker restart command's original stdout was not retained and its ACK failed
the driver's exact comparison. The original ACK is **UNKNOWN**, even though a
read-only reconciliation independently observed the changed PG postmaster start
and unchanged target. No second restart was issued. A field initialized as
`pg_restart=NOT_RUN` in the original failure receipt was inaccurate; the separate
reconciliation explicitly records that restart was attempted once. Later code
now marks dispatch before the effect and persists ACK bytes privately.

A new post-install backup was made after the data changed. File hashes and
`pg_restore --list` cover Auth, platform_dev, Requests and idempotency records.
The owned backup helper was removed; persistent volumes/data were retained and
the same backend/application resumed. This backup has not been restored to a
fresh target. Historical restore13 is a separate infrastructure-only witness.
Storage archive contents do not prove document restore or scanner readiness.

## One-use boundaries and source fixes

Private exclusive-create claims guard each attempted install/probe/backup phase.
Do not rerun them. `lane.py install`, `prepare`, `backup` and relay recovery have
already been consumed. The old `consumer.mjs` and AAL1 `infra-probe.mjs` are
preserved development drafts, **NOT_RUN** and not the executed acceptance path.
They must not substitute for Core's actual AAL2/product fixture.

The first retry stopped before POST because a live pg `Date` was compared to its
persisted ISO string. The failed receipt is preserved. The driver now compares
the same JSON representation without dropping timestamps; a one-millisecond
change remains a mismatch. The fixed continuation explicitly admits only that
pre-send failure lineage; it does not reopen a request with an unknown POST ACK.
A separate pre-restart psql parsing error also stopped before mutation. The
parser now requires exact BEGIN / JSON / ROLLBACK output rather than treating
psql command tags as a bare JSON document. Core SQL and assertions were unchanged.

Only affected checks ran: nine retry-admission controls, the Date counterexample
and changed-instant control, three process/restart-admission tests and the exact
psql tag-parser test. Product/Core suites, audit, npm install and accepted health
tests were not repeated. Source syntax and identity checks are separate from
runtime product acceptance.

## Consumption and open gates

Run the accepted SERVICE/Antigravity successor beside this backend in the same
environment. Another chat's localhost is not shared access. Use the Core
contract `docs/contracts/CORE-SERVICE-REAL-APP-ASSEMBLY-17.md`, application origin
`http://localhost:3008`, actual discovery/selection and current real AAL2 session.
Never synthesize CustomerContextProvider state or use the legacy RPC as fallback.

The SDK and app use private, custody-checked bindings. No credential/session is
included here. The local private delivery guide identifies selectors and the
actual current process/backup receipts. An operator must revalidate the recorded
PID/start ticks/CID and custody before any future lifecycle effect. Do not invoke
Platform12 `init`, `bootstrap`, `users` or `start` as a generic resume command;
its `start` also executes compatibility SQL. Resume uses the existing registered
containers and relay without provisioning or installer replay.

Open gates:

* accepted SERVICE/frontend discovery integration and browser entry;
* managed browser access to the official app origin (the present policy admits
  only another local tooling origin; it was not bypassed or changed);
* actual browser login/selection/Request/refresh/restart journey;
* native cancellation/pool reuse/context-leak evidence not covered by this API
  proof; existing source tests are not promoted to that witness;
* fresh restore of the new data-bearing backup, if required for recovery proof;
* independent consumer review. No hosted, staging, public signup, email,
  payment, Storage R2 or full v1.4 acceptance follows from this delivery.

Automation: **نیازمند بررسی**. Input is the reviewed source and owned target;
pin/custody/receipt/readback checks are candidates for automation. Coordinator
approves source/target and scope; Platform handles UNKNOWN, lost custody and
recovery escalation. Official Core recipe and frontend adoption are dependencies.
Value is fewer accidental replays; this classification grants no permission.
