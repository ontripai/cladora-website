# PM01-RUNTIME-01 implementation evidence v1.0

**Owner:** Core/Platform; PM / CLADORA Documentation owns control and evidence records

**Dependency:** PM01-B, merged PR #323; implementation now rebased directly onto `main`

**Exact implementation base:** `506d137dc323761697e5918f50e6bb661b72b30b`

**Branch:** `feat/pm01-runtime-01-private-oversight`

**Migration:** `supabase/migrations/20261009094331_pm01_private_oversight_runtime_v1.sql`

**Delivery state:** Acceptance Finding remediated on the existing Draft PR; the previously accepted head was rebased after `main` advanced through PR #318, so delivery-head isolated CI and independent review are required again; no Remote or Production installation

## Delivered boundary

The migration creates the private, non-Data-API `pm_private` schema, six enum domains, the sixteen tables authorized by the Runtime Authorization Gate, supporting constraints/indexes/triggers and a required-check validator, recursively redacted audit/outbox/receipt behavior, and the eight versioned private boundary functions. Every table has enabled and forced RLS. The schema, tables, sequences, default privileges, and functions grant no access to `PUBLIC`, `anon`, `authenticated`, or `service_role`.

The server-only gateway source is bounded to the eight authorized HTTP contracts under `/api/platform/v1/internal-work`. It derives identity from authenticated claims, requires AAL2 for mutations, validates origin/content type/body size and strict DTOs, and maps database failures to non-enumerating responses. All checked-in handlers use `disabledPmAdapter`; `PM01_RUNTIME_ROUTES_ENABLED` is the constant `false`. Therefore requests return `404` before authentication or database access. No connection Secret, Environment Variable, public schema, or enabled route is introduced.

## Acceptance Finding remediation

The generic lifecycle function no longer contains an `in_review → accepted` edge and explicitly rejects an attempted `accepted` target. Entering `in_review` now atomically persists the exact delivery commit and a bounded, unique set of required check names. A passed test observation must reference passed evidence for the same cycle and commit.

`record_acceptance_internal_v1` now requires the bound delivery commit, locks and rechecks the cycle version/state, verifies the latest observation for every required check against passed evidence for that same cycle and commit, and only then records the independent reviewer decision and performs the `accepted` transition in the same transaction. The acceptance ledger snapshots the commit and required-check set. Manager-only authority cannot use the generic transition path, self-acceptance remains denied, and replay still returns one receipt without duplicating the decision or transition.

The focused Finding suite covers manager bypass, missing evidence, mismatched/stale commits, unrelated passed results, a newer failed result overriding an older pass, exact-check success, reviewer-authored transition, replay, recursive redaction, and injected audit failure rollback. The real two-connection test now also races two acceptance decisions and requires one durable winner.

## Validation evidence

The original implementation was validated with Supabase CLI `2.72.2` in a disposable local Docker database. The rebased remediation uses the repository workflow's pinned Supabase CLI `2.84.2` and a clean ephemeral database as the authoritative delivery-head execution. No remote project reference, database credential, `db push`, Preview migration, or Production operation is used.

| Check | Result |
| --- | --- |
| Clean full migration-chain reset | Required on every delivery head in `postgres-runtime`; 238 ordered migrations, including the PM01 migration |
| Full Repository pgTAP | Required on every delivery head; 169 files, 5,423 assertions |
| PM01 pgTAP contract/RLS | 87 assertions; includes the manager acceptance-bypass denial and atomic reviewer acceptance |
| PM01 rollback rehearsal | 8 assertions; transactional pre-data schema removal and rollback |
| PM01 authorization/atomicity | 25 assertions |
| PM01 Acceptance Finding gate | 23 assertions; exact delivery/check binding, replay, authorization, redaction and rollback |
| PM01 total pgTAP surface | 143 assertions across tests 172–175 |
| Real two-connection race | Required in `postgres-runtime`; registration replay, lifecycle conflict and atomic acceptance conflict each require one durable winner |
| Gateway contract | PASS locally; disabled default, strict validation, exact review/decision binding, AAL/origin/media checks and redacted errors |
| Database package fingerprint check | PASS locally; 238 migrations, 169 tests, 5,423 assertions |
| `pm_private` database lint | Required on the delivery head in the isolated `postgres-runtime` job |
| TypeScript typecheck | PASS locally |
| Repository ESLint | PASS locally with zero warnings |

The authorization suites cover unauthenticated callers, missing platform identity, missing platform eligibility, AAL1 denial, permission separation, expired/revoked/narrow assignments, cross-program non-enumeration, manager acceptance-bypass denial, actor-bound request hashes, revoked-on-replay behavior, exact delivery/check evidence, recursively redacted fields, append-only history, and injected audit failures proving that package/acceptance, transition, receipt, and outbox writes roll back together. Delivery-head PASS evidence is the exact GitHub check/run identity attached to Draft PR #324; an earlier green head is not projected forward.

## Rollback and rollout state

The companion rollback contract is `docs/control/PM-01-RUNTIME-01-ROLLBACK-CONTRACT-v1.0.md`. The local rehearsal proves the pre-data rollback boundary while preserving canonical `platform.platform_users` and `audit.events`. After durable real data exists, destructive rollback is forbidden by default and requires a separately authorized forward correction/preservation process.

This package does not authorize merge, Supabase Remote or Production migration, `db push`, Preview/Production deployment, Secret or Environment Variable creation, Production settings, Auth/CAPTCHA/SMTP/DNS changes, real users, or real PM data. Those remain independent gates. CE010, private CE/PM credentials or bindings, and commit `1f010c4` remain external/unavailable and non-blocking.
