# Published source consolidation candidate

This candidate combines current published Core, CE011 (including its CE010 ancestry), and independent Guide discovery changes on main. The historical CE route could not resolve the Core CE010 binding when built alone; the real published supplier is present in this combined tree. Private successor adoption and operational activation remain separate work.

The merges preserve each public branch's ancestry. CE010 is already an ancestor of CE011 and was not merged as a second independent delivery. The only authored product change is the approved two-field Node engine constraint `22.x || 24.x`; dependency objects, resolutions, integrities and CI workflows are unchanged.

## Included and remaining branches

| Branch | Published head | Disposition |
| --- | --- | --- |
| main | 6cecfa15b00f445be68817e756d766fb0e6fe026 | Base |
| codex/core-domain-ports-01 | 4b3138f0ff0a27187d23d8a5b058d114ddcad773 | Merged |
| codex/ce011-basic-events-c03 | c32002bbf93f0dd9b8c5a2097a2afea7503ef3d4 | Merged |
| codex/ce010-community-announcement-01 | b5adc9bc392838dee384b1cd8c6e297084626659 | Covered by CE011 ancestry |
| codex/ce-guide-native-01 | 7d5ec54a4718bdac600b6a668453d51818f22a4e | Merged; independent post-wait discovery bounds retained |
| codex/airprop-listing-native-01 | e20d6fb3715f52977b13305b650abf635b1f20da | Deferred pending Core-owned runtime reconciliation |

## Core and AIRPROP handoff

There is one conflicted path, `src/lib/core/functional-command-runtime-v1.ts`, with three content conflict hunks. The exact public source comparison is in `core-vs-airprop-runtime.diff`; `airprop-runtime-since-common.diff` isolates AIRPROP's additions since the common ancestor. These are review evidence, not patches to apply blindly.

Core blob: `8ef53310edd2f7bac8f9c43b7bbf7925ad34db8f`.
AIRPROP blob: `5c34552afe4323298730e7a622b2f437df1f874b`.
Common blob: `79c16e9c6e75ea218ab25f1ed19dd89d0a0eabd7`.

This candidate retains the exact official Core blob; it does not claim that choosing it completes AIRPROP adoption. Core's owner must reconcile `makeConnect`, execute/host, SERVICE final-wire/custody and Finance hooks with AIRPROP's identity/MFA/read requirements. No ours/theirs resolution, parallel host, temporary provider or domain rewrite has been introduced. Receive that resolution under `CORE-AIRPROP-MERGE-COMPAT-01`, then merge the actual AIRPROP branch and verify the affected combined boundary. The other branches proceed independently.

## Validation of the actual combination

The exact tested source head and file pins are in `inventory.json`:

- Full `npm run typecheck`: PASS with the repository's strict tsconfig and no Core diagnostic filter.
- Full `npm run lint`: PASS with the existing ESLint configuration and zero warnings.
- Isolated `npm run build`: PASS, Next16.4.1/Turbopack on Node24.19.0. The first attempt rejected a node_modules symlink outside Turbopack's root. Copying the same installed dependencies into this isolated worktree resolved that environment-layout issue; no package installation, configuration edit or lock regeneration was used. The initial error remains in the local review evidence.
- Six affected CE route/Core/provider/C03 coupling groups: PASS on current candidate files with controlled Auth/SDK/Pool/C01 transport. Positive read, original Request, UNKNOWN/same-wire replay, absent/invalid provider, missing safety helper and denial-after-read boundaries are exercised. Fixture identities are historical; product modules come from this actual combined worktree. No live SQL or native result is asserted.

The review documentation commit leaves the tested `src`, package/lock, tsconfig, ESLint, Next config and workflow trees unchanged. Results bind to the recorded tested source tree; documentation alone is not a new runtime check.

## Review and operational gates

The PR is a draft for independent review of this partial published-source combination. QA remains INPUT_PENDING until receiving the actual candidate; no independent QA acceptance is claimed. AIRPROP remains outstanding as described above. Latest private APP/Finance/CE successors and current Gemini UI/WIP are excluded; these public snapshots do not represent their adoption. Original private worktrees remain untouched.

A local build does not prove Vercel's selected Node version, real Auth/permissions/RLS, target installation, lifecycle settlement or native acceptance. Private operational bindings remain NULL and operational capabilities remain NOT_READY. Main merge, branch retirement, target SQL/install, role/Auth/RLS changes, restart and activation are outside this handoff.
