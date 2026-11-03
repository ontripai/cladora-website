# CE012-SAVE-WRITER-BRIDGE-07 — inactive source candidate

Base/direct parent: `df73961fc9d9fbf5d90a5241bfbdfee2fb47eafc`.
Existing branch: `codex/program-ce-independent-base-02`.
Runtime binding **NULL**, no installed RPC/store/route/grant asserted.

## Concrete integration and ABI

`src/lib/community/experience-guide-save-writer-v1.ts` exports:

- `createCe012SaveWriterProviderV1(guideCommand, documentsModule|null)`:
  actual Core V2 provider using existing `resolveAuthority`; existing
  `documents-ce012-reference-provider.v1` code and
  `provider_current_state_required` policy from the official Docs connection.
- `createCe012SaveWriterExecutorV1(coreHost, retainedCoreCommand, documentsModule|null)`:
  fits the existing editor executor port. New instance per retained command;
  parses/copies the exact canonical Core command once, coalesces pending execution,
  retains the full Guide command and key on UNKNOWN, no dispatch/retry loop.
  After UNKNOWN even subsequent denial cannot discard the unresolved identity.
- `readCe012SaveWriterRelationV1(scope, command, guideCommand, expectedCoreReceipt)`:
  private historical relationship read. Reads CE row **and canonical C03 row**;
  caller JSON/committed flag is not proof. Verifies parsed-command SHA256,
  full Guide command, fingerprint, immutable target/version, CE receipt, independent
  mutation ID, actual Core receipt/hash and provider replay binding. Returns
  `runtime_binding:null`, `action_authorization:not_evaluated`; no ready/allow API.
  Not a substitute for Core ef69's locked-row then fresh server-expiry check or
  current Documents disclosure. No endpoint/public row projection is introduced.

The Documents module is a trusted server composition capability with the exact
factory ABI, **not an authority verifier callback**. No registration is installed.
Missing module/membership/Guide/mapping/store fails closed. Tests load the actual
factory from the official pinned Git object, never a handwritten allow result.
The source registry/custody that admits that module remains an integration gate.

## Store compatibility and one transaction

Existing versioned storage from
`supabase/migrations/20261014082947_experience_guide_storage_lifecycle_v1.sql`
and child locking from `20261014132000_experience_guide_child_publish_lock_v1.sql`
are reused. Immutable prior step/reference rows remain untouched. Existing Guide
must be draft at the expected version; audience/owner are unchanged. Save writes
one next-version step/reference according to the accepted mutation plan. Existing
step-ID uniqueness remains enforced: this code does not adopt/rekey old content
or weaken a collision. Legacy create/revise/publish receipt/current GET are not
save proof. No migration historical bytes are edited.

Only structural addition proposed: private append-only
`experience.guide_save_receipts_v1`, storing the canonical parsed command hash,
original complete Guide command, typed CE receipt, membership, independent
mutation ID, original DB transaction ID and canonical C03 key. This is a receipt
projection, not another idempotency/ledger engine.

Order in the unchanged Core host:

1. Core serializable transaction/locks/current authority and matched-C03 replay.
2. CE validate: actual provider bridge + official Docs factory, current membership,
   locked Guide, existing executor/evaluator/fingerprint; private plan only.
3. Core reserves canonical C03; CE mutate updates versioned Guide/step/reference
   and inserts typed CE receipt projection through the SAME scope.
4. Core generates its **own later receipt ID**, writes canonical audit/outbox and
   response_ref. CE mutation ID, CE receipt ID and Core receipt ID are independent.
5. Proposed deferred **constraint check** on the CE insertion reads that same C03
   response_ref at settlement and verifies the link and staged content/target in
   the original transaction. No post-COMMIT repair, second commit, trigger-side
   update, alternative host or receipt engine. Failure aborts all units.

SQL is only in `supabase/proposals/ce012_save_writer_relation_v1.sql`, guarded by
an unconditional55000 before DDL and ending rollback. It is not an executable
installer or an accepted database ABI. It creates no grant, role, policy, owner
transfer, module, permission or entitlement. RLS ENABLE/FORCE and revoked default
ACL are proposed; actual caller/owner/RLS capability is **NOT_READY**. Nothing
claims these expressions have been parsed/compiled/executed by PostgreSQL.
The deferred checker is security invoker; it needs a separately reviewed trusted
execution role's minimal CE insert/read + C03 read + existing storage capability.
No SECURITY DEFINER bypass or direct client access is proposed.

The relation reads the existing C03 key/response_ref; expiry/cleanup follows C03.
There is no promise of availability beyond C03 retention, no expiry extension,
repair, new retention regime or imported historical receipt. Any requirement for
longer-lived dedicated proof needs a separate Core/Docs retention decision.

