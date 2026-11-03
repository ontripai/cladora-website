شماره تسک: ۲۸۲-۱

Inactive source implementation of the approved Checklist extension in the existing
Operations C03 family. Independent SERVICE review and every installation/native
execution gate remain open. This packet does not modify Foundation, its installers,
runner, AIR collector, CE, historical migrations or dependencies.

Baseline: Core236+CE238+CE239+PROCEDURE240 on
8c8225fb3297035a2349357bd968d60779388063, followed by accepted277 full successor,
not stacked on260-3. Official277 patch: eb4390311e1d135821edea31326668e8f609dce3;
manifest: f913d03b64cf850a7de56766c1f4206767749ec0. Full baseline census:2281 files.
Review: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6490918510
and separately attributed continuation6491654831. Owner task282 approves the
Checklist decisions in its text; it does not reopen the accepted277 summary.

The consumer hook still has exactly ready/receipt/send. receipt is a newly allocated
three-primitive summary `{action,outcome,recorded_at}`, not the canonical receipt,
result, identity, authority, request hash or audit/outbox identifiers. The new action
label is the only summary vocabulary extension. Historical evidence is not current
state or authority. Current denial, pending/busy, failed ACK and changed Context
suppress the summary. Existing Context/lifetime fences remain.

ABI and exact identity:

| Layer | Contract |
| --- | --- |
| HTTP | Existing POST /api/customer/v1/operations/commands; `{version:2,phase,context_id,command}`; phase=open/lookup/reserve/execute/ack; command=null only for open. |
| Envelope | `{key,wire,fingerprint}`; one lowercase UUID key generated once; exact wire persisted before any dispatch; fingerprint=lowercase64hex SHA256 of exact UTF8 wire. No parse/re-serialization before RPC. |
| Intent | Exactly `{version:2,action:'record_checklist',context_id,target_id,expected_status:'in_progress',input:{context_id,item_id,notes}}`. target=work order, not item. Both Context fields match. No caller actor/session/role/Workspace/clock/allow. |
| Notes | Exact trimmed10..2000 Unicode code points; NUL/lone surrogates denied. SQL independently checks key sets/types/canonical UUIDs, exact wire hash, code-point length and the ECMAScript trim-character set. Existing24000-byte wire limit. |
| RPC | customer_api.operations_command_v2(text,uuid,uuid,text,text) -> same-signature private function; same phase/Context/key/wire/fingerprint argument order as C03v1. |
| Receipt | operations-command-receipt.v2; action=record_checklist; same key/Context/Workspace/actor/membership/authority_revision/request_hash/target/fingerprint/outcome/error/audit/outbox/recorded_at fields as C03. |
| Committed result | Exactly `{work_order_id,item_id,completed:true,completed_at,notes,already_recorded:boolean}`. Real row/time/notes bind the wire; missing/extra/contradictory/future-time result is invalid. |
| Rejected result | result=null; bounded22023/40001/42501/P0002; audit/outbox IDs=null. Current-authority failure outside the business subtransaction is a failed response/hold. |
| V1 | New codecs explicitly accept both versions. V2 RPC delegates v1 wires unchanged to existing private operations_command_v1. V1 HTTP never accepts v2 wire/answer. Unsupported old clients hold on v2 pending. |

No ledger, permission or authority engine is added. Physical store remains
platform.idempotency_keys with `operations.command.v1/<Workspace>/<key>` namespace.
That prefix identifies the durable family, not payload ABI. The server request_hash
pins `{version:2,authority_at_reservation:<actual full native tuple>,wire:<exact text>}`
using existing PostgreSQL JSONB serialization/SHA256; it is distinct from the wire
fingerprint. Never derive it from current GET or browser claims.

Locks/admission: existing actor+Workspace advisory lock, Workspace row, resource
advisory lock on work order, C03 row, native work-order row, checklist-item row.
OPEN scans all versions together through the accepted C03v1 discovery. The existing
guard_operations_unresolved_v1 recognizes the same namespace/work-order/running_xid
frame. There is no caller-set authorization GUC, new purpose prefix or second store.
All versions compete under the same actor/Workspace and resource fences.

The actual operations_checkpoint_v1 owns provider-session currentness, AAL2,
tenant/Workspace/Context, membership/role/resource, effective permission and revision.
OPEN retains work-orders.read; Checklist uses existing work-orders.manage. No
checklist permission, generic asset.read substitution or new evaluator is invented.
The source pins exact helper body/security/owner/search_path; presence is not assumed
in staging. Native owner/grantor/privilege/caller census remains an execution gate.

State transitions: absent -> reserved102 -> committed200/rejected409 -> ACKed.
Reserve has zero business effects. Execute requires that exact reservation.
Lookup absent/pending, expiry, unavailable RPC or invalid response leave the known
command unresolved. Explicit retry alone resends the same key/wire/fingerprint.
Same key with different bytes conflicts even for equivalent JSON. Browser storage
is not a receipt or COMMIT proof. No automatic reservation/execution follows GET.

