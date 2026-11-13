# Core24 — limited revise source/query admission candidate

Parent: 103ee9ad61c033a0745b2558b052912f16381ee2; branch codex/core-domain-ports-01.
Source verdict: REVIEWED_BLOCKED. Permit=NULL; runtime=NULL; target unchanged.
This is executable offline Core validation, not a registered runtime or installer.

## Exact inputs and preservation

The private Page transferred the two official bundles in a source JSON envelope:
55176 bytes, SHA256 913cc1090eda413cf0e8ce2e2b5c4e6c413dceeef2310e99fded9658a14e804f.
Decoded bundles and Git Head/Parent/Tree were independently matched, objects imported
without checkout. No private envelope or bundle payload is embedded in this report.

| Input | FullSHA | Parent | Tree |
|---|---|---|---|
| SQLa988 | a9889c3d79f076fa3bb2aa8ec9643ec07227fd10 | 5f99bf39c4d829310a6a04d7966346d8bb91d568 | 7c5bb5b9d980e1c10002b65c790d444496508262 |
| replay143 | 143a9fc312cff4f6a7bdcb9c4340634e96392d9d | 5f99bf39c4d829310a6a04d7966346d8bb91d568 | 43a258dd5b1f32426f4a9db290bf39f77029497a |
| Core policy | 7e80988a99a9bfc02214db87a01ac6821ce8dc13 | 0b73eb0754f6f3e0025b452123e309c4bb2ca1d7 | 11ef9b6850cf6dd947fa2d6c4d54e466ead8f80e |

Replay bundle:14428 bytes, SHA256 e8cef293ecad3f67e168c988f0a49b931fbafb3fb7cf792859d7a0075b4daa93.
SQL bundle:21377 bytes, SHA256 10e3b66bed0cc1e0444fa205d541deee41aa2089a2e1096b288c09930fb0c2d8.
Each bundle requires 5eadb64ca9848dc433582fe3f718b661d12548b4, not the Core branch.
The two sibling commits are NOT a combined candidate. SERVICE must publish one
reviewable successor preserving both; Core does not merge/edit the owner's files.

admission.json seals16 exact full-file inputs and two complete function spans,
including header/properties/body/delimiters. This is byte slicing of known source,
not SQL parsing/compilation. The original source body's complete effect was read;
a matching function name/string is insufficient. These pins do not attest an
installed function, owner, trigger or RLS state.

## Closed candidate ABI

File: src/lib/core/service-revise-admission-candidate-v1.ts.
Export: createCoreServiceReviseQueryCandidateV1({scope,original_command,core_command,provider_code,phase}).
Contract: core-service-revise-admission-candidate.v1. No dispatch/query/host/retry
method exists. assertQuery and assertResult validate candidate wire only. Shape
of a supplied scope/JSON is NOT proof of the official live C03 scope or authority.
A future admitted Core composition must supply that scope from the existing host;
this module is never a route/client permission boundary or a caller allow callback.

| Query (literal) | arity/phase | Args and result |
|---|---|---|
| select app_private.apply_service_offering_revision_v1($1::jsonb) as result | 1 / mutation | Exact validated SERVICE plan, same original command/fingerprint, source tenant from C03, exact head/old revision/version/party/agreement; one strict writer-result row |
| select app_private.read_service_offering_revision_result_v1($1::jsonb) as result | 1 / replay | Exact writer-request contract, canonical scope tenant, immutable original command/fingerprint; one strict result or NULL |

These are TWO additional domain queries, not the entire C01/C03 query census.
The existing Core C03 engine retains all transaction/ledger/audit/outbox/retry and
settlement queries. A SELECT that calls the volatile writer is a MUTATION; it
must never be admitted as a GET/preflight/replay merely because it starts SELECT.
Unknown SQL/family/provider/phase/args/scope are rejected before a dispatch point.

Core command must exactly equal SERVICE's current mapping: services.catalog.manage,
services_catalog, service.revise_offering, service_offering aggregate, original
actor/Context/Workspace/authority/key/transaction/command, sorted old revision and
agreement source IDs, exact old-revision subject and next head/version. Original
wire is never rewritten when current authority changes. The fingerprint boundary
is checked against the actual SERVICE canonical command in targeted coupling.
Existing SERVICE serviceOfferingRevisionSchema validates new terms; Core adds no
business terms policy and does not test old commercial availability here.

