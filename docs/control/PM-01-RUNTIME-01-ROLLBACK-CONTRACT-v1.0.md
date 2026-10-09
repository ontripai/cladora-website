# PM01-RUNTIME-01 rollback contract v1.0

**Scope:** local, isolated validation of `pm01_private_oversight_runtime_v1`

**Migration:** `supabase/migrations/20261009094331_pm01_private_oversight_runtime_v1.sql`

**Runtime default:** disabled; the checked-in HTTP handlers use `disabledPmAdapter` and return `404` before authentication or database access.

This contract does not authorize a Remote or Production migration, `db push`, Preview or Production configuration, deployment, merge, credential creation, or real PM data.

## Preconditions

Rollback rehearsal is permitted only against a disposable local database created from the exact branch migration chain. The target hostname must be `127.0.0.1`, `localhost`, or the local Supabase Docker network. Tests use synthetic UUIDs and synthetic users inside transactions or remove them before completion.

Before rollback, record the source commit, ordered migration list, migration SHA-256, pgTAP SHA-256, object/ACL catalog, migration count, test-file count, and assertion count. Verify that no real PM record exists. If that cannot be proven, destructive rollback must stop.

## Pre-data rollback sequence

1. Keep every HTTP route disabled and stop all synthetic writers.
2. Revoke any isolated gateway execution grant. The versioned migration grants none to `PUBLIC`, `anon`, `authenticated`, or `service_role`.
3. Verify there is no in-flight command transaction. Quarantine or drain only synthetic unpublished `pm_private.outbox_events` and retain their test evidence.
4. Verify zero retained non-synthetic rows in all sixteen `pm_private` tables and no unexplained `PM_%` audit event.
5. In a separately reviewed local rollback transaction, remove private functions, append-only triggers, tables in reverse foreign-key order, enum types, and finally `pm_private`.
6. Re-run the pre-migration catalog and ACL snapshot. Existing `platform`, `audit`, customer schemas, roles, grants, functions, and rows must be unchanged; there must be no orphan PM audit, receipt, or outbox state.
7. Reapply the full migration chain and rerun pgTAP, gateway, concurrency, lint, typecheck, and database-package fingerprint checks.

The rollback rehearsal SQL is test-only and is not a deployable down migration. It must not be placed in the forward migration directory or run against a remote database.

## Post-data response

After any durable real PM record exists, destructive down migration is forbidden by default. Freeze mutations, keep routes disabled, revoke the approved gateway role, preserve and export auditable records, and prepare an authorized forward corrective migration. Deletion, history rewriting, remote restoration, or Production repair requires separate explicit authorization.

## Failure and stop conditions

Stop rollout and preserve the isolated database for diagnosis if any of these occurs: privilege drift; an exposed Data API schema; an unredacted secret-like value; cross-program visibility; replay mismatch; more than one concurrency winner; partial audit/outbox/receipt persistence; orphan PM state after rollback; or any change to an existing platform/customer object or caller contract.

CE010, private credentials/bindings, and commit `1f010c4` remain external/unavailable and non-blocking. This rollback contract defines no Secret, Environment Variable, hostname allowlist addition, private file, or package/bundle source.
