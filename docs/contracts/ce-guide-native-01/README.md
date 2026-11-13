# CE-GUIDE-NATIVE-01 — R0/R1 product continuation

Worker: CLADORA-CE-WORKER-01. Source Base:
`bfadc5042cb00841dd605862a2a72ddc0dbafb87` (PR478 published head).
Accepted Request application `fd7bc8799ce8aba970bb74e2a9035d4ee41e5119`
and its historical failures/UNKNOWN remain untouched. This isolated detached
checkout preserves the old CE branch at1a28c1c and its artifacts. It does not
rewrite Coordinator's main reference. PR478 was subsequently observed merged at
6cecfa15b00f445be68817e756d766fb0e6fe026; its entire Git tree equals Base's
ff8a0aeda835cc9e9dcc2a19cae74ab73ce1d5b1. Base/Parent is retained, no rebase,
reset or repeated suite is needed to establish that source equality. No branch recreated.

## Actual CE-owned product path

`/{en|ro|fa}/app/experience/guides` -> CustomerExperienceGuidePage -> existing
create/editor plus CustomerExperienceGuideActions -> existing `/guides/draft`
handler -> existing CE providers/executors -> canonical Core C03 host.
Create/one-step version1 and edit use the accepted Task14/13 source. Publication
and cancellation are now connected through this same product page and handler.
No SERVICE runtime, parallel host/evaluator/ledger or legacy writer is borrowed.

The lifecycle client prepares once, freezes the exact execution request+Core
command, coalesces duplicate clicks and retries only explicitly with those bytes.
The server parses the strict request, reconstructs and compares its complete Core
mapping, verifies the server actor, then runs the canonical host. Its response is
a bounded actual Core receipt projection, not caller committed:true or raw rows.

- Publication: draft(version n) -> published(n+1), content_version unchanged.
  Existing immutable-reference provider/selector is reused; no reference means
  zero Documents dependency. Browser publication of reference-bearing Guides
  remains NOT_READY until its full immutable source binding is available.
- Cancellation: existing cancel_guide domain schema/reason is consumed; only
  draft or published -> cancelled(n+1). History/content remain intact. Cancelled
  Guides cannot be edited, published or cancelled again with a new command.
  The existing manage permission and experience.guide.command purpose are used;
  no new entitlement/permission is created. Publisher/unpublisher requests retain
  their prior purpose/fingerprint; reason is required ONLY for cancellation.
- Source lock discovery and lifecycle providers are reused. Private provider
  evidence is bound to the current command/scope through the existing canonical
  Core resolver after source waits, before mutation after C03 reservation, after
  effects, and after replay waits. Failure rolls back through the same host.
- Existing Core `replay_expiry: database_after_lock.v1` is consumed for the
  functional create/save/lifecycle host: DB clock after ledger lock AND after
  replay provider wait, not a new CE clock or retry engine. Core source unchanged.
- UI publication/cancellation require explicit confirmation; cancellation asks
  its domain reason in EN/RO/FA. Unsaved editor content blocks lifecycle dispatch.
  UNKNOWN freezes editor/action, survives locale readback and cannot be resolved
  by GET. Matched receipt triggers fresh read, never an optimistic fake row.
  The default read cutover remains unchanged and no denial causes fallback.

## Session carrier correction

Source counterexample on Base: actual CE request pool emitted only sub/role/aal;
Core's canonical current-session guard requires issuer session_id AND exp. The
strict CE session type could not accept session_id. No SQL/PG execution was used
to establish that source mismatch.

The SSR authenticator now adds verified getClaims to existing getUser/getSession/
MFA calls; SID/exp must be valid and actor/expiry/AAL/role must agree. Metadata
cannot supply them. Only that issuer-verified SID and expiry enter SET LOCAL
claims through the existing CE request pool. No JWT/credential is manufactured. Existing lifecycle AAL2 checks remain intact;
a genuinely issued AAL1 development session is not relabelled as AAL2.
The type addition is optional for legacy modeled source consumers; these still
lack native claims and cannot satisfy the unchanged Core guard. The actual SSR
path always requires verified SID or returns null. This is not native admission.

## Exact Core/Platform handoff (existing symbols, no invented producer)

