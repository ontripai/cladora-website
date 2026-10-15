# SV-SUBJECT-LINK-ROLE-BOUND-POOL-DISCOVERY-02

Status: **`core_extension_required`**. This is a documentation-only discovery
and execution package. It changes no handler, Core code, migration, route,
guard, credential, grant, Remote database, or runtime state.

## Reviewed baseline

The review used live `main` at
`8a240999083d150861b6b45c9c8671768f4783d0` (tree
`7f029cdcd8359479bfd90d1cfeb7974bea13ac72`) and these merged dependencies:

| Dependency | Accepted head | Merge SHA |
| --- | --- | --- |
| SERVICE HTTP PR #389 | `ae1c3cd194257447fae2de7142449bddc5c9f087` | `df8124807a702f3b6fdcce3903e74aed7c713c67` |
| SERVICE rollout design PR #390 | `8b8dc35a8bf4e56898b072c7dc4f5dfffad30829` | `17236729306e7d3d92d039d4ee6c83df73c92087` |
| Core role-bound pool PR #409 | `e606cec197237bf63938116c36e75a6a4c003f82` | `2c35db7b0791d8370b6130c613ad806af3071020` |

The reviewed file hashes on that main are:

| File | SHA-256 |
| --- | --- |
| `src/lib/core/platform-role-bound-pool-v1.ts` | `6a3bf83e82424d0e26dc13e101d0f2e15cf241c17682809e7531cffd3e19511e` |
| `src/lib/customer/service-request-subject-link-http-v1.ts` | `05964f953bae41bdac2a6faf047d87a578be72063cc48a77c55683b0b80e5f10` |
| `src/lib/customer/service-request-subject-link-v1.ts` | `d4833364bd1bcb724314f075dde7470bc8164f1f44aa56cb8698215ee80b4784` |
| `src/lib/core/current-authority-postgres-provider-v1.ts` | `0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a` |
| `src/lib/core/postgres-transaction-host-v1.ts` | `eb89d03320549a721a54df10fa747f8977d9f42f6dfaa2e85ae89e1265c37d7c` |
| `supabase/migrations/20261015100000_core_platform_role_bound_pool_v1.sql` | `ff944f72f3a5396c57afeeaec0406ec480f859d00ef8736b00c64f14d905e641` |

Repository presence and merged tests are evidence of an inactive capability,
not proof of Remote installation, target-role finalization, credentials,
runtime wiring, or SERVICE acceptance.

## Compatibility decision

`core-platform-role-bound-pool.v1` is CE Guide-specific despite its Core-owned
module name. SERVICE cannot consume it as its execution capability.

The TypeScript factory accepts only `runtime_pool` and `connection_model`, while
all profile identity is compiled into the module:

- runtime role: `cladora_ce_guide_runtime`;
- executor role: `cladora_ce_guide_executor`;
- checkout safety function: `app_private.assert_ce_guide_role_safety_v1()`;
- transaction lease: `app_private.acquire_ce_guide_role_safety_lease_v1()`.

The migration is equally fixed. Its ACLs, policies and scope helpers authorize
only CE Guide and Documents operations. Its ledger policies accept
`experience_guide`, `core.experience.guide.publish` and
`core.experience.guide.unpublish`; its authority helper accepts only
`experience.guide.manage/experience_guides` or
`documents.vault.read/documents`. It grants none of the three private function
signatures required by SERVICE subject-link.

Passing this pool to the current SERVICE handler would also fail at checkout.
`createServiceSubjectLinkRequestPoolV1` executes `RESET ROLE`, which would turn
a correctly bound CE executor client back into its runtime session role. That
runtime role intentionally has no product ACL. The SERVICE wrapper also binds
only four JWT GUCs and does not bind the Workspace and Context GUCs required by
the Core v1 RLS profile.

Using the CE roles for SERVICE would broaden the CE profile, mix unrelated
ledger predicates and violate its exact role-safety inventory. Using
`service_role`, a migration owner, `cladora_rpc_owner`, or a connection owner
would bypass the intended boundary. None is an acceptable fallback.

## Current cleanup comparison

