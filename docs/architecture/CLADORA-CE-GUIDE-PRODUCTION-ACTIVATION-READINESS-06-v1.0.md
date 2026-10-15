# CE Guide production activation readiness 06

Status: **HOLD — repository integration ready; production activation is not accepted**.

This document reconciles the merged inactive CE Guide lifecycle handler from
PR #408 with the merged Core role-bound pool from PR #409. It is a decision
record only. It does not install a migration, create a credential or pool,
wire a route, enable a command, or authorize production use.

## Evidence vocabulary

| State | Meaning |
| --- | --- |
| `OBSERVED` | Read directly from live repository or GitHub state during this review. |
| `REPORTED` | Recorded by an already merged delivery and not re-executed by this documentation-only package. |
| `NOT_RUN_NOT_PASS` | Requires Remote or production evidence that this review did not collect. It is not equivalent to failure and must not be treated as acceptance. |

## Live baseline and ancestry

The review used live `main` commit
`8a240999083d150861b6b45c9c8671768f4783d0` with tree
`7f029cdcd8359479bfd90d1cfeb7974bea13ac72`.

| Delivery | Accepted head | Merge commit | Live ancestry | Exact-head checks already recorded |
| --- | --- | --- | --- | --- |
| PR #408, inactive CE handler | `5935fc3a0c034c31d5441acd1ddb4da1c8564c6a` | `bb7193c354b3001f7e00619daa0b3008c6a93c0b` | `OBSERVED`: merge commit is an ancestor of live main | `REPORTED`: 17 GitHub checks and Vercel Preview succeeded |
| PR #409, Core role-bound pool | `e606cec197237bf63938116c36e75a6a4c003f82` | `2c35db7b0791d8370b6130c613ad806af3071020` | `OBSERVED`: merge commit is an ancestor of live main | `REPORTED`: 18 GitHub checks and Vercel Preview succeeded |

PR #409 intentionally replaced the standalone execution-role boundary in three
PR #408 artifacts with the canonical Core pool contract. Consequently, the
current integration identity is the PR #409 byte set. All 14 files changed by
PR #409 are byte-identical between its accepted head and live main; no later
commit changed that set.

### Final artifact identity

| Artifact on live main | SHA-256 | Relationship |
| --- | --- | --- |
| `src/lib/community/experience-guide-lifecycle-http-v1.ts` | `22c9816a557445bc19e133015f416598e702c90fb9b26a89cc8110bc69142481` | Exact PR #409 byte; supersedes PR #408 hash `3513efc67a584bda9b1cd11219b21bdac420cec4adb3a3fb562955a5285d4744` |
| `scripts/test-ce-guide-lifecycle-http-v1.mjs` | `926f1626e8effdeaf38881f02033c43616fdea257586c61fb71e66a15fef183e` | Exact PR #409 byte |
| `scripts/test-ce-guide-lifecycle-http-postgres-v1.mjs` | `1ccc6a09c28bbe00f0954c8fc0b9b109fab4130598d0ed354f03aed767b7c74e` | Exact PR #409 byte |
| `src/lib/core/platform-role-bound-pool-v1.ts` | `6a3bf83e82424d0e26dc13e101d0f2e15cf241c17682809e7531cffd3e19511e` | Exact PR #409 byte |
| `supabase/migrations/20261015100000_core_platform_role_bound_pool_v1.sql` | `ff944f72f3a5396c57afeeaec0406ec480f859d00ef8736b00c64f14d905e641` | Exact PR #409 byte |
| `scripts/test-core-platform-role-bound-pool-v1.mjs` | `c625cfa2cf46c319913ae36e462216d18a1a0aed4e1e30fb4104a0d373e404d6` | Exact PR #409 byte |
| `scripts/test-core-platform-role-bound-pool-postgres-v1.mjs` | `af81f346e97e1cc08db67f07f81225fe08a9791bbe39931c5798a5783775a590` | Exact PR #409 byte |
| `docs/architecture/CLADORA-CORE-PLATFORM-ROLE-BOUND-POOL-v1.0.md` | `a8b16c90a3c7757f69e764350ffc4bf3b006649f071b1d1146fb194d033e3cf5` | Exact PR #409 byte |

The live migration inventory contains 258 files. Repository presence proves
only that the role-bound migration belongs to the canonical history; it does
not prove that any Remote database has installed it.

## Canonical integration and absence of fallback

