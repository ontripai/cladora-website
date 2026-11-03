# CORE-CE012-HOST-TERMINAL-LIFECYCLE-11

Base/direct parent: `534be1a3d69a3b36d0f04edc555bf01c3d666842`.
Branch: `codex/program-core-service-s01-producer-01`.
CE R1: `0191e0415297a76f3073cbeef7396f4799d3a25c`.

## Worklog — exact planned paths before edits

- Modify `src/lib/core/postgres-transaction-host-v1.ts`: host-owned optional terminal lifecycle, actual final checkpoint, seal, settlement/result identity.
- Add `src/lib/core/ce012-host-terminal-checkpoint-v1.ts`: fixed Core-owned late checkpoint, actual persisted CE/C03 input; no caller callback/allow.
- Add `scripts/test-core-host-terminal-lifecycle-11.mjs`: new controlled-transport lifecycle cases.
- Add `scripts/test-core-host-terminal-regressions-11.mjs`: genuinely affected legacy Core/CE/S01/SERVICE couplings, explicit source-pin adapter for changed shared host.
- Add this README and `docs/contracts/core-host-terminal-lifecycle-v1/manifest.json`.

No CE/Docs/S01/SERVICE/evaluator/SQL/package/config edit. D02/D03/D04 remain separate. Runtime NULL and historical slots BLOCKED. No SQL/PG/Auth/install/activation/merge/deploy.

## Outcome and exact ABI

T10-D01 is implemented at the **source level in an inactive opt-in path** of the
existing `createCorePostgresTransactionHostV1`. It is not a second transaction host,
new authority evaluator or disclosure gate. Legacy consumers do not opt in and
retain their existing command/receipt/result contracts and SQL dispatches.

Trusted server providers may declare ONLY the literal:

```
terminal_checkpoint: 'core-ce012-host-terminal.v1'
```

This opt-in is accepted only for the existing V2 CE experience_guide/provider ABI.
A callback, true, JSON settlement/observation or another policy is not accepted.
CE R1 is consumed from Git; its owner file is not edited or automatically enabled.
Core's private host invokes the ONE fixed Core-owned late checkpoint module. Its
input is the parsed host command, actual host receipt and actual locked CE row;
no caller-supplied observer/provider/verifier runs at this terminal point.

Read-only private result inspection ABI, `core-host-terminal-lifecycle.v1`:

- `coreHostTerminalLifecycleV1(result)`: metadata only for the EXACT result object
  returned by this participating host. A JSON clone/foreign result returns null.
- `coreHostTerminalResponseMatchesV1(result, bytes)`: true only for that recognized
  result identity AND its exact UTF-8 JSON bytes. This Boolean is a comparison of
  host-owned evidence, never an input that establishes settlement or permission.

No issuer/register/ACK function is exported. Only host-private code can populate
the result WeakMap. The private seal retains the actual Core observation/binding,
its hash, fixed response bytes, response hash, backend PID, DB transaction and
attempt. The seal hash domain includes the versioned lifecycle contract.

Metadata names distinct outcomes: committed, replay_rolled_back, rolled_back,
unknown, not_started. Positive correlated evidence is sealed_and_closed; failures
are invalidated, with no observation/seal hash. All metadata declares
`disclosure_authorization:not_ready`, `live_observation:false`,
`reusable_in_other_attempt:false`. It exposes no private label, raw receipt/body,
session ID, secret or raw error. Only bounded SQLSTATE may be recorded.

`response_encoding=core-host-result-json-utf8.v1` means JSON.stringify of the
immutable host result, with no trailing newline, encoded UTF-8. It is NOT the
subsequent CE typed-receipt wrapper, Documents projection, HTTP headers/wire bytes,
client ACK or delivery. Any later wrapper/projection needs its own exact binding
under the separate Documents contract; this source does not claim it is covered.

## Host-owned sequence / no raw-scope bypass

1. For each opt-in attempt create a fresh private lifecycle before checkout.
   Install a lease error listener. Validate BEGIN command completion, then read
   backend PID/DBtx/isolation from that same client. No second connection is opened.
2. Every host SQL dispatch, including setup/locks, C03, provider clocks,
   jurisdiction projection, mutation/audit/outbox/response_ref and cleanup, passes
   through one `wire`. Every normal query invalidates an earlier premise; every
   provider await/invoke boundary also invalidates it. Pending raw-scope queries
   are drained. First driver/lease error is retained, not replaced by cleanup.
3. Existing validation/mutation/receipt logic runs in its original order. No
   effect is moved outside the existing transaction; no new domain/audit/outbox or
   command reservation is created to simulate reading. The terminal path runs only
   after full C03 response_ref exists (or after all replay validation/clock waits).
4. Permanently close the consumer's RAW scope before the final import/checkpoint
   awaits. Captured/raw query methods cannot regain read or mutation access. An
   attempted late dispatch poisons/invalidate the attempt even if its rejection is
   caught by the provider. During COMMIT uncertainty this yields UNKNOWN, not a
   successful seal or automatic resend.
5. A host-private, read-only terminal scope runs the fixed Core hook. It checks
   native session first, reads the actual CE relation and runs the unchanged Core10
   port/provider/evaluator over the real original command and host receipt. Scope
   identity, CE/Core/mutation/key/hash/target/version remain Core10 bindings. The
   host independently binds command/key/hash/actor/tenant/Context/Workspace,
   receipt/hash/mutation/revision, attempt/DBtx/PID and target lock-set to its own
   local state. This is registration of a real Core subset observation, not caller
   JSON. All its waits still pass through the host wire.
