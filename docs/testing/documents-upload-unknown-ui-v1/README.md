# DOCS-UPLOAD-UNKNOWN-UI-12

Base/direct parent: `e38b0d39dbb840a508b5e1d47e9d93d3060c6411`.
Existing branch: `codex/program-docs-ce012-provider-02`.
Task11 remains OPEN; this package is the Dashboard upload safety boundary only.

## Existing form and attempt lifecycle

`CustomerDocumentsDashboard` retains its single upload form. A synchronous ref
is acquired before any await, followed by session identity verification using
the existing browser client. The server remains solely responsible for actor and
Workspace authority. Browser membership/Context/Workspace and getUser identity
are correlation/fencing inputs, never command authority.

States: `idle -> intent -> upload -> finalization -> confirmed`.
Lost/malformed/unmatched replies, JSON body failure, timeout/disconnect and
unrecognized denial settle at `UNKNOWN`. The unchanged, exact pre-write503
`CANONICAL_DOCUMENT_WRITER_UNAVAILABLE` reply at intent issuance settles at
`NOT_READY`; no file is dispatched. Raw exceptions/server messages are not UX.
EN/FA/RO provide next actions. The intent and finalization keys are separate,
created once, before dispatch, and remain attached to the same immutable metadata
snapshot. A request SHA-256 correlates that snapshot; it is not a Core command
fingerprint, receipt hash or authority proof. No intent path is accepted from the
caller, no MIME fallback, no retry/reupload/key rotation after uncertainty.

File and metadata live only in component memory. A single sessionStorage literal
`cladora.documents-upload-unresolved.v1 = pending` is a negative dispatch barrier
across close/reopen, component remount and same-tab reload. It stores NO file,
metadata, identity, key, receipt, object path or secret. It is not an idempotency
ledger or recovery authority. It can only deny a new attempt and is cleared only
after a matched ACK or the known pre-write maintenance refusal. Storage failure
fails closed. There is no recovery API, reset-UNKNOWN button, lookup, automatic
retry or attempt reconstruction. Tab closure/browser storage removal is not a
recovery protocol. A beforeunload warning advises keeping unresolved attempts
open; it cannot guarantee the browser will preserve the page. Task11 must deliver
real same-attempt server recovery before functional runtime acceptance.

A new upload can be explicitly opened after confirmed registration. Closing an
unresolved form does not discard or unlock the attempt. Account events and exact
Context/membership/Workspace changes invalidate an in-flight generation, clear
visible form/selection data and suppress late upload/list/property/download
responses. The retained attempt becomes UNKNOWN and cannot be resubmitted, even
on return to the original scope. No old private title or file appears in a new
scope. Server authorization is still required for every read/download.

## Inactive HTTP ACK projection

`src/lib/customer/documents-upload-ui-contract-v1.ts` is a strict, bounded client
projection contract for the **future canonical server adapter**, not a claim that
these envelopes already exist on the maintenance routes. It imports only the
existing Core receipt TYPE; no Core host/Node runtime enters the client bundle.
No new authority interface, receipt writer, Storage endpoint or transaction host
is introduced.

- `documents-upload-intent-ack.v1`: context_id, workspace_id, actor_id,
  request_sha256, idempotency_key, intent_id, prospective_document_id.
- `documents-upload-finalization-ack.v1`: context_id, workspace_id, actor_id,
  request_sha256, status (`committed` or `exact_replay`), intent_id, document_id,
  document_version_id and the bounded `receipt` projection.
- `receipt` fields come from `Pick<CoreTransactionReceiptV1, ...>`:
  contract_version, receipt_id, workspace_id, actor_id, aggregate_type,
  aggregate_id, aggregate_version, mutation_id, idempotency_key, committed_at.
  Runtime parser requires Core v1, documents.document, initial aggregate version1,
  UUIDs, valid timestamp and exact key/Workspace/actor/document/version equality.
- Extra/unknown/private fields, missing fields, bare document_id, committed:true,
  a scan label, HTTP200 or Storage acknowledgement cannot confirm registration.
  An exact-replay ACK is accepted only for the retained finalization key and exact
  intent/document binding. No replay POST is initiated by this component.

