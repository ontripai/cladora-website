# Core17 owned relay CORS v2 launcher compatibility

This continues Platform17 / frontend08 / Procedure09 on the same owned development
backend. Installed Core stays `ee883b62cf4a318af3450c506931a969623b8987` and the
five-file Platform provenance stays `794f5a12c3928ae0a3585ab679a3cbe60aab49a3`.
No SQL installation, role/ACL, GoTrue configuration, container or database restart
is part of transport activation. Historical receipts and unknown outcomes remain.

The launcher consumes the reviewed `platform17.relay-cors-preflight.v2` ABI from
Platform source `b20d0bf33a01e5f846421d852c7e778aaa26f4e6`. The exact seal-file SHA256
is `c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02`.
Before Python import it verifies the closed module inventory and bytes, the
unchanged legacy five and the accepted environment-filter dependencies. Unknown
modules, alias/link substitutions and unreviewed seals fail before execution.

## Explicit operator inputs

Both build and start require these inputs for the v2 execution lane:

```text
CLADORA_CORE17_TRANSPORT_PROFILE=platform17.relay-cors-preflight.v2
CLADORA_CORE17_TRANSPORT_BINDING_SHA256=<actual reviewed private binding SHA256>
```

The digest is computed from the actual custody-checked binding described in
`scripts/functional-dev-relay-cors-v2/CONTRACT.md`. It is not a credential or an
execution grant. The existing Task17 authority remains restricted to the same
owned backend and the exact final App SHA/tree/launcher hash admitted by the
coordinator. No `approved:true`, guessed target or substituted source is accepted.

The binding is generated after the final App commit/tree/launcher bytes exist;
no commit or file embeds its own hash. Its app root must be the exact worktree
running this launcher. The reviewed Python ABI checks the real backend snapshot,
source, app identity, launcher and running v2 PID/start ticks/argv. Original
`state()` and `cid('pg')` checks remain. Its readiness result must exactly match
the selected ABI and digest. No activation is performed by the launcher.

Both selectors absent retain the historical launcher path. Partial or invalid
selectors fail; an explicit v2 failure never falls back to the old relay. A
post-transition old launcher encounters the preserved, ended v1 PID record.
The transport selectors and inherited app/admin credentials are removed from
the Next child environment. Existing proxy/CA/network and deployment guards
remain; Python additionally retains only the existing Docker config selector.
Build still receives no private SERVICE runtime binding. Next controls NODE_ENV.

## Owned-host execution order

1. Verify the final admitted App SHA/tree and clean worktree, exact toolchain,
   original backend/volumes and the immutable source records. Generate the real
   private binding from those observations and pin its digest in this run's
   explicitly authorized execution record. Templates/null fields do not execute.
2. Stop only the currently owned App after PID/start/argv/source/build ownership
   verification and a new run record. Do not rerun the old EE-app adoption claim.
3. Run the Platform `transition.py activate` operation once with that digest,
   after port3008 is free. Preserve the old pointer/history; no SQL/PG restart.
   Failure/timeout/unknown follows the transition's STOP/no-retry/no-fallback rule.
4. Check the actual v2 preflight. Supply both selectors to the existing official
   `node scripts/run-core-service-app-assembly-17.mjs build`, then `start` commands.
5. Verify actual browser OPTIONS and a new real UI login run beside that backend.
   The previous login/session outcome stays UNKNOWN; no blanket session deletion
   or replay. Continue the existing Task09 plan at the first actual boundary.

Request/refresh/retry/denial and fresh browser-Request restart acceptance remain
open until executed. The latter keeps its separate one-use claim
`PLATFORM17-INTEGRATED-BROWSER-RESTART-01`; relay activation is not that operation.
Private traces, sessions, operational binding and snapshots are not public source
artifacts. Offline source/model checks do not establish native Auth or UI success.

## Historical and current checks

The original Core17 delivery manifest and checker remain byte-identical and are
checked at their recorded EE source. A separate exact successor record binds
only the current launcher and new compatibility files. Current Core runtime,
source, shell/SERVICE tests and the new relay/launcher controls still run against
the integrated source; historical native witnesses are not relabeled as current.
