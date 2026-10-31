# شماره تسک: ۲۶۰-۳ — Operations user recovery closure

Status: **RECEIPT_SOURCE_DELTA_LOCAL / CHECKLIST_DURABLE_CONTRACT_PROPOSED_NOT_APPROVED**.
Owner: Core / Operations. Independent reviewer: SERVICE. No runtime or installation proof.

## Provenance and exact scope

SERVICE255-3 verdict is **SCOPED_SOURCE_ACCEPTED_WITH_RUNTIME_DEPENDENCIES**.
Provenance: **direct quotation of the SERVICE report received in PM**, supplied by
the owner in task260-3. Its permalink is unavailable; none is invented. The two
dependencies are (1) validated recovered receipt summary not exposed to the consumer
after the gate becomes ready, and (2) checklist has no C03/receipt lookup contract.
Neither is a defect in PROCEDURE's six-path253-4 delta. Its report6476716748 is
independent provenance for its own source and artifacts, not a substitute SERVICE verdict.

Baseline is the accepted **Core236 + CE238 + CE239 + PROCEDURE240** application
composition, BASE `8c8225fb3297035a2349357bd968d60779388063` (2279 files).
The Core236 gate preimage is 3816bytes, SHA256
`b19dc9819499401f554eba6a391713fe6620ae0f81bbdadf156c7af0f0e00aab`, Git
`b88526c43c8009f7dee1a4e18813d38e85c426cf`; independently matched to official
Core236 delivery `ba425cec89daedb5aea15206762f46acd63d4700`.

Only three paths change in this delta:

| Path | Operation / owner |
| --- | --- |
| src/components/customer/OperationsCommandGate.tsx | Modify; Core interface and same-gate summary consumer |
| scripts/test-operations-user-recovery-260-3.mjs | Add; Core affected offline tests and counterexamples |
| docs/contracts/OPERATIONS-USER-RECOVERY-260-3.md | Add; this boundary and proposed contract |

No PROCEDURE253-4 or256-1 path is edited. In particular the dashboard, preventive
panel, lifecycle panel, maintenance page, assets and registration stay under their
existing ownership. The Core hook adds a field without changing `ready` or `send` ABI.
The official253-4 patch `347aa84a3f732305748b9458eaa1d7b8319211ab` and delivery
`e793e16ed29cc4c3f67320b491a7c11a68a3eb12` are pinned for the compatibility apply
check; their successful suites are not rerun. This delta is against the composition,
**not raw BASE** and not the previous Core253 installer review tree.

Foundation, four installers, historical migrations, Auth, evaluators, ContextProvider,
command codec/client/server/SQL, dependency/lockfiles and demo are byte-identical.
Core253 formal artifacts `45106b71f8d488295ee32958344820eacb135a43` and
`9aafd9ee71d5e025cab20e3cc957e863732be7b6` are outside this delta.

## 1. Receipt: implemented interface and consumer

The existing path is `OperationsCommandGate -> createOperationsCommandClient ->
operationsHttpTransport -> POST /api/customer/v1/operations/commands ->
operationsCommandPOST -> customer_api.operations_command_v1(text,uuid,uuid,text,text)`.
The route uses provider-validated claims, same-origin/JSON/size checks, and real canonical
answer validation. The client uses `boundOperationsAnswer`, `receiptFor`, original
Context storage/lookup and exact ACK comparison. No new receipt source is necessary.

`useOperationsCommands()` returns the existing `{ready, send}` plus a nullable
`receipt` summary. Each publication allocates a fresh plain object with exactly
`{action, outcome, recorded_at}` and primitive values copied from the validated
terminal receipt. The complete receipt stays private to the gate/client. There is
no spread, receipt reference, result payload, identity ID, authority revision,
request hash/fingerprint or audit/outbox ID at this consumer boundary; `Readonly`
is not used as a disclosure boundary.