| Boundary | SERVICE HTTP #389 | Core pool #409 | Result |
| --- | --- | --- | --- |
| Physical login | Generic injected `Pool` | Must be `cladora_ce_guide_runtime` | SERVICE has no accepted role-bound login |
| Executor selection | `RESET ROLE`; no fixed executor | Core sets fixed CE executor and validates both identities | Direct composition is incompatible |
| Checkout cleanup | Clears four JWT GUCs and resets role | Clears six JWT/Context/Workspace GUCs, `RESET ALL`, `RESET ROLE`, then validates runtime | Core owns role/session cleanup |
| Transaction identity | Binds verified actor/AAL/role after `BEGIN` | CE consumer binds six transaction-local GUCs after Core lease begins | SERVICE lacks Context/Workspace binding |
| Safety lease | None | Fixed CE catalog invariant before checkout and shared lease after `BEGIN` | SERVICE profile is missing |
| Query/commit checks | No role/catalog recheck | Executor and safety rechecked before each query and commit | Must be inherited from Core |
| Release | Destroys on error/open transaction | Destroys on error, poison, open transaction, or any commit attempt; otherwise resets and verifies | Core behavior is stronger and canonical |
| Unknown COMMIT | Core host passes `release(true)` after commit attempt | Binder also records commit attempt and destroys the physical connection | Future SERVICE adapter must preserve both signals |
| Pool mode | Not encoded by type | `direct` or `session_pooler`; transaction pooling rejected | Future SERVICE profile must preserve this type boundary |

SERVICE must not copy the role checks, safety lease, membership validation or
connection-disposal implementation. Those belong to the Core capability.

## Required Core dependency

Owner: **Core/Platform**

Dependency ID: **CORE-PLATFORM-ROLE-BOUND-POOL-SERVICE-PROFILE-02**

Core must extend the existing capability with a sealed SERVICE profile. A
suitable contract is a new version such as
`core-platform-role-bound-pool.v2`, or an additive fixed-profile factory whose
output is branded `service_subject_link`. The exact version is Core-owned, but
it must satisfy all requirements below.

1. Register the SERVICE profile in Core code. Role names and safety function
   identities are compile-time constants selected by the Core export, never
   request, environment, credential, or consumer input.
2. Reuse the existing cleanup, runtime-to-executor transition, per-query
   identity checks, shared role-safety lease, exclusive catalog-mutation lock,
   poison handling and unknown-COMMIT disposal. Do not create another binder.
3. Create a distinct SERVICE runtime/executor pair. Proposed identifiers for
   review are `cladora_service_subject_link_runtime` and
   `cladora_service_subject_link_executor`; the CE roles are not members and
   receive no SERVICE ACL or policy.
4. Return a profile-branded pool so SERVICE can reject a CE, Documents or
   unprofiled capability before database access. A generic structural
   `Pick<Pool,'connect'>` is not enough for this boundary.
5. Extend the protected catalog inventory and finalizer to the SERVICE pair and
   exact SERVICE functions. Use the existing
   `acquire_core_platform_role_safety_mutation_lock_v1()` protocol so catalog
   changes cannot race either profile.
6. Keep credentials and Production pool construction outside the repository
   package. Installation and activation remain separate operations.

The extension must not generalize into caller-supplied role names, SQL
identifiers, ACL lists or policy fragments. A closed Core registry of reviewed
profiles preserves the v1 fail-closed model.

## Minimum SERVICE execution inventory

The inventory below is derived from the current SERVICE handler, Core host,
canonical authority provider and SERVICE provider composition. It is the upper
bound for the next Core profile package, not authorization to install it.

### Roles and membership graph

