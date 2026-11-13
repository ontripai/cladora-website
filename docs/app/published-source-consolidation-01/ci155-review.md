# PR479 affected CI corrections

Current correction source: `84a5ce313bfec47df3b8e63ef598b7dfeb378b66`.
Parent: `ef055c35cf736bbe7ae0d98614e53c368d0134b4`.
Tree: `8eaaed31f48ff73f6c547e462f39a9a392f6e7f3`.
Initial correction source: `bec53e4301d539181ca564f8f87d9498875bc02b` on prior published head67.
The following documentation-only successor records these results. Its exact SHA is available from PR479; tests are bound to the correction source above.

## Changes and callgraphs

- Documents replacement, SERVICE subject-link, and the PostgreSQL authority harness reuse the existing, unchanged `createCore15NativeLoader` → actual TS modules → actual Core imports/JSON. It resolves Next's server marker through `next/dist/compiled/server-only/empty`, supports aliases/JSON/default interop, and publishes the CommonJS cache before evaluation. No Auth, Pool, authority or transaction provider is replaced by this loader.
- CE route loader → actual CE handler → official `ce010-request-binding-v1` → actual Core graph. Its Auth/customer RPC test boundary remains explicit. The standalone loader now handles the marker, JSON default interop, and CommonJS cycles. All 55 route checks remain.
- SERVICE route loader → actual requests handler → official Core read graph → circular imports. Publishing exports before evaluation prevents recursive TypeScript emit. All 42 route scenarios remain; no product read/command behavior changed.
- `test-real-authenticated-service-08` → `verifyAppLayoutMfaComposition` → actual layout, with controlled Auth/redirect/shell transports. The two obsolete exact-text checks now assert execution of required setup and authorized shell, including Guide's return path. Sixteen cases cover unauthenticated/factor error, legacy/SERVICE/Guide setup, AAL1, assurance failure, AAL2 shell, optional legacy MFA and requirement error. Five in-memory mutants (native factor guard, legacy factor guard, AAL2 guard, Guide setup return, shell Guide selection) are rejected. No layout, UI, MFA assertion intent or product guard was removed.
- Underwriting mounted test → actual workspace → newly merged actual Listing editor. The old context fixture supplied `context_id` without required `membership_id`; the fixture now supplies the existing synthetic UUID. Listing and underwriting product code and assertions are unchanged.
- Checklist inventory → `verifyPublishedEngineTransition` → original immutable packet pin + authenticated preimage whose Git provenance is `3e7bb9590d3270ad15423251ea419df551eda4c3` + approved two-field commit `a8e19c358345bc5fc75fd96dea3c3032a80cef0e` + actual files. `engine-source-transition.json` versions this reconciliation separately. The producer independently matched both Git preimages before recording this transition. In shallow CI, the verifier restores only the authorized literal and requires the entire original bytes/SHA256/Git-blob identity to match the unchanged historical packet; no Git history or network fallback is needed. Both original package identities must match the historical packet. Exactly the root selector changes `>=22.0.0` → `22.x || 24.x`; parsed dependency objects and all other raw bytes must match. The historical Checklist manifest is unchanged. Existing checks for all other immutable sources, helper bodies and inactive bindings remain.

## Affected local verification

Node24.19.0/npm11.9.0, existing installed dependencies; no install or lock regeneration.

| Command | Result |
| --- | --- |
| `node scripts/test-documents-replacement-workspace-writer-v1.mjs` | PASS 4/4 |
| `node scripts/test-service-request-subject-link-v1.mjs` | PASS 12/12 |
| `node scripts/test-ce-010-route.mjs` | PASS 55 checks |
| `node scripts/test-service-request-route-010.mjs` | PASS 42 scenarios |
| `node scripts/test-real-authenticated-service-08.mjs` | PASS 262/262; new MFA execution 16 cases + 5 rejected mutants |
| `node scripts/test-airprop-underwriting-ui-008.mjs` | PASS mounted controlled suite, including original pending/retry/MFA/conflict/locale assertions |
| `node scripts/test-release-checklist-composition.mjs --match 'manifest identities'` | PASS affected case, 85 assertions |
| `node scripts/test-app-engine-source-transition.mjs` | PASS two positive identities, ten rejected mutations; semver accepts22/24 and rejects20/23/25/26 |
| Existing Core15 loader: authority provider, transaction host, authority port | PASS actual exports and repeated-load identity; source load only |
| Authority PostgreSQL harness without target environment | Expected fail-closed `Explicit disposable target required`; no SQL execution |
| ESLint eleven changed/new scripts, zero warnings; `git diff --check` | PASS |

The new package negatives reject changed root range, extra dependency metadata, changed lock integrity/build script, extra whitespace, and a forged historical packet pin. The structural comparison also retains every resolved/integrity value by requiring all non-selector bytes identical. No successful historical build/typecheck/domain/supplier/native suite was repeated locally.

