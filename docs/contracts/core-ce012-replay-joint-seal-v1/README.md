# CORE-CE012-REPLAY-JOINT-SEAL-13

Base/direct parent: `1eb8b5a1e522a529b39af02e32748756ee04dfec`.
Branch: `codex/program-core-service-s01-producer-01`.
Documents source: `6f69db12455b9c750eae0c2a24c7a7c7faa16d3d`.

## Worklog — planned exact paths before edits

- MODIFY `src/lib/core/postgres-transaction-host-v1.ts`: trusted replay-only entry, early locked C03 guard and private joint seal.
- MODIFY `src/lib/core/ce012-host-terminal-checkpoint-v1.ts`: fixed optional actual Docs composition at host-owned late boundary.
- ADD `src/lib/core/ce012-documents-joint-candidate-v1.ts`: fixed owner-module import/opaque observation admission; no caller provider/allow.
- ADD `scripts/test-core-ce012-replay-joint-seal-13.mjs`: new security/coupling cases with actual pinned Docs code.
- ADD `scripts/test-core-ce012-replay-regressions-13.mjs`: selected affected Core/CE/S01/SERVICE regressions with explicit current-host pin.
- ADD this README and `docs/contracts/core-ce012-replay-joint-seal-v1/manifest.json`.

Core12 and all installers/guards/other-owner files stay byte-identical. No SQL/PG/
Auth/install/activation. Runtime NULL and historical slots BLOCKED. Docs module
availability in the final source assembly remains a real gate, not an invented
installed dependency. No owner implementation is copied into Core.

Additional exact planned Core path, recorded before creation:
`src/lib/core/ce012-replay-only-preflight-v1.ts` — reuse official locked C03/expiry
SQL and strict receipt schema before any provider/fresh-validation dispatch.

## Delivered versioned source

The SAME existing Core host now returns an additional trusted-server method:

```
executeReplayOnly(originalCommand, officialProviders)
contract: core-ce012-replay-only.v1
```

There is no HTTP route or client replay/allow flag. The ordinary execute method
retains its default write behavior. Replay-only is constrained to existing CE V2
experience_guide/provider ABI and automatically uses Core's host terminal policy.
Unsupported policies/command families fail; an arbitrary callback/module supplied
in extra provider properties is never an admission primitive.

### Locked C03 preflight before dispatch

Replay-only takes the existing host locks and same-backend identity, then invokes
a fixed Core preflight BEFORE resolveAuthority, validateReplay or any fresh provider
validation. It reuses OFFICIAL Core C03 SELECT/FOR SHARE and the separate post-lock
server-expiry SELECT. Exactly one complete canonical persisted V2 receipt must
match original parsed command/key/hash, original actor, tenant/Workspace/Context,
transaction/subject/version, provider/replay binding and same SQL scope/DBtx.
Missing/expired/ambiguous/malformed/mismatched input yields bounded denial and
rollback. No reservation, mutation, audit/outbox or fresh persisted receipt exists
on this path; no current GET or caller JSON substitutes for the C03 row.

Expiry is strictly > fresh database time after row-lock wait; no JS clock or fake
expiry is used on this path. The old Date-based check remains only in the unchanged
default write/replay entry. A valid preflight does NOT grant permission: subsequent
current canonical authority and official replay/provider checks still run. The
cached strict receipt cannot fall through to fresh validation; a second explicit
replay-only barrier precedes the default fresh branch. Host phase stays read-only
at the trusted provider boundary (SELECT/row locks, not PostgreSQL READ ONLY).
That boundary is not a public arbitrary-SQL sandbox; only official trusted modules
may receive the scope. Current native principal/ACL/RLS participation is not proved.

## Actual opaque Documents candidate in the shared seal

The required producer exports EXIST in official input6f69db1:
`createDocumentsCe012TargetDisclosurePortV1`, its `observe` and `inspectPrivate`.
The fixed Core late hook constructs the REAL factory on its host-private terminal
scope with actual persisted original CE/Core input, never a caller port/verifier.
No owner implementation is copied or changed. Factory's actual WeakMap recognizes
its own opaque observation and rechecks Core binding before/after its official
selector waits. This transitive source check binds original command/key/hash,
independent CE/Core/mutation identities and exact target/version to the same scope.
The ordinary Core10 structural binding is also independently matched to host local
command/receipt/attempt/backend/DBtx/revision, as in Core11.

Core verifies the private projection's exact immutable target/version and neutral
label but does NOT export that label or a projection. It retains the ACTUAL opaque
owner object, immutable descriptor/target and Core binding in private host state.
A host-local random candidate ID is an in-memory observation correlation only,
NOT a receipt, authority grant or durable write. Candidate descriptor/binding hash
participates in the same seal as exact response bytes and backend/attempt/DBtx.
No caller candidate/data/module/allow/JSON or callback can populate this registry.

Versioned read-only metadata:

```
coreHostJointReplaySealV1(exactHostResult)
contract: core-ce012-joint-replay-seal.v1
status: not_ready
registration: closed_opaque_candidate
settlement: replay_rolled_back
current_authority: not_evaluated
projection: null
```

Only the exact object returned by this host is recognized; copies/JSON return null.
Metadata includes candidate ID/hash, target/version, exact response/seal hashes,
attempt/PID/DBtx. Actual token/binding remain in the private WeakMap. It is a CLOSED
source/settlement correlation, not live authority, a public projection, custody,
or a reusable permission in another attempt. Historical receipt/hash are unchanged.

