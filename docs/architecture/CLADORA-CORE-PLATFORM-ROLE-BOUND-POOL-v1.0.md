# Core Platform role-bound pool v1

Status: **inactive installation package**. This contract does not provide a
credential, create a production pool, wire an HTTP route, or activate CE Guide
commands.

## Capability

`core-platform-role-bound-pool.v1` is a server-only adapter. It accepts an
externally credentialed PostgreSQL pool whose physical connections authenticate
as `cladora_ce_guide_runtime`. It supports direct connections and session
pooling. Transaction pooling is rejected because it cannot prove that session
role and cleanup state remain attached to the same backend for the whole Core
transaction.

Before a client is handed to CE, the adapter clears session residue, verifies
the runtime identity, changes to the fixed executor role, verifies the resulting
identity, and checks the role-safety inventory. After `BEGIN`, it verifies the
identity again and holds the shared role-safety lease through commit or
rollback. The adapter repeats the identity and safety check before every product
query and before `COMMIT`. A connection with an open transaction, failed safety
check, or attempted commit is destroyed rather than reused. Successful reusable
connections are reset and verified as the runtime identity before release.

The adapter has no default instance. The caller must inject a capability whose
contract version is exactly `core-platform-role-bound-pool.v1`.

## Roles and membership

| Role | Contract |
| --- | --- |
| `cladora_ce_guide_runtime` | `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; owns no database object and has no direct product ACL. Its password remains unset by the migration and must be provisioned outside the repository. |
| `cladora_ce_guide_executor` | `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; owns no database, schema, relation, sequence, view, materialized view, foreign table, function, or procedure. |

The only membership touching either protected role is runtime as a member of
executor with PostgreSQL 17 options `ADMIN FALSE`, `INHERIT FALSE`, and
`SET TRUE`. The adapter uses the constant executor identifier; request data and
environment variables cannot select a role.

## Minimal database access

Runtime receives only membership. Executor receives schema `USAGE`, exact
column privileges, exact function execution, and explicit RLS policies for the
inactive CE Guide call graph.

| Area | ACL | RLS boundary |
| --- | --- | --- |
| Workspace and canonical authority | Read and row-lock support for the exact Workspace and revision rows | Active Workspace, current actor/Context, AAL2, module and permission |
| Authority inputs | Read the exact Context, membership, role, and module-definition columns | Current Context and membership for the bound actor and Workspace |
| CE Guide | Read Guide, steps and references; update only Guide status/version; row-lock support on child rows | `experience.guide.manage` in the bound Workspace |
| Documents selector | Read the exact document, version, permission, link, scan, building and unit columns; row-lock support only | `documents.vault.read`, bound Workspace and document |
| Core idempotency | Read/insert/update exact columns | Bound actor, Workspace-prefixed key and CE Guide permission |
| Audit | Insert the exact Core lifecycle event and read its generated ID | Bound actor, Guide aggregate and allowed publish/unpublish action |
| Outbox | Insert the exact Core lifecycle event and read its generated ID | Bound Workspace, Guide aggregate and allowed event type |

No `DELETE`, `TRUNCATE`, schema `CREATE`, wildcard function execution, or
product ACL is granted to runtime. No product grant is made to `PUBLIC`, `anon`,
`authenticated`, or `service_role`.

`auth.uid()` and `auth.jwt()` retain Supabase ownership and remain stable
security-invoker functions. Four pre-existing internal scope helpers are owned
by the canonical `cladora_rpc_owner`, which is `NOLOGIN`, and use the fixed
`pg_catalog` search path. The executor is neither that owner nor a member of its
role.

## Role-safety lease and mutation protocol

The transaction lease uses the shared side of one canonical transaction-level
advisory lock and revalidates role attributes, the single membership edge,
ownership across database/schema/relation/routine catalogs, protected function
owner/security/search-path state, and catalog visibility. Missing or uncertain
catalog state denies execution.

Every repository-owned migration that changes a protected role, its membership,
or protected function ownership must first call the exclusive mutation-lock
primitive in the same transaction. Operational roles cannot execute that
primitive and have no role, ownership, or catalog mutation privilege. The
shared lease is held until the product transaction ends, so conforming
mutations block. A state changed outside the protocol is detected by the checks
before the next query and before commit and causes connection destruction.

## Installation and activation order

1. Review and merge the inactive role/ACL/RLS migration and server-only adapter.
2. Run connected disposable PostgreSQL validation, including real two-connection
   mutation races, RLS denial, cleanup, and unknown-commit disposal.
3. Obtain separate authorization for Remote migration preflight and install.
4. Provision the runtime credential through the approved private runtime
   environment; do not store it in the repository.
5. Build and validate the production server-only direct/session pool adapter.
6. Wire the HTTP route only after HTTP/Auth/AAL2 and trusted-verifier acceptance.
7. Activate commands and editing only under a separate production acceptance.

Until those steps complete, `commands=null`, `can_edit=false`, Remote database
installation, production binder, route wiring, HTTP/AAL2 acceptance, and
activation all remain **NOT_RUN_NOT_PASS**.
