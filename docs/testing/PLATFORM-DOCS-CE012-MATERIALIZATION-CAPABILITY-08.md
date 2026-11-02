# Documents CE012 complete materialization and fixed-operation capability

Task `PLATFORM-DOCS-CE012-MATERIALIZATION-CAPABILITY-08`.
Direct parent `357e3e620cf8374ad0f836ddde0db449cdca7b4b`, branch
`codex/program-local-runtime-lane-01`. Consumer remains exactly
`c0caf3e70d97c3d09b16cbff91188367804cba6b`, request v2. This delivery
replaces the route policy by an explicit source delta, preserving its original
graph, all43 occurrence identities and historical07 policy in Git history.

## Lint and fallback receiver

The actual ESLint finding at runtime-routes.mjs was fixed first. Two lexical
closure functions replace the this alias. The ordinary Module._load wrapper
still calls the original fallback with **its original invocation receiver**;
it is not an arrow function and this was not rebound to the guard. A targeted
sentinel test exercises both fallback receiver and guarded receiver. Real ESLint
with the unchanged repository config reports exit0/max-warnings0; effective
`@typescript-eslint/no-this-alias` severity2. No suppression/config change.
React auto-detect prints its existing informational notice in this tool-only
checkout; it is not an ESLint rule warning. Eight changed JS files lint/syntax PASS.

## Complete private materials, not an installer

The new offline `runtime-materialization.mjs` produces and validates a fresh
private context with601 distinct regular files /18407664bytes:

| Inputs | Count | Identity / handling |
| --- | ---: | --- |
| Original inventory |322|300 SQL source files,20 pinned TS sources, package and lock; unchanged inventory hash.|
| Producer ESM |5|admission/run/live/measure/closure, exact accepted v2 bytes; not imported.|
| Request/inventory/native closure |3|Exact accepted metadata, unchanged.|
| Original runtime closure |271|Original29packages/525edges/43blocked occurrences, exact cached bytes.|

319 inventory entries matched existing checkout bytes; three missing accepted
Documents sources were fetched using the official GitHub connector at exact c0
Head and checked against original inventory bytes/SHA256/Git blob identity.
Nothing was installed, upgraded or changed in the checkout/cache/producer source.
Source/cache roles are operator-supplied offline inputs, not request-selectable
execution paths. Only exact declared paths are considered. A missing cache path
may be searched in the next explicitly supplied root; an existing drifted,
symlinked or aliased file is rejected, not repaired or silently skipped.

The materializer verifies source identity before allocation, before every copy
and again after all copies. Component symlinks, root/path aliases, nonregular or
multi-link files, duplicate paths/inodes, extra files and byte/hash drift reject.
O_NOFOLLOW reads compare inode/device and nanosecond timestamps across reads;
destination files are exclusive-created, fsynced and completely read back.
Directories0700, material files0400; no shared node_modules mutation. The original
runtime-inputs.json bytes and graph are retained exactly in the new private scope.

The **unchanged original verifyMaterials** runs on the full601-file package,
including all322 inventory entries and five ESM. Result PASS. Copying/reading the
SQL bytes neither executes SQL nor approves300 migrations or an installer. No
admission, registry entry, signature, session, fixture or receipt was fabricated.
Prior06/07 materializations and receipts remain untouched.

Materialization seal (sorted path/bytes/SHA256 list only):
`d3fb7a9c98c05e8701ae934d9934fee8769cb29be617b277b673b17b43086d33`.
The private copy-time receipt preserves its then-current source seal; final
validation binds the same unchanged601 file bytes to the final source/policy
seals separately. Neither seal includes its own receipt/hash. No old receipt is
rewritten to claim it was produced by later source.

##35 callback occurrences: capability proof, not trace absence

All35 previously unresolved TypeScript callback rows move to DENIED_AT_RUNTIME
for **external effect capability in the fixed source operation**. The original
8 denials remain. Their IDs, source SHA, offsets, parent/specifier and original
graph-entry hash are unchanged, and previous_status is retained. All43 original
BLOCKED graph records remain; no graph edge or source byte is removed/rewritten.

The implementation is `typescript-operation.mjs`, wired into RuntimeRoutes.
Its proof obligation is absence of a capability channel, not that each readFile
callsite is unreachable. TypeScript may reach library-owned in-memory callbacks;
those are not external filesystem reads. The guards enforce:

1. The exact unchanged TS5.9.3 library is evaluated in a fresh realm without any
   host capability object/function injected (the context-global backing is empty
   and null-prototype). module/exports, compiler hosts, internal
   callbacks and literal compiler options originate inside that realm.
2. Node globals, require, process, timers, console, fetch and WebAssembly are
   unavailable. String/Wasm code generation is disabled, and no dynamic-import
   callback is supplied. Actual realm probes verify sys absent, local prototypes,
   absent globals and denied code generation. These conditions supplement source
   inspection; the absence of an I/O trace is not used as the argument.
3. The sole operation accepts a primitive string whose bytes/hash match one of
   the20 exact inventory sources. Source code is parsed/transpiled as data, never
   evaluated. Boxed/coercible/unpinned inputs reject without calling coercion.
4. Caller options are inspected as exact own data properties. Proxies, getters,
   toJSON, unknown keys, inherited/foreign prototypes and callback options reject
   before compiler invocation. No caller options object crosses into the realm.
   The compiler receives only a literal CommonJS1/ES2022(9) options object made
   inside the realm; no transforms, plugins, hosts, module selectors or callbacks.