### Order and invalidation

All Core11 tracking remains: raw consumer scope permanently closes before final
hook; host/provider waits and queries invalidate earlier premises and pending work
must drain. After initial real Core checkpoint, actual Docs observe executes its
own Core-before → official selector → Core-after sequence. Core registers the
result only AFTER those awaits. No later read/query/callback is permitted.
The host-private terminal query window also closes permanently when the fixed hook
returns, so even a retained internal/owner facade cannot dispatch after sealing or
outside the transaction. Attempted late raw/internal queries poison the attempt.

The actual owner instance is synchronously inspected before seal/after the sole
allowed same-lease ROLLBACK completion, then closed on invalidation/retry/cleanup.
Any other query/wait/error invalidates the host seal; unknown rollback ACK/cleanup
cannot register a candidate. COMMIT is never sent by replay-only. Existing default
COMMIT/UNKNOWN behavior remains, including no retry after a positive COMMIT with
concurrent invalidation. Original driver-visible40001 still goes through existing
bounded host attempts; no retry/resend engine is introduced.

The designated settlement wait closes the observation historically; it does NOT
renew currentness or solve D02/internal waits/session invalidators. D03 current
projection/publication and D04 native error propagation also remain separate.
Runtime NULL, no disclosure permit, and both Docs historical slots BLOCKED.

## Real dependency / assembly and owner adoption gates

The owner file is present in Git input6f69db1 but ABSENT in this Core Base tree.
Core uses ONE fixed internal module path, not a configurable loader/registry. The
new candidate adapter imports only that official factory; no injected substitute
is accepted. Native composition must supply the EXACT reviewed owner source and
transitive dependencies at that path. Module/export absence throws/rolls back;
a negative controlled-loader case confirms it cannot be repaired by caller data.
No installed/live/native dependency or successful production bundle is assumed.

Tests consume real official Git source in a read-only resolver, without copying
owner files to the branch. Current worktree ES5 typecheck and a separate scoped
real-owner ABI/transitive typecheck with Git overlay both pass. The former does
NOT prove that a variable module import has been included correctly in a production
bundle; full final-assembly/bundler/runtime verification is NOT_RUN. Source pins and
module availability remain mandatory before any later runtime admission.

No producer export is invented or claimed missing here: existing real factory and
private inspection suffice for THIS non-authorizing host-owned registration.
The old owner `reconcileCore11Replay` still intentionally returns
JOINT_REGISTRATION_REQUIRED and does not consume Core13. Minimum separate Documents
adoption delta: add a read-only Core13 adopter using exact recognized result/bytes
and `coreHostJointReplaySealV1`, with original command/receipt/target/scope checks;
retain NOT_READY/null projection and source pins. An older externally created Docs
candidate is NOT the host-created token merely because its fields match. Do not
promote an independent candidate or historical compiler slot from equal hashes.
This owner file/driver is not edited and complete Documents adoption is not claimed.

## Actual validation / no native claims

-22 new source/security groups: real Core host/CE R1 and actual Docs6f69db1 factory/
  selector/WeakMap code on synthetic memory transport. Covers valid joint binding,
  absent/expired/ambiguous/malformed/mismatched C03 before ALL provider dispatch,
  exact post-lock expiry, default fresh behavior, forged caller ports/flags,
  Docs deny/target drift, original40001/retry, same-key different attempt/DBtx,
  pending/raw scope/rollback UNKNOWN/cleanup, identity and response immutability.
-1 isolated missing-official-module case: no injected module/candidate can make it
  register or return data. Module failure is a controlled resolver witness, not a
  successful production import/activation test.
-33 affected regressions:22 Core11 lifecycle/default/UNKNOWN controls plus11 selected
  Core/CE/S01/SERVICE controls. Original tests/owner files unchanged. The dedicated
  runner changes only an ephemeral manifest reference to the exact new host hash;
  historical pin assertions remain, and temporary adapters are deleted in finally.
- Full unchanged ES5 typecheck of current worktree; limited lint/MJS syntax/diff.
- Real Docs owner-module ABI + transitive ES5 typecheck through a read-only Git
  overlay, no physical owner module/probe writes, existing Next16.4.1/Zod4.6.6/TS5.9.3.
- Core12 artifacts/guards and accepted installers byte-identical. No unrelated
  Core12/ancestry/native suites rerun for status.

No SQL/parser/compile/PG/Auth/real cleanup, principal/grant/ACL/RLS, native custody/
SSI/session/concurrency/driver settlement, installation/activation/merge/deploy or
full Release proof runs. Memory setup writes and mocked ACKs are not hosted proof.
All currentness/transport/assembly/native gates remain open independently of this
Core-owned source algorithm and closed candidate registration.

قابل خودکارسازی: نیازمند بررسی؛ ورودی C03/فرمان/candidate واقعی و result همان host؛ فرصت تطبیق و ارجاع UNKNOWN؛ تصمیم انسانی Core/Documents/CE/coordinator؛ اجرا فقط با source assembly و proof/اختیار مستقل؛ استثنا به مالک همان مرز؛ وابستگی D02/D03/D04 و گیت native؛ ارزش سنجیده نشده. مجوز اجرا نیست.
