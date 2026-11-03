# PLATFORM-DOCS-CE012-RUNTIME-PINS-06

Base: `2a718a7315bcdbf512f0401abb9dc1e7e469afec`.
Branch: `codex/program-local-runtime-lane-01`.
Status: COLLECTED_AND_MATERIALIZED / LIMITED_SMOKE_PASS / UNRESOLVED_ROUTES_BLOCKED.
Execution authority: NONE; registry empty; accepted runtime binding NULL.

## Fixed consumer and source boundary

The consumer remains `c0caf3e70d97c3d09b16cbff91188367804cba6b`, request v2,
request SHA256 `3ca7a18b4789d262565dc3289cf029d633b36a0fa155c5f3a575dfeedc619873`,
native closure SHA256 `55093d835a860ceeb414fbd097d3b62af2520e60cee5b093763ff7f983f928ee`.
The unchanged package/lock match that source exactly. No consumer source,
package/lock, shared node_modules, old native input or profile byte was edited.

Documents compiler `5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa`, ABI
`documents-ce012-case-plan-compiler.v1`, is an owner-reported accepted pure/source
addition. It is not the executable harness or a replacement request. Its test
inputs were not loaded or used as fixture/provenance. Seven COMPILED_SHAPE and two
historical BLOCKED slots are not runtime evidence. Raw/canonical owner input,
actual custody and the official stored Core/CE receipt relationship verifier
remain necessary; GET/hash/committed:true cannot replace that verifier.

## Executable collector and materializer

`runtime-collector.mjs` has a closed CLI:

```sh
node scripts/docs-ce012-platform-v1/runtime-collector.mjs \
  --cache-root EXACT_EXISTING_CACHE \
  --output FRESH_PRIVATE_DIRECTORY \
  --python EXISTING_PYTHON_BINARY --smoke
```

No install/download/update or dependency bin/install script exists in this path.
The cache selector is an operator-local read-only input, never a consumer request
path or a module/SQL/shell selector. Package/lock hashes, five installed package
versions and transitive lock versions are verified before collection. Tool
versions come only from Node/Python/Docker CLI --version; Docker daemon commands
are not invoked.

Roots are fixed: pg, TypeScript, Zod, next/headers.js, @supabase/ssr, node:crypto.
The last two package roots are required by the existing actual Documents product
loader; collecting only the first three would hide required imports. The parser
comes from the already installed exact TypeScript5.9.3 cache. It finds literal
require/require.resolve and static import/export edges, with package metadata and
actual Node resolution preserved. It does not execute graph modules while
collecting. Conservative unresolved dynamic/data/native/ESM paths are recorded
as BLOCKED, never inferred from a successful smoke.

Selected packages are checked for symlinks; output files are fresh regular copies
of exact consumed bytes. Logical symlink aliases are rejected rather than silently
flattened into a different lookup layout. Absolute module selectors, host fallback,
version drift, source drift before copy, duplicate output and capacity exhaustion
fail closed. Nested package paths stay nested. Metadata and byte hashes are
re-read after copy through the existing safeRead/runtimeFiles path.

Bounds: at most10000 runtime files,128MiB of node_modules bytes,16MiB per file,
50000 edges and a60s collection deadline; selected package metadata scans are
bounded to20000 entries each. The two separately pinned root package/lock files
are additional source metadata. These are explicit collector bounds, not a claim
of an operating-system disk quota.

Private directories are0700 and copied files0400; no symlink is materialized.
The full dependency graph, package metadata, tool selectors/cache provenance and
source/byte readback audit stay private. No whole node_modules tree/archive or
private receipt is published.

## Loader integration and isolated smoke

The new format is `docs-ce012-runtime-pins.v1`. Existing runtimeFiles verifies
actual Node/Docker executable hashes, graph seal, all file bytes and native-file
exclusion. lockModules now validates parent/specifier/target edges as well as
file hashes, so a different pinned module is not enough. CJS and ESM resolution
are covered through the existing loader plus synchronous Node module hooks.
Only the five separately source-pinned producer ESM files have the producer
exception. Unlisted dynamic edges, external/non-file imports and native addon
loading fail closed. No permission to execute is derived from this map.

