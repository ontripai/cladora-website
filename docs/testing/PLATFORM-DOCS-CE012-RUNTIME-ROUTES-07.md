# Documents CE012 runtime routes — source candidate 07

Task: `PLATFORM-DOCS-CE012-RUNTIME-ROUTES-07`.
Parent: `c4e0c14b3f140fe5c44bee4eb1f16c2bd6ed767c`.
Branch: `codex/program-local-runtime-lane-01`.

This is a policy, executable guard and targeted offline test delivery. It is
**not runtime admission**. Registry remains EMPTY, accepted runtime binding NULL,
consumer dispatch/session/native/PG/Auth NOT_RUN. The unchanged consumer is
`c0caf3e70d97c3d09b16cbff91188367804cba6b`, request v2; the pure/source compiler
`5f6b671d2ea1b1a7341d1ed0352fe2ae2713bdaa` is a reference only, never a replacement
harness, fixture or provenance source.

## Exact occurrence policy

`scripts/docs-ce012-platform-v1/runtime-route-policy.v1.json` contains all43 original
occurrences with ordinal, source SHA256, parent, specifier, UTF-16 offset, original
entry hash and stable identity. Offsets are TypeScript5.9.3 CallExpression.pos,
including preceding trivia; a literal require retains its argument specifier.
An independent AST check matched each row to the actual pinned library source.

| Status | Count | Scope / enforcement |
| --- | ---: | --- |
| REQUIRED_PINNED_DATA |0|None of these43 library routes is allowed a file read.|
| DENIED_AT_RUNTIME |8|Three pg SSL reads; two direct TypeScript fs reads/listings; TypeScript dynamic require; optional source-map-support; pg-native.|
| STILL_UNRESOLVED |35|Opaque TypeScript host/system/project callback reads; exact callsite/effect closure remains unproved. Live worker stops before producer import/connection.|

The original graph remains byte-identical:271 files,11650553bytes,29packages,
525edges,43blocked records. Graph SHA256
`c9e7635b9009d2898be3115af36de6f2c0140bce142510eccbc680c996dba3ab`;
file-list SHA256
`b7c0f3435b670dccb172a7fa673dd5397b6269a138c04b983c71d3d83f5518d1`.
The policy is additive; it neither deletes graph records nor converts a missing
trace into a reachability proof. Eight effect denials are not a complete runtime
closure. `requireResolved()` still rejects35 unresolved rows.

## Executable boundary

`runtime-routes.mjs` pins the exact policy bytes. It clones/freezes its input pins,
statuses and descriptor. Parent/specifier/target must be an original static edge;
new edges, absolute/file URLs, external paths, native/lazy addons and dynamic
imports are rejected. Every loaded file is opened read-only with O_NOFOLLOW,
component symlink checks, single-link regular-file/size/inode/hash verification.
Cached module requests still recheck the target bytes. No search/fallback into
host dependencies, new dependency, stub or rewritten dependency bytes is used.

Pinned CJS modules use a private cache and closed require. Runtime fs/promises I/O
and dynamic capability APIs are denial facades. A caught effect denial latches a
first-denial state; subsequent guarded operations fail. Existing network fencing,
source-pinned ESM loader and Node read-only permission boundary remain separate
controls. This is a closed trusted-source library operation boundary, **not** a
general sandbox for arbitrary hostile JavaScript. No claim is made that native
consumer execution has validated these controls.

TypeScript executes its unchanged5.9.3 source in a no-Node VM: no process, require,
filesystem or timers; string/Wasm code generation disabled. The exported membrane
permits only version, CommonJS/ES2022 constants and `transpileModule` with exactly
`{compilerOptions:{module:1,target:9}}`. Inputs must equal one of20 exact accepted
source pins, at most1MiB; compilation has2s VM deadline and32-operation ceiling.
Compiler-host, sys, plugin/module resolution, source-map and other APIs fail
closed. The source reader separately permits only exact path/bytes/hash pins.
Those20 declared source inputs are separate from the original43 library routes.
Only four are materialized/consumed for this smoke; this is not whole-consumer
source materialization or a change to its provider/selector.

The actual pg-connection-string parser is wrapped before it sees input: fixed
postgresql loopback127.0.0.1:5432, exact descriptor database/roles when present,
no password/query/hash. SSL certificate/key/root selectors therefore cannot reach
fs. No SSL files are admitted. pg-native/libpq and source-map-support stay denied.
Source-smoke also rejects Client/Pool construction and the native getter. A parsed
shape URI does not name a real fixture or assert ownership/session.

## Actual delta evidence

Nineteen **new** test groups PASS, zero failures/skips in the final run:

