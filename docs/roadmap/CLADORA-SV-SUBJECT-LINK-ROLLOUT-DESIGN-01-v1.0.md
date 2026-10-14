# SV-SUBJECT-LINK-ROLLOUT-DESIGN-01

## Parallel design task

SERVICE prepared the application-connection design while Core independently
reviewed the corrected isolated HTTP candidate. During this documentation task,
#389 was accepted and merged. This remains a documentation task, not permission
to install a role, expose a route or enable the capability.

Product base: `c7c17f78fd854509b141bd488753716580881b9e`.
Accepted PR #389 head: `ae1c3cd194257447fae2de7142449bddc5c9f087`.
Candidate tree: `12fbe624e7cefcf805200c4def7ffdd718781ef5`.
Merge/main SHA: `df8124807a702f3b6fdcce3903e74aed7c713c67`.
Its files were not changed by this parallel task.

## Evidence and limitations

- Observed: #389's corrected follow-up delta changed only the HTTP handler and
  its two harnesses. Existing Core host, CE provider, AIRPROP guard and
  migrations were unchanged; #389 merged as
  `df8124807a702f3b6fdcce3903e74aed7c713c67`.
- Observed: exact-head CI run `38524725729` demonstrates real loopback HTTP,
  local Supabase Auth/MFA and disposable PostgreSQL, `18/18 PASS`, including
  poisoned role claim, real SSI `40001`, and lost COMMIT acknowledgement.
- Observed: product-base application source has no instantiated `pg.Pool` for
  this Core host. The SERVICE PostgreSQL harness constructs its own pool.
- Observed: subject-link table/client-function privileges were deliberately
  withheld in the accepted SERVICE migration. Existing Supabase SSR/admin
  clients are HTTP clients, not substitutes for the host's SQL connection.
- Unavailable: target-environment execution role, installed schema/history,
  secret binding and deployed end-to-end acceptance. Do not infer these from
  local test privileges or Vercel READY.
- PM oversight is not queried or written in this design task. Baseline/Page
  artifacts remain unchanged.

## SERVICE design deliverable

Create a documentation-only delivery on a separate branch from product main.
Reference the exact #389 candidate; do not copy its implementation commits or
modify its five files. Answer the following concrete questions.

### Server connection and identity

1. Propose the Next.js Node-runtime entry point and wiring to the existing
   `handleServiceSubjectLinkHttpV1`, server authentication function and Core
   host. Consume accepted contracts without another transaction engine or
   receipt store. The design may name a future route; this task adds none.
2. Specify a server-only connection factory, pool lifecycle/limits, timeout,
   TLS and failure behavior for the target hosting model. Reuse a compatible
   existing connection path if one is found. A Supabase publishable/admin API
   key is not a PostgreSQL password. Never place secrets in client variables,
   documents, receipts or logs.
3. Specify how the verified session reaches the same checked-out SQL connection
   across BEGIN, retry, rollback, COMMIT and uncertain acknowledgement. Reuse
   #389's request-scoped identity adapter and its role-claim cleanup, subject
   to Core acceptance. State whether a target pooler preserves every required
   transaction property; do not assume local direct-connection tests prove it.

### Execution role and database installation

4. Inventory the exact SQL objects reached by the host, authority resolver,
   CE audience provider and SERVICE mutation. For each, list required schema,
   table/column or function access, transaction/locking behavior, RLS behavior
   and the source file that establishes the requirement. Start from actual
   queries, not broad schema-wide grants.
5. Identify an existing suitable application execution role if one is known
   from authorized evidence. If no such role is observable, label it unknown
   and propose a least-privilege role model for review. Avoid use of the
   disposable harness's owner/superuser privileges as the rollout model.
   Explain the trusted server-only boundary for installing verified JWT claims
   and why untrusted SQL/API clients cannot impersonate another actor.
