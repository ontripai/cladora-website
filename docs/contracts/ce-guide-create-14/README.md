# CE-GUIDE-CREATE-14 — single-step Guide creation

Worker: CLADORA-CE-WORKER-01. Direct Parent:
`47a2d22beffeb76fcb0d13612eb2a006df21c7fb`.
Branch: `codex/program-ce-independent-base-02`.
This is the independent source continuation of the OPEN CE-FUNCTIONAL-GUIDE-13,
not native acceptance or activation. The prior read-cutover correction is retained.

## Product execution path

`/{en|ro|fa}/app/experience/guides` → `CustomerExperienceGuidePage` →
`CustomerExperienceGuideCreate` → `createCe012GuideCreatorV1` → existing
`/api/customer/v1/experience/guides/draft` handler →
`createCe012CreateWriterProviderV1` → existing
`createCorePostgresTransactionHostV1(...).execute`.

The server read selector and its default NULL capability are unchanged. The
accepted `/guides` reader stays authoritative while no official role-bound pool
is configured. Its plain read response never enables creation or the new editor.
No error-driven reader fallback, legacy writer fallback or service_role is added.
With the official functional composition, successful current read/manage evidence
admits the form. The server recomputes authority for each command; a UI flag or
client Core JSON is not authority. The current actual default remains disabled.

The first slice is a workspace-audience, single-step **draft**, not publication.
No reference is required or submitted. Documents is not called. The form displays
this boundary in EN/RO/FA and requests title, first-step title, instructions and
reason. Existing versioned Guide reading/editor behavior is consumed unchanged.

### Preparation, identity and execution ABI

1. A new form submission allocates command_id, Guide UUID and storage-step UUID
   once. It parses the existing `ce012CommandSchema` create_guide command with
   expected_version=0, existing reason/audience and one step with references=[].
   IDs exist before fingerprinting. Invalid schema dispatches nothing.
2. POST `{op:"prepare_create",command}` is read-only, with no reservation or
   mutation. The server parses the strict single-step/no-reference subset and
   derives actor and current authority revision through the existing verified
   session and native probe. It returns `ce012-prepared-create.v1` with the parsed
   command and strict existing CoreTransactionCommandV2.
3. The create fingerprint is SHA256 of sorted-key stable serialization of this
   strict parsed create command, prefixed `sha256:`. It is a CREATE mapping,
   not a replacement for save_draft's accepted fingerprint or golden. The browser
   checks the complete prepared command and relevant Core effect bindings, then
   retains the exact execute_create bytes. The server recomputes the fingerprint
   and complete create/Core binding before dispatch. Core owns its canonical
   command hash, C03 key and collision semantics.
4. POST `{op:"execute_create",command,core_command}` enters the existing host
   with the verified actor and request-bound official role lease. Core aggregate
   version and subject-reference version are1 (the created result); the business
   command remains expected_version=0. relation=create_guide is distinct from
   positive-version save_draft. Provider source locks include Guide and step IDs.
5. Host locks workspace/aggregate/sources, resolves canonical authority and C03,
   then validates the CE provider. CE checks absence under the same transaction;
   fresh canonical authority is bound to the private staged command/scope/attempt.
   It checks again after C03 reservation, at the first mutation boundary.
6. The provider inserts only canonical experience.guides (draft/version1/
   content_version1/verified created_by) and experience.guide_steps (version1/
   position1), through that exact Core transaction scope. A post-effect canonical
   checkpoint throws into the same rollback on expiry/denial. Storage PK/FK/
   version/RLS/trigger behavior remains the existing schema's responsibility.
7. Core generates its own mutation/receipt relationship and writes its existing
   audit/outbox/C03 response_ref before its sole COMMIT. CE creates no second
   ledger, domain receipt table, deferred repair or post-COMMIT mutation. The
   save-only guide_save_receipts_v1 contract is NOT reused for a create0 command.