## Downstream successor CI findings

The automatic CI at0c5182 passed the initially failing CE010/MFA/subject-link/authority steps and mounted underwriting on Node22, then exposed additional loader seams. The actual failure logs were read before the following edits:

| Affected script | Correction and local result |
| --- | --- |
| `test-ce-010-community-page.mjs` | Existing application source loader replaces generated ESM imports; PASS mounted baseline +48 draft +45 selection groups |
| `test-ce-012-route.mjs` | Same cache/JSON/interop fix for Guide's actual Core graph; PASS55 |
| `test-post-auth-compat-01.mjs` | Resolve actual Guide provider alias/relative graph with cache; preserve explicit per-test mocks; PASS133 |
| `test-service-request-subject-link-http-v1.mjs` | Existing Core15 loader; PASS10 |
| `test-service-catalog-route-002.mjs` | Publish CJS cache before evaluation; PASS53 |
| `test-documents-replacement-promotion-after-clean-v1.mjs` | Existing Core15 loader; PASS4 |
| `test-core-jurisdiction-profile-selector-v1.mjs` | Existing Core15 loader; PASS6 |
| Package transition/Checklist inventory | Ten rejected mutations remain PASS; the affected85 assertions also PASS with GIT_DIR pointing to an absent directory, proving no dependency on a deep checkout |

The existing CE011 route checks were inspected/run for the newly reached pipeline seam and pass unchanged; no edit was needed. ESLint on eight follow-up scripts and whitespace checks pass. Full healthy suites/builds were not replayed locally. Later CI steps are separate from these local source/controlled results.

## Further standalone consumer graph checks

CI atc07c5928 passed Release safety boundaries, both SERVICE catalogue workflows and mounted underwriting. It then exposed the remaining owned-layout alias loader, Vault download marker, Guide delegate identity assertion and jurisdiction PostgreSQL loader. These were read from the actual logs. The three remaining offline Documents/Communications writer/gate loaders in the same blocked static sequence reproduced the same marker failure locally and were corrected, rather than replaying the healthy parts of that sequence.

Only loader functions were extracted for the downstream PostgreSQL harness inspection: eleven further marker failures and one recursive loader failure reproduced without evaluating any target guard, connection or SQL body. All thirteen affected PostgreSQL harnesses now use the unchanged Core15 loader. Their49 actual source-root loads and module cache identity checks PASS. AST comparison with c07c5928 proves every target guard, SQL statement and test assertion outside loader/import declarations identical. [postgres-loader-review.json](postgres-loader-review.json) lists the exact paths/roots; this is not PostgreSQL execution or native evidence.

Owned-layout boundary checks now resolve the actual Guide provider graph while retaining each fixture's isolated process/window and Auth mocks:99 cases, zero failures. Vault download5, private-conversation writer5, attachment gate5, retention gate, jurisdiction artifact resolver7, country retention resolution11 and operation integration8 PASS. The operation harness retains its existing per-module overrides; they were not lost in the loader correction. Existing Documents reference-authority controls pass without any source change.

The Guide factory now intentionally wraps its CE delegates with fresh-check custody. The obsolete direct-function-identity checks are replaced with explicit controlled delegate observations around the real factory: exact Core authority supplier identity, original arguments, validation/replay dispatch, fresh-check order before/after mutation, consumed-once staging, denied validation/replay without staging, and rejection of missing/changed command custody. These wiring observations temporarily replace only the delegate exports and fresh-check transport, then restore them in finally; they do not establish real authority or native settlement. The same HTTP harness uses the actual SSR authenticator with controlled getClaims/getUser/getSession/assurance fixtures and verifies the verified session_id carrier. Six additional negatives reject mismatched subject, missing session_id, expiry mismatch, wrong role/AAL, and claims error. All11 original HTTP groups pass; product guards and UI are unchanged.

ESLint on all22 changed scripts in this correction and whitespace checks PASS. All correction script blobs are pinned separately in inventory.ci155_current.source_pins. The originally accepted product pins remain unchanged.

## Real Core17 CI and last independent source seams