**Server integration gate**: the future reviewed adapter must derive the actor,
Workspace and command from its server session/Core host, validate the original
snapshot binding, and project an ACTUAL committed/exact-replay canonical result.
It must never echo caller JSON, a caller-provided receipt, Storage measurement or
scan label as this ACK. The request SHA does not replace the Core fingerprint.
The client parser cannot prove the server committed; its controlled test fixture
is not server/receipt/native evidence. There is deliberately no server producer
or route activation in this package. The initial-version ACK is registration
only: no scan-clean/content acceptance/payment/work acceptance or download
permission follows from it. Core15/Platform12/Task11 real binding remains separate.

All three maintenance routes, existing canonical writer/selectors, Docs10
historical matcher and Core/CE source remain byte-identical to the Base. No
package, lock, workflow, SQL or migration changes.

## Targeted verification

Actual ReactDOM19.2.8 mounting in JSDOM26.1.0, actual Dashboard and client parser;
only HTTP and Supabase Auth identity boundary are controlled synthetic fixtures.
No Next server, real HTTP transport, browser login, account, SQL, Storage or scan.

```sh
node scripts/test-documents-upload-unknown-ui-v1.mjs
node scripts/test-documents-upload-unknown-ui-v1.mjs --only-download-fence
node scripts/test-documents-upload-unknown-ui-v1.mjs '--only=UNKNOWN remount'
node --check scripts/test-documents-upload-unknown-ui-v1.mjs
node_modules/.bin/eslint src/components/customer/CustomerDocumentsDashboard.tsx src/lib/customer/documents-upload-ui-contract-v1.ts scripts/test-documents-upload-unknown-ui-v1.mjs
```

Executed:19 targeted mounted/contract groups, then1 added late-download group.
Only the remount group was repeated after changing barrier restoration from an
effect to a lazy initial state (lint finding); PASS. Earlier first test run exposed
an asynchronous test wait error, corrected by bounded settling. Earlier lint
findings (declaration order and barrier effect) were fixed; final lint PASS.
No successful unrelated baseline or native suite was repeated.

Coverage: same-tick double submit; snapshot/hash/key/intent retention; lost ACK
at either HTTP stage; lost JSON; malformed/bare HTTP200; wrong receipt; mismatched
intent; pre-write maintenance; Context/Workspace/actor switch with late ACK;
strict missing/extra/private fields and independent receipt binding mismatches;
exact-replay ACK shape; FA/RO/EN actionable errors; late old-scope document list;
remount blocking with storage privacy; finalization body wait; absent Workspace
or identity with no dispatch; authorized existing read/download; late download
suppression; three unchanged maintenance-route preimages.

TypeScript5.9.3 scoped strict ES5/bundler check used the actual local transitive
source graph with both changed TS/TSX files, no synthetic Core schema/stub/overlay.
The temporary config is external to the repository, derived from tsconfig.json,
sets incremental=false and absolute @/* mapping; it includes only the two entry
files. No generated next-env file exists or was manufactured. Local Next16.3.8
(cache) differs from package pin16.4.1. No full Next build or exact-lock16.4.1
bundle acceptance is claimed. Typecheck, lint, syntax and diff-check PASS.

Native PostgreSQL/Auth/receipt/scan/persistence/restart and browser E2E:
`NOT_RUN_NOT_PASS`. No staging, Production, real email, route activation, grant,
Storage operation or deployment. Task11 is not closed by these controlled checks.

## Automation in this process

قابل خودکارسازی: **نیازمند بررسی**. Input is a same-attempt synthetic UI event and
bounded response; local regression checks are automatable, but canonical ACK
mapping and native acceptance require Documents/Core/Platform review. Execute
only under the scoped task/environment authorization; unexpected identity or
schema/receipt drift goes to the owning Coordinator. Value is preventing false
success and duplicate dispatch; no invented quantitative benefit or new engine.

## Source inventory (file-byte SHA-256)

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/components/customer/CustomerDocumentsDashboard.tsx` | 53517 | `4bfceb9dfbcc805c451bd4eee91ee7b6cf00bbff903aa6431f51225e08d6cc74` |
| `src/lib/customer/documents-upload-ui-contract-v1.ts` | 2917 | `50a3e0d2cb8fca5c328ca9cc5e8f158bf9dd51c1a0eeb8b9526c35278c449e71` |
| `scripts/test-documents-upload-unknown-ui-v1.mjs` | 18973 | `490558f336aacc9b5007501d2108e135408275853f1612f964395a1393234332` |
