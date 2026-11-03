# DOCS-FUNCTIONAL-UPLOAD-11 — independent implementation checkpoint

**TASK OPEN: actual persistence, real scan, restart and denial acceptance NOT_RUN.**
This is the source checkpoint of the same task, not functional completion or a
parallel readiness/reporting package. Continue this branch when actual Platform12
and Core15 deliveries arrive; do not substitute staging or synthetic authority.

Shared Base/actual implementation parent:
`ec639884452cc0cb6dfef520339791a5c20e9b39`.
Local branch `codex/program-docs-ce012-provider-02` fast-forwarded from accepted
Docs10 `dc23327c6d14b1765bed113b36b0f5a599955818` to that exact Base. Clean before FF;
no reset/rebase/force/new branch, no WIP removed. Earlier historical worktrees kept.

Owner clarified Platform12/Core15 are NOT finally delivered, no successor FullSHA,
ready fixture or connectable backend has been announced. Their source/target/ABI
bindings remain NULL. Native work is authorized only after identifying the actual
owned isolated development target with synthetic accounts/data; that authority is
not a license to fabricate a descriptor or reuse populated staging/Production.

## Independent product components implemented

| Path | Concrete implementation | Remaining integration |
| --- | --- | --- |
| src/lib/customer/documents-storage-readback-v1.ts | Actual Supabase SDK upload with upsert=false; info→full download→SHA256/size/magic MIME→second info; exact UUID/bucket/path/version/ETag/size/type; upload ACK identity matches; duplicate/unknown never success/reupload | Actual scoped Storage client, private bucket policy, target/custody and non-overwrite evidence from Platform12/Core15 |
| src/lib/customer/documents-functional-commands-v1.ts | Existing Core host + existing initial intent/finalization, replacement intent/pending candidate, promotion-after-clean and download builders/providers; original IDs/key preserved on UNKNOWN, no retry/ledger | Core15 actual server session, role-bound host/current authority/context and admission; HTTP wiring after real ABI |
| src/lib/customer/documents-functional-download-provider-v1.ts | Existing D4 exact current-version/scan/storage provider PLUS existing canonical per-document visibility selector in SAME Core scope, including AAL2/module/permission/Context/Workspace/tenant/lifecycle checks; denial has no private candidate/event | Core15 current target/custody response-release check after Storage waits; no stream/signed URL/public label emitted here |
| scripts/documents-vault-scan-once-v1.mjs | Vault-only canonical lease RPC → existing REAL freshclam/clamscan worker → canonical complete/fail RPC; no injected run/clean flag or internal-vault fallback | Actual scoped scanner client, executable/signature state and actual queue/native persistence from Platform12 |
| scripts/test-documents-functional-upload-primitives-v1.mjs | Real SDK and actual provider/selector/application code under controlled HTTP/SQL transports, plus Vault idle/bad-lease admission | NOT real Storage/DB/Auth/scanner proof |

No new document/authority store, audit/outbox/idempotency ledger, host, role or
SQL migration was created. Existing canonical engines/immutable migrations were
not edited. The commands do not import/call the CE historical matcher as authority;
independent uploads must not wait for CE historical relationship proof.

### Honest authority and Storage boundaries

Storage readback returns internal measurement only. It explicitly says
`non_overwrite_verified:false`, `scan_authority:false`,
`reusable_as_download_authority:false`. It is NOT the writer's branded
VerifiedDocumentsStoredObjectV1. The ACTUAL admitted Platform verifier must supply
truthful existing DocumentsStoredObjectVerifierV1 measurements/non-overwrite facts
and the existing verification function must finish before the SQL transaction.
Neither upsert=false nor generation/ETag alone proves non-overwrite, conditional
DELETE or restore. No such claim is made.

All initial/replacement finalizers and promotion still require that existing
branded verified object. A supplied clean flag, attestation UUID or measured path
alone cannot dispatch an unverified finalization/promotion. Canonical providers
recheck actual intent, Workspace, version/provenance and attestation/CAS in the DB.
Initial scan is deferred; replacement candidate remains pending until real clean
and promotion. New private download candidates have no outward authority.

