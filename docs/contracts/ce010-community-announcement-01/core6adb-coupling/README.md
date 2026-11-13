# CE010: official Core6adb consumed by the actual route

CE source parent: `989e35a78363908357f65460011492e0472dc047`.
Required official Core source: `6adb3e3f0ffc72f1f138a4990b23653a7c5b62cd`,
Tree `599da1c4585ce31f79c5fdf187694eebe477c5c0`.
Page sequence44, CE card `abddc921-425e-4880-bd38-f1067f4fdda6`.
This is a CE-only source delta, tested with that exact Core dependency in an
isolated composition. It does not vendor/copy/modify Core producer code or
merge unrelated Core domain work into the CE branch. The standalone CE source
branch needs this official dependency before compilation; **typecheck PASS is
for the reconstructed composition**, not a claim that Core is already installed
on the target or merged into main.

## Runtime path and private handoff

`src/app/api/customer/v1/community/base/route.ts` now directly imports
`createCoreCe010RequestRuntimeV1`. GET and native POST pass its returned runtime
to the existing `createAnnouncementHandlersV1`, preserving the **same original
Request**. The HTTP/provider/C01/C03 implementation is unchanged, including
QFW-CE010-01 (issuer verification before last canonical guard), current Auth,
read versus publish, exact command/key/wire/receipt and UNKNOWN/replay.

App/Platform's only new injection point is the server-only
`CE010_PLATFORM_PROVIDER_V1` in
`src/lib/community/community-announcement-platform-provider-v1.ts`. Its type
comes directly from `Parameters<typeof createCoreCe010RequestRuntimeV1>[0]`:
`{runtime_pool: Pool, target: CoreFunctionalDevelopmentTargetV1,
connection_model: CorePlatformRoleBoundConnectionModelV1}`. It is **NULL**.
There is no env discovery, credential text, public setter, callback proof or
parallel adapter. Core factory and its closed CE010 query/profile are consumed
as delivered, not replaced by Guide/SERVICE or a generic pool.

When NULL, the accepted independent legacy reader is preserved; a native
prepare/execute envelope is still unavailable. Once explicitly selected,
invalid factory inputs return503, Auth denial returns401, canonical denial
returns403, and missing helper/connection returns503. None falls back to the
legacy reader or writer. A legacy announcement mutation is also blocked when
the native provider is selected. Other existing legacy commands are unchanged.
A successful GET never resolves a pending UNKNOWN command.

## Reconstruction and observed composition

Both inputs are formal commits in the same repository. No old local archive or
shared worktree is required. In a clean verifier checkout with both objects,
replace `CE_SUCCESSOR` with this README's containing successor commit:

```sh
git worktree add --detach /absolute/ce010-verify 6adb3e3f0ffc72f1f138a4990b23653a7c5b62cd
git diff --binary 62f3c4ea3280821d3df69cd5d0cfbd10fbf6cb6d CE_SUCCESSOR > /absolute/ce-overlay.patch
git -C /absolute/ce010-verify apply --check /absolute/ce-overlay.patch
git -C /absolute/ce010-verify apply /absolute/ce-overlay.patch
```

`62f3...` is the exact common ancestor of Core6adb and CE989. There are **no
Core-owned changes in CE's overlay**. This procedure keeps Core6adb's official
source unchanged and overlays the accepted CE/Guide history plus this CE delta.
Guide bytes are identical to CE989, not reverted to Core's earlier Guide copy.
Other dependency layers are not fabricated or installed. Supply only the
already validated toolchain through the verifier's normal local mechanism;
do not install/repair package/lock or copy credentials. Then run:

```sh
node scripts/test-ce010-core6adb-route-coupling.mjs
./node_modules/.bin/tsc --noEmit --incremental false
```

The test reads **only fixture definitions** from the exact Core test artifact
and CE fixture history; none of their test groups is executed. The new loader
uses actual candidate source for the route, official factory, CE handler,
provider and C03. SDK Auth/physical PG/role-safety responses are controlled at
the transport boundary. The private-slot override is test-only, not a runtime
registry. Every real network fetch is forbidden by the test. All six groups
passed with Next16.4.1/Zod4.6.6/TypeScript5.9.3. Focused lint/syntax and composed
ES5 typecheck passed. The previous14 Core,23 packet and3 recovery cases were
not repeated.

## Open operational gates, unchanged

The source producer is now present; **BLOCKED_ON_CORE_SOURCE no longer applies**.
Runtime remains NOT_READY pending Platform's real private binding, exact role/
column ACL/RLS/owner/default ACL/SET-role graph and the real implementations of:

* `app_private.assert_ce010_role_safety_v1()`
* `app_private.acquire_ce010_role_safety_lease_v1()`

Use Core6adb's `docs/core/domain-ports-01/ce010-producer-19/profile-contract.json`
as the required semantics. The second primitive must hold real catalog/role
mutation exclusion or proven invalidation through settlement; `safe:true` in a
model is not that proof. Source-proposed `cladora_ce010_runtime` and
`cladora_ce010_executor` are not observed installed roles. Missing/invalid
helper, role/ACL, target or binding must remain fail-closed. Destroy-on-release
capacity and currentness/concurrency/settlement/restart require Platform/QA.

The older guarded installation packet is retained byte-for-byte as its historical
source candidate. Its source pins were derived from the earlier Core host; they
are not silently rebound or declared installation-ready for Core6adb. Platform/
Core must reconcile that candidate with the official6adb query/role profile and
seal the actual target postimage before any separately permitted installation.
The old packet verifier/suite was not run or represented as passing on this new
composition.

No SQL/parser/PG/Auth/target connection, role/grant, install, activation, native
API/browser or production operation ran. Guide and SQL packet guards are
unchanged. Source coupling acceptance and native acceptance remain separate.
Viewer Page is read-only; central recording remains with Coordinator.

خودکارسازی: نیازمند بررسی؛ کنترل اتصال سورس تکرارپذیر است، ولی admission
نقش‌ها، helperهای واقعی و اجرای محدود به Platform و پذیرش QA وابسته است.