| Object | Required invariant |
| --- | --- |
| SERVICE runtime | `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; no product ACL; no object ownership; password remains unset in migration |
| SERVICE executor | `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`; exact ACL/RLS only; owns nothing |
| Membership | Exactly executor granted to runtime with `ADMIN FALSE`, `INHERIT FALSE`, `SET TRUE` |
| Other edges | No direct or transitive edge to CE roles, `service_role`, `authenticated`, owner roles, superuser, `BYPASSRLS`, or another LOGIN role |
| Runtime handoff | `session_user=SERVICE runtime`, `current_user=SERVICE executor`; fixed by Core and rechecked before every query/commit |

### Schema and table/column ACL

Executor needs `USAGE`, never `CREATE`, on `auth`, `app_private`, `identity`,
`platform`, `communications`, and `audit`. Runtime gets no product schema or
object privilege beyond the exact executor membership.

| Object | Minimum executor ACL | Reason |
| --- | --- | --- |
| `platform.customer_workspaces` | `SELECT(id,tenant_id,archived_at,lifecycle_status)` and one non-semantic column UPDATE privilege, conventionally `UPDATE(id)`, while the current host uses `FOR UPDATE` | Core active-Workspace lock and tenant binding |
| `app_private.canonical_authority_revision_v1` | `SELECT(singleton,revision)` | Handler pre-read and authority provider use `FOR SHARE`; no UPDATE is needed |
| `identity.context_grants` | `SELECT(id,tenant_id,membership_id,starts_at,ends_at)` | Current Context and time bounds |
| `identity.memberships` | `SELECT(id,tenant_id,user_id,status,starts_at,ends_at)` | Actor, tenant and revocation binding |
| `platform.module_definitions` | `SELECT(id,code,entitlement_key,is_active,lifecycle_status,valid_from,valid_to)` | Canonical `services_orders` entitlement binding |
| `platform.idempotency_keys` | `SELECT(tenant_id,actor_id,key,request_hash,response_ref,expires_at)`, `INSERT(tenant_id,actor_id,key,request_hash,expires_at)`, `UPDATE(response_ref,status_code)` | Existing Core ledger and necessary `FOR UPDATE` |
| `audit.events` | `INSERT(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot)`, `SELECT(id)` and `USAGE,SELECT` on `audit.events_id_seq` | Core receipt evidence |
| `platform.outbox_events` | `INSERT(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)`, `SELECT(id)` | Core outbox receipt evidence |

No executor table privilege is needed on Communications private-message tables,
`service_catalog.requests`, `service_catalog.request_subject_links`, offerings,
parties, memberships used inside the audience gate, or any CE table. Those
sources stay behind canonical `SECURITY DEFINER` functions. The profile must not
add a direct domain mutation path.

The current Core host still uses `FOR UPDATE` on the Workspace row, so the
minimal current profile needs the narrow lock-only UPDATE privilege and a policy
whose `WITH CHECK` is false. The `FOR SHARE` reduction proposed in #390 remains
a separate Core host change. It must not be assumed by this package. The
authority revision already uses `FOR SHARE` and must not receive an UPDATE grant.

### Exact function EXECUTE

Executor requires only these callable signatures:

- `auth.uid()`;
- `auth.jwt()` because the Communications subject provider enforces AAL2;
- `app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)`;
- `communications.resolve_private_message_subject_v1(uuid,uuid,uuid,uuid,bigint)`;
- `communications.resolve_private_message_request_audience_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)`;
- `app_private.insert_service_request_message_link_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)`;
- the Core-owned SERVICE profile safety assertion and shared-lease signatures.

No wildcard function grant is allowed. Executor does not need direct EXECUTE on
`app_private.service_request_subject_context_v1` or
`app_private.lock_service_request_version_v1`; they are nested implementation
dependencies of the canonical definer functions.

### RLS policy inventory

Policies must target only the SERVICE executor and fail closed when any bound
GUC or canonical row is absent.

| Object/operation | Required predicate |
| --- | --- |
| Workspace SELECT/lock | Exact transaction-local Workspace; active/not archived; actor/Context current; AAL2; `services.orders.subject_link/services_orders` allowed |
| Authority revision SELECT | Singleton plus existence of the same authorized active SERVICE Workspace |
| Context SELECT | Exact bound Context, same tenant and current bound actor membership |
| Membership SELECT | Membership belonging to the exact Context and bound actor, current and active |
| Module definition SELECT | Only active/current `services_orders` row under the same authorized SERVICE scope |
| Idempotency SELECT/INSERT/UPDATE | Bound actor and tenant; key prefix `core-tx.v1:<workspace>:`; SERVICE permission; no other Workspace/key |
| Audit INSERT/receipt ID read | Actor and tenant bound; action exactly `core.service.request.subject_link`; entity type `service_request`; aggregate is the command Request |
| Outbox INSERT/receipt ID read | Tenant/Workspace bound; aggregate type `service_request`; event exactly `core.service.request.subject_link.v1`; aggregate is the command Request |

`authenticated` and `service_role` policies do not satisfy this inventory and
must not be inherited. Policy helpers must be Core-owned, fixed-purpose and
covered by the same ownership/safety lease. They must not reproduce the CE
audience or SERVICE mutation policy.

### Object ownership prohibitions

Neither SERVICE role may own a database, schema, table, sequence, view,
materialized view, foreign table, function or procedure. Neither may reach such
an owner through membership or `SET ROLE`.

The three canonical provider/mutation functions currently inherit their
migration executor as owner. Before an execution grant, their exact installed
owners must be normalized to accepted canonical `NOLOGIN` owners, with
`search_path=pg_catalog`, no schema CREATE and only the underlying/nested access
each function needs. `auth.uid()` and `auth.jwt()` retain their Supabase Auth
owner and security-invoker behavior. The SERVICE executor receives only exact
EXECUTE.

The safety inventory must reject:

- a LOGIN, SUPERUSER, `BYPASSRLS`, `CREATEROLE`, `CREATEDB` or replication
  attribute on either role;
- any extra membership edge, including an edge to a CE role;
- ownership of any inventory object;
- changed owner, security mode, volatility or search path for protected
  functions;
- schema CREATE, wildcard table/routine grants or unexpected catalog visibility;
- a missing or extra ACL/RLS policy.

### Identity, AAL2 and pool lifecycle

The verified Supabase server session remains the only source of actor and AAL.
The public request cannot supply either value. SERVICE continues to require an
unexpired session and `aal2` before database work.

After Core returns a profile-bound client and the Core host issues `BEGIN`, the
request adapter must transaction-locally bind all six values on that same
backend:

- `request.jwt.claims` with verified `sub`, `role=authenticated`, and `aal=aal2`;
- `request.jwt.claim.sub`;
- `request.jwt.claim.aal`;
- `request.jwt.claim.role`;
- `request.cladora.workspace_id` from the parsed strict intent; and
- `request.cladora.context_id` from the parsed strict intent.

SERVICE must remove its checkout `RESET ROLE`; Core alone owns role selection
and role cleanup. The SERVICE adapter may bind and clear request identity, but
must not implement a safety lease, membership check, role transition or fallback
pool. Core must clear all six GUCs, run `RESET ALL`/`RESET ROLE`, verify the
runtime identity before reuse, and reject transaction pooling.

An error, open transaction, failed identity/safety check, poisoned query,
rollback failure, or any COMMIT attempt must destroy the physical connection.
Unknown COMMIT remains `202 READBACK_REQUIRED`; neither consumer nor pool may
re-execute with a new key or infer rollback.

## Next delivery sequence

### Package A — Core profile extension

Owner: Core/Platform. Deliver the fixed SERVICE profile, role/ACL/RLS migration,
protected ownership inventory, finalizer extension, shared-lease integration and
disposable PostgreSQL tests. Do not add credentials, routes or activation.

Acceptance output must include an exact Core PR SHA, tree, migration hash,
implementation hash, catalog fingerprint and evidence that the CE profile bytes
and behavior remain unchanged.

### Package B — SERVICE consumer adoption

Starts only after Package A is merged and independently accepted. On current
main, update the existing handler and its focused harnesses to require the
SERVICE-branded Core pool, remove consumer-owned SQL-role cleanup, bind the six
transaction-local identity values and retain the existing Core host/provider
composition. No route, migration, credential or activation belongs in this
package.

The SERVICE adoption must remain inactive and fail before SQL if the profile is
missing or wrong. It may not accept a CE pool structurally.

### Package C — installation and isolated runtime evidence

Requires separate authorization. Provision the runtime credential, install and
finalize the exact role graph in an isolated target, then run the real HTTP,
PostgreSQL and pool tests. Production routing, Remote grants and activation are
later independent operations.

## Test matrix for Packages A and B

| ID | Layer | Case | Required result |
| --- | --- | --- | --- |
| RB-SV-01 | Static | SERVICE profile export uses fixed identifiers and shared Core binder | PASS; no caller-supplied role/function identifier |
| RB-SV-02 | Static | CE pool passed to SERVICE dependency | Rejected before DB query |
| RB-SV-03 | Static | `service_role`, owner pool or generic `Pool` passed | Rejected; no fallback |
| RB-SV-04 | Static | SERVICE handler imports CE role constants or safety RPC names | Rejected |
| RB-SV-05 | Catalog | Runtime/executor attributes | Exact flags above |
| RB-SV-06 | Catalog | Membership graph | Exactly runtime → executor, SET-only; no extra/transitive edge |
| RB-SV-07 | Catalog | Ownership traversal | Neither role owns or reaches any owner/powerful role |
| RB-SV-08 | Catalog | ACL manifest | Exact columns/functions only; no wildcard/DELETE/TRUNCATE/CREATE |
| RB-SV-09 | Catalog | RLS manifest | Exact SERVICE policies only; unexpected/missing policy fails fingerprint |
| RB-SV-10 | Catalog race | Role, membership, owner, function or ACL mutation during lease | Exclusive mutation waits or next check destroys connection |
| RB-SV-11 | Identity | Valid verified actor, Context, Workspace and AAL2 | Six GUCs bound locally; authority sees same actor |
| RB-SV-12 | Identity | Missing actor/Context/Workspace, AAL1, expired session | Bounded denial; zero domain/ledger writes |
| RB-SV-13 | Pool | Poison all six GUCs and SQL role, then reuse | No actor/AAL/role/Context/Workspace/SQL-role leak |
| RB-SV-14 | Pool | Direct and proven session pool | Stable physical backend and fixed identities for full checkout |
| RB-SV-15 | Pool | Transaction-pooler declaration | Rejected before checkout |
| RB-SV-16 | Workspace | Active exact Workspace `FOR UPDATE` | Lock succeeds; unrelated Workspace invisible |
| RB-SV-17 | Workspace | Archived/inactive/cross-Workspace | Denied; zero writes |
| RB-SV-18 | Authority | Current `services.orders.subject_link` permission/module | Allowed under revision barrier |
| RB-SV-19 | Authority | Only `services.orders.read`/request permission | Denied; zero writes |
| RB-SV-20 | Authority | Stale revision or revoked Context/membership after wait | Fresh retry or bounded denial; zero duplicate effect |
| RB-SV-21 | Provider | Exact message and Request versions, canonical CE audience | Accepted status-only evidence |
| RB-SV-22 | Provider | Stale message/Request, foreign Workspace, wrong audience | Denied; no disclosure and zero writes |
| RB-SV-23 | Domain ACL | Executor directly reads/writes message, Request or link tables | `42501`/RLS denial |
| RB-SV-24 | Commit | One valid subject link | Request/link, idempotency, audit and outbox commit atomically |
| RB-SV-25 | Rollback | Provider/mutation/ledger failure | All four effect sets unchanged |
| RB-SV-26 | Replay | Same command/key | Exact replay; no second link or version increment |
| RB-SV-27 | Replay | Changed command under same key | Conflict; zero additional writes |
| RB-SV-28 | Concurrency | Two commands from same Request version | Exactly one commit; loser stale/conflict; one version increment |
| RB-SV-29 | Unknown commit | COMMIT succeeds but acknowledgement is lost | Physical connection destroyed; 202; same key required for recovery |
| RB-SV-30 | Retry | Real PostgreSQL `40001` before commit | Fresh bound client/transaction/authority; bounded attempts |
| RB-SV-31 | Regression | Existing Core CE role-bound suites | Unchanged and PASS |
| RB-SV-32 | Regression | Focused SERVICE HTTP/Core-host PostgreSQL suites | PASS on exact head |
| RB-SV-33 | Repository | lint, typecheck, affected database manifest, Application Foundation | PASS |
| RB-SV-34 | Boundary | Route/import/credential/Remote grant/activation scan | None added |

The #409 catalog and pool tests can be reused for shared binder mechanics only.
They do not prove the SERVICE ACL/RLS profile. The #389 HTTP tests can be reused
for unchanged parser, authentication, provider and Core-host behavior only.
Packages A and B require the new cross-profile rejection, exact catalog, real
role-bound PostgreSQL and six-GUC residue cases above.

## Stop conditions

Stop Package A or B without a consumer PR if Core exposes only the CE role pair,
permits dynamic caller-selected roles, cannot protect the SERVICE ownership
inventory under the shared lease, or requires `service_role`/owner fallback.
Stop before activation if Remote migration history, role finalization, credential
binding, direct/session pool semantics or isolated DB/API/concurrency evidence is
unavailable.

Result: **`core_extension_required`**. Current SERVICE HTTP remains inactive and
unchanged.
