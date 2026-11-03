# DOCS-CANONICAL-UPLOAD-ACK-13

Base/direct parent: `18c9cdf6b19e492464194fabaf3cc83171026483`.
Existing branch: `codex/program-docs-ce012-provider-02`.
Task11 remains OPEN. No HTTP route imports this adapter; three maintenance routes
remain unchanged/closed. This is a private server producer, not runtime cutover.

## Producer and trust boundary

`createDocumentsCanonicalUploadAckAdapterV1` creates the application commands with
`createDocumentsFunctionalCommandsV1(deps.host)`. It uses the existing initial
intent/version builders and canonical receipt parser. The host is a private
server composition dependency, not an HTTP parameter. Production consumption
requires the actual request-local Core/role-bound/session binding and Platform
verifier; no guessed CE/SERVICE pool role, new host, credential, ledger or fallback
is created. Core v1 has no identity-branded result getter for this writer: the
private injected host must be the official composition, not caller-controlled.
The test uses `createCorePostgresTransactionHostV1` unchanged, not a fake host.

Only strict browser metadata enters `issue`/`finalize`. Caller actor, receipt,
result, command, fingerprint, committed:true, Storage metadata, clean flag and
unexpected fields are rejected. `getUser` from the server session client supplies
the actor; `getClaims` must verify the same sub, UUID session_id, unexpired exp and
aal2. Identity/session/expiry are checked around Auth waits, before dispatch,
after Storage verification and before projection. No decoded caller JWT,
getSession, UI actor or cookie-shaped JSON is trusted.

Server-private plans use the EXISTING `DocumentsNewDocumentIntentV1` and
`DocumentsInitialVersionV1` inputs and builder command context (transaction ID,
command ID and canonical authority revision; actor is replaced from session).
The private intent plan also requires the independently retained shared snapshot;
its serialization must exactly equal the request snapshot. Recomputing a caller
hash alone, without that independent preimage, is insufficient. These private
arguments MUST come from the official prepared-command/custody
producer. They must NEVER be hydrated from request JSON. No producer ABI or
native identity unavailable from Core15 is guessed here. The existing host and
canonical provider bind exact Context/Workspace/actor, entitlement/revision,
permission/module/purpose and AAL2 after locks; intent expiry is checked by the
existing finalization provider in that transaction.

## Explicit scope and shared snapshot

`documents-upload-snapshot-v1.ts` is shared by Dashboard and adapter. It strictly
parses bounded metadata and serializes a fixed order:

context_id, workspace_id, filename, declared_mime, size_bytes, title,
document_type, classification, property_id.

No property insertion order dependence, default Workspace, inference, trimming,
Unicode normalization or private object identity participates. Server recomputes
SHA-256 of UTF-8 serialized bytes; a caller hash alone is never evidence. The
same immutable snapshot is retained for finalization. The hash is correlation
ONLY: not file checksum, canonical Core command fingerprint, receipt hash or
authority. Property is explicit UUID-or-null; multipart represents null as the
literal `null` and size as decimal. A future route must decode types, extract
only the admitted metadata (file bytes are handled separately) and reject
unexpected JSON/form fields. No route decoding or activation is added here.

`property_id != null` is currently DENIED: accepted initial writer inserts null
property_id. A successful ACK must not pretend the optional property was stored.
There is no property inference or writer expansion in this package. Replacement
version input is a different engine/contract and is not accepted by this adapter.

## Issue -> private finalization closure

A successful, fully matched issue result produces the existing strict
`documents-upload-intent-ack.v1`. Intent mutation_id and aggregate_id must equal
the private canonical intent and prospective document. The factory also returns
a PRIVATE `finalize` function capturing the frozen snapshot, actor/session and
canonical intent input. It is not a token, public authority or serialized kit.
Only `.ack` may be sent to the browser. A caller receipt/JSON copy cannot recover
that closure. No document/authority/idempotency store is added.

The closure is process-local custody, not durable recovery. It cannot serve two
HTTP requests across restart without a separately accepted Core15 same-attempt
custody/reconstruction binding. Loss of the closure stays NOT_READY/UNKNOWN; do
not issue a fresh intent or reconstruct it from caller JSON. This limitation is
one reason the routes remain maintenance-only and Task11 remains open.