6. After all pending operations/checkpoint completion, verify no error/in-flight
   work, take a deep immutable response snapshot, register the actual observation
   and seal its exact byte image. There is NO owner callback after this point.
7. Only the explicitly classified SAME-client settlement command may follow seal:
   COMMIT for a new mutation, ROLLBACK for exact replay. No other query/phase/await
   can silently preserve the seal. A normal query would invalidate it. Raw scope
   is closed; any attempted raw call fails and poisons the seal.
8. Require the correct command tag on settlement completion, then recheck the
   private seal/generation/first-error/in-flight/result identity/byte image before
   publishing identity-bound metadata. Retry creates a completely new lifecycle.
   Release/close invalidates all live premises. The returned evidence is a CLOSED
   historical correlation of that response, not a reusable live observation.

COMMIT is a specifically classified settlement wait, not an authority renewal.
D02 still governs whether authority remains valid across internal/native waits.
If COMMIT completes but a concurrent invalidation prevents a valid result, return
UNKNOWN and do not retry. Even a concurrent40001 event is not proof that a positive
COMMIT was aborted. Only a40001 rejection of the COMMIT wire itself permits the
existing bounded abort/retry path. New-write lost ACK/missing tag remains
UNKNOWN; cleanup ROLLBACK cannot undo an unknown COMMIT. Positive ROLLBACK response
to COMMIT is an abort, never a committed response. Exact replay is positively
rolled back and is never called a new COMMIT. Callback/pending/late-checkpoint or
cleanup failures cannot produce positive evidence. Cleanup exceptions preserve
the first failure and prevent returning the pending success object.

Normal pg QueryResult promise completion follows its handleReadyForQuery callback
in the pinned pg driver (`node_modules/pg/lib/query.js`). This source relies on
that supported query API plus strict CommandComplete tag, one lease and checked
backend identity; it does not read private socket flags, invent ReadyForQuery-I
telemetry, or claim a native driver/protocol run. Native same-backend/settlement
and concurrency acceptance remains NOT_RUN, requiring a separately authorized lane.

## Compatibility and separate gates

No existing provider automatically receives the terminal policy. Without opt-in,
no extra SQL, event listener, response freezing or lifecycle metadata is added;
the same wire dispatch calls the existing client. The generic V1/V2 command host,
legacy CE replay and S01/SERVICE retry/deny behavior are tested as affected by this
shared-host edit. Original caller guards, authority/permission/MFA, idempotency,
request/receipt hashes, mutation/audit/outbox atomicity and receipt schema remain.

T10-D02 (authority validity frontier/session and all-writer participation), D03
(current official Documents projection/terminal disclosure), D04 (native internal
SQLSTATE propagation) remain NOT_READY. The fixed Core hook returns only Core10's
observed subset; even a sealed committed lifecycle is not authorization, custody,
current disclosure, or native proof. No private label is projected. Runtime remains
NULL and the two historical Documents slots remain BLOCKED. Neither valuation
policy nor retention/cleanup/other-reader behavior is imported or changed.

## Verification (all source/controlled transport)

- `node scripts/test-core-host-terminal-lifecycle-11.mjs`:22 NEW groups. Real
  current shared host + Core10/Core09 + exact CE R1 and pinned Documents modules;
  fixture definitions reused without running old test invocations. New-write
  commit, replay rollback, identity/bytes/immutability, pending drain, host waits,
  raw-scope bypass, retry, unknown/false ACK, late40001 versus actual COMMIT abort,
  backend/error/close, denial rollback, first-error/cleanup are covered.
- `node scripts/test-core-host-terminal-regressions-11.mjs`:11 specifically affected
  controls:5 selected existing Core/CE cases plus6 S01/SERVICE serialization and
  host coupling cases. No owner file changed. The existing S01 script asserts an
  immutable historical host source pin, which must legitimately differ here.
  The dedicated runner retains that assertion against the exact accepted Base
  host AND checks the current host against its full manifest hash. Other shared
  and SERVICE module/helper pins remain unchanged. Only an ephemeral exact-boundary
  pin adapter is used, deleted in finally; no assertion is removed or weakened.
- Full unchanged ES5 typecheck, limited lint, syntax, diff, inventory/source-pins
  and seal are checked with existing locked Next16.4.1/Zod4.6.6 dependencies.

No DB/SQL/parser/PG/Auth/trigger/native locks/ACL/concurrent session or driver proof,
installation, activation, merge/deploy or full Release acceptance is run/claimed.
Mock transactions/ACKs are controlled transport witnesses, not native receipts.
Previous full suites and source ancestry chains are not rerun for status.

قابل خودکارسازی: نیازمند بررسی؛ ورودی attempt/مشاهده/پاسخ همان host، فرصت کنترل seal و ارجاع UNKNOWN؛ تصمیم انسانی Core/CE/Documents/coordinator؛ اجرای واقعی فقط پس از پذیرش source و گیت‌های رسمی؛ استثنا/مغایرت به همان مالکان؛ وابستگی D02/D03/D04 و proof native؛ ارزش سنجیده نشده. این ثبت مجوز اجرا نیست.
