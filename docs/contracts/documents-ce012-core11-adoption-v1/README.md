# DOCS-CE012-CORE11-ADOPTION-08

**PARTIAL_READ_ONLY_ADOPTION_DELIVERED / CORE_EXTENSION_REQUIRED / NOT_READY**

Base/direct parent: `4c1f1ec70195acf6ed5e94641ea7a3a160f977c4`.
Existing branch: `codex/program-docs-ce012-provider-02`.
Core11 exact source: `847fa09039578eace8361ed00a4eedf815e03ded`.
CE R1 test dependency: `0191e0415297a76f3073cbeef7396f4799d3a25c`.

## Implemented read-only adoption

The existing Documents07 port gains `reconcileCore11Replay(observation,
actualHostResult, exactHostResponseBytes)`. It imports the actual Core11 identity
reader, response comparator and canonical receipt/hash types/functions. It does
not implement or accept a caller-issued metadata/verifier/ACK/permit. The exact
same Core module instance must recognize the result; a duplicate/foreign host
module cannot be repaired by JSON or a supplied Boolean.

No host dispatch, query, C03 lookup/reservation, new command/key, provider fresh
validation, write, retry or fallback occurs in this method. It is a bounded
synchronous comparison only. The caller must not drive a read operation through
the generic command host and assume an absent C03 is harmless (see Core delta).

| Binding | Implemented comparison | Remaining limit |
| --- | --- | --- |
| Docs candidate identity | Existing private WeakMap; same port, generation, original scope/query identity, transaction/DBtx/attempt and actual opaque Core10 observation; not closed/busy/pending/failed | Raw host phases are not a joint owner-candidate registration |
| Actual host result identity | `coreHostTerminalLifecycleV1(actualHostResult)` from Core11; JSON/clone/foreign object returns null | Closed correlation is not live Docs authority |
| Settlement | Only result `exact_replay`, settlement `replay_rolled_back`, observation `sealed_and_closed`, no first error, non-live/non-reusable/not-ready disclosure | `committed`, UNKNOWN, denied, rollback without positive replay seal are negative inputs |
| Response bytes | Actual `coreHostTerminalResponseMatchesV1`; exact encoding and independent SHA256 of the supplied UTF8 JSON image | This is the whole Core result, not a CE receipt wrapper, Docs projection, HTTP/ACK or later serialization |
| Attempt/backend/DBtx | Compare Core11 lifecycle metadata against the private candidate's actual Core binding | Another replay/attempt cannot substitute even with the same original command/receipt |
| Receipt and original command | Canonical V2 parse/hash; exact Core receipt/mutation ID, original transaction/command/actor/Workspace/key/fingerprint/Guide aggregate/Context/revision/version | Tenant and original CE relation belong to the private Core10 candidate; full sealed Core binding is not publicly inspectable |
| Target/version | Official Docs07 candidate and Core10 bound document ID, immutable version ID and numeric version exactly match; current/historical/label policy unchanged | Core11 exposes no identity-gated sealed target + Docs candidate registration to match against these values |

After every available comparison succeeds, the method still returns
`JOINT_REGISTRATION_REQUIRED`, **not success/ready/authorized**. Other bounded codes:
INVALIDATED_CANDIDATE, HOST_RESULT_UNRECOGNIZED, REPLAY_SETTLEMENT_REQUIRED,
RESPONSE_BYTES_MISMATCH, BINDING_MISMATCH. Every output has `projection:null`,
`status:not_ready`, `host_binding:UNBOUND`, `action_authorization:not_evaluated`.
It returns no private tuple, label, body, permission, raw receipt/hash or SQL error.
A private candidate inspected earlier cannot acquire authority from this result.
Method validity checks use captured closure state, never a caller-controlled `this`.

Documents07 observe/factory/selector behavior is otherwise retained. Every later
query through its facade invalidates before dispatch; pending work, token renewal,
query/attempt/scope drift, first failure and close remain fail-closed. Post-settlement
scope queries reject rather than reopening a transaction. No candidate renewal,
new key, or UNKNOWN recovery is attempted by this adopter.

## Why the full connection cannot close on Core11

Core11 stores the real terminal binding inside `TerminalAttemptV1.seal`, but the
exported `CoreHostTerminalLifecycleInfoV1` exposes only closed hashes, backend,
DBtx and attempt. The identity-gated `terminalResults` reader returns info/bytes,
not the sealed target binding or an official registered Documents candidate ID.
The fixed `runCoreCe012HostTerminalCheckpointV1` runs Core's official subset; it
never registers or validates the Documents07 candidate. It closes the consumer
raw scope before the terminal hook; ordinary later host queries/awaits invalidate
host premises independently of the optional Docs facade.

Consequently, matching receipt/response/scope fields cannot prove that this exact
Docs candidate was part of that host seal. The observation hash preimage must not
be reconstructed/guessed from a different sample or treated as an authority token.
The new method deliberately has **no positive complete-binding variant**.

Also, the existing generic Core11 host follows its fresh-command path when no
C03 row is found. The new counterexample supplies a rejecting provider entry so
that no reservation/mutation occurs, but observes that fresh entry was reached.
That rejection is a test boundary, not a new accepted replay-only host primitive.
The Documents adopter does not invoke this generic dispatch at all. A future
read driver remains unimplemented until Core supplies the required primitive.