## Dependency identity / review boundaries

- Core `ef69fa82e19ab269701d6df9abd7bdfd67e3e50e`: actual host, schemas,
  canonical observation provider, subject/replay hashing, current stored-relation
  reader and post-lock server-expiry gate. Consumed host/authority/replay/evidence
  source bytes match this CE Base; no Core file copied or edited.
- Docs compiler `5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa`: official immutable
  reference; **both historical slots stay BLOCKED**. Not rerun/rewritten.
- Docs provider/request `c0caf3e70d97c3d09b16cbff91188367804cba6b`: actual
  transaction-local factory, historical selector and live-request boundary.
  The factory/historical selector are absent from the CE Base. They are loaded
  from official Git objects in this offline test, not copied into CE owner paths.
  Production composition must adopt this accepted dependency explicitly; no
  fallback to Base's current-only selector or fabricated allow callback.

Core review: canonical relation, deferred-check settlement with real host, C03
retention, membership/actor, mutation/CE/Core-ID separation and official combined
reader ABI. Existing Core reader intentionally still returns NOT_READY; this CE
candidate does not change it into a full success result.
Docs review: exact immutable target/version and lineage, current vs historical
mode, neutral label/disclosure, accepted caller/module binding and genuine
historical source/custody proof. Compiler slots remain blocked until separately
accepted composition and native stored-relation evidence exist.
Platform: only after source acceptance and separate authorization, exact target
Next16.4.1/Zod4.6.6 compatibility and native serializable PG/driver/constraint/RLS/
ACL/rollback/40001/unknown-COMMIT evidence. No request to run/install is made here.

## Actual verification / exclusions

New `scripts/test-ce012-save-writer-v1.mjs` loads the actual Core Git source at
its FullSHA and official Docs Git source at its FullSHA, plus actual local CE
executor/editor/bridge/contracts. It replaces ONLY SQL transport/pool data,
including transaction settlement. It creates no connection; source-only SQL
pattern checks are not SQL parse/proof. Requires the two exact Git objects and
existing cached TypeScript/Zod; no install/fetch is hidden in the harness.

27 new controlled checks cover coherent atomic stage order, three distinct IDs,
canonical key/hash, neutral label, explicit same-wire replay, rollback, original
40001 propagation and host-owned retry, revoke/disclosure/target/version/hash/
command/Context/Workspace/Guide/membership mismatch, C03-backed reader and forged
expected receipt, corrupt persisted bindings, synchronous coalescing, private
snapshot isolation, lost COMMIT reply through the real editor retaining its
command, and denial after UNKNOWN. A modeled deferred failure is labeled only
as a transport model; actual constraint firing is NOT_RUN_NOT_PASS.

Full typecheck and scoped lint/syntax/diff checks are recorded in manifest.
No CE010/CE011/G1/G2 accepted suite, old126case matrix, native selector or Docs
compiler suite was repeated. CE010/CE011 frozen source is unchanged.
No Auth/SQL/PG/Storage connection, notification, installation, grant, activation,
package/lock/config change, merge/deploy or Production operation.

Automation: CE012 remains **needs review**; input is the existing version-bound
save command, possible automation is draft preparation only, human editor saves,
execution requires accepted current authority/Docs/custody, UNKNOWN/mismatch goes
to the responsible editor and Core/Docs integration owner, dependencies above,
value not measured. Classification grants no execution authority.

## R1 — CE-WR09-F01/F02 owner delta (current candidate)

Direct parent: `d767e84a6d8489ee731f64eb5c8b38f29d35a7fe`.
Review: Core `ae8107ad170139b650e884863f83ccb0db63edf2`,
`docs/contracts/core-ce012-writer-joint-review-v1/README.md`.
The original implementation/evidence above is retained as history; these two
findings and the following checkpoint/caller changes supersede its open gaps.
Source acceptance remains with the coordinator/Core/Docs, not this owner report.

| Finding | Owner delta | New controlled evidence |
| --- | --- | --- |
| CE-WR09-F01 HIGH | Official Core resolveAuthority + bindCanonicalCurrentAuthorityObservationV1 after the last Docs/executor waits; private plan hash, canonical command hash, scope/attempt and checkpoint authority retained together. Same primitive again after Core C03 reservation, immediately before first domain-effect dispatch. Post-effect checkpoint after CE receipt insertion rolls back all staged effects on failure. Replay also has the post-Docs checkpoint. | Base commits after modeled membership expiry at Docs barrier and C03 reservation; R1 denies/rolls back both with no Guide effect. Metadata actor/transaction/isolation mismatches deny. Expiry across a CE write wait rolls back. Same original40001 at all3 added checkpoints reaches Core's existing retry unchanged. |
| CE-WR09-F02 | buildCe012NewSaveCommandV1 accepts a strict new-command input WITHOUT step_id or payload_fingerprint. It allocates one fresh UUID for the next content-version storage row, then computes the existing fingerprint, then returns the parsed command for Core mapping/editor retention. The writer never changes an already submitted body/key/step ID; existing global PK stays intact. | Two new saves advance1→2→3 with different step IDs and preserve first CE/C03 receipts. Deliberately reusing an existing ID remains a negative collision with full rollback/history unchanged. Actual unchanged editor calls builder once through lost COMMIT ACK, later denial, and explicit successful replay; exact body/step/key/hash retained. |

