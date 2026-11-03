# CE-FUNCTIONAL-GUIDE-13 — connected editing source; functional acceptance OPEN

Shared Base `ec639884452cc0cb6dfef520339791a5c20e9b39` was brought into the
existing `codex/program-ce-independent-base-02` by ordinary FF from0191e041.
The first independent no-reference delta is0b72e40791997c57ce2c08048bcd5a70b36cb3d7.
This iteration's real parent is that commit. History/WIP/previous evidence remain.

## Actual source path

`CustomerExperienceGuidePage` → existing `CustomerExperienceGuide` editor →
`experience-guide-functional-client` → real route
`/api/customer/v1/experience/guides/draft` → CE handler → existing writer executor
and actual existing Core host. This is not an unused helper. Default runtime pool
is deliberately NULL: the configured product has NOT been delivered/accepted.
The adapter consumes present Core14 APIs; it does NOT call an invented Core15 ABI.

- GET uses fixed CE-owned versioned read SQL, existing canonical context/permission/
  session helpers and a Core/Platform role-bound request pool. Current content_version
  selects only that version's steps. Reference labels/targets are not disclosed;
  only a manageable draft with one step and no reference is offered to this existing
  single-step composer. This is a composer capability boundary, not a new permission.
- POST prepare is read-only; verified server actor and DB revision form the Core
  descriptor. The accepted builder allocates storage step_id BEFORE existing
  fingerprint, then the browser retains the complete paired command/wire. Prepared
  JSON/actor/hash are NOT authority: actual execute reauthenticates and the canonical
  host/provider own scope, revision/permission/idempotency and mutation checks.
- POST execute calls the existing CE executor, which uses the existing Core host,
  C03, receipt and rollback/replay path. No second host/ledger/receipt engine, legacy
  command fallback or automatic resend. The reference-dependent branch remains
  NOT_READY without the official Documents connection; null-reference saves do not
  access or require the Documents module at all.
- The mounted editor locks fields on UNKNOWN and offers explicit same-command
  retry. Bad success/202/lost reply preserve pending; a different simultaneous draft
  cannot inherit success. A malformed prepare cannot dispatch execute. Private
  snapshots are copied; the immutable execution wire/key/hash is retained.
- Context/member/Workspace lifetime and generation fence decoded replies and reads.
  Old data is hidden until a current read completes. In-memory scope caches retain
  unsent drafts and UNKNOWN across scope suspension/return; a higher-version GET
  never resolves UNKNOWN. This is NOT browser persistence/G3: original-command
  recovery across actual reload still needs the official durable resume contract.
- FA/EN/RO use the actual editor, accessible labels/feedback, native controls and
  RTL. Existing unsaved-beforeunload handling remains. No browser geometry/native
  keyboard/Auth evidence is inferred from JSDOM.

## Creation is an explicit open dependency

Existing save_draft requires a positive-version existing draft. It is NOT a
version0 create command. The actual create handler validates the EXISTING
create_guide request contract but returns CE_GUIDE_CREATE_CORE15_NOT_READY/503;
can_create=false. No fake version1 row/receipt, legacy substitution or new grant
is fabricated. CE still owns completion of creation producer mapping, creation UI
and end-to-end creation after official Core15 ABI arrives. The overall task is OPEN.

## Exact handoff requirements — no credentials in chat

