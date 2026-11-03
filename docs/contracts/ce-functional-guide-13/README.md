# CE-FUNCTIONAL-GUIDE-13 — partial implementation, functional gate OPEN

Shared Base `ec639884452cc0cb6dfef520339791a5c20e9b39` was adopted by a
normal fast-forward of `codex/program-ce-independent-base-02` from
`0191e0415297a76f3073cbeef7396f4799d3a25c`. No reset/rebase/new branch.
This delta's actual parent is the Shared Base. Earlier WIP/history/evidence remain.

## Implemented independent CE correction

The existing save writer incorrectly required the Documents module even when
`document_target:null`. Only the reference-dependent branch now requires and
constructs the official Documents factory. The null-target branch cannot invoke
Documents at all. No permission/session/receipt/hash/checkpoint is removed.
Existing CE executor, new-version storage ID allocation before fingerprint,
mutation plan, independent receipt IDs, exact-wire UNKNOWN/replay and post-wait
canonical authority checks remain. Reference-bearing commands still fail closed
without the official producer; no sensitive reference is disclosed by this fix.

This is NOT completion of the requested real functional flow. No memory model,
new executor instance or constructed fixture is called durable restart/Auth proof.

## Exact toolchain actually materialized

The official registry resolved Next16.4.1/Zod4.6.6. An isolated task toolchain was
installed from the exact Shared Base package.json/package-lock.json and the
tracked `vendor/braces-3.0.4-cladora.2.tgz`. Source manifests/lock/vendor and the
old worktree node_modules/cache were NOT modified. npm ci used --ignore-scripts,
--no-audit and --no-fund with a task-local writable npm cache. Initial bootstrap
attempts failed due to default cache/materialization paths; the explicit cache
and exact tracked vendor file resolved those prerequisites. No package version,
lock entry, TLS or registry policy was changed to get a pass.

Rebuild the same separate toolchain using those exact3 source files; no install
in the product tree or overwrite of a shared cache is required. Run:

```
node scripts/test-ce-functional-guide13.mjs --toolchain=/absolute/task-toolchain
```

The harness strictly refuses a Next/Zod version mismatch. It loads actual local
CE/Core modules and the pinned Core09 SQL transport fixture prefix; no previous
Core/CE suite is repeated. Six new affected controlled groups pass:

1. Actual current host/writer can stage a no-reference Guide save with no Docs
   module, null typed-receipt target/decision and no Documents query.
2. Even a forbidden Docs object is never accessed for that no-reference command.
3. A reference-dependent command without the official factory denies/no writes.
4. Modeled lost COMMIT ACK and a new executor instance recover the original wire
   by explicit replay, without a second mutation; NOT a process/DB restart test.
5. Concurrent expected-version mismatch preserves the first modeled save.
6. Expiry during C03 reservation wait denies/rolls back the no-reference command.

Full tsc --noEmit --incremental false and scoped lint passed on a verification
copy of this exact source with Next16.4.1/Zod4.6.6/TS5.9.3. Verification copy did
not replace Core/Docs sources or change configuration. MJS syntax, diff and hashes
also checked. No CE010/CE011/G1/G2, old27/23 or other accepted suite replay.

## Precise blockers to requested acceptance

| Gate | Actual observed state | Owner / closure |
| --- | --- | --- |
| Core15 functional host/ABI | Shared Base has Core14 `3e9593af25433dcf32042f624731f514d09ec35b`. Current Core remote also resolves to that same SHA; no Core15 delivery in inspected #463. Do not label Core14 as Core15. | Core/coordinator: official Core15 FullSHA/ABI and incorporation decision; then CE connects and verifies that exact implementation. No guessed/shared-host patch. |
| Authenticated development DB target | Managed revision210 current/enforced, no configured target/credential capability. Explicit local Docker socket reports28.4.0; image/container lists empty. No pre-existing target, principal, schema or persistent volume assumed. | Platform/coordinator: verified owned isolated development target/profile, actual session and least-privilege role capability, persistent owned volume and fixture schema; or exact source/profile for CE-owned isolated provisioning. No staging/Production fallback. |
| Real create path | Current save_draft contract requires an existing draft Guide at positive expected version. Legacy create_guide/GET is NOT equivalent to this save contract. This delta does not fabricate a version1 row/receipt, reinterpret the contract as version0 creation or call legacy as a silent substitute. | CE with Core15: implement/adopt the real creation path and its canonical transaction/receipt contract, then wire the existing editor and versioned read endpoint; current page remains view-only until that real path is present. |
| Real save/readback/reload/restart | No admitted real DB/Auth/product execution here; no reference-dependent action activated. | CE/Platform: real HTTP/Auth → Core15 → committed storage → readback after actual reload and process restart, with synthetic owned data. |
| Security/concurrency/recovery | Controlled no-reference checks above only; no real RLS/session/revoke/expiry/wait/constraint/currentness proof. Historical MATCH does not authorize the current actor. | Core/CE/Platform: actual version conflict, current denial, revoke/expiry across real wait, RLS/scope, same-wire UNKNOWN recovery and no second save. Native proof and complete Release gates remain OPEN. |

The missing Core15/target details were requested from the owner during work;
independent CE correction and exact-toolchain checks continued. No new binding,
allow callback, positive grant, fixture receipt or mocked ready producer substitutes
for those dependencies. Existing historical Documents slots are not promoted.

## Operations / automation

No SQL/parser/PG/Auth/Storage/product stack was started, no Docker image pulled or
container/volume created, and no staging/Production/deployment/activation occurred.
The exact isolated Node toolchain installation above is the only dependency setup;
source package/lock/config bytes remain unchanged. Normal existing-branch Push is
source progress only, not functional acceptance/adoption.

خودکارسازی: نیازمند بررسی؛ ورودی فرمان نسخه‌دار Guide بدون سند اختیاری؛
فرصت آماده‌سازی پیش‌نویس و تطبیق نسخه؛ تصمیم ذخیره با editor مجاز؛ شرط اجرا
Core15 و Auth/DB توسعهٔ معتبر و اختیار جاری؛ UNKNOWN یا mismatch به CE/Core
و مالک محیط Platform؛ وابستگی رسمی همان گیت‌ها؛ ارزش اندازه‌گیری نشده؛ این
طبقه‌بندی مجوز اجرا یا پذیرش ایجاد نمی‌کند.