Finalization checks the original snapshot and private intent/document IDs and
binds server version/command/context/key. First admitted finalization pins its
exact input/context tuple before awaiting; a synchronous guard rejects concurrent
dispatch. Once built, the canonical fingerprint is pinned too. An explicit
same-command replay may use the host's EXISTING idempotency/provider replay path;
no adapter retry, new key/command/version fallback or duplicate ledger exists.

`verifyDocumentsStoredObjectBeforeTransactionV1` and the existing branded
verified-object requirement run before host finalization. The trusted verifier
must attest non-overwrite custody and exact bucket/path/object ID, capability,
generation/ETag when exposed, recomputed SHA-256, size and detected MIME. A raw
Storage SDK measurement or upsert=false is insufficient. Size/MIME must match
the frozen snapshot. Session/expiry are checked after that wait. The actual host
then locks and rechecks canonical current authority/AAL2/intent expiry. No
verification network work or fabricated scan runs in the SQL transaction. The
writer's immutable initial version remains `scanning_status=deferred`.
Generation/ETag do not prove conditional delete, restore or scanner cleanliness.

## ACK projection

Only `committed` or `exact_replay` from the existing commands can project an ACK.
The canonical receipt parser and explicit comparisons require:

- transaction_id/command_id/key and actual builder input_fingerprint;
- actor/Workspace/Context, aggregate type/document and version1;
- actual mutation_id == expected intent ID or immutable version ID;
- allowed authority, exact permission/module/purpose/revision, post-lock flag,
  transaction/lock binding and exact entitlement Workspace/module/revision.

Final ACK uses `documents-upload-finalization-ack.v1` unchanged. Only its bounded
receipt projection goes to UI; no private authority/audit/outbox/object path,
Storage identity, full receipt, fingerprint or SQL exception is exposed.
Host denial cannot create ACK. unknown_commit, mismatch, changed session/expiry,
unavailable verifier or malformed evidence produces ack:null. If a COMMIT ACK is
lost the database may already have changed; unknown is not zero-write. No
canonical ACK means no UI success. Registration confirmation is not current
read/download authority or evidence of clean/content/work/payment acceptance.

## Private consumption (not a route activation instruction)

```ts
const adapter = createDocumentsCanonicalUploadAckAdapterV1({
  host: officialRequestLocalCoreHost,     // actual accepted Core composition
  sessionClient: serverSupabaseClient,   // server cookies/session, getUser/getClaims
  verifyStoredObject: platformVerifier,  // real custody verifier, not SDK measurement
});
const issued = await adapter.issue(strictBrowserMetadata, preparedCanonicalIntentPlan);
// On non-ACK: return bounded unavailable/denied/unknown; NEVER retry/new intent.
if (issued.status === 'ACK') {
  // Only issued.ack is public. Retain issued.finalize under the separately
  // accepted Core custody binding; do not serialize/reconstruct it from JSON.
  const finalized = await issued.finalize(strictFinalMetadata, preparedCanonicalInitialVersionPlan);
  // Only finalized.ack on ACK may be returned. No original Core result/receipt.
}
```

Names above describe required trusted inputs, not implemented/minted Core15 or
Platform12 capabilities. No environment/credential/producer has been fabricated.
After actual accepted producers arrive, pin FullSHA/ABI/schema/target/session and
continue connected upload/scan/persistence/restart/denial acceptance in Task11.

## Executed checks and limits

```sh
node scripts/test-documents-canonical-upload-ack-adapter-v1.mjs
node scripts/test-documents-canonical-upload-ack-adapter-v1.mjs '--only=added'
node scripts/test-documents-upload-unknown-ui-v1.mjs '--only=same-tick'
node --check scripts/test-documents-canonical-upload-ack-adapter-v1.mjs
node --check scripts/lib/documents-upload-ack-sql-model-v1.mjs
```

12 NEW groups PASS. Initially10 passed, then2 added controls passed alone.
Final12-group verification was necessary after requiring the independent private
snapshot preimage in issue: that change affects every issuance path. One affected Task12 same-tick/snapshot/hash group PASS using the
shared serializer/explicit Workspace; the other19 prior groups were NOT_RERUN.

