# PLATFORM-V14-LOCAL-RUNTIME-LANE-01

Base/parent: `1afe40aedbfc44855ccea676fb92fd4e6ec61e83`.
Branch: `codex/program-local-runtime-lane-01`.
Authority: #463 comment6570801523. Scope: synthetic disposable provision, real
PG/Auth health, isolation and destruction. This is not domain installation,
session acceptance, managed-Supabase compatibility, hosted Preview or email proof.

## Continue from existing profiles

`baseline-v14.manifest.json`, `prepare-local-migration-profile.mjs` and the staged
SERVICE script remain byte-identical. The first is a 299-migration application
replay, not an empty PG/Auth provision profile. The SERVICE script also invokes
privileged finalization. Neither was executed. Native source guards, including
the inactive Building source and successor300 admission gate, remain unchanged.

The additive `runtime-lane-v1.json` reuses the previous verified PG17 digest and
the existing local config's no-signup policy. GoTrue's version comes from the
official Supabase CLI v2.121.0 image catalog, with the linux/amd64 registry
descriptor and image ID pinned. It does not use an invented Auth session.

The retained CLI wrapper's help command failed at read-only home initialization
(`EROFS`, `.supabase` creation); no home permission change or global install was
attempted. The existing Go helper's help was readable but does not expose the
whole start stack. The new small Docker adapter only provisions the PG/Auth
subset; it is not a parallel business transport, authority system or installer.

## Invocation and boundaries

```sh
python -B scripts/test-local-runtime-lane.py
python -B scripts/run-local-runtime-lane.py --run-directory /absolute/private/fresh-run-directory
```

The run directory must not exist. A completed or unknown directory cannot be
replayed. The runner writes its stage receipt before each dispatch and uses the
managed Unix Docker socket explicitly; inherited Docker endpoint/TLS selectors
cannot redirect it to another daemon. The caller must first read the environment
Docker/network guide, verify its managed environment and inventory, and retain
the inherited registry proxy/CA trust. This delivery made no dependency install.

Workloads have no external route: PG `network=none`, Auth joins that exact PG
network namespace and only uses loopback TCP. No published host ports, host
network/PID, bind mounts, named volumes, additional capabilities or root user.
Both run as999:999 with read-only rootfs, ALL capabilities dropped and
no-new-privileges. PGDATA/socket and temporary files are bounded owned tmpfs.
Host/cloud credentials are not inherited into child CLI environments; generated
fixture JWT material stays in process/daemon configuration and is redacted from
private inspection/process logs. No credential, user rows or raw logs are in the
public receipt. Docker control-plane image acquisition is the only registry
egress; the application/container namespace has only `lo`, not an HTTP proxy path.

The only explicit fixture SQL is PG identity, creation of an empty `auth`
namespace and catalog existence of Auth tables. Real GoTrue then runs its own
version-pinned provider schema migrations. There is no application schema/seed,
native installer, GRANT, fixture account, signup, login, email or admin-confirm.
This Auth database uses a disposable postgres operator, not the managed staging
role graph. Consumers must not infer production/managed authority from it.

## Actual attempts and changed condition

- Attempt01: PG17.11 healthy; GoTrue's initial migration failed with SQLSTATE
  `3F000` because its required empty `auth` namespace was absent. Auth HTTP health
  did not pass; Auth catalog/network probes after that point were NOT_RUN. Both
  owned containers were removed and absence acknowledged. Acquired image removal
  acknowledged. Private raw evidence is retained; no raw SQL log is published.
- Attempt02: a source/profile change added exactly `CREATE SCHEMA auth
  AUTHORIZATION postgres` before GoTrue's own migrations. This was a new fresh
  fixture under changed inputs, not automatic replay of attempt01 or any prior
  rehearsal. UTC08:33:14–08:33:40 on2026-11-02.
- Observed PG identity: `170011|postgres|postgres`. PG17.11 is real, not mocked.
- GoTrue `/health`: HTTP200, `v2.197.0`; `auth.users` and
  `auth.schema_migrations` existed. No session or account was fabricated.
- Prestart/live config checked; loopback-only interface/route and UID/GID proof
  succeeded. Docker28.4.0 managed daemon was actually reachable in revision83.
- Auth container and PG container: destruction and exact-ID absence acknowledged.
  Newly acquired images removed after checking no remaining consumer.
- Five focused offline negative tests passed, followed by two distinct delta tests
  for secret redaction and Auth namespace ordering; the five were not replayed. Previous product/backend69,
  baseline migration and accepted wire/module/access suites were not replayed.

The first primary error remains in attempt01's receipt. Nothing in attempt02
rewrites it as PASS. Session, domain install, provider-issued end-user identity,
RLS/business writes, email and hosted compatibility remain NOT_RUN.

## Consumer contract / gates

Dependency: `LOCAL-PG-AUTH-01`, producer Platform, consumers
Core/SERVICE/AIRPROP/CE, version `runtime-lane-v1`.

Request: exact profile/source hashes, fresh private run directory and separately
approved consumer source/request. Response: version/image/CID identity,
prestart/live isolation results, stage outcomes and cleanup acknowledgements.
Errors: first-error ends later startup stages; timeout is UNKNOWN, never success
or automatic retry. Idempotency is no-reuse of run directory, not replay of SQL.
Authority is the scoped owner instruction and producer/consumer request, not a
GUC/boolean or a successful health receipt.

Default command destroys the fixture after health. There is **no live shared
database endpoint** left for consumers after this proof. A consumer must bind its
new focused test lifecycle to an owned invocation, before destruction, under its
own reviewed request. There is no arbitrary `--exec` or unchecked consumer hook
in this provision-only runner. Platform's adapter class is reusable, but this
delivery does not claim CONNECTED_TESTED consumer/domain flows. Native SQL must
reference Core's accepted successor300+ source/request, never baseline replay.

Known operational limits: process/container inspect is a point-in-time witness;
the Auth provider version is real but health alone is not login/claims proof.
No failure injection into real daemon storage or crash recovery was run. A
timed-out pull/create can leave daemon-side activity: quarantine that run, inspect
only its name/label/CIDs, and ask Platform to reconcile it; never rerun a consumed
directory or prune other resources. Preserve private evidence at least30days.
Receipts mark unknown cleanup rather than claiming residue proof from deletion.

## Evidence

`docs/testing/local-runtime-lane-01.receipt.json` contains sanitized actual
attempts, image/source pins and private receipt hashes. Raw process logs, Docker
inspect payloads, generated material and any catalog remain private with Platform.
The public source/profile/test/docs are the only branch changes; no app, workflow,
native installer, package/lock, Production or staging setting changed.