5. Only a primitive JSON string crosses outward. The host reconstructs frozen
   data: primitive output text and diagnostic numbers. No VM object, callback,
   function, error or prototype is returned. Unknown VM failure becomes a closed
   guard denial, preserving quarantine; it does not expose a VM error object.
6. Input<=1MiB, output<=4MiB, diagnostics<=128,32 operations per realm and2s
   per operation. Unknown/extra APIs and filesystem/native/dynamic edges fail
   closed. SSL file selectors still cannot pass the fixed connection parser;
   pg-native/libpq remain forbidden with no install, stub or fallback.

The mapping is specific to this exact bounded API/library/realm. It does not
declare callbacks safe in arbitrary compiler-host APIs or prove that the native
Documents loader/harness is compatible. `requireLiveCapability()` independently
rejects `NOT_READY_NATIVE_CONSUMER_CAPABILITY` before producer import/connection.
Policy native_consumer_verified=false; accepted runtime=NULL; registry=EMPTY.
Closing35 source-operation effect gates grants no execution authority.

## Real cold operation and affected tests

One permission-restricted child ran20 cold operations: a fresh guard, module cache
and TS realm for **each** exact pinned source. All20 PASS, diagnostics0. Output
was hashed in memory and never executed. Provider/selector/run.mjs and business
operations were not invoked. No Client/Pool was constructed or connected.
The child had read access only to the private scope, Platform tool directory,
two fixed config files and pinned Node/Docker CLI bytes; no write/child/addon
permission. No Docker command was invoked. An earlier restricted attempt stopped
at metadata access with operations0; it is preserved, not represented as a PASS.
The metadata reader was narrowed to exact config files instead of broadening
repository read permissions; then the real20-source operation succeeded.

-13 NEW materialization/capability groups PASS (12 initial groups plus one targeted
  VM-timeout/quarantine fault check).
-6 changed material/input cases retested after nanosecond-read hardening and a
  boxed-string test fixture edit; no unchanged compiler operation was replayed.
-6 affected07 groups PASS for new policy counts, AST identity, membrane and smoke
  interactions. Remaining successful07 tests, collector/product/audit/provision
  suites were not rerun.
-8-file real ESLint and syntax, plus diff-check PASS.

New checks cover SQL-as-data/ESM/runtime drift, missing/extra files, symlink and
hardlink/root/path aliases, failure before allocation, original receiver,
getters/proxies/foreign realms/coercion, strict output/operation bounds,
unknown compiler APIs and live HOLD. Negative cases use disposable synthetic
copies; they never mutate the original materials or weaken assertions/guards.

Reproduction requires only accepted cached/fetched exact source bytes and existing
toolchain. No setup command installs dependencies. The fixed source-only child is
`runtime-cold-smoke.mjs --root PRIVATE_COMPLETE_SOURCE --pins PRIVATE_RUNTIME_JSON`;
launch it with read-only Node permission flags described above, not consumer --run.
Focused tests use DOCS_CAPABILITY_TEST_SCOPE for the private601-file scope.

## Remaining execution gates

Coordinator review of this source delta; native closure/target compatibility,
actual owner raw/canonical plan input and provenance, exclusive fixture/custody,
genuine current session/assurance, and official stored Core/CE receipt relation
verification remain separate gates. Both historical slots stay BLOCKED. Compiler
5f6b671d remains only a pure/source reference, never a fixture or replacement for
c0 harness. GET/hash/committed:true cannot fill the stored-receipt verifier gap.

No Docker/PG/SQL/Auth/session/live dispatch, installation/grant/activation,
staging/Production, merge/deployment or other owner's source change occurred.
Profile, custody, transport, package/lock, original producer/harness/provider/
selector and ACL02 lane are unchanged. Only ordinary Push to the assigned branch
is authorized; source review and live acceptance remain distinct.

## Automation classification — this Platform process only

| فرایند موجود | قابل خودکارسازی |
| --- | --- |
| آماده‌سازی materials و capability محدود CE012 توسط Platform | نیازمند بررسی |

ورودی: c0/request.v2، inventory و runtime pinهای مصوب؛ بخش قابل خودکارسازی:
تطبیق bytes/seal، کپی خصوصی و readback محدود؛ تصمیم انسانی و نقش: coordinator
بازبینی source و owner تأیید نسخه و دامنهٔ هر اجرای آینده؛ شرایط اجرا: binding
دقیق، اختیار جاری و پیش‌نیازهای native/custody بدون UNKNOWN؛ استثنا و مسئول
ارجاع: drift/شکست/UNKNOWN به Platform و coordinator، بدون retry خودکار؛ وابستگی
رسمی: همین consumer و رابطهٔ کامل stored receipt و target/session مصوب؛ معیار
ارزش: زمان آماده‌سازی و نرخ خطا، فعلاً نیازمند بررسی و بدون برآورد عددی.
این طبقه‌بندی آمادگی یا اختیار اجرای native ایجاد نمی‌کند؛ Tracker هماهنگی یا
فرایند عملیاتی محصول در این بسته تغییر داده نمی‌شود.

مرجع: CLADORA-AUTOMATION-DIRECTION v1.0.0,
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6582412814.

Skills Policy: CLADORA-SKILLS-USAGE v1.1.0,
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482.
cloud-environment:cloud-environment-runtime (visible version UNKNOWN) and networking
reference read; current#463/AGENTS read. Applied to offline permission boundaries
and authorized GitHub source work, without expanding runtime authority.