The new scanner entry uses actual default execFile freshclam/clamscan. It has no
custom runner/verdict input. Idle Vault queue returns idle, never scans another
bucket. Invalid claim/lease stops. Failures persist bounded error/retry state;
unknown/completed failure-recovery state requires readback, not a synthetic clean.
First scan failure is retained if recovery persistence fails. The positive scan
and its failure-persistence branch have not been exercised natively here.

Existing `document-clamav-worker.mjs` CLI reads a legacy service-role credential;
that CLI was NOT invoked and is not the proposed product admission. Platform12
must provide an actual reviewed limited scanner client to the new programmatic
Vault-only entry. Scanner role/grants/provisioning are separate owner bindings;
none were guessed or executed here.

## Exact connection requirements, in this SAME package

Machine-readable contract: [connection-requirements.json](./connection-requirements.json).
It separates Platform12 infrastructure and Core15 authority/target outputs, includes
13 exact immutable Documents migration preimages in chronological source order,
required columns/RPC signatures and the full acceptance matrix. That subset is NOT
an independently installable global foundation closure. Core15 must bind the real
global foundation/identity/role-safety/workspace/storage dependencies and verify
actual installed catalog/owner/ACL/RLS; migration metadata is not a file-byte hash.
No new migration timestamp is generated; existing guards must be satisfied or
changed only via a separately reviewable additive compatibility delta.

**Platform12 owns:** exact successor/source references, actual owned development
run/custody/container/image/database/Auth/REST/Storage identity, named-volume
persistence and controlled backup/reset; private document-vault; max20MiB and
canonical MIME restrictions; no public object/direct client download or
application UPDATE/upsert/move/copy/delete path; exact current single-use intent
INSERT policy; actual object identity capabilities/non-overwrite evidence; real
ClamAV/fresh signatures and actual narrow scanner client/lease/RPC connectivity.
No service_role application fallback. Do not print keys or credential values.

**Core15 owns:** actual verified server actor/AAL2/current session and authority
revision, explicit trusted Context/Workspace/tenant and original command identity;
real Documents role-bound host/pool and effective ACL/RLS; actual canonical target
visibility/scan/lifecycle/version; recheck revoke/expiry/target/custody AFTER waits
and immediately before any metadata/body release; binding actual Storage identity
and measured bytes to that current target. A closed historical MATCH is not that
check. No current Core15 ABI/export/method is invented by Documents.

Core15 must provide a context/permission fixture that genuinely passes the existing
per-document scope/permission predicates for actor A and genuinely denies actor B,
not canned allow or arbitrary global membership inference. Same-tenant other
Workspace, cross-tenant, NULL binding, expiry and revoke must remain real denials.

**Schema:** existing upload_intents new/replacement/consumed/verified Storage fields,
immutable document/version linkage, canonical Storage FKs/marker/immutability,
scan jobs + immutable attestations, pending replacement and clean parent CAS,
current exact-Workspace download/retention/holds and closed application ACL. No
historical NULL backfill/rebind/default/inference. Existing historical source-only
findings or installation/guard gates are not silently relabeled as native closed.

## Existing route/UI boundary

The three existing customer endpoints (upload-intent, upload, download) still
return canonical maintenance503. They were not routed to a fabricated Core15
session/pool/verifier. Their real wiring depends on the announced server API and
actual target/custody. No private label/body/path is published before that gate.
HTTP/UI cutover and the runnable live command remain part of THIS OPEN task after
actual producer delivery; source checkpoint does not count as the requested usable
flow. No new arbitrary-shell/SQL installer/live bypass command is offered.

## Run the actual independent checks

```sh
node scripts/test-documents-functional-upload-primitives-v1.mjs
node_modules/.bin/tsc --noEmit --strict --skipLibCheck --target ES5 --lib dom,dom.iterable,esnext --module ESNext --moduleResolution bundler --allowImportingTsExtensions --esModuleInterop src/lib/customer/documents-functional-commands-v1.ts src/lib/customer/documents-storage-readback-v1.ts
node_modules/.bin/eslint src/lib/customer/documents-storage-readback-v1.ts src/lib/customer/documents-functional-download-provider-v1.ts src/lib/customer/documents-functional-commands-v1.ts scripts/documents-vault-scan-once-v1.mjs scripts/test-documents-functional-upload-primitives-v1.mjs
node --check scripts/documents-vault-scan-once-v1.mjs
node --check scripts/test-documents-functional-upload-primitives-v1.mjs
```