The execute-RPC transaction locks the actual item and invokes the actual pinned
maintenance.work_order_checklist_v1. Native item mutation/domain audit, command
audit, outbox and C03 receipt are atomic in that transaction. The bounded business
exception subtransaction rolls provisional effects back before recording a rejected
receipt; unallowlisted errors/timeouts/cancellation never become successful receipts.
No COMMIT exists inside a function. Reserve/execute/ACK have existing separate RPC
transaction boundaries; this is not rollback of earlier committed phases.

Current-authority checks follow actor/Workspace/resource/work-order/item waits,
native mutation/triggers, command audit, outbox and receipt/ACK writes, before the
next effect/response. Observed invalidity rolls the execute attempt back under the
accepted READ COMMITTED contract. No strict logout-after-last-check/COMMIT
serialization is claimed. Deferred-trigger/FK/lock census and true concurrency/
issued Auth/COMMIT-loss evidence still require the native lane.

already_recorded=true comes only from the locked pre-existing completed item. Same
notes preserve its time and native domain audit; a new independently authorized
command receives its own command audit/outbox/receipt. Different notes conflict.
That receipt proves the NEW command only, never an old keyless POST or its actor.

Recovery/UI:

- Persist exact envelope before dispatch; reload/new device OPEN discovers any
  retained server reservation/receipt. A known local key with absent lookup stays
  held. If all identity was lost before durable reservation, no old success is
  inferred or reconstructed from GET. Test scope never automatically purges rows.
- Original Context is retained in storage and every lookup/replay/ACK. Selected B
  never stores/sends A's command as B. Original full authority is rechecked before
  disclosure. Deny/revoke/binding drift holds without a replacement key/body.
- V2 pending closes imperative admission and Gate.ready before first dispatch.
  DurableWorkOrderChecklistPanel keeps its owned promise across that admission
  closure while actual identity changes unmount/fence it. Synchronous writer/
  attempt/read refs protect double-submit and settlement before React rerender;
  render state does not read refs. V1 wire/host behavior remains the accepted path.
- New panel sends only through the shared Gate/client, never direct checklist POST.
  send resolves after terminal canonical receipt+exact ACK. A later GET merely
  observes current checklist. UNKNOWN cannot be cleared by GET or summary; after
  canonical reconciliation/ACK, a remounted panel can read current item readiness.

Legacy keyless UNKNOWN:

- V1 single-marker entries remain independent, ownerless holds: both inflight and
  unknown block. No new API migrates, acknowledges, deletes or assigns ownership
  to such an old entry, even when its Context/work-order match the current panel.
- New legacy POST uses one version2 browser entry per random attempt ID under
  `cladora.operations.checklist.legacy-keyless.v1.attempt.v2:<attempt-id>`.
  It contains original Context/work-order and inflight/unknown/known, no notes,
  wire, fingerprint, server command key, receipt or authority. The attempt ID is
  only browser ownership metadata: it is never sent to the legacy POST or C03.
- `beginLegacyChecklistAttempt(storage,context,workOrder)` returns a frozen live
  owner handle. `markLegacyChecklistUnknown(storage,owner)` and
  `acknowledgeKnownLegacyReply(storage,owner)` require that exact issued handle
  and originating storage object. Copies/deserialized handles and other attempts
  cannot retire its entry. Remount cannot acquire ownership of a prior request.
- A fully validated response from the original live request marks only its own
  inflight entry known; no journal entry is removed. UNKNOWN cannot become known.
  Known is not a receipt or COMMIT proof. The existing POST-response and matching
  observation validation remains; GET alone never settles the old POST.
- Admission is NOT browser CAS or global cross-tab exclusion. Simultaneous empty
  observations may admit two requests, but their independent entries survive in
  either known/unknown response order. Any remaining inflight/unknown/v1 entry
  blocks dependent Operations without waiting for storage notifications.
  Stable bounded key enumeration is required; missing enumeration, malformed or
  unavailable storage fails closed. No localStorage snapshot is server authority.
- Storage failure latches this browser storage object closed for its current
  lifetime; marking UNKNOWN recreates only the issued owner's missing entry if
  storage is available. Clearing/editing/losing browser storage, a new device, or
  an unknown request predating the journal cannot be made durably discoverable
  by a browser-only marker. Cutover inventory and explicit historical policy
  gates remain. No recovery or success is claimed when local evidence is lost.
- All journal entries, including known metadata, remain retained without a new
  TTL/purge/cancel rule. This technical-test-only source does not approve public
  real-data retention. Resource/quota failure is a hold, never automatic pruning.
- Requests predating this marker that lost every local identifier cannot be detected
  retrospectively. Cutover needs a separately verified technical-test inventory;
  unresolved legacy work stays held. No human acceptance/cancel/abandon workflow is
  implemented or implicitly approved. Manual storage deletion is not reconciliation.

Cutover is explicit and currently inactive:

