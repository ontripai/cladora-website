# CLADORA workstream coordination matrix v1.1

**Observed:** 2026-10-10 13:08 UTC from live GitHub, Vercel and PM reporting data

**Repository:** `ontripai/cladora-website`

**Target branch:** `main@506d137dc323761697e5918f50e6bb661b72b30b`

**Control PR:** [#347](https://github.com/ontripai/cladora-website/pull/347)

**Status:** Point-in-time control record. It is not merge, migration, Production deployment or branch-deletion authorization.

## Completed control and delivery packages

| PR | Owner | Result | Head | Merge commit | Verification |
| --- | --- | --- | --- | --- | --- |
| [#313](https://github.com/ontripai/cladora-website/pull/313) | PM / Documentation | v1.4 controlled baseline | `6642ac33fb4d3d15562a35b65ac9563b45649bf0` | `dd9dd1611858c1a0ce7494d88ae2ca7228fd4771` | `MERGED`; 2/2 reported checks succeeded |
| [#322](https://github.com/ontripai/cladora-website/pull/322) | PM / Documentation | PM01-A registry contract | `ac0a7abf5fa8567b17f94b5d155db1af0d575371` | `1f5eae0e317f6b94b44a7ea974920e1a0ec5f60c` | `MERGED`; 2/2 reported checks succeeded |
| [#323](https://github.com/ontripai/cladora-website/pull/323) | PM / Documentation | PM01-B readiness and runtime gate | `450b99a6378c2ce0f9c77f880b5369b10e5975c9` | `10109bba4d172a09740d8e41b3e0f47cd935e4f6` | `MERGED`; 2/2 reported checks succeeded |
| [#318](https://github.com/ontripai/cladora-website/pull/318) | Community & Experience | CE v1.4 independent slices | `e6d5563f4b2b862b1afdc36061d288d7904624db` | `506d137dc323761697e5918f50e6bb661b72b30b` | `MERGED`; 6/6 reported checks succeeded; Vercel Production deployment READY |

The remote Documentation branches for #313 and #323 are cleanup candidates only. They remain preserved until the independent branch-deletion gate is authorized and reachability, open-child dependency and rollback requirements are rechecked. The already deleted `feat/pm01-private-oversight-registry` branch requires no further action.

## PM01-RUNTIME-01 acceptance state

PR [#324](https://github.com/ontripai/cladora-website/pull/324) remains an open Draft owned technically by Core/Platform on `feat/pm01-runtime-01-private-oversight`.

| Base | Head | GitHub checks | Vercel Preview | Remote migration | Control result |
| --- | --- | --- | --- | --- | --- |
| `main@506d137dc323761697e5918f50e6bb661b72b30b` | `44c0d63f81fcc87231e4f3286eaa1a77ee448f7c` | all 17 PR rollup contexts succeeded, including `postgres-runtime` | `dpl_HV8MRVAHjwBqoyqosw581cCBTixR` READY | migration `20261009094331` absent; `pm_private` absent | Same-branch rebase delivered with 0 commits behind; four prior patches are range-diff equivalent and migration fingerprint is unchanged; final acceptance waits only for the required Core-authenticated PM report |

Core/Platform completed the same-branch rebase, preserved the accepted runtime and migration scope, refreshed the reconciliation fingerprints and passed the complete CI and Preview set. It must still submit the exact base/head and evidence through the assigned Core PM credential. PM / Documentation does not impersonate that report and does not rewrite or force-push this Core-owned branch.

## Active dependency stacks

Every PR listed below was open and reported `CLEAN` at observation time. All check contexts present in the rollup were successful; this is evidence only and is not acceptance or rollout authority.

| Workstream | Ordered dependency chain | Draft state | Exact heads |
| --- | --- | --- | --- |
| AIRPROP | `#314 → #315 → #319 → #333 → #340 → #341 → #342 → #343 → #344 → #346` | all Draft | `53f603a`, `6e6f6fc`, `bea9e30`, `d769460`, `fe2492c`, `b23cf4e`, `622245f`, `0a927f5`, `215b0db`, `e6e316a` |
| SERVICE | `#317 → #320 → #321 → #325 → #328 → #329 → #332 → #334 → #338` | all Ready | `dc1816b`, `7a1b773`, `c08dc8c`, `3729884`, `c3f05eb`, `c65810d`, `40f832d`, `4ab4a86`, `9152b11` |
| Core shared contracts | `#316 → #326 → #327 → #330 → #331 → #335 → #336 → #337 → #339` | all Draft | `81fb074`, `2c314b4`, `599ff8d`, `2ac1cc4`, `3c6f097`, `8afed7d`, `aa959e4`, `42ba1c2`, `cf04e67` |
| Core independent root | `#345` from `main` | Draft | `306c8d79b4683b816ee3a4932a547914d850344d` |

The parent of each stacked PR must remain until its child is merged or safely retargeted/rebased and the resulting ancestry, diff, CI and Preview are reverified. A Ready state does not replace acceptance or merge authorization.

## PM reporting reconciliation

The Production PM reporting/oversight control plane in Supabase project `jyomlehahwlyqzoacrvp` is active separately from the uninstalled `pm_private` runtime in PR #324. The latest authenticated workstream reports observed in `pm_control.package_status_v1` were stale relative to the live GitHub state:

| PM package | Owner | Latest report | Recorded delivery | Required correction |
| --- | --- | --- | --- | --- |
| `V14-CORE-01` | CORE | 2026-10-08 16:56 UTC | PR #316 / `81fb0744d7ffb1ce682dbb8ae96541da4ffe7b3f` | Report the current Core stacks and the #324 rebase outcome through the assigned Core credential |
| `V14-AIRPROP-01` | AIRPROP | 2026-10-08 16:51 UTC | PR #315 / `6e6f6fc4996446798df9b4d85518eca762be8657` | Report the current chain through #346 through the assigned AIRPROP credential |
| `V14-SERVICE-01` | SERVICE | 2026-10-08 20:13 UTC | PR #321 / `c08dc8c633272690e45a6d0e8e62e0d1729b5b23` | Report the current Ready chain through #338 through the assigned SERVICE credential |
| `V14-CE-01` | CE | 2026-10-08 19:58 UTC | PR #318 / `b2d5a61b71f091e8da34429f40bed254d026ad91` | Record the merged head, merge commit and verified Production result through the assigned CE credential |

PM oversight must not impersonate a workstream report. Each workstream owns its authenticated update; PM may record observed reconciliation and alerts separately.

## Control invariants

- Read the live base, head, Draft/Ready state, checks and dependencies again before any state-changing action.
- Preserve exact commit and migration fingerprints; a prior acceptance does not transfer across a changed base or head without impact review.
- Merge, Supabase Remote migration, Production deployment/configuration, real-data creation and branch deletion remain independent gates.
- Merging to `main` currently triggers Vercel Production automatically; merge authorization must therefore be Production-aware.
- Do not create duplicate branches or PRs for an existing package.
- Do not delete another workstream's branch. A closed but unmerged PR is never a cleanup authorization.

## Supersession

This v1.1 matrix is the current point-in-time coordination record. [v1.0](WORKSTREAM-COORDINATION-MATRIX-v1.0.md) remains preserved as the 2026-10-09 observation and must not be read as the live PR state.