The CE handler imports `CorePlatformRoleBoundPoolV1`,
`corePlatformRoleBoundPoolContractV1`, `corePlatformCeGuideRuntimeRoleV1`, and
`corePlatformCeGuideExecutorRoleV1` directly from
`src/lib/core/platform-role-bound-pool-v1.ts`. Its dependency is typed as that
Core capability and is accepted only when its contract version is exactly
`core-platform-role-bound-pool.v1` and it exposes `connect()`.

The handler does not construct a pool, select a role, read a role name from a
request or environment variable, or fall back to an owner, `service_role`, a
connector identity, or `current_user`. A missing or malformed capability
returns bounded `GUIDE_RUNTIME_UNAVAILABLE`. Each checked-out client must prove
`current_user=cladora_ce_guide_executor` and
`session_user=cladora_ce_guide_runtime` before CE installs transaction-local
claims and invokes the existing Core PostgreSQL transaction host.

The Core factory `createCorePlatformRoleBoundPoolV1()` is the only repository
implementation of this contract. It accepts a private runtime pool, permits
only `direct` or `session_pooler`, binds the fixed executor, acquires the
canonical role-safety lease after `BEGIN`, repeats identity and safety checks,
scrubs connection state, and destroys uncertain connections. Repository search
finds no production call site for this factory and no route import for
`handleExperienceGuideLifecycleHttpV1`.

The existing customer Guide route is not this integration. Its POST path still
names `customer_api.command_ce_guide_v1`; the migration inventory does not
define that RPC. It must not be treated as a fallback or silently repointed.
The public Guide component still passes `commands={null}`, and the projection
still forces `can_edit: false`.

## Activation decision matrix

| Dependency | Repository or merged evidence | Current state | Required evidence before advancing |
| --- | --- | --- | --- |
| Remote migration presence | Canonical migration exists in the 258-file repository history. | Repository: `OBSERVED`; Remote database: `NOT_RUN_NOT_PASS` | Authorized Remote inventory must prove the exact migration and preceding history are installed once, without drift. |
| Privileged role-graph finalization | The migration defines input-free `app_private.finalize_ce_guide_role_membership_v1()`, restricted to `supabase_admin`, requiring a superuser and the canonical exclusive lock. | Contract: `OBSERVED`; Remote finalization: `NOT_RUN_NOT_PASS` | Prove the exact single runtime-to-executor edge, role attributes, ownership absence, protected function state, Auth ACL, and successful safety assertion after services finish owner-managed ACL normalization. |
| Private runtime credential | Migration leaves the runtime password unset; repository contains no credential. | Contract: `OBSERVED`; production credential: `NOT_RUN_NOT_PASS` | Provision and rotate a server-only secret through the approved private runtime channel. Never commit or expose it to a browser or preview log. |
| Direct/session pool configuration | Core contract accepts `direct` and `session_pooler` and rejects transaction pooling. Current Supabase guidance describes direct connections for long-lived servers, session pooler for persistent IPv4 clients, and transaction pooler for transient serverless traffic. | Allowed models: `OBSERVED`; selected production topology/capacity/TLS: `NOT_RUN_NOT_PASS` | Select and document one supported topology, network reachability, SSL, connection budget, timeout and shutdown behavior. A transaction-mode URL is incompatible with this binder. |
| Production binder construction | Canonical factory exists; no default instance or production call site exists. | Factory: `OBSERVED`; production construction: `NOT_RUN_NOT_PASS` | Build the server-only `pg` pool with the fixed runtime identity, construct the Core binder, and prove checkout, transaction lease, cleanup and uncertain-commit destruction in the target runtime. |
| Route import and wiring | CE handler exists but no route imports it. The legacy RPC route is a separate inactive boundary. | Absence: `OBSERVED`; production route: `NOT_RUN_NOT_PASS` | A separately reviewed package must inject the canonical binder into the handler and preserve origin, body, session and bounded-response checks. It must not reuse the missing RPC or add a fallback. |
| HTTP/Auth/TOTP/AAL2 acceptance | Merged packages report disposable Auth/TOTP/AAL2, Core-host, replay, `40001`, unknown-commit and zero-write tests. These suites were not repeated here. | Disposable evidence: `REPORTED`; Production HTTP/Auth/TOTP/AAL2: `NOT_RUN_NOT_PASS` | Run exact deployed-route tests with a real production-equivalent session, TOTP elevation, current authority, revocation, stale/replay, denial snapshots and acknowledgement-loss readback. |
| Command/editor activation | `commands={null}` and `can_edit=false` remain in live main. | Closed state: `OBSERVED`; activation: `NOT_RUN_NOT_PASS` | Enable only after every earlier checkpoint passes and a separate activation approval binds UI state to the accepted route and receipt behavior. |