8. A committed/exact_replay Core result yields a bounded HTTP projection:
   outcome=created, command_id, guide_id, version=1, receipt_id (the actual Core
   receipt ID), idempotency_key, payload_fingerprint and replayed. Raw authority,
   private rows and Core receipt internals are not exposed. This projection is
   not another persisted receipt type. Fresh session failure yields202 UNKNOWN.
9. Only a matched successful projection allows onCreated. The Page selects that
   Guide ID and performs the current read. The accepted editor opens only after
   valid readback/current can_edit. No optimistic fake Guide/receipt is inserted.

The previous unimplemented op=create request retains its bounded503 behavior;
it is not a legacy write fallback. New clients explicitly use the two-phase
prepare_create/execute_create transport described above.

## Replay, UNKNOWN and lifetime

The browser holder is transport/snapshot state, not a command/receipt engine.
A synchronous flight guard coalesces identical concurrent submits and rejects
conflicting concurrent input. From the first execution dispatch, uncertainty is
retained on network failure, timeout,202, malformed success, conflict or denial.
There is no automatic POST, new key, retry loop or HTTP-error fallback. Explicit
retry sends the exact same retained execution bytes; it does not prepare again.
A preparation-only failure has no domain effect and can be corrected explicitly.

Core checks exact C03 actor/hash/key/receipt before CE's read-only replay hook.
The hook reads the canonical immutable version1 step and original created_by,
then rechecks current authority after the read. It does not insert a missing row,
reserve a new key, repair history or recreate a Guide. Original40001 objects
escape into the existing bounded Core retry unchanged; CE has no retry loop.

Per-Context/membership/workspace cache retains draft/UNKNOWN across local scope
suspension and locale changes. Responses and decoded JSON must still match the
current owner generation. Old component generations cannot publish success or
clear a new draft. Form inputs lock while UNKNOWN; an explicit same-command retry
remains available. A plain GET (including one showing the newly created Guide)
never resolves UNKNOWN and cannot grant that Guide's editor admission while its
creation is uncertain. Before-unload warns about a local draft/UNKNOWN.

Browser command retention is in-memory only. No claim of duplicate-free intent
across a hard reload, persistent browser queue, native Auth or durable DB restart
is made. Other existing Guides remain separately authorized and editable.

## Targeted evidence

Existing exact toolchain: Next16.4.1, Zod4.6.6, TypeScript5.9.3, Node24.19.0.
No install, package/lock edit or dependency repair in this task. Use:

```sh
node scripts/test-ce-guide-create14.mjs --toolchain=/path/to/existing-exact-toolchain
# One targeted group only:
node scripts/test-ce-guide-create14.mjs --toolchain=/path/to/existing-exact-toolchain --case='exact group name'
```

The harness loads actual Page/form/client/handler/provider/Core host. Only the
constraint-aware fixture setup from the exact Core review ae8107 is reused; none
of its prior cases execute. Auth, role/SQL transport, clocks and storage are
MODELED. The in-memory rows exist in the test boundary only, not a runtime engine.
No SQL parser, PostgreSQL connection or synthetic JWT is used.

| New group | Observed outcome |
| --- | --- |
| Existing create0 vs positive save | Positive expected_version, multiple steps and nonempty references rejected400 |
| Full connected source path | One Guide+step+C03/audit/outbox; valid readback/version1; no Documents calls |
| Double submit / duplicate / lost reply | One mutation; exact-wire explicit replay, one commit |
| Key/payload and Guide collision | Conflict; original rows/receipt unchanged |
| Storage step collision | Guide/C03 rollback; no receipt/audit/outbox |
| Session/permission/cross-scope/actor | Denied without new effects; cross-scope independently denied by modeled canonical permission |
| Expiry at reservation / original40001 | Mutation checkpoint blocks/rolls back; same40001 reaches Core's three bounded attempts |
| Malformed success / denial after UNKNOWN | Draft/wire retained; no rekey or second preparation |
| Late response and JSON owner replacement | No settlement/success in new scope; UNKNOWN retained |
| Mounted EN/RO/FA | Actual form creates, reads and selects same Guide; existing editor rendered |
| Mounted UNKNOWN across locale/suspension | Draft survives, creation remains locked, GET grants no editor, explicit exact-wire retry |
| Accepted reader/default offline writer | Reader200 preserved, writer503, no create/editor admission; later denial stays denial |

