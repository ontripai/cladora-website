# SV-REQUEST-PROVIDER-V2-01 execution package

**State:** ready for isolated implementation under the user's continuation instruction

**Base:** `main@2bc394bc4da50cae25382e9f38597ada85ef71ed`; refresh to live main before branching

**Implementation owner:** SERVICE

**Limited contract/security reviewer:** Core/Platform

**Coordination and merge owner:** Documents & PM

## Concrete gap and deliverable

#375 provides a lockable canonical Request context and a pure mapping to a Core
subject reference. It does not implement `CoreTransactionProvidersV2` or emit
typed provider evidence. Deliver that missing, inactive Request validation
provider and prove its behavior through the real shared PostgreSQL TX host.
This package stops before routes, real SERVICE mutation persistence and consumer
activation. Its implementation is a genuine successor, not another contract-only
documentation package.

## Existing sources to reuse

- `src/lib/customer/service-request-subject-context-v1.ts`: strict six-field
  projection and canonical Core reference mapper.
- `supabase/migrations/20261013062342_service_request_subject_context_v1.sql`:
  existing Request version, immutable identity and private context/CAS routines.
- `app_private.service_request_authorize_v1`: delegates to the canonical
  `check_workspace_native_permission_v2`, using `services_orders`.
- `src/lib/core/postgres-transaction-host-v1.ts`: transaction, lock order,
  authority recheck, replay, canonical effects and retry ownership.
- `src/lib/core/transaction-provider-evidence-v1.ts`: canonical V2 subject and
  strict typed evidence; import its types/schemas directly.
- Merged Communications and Documents providers: examples of typed evidence
  and real host-level tests, not sources to copy into another authority engine.

Use the existing subject profile: `kind=service_request`, `relation=request_party`,
`id=request_id`, `version=request_version`, and `request_version=request_version`.
The Request ID must participate in the host's provider-source locks. The provider
binds the exact current Core receipt, Context, Workspace, actor, transaction,
attempt, source identity/version and evaluation instant. Require canonical
`services.orders.read` / `services_orders` for this own-Request read profile;
pin a documented purpose and reject mismatched command/receipt bindings.

## Source authorization and privacy

Request truth remains in `service_catalog.requests`. Resolve the exact Request
within the canonical Workspace/tenant, current requester/membership and current
beneficiary-party relationship. Recheck canonical permission/module and the
current membership-party/party state after relevant row-lock waits. No base-role,
first-Workspace, cached allow, participant-only or cross-tenant fallback is valid.
Use the actual canonical evaluator in integration tests, not a stub which returns
true. Keep caller-known references and bounded status in evidence; description,
party snapshots, unrelated identities and source payloads must not escape.

Accepted output is `core-transaction-provider-evidence.v1`, with `status_only`
disclosure and NULL source reference. Do not create SERVICE copies of Core types,
an authority projection/store, another ledger or an independent transaction.

## Expected denial versus database exceptions

The merged V1 context function raises `42501` for unavailable context and `40001`
for a stale Request version. A failed query aborts the real PostgreSQL transaction
and is recorded as failed by Core's scope. Catching that error in JavaScript and
returning typed evidence does not restore the transaction.

Keep the merged V1 bytes/signature and legacy behavior unchanged. Introduce an
additive, versioned status-returning resolver if necessary, using the same
canonical sources and authorization truth. Ordinary stale/unavailable/denied
cases must return a bounded denial result before durable effects. Do not use
synthetic `40001` for an expected version mismatch on the provider read path.
Real PostgreSQL serialization exceptions must propagate to Core for a fresh
transaction; do not swallow them or retry a callback independently. Unexpected
SQL errors must fail closed, not become accepted evidence.

Any new SQL belongs in a forward migration created with the repository-supported
Supabase CLI, after reading its help; no timestamp is reserved here. Preserve all
250 existing migration bytes. Keep new functions private and client execution
revoked; no grant, exposed API or Security Definer workaround is authorized.
If a privileged private function is necessary, document and review its existing
ownership pattern, exact actor/source checks and pinned search path with Core.

## Scope and parallel work

SERVICE may change its provider/strict schemas, focused tests, package/workflow
registration, delivery documentation and a necessary additive private resolver
migration. Put SERVICE-owned code with existing SERVICE sources; do not change
the Core TX host or Communications/Documents implementations to make a test pass.
Report a genuine Core gap as a separate bounded dependency.

Core reviews the profile and final delta; it does not write the SERVICE branch.
AIRPROP owns any exact additive-migration registry entry. SERVICE does not edit
the AIRPROP guard. Once final migration bytes are reviewed, AIRPROP prepares only
the required registry change and Documents & PM coordinates the merge order.
A guard failure during development is not a reason to stop implementation.

## Required focused proof

Use migrated disposable local PostgreSQL and the real Core host/provider:

1. Valid current own-Request authority/version yields strict typed evidence and
   the host's bounded successful test effect set; no runtime route is activated.
2. Missing permission/module, revoked/expired membership or party mapping,
   foreign Workspace/tenant, other actor and wrong Request version deny with
   zero persisted domain/idempotency/audit/outbox effects.
3. A Request version change while waiting on its row lock is observed correctly;
   expected stale denial leaves the transaction usable and writes nothing.
4. A real serialization abort reaches Core and retries with fresh authority;
   no prior allow or provider result is reused.
5. Exact replay returns the immutable committed receipt with no duplicate
   effects after Core's fresh authority recheck. Changed subject version or key
   payload conflicts; historical evidence is not fresh subject authorization.
6. Provider/schema failures fail closed, metadata is bounded, and new object
   ACLs expose no client execution. Preserve existing Request/context tests.

Use an existing bounded test mutator/fixture for host commits, not a new SERVICE
runtime persistence implementation or parallel canonical ledger. Assertions must
exercise real PostgreSQL failure/rollback behavior; mocks alone are insufficient.
Run targeted lint/type/schema/database-package checks and exact-head CI/Preview.
Repeat wider suites only for affected behavior, failures or an actual dependency
change. Do not repeatedly rerun unchanged workstream suites during refreshes.

## Exit and handoff

Deliver one Draft PR with exact base/head/tree, migration and provider hashes,
bounded diff, real test results, Core review outcome and named remaining gates.
No timestamp/check count guessed in advance is an acceptance criterion.
Documents & PM performs final review/merge under its standing authorization;
merge does not mean runtime activation. Private PM writes are outside this task.
Remote schema apply, grants, backfill, routing/consumer activation and real product
HTTP/AAL2 remain separate, unperformed operations.