6. Record whether additional grants, function ownership or RLS policies would
   be necessary. Do not execute SQL or broaden `anon`, `authenticated` or
   `service_role`. Preserve the existing domain functions and Core ownership;
   any required change must be an explicit, separately reviewed proposal.
7. Describe how a later authorized operation would establish actual installed
   schema/history before apply. Current repository count is not Remote state.
   Do not use this task to run Remote inspection with unapproved credentials,
   migration repair, replay or db push.

### Public API, recovery and rollout

8. Specify the proposed path, strict request schema, trusted origin/session/AAL2
   handling and minimal public response using the existing handler. Preserve
   dedicated subject-link authority and independent Request/Communications
   read checks. No new audience policy or privacy disclosure is needed.
9. Preserve `202 READBACK_REQUIRED` for unknown commit and recovery using the
   same intent/idempotency key. Describe the current limitations, especially
   authority-revision changes: existing Core exact replay binds the authority
   revision. Do not silently relax those bindings to recover an old receipt
   or retry with a new key. A new recovery path, if required, is a separate
   Core-reviewed delta using canonical records and fresh authority.
10. Define disabled-by-default behavior, configuration failure behavior,
    bounded rollout/disable procedure and retained audit evidence. Turning
    off the caller must not delete committed links or rewrite history.

## Focused review and next authorization

SERVICE owns the connection/route design and operation proposal. Core reviews
only execution-role access, session/transaction binding, pooled connection
semantics and recovery. CE reviews changed audience consumption only; unchanged
accepted CE bytes do not need another full review. AIRPROP has no implementation
task unless a later protected addition requires an exact approved manifest entry.
Documents & Vault has no dependency in this package.

The design PR must state which findings are observed, reported or unavailable,
and separate proposed configuration/SQL from operations actually performed.
Validate document links/source references and the access inventory; no old
product suite needs a manual rerun for this documentation-only task.

The eventual implementation must pin #389's merge SHA
`df8124807a702f3b6fdcce3903e74aed7c713c67` or a newer reviewed main. This
documentation design did not block #389's merge.
Its own merge is serial under GLOBAL MAIN-WRITER; no concurrent main writers.

Any target-role installation/grant, Remote migration/history operation, secret
change, public-route deployment or activation requires its own concrete reviewed
operation and authorization. No such action is authorized or executed here.
Deployed execution-role acceptance, Remote database installation and Production
HTTP/AAL2 acceptance remain `NOT_RUN_NOT_PASS`.

## Completed documentation-only design

The classification in this section is binding:

- **Observed** means the behavior or object exists in the repository at the
  pinned SHA and is reached by a current query.
- **Proposed** means a later implementation or operational choice. Nothing in
  this PR installs or activates it.
- **Unavailable** means the repository and authorized local evidence do not
  establish the target-environment fact. It remains a rollout gate.

### Dependency identity and application boundary

**Observed.** The design consumes PR #389 at
`ae1c3cd194257447fae2de7142449bddc5c9f087`, tree
`12fbe624e7cefcf805200c4def7ffdd718781ef5`. The relevant implementation is
`src/lib/customer/service-request-subject-link-http-v1.ts`; the existing Core
host, authority resolver, Communications subject/audience providers and SERVICE
mutation composition remain their canonical owners. The candidate exports an
inactive handler but creates no application route or PostgreSQL pool.

**Proposed.** A later application-wiring PR may add exactly these server-side
entry points:

1. `POST /api/customer/v1/services/requests/[id]/subject-links`, implemented as
   a Next.js Node-runtime route at
   `src/app/api/customer/v1/services/requests/[id]/subject-links/route.ts`;
2. a `server-only` PostgreSQL pool factory owned by application infrastructure;
3. a call to the existing `handleServiceSubjectLinkHttpV1(request, id, {
   pool, authenticate: authenticateServiceSubjectLinkServerSessionV1 })`.