`runtime-smoke.mjs` loads only the fixed five roots, transpiles a small in-memory
TypeScript value and parses a small Zod object. It never constructs a connection,
loads the consumer run entry, or obtains Auth/session data. The smoke child runs
with Node's permission model, no addons, no fs-write/child/worker/WASI grants,
and exact read grants for its private materialization, helper source, Node binary
and Docker CLI binary. Existing network/process fencing is also applied. An
unrestricted/writable process is rejected by the smoke entry itself.

The initial manual smoke lacked the exact Node-binary read grant and was BLOCKED
with ERR_ACCESS_DENIED; that evidence is retained. The fixed command builder now
provides that narrow read grant. The integrated final collector/materializer and
smoke ran successfully. Earlier materializations remain preserved separately.
No protection was disabled and no broad filesystem/network escape was used.

The live worker has a separate fail-closed gate for unresolved runtime routes;
collection or smoke exit0 is not execution readiness. Binding JSON remains
inactive and the registry empty. Existing custody/session/native prerequisites
and admission code were not weakened or activated.

## Actual scoped result

- 271 runtime files; 11650553 bytes;29 packages;525 edges.
- Two root source metadata files, byte-identical to the producer package/lock.
- Source and materialized consumed bytes MATCH after smoke; destination symlinks0.
- pg8.23.0, TypeScript5.9.3, Zod4.6.6, Next16.4.1, @supabase/ssr0.12.5 observed.
- All five roots: PASS limited load; TypeScript transpile/Zod parse: PASS in memory.
- 14 new focused test groups PASS incrementally; syntax/diff checks PASS.
- No old35/19/26/7, health/provision, product suite or audit replay.

| Tool | Actual version | Binary bytes | SHA256 |
| --- | --- | ---: | --- |
| Node | v24.19.0 |125989464|bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12|
| Python |3.12.14|30894944|fa67443527ed9647f760d807e2a38f26340757123e643c4639cf273ed15d5ea7|
| Docker CLI |28.4.0 / d8eb465|43556144|27f239f97492c434e091a70b41b8796c698f0aa2b6052c6f9c28da4ee7ae888b|

The installed cache's package/lock matched the producer and its earlier npm-ci
receipt recorded exit0. This task neither reran installation nor converted the
historical unrelated compatibility failure into a whole-product PASS. Only the
consumed package bytes/versions were independently observed and preserved here.

## Remaining blockers

43 detected routes remain explicitly BLOCKED. This conservative literal-graph
scan is not a proof that every possible dynamic effect is modelled. Other unreviewed
branches remain globally blocked by the inactive runtime binding and empty registry:

| Category | Count | Examples / decision boundary |
| --- | ---: | --- |
| Dynamic data reads |40|TypeScript host/system file reads; pg-connection-string SSL file selectors. Need scoped reachability/policy proof; no assumption from this load smoke.|
| Dynamic require |1|TypeScript require(modulePath); no arbitrary runtime module choice admitted.|
| Native dependency |1|pg-native, absent/unadmitted; no libpq/native installation or fallback.|
| Unresolved literal |1|TypeScript optional source-map-support; no install inferred.|

Graph SHA256: `c9e7635b9009d2898be3115af36de6f2c0140bce142510eccbc680c996dba3ab`.
Runtime-file pin-list SHA256:
`b7c0f3435b670dccb172a7fa673dd5397b6269a138c04b983c71d3d83f5518d1`.
The full lists are private, including source offsets and exact relative targets.

No unresolved route was dropped, declared unreachable without review or enabled.
Closing them requires bounded source/reachability review or a separately reviewed
runtime-policy delta, not new dependencies, arbitrary stubs, suppressed checks or
an automatically enlarged closure. Actual owner input/plan, native compatibility,
exclusive fixture, genuine current AAL2 session and committed receipt relationship
remain separate open gates. The two historical compiler slots stay BLOCKED.

No Docker run/pull/start, PG, SQL, Auth, session, consumer --run, install, grant,
activation, staging/Production, CI or deployment was performed. The compiler was
not executed and no test-input fixture or approval/signature was produced. The
collector's real offline observation is not a business/native/hosted receipt.