The summary is available only after readiness, outside a busy/failed reconciliation,
and for the gate's same Context. It is not a derived GET result or a second local
receipt. The gate's neutral localized history displays the same three fields.
Rejected receipts remain rejected. Existing `ready/send`, canonical validation and
exact ACK behavior are unchanged. No automatic next step, mutation or read is triggered.

The exported gate keys an internal scope by Context, so even an unkeyed caller cannot
reuse a prior Context's state. The dashboard's existing membership/Context/role/scope
key remains unchanged. Committed cleanup fences old callbacks; a late `send` completion
after unmount is rejected locally, without claiming that a server effect rolled back.
Original-Context terminal reconciliation from another Context still performs the
existing original-authority check/ACK and a fresh selected OPEN. It intentionally does
not relabel or publish the foreign receipt into the selected Context.

Every receipt is **historical evidence**, even when just recovered. `ready` means the
existing command recovery gate is clear, not that a permission remains continuously
valid. Authority/session/AAL2 are rechecked server-side for each command call; no new
polling, logout serialization, live Workspace subscription or provider guarantee is
claimed. A later failed reconciliation suppresses the summary. Context/Workspace
switches suppress old evidence. There is no new authority field or approval capability.

This is an ephemeral display of an already recovered/ACKed receipt, not a durable
history browser: a later clear OPEN or remount after ACK may expose no summary. It
must not reconstruct one from storage, timestamps, resource status, or a checklist.
Unresolved commands and changed key/body remain under the existing client holds.
No D-OPS-RETENTION or D-OPS-ABANDON policy is approved by this change.

## 2. Checklist: actual source and absence of durable recovery

| Source / signature | Actual contract and limitation |
| --- | --- |
| src/app/api/customer/v1/work-orders/[id]/checklist/route.ts:7-26 | GET accepts only context_id. POST accepts exactly context_id, item_id, notes (trimmed10..2000). Provider claims and origin checks; same mixed read/write RPC. No command key, fingerprint, reserve/lookup/ACK, or receipt validation. |
| customer_api.work_order_checklist_v1(uuid,uuid,uuid,text) | Historical SQL invoker facade, immutable source20261004111339_audited_work_order_checklist.sql:31-34. Passes Context/work order/item/notes to native function. |
| maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) | Same source:3-28. Current actor/permission/scope checks; work-order FOR UPDATE, then item FOR UPDATE. Only in_progress. Mutation of actual checklist row and domain audit in one function transaction. Completed same notes is item-state idempotence; different notes40001. No request identity or actor-specific receipt. |
| maintenance.work_order_checklist_items | Stores completed/completed_by/completed_at/result_json notes. GET projects id/label/required/completed/completed_at/notes, not command identity or completed_by. |
| audit.events action WORK_ORDER_CHECKLIST_COMPLETED | Domain audit inserted only on the first item completion. Existing GET does not expose a receipt or audit correlation for this POST. Audit existence alone is not an authorized command lookup API. |
| app_private.operations_command_v1(text,uuid,uuid,text,text) | Current selected source in maintenance-procurement.sql:3773-3968 accepts save/generate/issue/start/complete/verify only. Checklist is not an action; client canonical union also excludes it. |
| app_private.guard_operations_unresolved_v1() | Same selected source:3974-4010. Checklist writes serialize with Workspace row and existing C03 actor/resource holds, but that does not reserve or receipt a checklist request. |
| src/components/customer/WorkOrderChecklistPanel.tsx | Attempt is component memory. Lost/invalid response stays UNKNOWN; GET is observation and does not clear that hold. Closing/remounting loses the attempt. It is not durable recovery. |

Canonical historical SQL and accepted selected effects are source evidence only;
their original historical positive grants do not establish live callability. No SQL,
ACL or installer was changed or executed to establish these facts.

Two concrete counterexamples are in the new offline test:

* **CHK-GET-NONPROOF:** H1=this POST committed and its ACK was lost; H2=this POST did
  not arrive and another authorized actor completed the item with the same notes.
  Both yield identical existing GET JSON, including timestamp. GET cannot identify
  which POST committed. Row-level same-notes idempotence is insufficient.
