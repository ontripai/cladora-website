# Core / Guide without document — independent R1

Source status: SOURCE_READY_FOR_REVIEW. Native activation/install: NOT_RUN_NOT_PASS.
Core Parent:4d15a37797fc9f0d5ef49565606e400e94f88d27.
CE input:6259b70268a851113c8f981e2d346da5428e343f, parent bfadc5042cb00841dd605862a2a72ddc0dbafb87,
tree a62426be5e8e67181378a6fc1bfea23699c80215. Source fetched from codex/ce-guide-native-01.
Official main:6cecfa15b00f445be68817e756d766fb0e6fe026; its entire tree equals
bfadc504 (ff8a0aeda835cc9e9dcc2a19cae74ab73ce1d5b1). No parent/history rewrite.

## Executable Core composition

Module: src/lib/core/guide-request-binding-v1.ts.
ABI: core-guide-request-binding.v1. Server-only, one original Request per instance.

```ts
const {handlers} = createCoreGuideRequestHandlersV1({
  request, runtime_pool: platformGuideRuntimePool, target: observedOwnedTarget,
  connection_model: 'direct', // or an independently admitted session_pooler
});
return handlers.POST(request); // handlers.GET(request) for current authorized read
```

This is the real CE handler factory, not a rewritten Guide engine. It dispatches
create/edit/publish/cancel to CE6259's actual provider and official existing Core
C03 host. Stable command/key/body/fingerprint and expected versions remain CE's.
Returned dependencies can also be consumed by existing CE lifecycle entrypoints:
`createCoreGuideRequestBindingV1(options).dependencies` contains required
role_bound_pool and authenticate (neither is a SERVICE port or injected callback).
No process-global registry, route activation, env selector or default instance is
added. CE owns route consumption; default inactive dependencies stay unchanged.

Exact domain profile:
- permission experience.guide.manage; read uses experience.guide.read;
- module experience_guides;
- purpose experience.guide.command;
- session_user cladora_ce_guide_runtime, current_user cladora_ce_guide_executor.

Pool comes from Platform's privately provisioned physical runtime-role Pool,
not authenticator/postgres/owner/service_role. The binder verifies loopback owned
selectors, time budgets, real PG17/database/OID/backend marker and ordinary runtime
attributes before fixed-role selection. Existing CorePlatformRoleBoundPoolV1
then checks its exact role graph/ownership safety on checkout and the existing
shared role-safety lease throughout the transaction. No role/ACL is created or
assumed. Missing helper/privilege/catalog evidence fails closed.

Authentication is the actual CE6259 official SSR function (getUser/getSession/
getClaims/MFA). It must return issuer session_id + expiry, verified actor and AAL2.
No caller actor, user_metadata, injected authenticator, manufactured SID or
SERVICE permission can supply this. The original Request and Auth target are
pinned; no cache of an allow. Invalid reauthentication removes capability; actor
or SID drift fails; a late auth cannot restore a newer denied capability. Abort
prevents subsequent work; rollback cleanup remains possible. The DB's canonical
session/currentness checks still own validity after SQL waits, not this SDK shape.

No independent host/ledger/evaluator is constructed. The exact CE source uses
createCorePostgresTransactionHostV1 with database_after_lock.v1 replay expiry.
Core wraps only the admitted physical role pool and official authentication.
A 40001 remains the same object through the wrapper to that existing bounded
host; no new retry/resend engine. COMMIT unknown is never resolved by GET or by
pool cleanup. Request scope cannot be switched to a different Request/actor/SID.

## Actual before/after counterexample

CE6259 probe sends literal `begin isolation level serializable read only`.
Core predecessor4d15's actual role-bound adapter rejects it with
core_platform_transaction_control_denied BEFORE sending BEGIN. A controlled
execution of the original module confirms this. R1 admits exactly this literal
only for the fixed CE profile. Role identity and transaction safety checks still
run. Semicolons/other options/nested transaction remain rejected. The independent
SERVICE subject-link profile still rejects the read-only variant. This is not
SQL/PG compile proof; no product SQL/guard300 or historical migration is changed.

## Minimal Platform consumption recipe — no target operations executed

1. Coordinator combines this Core child, R0 (already its ancestor), CE6259 and the
   announced identical-tree main. Preserve historical Request/UNKNOWN receipts.
   The supplied tests read CE from exact Git objects; no CE owner file was copied
   or edited in Core. No S01/SERVICE/Storage prerequisite is introduced.
2. Platform selects its independently owned development backend, not staging or
   another chat's localhost. Privately bind backend marker/OID/database/auth
   origin and exact source/build/tree. Supply a direct/session-pooler Pool with
   login cladora_ce_guide_runtime; finite connect<=5s/query<=15s. Observe bounded
   server statement/lock deadlines and finite QA capacity before native use;
   changing profile fields is not observed backend state. No secrets in report.