| Source mode | Behavior |
| --- | --- |
| inactive, all four bindings=NULL | Legacy Checklist remains selected; existing C03v1 stays selected, plus announced deny-only legacy hold. V2 request503 before RPC. |
| active, complete reviewed bindings, technical_test_only | V2 panel/protocol selected. GET uses only get_work_order_checklist_v2; old direct POST428 without RPC/fallback. |
| partial/stale/malformed/unknown combination | HOLD for both command protocols and checklist GET/POST; never fall back to legacy writer. |

The frozen cutover source is not an env switch or activation controller. Seal
strings are required inputs, not native evidence by themselves. Installed source,
caller ACL, legacy inventory and execution-authorization bindings are NULL. Offline
tests substitute synthetic configuration in their loader only; product source is
not activated. Native readback/census and explicit executor authority must precede
any separately reviewed build-time mode change.

The separately55000-held/finalROLLBACK checklist-cutover-proposal.sql describes
pause/closure of all nonowner direct C03v1 and mixed legacy entry points. After
inventory and exact native verification, its proposed v1 public facade routes to
the shared v2 port with a v1-only wire gate and unsupported-v2 OPEN hold. Private
v1/checkpoint/guard/native bodies stay unchanged. No positive caller grant is made.
Old mixed GET/writer RPCs must not remain callable as bypasses; native owner-only
nesting survives. Minimal future grants and supported-client rollout are separate
reviewed payloads. After a v2 reservation, unavailable compatible recovery means
hold, never rollback to a writer that ignores that reservation. No general rollout
controller or live pause mechanism is claimed by this source proposal.

Owners and policy:

- Core owns this14-path source packet, SERVICE reviews. PROCEDURE's independent
  consumer paths/successful suites are not modified/repeated. Any real overlap or
  incompatible consumer requirement needs an explicit composition delta.
- New source creates four routines only: private/public command_v2 and private/
  public read_v2. Proposed owner=postgres, private SECURITY DEFINER and facades
  SECURITY INVOKER, all search_path=pg_catalog, following accepted C03 ownership.
  A principal name proves no superuser or installer authority. Existing schema
  CREATE/USAGE, helper EXECUTE and owner/grantor rights must be independently checked.
- OC1 explicitly revokes PUBLIC/anon/authenticated/service_role and unexpected
  nonowner ACLs. Created set, default ACL, role membership and managed-routine
  assertions stay before commit; source ends ROLLBACK. No new table/type/role/seed,
  permission, managed Auth ACL/default privilege or historical rewrite is included.
  SQL is a source draft, not a migration/installer; no naming CLI was needed.
- Prior technical-test retention/abandonment remains
  CLOSED_OWNER_POLICY_SCOPED_TEST_ONLY: no auto-expiry/purge/cancel of unresolved
  commands/notes. Public/real-data privacy, retention and abandonment remain OPEN.
  This source does not generalize that test policy or adopt CE/Building policy.

Native proof source uses one transaction/finalROLLBACK with real C03 calls,
same-key conflict, lookup/replay/ACK, independent already_recorded and deliberately
faulted command-audit trigger. It asserts item/audit/outbox/receipt rollback and
catalog cleanup. No Auth issuer, role/grant or fixture data is provisioned. Future
inputs: independently approved test Context/work-order/item, issued session/AAL2,
and actual executor rights including test-only TRIGGER/schema CREATE. Missing
inputs fail55000, never SKIP/PASS. All actual fixture/execution bindings are NULL.
WAL/sequence allocation is outside rollback restoration. Cross-connection committed
revoke, true PG races and COMMIT/reply loss require a separate authorized lane.

Offline evidence is actual codecs/client/React/Next handlers with explicit fake
Auth/C03/atomic state, source-shaped synthetic rows and mounted handler invocation.
It is not a native browser or PostgreSQL test. SQL text invariants/coherent mutants
are bounded source checks, not a SQL parser/compile/catalog proof. The delivery
manifest records exact checks and apply/reverse identities. DB/Auth/SQL/connection,
install/activation/CI/Push/deployment remain NOT_RUN_NOT_PASS. No artifact transfer
is authorized for282; only the previously approved280 delivery follows this task.

PROCEDURE289 correction — known rejection versus uncertainty:

- Gate's existing canonicalRejection signal is emitted only after terminal receipt
  validation and exact ACK. The durable panel now records a known rejected phase,
  not UNKNOWN. It exposes bounded rejection/denial text, without raw error detail.
- No new command or automatic read/retry is dispatched from that phase. Explicit
  observation must succeed under the current admitted binding before the panel
  offers another attempt. That is a new intent after an ACKed terminal command;
  it does not retry or rewrite the old key/body. Current denial/read failure still
  hides data and blocks completion. Every new action reuses C03 current authority.
- Transport loss, failed ACK, malformed/result binding failures remain UNKNOWN;
  GET cannot settle them. Existing same-key reconciliation, Context fencing and
  accepted277 literal three-field summary are unchanged. No Gate/client/server,
  SQL, role/grant, default no-execute or cutover activation change is included.
- The focused --review-289 tests execute only the review corrections. --probe-289
  --source-root <exact-official-predecessor> reproduces the two original failures;
  the old owner suite remains available and its unrelated cases are not rerun.