* **CHK-REMOUNT-UNKNOWN:** actual unchanged panel, lost response after modeled commit:
  refresh still displays UNKNOWN and cannot mark checklist ready; remount loses the
  attempt, observes the completed row, and can mark current checklist ready. This is
  an existing open recovery dependency, not closed by this patch or a model PASS.

Conclusion: **no approved durable checklist recovery path was found in the scoped
canonical sources**. Do not wire UNKNOWN into generic Operations lookup using a made-up
key, infer a receipt from GET, or resend the old direct POST automatically. Source
corroborates the quoted SERVICE dependency; it does not reopen PROCEDURE's accepted UI.

## 3. Concrete proposed decision: one versioned successor of Operations C03

Recommendation: approve a **versioned additive checklist action in the existing
Operations C03 adapter**, with one shared admission/storage implementation and v1
compatibility. No parallel ledger, authority engine, business permission or receipt
store. This whole section is **PROPOSED_NOT_APPROVED_NOT_IMPLEMENTED**.

### Proposed wire/receipt ABI and binding

Use the existing `/api/customer/v1/operations/commands` phase protocol, with a version2
branch that accepts the existing envelope `{key,wire,fingerprint}`. The new intent is
exactly `{version:2,action:'record_checklist',context_id,target_id,expected_status:
'in_progress',input:{context_id,item_id,notes}}`. `target_id` is the work order, not the
item, so complete/verify/resource admission stays serialized with checklist work.
`input.context_id` must equal the original Context. IDs are canonical lowercase UUIDs;
notes are exact canonical trimmed10..2000 text and existing NUL/surrogate protections.
The route must validate without changing dispatched wire; fingerprint is SHA256 of
exact UTF-8 wire. Same key/different bytes is conflict even for equivalent JSON.

The proposed typed v2 receipt extends the existing canonical Operations shape with
contract_version `operations-command-receipt.v2` and action `record_checklist`.
Committed result is exactly `{work_order_id,item_id,completed:true,completed_at,notes,
already_recorded:boolean}`,
bound to intent and validated domain output; error/result/audit/outbox invariants stay
the same. No synthetic receipt is created for a pre-existing completed row: a *new*
approved command can deliberately observe an already completed same-notes item inside
its own execution, but its receipt must label that semantic explicitly with
`already_recorded:true`; a first domain completion uses `already_recorded:false`.
That receipt proves the new command, never an earlier legacy POST or another actor's
first write. Different existing notes remains40001/rejected with no new domain effect.

V1 save/generate/issue/start/complete/verify wires, receipt versions and stored hashes
stay exact. V2 decoding must be explicit, with no silent v1 fallback. Both versions
use the **same existing** physical `platform.idempotency_keys`, logical
`operations.command.v1/<Workspace>/<key>` namespace, actor+Workspace lock
`operations.actor.v1/…` and work-order resource lock `operations.resource.v1/…`.
The namespace denotes the existing durable store, not payload ABI. V2 request_hash
must pin its actual intent version and full authority_at_reservation. OPEN must inspect
all versions together, so an old client facing v2 pending fails closed rather than
admitting a parallel v1 command. Rolling activation requires explicit compatibility
tests and a supported-client gate; a new purpose prefix that old admission ignores
is rejected. No client may acknowledge an envelope it cannot decode.

### Proposed execution/recovery semantics

1. Reuse the native Operations session/AAL2/resolver/effective permission pipeline:
   current actor/tenant/Workspace/original Context/membership/role/resource and
   `maintenance.work_orders.manage`. No `checklist.manage` permission is invented.
2. Reserve a status102 intent with zero business effects under the existing admission
   locks; persist exact wire before dispatch. No local persistence is COMMIT proof.
3. Execute under existing actor+Workspace -> Workspace row -> work-order resource
   advisory -> C03 row -> native work-order row -> single checklist-item row order.
   Assert item belongs to target work order and tenant; fresh full authority after
   waits and before/after native call and response, as required by the Operations
   checkpoint contract. Trigger/deferred/audit/FK wait closure is a mandatory future
   SERVICE/PG review gate, not established by this proposal.