3. Adopt only required canonical source closure (manifest pins each reference):
   - existing Auth/session SDK and native session-current helpers, identity
     membership/Context, Workspace/entitlement/module and canonical epoch/evaluator;
   - existing C03 platform.idempotency_keys, audit.events, platform.outbox_events,
     transaction host and the role-bound safety/lease helpers;
   - versioned experience.guides/guide_steps/guide_references from
     20261014082947_experience_guide_storage_lifecycle_v1.sql and
     20261014132000_experience_guide_child_publish_lock_v1.sql;
   - fixed roles/safety source in20261015100000_core_platform_role_bound_pool_v1.sql,
     with actual restricted ownership, role graph and ACL observation;
   - edit's immutable experience.guide_save_receipts_v1 / deferred C03 relation
     from supabase/proposals/ce012_save_writer_relation_v1.sql requires an accepted
     additive adoption payload. Its55000 review-only file IS NOT an installer;
     do not execute it, remove its guard, pretend it was applied, or replay Building
     and other historical migrations to acquire a helper. Platform/Core must pin
     the reviewed adoption payload before native edit. Create is independent.
   Missing tables/functions/overloads/grants => named gate, never synthetic objects
   or positive grants inferred from source. Core does not operate provider roles.
4. Actual preflight must confirm effective rights (schema USAGE; exact helper
   EXECUTE; required table/column operations under RLS), ordinary fixed principal,
   safe role/membership/ownership graph and unchanged canonical helpers. Runtime
   must not own product/managed Auth tables, have SUPERUSER/BYPASSRLS or a path to
   a login/owner role. Auth helper access is the canonical guarded path; no direct
   managed Auth grant or service_role fallback. Installer != runtime != observer.
5. Platform supplies an issued synthetic AAL2 account, exact authorized Context/
   Workspace/tenant/member tuple and experience_guides entitlement with separate
   manage/read permissions. No account or permission is seeded by this package.
   Couple the request-owned handlers explicitly in CE's draft route/read cutover;
   do not reinterpret an inactive503/denial as permission to use legacy fallback.
6. Native cases: create v1 -> same command replay (one effect) -> edit v2 -> publish
   v3 -> cancel v4 -> same ID/version/status via current read; restart the admitted
   backend/process and re-read the persisted record. Independently observe actual
   receipt/audit/outbox/immutable history/deferred relation and same-PID transaction
   terminal. Concurrent expected-version changes, wrong actor/Workspace, revoked
   membership, expiry during waits and 40001 must not create duplicate effects.
   Use explicit same-wire recovery for UNKNOWN; no changed key/body or blind POST.
7. Observer scope is only this synthetic run's Guide/keys/tenant/Workspace/receipt
   IDs. Record source/target/backend correlation, COMMIT/ROLLBACK ACK and uncertain
   settlement. Lost ACK is UNKNOWN even if a current GET shows a row. Restore or
   cleanup only under a separate approved recipe; do not purge unresolved commands
   or claim rollback of independently committed earlier steps. No public raw data.

Native gates are owned by Platform (recipe/actual profile/limited roles/synthetic
account/observer/restart/capacity), CE (route consumption/UI/lifecycle), Core
(request binding/C03/source adoption), Coordinator/QA (independent acceptance).
Storage and S01 are NOT gates for a document-free Guide. Reference-bearing Guide,
CE010/CE011 and other domains remain separate. This source handoff is not native
or full programme completion.

## New evidence actually executed

-16 binding groups: real Core fixed-role adapter plus contract seam, actual CE6259
  SSR coupling, legacy missing-SID refusal, target/principal/role mismatch,
  AAL/request/actor/session/race/abort failures, exact40001, predecessor READ ONLY
  counterexample and closed successor/independent SERVICE admission.
-4 connected groups use actual pinned CE handler/providers and real Core host,
  over controlled SDK/PG: create/edit/publish/cancel/version4 readback and exact
  replay; Auth denial before checkout; same40001 through3 bounded host attempts
  with zero commit/mutation; post-reservation expiry/revoke rollback.
-No accepted CE journey/carrier groups or accepted Request suite was rerun.
-Core own source and scratch composition with CE6259: full ES5 typecheck; limited
  lint, both test syntaxes, diff and inventory checks. Native/Auth/SQL/installation/
  restart/UI browser on real backend: NOT_RUN_NOT_PASS. No configured target call.

```sh
node scripts/test-core-guide-request-binding-v1.mjs
node scripts/test-core-guide-ce-r1-coupling.mjs
node_modules/.bin/tsc --noEmit --incremental false
```

Automation: نیازمند بررسی — hashes, exact ABI/negative checks and scoped receipt
comparisons are mechanical; actual target/capacity and retry/recovery decisions
stay with Platform/Coordinator/CE. No new automation engine or execution authority.