| Owner | Actual requirement / closure |
| --- | --- |
| Core15 | Official FullSHA/ABI (owner confirms not yet delivered). Current Shared Base/remote Core3e9593af is Core14. Supply the real server-authenticated command/transaction entry, post-wait/final authority/session/expiry checkpoint and canonical C03 reservation/receipt/UNKNOWN/replay/read boundary. Confirm non-reference Guide support; Core14's document-target terminal port is not silently repurposed. Creation mapping must support existing create_guide expected_version0 without forging an existing Guide or rewriting save receipt history. CE adopts exact producer, not guessed names. |
| CE | Current consumer is connected at source for editing; bind official Core15 and complete creation UI/producer/read/recovery after the ABI is delivered. Historical MATCH/GET/version alone must not authorize edits or resolve UNKNOWN. Read SQL samples/repeated helpers are not continuous-revoke proof; use accepted Core15 currentness/settlement primitive. |
| Platform12 | Official partial infrastructure794f5a12 is now reported in Platform’s own environment; manifest8797bytes/SHA256d8946081bfa3542c8bbb88229bc1bc3c8a3e827e48a9cb7143cb935c8eae543f matched official Git bytes. Core application schemas/roles/domain bindings remain HOLD; its localhost/session/credentials are NOT inherited by CE. Verified owned isolated persistent development PG/Auth target/profile and actual connection lease, not staging/Production. Native schema/version and synthetic fixture ownership must be attested before execution. Docker socket28.4.0 was ready; image/container lists empty; none created/pulled. No target/secret/capability was configured or assumed inherited. |
| Core/Platform schema | Existing platform tenants/workspaces/idempotency/audit/outbox; authority revision; canonical *_at helpers, real require_request_session_current_at_v1; registered experience_guides with existing read/manage/module.experience_guides mapping; existing ce_guide_audience_allows_v1; versioned experience.guides/guide_steps/guide_references from20261014082947 and child guard20261014132000. Presence/source is NOT installed authority. |
| CE store | Typed CE receipt projection and same-transaction Core relation from the existing review-only ce012_save_writer_relation_v1.sql. Its55000 guard remains unchanged. An approved additive installation/migration and native deferred/rollback/retention proof are required; never execute the guarded proposal by stripping guards. No missing schema/role/grant is guessed. |
| Auth/role lease | Real Supabase SSR getUser/session/assurance verification (reused official CE lifecycle authenticator), current signed session and Core session gate. Existing CorePlatformRoleBoundPoolV1 direct/session_pooler lease; fixed runtime/executor roles and safety/ownership invariants verified by Core/Platform. No caller JWT, service_role/owner connection or fake verified-session object may serve as native proof. Supply configuration/secret bindings via approved environment, NEVER chat. |
| Native acceptance | Real UI→HTTP→Core15→committed versioned data→readback after reload/process restart; concurrent versions; denial; revoke/expiry after real waits; original-wire UNKNOWN/retry without a second save; RLS/scope and genuine persistence/receipt checks. All NOT_RUN_NOT_PASS until prerequisites arrive. |

Default ce012FunctionalDependenciesV1 is frozen/unconfigured. It is NOT an env
credential fallback or public binding setter. A later CE adoption must consume the
actual Core15/Platform12 server module and verified lease. Its present private
factory injection is for source coupling/tests only, not a self-certified permission.

## Reproducible checks actually performed

Separate toolchain materialized from unchanged Shared Base package.json/lock and
tracked vendor/braces-3.0.4-cladora.2.tgz using npm ci --ignore-scripts --no-audit
--no-fund with a task-local cache. Exact Next16.4.1/Zod4.6.6/TS5.9.3 observed;
old node_modules/cache and source package/lock/vendor/config untouched. No backend
installation occurred. Target package resolution is not a running app/Auth proof.

In a Git checkout containing official Core09 fixture object ae8107ad (reachable
through shared history), with an exact isolated toolchain:

```
node scripts/test-ce-functional-guide13.mjs --toolchain=/absolute/task-toolchain
node scripts/test-ce-functional-guide13-flow.mjs --toolchain=/absolute/task-toolchain
```

Both refuse Next/Zod version mismatch.6 affected no-reference groups passed.
9 connected source groups passed plus one new server descriptor/lock-set negative (the affected execute positive was rerun): actual HTTP handler/NextRequest/Core executor,
modeled readback, lost response/same-wire replay, delayed JSON owner fence,
unconfigured denial, actual mounted editor EN/RO/FA, actual mounted page
read/submit/refresh, higher-version GET + scope suspension retaining UNKNOWN,
malformed prepare zero execute, and different simultaneous input isolation. The additional server check rejects altered descriptors/source lock sets BEFORE host dispatch.
The count includes EN/RO/FA as one grouped mounted check. Test pools/role rows/
authentication are explicitly MODELED; no JWT is minted or database connected.
Official Core09 fixture prefix is reused; its23 cases are NOT run. G2's13 controls
were already checked by coordinator and were NOT rerun. CE010/CE011/G1/old27 and
other successful suites not replayed. New/affected checks were refined/repeated
only as their current source changed.

Full typecheck and scoped lint pass with exact target packages in a verification
copy. Syntax, diff, identity and inventory checks pass. Local full webpack build
was attempted and FAILED in unchanged src/app/[lang]/layout.tsx / next/font:
TypeError: Cannot read properties of null (reading '1'), Google loader.js:122:78.
No font/dependency/build configuration workaround or repeat build was made.
This failed build is retained as a separate integration gate, not called PASS.

