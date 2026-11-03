# Original Documents inspection entry —09

Parent: `dbc447306e37ee3c9e0cbce69b48ae9479d44dd4`.
Branch: `codex/program-local-runtime-lane-01`.
Consumer: `c0caf3e70d97c3d09b16cbff91188367804cba6b`, request.v2.

**PASS_ORIGINAL_OFFLINE_INSPECT_ONLY**. The unchanged original
`scripts/docs-ce012-live-connection-v1/run.mjs --inspect-request` was executed
once in the existing08 private601-file context. No replacement inspector was
written. Original entry/admission/closure/request/inventory and all601 source/
runtime bytes remain unchanged.08 materialization, verifyMaterials,13groups and
20cold operations were consumed as accepted historical evidence, not rerun.
Required freshness checks are byte/alias checks immediately around this entry's
import; the original inspector itself performs its own inventory validation.

## Real output

Process exit0. The original stdout is one JSON record with these exact fields:

```json
{
  "contract": "documents-ce012-live-connection-request.v2",
  "request_sha256": "3ca7a18b4789d262565dc3289cf029d633b36a0fa155c5f3a575dfeedc619873",
  "source_inventory_sha256": "6388b257096dbc094f9513e40a06cebaf9042f55720b89c93cfd89b68b717a11",
  "runtime_closure_sha256": "55093d835a860ceeb414fbd097d3b62af2520e60cee5b093763ff7f983f928ee",
  "live": "CLOSED_PENDING_COORDINATOR_ADMISSION"
}
```

Cleanup: ACKNOWLEDGED_PROCESS_EXIT_PIPES_CLOSED. The owned process was reaped and
all parent-owned pipes closed. Kernel/loader state ends with that process. The
original materials and private logs/receipt are retained; no lab/DB/Auth/container
resource was created or deleted. Failure/timeout/unknown creation cannot become a
cleanup or inspector PASS; first error is preserved. No inspection retry occurred.

## Fixed launcher and gates

`inspection-entry.py` accepts only two operator paths: existing materials scope
and a fresh private evidence directory. Mode, target entry, binary pins, flags,
environment and import graph are fixed by hash-pinned inspection-policy.v1.json.
There is no SQL/shell/--exec/eval/user-selected entry, mode, callback, approval or
fixture input. `approved:true` cannot authorize another action.

Launch only with isolated/no-bytecode Python and the exact clean environment:

```sh
env -i LANG=C.UTF-8 NODE_ENV=production TZ=UTC PINNED_PYTHON -I -B scripts/docs-ce012-platform-v1/inspection-entry.py --materials EXISTING_PRIVATE_08_SCOPE --run-directory FRESH_PRIVATE_EVIDENCE_PATH
```

This is a per-command offline environment. Parent Git/proxy configuration is not
changed. An ambient PYTHONPATH was rejected during launcher preflight before
producer import; the fixed clean environment satisfied the unchanged guard.
The child environment actually contains only LANG/NODE_ENV/TZ: no token, DB URL,
fixture, signature, Node options/path, preload or provider credential.

The launcher consumes08's accepted material-file seal and fresh-checks source
hashes, limited relative paths, canonical private roots, inode/hardlink/symlink
aliases and drift before import. Its new three-file source seal is separate from
the unchanged17-path runtime seal. The source manifest excludes its own hash;
the policy has an external raw-byte hash, not a circular self-hash.

`inspection-gate.mjs` is a preload guard, not an inspector. It checks exact argv,
execArgv, environment, read-only Node permissions, current source pins and inputs
before producer import. Its loader returns only the original hash-verified ESM
bytes, without rewriting them. Only run.mjs/admission.mjs/closure.mjs and their
exact fs/url/crypto/path builtin edges are allowed. Unknown or unapproved dynamic/extra imports,
argument/env injection, drift, symlink and alias fail closed. A final exit check
checks retained bytes and the exact three-module closure. No pg/live/measure,
provider/selector or package runtime module was imported.

## Kernel evidence and permissions

Existing, pinned libseccomp2.6.0 was used, with no install/upgrade/Docker. The
owned helper sets no-new-privileges and installs a seccomp filter **before Node
exec**. It denies socket/socketpair, connect/bind/listen/accept, socket send/recv,
socket options and io_uring syscalls. No network FD is inherited: stdin is
/dev/null, stdout/stderr are owned pipes, and the bounded kernel-receipt pipe is
closed before exec. Unknown inherited descriptors abort.

Actual kernel filter count1→2; NoNewPrivs=1 and Seccomp=2. AF_UNIX/AF_INET/AF_INET6
socket creation probes all returned EPERM. These are denied local syscall probes,
not network requests or DB connections. Node retained filter count2 and the same
PID across exec. Only then could the producer entry load. The restriction is
inherited by descendants; Node child/worker/addon permissions were also absent.
This is not a general traffic trace or a native networking/provisioning proof.

Node v24.19.0 ran with --permission and --no-addons, read access only to existing
materials, fixed Platform bootstrap/policy/manifest, pinned Node bytes and kernel
status. No file-write/child/worker/addon capability was granted. Process deadline
15s, independent cleanup deadline2s,64KiB maximum capture per stream. No fallback
or automatic retry. The actual load set was exactly the three producer ESM above;
no Client/Pool construction, connection, SQL/Auth or business operation occurred.

## Targeted evidence and boundaries

Seven NEW wrapper tests PASS: fixed CLI, early env-injection rejection, tool/source
pins and closed authority, drift/alias/symlink, fixed Node argv, unknown creation/
cleanup non-success, and forged approved receipt rejection. Tests use synthetic
temporary byte fixtures and mocks only for negative boundaries, never substitute
an inspector or manufacture a real session/provenance/receipt. Real JS ESLint,
Node syntax and Python AST/import syntax checks PASS. No accepted08 suite replay.

native_consumer_verified=false, runtime=NULL, registry=EMPTY and live=HOLD remain
unchanged. Both historical slots remain BLOCKED. Native target/session/owner
provenance/stored-receipt relations and coordinator admission are still separate
gates. Success of this offline inspector is not native/hosted acceptance.

Automation: existing Platform CE012 process remains «نیازمند بررسی». Opportunity:
bounded pin/argv/readback checks; dependencies: coordinator review and separately
bound native/custody/receipt/owner authority. Value not measured. Existing08's
seven process fields remain applicable; no new product workflow/automation engine
or another owner's Tracker row is created.

Skills: Cloud Environment Runtime plus networking reference were read; visible
version UNKNOWN. Current AGENTS/#463 and CLADORA-SKILLS-USAGE v1.1.0 read:
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482.
This source-only inspection changes no product/profile/custody/transport/package/
lock or other owner's files. No Docker/PG/Auth/install/grant/activation, branch
creation/force/rebase/merge or deployment occurred.