The route must export the Node runtime explicitly. It must not recreate the
command, authority evaluation, provider composition, transaction host, receipt
or audience policy. It passes the raw `Request`, canonical path ID and injected
server dependencies to the existing handler. No Edge runtime, REST-to-RPC
translation, Supabase Data API mutation or service-role client belongs in this
path.

**Observed.** #389 merged at
`df8124807a702f3b6fdcce3903e74aed7c713c67`; its accepted head and tree above
remain the reviewed functional dependency.

**Unavailable.** The target route owner and application infrastructure module
name are not accepted facts. The implementation must start from the merge SHA
or a newer reviewed main.

### Pool lifecycle and connection requirements

**Observed.** The handler authenticates through the existing Supabase server
client, checks an unexpired verified user and requires `currentLevel=aal2`.
`createServiceSubjectLinkRequestPoolV1` then:

1. checks out one `pg` client;
2. runs `RESET ROLE` and clears `request.jwt.claims`,
   `request.jwt.claim.sub`, `request.jwt.claim.aal` and
   `request.jwt.claim.role`;
3. lets the Core host issue `BEGIN ISOLATION LEVEL SERIALIZABLE`;
4. immediately binds the combined claims, actor, AAL and role claim with
   transaction-local `set_config(..., true)` calls;
5. keeps every authority, provider, mutation, idempotency, audit and outbox
   query on that checked-out connection;
6. clears identity after `COMMIT` or `ROLLBACK`; and
7. destroys a connection when a transaction remains open, rollback fails or
   COMMIT acknowledgement is uncertain.

The authority-revision pre-read is a separate serializable transaction through
the same adapter. Each Core `40001` retry obtains a freshly scrubbed client and
re-binds the same verified server identity. No pool-level connect listener may
capture request identity.

**Proposed.** The connection factory should be imported only from server code
and cache one module-scoped `pg.Pool` per warm Node isolate. It should not create
or end a pool per request. Initial review values are:

- a server-only connection URL whose login is the dedicated execution role;
- `application_name=cladora-service-subject-link`;
- TLS hostname and CA verification (`verify-full` semantics), with no
  `rejectUnauthorized=false` fallback;
- `max=2` per warm instance, `connectionTimeoutMillis=5000`,
  `idleTimeoutMillis=10000`, `maxLifetimeSeconds=300`, and
  `allowExitOnIdle=true`;
- the Core host's existing transaction-local lock timeout of 5 seconds and
  statement timeout of 10 seconds; and
- one bounded configuration error when the feature is enabled but the URL,
  CA, expected SQL role or connection budget is absent.

The deployment connection budget must be calculated before activation:
`maximum warm instances × pool max + operational reserve <= database limit`.
The pool factory should verify the expected `current_user` on connection and
fail closed on mismatch without logging the URL or role credential. Graceful
shutdown ends idle pool resources; request code never calls `pool.end()`.

**Proposed compatibility requirement.** Use a direct PostgreSQL endpoint or a
pooler mode that preserves one server session for the complete checked-out
client lifecycle. Transaction-mode multiplexing is not accepted for the #389
adapter: checkout scrub, post-transaction scrub and destruction after uncertain
COMMIT have not been proven to address the same server backend in that mode.

**Unavailable.** The target database endpoint, TLS CA, connection ceiling,
Vercel instance concurrency, pooler product/mode and its reset behavior are not
observable. Local direct-connection and local Supabase tests do not accept any
of those target properties. No connection secret exists or is changed by this
design.

### Exact execution-role inventory

The table below starts from current queries at the pinned candidate. `FOR
UPDATE` requires both row visibility and PostgreSQL update privilege even when
the statement only takes a row lock. `RETURNING` requires select privilege on
the returned column. RLS requirements are additional to object grants.