assertResult requires exact offering/new revision/version/head and mutation equal
to command_id, as the actual SQL body returns. Readback NULL means missing effect,
not success. It does NOT prove a stored receipt: the existing C03 receipt reader
and SERVICE143 must ALSO compare the readback mutation to the canonical matched
receipt.mutation_id. Copy/shape/hash alone cannot close that join. Scope/attempt/
DBtx/query-function drift invalidate the candidate; validation yields no permit.
No claimed authority/session/S01 boolean is accepted by this module.

## Body/effect review

app_private.apply_service_offering_revision_v1(jsonb): SECURITY INVOKER, VOLATILE,
search_path=pg_catalog. Strict top-level plan/source/command shapes, actor check,
identity/version consistency, existing revision-validity helper; exact-effect
readback first, Offering FOR UPDATE then old revision FOR SHARE; require current
head, exact versions/provider/agreement and draft/submitted; insert one NEW draft
revision retaining coverage/eligibility, conditionally advance head and lock_version.
No old revision overwrite or implicit publish. Only unique_violation is mapped to
23505; 40001/timeout/cancel are not caught. C03 owns reservation/effect/audit/outbox/
receipt/COMMIT atomically. No domain receipt or parallel ledger is created here.

app_private.read_service_offering_revision_result_v1(jsonb): SECURITY INVOKER,
STABLE, search_path=pg_catalog. Exact tenant/Workspace/key scan; compare full
immutable command JSON/fingerprint/command ID/offering/new revision, return stored
effect versions. No DML/transaction control. It does not itself authorize disclosure
or ensure current S01; the official composition must do so after related waits.

Old commercial expired/future is NOT checked by these bodies; exact current
head/old revision and draft/submitted are required. Core7e preserves this policy.
Request/read/publish families and guards remain unchanged.

## Findings, counterexamples and exact closure

| ID / severity | Source and witness | Owner / minimal correction / closure |
|---|---|---|
| CORE24_CAPTURE_COMPOSITION / HIGH integration blocker | a988 offering-revise-provider-v1.ts:193 creates a new Core source; Core functional-command-runtime-v1.ts:178 replaces resolveAuthority with its own capture. Real default SERVICE factory + real Core runtime returns PROVIDER_UNAVAILABLE with zero writer/commit; control using the runtime's actual reader reaches the actual writer on modeled transport. | Core composition, coordinated with SERVICE. Expose/use one request-local official capture/source facade for both canonical runtime resolution and SERVICE source; no injected allow. The test control is NOT a new product ABI. Require actual default/final factory coupling before admission. |
| CORE24_S01_AFTER_WRITER_WAIT / HIGH | a988 provider:178-186 validates S01 only via earlier source; writer SQL:238-268 can wait again on row/unique/FK/trigger/head effects. The real source/canonical C01+SERVICE writer path on controlled transport begins before S01's operational UTC end, advances actual modeled DB time to end during writer wait, and still reaches modeled COMMIT with no new agreement scan. Already-expired and current-permission-denied controls reject before writer. | Core final canonical agreement/checkpoint composition; SERVICE if final-writer/replay ABI hook needed. Renew the SAME agreement/version/party/Workspace/service.offering.revise with real DB time after final related writer/readback waits; preserve original command/hash/TTL. Do not rerun old-head source after its successful revision (it should have advanced). Missing terminal primitive keeps admission closed. No target exploit/native pass claimed. |
| SQL24_NULL_EFFECT_GROUP / MEDIUM storage invariant | a988 install.sql:10-22. For non-null revise_command_id_v1 with other four fields SQL NULL, all-absent arm is FALSE and all-present arm is UNKNOWN; CHECK accepts UNKNOWN. Three-valued model asserts this and valid/all-absent controls. Index WHERE clauses are not this CHECK. | SERVICE: explicit IS NOT NULL for all five fields in complete arm (or equivalent exact all-or-none check); retain nullable legacy arm and immutable trigger. Add partial-null negatives per field plus valid/all-NULL controls; exact corrected SQL/schema/body pins needed. Not a native execution finding or proof of unauthorized runtime access. |
| SERVICE_COMBINED_REF_REQUIRED | a988 lacks stored.mutation_id === receipt.mutation_id; sibling143 has it. | SERVICE/Coordinator: one official successor preserves SQL + tenant input + replay143 comparison; metadata conflicts resolved by owner. No scratch merge is the final source. |