1. All43 rows, source bytes and actual AST offsets match.
2. Missing/extra/duplicate/reordered rows rejected.
3. Source/hash/offset/specifier mismatches and graph new edge rejected.
4.35 unresolved callbacks cannot be closed by mutation/trace absence.
5. Actual pinned TypeScript, exact in-memory source/options positive control.
6. Compiler-host/plugin/dynamic APIs denied; swallowed denial quarantines.
7. Raw-library arbitrary-transpile counterexample denied by membrane.
8. Source hash/symlink, unlisted data and external paths denied.
9. Dependency source tamper/symlink denied before loading.
10. Cached module target mutation rejected on next request.
11. Three SSL file selectors rejected before real parser I/O.
12. Fixed loopback parser positive; wrong host/role/port/password/options denied.
13. Descriptor database/role binding survives caller mutation.
14. Native/libpq/dynamic/source-map/new-edge selectors denied.
15. Runtime fs/read/readdir/promises/write effects denied.
16. Client/Pool/native effects rejected in source-smoke.
17. Installed builtin/dynamic-import hooks and restoration checked.
18. Expanded read-only fixed source/library smoke PASS.
19. Registry EMPTY, binding NULL and exact consumer v2 preserved.

The expanded smoke really transpiles these four accepted inputs in memory:

- `src/lib/customer/documents-ce012-reference-contract.ts`
- `src/lib/community/experience-guide-command-contract.ts`
- `src/lib/core/current-authority-transaction-port-v1.ts`
- `src/lib/security/same-origin.ts`

It runs the real fixed parser without connection; evaluates only the exact pure
Documents schema module using real Zod4.6.6 and observes empty-input rejection;
loads Next headers/@supabase/ssr only. Eight operation records are emitted. No
provider/selector/main, test-input fixture, SQL, Client/Pool connection or Auth is
invoked. Four source hashes and in-memory output hashes are privately retained.
Syntax and diff whitespace checks PASS; these do not replace native tests.

The same existing Nodev24.19.0 and source-pinned cache are used, with pg8.23.0,
TypeScript5.9.3, Zod4.6.6, Next16.4.1 and @supabase/ssr0.12.5. No install/upgrade,
old collector suite, successful consumer/product suite, audit or provision rerun.
A fresh private clone was made using the unchanged accepted materializer and
original file list, not recollection. Original06 materialization/history stays
unchanged. Package/lock and all271 runtime file bytes are preserved.

## Reproduce this source-only check

Use a fresh private clone of accepted06 inputs, retaining its runtime-inputs.json
bytes and original graph. Validate/cache-copy the four listed source files against
the20 policy pins. Reject mismatches; do not install or substitute stale sources.
The caller-owned path below is not a consumer-selected execution path:

```sh
DOCS_ROUTES_TEST_SCOPE=PRIVATE_SOURCE_ONLY_SCOPE node --test scripts/test-docs-ce012-runtime-routes-v1.mjs
```

The test launches the fixed smoke as a permission-restricted subprocess, readable
only for that scope, the Platform tool directory and pinned Node/Docker CLI bytes;
no filesystem-write, child or addon capability is granted to that smoke. Docker
CLI bytes are hashed; Docker is not invoked. Synthetic adversarial test callsites
are test-only, never substituted for the pinned library source.

`docs-ce012-runtime-routes-07.manifest.json` records before/after inventory,
new14-file execution seal, exact changed-file identities and private evidence
digests without raw runtime snapshots, credentials, descriptors or receipts.
Its own hash is external to the manifest; no circular seal.

## Remaining gates and preservation

Review of this policy/guard,35 callback occurrences, full exact source material,
native target compatibility, real owner/plan/raw-canonical input provenance,
exclusive fixture/custody, current genuine assurance/session and official stored
Core/CE receipt relationship verification remain open. Both historical compiler
slots remain BLOCKED. GET/hash/committed:true are not substitute evidence.

No changes to package/lock, Documents harness/provider/selector, profile, custody,
transport, ACL02 lane or accepted source; only Platform route policy/guard/loader
integration, tests and reporting metadata change. No registry entry, approval,
signature, session or runtime binding is produced. The source candidate is for
coordinator review; it is not ready to dispatch a native harness.

Skills Policy: CLADORA-SKILLS-USAGE v1.1.0,
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482.
Cloud Environment Runtime (`c6/cloud-environment-runtime`, visible version UNKNOWN)
was read for environment/permission boundaries; no Docker operation was performed.
AGENTS and current#463 index were read. This package adds no product/Next source,
SQL or hosted configuration; prior successful suites are historical, not rerun.