[Core17 run43384398939](https://github.com/ontripai/cladora-website/actions/runs/43384398939) on actual head552ea91b passed both jobs: Node22.23.4/job131749371398 and Node24.22.2/job131749371593. Both actual logs contain the historical62/current73/operator18 receipt and all seven new groups PASS, with native_execution_eligible=false/runtime_activation=null. This is real remote matrix CI, not inferred from the local Node24 run. The final later successor must retain a separately read exact-head result; no manual rerun was requested.

The same552ea CI then exposed two later seams: S01 consumer harness marker resolution, and Documents closure's historical transaction-host pin. S01 now uses the existing unchanged Core15 loader; all four controls PASS, including same-object40001, bounded ordinary failure and exactly the existing three fresh host attempts/rollbacks. No assertion/body/provider/command changed.

Documents closure now consumes the exact, hash-bound Core proposal profile rather than replacing its historical hash with the current hash. The unchanged expected historical host9436c082 is authenticated against the owner's historical→current record; the entire actual current host75138bytes/SHA6bcca1f3/Gitblob458576c1 must match that same record and current product inventory. The producer separately read official Core4b and matched its exact current host. The profile itself must have SHA09ad4bdd, reviewed67 head and native_execution_eligible=false/runtime_activation=null. Other migration/authority/writer pins and all prospective Workspace creation/insert-owner/no-legacy/no-backfill guards remain unchanged. Original closure checks PASS; the focused transition check rejects five host/profile/extra/native mutations. No SQL was run locally.

## Preserved post-auth and B2 historical domains

Atb2e807eb, Core17 matrix again passed both lanes, both SERVICE catalogue workflows and all AIRPROP/CE lanes passed; later Application Foundation stopped at the unchanged post-auth adoption seal and Database at a remaining nested writer loader. The latter now reuses the existing Core15 loader and its seven unchanged controls PASS. The source-domain distinction for post-auth and B2 is in [historical-source-domains.md](historical-source-domains.md). No original checker/manifest/sourceGate/admission function/B2 guard or product file changed. APP's workflow source-check wiring now runs the new bounded composition checks and their negatives; Node22, permissions and existing subsequent guards remain intact.

## Historical admission fixture context

At3da06810 Database static and PostgreSQL jobs pass. Application Foundation then reached the unchanged admission guard, which correctly rejected current package80947 against installed historical fd82 at test-core17-consumer-admission-v1:58. This is expected non-admission of the current successor, not a guard to relax. The original test/guard/manifest remain untouched. APP runner now executes those original positive/negative cases at exact historical main6cec source context in a task-owned detached worktree. Current source identity is still checked separately by the APP composition verifier, and current admission remains NOT_READY_NOT_GRANTED.

Local runner check-only inspection authenticated immutable operator inputs, materialized every original pinned source and cleaned up its own worktree; original45 tests were NOT run locally. Existing CI executes those cases by default in the appropriate context. No fake current Coordinator admission, binding, native capability or pin update was created. Full details are in historical-source-domains.md.

## Terminology AST and late owned-database teardown

CI5f953d9f passed the historical/current Core section and reached the terminology audit. One newly imported Core comment says write-free read transaction; the exact path/phrase is added to the existing technical allowlist, retaining count and phrase assertions. The subsequent local failure identified only internal Guide DTO/cache bindings: typed scope membership_id, a private scope property and a private cache key. No UI source was changed. The auditor now classifies only those exact AST positions and prevents the exception if scope/binding flows into public text, DOM attributes, unrelated components, JSON serialization or spreads. Existing privacy/price/locale/RO-EN-FA/RTL assertions remain; safe private bindings plus new leak counterexamples run by default. The full previously failing audit now PASS4850 assertions. Lint/whitespace PASS.

In the same5f Database job all six Communications currentness assertions passed, then its data pool emitted late SQLSTATE57P01 as the harness force-dropped its own isolated database. The error was an unhandled idle pool event during cleanup, not a failed currentness assertion. A test-only listener now consumes only exact57P01 for the exact self-created database after pool.end and explicit beginOwnDrop. Active-phase, different/missing database,40001, ordinary and unowned errors still throw the same error object; one expected event plus seven rejection controls PASS with the actual EventEmitter transport. All SQL calls/arguments and original assertions are AST-identical to5f. No SQL/role/RLS/target change or retry was introduced; no SQL was run locally. Actual PostgreSQL acceptance remains bound to the next remote CI job.

## Exact published CE/Guide handoff successors

Atab45aa97 the terminology audit passes and Application Foundation reached the old CE handoff inventory. Four current files differ from the preceding frozen inventory/overlay chain: Guide route, Guide component, Guide page, and Community page. Their bytes match the explicit published Guide7d5ec54a or CE011c32002bb heads exactly. The original23-entry inventory and all three existing overlays remain unchanged.

New ce-guide-source-transition.json records only these four paths, exact main6cec before bytes/SHA/blob and exact owner commit/after bytes/SHA/blob. Its hash is fixed in the source verifier. The existing handoff check retains all preceding chain/provenance assertions and uses the bounded transition for those four paths only; every other covered byte remains unchanged. The complete source must equal actual owner Git bytes and its exact predecessor pin; missing/extra/unreviewed paths and native relabel fail. Existing classification counts remain10accepted/9inactive/4internal; QA/native remain pending and runtimeNULL.

Four owner-source positives and ten predecessor/current-byte/extra/native negatives PASS. The affected handoff contract PASS314 reported checks across its original23 entries, retaining inactive runtime, explicit Guide edit gates, absence of automatic SERVICE mutation, separate command identities/receipts, benefit/locale boundaries and RTL. UI files were not edited. The new verification runs from Application Foundation with explicit trigger paths. Lint/whitespace PASS. Database static and PostgreSQL jobs atab45aa97 both pass after the bounded teardown fix; their result is scoped to that head.

## Final jurisdiction artifact standalone loader

At exactef055c35, all23 workflows completed:22 success, one Application Foundation failure. The real Core17 matrix passed both Node22.23.4/job131774859352 and Node24.22.2/job131774859558 in run43392290523; each log was read and contains the62/73/18 identity receipt, all seven new groups PASS and native eligibility false. Database static and PostgreSQL also pass. Application Foundation passed the unit suite and reached one remaining standalone jurisdiction-domain-artifact loader marker failure.

That harness alone now uses the existing unchanged Core15 loader. The affected14 cases PASS with their original country/profile/hash/domain/version/expiry/credential rejection, postal grammar and non-executable artifact assertions; five synthetic countries remain fixtures. Lint/whitespace PASS; no SQL/native or healthy suite/build was run locally. The next exact-head automatic CI must be read separately.

## Open gates

At prior head67 all 23 observed workflows completed: 13 failed and10 succeeded. Each failed job's log was read; the later AIRPROP/Database static failures share the Documents marker failure. Those historical results are not successor CI results. The successor's automatic workflow runs must be read separately; no old job was manually rerun.

Core17 proposal is now received and **APPLIED_EXACT_5_PATHS** in commit07dc064f on existing heade15757fc, preserving every independent correction. All supplied before/after bytes, SHA256 and Git blobs matched. [core17-seal-application.json](core17-seal-application.json) records the five paths and local receipts. The CLI validated the actual current checkout: original62-file historical validator, all18 operator files/helpers unchanged, and exactly73 reviewed successor product files. Seven new focused groups PASS on Node24.19.0: identity plus historical manifest tamper, same-size runtime tamper, extra dependency, extra operator, profile/native relabel and original native guard identity. Syntax/lint of the two new scripts PASS. Original54 controlled cases and healthy build/typecheck/supplier suites were not repeated locally.

The existing Core17 workflow alone now invokes this two-domain checker and its new negative tests; checkout depth0, Node22/24 matrix, npm ci, permissions, budgets, existing controlled/dry-run steps remain as proposed. No historical assertion is skipped: the exact original validate body executes against original pinned Git sources. The current successor profile is separately hash-bound; historical native evidence is not extended to current runtime. SourceGate, historical manifest/checker/operator and product runtime remain byte-identical. Actual automatic Node22/24 results must be read at the final published documentation SHA.

The last independent e157 CI findings were SERVICE offering-flow marker resolution and the exported Documents reference-authority loader reused by its PostgreSQL harness. Both now use the unchanged Core15 loader. SERVICE flow12 and reference-authority7 checks PASS; the exported shared loader also loads the actual Core host/provider/port with stable cache identity, without SQL. Lint/whitespace PASS. At e157 all AIRPROP lanes, CE Community, Release safety and both SERVICE catalogue workflows passed; Database static passed and later PostgreSQL stopped at the shared loader. These are intermediate-head observations, not final-head blanket CI acceptance.

All five published heads remain ancestors. Product `src`, package/lock, every workflow except the exact approved Core17 proposal and APP Application Foundation source-check wiring, historical Core17 packet, its loader dependency, and immutable Checklist manifest are byte-for-byte unchanged from67. Core runtime remains blob `8ef53310edd2f7bac8f9c43b7bbf7925ad34db8f`. Original/private worktrees and current Gemini WIP are untouched.

Independent QA acceptance, exact-head CI22/24, current hosted build and target/native remain separate gates. Operational bindings stay NULL and capabilities NOT_READY. No main merge, target install, SQL, role/RLS change, restart or activation was performed locally.

## B2 marker loader after exact57eb CI

Core17 run43393706361 passed actual Node22.23.4/job131779468889 and Node24.22.2/job131779468381 on57eb876d. Both logs were read; original historical62 sources/current73/operators18 and source-only/native-false boundaries remain intact. Application Foundation job131779468195 passed jurisdiction artifact14 and resolver7, then failed at the B2 shared loader's unresolved `server-only`.

One line in `airprop-b2-test-loader.mjs` now resolves that marker to the installed Next server empty entry, after explicit test mocks and before external module loading. Cache, source resolution, compilation and every B2 assertion/SQL/product input remain unchanged. Only its affected runtime12, API/AP10 6 and rendered UI5 cases ran locally and passed, plus changed-file lint/whitespace. Previously passing B2 safety groups and full healthy suites were not repeated locally. Inventory records exact helper bytes/SHA/blob. Successor automatic CI remains a separate exact-head observation.