Nine UNIQUE new controlled groups were executed incrementally. After correcting
only the new mock query dispatch, full new nine-group script passed; adding the
required verified object to the promotion facade reran only --only-workflow;
pre-POST path checks reran only --only-storage. Source-compatible ES5 scoped TSC,
scoped lint and syntax PASS. No meaningful TypeScript error was bypassed: the
checker caught the missing promotion object argument and it was corrected.
The two earlier broad mock SQL conditions were narrowed; no canonical predicate,
assertion or engine was changed to produce a model pass.

Tests: SDK exact byte/identity readback, duplicate denial without retry/readback,
changed identity/content, MIME/size/path rejection before POST; actual D4+target
selector positive and other-reader/revoke/replacement/pending denials with no
modeled write; Vault idle/bad lease never reaches other bucket or scanner;
canonical command delegation/UNKNOWN identity and branded-object requirement.
Model clean rows only test selector logic; they are NEVER inserted as real clean
attestations or offered as scan proof. Positive real ClamAV remains NOT_RUN.

Docs10 matcher ten and all unrelated successful suites NOT_RERUN. Node24.19.0,
TS5.9.3/Supabase SDK+Storage2.112.4/Next16.3.8/Zod4.4.3; exact target package/runtime compatibility is pending. Supabase
Storage docs and actual installed SDK types/info normalization were consulted.
Public changelog fetch was blocked by inherited proxy403; no bypass/retry. This
was not DB access; no schema/advisor/SQL was run without a verified target.

## Continue after actual producer handoff — required acceptance

1. Pin actual Platform12/Core15 FullSHAs, published ABI, schema closure/catalog,
   physical environment/issuer/custody and ordinary app/scanner identities. Values
   currently NULL must come from their real producer; never invent or use staging.
2. Wire the existing customer API/UI to server-owned context + canonical commands,
   Storage upload/readback + actual admitted non-overwrite verification, all using
   the scoped real target. Keep original key/IDs on UNKNOWN, no blind resubmit.
3. Real synthetic file → intent → Storage bytes → branded verify → canonical
   initial version/consumption. Read back DB/Storage independently; no extra store.
4. Real Vault lease/ClamAV scan → exact-hash immutable attestation/version verdict.
   Missing/stale/error/pending/quarantined remains unavailable; no fake clean.
5. Restart app/worker and prove same DB/version/Storage bytes persist in the named
   volume; authorize current reference/download with Core15 after Storage waits.
6. Real actor B/Workspace/tenant/revoke/expiry denials, including after waits; no
   label/body response before acceptance. Real replacement candidate → real scan →
   CAS promotion, stale parent/old current target denial; same original replay/ACK
   recovery and no duplicate version. Independent native RLS/ACL/zero-write proof.
7. Only after these proofs may the functional task close. Historical CE slots stay
   BLOCKED until proof of THEIR actual relationship; do not stop standalone upload.

All real persistence/Storage/ClamAV/DB/Auth/restart/denial/RLS/ACL/concurrency/
Core15 response-release evidence: **NOT_RUN_NOT_PASS**. No Docker pull/start, actual
DB/Auth/Storage access, migration/apply/grant, staging/Production or deployment
operation ran. Docker binary exists; no host psql/clamscan was found; that is not
proof of Platform12 availability or capacity. Task is **OPEN**, not ready/complete.

خودکارسازی: نیازمند بررسی؛ ورودی فایل و command نسخه‌دار؛ بخش قابل خودکارسازی
کنترل bytes/hash/صف scan و تطبیق نسخه؛ تصمیم انسانی و نقش مالک سند برای upload و
Coordinator/Core/Platform برای admission؛ شرط اجرا current authority/custody و target
واقعی؛ استثنا mismatch/UNKNOWN به مالک همان مرز بدون retry کور؛ وابستگی رسمی
Platform12/Core15؛ معیار ارزش زمان چرخه و خطای بازیابی هنوز اندازه‌گیری نشده است.