The two-function source verdict is therefore NOT_READY; it is not a claim that
all SQL is invalid. Other exact identities/effect mapping fit Core7e/C03, subject
to the findings and Platform's actual owner/ACL/RLS/lock proof.

## Dependency order, verify and recovery (not execution permission)

1. SERVICE combines143+a988 and corrects domain-owned findings. Pin Head/Tree and
   transitive schemas/helper bodies, exact error/receipt and request ABI.
2. Core closes shared-capture and postwait S01 checkpoint with that real consumer,
   binds the two additional query literals to actual mutation/replay phases, and
   validates only affected mutation/replay/mismatch/current-denial/40001 coupling.
3. Platform reviews existing target catalog against exact offering/revision schema,
   canonical S01/session/fresh-time/C01 helpers, revision-validity helper, all
   constraints/indexes/defaults/FKs/trigger/writer paths and native lock order.
   Determine exact owner/grantor/principal/overloads/ACL/default ACL/RLS and column
   row-lock rights; invoker facade EXECUTE alone does not supply underlying rights
   or prohibit direct table access. No broad DML, role fallback or owner inference.
4. Platform supplies an explicitly authorized bounded atomic forward installer
   and full pre/postimage seals. SERVICE preflight/verify are only bounded shape
   checks; presence/count/volatile flags do not prove body, overload, RLS or owner
   equality. Fail on mismatch/populated collision; no replay-all/IF EXISTS repair.
5. Future target proof after separate authorization: real Auth/AAL2, current scope/
   S01 after waits, direct-access denial, native same-key one effect, actual rollback,
   same40001, UNKNOWN/read-only original receipt recovery and stable restart readback.
   Until then permit/runtime/target binding remain NULL; no activation implied.

Failed install before known COMMIT: rollback same unit through Platform, preserve
primary error; unknown commit: UNKNOWN, read-only exact catalog/protected-state
reconciliation, no blind install/command retry. Unactivated empty exact postimage
can have a separately reviewed catalog rollback. Once business revision/C03 data
committed, no destructive uninstall, receipt rewriting or automatic data rollback.
Original UNKNOWN retains actor/authority/key/body/IDs/fingerprint; recheck current
authority independently. No TTL extension, new key or copied receipt is recovery.

## CE boundary preserved

CE6adb/correction103 are unchanged and dependencies are not re-discovered. The
historical CE packet supplies inventory/root requirements, not recursive Core
C01/C03/session/evaluator/default/sequence/lineage closure or installed proof.
Core owns closed query/canonical helper-source identity and the safety contract in
ce010-producer-19/profile-contract.json. Its two exact required safety signatures
remain app_private.assert_ce010_role_safety_v1() and
app_private.acquire_ce010_role_safety_lease_v1(). Platform owns actual bodies,
transitive role/ACL/RLS/lease target binding and capacity; Core will compare the
real delivered implementation to that contract. No helper body, role, lease,
public grant or CE cutover is implemented in this increment.

## Reproducible source checks / evidence limits

node scripts/check-core-service-revise-admission-v1.mjs
node scripts/test-core-service-revise-admission-v1.mjs

Only fixture definitions from old source tests are reused; no old case executes.
New13 groups consist of7 source/coupling findings/controls and6 closed-candidate
wire/result/scope controls. Modeled writer effects and CHECK truth tables are not
PostgreSQL parsing/compile/native proof. No SQL, Auth, grant, install or target
operation ran. Full ES5, focused lint/syntax/diff and scratch apply/reverse are
recorded separately. Clock20 and accepted owner suites were not repeated.
Automation: نیازمند بررسی؛ source pins/wire negatives are automatable; shared
capture/final authority semantics and Platform/Coordinator native admission remain
human-reviewed dependencies. No fabricated estimate or automatic execution.