4. Use the **actual existing native checklist function** for domain mutation; no
   reimplementation or evaluator changes. Preserve its no-second-domain-audit behavior
   for already completed same notes. Domain mutation/audit + command audit/outbox +
   canonical C03 receipt must commit atomically; failed execution leaves only the
   existing reservation/rollback behavior. A GUC must not authorize the running frame.
5. On reload/new device, OPEN discovers the same actor+Workspace pending command and
   original Context; lookup/replay/ACK require fresh original full-tuple authority.
   Deny/revoke gives a bounded unavailable response and hold, without wire disclosure
   in another Context or a replacement key/body. Pending or absent is not committed.
6. Only exact explicit retry may reserve/execute the same command after reconciliation;
   receipt validation then ACK permits release. No second item write or domain audit
   on replay; request_hash/receipt immutable. The current checklist GET remains a
   separate observation. Unresolved hold blocks next item/complete and other commands
   under the existing actor+Workspace and resource fences, including a second tab.
7. Legacy direct POST must be closed with the existing command-required behavior after
   separately approved activation. The mixed read/write facade cannot remain executable
   by a caller as a bypass: retain native owner-only nesting and provide a proposed
   read-only `customer_api.get_work_order_checklist_v2(uuid,uuid)` for GET. Caller ceiling
   uses existing manage authority. Exact owner/USAGE/EXECUTE allowlists need a separate
   source/ACL review; no grant or permission is authorized in260-3.

### Exact future package, owners and cost

| Proposed path / signature | Owner / reviewer | Required change |
| --- | --- | --- |
| src/lib/customer/operations-command.ts | Core / SERVICE | Explicit v2 intent/answer/receipt codecs, exact-result and version-dispatch compatibility |
| src/lib/customer/operations-command-client.ts | Core / SERVICE | Mixed-version OPEN and original-Context exact-envelope recovery, same C03 namespace and no key invention |
| src/lib/customer/operations-command-server.ts | Core / SERVICE | Dispatch validated v2 without transforming wire; preserve v1 and bounded deny/UNKNOWN |
| src/components/customer/OperationsCommandGate.tsx | Core / SERVICE | Add v2 typed summary; preserve historical/current distinction and admission |
| src/components/customer/WorkOrderChecklistPanel.tsx | Core/Operations; PROCEDURE integration after assignment / SERVICE | Replace direct POST with shared command send/recovery; notes/key hold across reload; no GET auto-clear |
| src/app/api/customer/v1/work-orders/[id]/checklist/route.ts | Core / SERVICE | GET read-only facade; close direct legacy POST after activation; no fallback |
| supabase/operations-command/operations-command-v2.sql (new, proposed inactive source) | Core / SERVICE | One shared C03 implementation with v1 compatibility; proposed `app_private.operations_command_v2(text,uuid,uuid,text,text)`, matching customer_api facade and read-only checklist facade; unchanged native function/evaluator/managed Auth |
| scripts/test-operations-checklist-command-v2.mjs (new proposal) | Core / SERVICE | Real route/client/UI offline regression and coherent-negative models |
| supabase/tests/operations-checklist-command-v2.test.sql (new proposal) | Core / SERVICE, Platform execution only with separate authority | SQL test source for atomicity/ACL/revoke/two connections/commit loss; not execution |
| docs/contracts/OPERATIONS-CHECKLIST-C03-v2.md (new proposal) | Core / SERVICE + owner policy | Frozen ABI, compatibility/cutover, retention and legacy UNKNOWN handling |

Estimated engineering scope is **10 source/test/doc paths**, plus a separately
assigned versioned migration/install delta generated with the official naming tool
when authorized. It is not a one-file UI fix: three cross-layer protocol files, gate,
panel and route need coordinated review; SQL guards/ACL and real two-session recovery
need a later execution lane. No calendar or runtime claim is inferred. Existing four
installers and Foundation are not edited by this task or implicitly authorized future work.