| Query surface | Minimum direct access required by the caller | Lock/RLS behavior | Repository source |
| --- | --- | --- | --- |
| Database and namespaces | `CONNECT` on the target database; `USAGE` on `auth`, `app_private`, `identity`, `platform`, `communications`, and `audit` | No schema-wide table or function grant | #389 handler; sources below |
| Session identity | ability to run `RESET ROLE`, `set_config` and `current_setting`; no membership in `authenticated` or `service_role` and no SQL `SET ROLE` | Four JWT settings are local only after `BEGIN`; cleanup is session-level | `service-request-subject-link-http-v1.ts:79-161` |
| Authority revision pre-read and provider read | `SELECT(singleton, revision)` on `app_private.canonical_authority_revision_v1` | `FOR SHARE`; RLS is enabled and no consumer policy is present | handler `:163-188`; `current-authority-postgres-provider-v1.ts:61-65`; migration `20261012190924_core_canonical_authority_revision_v1.sql` |
| Workspace host lock | `SELECT(id, tenant_id, archived_at, lifecycle_status)` plus PostgreSQL `UPDATE` privilege sufficient for `FOR UPDATE` on `platform.customer_workspaces` | Exact ID, active lifecycle, row lock; dedicated-role RLS policy is absent | `postgres-transaction-host-v1.ts:185-205` |
| Canonical authority context | `SELECT` on the referenced columns of `identity.context_grants`, `identity.memberships`, `platform.customer_workspaces` and `platform.module_definitions`; `EXECUTE` on `auth.uid()` and `app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)` | Same serializable snapshot and revision barrier; every enabled RLS table must admit only the required reads | `current-authority-postgres-provider-v1.ts:45-123`; host `:257-273` |
| Idempotency ledger | `SELECT(actor_id,request_hash,response_ref,expires_at)`, `INSERT(tenant_id,actor_id,key,request_hash,expires_at)`, `UPDATE(response_ref,status_code)` on `platform.idempotency_keys`; lock privilege for `FOR UPDATE` | Key is tenant/Workspace scoped by Core; RLS currently has an all policy only for `service_role` | host `:275-314`, `:341-344`, `:383-384`; migration `20260825000100_platform_tenants_settings_outbox.sql` |
| Communications subject provider | `EXECUTE` on `communications.resolve_private_message_subject_v1(uuid,uuid,uuid,uuid,bigint)` | SECURITY DEFINER, metadata-only, current actor/AAL/Workspace/version denial; all ordinary client roles are revoked | `communications-private-message-subject-provider-v1.ts:114-175`; migration `20261013120000_communications_private_message_subject_provider_v1.sql` |
| CE Request-audience provider | `EXECUTE` on `communications.resolve_private_message_request_audience_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)` | SECURITY DEFINER, read-only status result; all ordinary client roles are revoked | `communications-private-message-request-audience-provider-v1.ts:98-147`; migration `20261013150000_communications_private_message_request_audience_gate_v1.sql` |
| SERVICE mutation | `EXECUTE` on `app_private.insert_service_request_message_link_v1(uuid,uuid,uuid,uuid,bigint,uuid,bigint)` | SECURITY DEFINER; owns Request/link CAS and repeats authority/audience checks; all ordinary client roles are revoked | `service-request-subject-link-v1.ts:151-171`; migration `20261013170242_service_request_subject_link_v1.sql:47-132` |
| Audit ledger | `INSERT` on the seven columns used by Core, `SELECT(id)` for `RETURNING`, and the minimum identity-sequence privilege on `audit.events_id_seq` | RLS is enabled; no dedicated runtime insert policy exists | host `:350-359`; migration `20260825002000_migration_hub_audit_hardening.sql` |
| Outbox ledger | `INSERT` on `tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id` and `SELECT(id)` for `RETURNING` on `platform.outbox_events` | RLS currently has an all policy only for `service_role` | host `:360-367`; migration `20260825000100_platform_tenants_settings_outbox.sql` |