The decision is **HOLD**. GitHub CI, Vercel Preview, or Vercel Production build
success cannot establish Remote migration installation, role finalization,
private credential readiness, database connectivity, or Production HTTP/AAL2
acceptance.

## Proposed installation order and checkpoints

1. **Freeze repository evidence.** Pin live main, the migration hash, Core
   binder hash, CE handler hash, and accepted migration order. Any byte drift
   requires a new review.
2. **Remote read-only preflight.** Under separate authorization, inventory
   migration history, Postgres version, role/ownership graph, Auth-owned ACL
   state, network mode and connection budget. Stop on missing or divergent
   prerequisites.
3. **Install canonical history.** Under separate migration authorization,
   apply the repository migration chain exactly once. Keep the runtime password
   unset and the route/editor closed.
4. **Finalize the role graph.** After Supabase services complete ACL
   normalization, an authorized superuser invokes only the input-free canonical
   finalizer. Verify the exact role graph and safety functions before leaving
   this checkpoint.
5. **Provision the private runtime identity.** Create or rotate the external
   credential without repository, client, CI-log or Preview exposure. The
   executor remains `NOLOGIN`.
6. **Choose and construct the production pool.** Use only an approved direct or
   session-pool connection and pass it to
   `createCorePlatformRoleBoundPoolV1()`. Verify SSL, capacity, checkout
   identity, lease acquisition, cleanup and connection destruction. Keep the
   handler unreachable.
7. **Run inactive binder acceptance.** Exercise current authority, exact
   version, publish/unpublish, Documents references, exact and changed replay,
   revocation, cross-Workspace denial, genuine `40001`, acknowledgement loss,
   privacy and zero-write denial without exposing a customer route.
8. **Wire the route under a separate review.** Import the existing handler,
   inject the accepted binder, and test real session/TOTP/AAL2 and bounded HTTP
   behavior. Do not activate the editor in this step.
9. **Activate commands/editor under separate approval.** Change
   `commands=null` and `can_edit=false` only after deployed route acceptance and
   a final rollback drill.

Each checkpoint is fail-closed. Evidence from a later checkpoint cannot waive
an earlier one.

## Rollback boundaries

| Boundary | Safe stop or rollback action |
| --- | --- |
| Before Remote installation | Stop with no Remote change. Repository and UI remain inactive. |
| Migration installed, finalizer incomplete | Do not provision a credential or construct a binder. Preserve migration history and use an approved forward corrective migration or database restore plan; do not edit or replay the installed migration. |
| Role graph finalized, route still absent | Revoke or leave unset the runtime credential and stop. Re-run the safety inventory after any approved role change. |
| Credential/pool provisioned, route absent | Rotate or revoke the credential, close/destroy pool connections, and remove the private binding. No customer command path exists. |
| Route wired, editor still closed | Roll back the route deployment or return bounded unavailable responses, destroy uncertain connections, and keep `commands=null`/`can_edit=false`. |
| Editor activated | First disable commands and editing, then roll back route/binder configuration as required. Preserve canonical receipts, audit, outbox and migration history; do not delete or rewrite ledgers. |

Unknown commit remains a readback/reconciliation boundary. It must destroy the
physical connection and use the existing exact receipt/idempotency semantics;
it is never made safe by repeating a mutation blindly.

## Future acceptance checkpoints

The activation owner must produce SHA-bound and environment-bound evidence for:

- exact Remote migration presence and final role-safety assertion;
- fixed runtime and executor identity with no ownership or unsafe membership;
- direct/session pool topology, SSL, capacity and cleanup;
- real Auth session, TOTP elevation and AAL2 freshness;
- current Workspace authority and authority revision;
- publish and unpublish with exact Guide version;
- valid and invalid Documents references without access-event or private-ID
  leakage into CE evidence;
- exact replay, changed-payload replay, changed state and historical receipt
  denial;
- revoked, stale and cross-Workspace denial with zero durable writes;
- genuine PostgreSQL `40001` retry in a new transaction;
- acknowledgement loss, exact receipt readback and unknown-commit disposal;
- route responses that remain bounded and private;
- explicit proof that Guide access grants no Message, SERVICE or Documents
  target access; and
- editor state remaining closed until the separately approved final step.

Remote migration queries or writes, privileged finalization, credential
provisioning, production pool construction, route wiring, Production HTTP/AAL2
tests and command/editor activation are all **NOT_RUN_NOT_PASS** in this package.