### Decisions actually needed from the product owner

* **D-CHK-DURABLE:** approve this v2 checklist extension of the same Operations C03
  family and fail-closed legacy direct-writer cutover, including blocking later work
  while a checklist command is unresolved. Recommended: yes. Cost: coordinated above
  package and separate SQL/ACL/PG execution gates. Alternative: retain the explicitly
  limited current UNKNOWN behavior and keep full staging recovery acceptance open.
* **Technical-test scope — D-OPS-RETENTION / D-OPS-ABANDON:** the previously
  approved test-account/test-data policy remains **CLOSED_OWNER_POLICY_SCOPED_TEST_ONLY**.
  This proposal does not reopen or replace that decision and does not extend its scope.
* **Public/real-user-data retention and abandonment:** an explicit owner decision
  is still required, including checklist notes in exact server wire and browser
  recovery storage. The technical-test decision above does not authorize production
  or real-data retention, expiry, cancellation or tombstone behavior. Recommended
  safe proposal: no automatic expiry/purge or abandonment; minimize exposed summaries
  and use original-authority lookup. Privacy/storage duration and any authorized
  cancellation/tombstone policy require owner approval; CE/Building decisions are
  not inherited. No TTL, purge or automatic abandonment is implemented here.
* **D-CHK-LEGACY-UNKNOWN:** past keyless requests cannot gain a retrospective receipt.
  Recommended cutover: no silent migration or GET-based clearing; an authorized
  explicit human workflow may accept current evidence for subsequent work only under
  a separately approved policy, without claiming the old POST committed. Until then
  legacy unresolved work remains a limitation. A silent local remount is not closure.

Version2, shared namespace, resource choice and exact-byte hashing above are concrete
engineering recommendations, not extra product questions. No table or evaluator
replacement is proposed; all new facade/caller details remain unapproved source work.

## 4. Acceptance and evidence levels

For the implemented receipt delta: after valid canonical lookup+exact ACK, the six
action summaries reach the real consumer and neutral UI. The hook exposes only
`{action, outcome, recorded_at}`; the full canonical receipt stays private. Before ACK, on pending, invalid actor/
Context/result, mismatched ACK or current deny, there is no summary. Same-Workspace
and foreign-Workspace Context switches, late callbacks, foreign-original reconciliation,
empty-storage remount, rejected outcome and RO/FA copy are covered. No modeled duplicate
write/audit/outbox or current-state GET is used as a receipt. The historical260-3
preimage probe reproduces the earlier missing display. The277-1 preimage probe
reproduces the excessive full-receipt exposure in260-3. The affected `--receipt-only`
mounted suite enumerates the whole hook value and exact summary keys, including
committed/rejected recovery, deny, late lookup/ACK and independent summary mutation.
The default suite retains the separate checklist counterexamples below; they are
not rerun as part of this focused receipt correction.

Checklist proposed acceptance: before/after-commit lost ACK; remount/reload/cleared
storage/new device; two tabs/actors; same key/same wire replay and changed body conflict;
different item/order/tenant/Workspace; revoke/AAL1/current original authority; receipt
forgery/false absence; exact current item binding; timeout/cancel; transaction rollback
of item+domain audit+command audit+outbox+receipt; unknown COMMIT reconciliation; no
legacy RPC bypass or default ACL delta. Old v1 wires/hashes/receipts must stay exact;
an unknown v2 pending command must block v1 admission. Privacy/retention/cutover owner
decisions and separately granted runtime lane remain prerequisites.

New checks use actual TS/React/Next source with explicit fake Auth/transport/persistence.
They prove source wiring and counterexamples, not SQL compilation, PostgreSQL locking,
issued Auth, a browser session, real receipt persistence or staging readiness. The
delivery manifest records actual results, apply/reverse identities and NOT_RUN lanes.
No existing successful suite is rerun. NULL execution bindings/default no-execute and
all existing runtime/install/policy holds remain. No artifact transfer is authorized yet.