Built-in transaction control, advisory locks, `txid_current`, hashing and clock
functions need no domain-table grant. The execution role does not directly
query Communications, SERVICE, Portfolio, Maintenance or party tables because
the two provider functions and the SERVICE mutation are SECURITY DEFINER. It
must receive only EXECUTE on those three exact signatures; it must not receive
table access to their underlying domains.

**Observed.** `anon`, `authenticated` and `service_role` have all been revoked
from the two private provider functions and the SERVICE mutation. The authority
revision table is also revoked from those roles. Existing broad `service_role`
policies on Core ledger tables do not make it a suitable least-privilege host
login. The disposable harness runs with an owner-capable local role and is not
execution-role evidence.

**Proposed.** Use a dedicated server-only PostgreSQL login such as
`cladora_service_subject_link_runtime` with `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, no inherited broad role and no
client/API credential. A separately reviewed Core/database change must grant
the exact accesses above and add equally narrow RLS policies. Function owners
must be pinned to canonical non-login owners and keep `search_path=pg_catalog`.
The connection role must never be derived from the JWT `role` claim; that claim
is input to canonical policy evaluation only.

The current direct `FOR UPDATE` on `platform.customer_workspaces` creates a
least-privilege issue: PostgreSQL requires UPDATE privilege on that table even
though Core only locks the row. Core must review either the narrowest acceptable
column grant and RLS policy or a canonical Core-owned lock function. This design
does not choose or implement that database change.

**Unavailable.** No repository evidence identifies an installed target login
with these exact privileges. Installed function owners, actual RLS policies,
schema history and grants are also unavailable without an independently
authorized target inspection. These are activation gates, not assumptions.

### Target installation preflight

**Observed.** The repository chain required by this operation includes the Core
authority revision, Request version/context, Communications message version and
subject provider, CE Request-audience gate, and SERVICE subject-link migration:

- `20261012190924_core_canonical_authority_revision_v1.sql`;
- `20261013062342_service_request_subject_context_v1.sql`;
- `20261013120000_communications_private_message_subject_provider_v1.sql`;
- `20261013150000_communications_private_message_request_audience_gate_v1.sql`;
- `20261013170242_service_request_subject_link_v1.sql`.

Core ledger and Workspace authority migrations are earlier dependencies of the
same host; their presence in the repository is not proof of target installation.

**Proposed.** Before any grant or activation, a separately authorized read-only
target preflight must compare the complete applied migration history and hashes
with the reviewed repository, then inspect exact object existence, function
signatures, owners, SECURITY DEFINER/search-path properties, ACLs, RLS enablement
and role policies. The result must identify every mismatch before a concrete
installation/grant change is proposed. It must not run migration repair, replay,
`db push` or an ad-hoc object creation.

**Unavailable.** No Remote history or catalog was read in this task. Target
installation remains `NOT_RUN_NOT_PASS` even though the repository migrations
and disposable tests exist.

### Proposed API contract and bounded errors

**Observed.** The handler already enforces `POST`, same-origin mutation,
`application/json`, no query string, a 16 KiB body limit, strict collaboration
intent parsing, path/body Request identity equality, `reference_kind=message`,
`relation=conversation`, a verified unexpired server session and AAL2. It
derives actor and authority revision on the server. The body cannot inject
actor, authority, permission or provider evidence.

The successful response is limited to `outcome`, `receipt_id`, `request_id` and
`request_version`. Current bounded outcomes are:

| HTTP | Public code/outcome | Meaning |
| --- | --- | --- |
| 200 | `committed` or `exact_replay` | One canonical receipt; no private provider data |
| 202 | `pending / READBACK_REQUIRED` | COMMIT acknowledgement was uncertain |
| 400 | `INVALID_REQUEST` | Shape, path binding or Core command invalid |
| 401 | `AUTHENTICATION_REQUIRED` | Missing, invalid or expired verified session |
| 403 | `ORIGIN_DENIED`, `AAL2_REQUIRED`, or `SUBJECT_LINK_DENIED` | Bounded authentication/authority/provider denial |
| 405 | `METHOD_NOT_ALLOWED` | Non-POST method |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key with changed bound command |
| 503 | `AUTHORITY_UNAVAILABLE` or `TRANSACTION_FAILED` | Fail-closed dependency or transaction failure |

**Proposed.** The future route returns the handler response unchanged and adds
no SQL error, party, message, audience, role, claim, connection or secret detail.
If the disabled rollout gate is false, the route must return a uniform disabled
response before authentication, pool creation or database access. Core and
security review should choose whether that response is 404 or bounded 503; it
must be consistent across identities.

### Idempotency recovery and authority-revision boundary

**Observed.** Transaction and command IDs are deterministic from Workspace,
verified actor and idempotency key. The Core request hash binds the full command,
including authority revision. Exact replay rechecks current authority and then
requires the persisted actor, fingerprint, aggregate, provider, entitlement and
authority bindings to match before returning the old receipt.

For an uncommitted denial caused by authority revision drift, no idempotency,
mutation, audit or outbox row exists; the same intent/key can be retried after a
fresh revision read. For a committed transaction whose acknowledgement is lost,
the same intent/key returns the persisted receipt only while its complete Core
bindings still match.

**Proposed recovery procedure.** A client receiving 202 must preserve the exact
intent and idempotency key, use bounded backoff, and submit the same POST. It
must not create a new key, increment Request version locally or infer failure.
`exact_replay` completes recovery. A 409 stops automatic retry and requires
operator/Core review.

**Observed limitation.** If the global authority revision changes after COMMIT
but before readback, the rebuilt command contains the new revision while the
stored receipt retains the committed revision. Core therefore returns replay
conflict rather than weakening the old authority binding. Using a new key could
duplicate intent and is forbidden.

**Proposed future option.** If operations require recovery across an authority
revision change, Core must separately design a read-only canonical readback by
Workspace, actor, original key and fingerprint. It must apply fresh authority
without mutating the old receipt or re-running the domain effect. This rollout
design neither adds that path nor relaxes existing replay checks.

### Disabled rollout, stopping and acceptance gates

**Proposed.** Wiring remains disabled by default with a server-only boolean
gate. Missing or malformed gate configuration means disabled. Enabling it is a
separate authorized operation after all unavailable gates below are closed:

1. the already-merged #389 dependency is pinned at
   `df8124807a702f3b6fdcce3903e74aed7c713c67` or a newer reviewed main;
2. target schema history proves every required migration installed once;
3. the dedicated SQL role, exact grants, function owners and RLS policies pass
   a disposable test under that role rather than an owner role;
4. the endpoint/pooler proves same-client transaction semantics, TLS and
   connection cleanup;
5. target connection budget and secret binding are reviewed;
6. DB, HTTP, real-session AAL2, replay, authority drift, rollback, concurrency
   and lost-COMMIT-acknowledgement tests pass in an isolated deployment; and
7. logs and metrics expose only bounded codes, latency, pool saturation,
   retry/202 counts and opaque correlation IDs.

Configuration failure while enabled must fail closed before mutation; it must
never fall back to a Supabase publishable/admin client, `service_role`, owner
connection or a second transaction engine. Provider/authority failures retain
the existing bounded handler responses.

To stop the rollout, set the server-only gate false through a separately
authorized configuration change and redeploy, stop new calls, allow in-flight
transactions to reach their bounded outcome, and drain pools. Do not delete
links, idempotency receipts, audit or outbox history. Outstanding 202 cases
remain recoverable with the original intent/key under the authority constraints
above. Emergency credential revocation or database-side grant revocation is an
operations action and requires its own authorization and evidence.

**Unavailable / NOT_RUN_NOT_PASS.** Target-role SQL, Remote schema inspection,
grants, secrets, pooler verification, deployed HTTP/AAL2 behavior, Production
metrics, stop drill and runtime acceptance have not been executed. This PR
contains documentation only and grants no activation or acceptance.
