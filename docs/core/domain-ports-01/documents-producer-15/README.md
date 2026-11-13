# Documents prepared custody + request-local C01/C03 producer v1

SOURCE_CANDIDATE / CONTROLLED_COUPLING; install/native remains NOT_RUN_NOT_PASS.
Parent: a14a6b5b752852d27192529158cac3eaed20c35b. Same Core branch/worktree.

Inputs were received DIRECTLY from the private shared Page in this chat:
- Documents738: 738a0a12804419af65d4807419b5e22ad56acb64,
  Parent d50e2351f13c15d543307bdf9bebd87fb5b05705,
  Tree 7dd50e5779b5a9ec4749a734e5babbedcc58ca86.
- producer-inputs-v1.json: 5417 bytes, SHA256
  4f3821e2a0df28085d592f09da91cf4efff9e0af97f67044a166d5e62a376d0d.
- decoded transfer ZIP:36088 bytes SHA256
  33d7651b0d4ea16f1256fb2ead87d25acf6d1aec9c08543100d73c539a57375c.
  Bundle verified/imported as Git objects, sole prerequisite main6cecfa15.
No private source archive, Page file or metadata is embedded/reposted here.

## Actual exports / composition

- documents-command-binding-v1.ts#createCoreDocumentsCommandBindingV1:
  same request-local verified server Auth and existing role-bound C01/C03 engine.
  resolveIdentity is preparation-only; host.execute and replayHost.execute admit
  only the explicit Documents upload/read profiles. No Guide/SERVICE profile alias.
- documents-upload-custody-v1.ts#createCoreDocumentsUploadCustodyV1:
  async `{pool,target,request,verifyStoredObject}` -> `{adapter,custody}`.
  custody supplies prepareIntent/retainIssued/takeFreshUpload/resumeFinalization.
  The adapter is the REAL Documents adapter, with Core pre-dispatch admission.
  Feed both into Documents738 createDocumentsInitialUploadPipelineV1 along with
  Platform's real scoped createDocumentsStorageReadbackV1 result, then use its
  existing createDocumentsInitialUploadHttpV1. No public route/registry selected it.
- documents-download-recheck-v1.ts#createCoreDocumentsDownloadRecheckV1:
  recheckAfterStorage(input,originalContext) uses the ORIGINAL download command
  in C03 replay-only + the actual Documents target/scan/reference provider.
  It returns a private candidate only on exact replay, no outward projection,
  signed URL, arbitrary allow callback or reusable current-authority permit.
  Byte measurement/custody comparison and outward release remain Documents-owned.

## Immutable preparation, not a parallel effect ledger

Owner explicitly confirmed no prior pre-dispatch plan-custody implementation and
approved this canonical extension. New platform.document_upload_custody_v1 is
Core-owned PREPARATION/HANDOVER metadata. There is no second command executor,
idempotency receipt, audit/outbox or document store. C03 alone commits the existing
Documents writer mutation + receipt + audit + outbox atomically.

The fixed platform_dev.document_upload_custody_v1(text,jsonb) RPC accepts only
bounded named phases/fields, derives actor/session/AAL2/tenant/Workspace/member
from actual canonical server providers, locks the existing session/epoch and its
one preparation row, and rechecks permission/time after lock waits. No caller
SQL/schema/role/target/allow/time is accepted. It returns real server-created IDs,
original authority revision and intent expiry. TS verifies the actual DB OID,
database name and backend marker against the already-admitted Core target.

prepare commits original IDs/version and snapshot; seal commits exact original
issue wire/hash; dispatch durably consumes first dispatch admission BEFORE calling
C03. An UNKNOWN/second issue can ONLY replay the same command, never fresh-create
an intent. A missing receipt remains held. Retain queries the actual canonical
C03 row and checks its command/receipt/mutation tuple; caller ACK JSON is not proof.
Claim pins the finalization key and consumes stream admission under a row lock
BEFORE file iteration. seal_final pins the entire final command wire/fingerprint
before its first C03 dispatch; changed object/authority/body cannot overwrite it.