The real Dashboard is mounted with ReactDOM/JSDOM. Its controlled fetch dispatches
to the real private adapter, actual Documents commands/builders/providers,
canonical Core authority provider and actual Core host. The SQL MODEL handles
only explicit known queries and owns synthetic Auth/authority/intent state. It
never authors a receipt: real host code creates receipts, canonical audit/outbox
and idempotency requests. Controlled40001 exercises the host's same-command retry
source, not PostgreSQL serialization. There is no injected allow-observation or
always-allow authority provider. SQL evaluator response/Storage custody and Auth
clients are modeled; this is NOT native authority/session/RLS/trigger/custody or
durable PostgreSQL evidence. No SQL is executed by the model.

Coverage includes strict caller injection/hash/scope/IDs; correct-hash foreign
scope and unauthorized Workspace; server mutation mismatch; canonical current
revocation/denial/stale revision/actor/AAL2; session expiration/change around
waits; unconfirmed commit including modeled committed effects; unavailable or
non-overwrite-false verifier; expiry after external wait; exact host replay with
no duplicate model effects; pinned fingerprint drift; concurrent finalization
and changed key/command/version denial; real UI-to-actual-host positive coupling.
Zero durable delta assertions refer ONLY to synthetic transactional model state,
never native rollback/locks/constraints. ACK loss is explicitly NOT zero-write.

Initial harness failures were test-loader TS/TSX parsing and SQL model query
classification; both corrected. No product/SQL/Core behavior was weakened.

Scoped strict TypeScript5.9.3 ES5/bundler with actual transitive source graph:
PASS. Scoped lint/syntax/diff-check PASS. React/ReactDOM19.2.8, JSDOM26.1.0,
Supabase JS2.112.4/SSR0.12.5, Zod4.4.3, Node24.19.0, local Next16.3.8 cache.
Installed Auth getClaims source was checked for signature/expiry validation;
no caller token parsing or allowExpired option is used. Repository Next16.4.1 pin:
full exact-lock build/bundle/browser acceptance NOT_RUN, not inferred.

Native DB/Auth/session-revocation/storage/scan/restart and real40001:
`NOT_RUN_NOT_PASS`. No three-route activation, staging/Production/email, install,
grant, SQL/migration, backfill, service_role/legacy fallback, new pool role,
package/lock/workflow/Core/CE or canonical engine changes.

## Same-process automation record

قابل خودکارسازی: **نیازمند بررسی**. Input is bounded same-attempt metadata and an
actual host result; strict correlation/projection regressions can run locally.
Human Documents/Core/Platform review owns server custody, current session/role
binding and native acceptance. Execute only on the authorized target/ABI; drift
or unavailable verifier/session is referred to Coordinator. Value: avoiding false
ACKs and duplicate attempts; no invented estimate or automation engine.

## File-byte pins

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lib/customer/documents-canonical-upload-ack-adapter-v1.ts` | 12709 | `5459a03c72cc71085acf7a77edf84ba01e2baeae53ab980e70f8af024f42c1ff` |
| `src/lib/customer/documents-upload-snapshot-v1.ts` | 2486 | `5f266c3eb5c9886d17d635245789120c65384d218add04beb7c485b84d8134c8` |
| `src/components/customer/CustomerDocumentsDashboard.tsx` | 53773 | `1fe758213661215776fb13db1ce1c003ccb5055153432d6f54272a74bf507df5` |
| `scripts/lib/documents-upload-ack-sql-model-v1.mjs` | 7455 | `10197b6d61a200b5072207767f9ac256059ad6f0b16771194ed6e267f60a8a53` |
| `scripts/test-documents-canonical-upload-ack-adapter-v1.mjs` | 19222 | `526c339dc84055dcf98ba57acc7892d3ef9774c78687a4f08ebe7e33199fe44f` |
| `scripts/test-documents-upload-unknown-ui-v1.mjs` | 19143 | `c9a3df3483f7e4ffc207161b08fcf2518e18d75261f8125f88fcc07ef702f257` |
