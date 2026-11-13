# PR479 affected CI corrections

Current correction source: `b2513eeab79f7281e955ebed48b84c3a2481595f`.
Parent: `0c5182b6d8333006930eadd9304607ba85f2356b`.
Tree: `3de34c115fa266492f7a1d481f234e29cfc13763`.
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

## Open gates

At prior head67 all 23 observed workflows completed: 13 failed and10 succeeded. Each failed job's log was read; the later AIRPROP/Database static failures share the Documents marker failure. Those historical results are not successor CI results. The successor's automatic workflow runs must be read separately; no old job was manually rerun.

Core17 remains **INPUT_PENDING_OWNER_CORE_PROPOSAL**. Its historical seal expects24353 runtime bytes while the approved current Core runtime is39845. The original manifest, checker, operator evidence and native claims are unchanged. The historical native result is not attributed to the current combination. The user explicitly directed APP to leave only this seam waiting for Core's separate proposal. The runtime resolution from the earlier integration decision is already complete and is not pending again.

All five published heads remain ancestors. Product `src`, package/lock, workflows, historical Core17 packet, its loader dependency, and immutable Checklist manifest are byte-for-byte unchanged from67. Core runtime remains blob `8ef53310edd2f7bac8f9c43b7bbf7925ad34db8f`. Original/private worktrees and current Gemini WIP are untouched.

Independent QA acceptance, exact-head CI22/24, current hosted build and target/native remain separate gates. Operational bindings stay NULL and capabilities NOT_READY. No main merge, target install, SQL, role/RLS change, restart or activation was performed locally.