## Minimal delta for Core owner review (proposal, NOT implemented ABI)

1. **Replay-only entry policy in the existing host.** A trusted opt-in read path
   must abort absent/expired/ambiguous C03 before fresh validation, reservation,
   mutation, audit/outbox or new receipt. It keeps the exact original command/key;
   no new ledger/host/key, authority shortcut or automatic retry policy. Legacy
   command behavior stays unchanged for non-opted-in consumers. Core chooses and
   versions its actual ABI; no unpublished method or literal is imported here.
2. **Opaque joint candidate registration.** Existing host ownership must admit the
   official Docs owner capability/opaque candidate on the same scope/attempt,
   rather than accepting JSON, caller tuple/hash/Boolean or arbitrary late callback.
   Its target/version and approved non-authorizing private projection digest must
   be part of the exact host seal, with target-specific checks at the accepted
   post-wait boundary. All later host/owner query and await/attempt/failure changes
   must invalidate/renew it under the same lifecycle. No permit is inferred from
   the old optional facade or an earlier private selector sample.
3. **Identity-gated closed correlation.** Expose only enough private, host-issued
   evidence for the Documents owner to compare its exact registered identity and
   tuple with the sealed binding, scope/attempt/DBtx/backend, original command,
   independent CE/Core/mutation identities, receipt hash and exact response bytes.
   Copying/serializing must not mint evidence. Matching CLOSED metadata remains
   non-live/non-reusable/not-ready and never authorizes fresh disclosure.
4. Preserve replay ROLLBACK versus mutation COMMIT, UNKNOWN/cleanup semantics,
   first errors and existing bounded40001 behavior. D02 current-authority frontier,
   D03 target disclosure/custody and D04 native SQLSTATE/driver evidence stay open.
   Source/control adoption is not native/session/Storage/install/Release acceptance.

Owner: Core existing host/terminal hook, with Documents capability and CE composition
review. Closure: independently accepted exact Core FullSHA/published ABI, actual
same-attempt candidate registration/closed correlation and replay-only negatives,
then explicitly scoped Documents adoption. No SQL/schema/grant delta is proposed.

## Evidence and preservation

`node scripts/test-documents-ce012-core11-adoption-v1.mjs`: **9 NEW groups PASS**.
Actual Core11 host/terminal metadata and response matcher, CE R1 writer/executor,
Core10 relation/authority, Docs07 factory/selector and the new adoption method run
on a **synthetic memory SQL transport**, not a DB. Only original owner test helper
DEFINITIONS are reused; the Core22/31, CE27/R1, Docs07 nine and other old suite
bodies are NOT executed. Fresh save setup supplies modeled records for these new
couplings. Actual modeled committed/UNKNOWN results are negative fixtures only;
those fixture writes are not performed by the adopter or on any SQL connection.

Groups: recognized exact replay/rollback remains joint-registration-required;
forged result/metadata/token/dynamic-this; exact response bytes; foreign attempt/
DBtx; later tracked wait; post-settlement query/close; actual committed/UNKNOWN
negative result; expired C03 denial with zero extra modeled writes; absent C03
fresh-entry counterexample stopped before reservation. Write counters are model
observations, not independent durable-DB proof.

Scoped ES5/strict/bundler/noEmit typecheck with repository ESNext/DOM libs uses a
read-only **virtual official Git-source overlay** for Core11/CE R1 dependencies;
no owner module is copied into the Documents branch. The standalone Base does not
contain those Core modules/exports; full application build/integration was NOT_RUN.
Scoped ESLint, MJS syntax and diff/staged-diff checks are recorded with delivery.
Node24.19.0, TS5.9.3, cached Zod4.4.3; exact-lock Zod4.6.6 NOT_RUN_NOT_PASS. No install.

Only the Documents port changes; a new Documents test/review/manifest is added.
The historical Docs07 manifest/test/README are byte-identical at their original
FullSHA and unchanged on this branch; their frozen source pin is NOT bumped or
accepted alongside the new hash. The new versioned manifest records before/after
source identity separately. Running the old pinned harness against its original
source remains historical evidence; it was not replayed against changed bytes.
Provider/selectors, compiler historical slots, closure/request/kit, Core/CE/Platform,
SQL/migrations, package/lock and existing WIP/history remain unchanged.

All native SQL/parser/PG/Auth/Storage/ACL/session/receipt custody/lock/40001/settlement
and durable-zero-write evidence remains **NOT_RUN_NOT_PASS**. Both historical
compiler slots remain BLOCKED. No live dispatch/install/grant/activation/merge/
deploy or fake receipt/provenance is delivered.

خودکارسازی: نیازمند بررسی؛ ورودی candidate خصوصی و result/bytes واقعی host؛
فرصت تطبیق محدود metadata و ارجاع gap؛ تصمیم انسانی Core/Documents/CE و admission
با Coordinator/Platform؛ شرط اجرا ثبت مشترک و replay-only رسمی و proof واقعی؛
استثنا به مالک همان مرز؛ وابستگی Core delta فوق؛ ارزش سنجیده نشده؛ مجوز اجرا یا
پذیرش جاری Documents ایجاد نمی‌شود.
