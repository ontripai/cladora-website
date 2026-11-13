# Published source consolidation candidate

This candidate combines current published Core, AIRPROP, CE011 (including its CE010 ancestry), and independent Guide discovery changes on main. The historical CE route could not resolve the Core CE010 binding when built alone; the real published supplier is present in this combined tree. Private successor adoption and operational activation remain separate work.

The merges preserve each public branch's ancestry. CE010 is already an ancestor of CE011 and was not merged as a second independent delivery. The authored product metadata change is the approved two-field Node engine constraint `22.x || 24.x`; dependency objects, resolutions and integrities remain unchanged. The later CI successor changes only harnesses, the reviewed Core17 source-check workflow and APP source-check wiring in Application Foundation; its Node22/24 matrix is retained.

## Included and remaining branches

| Branch | Published head | Disposition |
| --- | --- | --- |
| main | 6cecfa15b00f445be68817e756d766fb0e6fe026 | Base |
| codex/core-domain-ports-01 | 4b3138f0ff0a27187d23d8a5b058d114ddcad773 | Merged |
| codex/ce011-basic-events-c03 | c32002bbf93f0dd9b8c5a2097a2afea7503ef3d4 | Merged |
| codex/ce010-community-announcement-01 | b5adc9bc392838dee384b1cd8c6e297084626659 | Covered by CE011 ancestry |
| codex/ce-guide-native-01 | 7d5ec54a4718bdac600b6a668453d51818f22a4e | Merged; independent post-wait discovery bounds retained |
| codex/airprop-listing-native-01 | e20d6fb3715f52977b13305b650abf635b1f20da | Merged with the approved exact Core runtime blob |

## Core and AIRPROP handoff

The AIRPROP merge had one conflicted path, `src/lib/core/functional-command-runtime-v1.ts`, with three content conflict hunks. The exact public source comparison is in `core-vs-airprop-runtime.diff`; `airprop-runtime-since-common.diff` isolates AIRPROP's additions since the common ancestor. These are retained comparison evidence, not patches to apply blindly. The conflict is now resolved by the explicitly approved selection of the exact existing Core blob for this one path.

Core blob: `8ef53310edd2f7bac8f9c43b7bbf7925ad34db8f`.
AIRPROP blob: `5c34552afe4323298730e7a622b2f437df1f874b`.
Common blob: `79c16e9c6e75ea218ab25f1ed19dd89d0a0eabd7`.

The merge commit is `b46965f929497b78d4b4b63685c9405b1fbef6d8`, with parents `3cae66e4f51a093fd112f1cf5aca9c2f4eff4002` and `e20d6fb3715f52977b13305b650abf635b1f20da`. Only the conflicted runtime path was restored from official Core commit `4b3138f0ff0a27187d23d8a5b058d114ddcad773`; the blob is exactly `8ef53310edd2f7bac8f9c43b7bbf7925ad34db8f`. The rest of AIRPROP's normal merge result is retained. No branch-wide ours/theirs, new runtime implementation, parallel host or temporary provider was introduced.

The resolution preserves Core's SERVICE final-wire/custody and Finance hooks while admitting the published AIRPROP route/resolver against that official API. All five requested public branch heads are now ancestors of the candidate. No outstanding published-branch conflict remains; semantic acceptance belongs to independent QA.

## CI harness successor

The current CI correction source is `2f6d371c687d721f352fcdfa431ffd9a83ac2b3a`, parent `3da06810fb4dee2927655bff140d7d3a0ce65864`; it continues the first correction `bec53e4301d539181ca564f8f87d9498875bc02b` on prior published head67. The same PR retains every published ancestor and the exact Core runtime blob. See [ci155-review.md](ci155-review.md) for affected results, loader callgraphs, and Core17 source-successor application. [core17-seal-application.json](core17-seal-application.json) records the exact five-path proposal, local checks and successful real Node22.23.4/24.22.2 CI at552ea91b; the later independent S01/Documents successor requires its own exact-head CI. This successor changes scripts, review inventory and the proposed Core17 workflow and APP source-check wiring in Application Foundation. Product UI, Auth/MFA guards, package/lock and historical Core17/native evidence remain unchanged. See [historical-source-domains.md](historical-source-domains.md) for later post-auth/B2 source-domain reconciliation. The exact original historical validator runs against its original Git sources; a separate73-file profile checks the actual successor. Execution/native admission remains false.

## Earlier validation of the product combination

The earlier tested product-source head is `b46965f929497b78d4b4b63685c9405b1fbef6d8`; file pins and merge parents are in `inventory.json`:

- Full `npm run typecheck`: PASS with the repository's strict tsconfig and no Core diagnostic filter.
- Full `npm run lint`: PASS with the existing ESLint configuration and zero warnings.
- Isolated `npm run build`: PASS, Next16.4.1/Turbopack on Node24.19.0. The first attempt rejected a node_modules symlink outside Turbopack's root. Copying the same installed dependencies into this isolated worktree resolved that environment-layout issue; no package installation, configuration edit or lock regeneration was used. The initial error remains in the local review evidence.
- Four selected affected AIRPROP/Core coupling groups: PASS against the full candidate's actual route/resolver and official runtime/binder, with controlled SDK/SQL transport: verified AAL1 denial, post-bind assurance drop while preserving original wire, genuine typed MFA versus accessor/lookalike errors, and unchanged uncertainty for raw40001/lost COMMIT ACK. Only these four filters ran; the unrelated domain/UI suites did not.
- The six CE route/Core/provider/C03 coupling groups passed on the earlier actual partial combined head. AIRPROP changes none of those route/Core/CE/Guide product inputs or package/config/workflow inputs, so those successful checks were preserved rather than replayed or counted as new. Neither controlled run establishes live SQL or native acceptance.

The earlier review documentation commit left the tested `src`, package/lock, tsconfig, ESLint, Next config and workflow trees unchanged. Results bind to the recorded tested source tree; documentation alone is not a new runtime check.

## Review and operational gates

The PR is a draft for independent review of the complete requested published-source combination. The real candidate and all merge parents are available; independent QA review/acceptance is pending. All five public branch heads are covered; no independent QA acceptance is claimed. Latest private APP/Finance/CE successors and current Gemini UI/WIP are excluded; these public snapshots do not represent their adoption. Original private worktrees remain untouched.

A local build does not prove Vercel's selected Node version, real Auth/permissions/RLS, target installation, lifecycle settlement or native acceptance. Private operational bindings remain NULL and operational capabilities remain NOT_READY. Main merge, branch retirement, target SQL/install, role/Auth/RLS changes, restart and activation are outside this handoff.
