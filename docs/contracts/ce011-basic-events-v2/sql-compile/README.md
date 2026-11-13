# CE011 — exact SQL body validation receipt

Parent/source checkpoint: `8d79d1e6c17ad75701a52787e5e1f3d93523bb33`.
Task: Page sequence96 CE card, continuing the same basic-event candidate.
The two exact audience/command declarations compiled with
`check_function_bodies=on` on **PostgreSQL17.5, PGlite0.3.14 / WASM** in a
fresh task-owned in-memory database. This is real PostgreSQL engine body
validation, not regex parsing, the existing JS domain model or native PG17.11.

Product file27198bytes/SHA256
`8c50327189769c022fd3c9b13f1620d9abb8fc910fe01e670aa2ec12c304d1ce`
and its unconditional55000 guard are unchanged. The harness extracts exact
function declaration spans into its private database; it never executes the
whole guarded product file, removes its guard, runs an installer, connects to
a shared target or supplies real authority. No product correction was needed.

| Unit | Source body SHA256 | Result |
| --- | --- | --- |
| app_private.ce011_audience_current_v2(uuid,uuid) | eab3e34c17a1aabf14105094904324f9ac258c1cdbf61570205edde7d7111c1b | Embedded body validation PASS; stored prosrc MATCH |
| customer_api.command_ce_event_v2(jsonb) | 633a539cb36a51d4f067859344a5a254a3abbdc3839e28d67b39ea89cf34feba | Embedded body validation PASS; stored prosrc MATCH |

`compile-receipt.json` contains exact source/declaration offsets/lengths/hashes,
stored body/definition hashes, identity arguments, volatility, security-definer
and search_path properties, harness/fixture hashes and the actual engine
version. An intentionally malformed PL/pgSQL body was rejected with42601,
confirming body validation was enforced. The fixture's actor/permission
sanity check remained NULL/false. These controls do not constitute real Auth.

## Dependency classification

Seven CE canonical table declarations and the existing CE authorizer are
extracted **unchanged** from the pinned historical operational proposal.
No historical registry seed, policy/service-role grant, receipt trigger or
installer is executed. Shared platform/identity/auth/audit shapes are explicit
minimal substitutes in `scripts/ce011-sql-compile/dependency-substitutes.sql`.
Auth UID is NULL; Core permission functions return false; Context resolvers
return zero rows; current-session guard throws42501. There are no live
identities, customer records, JWTs, entitlements or permissive authority stubs.

No RLS, role graph, actual default ACL, permission activation, lease or Core
currentness implementation is installed. The memory database's fixture DDL is
harness preparation, **not target installation**. No valid event command or
receipt mutation was executed. PostgreSQL PL/pgSQL validation at CREATE does
not plan/execute every nested SQL statement: **all seven command execution
paths, late waits/revoke, rollback/concurrency and persistence/restart remain
NOT_RUN_NOT_PASS**. The SQL audience function's CREATE validation resolves its
actual table/column expressions against these explicit shapes. Native driver,
PG17.11 compatibility and real RLS remain independent verdicts.

## Engine custody and independent reproduction

No engine or native PG binaries existed in this executor. The existing capsule
reference in the Page returned404 on this connection; its files.json was
readable and hash-matched. Do not treat another seat's capsule access as CE's.
The public **same version** PGlite tarball was downloaded once to a task-owned
folder with inherited proxy/TLS and no package installer/hooks. SHA512 npm
integrity was checked, and all12 public runtime file hashes matched the
independent files.json. No private capsule/Finance fixtures were reconstructed,
no shared package/lock/config was changed, and historical runtime identity is
not declared proven. `engine-input.json` pins the public tarball and every
runtime file. The binary engine is not embedded in this source artifact.

Use that already materialized engine when available; do not rerun a successful
compile merely to copy a PASS count. For an independent authorized verifier,
materialize the public pinned tarball in a **separate task-owned** folder,
verify its SHA512/SHA256 and the12 hashes in engine-input.json, then run:

```sh
node scripts/ce011-sql-compile/compile.mjs --engine=/absolute/runtime --receipt=/absolute/new/compile-receipt.json
```

The engine path contains package.json and dist/index.js/data/wasm. The receipt
path must not exist: prior receipts are never overwritten. The harness performs
no downloads/fetches, npm installs, target connections, daemon startup or menu
mount. Only the exact extracted function declarations are submitted; the
product file's full-source hash is asserted before and after. Existing11 groups,
CE010/Guide packets/suites and earlier metadata checks were not rerun. Syntax,
focused lint and diff checks passed; there is no TS/product code change needing
a new full typecheck/build.

## Verdicts / next inputs

* **Embedded parse/body validation: PASS** for both exact declarations.
* **Actual target install: NOT_RUN**; no target/role/GRANT/restart/activation.
* **Real RLS/Auth/native and full seven-path SQL execution: NOT_RUN_NOT_PASS**.
* **Core coupling: BLOCKED_ON_OFFICIAL_CORE_FACTORY_PROFILE_INPUT**. The Page96
  Core card explicitly assigns this next port; no formal delivered factory/pin
  was present in that reference. `core-port-request.json` remains CE's consumer
  request, not approved authority. Once real source arrives, only the new
  resolve/fixed-RPC/result/error boundary is exercised; no body clone/reread,
  command reconstruction, auto-resend or borrowed CE010/Guide profile.

Core owns the official request-local port and canonical role/authority/query
closure. Platform owns actual schema/role/ACL/RLS/lease/binding/window/capacity
and native installation. QA owns independent acceptance. Compile success does
not unblock these gates or alter defaultNULL. The free single-occurrence
scope, product SQL, Guide/CE010/Shell and package/lock remain unchanged.
Viewer Page is not edited; Coordinator owns central recording.

خودکارسازی: نیازمند بررسی؛ اعتبارسنجی بایت و compile مستقل تکرارپذیر است؛
تصمیم admission و اجرای native به Core/Platform و پذیرش QA وابسته می‌ماند.