Finalization IDs/version/transaction/command are assigned once at preparation;
key is pinned once before streaming; fingerprint is pinned from actual measured
immutable-object command before execution. Retry never refreshes authority_version
in the ORIGINAL wire, TTL, key or version. Current permission/session are evaluated
separately. Current revision mismatch can deny/hold the original command; it does
not authorize reconstruction under a newer revision.

Only actual minted handles are cached as an OPTIONAL bounded optimization, keyed
by Pool AND exact target identity plus intent. That cache is NOT durability or
admission proof. Independent DB CAS admits at most one stream. Copy/JSON cannot
register a handle. Cold/evicted/UNKNOWN issue handles cannot stream again; resume
reads custody and mints an actual exact-replay handle via the Documents adapter.
It can verify an existing immutable object and finalize/replay the SAME retained
finalization command; no fresh upload/intent/key/version. If no object/receipt is
recoverable, safe hold remains. No automatic reclaim, purge/cancel or TTL renewal.

## Shared engine boundary

createCorePostgresTransactionHostV1 now exposes executeDocumentsReplayOnly for
ONLY Documents V1 upload/current-clean download profiles and exact provider IDs.
Missing/ambiguous/expired/mismatched C03 row denies before provider/fresh validation
or any reservation/write. Read, provider validation, final canonical session/C01/
revision and DB clock happen in the same attempt, then ROLLBACK ACK is required.
No CE012 seal/Guide ABI is reused. Bounded existing three-attempt40001 behavior
remains; the last original40001 reaches the trusted Core caller unchanged.
Unknown ROLLBACK returns UNKNOWN, not a fabricated replay ACK. Cleanup preserves
the first error. Default fresh and CE012 modes retain their prior behavior.

The new intent replay provider preserves the actual intent writer and adds a
sealed-plan check + current-state replay validation. Historical receipts without
that validation are NOT silently upgraded. It verifies real upload_intents against
the prepared plan and checks fresh server time after waits. No scan status invented.
Documents-only claim alias cleanup is added to the existing request-local runtime
before/inside its new transaction. SERVICE/default behavior stays unchanged.

## Offline verification / native gates

New real Core + exact Documents738 controlled SDK/RPC/PG coupling:17 groups PASS,
including HTTP intent, actual minted handle, pipeline upload/finalization + recovery
same receipt/version, concurrent stream admission, forged handle, wrong Context/
target, AAL1/invalid Auth, revoke/expiry, lost-admission ACK and original40001.
Three specifically affected shared-engine fresh/CE012/rejected-family controls PASS.
Packet source checker rejects five coherent invariant removals; not a SQL parser.
Full ES5 typecheck, focused lint, JS syntax and diff checks pass.

Transport models are NOT PostgreSQL, durable restart, Auth/RLS or Storage proof.
New factory instances/canonical model state exercise cold reconstruction paths;
no actual process/DB/Storage restart ran. Download's missing-receipt negative is
covered; its positive clean/real-Storage lane remains open with Platform/Documents.

See supabase/install/documents-upload-custody-v1/recovery.md. Composer emits one
bounded install image and read-only preflight/verify images without executing SQL.
Platform must admit exact actual helper owners/ACL/RLS/role graph and quiescent
owned target, review privileges/constraints/row-lock behavior, then separately run
native installation/concurrency/lostACK/restart/cleanup proofs. No shared SQL,
Auth call, grant, fixture, restart, role/config mutation or activation ran here.
Existing maintenance routes remain closed; scanner does not block initial intent,
while clean-dependent download stays closed without real scan/custody/currentness.

Automation: نیازمند بررسی — composition/identity/source checks automate offline;
Platform owns target/capability/installation admission; Coordinator/QA accept native
behavior. UNKNOWN/missing input returns to the named owners, not an automatic retry.