No SQL parser/PG/Auth/Storage/native connection, image pull/container/volume,
backend migration/grant/activation, staging/Production or deployment occurred.
Only the isolated Node toolchain setup above. Actual task acceptance remains OPEN.

خودکارسازی: نیازمند بررسی؛ ورودی فرمان نسخه‌دار Guide؛ فرصت آماده‌سازی
پیش‌نویس و تطبیق نسخه/ارجاع UNKNOWN؛ تصمیم ذخیره و retry با editor مجاز؛ شرط
اجرا Core15 و Auth/DB معتبر و اختیار جاری؛ استثنا به CE/Core/Platform؛ وابستگی
رسمی همان producer/lease/schema؛ ارزش اندازه‌گیری‌نشده؛ طبقه‌بندی مجوز نیست.

Machine-readable exact requirements and current Platform12 identity: `connection-requirements.json`. This is a CE consumer handoff, NOT an official Core15 ABI, install permission or connection credential. No native action was started after reading Platform’s partial report.


## CE13-READ-CUTOVER-01 — scoped correction on reviewed3102

The preceding checkpoint is retained as history. Its unconditional Page read at
`/api/customer/v1/experience/guides/draft` is superseded here: with the default
`role_bound_pool=null`, that route returns503 while the accepted `/guides` reader
can return200. The controlled BEFORE counterexample reproduces the hidden Guide;
it is evidence of the regression, not a PASS or hosted/native observation.

The Page now reads `/guides`. That server route selects the accepted reader
**before execution** while the official functional server composition is absent.
With an explicitly configured role-bound pool, the same selector chooses the
functional reader. Its successful strict envelope carries the server response
marker `X-Cladora-Guide-Read: functional-v1`; only this response plus the current
Guide's `can_edit` exposes the existing editor. Plain legacy `can_edit:true` does
not enable a writer. This marker is composition metadata, never authorization;
every write still passes the unchanged official server/host checks. The actual
default composition remains unconfigured, creator remains503/can_create=false.

There is no error-based fallback: configured401/403/503 remains that result. A
legacy denial never tries the functional reader. A write denial removes read/
edit admission without any legacy read or write attempt. `reference_id` retains
its original separately-authorized reference resolver; list cutover does not
replace that operation. The old reader body and legacy POST are byte-identical
to3102; this client never calls legacy POST. No weaker authority path is added.

The existing per-scope command sessions retain UNKNOWN and submitted wire across
explicitly selected read-mode/locale changes. A successful GET never resolves
UNKNOWN. Explicit retry reuses the exact existing wire/key, not a new command.
The writer, executor, fingerprints, receipts, schema, Core/Docs and CE010/CE011
source are unchanged; document-free Guide reading remains independent.

### Targeted evidence and repeatable commands

Use the already admitted exact toolchain, without installation:

```sh
node scripts/test-ce-guide-read-cutover-01.mjs --toolchain=/path/to/exact-toolchain --before
node scripts/test-ce-guide-read-cutover-01.mjs --toolchain=/path/to/exact-toolchain
```

The new harness loads only the fixture setup prefix from the prior connected
harness; none of its10 groups execute. It loads the actual Page, accepted route,
functional handler and Core executor, with modeled Auth/pool/RPC transport.

| Targeted group | Observation |
| --- | --- |
| Accepted reader200 / writer503 | Before: Guide hidden. After: visible in EN/RO/FA; editor absent |
| Configured composition | Actual selector/handler and mounted editor save through draft POST; no legacy read/write |
| Configured401/403/503 | No fallback, no Guide/editor disclosure |
| Existing reader401/403 | Denial preserved; no second reader |
| Revoke after accepted configured read | Write denied, Guide/editor hidden; zero commit and no legacy path |
| UNKNOWN across explicit server-mode/locale changes | Plain read does not clear pending; explicit same-wire replay commits only once |

All six new grouped checks PASS on Next16.4.1/Zod4.6.6; full unchanged-target
TypeScript5.9.3 and scoped lint PASS. Syntax/diff and old GET-body/POST byte
identity checks PASS. The16 prior successful controls and unrelated suites were
NOT_RERUN. The previous unchanged next/font build failure remains recorded above;
no repeat build or workaround. Native browser, actual Auth/DB, restart/reload
persistence and Guide creation remain NOT_RUN_NOT_PASS/open. No SQL, install,
backend connection, grant, activation or deployment was performed.

Automation classification remains «نیازمند بررسی»; read-cutover regression checks
can inform review, but official Core15 and Platform12 admission remain required
for authorized native save/readback. This classification creates no execution
authority.