### Checkpoint binding / limits

Checkpoints consume the existing Core capability in the SAME scope; there is no
client allow/session callback, new evaluator/host or retry loop. Each invocation
validates transaction/session actor/isolation, scope identity before/after await,
canonical revision, membership/Context elapsed expiry and current evaluator /
entitlement binding via Core. Command, full private plan/typed receipt hash,
checkpoint authority and scope/attempt are retained in one WeakMap record.
The returned evidence uses the same canonical decision/authority/attempt binding;
mutation verifies plan/command/scope again and rechecks that authority. No new
wire/receipt/evidence field or arbitrary client deadline is introduced.

This is an observation at an explicit checkpoint, NOT a time lease. The existing
Core primitive itself has awaited reads; membership/Context clock semantics and
native participation/evaluator/driver behavior remain Core/native proof gates.
The post-effect checkpoint catches expiry across CE mutation waits and aborts
through the existing host; later Core audit/outbox/COMMIT awaits remain the
unchanged Core checkpoint/rollback contract and are NOT claimed drained or
covered until ACK. JWT/session policies not present in that official primitive
are not invented in CE. No native COMMIT/revoke/expiry guarantee is claimed.

### Storage identity contract

step_id denotes the immutable globally unique physical guide_steps row for ONE
content version. It is not a reusable logical step ID. Build only a genuinely new
command after resolving any prior one. Allocation precedes fingerprint, Core
input_fingerprint mapping, serialization and editor command retention. Subsequent
UNKNOWN or explicit replay consumes the retained command; no new UUID, body or key
is allocated. Changing an unresolved command or attempting to adopt historical
rows/receipts is prohibited. A future stable logical step identity would need a
separate versioned contract; no such storage/API change is made here.

Raw prebuilt commands remain schema-compatible and never get silently rekeyed;
if their storage ID collides, the existing PK rejects and Core rolls back. The
strict builder makes the canonical caller precondition executable, while the PK
remains the final concurrency barrier; UUID generation is not proof of native
uniqueness or successful persistence. No route/UI caller has been activated.

### R1 verification

New `scripts/test-ce012-save-writer-r1.mjs` consumes ONLY the reviewed Git-pinned
fixture/loader prefix from Core09 (SHA256 recorded in manifest), not its23 test
cases. The loader reads actual Core09/Docs source from Git and actual local CE;
--before reads the exact CE Base instead. The SQL pool/clock/PK/transaction are
controlled transport models, never a PostgreSQL implementation/constraint proof.
No Core/Docs/Platform source is copied into owner files or edited.

- --before:3 diagnostic groups, BEFORE_COUNTEREXAMPLES_NOT_PASS.
- Current source:10 new groups PASS; includes3 session metadata negatives and
  original40001 checks at3 checkpoint boundaries.
- Refined UNKNOWN/editor case run alone after test refinement:PASS, actual editor
  allocates through builder once; denial preserves UNKNOWN before explicit replay.
- Full TypeScript existing config, scoped lint, syntax and inventory/diff checks.
- Original CE27/Core23/CE010/CE011/G1/G2/Docs suites NOT_RERUN.

Proposal SQL is byte-identical to the parent. No SQL/Auth/DB/Storage/install/grant/
activation/merge/deploy occurred. runtime=NULL, current authority/disclosure/custody
native evidence NOT_RUN_NOT_PASS; both historical compiler slots remain BLOCKED.
Exact target Next16.4.1/Zod4.6.6 unavailable locally; no install/repair. Automation
classification remains نیازمند بررسی; dependency/authority/value gates unchanged.

Latest related coordination observed before delivery: Core D06 successor
`acea0d067099dffe8cecacc36b78e2755f51ee13`, report
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6585604856.
Its OPEN D06-C02 joint terminal authority/Docs disclosure port is NOT supplied or
closed by this R1. This task still targets the explicitly pinned Core09 F01/F02
review and original Base; no silent rebind/adoption to the newer composition.
R1's canonical checkpoints address the reproduced writer boundaries only; they
are not that missing joint terminal disclosure capability. runtime=NULL and both
historical slots remain BLOCKED pending the separate official joint/native gate.
