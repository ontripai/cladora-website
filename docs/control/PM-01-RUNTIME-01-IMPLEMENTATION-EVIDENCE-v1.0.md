# PM01-RUNTIME-01 implementation evidence v1.0

**Owner:** Core/Platform; PM / CLADORA Documentation owns control and evidence records

**Dependency:** PM01-B, Draft PR #323

**Exact implementation base:** `450b99a6378c2ce0f9c77f880b5369b10e5975c9`

**Branch:** `feat/pm01-runtime-01-private-oversight`

**Migration:** `supabase/migrations/20261009094331_pm01_private_oversight_runtime_v1.sql`

**Delivery state:** implemented and validated locally; Draft review required; no Remote or Production installation

## Delivered boundary

The migration creates the private, non-Data-API `pm_private` schema, six enum domains, the sixteen tables authorized by the Runtime Authorization Gate, supporting constraints/indexes/triggers, recursively redacted audit/outbox/receipt behavior, and eight versioned private functions. Every table has enabled and forced RLS. The schema, tables, sequences, default privileges, and functions grant no access to `PUBLIC`, `anon`, `authenticated`, or `service_role`.

The server-only gateway source is bounded to the eight authorized HTTP contracts under `/api/platform/v1/internal-work`. It derives identity from authenticated claims, requires AAL2 for mutations, validates origin/content type/body size and strict DTOs, and maps database failures to non-enumerating responses. All checked-in handlers use `disabledPmAdapter`; `PM01_RUNTIME_ROUTES_ENABLED` is the constant `false`. Therefore requests return `404` before authentication or database access. No connection Secret, Environment Variable, public schema, or enabled route is introduced.

## Local isolated evidence

Validation used Supabase CLI `2.72.2` and a disposable local Docker database only. The official CLI release checksum and official Supabase image digests were verified during setup. No remote project reference, database credential, `db push`, Preview migration, or Production operation was used.

| Check | Result |
| --- | --- |
| Clean full migration-chain reset | PASS; 238 ordered migrations, including the PM01 migration |
| Full Repository pgTAP | PASS; 165 files, 5,233 assertions |
| PM01 pgTAP contract/RLS | PASS; 87 assertions |
| PM01 rollback rehearsal | PASS; 8 assertions, transactional pre-data schema removal and rollback |
| PM01 authorization/atomicity | PASS; 25 assertions |
| Real two-connection race | PASS; one registration, exact replay, one transition winner, stale loser |
| Gateway contract | PASS; disabled default, strict validation, AAL/origin/media checks and redacted errors |
| Database package fingerprint check | PASS; 238 migrations, 165 tests, 5,233 assertions |
| `pm_private` database lint | PASS; no schema errors |
| TypeScript typecheck | PASS |
| Repository ESLint | PASS with zero warnings |

The authorization suite covers unauthenticated callers, missing platform identity, missing platform eligibility, AAL1 denial, permission separation, expired/revoked/narrow assignments, cross-program non-enumeration, actor-bound request hashes, revoked-on-replay behavior, recursively redacted fields, append-only history, and an injected audit failure proving that package, receipt, and outbox writes roll back together.

## Rollback and rollout state

The companion rollback contract is `docs/control/PM-01-RUNTIME-01-ROLLBACK-CONTRACT-v1.0.md`. The local rehearsal proves the pre-data rollback boundary while preserving canonical `platform.platform_users` and `audit.events`. After durable real data exists, destructive rollback is forbidden by default and requires a separately authorized forward correction/preservation process.

This package does not authorize merge, Supabase Remote or Production migration, `db push`, Preview/Production deployment, Secret or Environment Variable creation, Production settings, Auth/CAPTCHA/SMTP/DNS changes, real users, or real PM data. Those remain independent gates. CE010, private CE/PM credentials or bindings, and commit `1f010c4` remain external/unavailable and non-blocking.
