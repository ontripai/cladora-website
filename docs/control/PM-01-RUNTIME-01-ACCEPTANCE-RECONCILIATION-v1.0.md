# PM01-RUNTIME-01 acceptance reconciliation v1.0

**Control owner:** PM / CLADORA Documentation

**Runtime owner:** Core/Platform

**Repository:** `ontripai/cladora-website`

**Observed at:** 2026-10-10 UTC

## Purpose

This versioned addendum reconciles the historical v1.4 manifest and coordination
matrix with the live delivery state of `PM01-RUNTIME-01`. It does not rewrite
the earlier observations embedded in those artifacts and does not authorize a
merge, migration, deployment, route enablement, Secret change or closure.

## Dependency reconciliation

| Package | PR | Live result | Merge commit |
| --- | --- | --- | --- |
| `V14-DOC-BASELINE-01` | #313 | MERGED to `main` | `dd9dd1611858c1a0ce7494d88ae2ca7228fd4771` |
| `PM01-A` | #322 | MERGED to `main` | `1f5eae0e317f6b94b44a7ea974920e1a0ec5f60c` |
| `PM01-B` | #323 | MERGED to `main` | `10109bba4d172a09740d8e41b3e0f47cd935e4f6` |
| `CE-011` | #318 | MERGED to `main` | `506d137dc323761697e5918f50e6bb661b72b30b` |

Draft PR #324 was reviewed before PR #318 merged, while its merge base remained
`10109bba4d172a09740d8e41b3e0f47cd935e4f6`. The existing branch was then
rebased directly onto exact `main` at
`506d137dc323761697e5918f50e6bb661b72b30b`; no replacement branch or PR was
created.

## Reviewed implementation state

- Package: `PM01-RUNTIME-01`
- PR: #324
- Branch: `feat/pm01-runtime-01-private-oversight`
- Implementation head independently reviewed before this reconciliation commit:
  `67d04d8951496daa8a687a0a1605887f9b7ad466`
- Corrective commit at that head:
  `67d04d8951496daa8a687a0a1605887f9b7ad466`
  (`fix(pm): enforce independent acceptance gate`)
- Pre-rebase reconciliation and acceptance head:
  `1deca0dc323b45c9fe54339d40dd3df2b8f983b5`; acceptance comment
  `6097744327` applies only to that exact head and its pre-rebase base.
- Rebased corrective commit: `7aefaab3216dbd98e12961696e24daff409d3332`.
- Rebased reconciliation parent before this controlled refresh:
  `b1219244127e4d09dd2f702fa7d2f12e1e4f89ee`.
- PR state at observation: OPEN, Draft, mergeable and clean
- Vercel Preview deployment:
  `dpl_AspuvyL5na5jTn1Bk73wUoZERSQY`, READY

The containing reconciliation commit cannot embed its own Git SHA. GitHub's live
PR head is therefore authoritative after this file is committed. Every required
check and the Vercel Preview must be rerun on that resulting head; results from
`67d04d8` or the accepted pre-rebase head `1deca0d` must not be projected
forward.

## Pre-rebase CI evidence

The following GitHub Actions runs completed successfully on
`67d04d8951496daa8a687a0a1605887f9b7ad466`:

| Workflow | Run |
| --- | --- |
| Application Foundation | `38052734337` |
| SERVICE catalogue persistence | `38052734339` |
| Shared dependency depth guard | `38052734341` |
| Shared workspace native authority | `38052734343` |
| Database tests | `38052734346` |
| AIRPROP opportunity contract | `38052734353` |
| AIRPROP scope regression | `38052734383` |
| AIRPROP underwriting contract | `38052734384` |
| SERVICE catalogue contract | `38052734396` |

The Database workflow included the delivery-head static contract and isolated
Postgres runtime jobs. The Vercel commit status and Preview Comments check also
completed successfully on that exact head.

All 17 GitHub/Vercel checks also completed successfully on the later pre-rebase
head `1deca0dc323b45c9fe54339d40dd3df2b8f983b5`, with Preview deployment
`6981049248`. Those results remain historical evidence only. The final rebased
head requires its own full CI and Preview results.

## Reviewed fingerprints

| Artifact | SHA-256 |
| --- | --- |
| `docs/control/PM-01-RUNTIME-01-IMPLEMENTATION-EVIDENCE-v1.0.md` | `7141f1badcd56501b949f470a8ba944a52047a1ccefea93d6ee3f90157f11636` |
| `supabase/migrations/20261009094331_pm01_private_oversight_runtime_v1.sql` | `e66f382f8f680cc0eeab6df6dd0b848783f3aeee1080cf87452507b2318cb60b` |
| `supabase/tests/172_pm_private_oversight_runtime.test.sql` | `1ce73efc9dfe4d989766b1339ac96dd6bdff42df8613335dc68cee1a7694a6c0` |
| `supabase/tests/173_pm_private_rollback_rehearsal.test.sql` | `db398cdf7d5ec77e2a3d4c7c199cb0a7033f9b07d460d0e1705da13f4448bc9f` |
| `supabase/tests/174_pm_private_authorization_atomicity.test.sql` | `4be270b033c4af9d450c0fbe0f3d60b1606bfd49db9e8a6aa6e7afdcd353b4db` |
| `supabase/tests/175_pm_private_acceptance_gate.test.sql` | `9cfccde95615fc7812b70f78c0b55e5e3558ae23617a79a0f70feda5d508a5e6` |
| `scripts/test-pm-private-runtime-concurrency.mjs` | `78dac3ce3a054ba78f1e9ce127bd36664416744269454cbab3ab5ee71751062d` |
| `scripts/test-pm-private-runtime-gateway.mjs` | `6e79656b532e653e26f6cbc2d37cb570dbb59ea89a558410b4f85db526d60173` |
| `.github/workflows/database-tests.yml` | `28898dad6c17d4e46e5909b57bdb5850a3131bb8f0e7bd289068aa226dacc6d8` |

Any content change to these artifacts invalidates this fingerprint set and
requires a new reconciliation entry and delivery-head validation.

## Live-base rebase refresh

The four existing commits were rebased onto
`506d137dc323761697e5918f50e6bb661b72b30b` without conflict. `git range-diff`
reported all four patches unchanged. The PM01 migration retained both its exact
filename and SHA-256 fingerprint
`e66f382f8f680cc0eeab6df6dd0b848783f3aeee1080cf87452507b2318cb60b`.

The post-rebase local static contract passed with 238 ordered migrations, 169
pgTAP files and 5,423 assertions. The bounded gateway test, TypeScript typecheck
and repository ESLint also passed. These local results do not replace the
required isolated `postgres-runtime` job or the final-head Vercel Preview.

## Remote and rollout observation

Supabase project `jyomlehahwlyqzoacrvp` did not contain migration
`20261009094331` or schema `pm_private` at observation time. The installed
`pm_control` reporting system and its Edge Functions are a separate active
boundary; their existence is not proof that this runtime migration is installed.

Merging `main` is connected to automatic Vercel Production deployment. For that
reason, Draft exit, merge, Supabase Remote migration, Production deployment,
Production smoke testing and branch cleanup remain independent gates. A failure,
SHA change, migration mismatch, Preview failure, Production failure or new
finding is a hard stop.

## Documentation branch disposition

The merged Documentation branches
`docs/cladora-v1.4-controlled-baseline` and
`docs/pm01-runtime-readiness-inventory` had no open child PR at observation
time. They are only cleanup candidates after a fresh ownership, reachability,
CI/Vercel and rollback-need check. This addendum grants no deletion authority.