All12 distinct targeted groups passed. The initial combined invocation passed9
then failed the mounted fixture because React DOM was loaded before JSDOM, so
input events did not update React state. Fixture initialization was corrected;
the affected mounted groups passed with actual DOM input events. Later scoped
checks consumed those results; no successful unrelated suite was replayed.
The cross-scope negative was strengthened to deny via its actual modeled binding,
without using an unrelated expiry flag. Final source typecheck/lint are separate.

Previous16 Task13/G2/CE010/CE011 suites NOT_RERUN. Full exact-toolchain unchanged
ES5 typecheck and scoped lint PASS; syntax/diff/inventory checks PASS. Full build
NOT_RUN here; the earlier unchanged next/font failure stays a separate gate.
Native browser/PG/Auth, install, save/readback after hard reload/restart and real
expiry/rollback remain NOT_RUN_NOT_PASS. No staging/Production/deployment action.

## Exact remaining native composition gates

No required host primitive is absent for the independent SOURCE implementation:
CoreTransactionHostV1.execute + CoreTransactionProvidersV2 already exist at Parent
in `src/lib/core/postgres-transaction-host-v1.ts`; current authority is the existing
`resolveAuthority(scope,request)` in `current-authority-postgres-provider-v1.ts`.
The CE request boundary consumes `CorePlatformRoleBoundPoolV1.connect()` from
`src/lib/core/platform-role-bound-pool-v1.ts`, with exact existing CE executor/
runtime principal identities. No new role, permission or allow callback is added.

Core15's official partial source a0a37f3c573558d14be2e62ba27e6e5475b9c4fe
was read from its published checkpoint/report6603918348. Its usable ABI is
`createCoreAuthenticatedSessionRuntimeV1({pool,auth_origin,publishable_key,database_oid}).check(accessToken)`;
it returns a session observation after guarded ROLLBACK, with Context/action
not_evaluated. That is NOT a Guide/C01/C03 capability or installation evidence.
Core reports C01/C03/domain binding still NOT_READY. No silent source merge,
server-side token invention or credential request/transfer was performed here.

| Owner | Required gate | Closure evidence |
| --- | --- | --- |
| Core | Admitted native Context/manage+read/entitlement authority and canonical C03 host custody | Current actor/membership/workspace/revision, denial and post-wait currentness on same backend; actual atomic receipt/audit/outbox and original40001/UNKNOWN/replay evidence |
| Platform/Core | Official CorePlatformRoleBoundPoolV1 CE lease, installed canonical guides/steps + Core dependency graph | Exact role/RLS/ACL/custody/target and schema identity reviewed; ordinary runtime/executor; no owner/service_role fallback; no inferred positive grant |
| Platform | Isolated developer Auth/session and durable target with private connection custody | Same-worker admission and synthetic issued account; no cross-Seat localhost/credential assumptions; real target restart/readback |
| CE | Product native creation/read/edit/retry verification | Real one-step create0→readback1→edit; concurrent conflict, denial and expiry/revoke after wait; exact-wire retry without second save after lost reply/restart |

The actual default remains `role_bound_pool:null`. No SQL, Auth/DB connection,
installation, grant, activation or runtime was performed in this task. Task13
remains OPEN until native durable creation/readback after restart and independent
acceptance. Published source is not completion or release authority.

خودکارسازی: نیازمند بررسی؛ ورودی پیش‌نویس یک‌گامی و فرمان نسخه‌دار؛ آماده‌سازی
و بررسی کنترل‌شدهٔ هویت/نسخه قابل بررسی است، تصمیم ایجاد و retry با کاربر دارای
اختیار جاری؛ شرط اجرا producer و هدف توسعهٔ معتبر Core/Platform؛ UNKNOWN و
انقضا به CE/Core/Platform ارجاع می‌شود؛ ارزش هنوز اندازه‌گیری نشده و طبقه‌بندی
مجوز اجرا یا فعال‌سازی نیست.