| Consumer file / symbol | Input and required producer behavior | Output / current closure |
| --- | --- | --- |
| experience-guide-functional-http-v1.ts / Ce012FunctionalDependenciesV1 | Official request-bound CorePlatformRoleBoundPoolV1 plus verified session; native role/custody/session/Context currentness | Default role_bound_pool=NULL. No accepted Guide producer was delivered, confirmed by Coordinator; SERVICE is not its substitute |
| experience-guide-lifecycle-http-v1.ts / authenticateExperienceGuideLifecycleServerSessionV1 | Actual SSR SDK getUser/getSession/getClaims/MFA, same issuer/subject/SID/exp/AAL, no caller actor/permission | Verified actor/AAL/expires_at/session_id or null. C01/action authority is separately rechecked in transaction |
| experience-guide-lifecycle-http-v1.ts / createExperienceGuideLifecycleRequestPoolV1 | Official lease, verified carrier, exact context/workspace | Same connection/transaction, fixed cladora_ce_guide_runtime/session_user and cladora_ce_guide_executor/current_user, scoped SET LOCAL claims and cleanup; no owner/service_role fallback |
| core/platform-role-bound-pool-v1.ts / CorePlatformRoleBoundPoolV1 | contract_version=core-platform-role-bound-pool.v1; direct/session_pooler; connect() returning guarded ordinary lease | Platform/Core must provide exact role-safety census/lease, installation identity, cleanup and capacity admission; no grant assumed |
| experience-guide-functional-http-v1.ts / probe and GET | Actual canonical resolve_workspace_native_context_v2_at_v1, check_workspace_native_permission_v2_at_v1, require_request_session_current_at_v1, revision and audience helper used at their existing callsites | Strict guideReadResponseSchema projection (50 limit), current can_manage/can_create; raw authority is not disclosed; canonical overload/install proof still required |
| experience-guide-create-writer-v1.ts / createCe012CreateWriterProviderV1 | Existing create_guide expected_version=0, stable Guide+step IDs BEFORE fingerprint; strict one step/no references | Canonical guides+steps v1 inside Core scope. Core C03 receipt/audit/outbox, no separate CE create table |
| experience-guide-save-writer-v1.ts / createCe012SaveWriterExecutorV1 | Existing save_draft positive expected_guide_version, frozen payload/key/hash, current authority | Version n+1 + new immutable storage step + existing typed CE receipt relation. Its guarded review-only SQL is NOT an executable installer |
| experience-guide-lifecycle-http-v1.ts / readExperienceGuideSourceLockCandidateV1, buildExperienceGuideLifecycleCoreCommandV1, createExperienceGuideLifecycleCoreProvidersV1 | Positive expected_version, source locks, current authority, publish/unpublish/cancel; cancel consumes existing cancel_guide reason | CoreTransactionCommandV2 exact descriptor; version n+1, immutable content/history; replay requires exact receipt and current state/authority |
| core/postgres-transaction-host-v1.ts / createCorePostgresTransactionHostV1 | Existing same-backend C01/C03 custody + database_after_lock.v1 expiry, genuine ordinary principal | Atomic receipt/audit/outbox, exact replay or denied/unknown_commit. Raw40001 preserved for Core's bounded retry; no CE retry loop |

### Required install/custody closure

1. **Core**: accepted Guide producer FullSHA/ABI, current-session/Context/manage/read/
   entitlement and C03 custody, exact provider-source/replay behavior. Current
   existing CE consumer symbols above are the handoff; an allow callback is not
   a producer. Missing ports stay explicit rather than changing domain logic.
2. **Platform/Core**: schema/ACL/RLS/owner/role safety and installation recipe for
   canonical platform customer_workspaces/idempotency_keys/outbox, audit.events,
   identity membership/Context/revision and the exact helper callsites above;
   versioned experience.guides/guide_steps/guide_references from migrations
   20261014082947 and20261014132000; save receipt projection requires reviewed
   adoption of supabase/proposals/ce012_save_writer_relation_v1.sql without running
   its55000 review fragment. No new table/role/grant or SQL was executed here.
3. **Platform**: admitted isolated developer target, issued synthetic account,
   private SDK/connection custody, persistence/restart capability and QA capacity.
   Another Seat's localhost/credential/lease is not inherited. Shared runtime
   execution stays under Platform; no native scenario was dispatched here.
4. **Coordinator/QA**: pin final merged main and applicable CE delta, exact lock,
   private evidence/disclosure scope, then independent first-ready-flow acceptance.

### Error and receipt contract

Read:401 unauthenticated,403 denial,503 NOT_READY, invalid projection rejected;
no weaker reader fallback. Preparation performs no C03 reservation/domain write.
Execution:200 only bounded matched Core receipt;202/transport/malformed success
or an unresolved denial/conflict retain UNKNOWN and exact wire/key. Invalid
mapping400 and denial403 do not authorize another path. Stale/existing collision
is409; current GET is never command proof. Browser receipt IDs are not authority.
No hard-reload duplicate-free intent guarantee is added by the in-memory holder.

## Affected controlled evidence and native acceptance order

New targeted suites only:

```sh
node scripts/test-ce-guide-native-session-carrier.mjs
node scripts/test-ce-guide-native-journey.mjs
```

Exact existing Next16.4.1/Zod4.6.6/TS5.9.3, Node24.19.0. No installation/config
repair. Seven carrier groups and seven connected journey groups passed across
scoped invocations. Actual Page/form/handler/provider/Core host are executed;
SDK/Auth/role/SQL storage are MODELED. No synthetic JWT or PG session is minted.
The modeled fixture prefix is reused, none of prior Task14's12 cases execute.
Harness setup defects were corrected (module/fixture initialization and modeled
row snapshots); failed attempts are not native/product successes. Affected
positives were rerun only after relevant source changes, not unrelated suites.

Journey evidence covers create1 -> edit2 -> publish3 -> cancel4/read in EN/RO/FA,
direct draft cancellation and cancelled immutability, same-wire duplicate/lost
reply, stale version/revoke/malformed result/late owner, dirty draft and UNKNOWN
across locale, exact domain-reason boundary, DB-clock expiry after replay wait.
Carrier evidence covers exact issuer SID/exp, missing/malformed fields, mismatch,
metadata refusal, expiry crossing SDK wait, additive legacy compatibility and invalid-role fail-closed.
Full final ES5 typecheck/lint/syntax/diff are recorded separately in manifest.

After admitted Core/Platform inputs, execute THIS SAME task in order:

1. Current authorized reader and read-only actor; absent writer must preserve read.
2. Actual no-document create0 -> canonical receipt -> read version1 after refresh.
3. Save1 ->2, immutable step identity and CE/Core receipt relation; no second save.
4. Publish2 ->3, audience/denial; no Documents dependency for no-reference Guide.
5. Cancel draft/published -> next version, history retained; cancelled immutable.
6. Two concurrent versions: one effect; denied stale command never clears draft.
7. Real revoke/expiry across source/C03/provider waits; rollback/UNKNOWN accurately
   distinguished, same original40001 with the canonical host retry policy.
8. Lost reply/exact replay, expiry while waiting for lookup/replay, no auto resend;
   actual receipt/result/version compared, not only HTTP200.
9. Restart the admitted App/backend under Platform's recipe; same Guide/version
   readback under issued Auth, no assumed persistence or imported private receipt.
10. QA native browser FA/EN/RO/RTL/mobile/keyboard, exact final source/lock; distinct
    native App/Auth/DB proof and independent acceptance. No shared run before
    Platform resource/identity/capacity admission.

All native App/Auth/DB/browser/restart cases remain NOT_RUN_NOT_PASS. CE010/CE011
remain queued until the Guide native flow is accepted. This R0 checkpoint does
not close CE-GUIDE-NATIVE-01 or historical Task13 and is not source adoption.

Automation: نیازمند بررسی؛ controlled protocol/version checks are candidates;
create/publish/cancel/retry require the current authorized human action. Native
execution depends on accepted Core/Platform inputs; UNKNOWN/revoke is escalated
to CE/Core/Platform. No estimated value or new automation authority is claimed.

QA alignment: official criteria blob7ff67c04841dce3e4f8884c9d2e5ca16968bd2a0
was read from QA-FIRST-WAVE-01/report6718763075. Its Guide create/revise/publish/
audience/restart/currentness criteria are reflected above; actual QA admission,
receipt of this source and independent acceptance are NOT claimed.
