# PROCEDURE 253-4 — real Operations UI and staging acceptance

Status: **LOCAL_SOURCE_DELIVERED / STAGING_RUNTIME_NOT_RUN**. This document is an executable manual acceptance procedure for an authorized staging run, not a runtime receipt. `/demo` is excluded. All account, equipment and command references below are approved test-fixture bindings, not records created by this document.

## Exact source and ownership

Use BASE `8c8225fb3297035a2349357bd968d60779388063`, then these artifacts in this order:

| Layer | Patch | Manifest |
| --- | --- | --- |
| Core236 full candidate | `15fdf8e9fcf3b2d0bc2f00ff641993cc96f23cf5` | `ba425cec89daedb5aea15206762f46acd63d4700` |
| CE238 delta | `3659e40bc82b168c1920d2717ca3240577af06be` | `498353226bae4fb0c24fb65108e98a9d1096df59` |
| CE239 delta | `41efbbe32fe9bcb8cbe448449d693087d46c65db` | `8c3840c347c9239fa85be8dea47a397d34724866` |
| PROCEDURE240 delta | `a1932dbfdee8625fc9e8ec0baff17d4958152c04` | `78bcbd6dc99ac28e4767750899d6dc0862290de3` |
| This task | Local six-path UI/test/document delta | Local delivery manifest |

The input composition has 2279 canonical files. Four editable preimages were pinned before editing; the new test and this document were absent. Core242+ runner/installer work is an external installation dependency, not an extra UI baseline layer. Do not stack older fullpatches or use local main/demo as a substitute.

PROCEDURE owns this delta in CustomerMaintenanceDashboard, PreventiveMaintenancePanel, WorkOrderLifecyclePanel, the app maintenance page, its new focused test and this document. API routes, schemas, WorkOrderChecklistPanel, OperationsCommandGate, command codec/client/server, Auth, ContextProvider, shell, dependencies, Building and installers are read-only.

## Existing path and contracts

| User action | Existing consumer | Existing API/effect |
| --- | --- | --- |
| Select approved building/equipment | `/[lang]/app/assets`, CustomerAssetsDashboard; EquipmentRegistrationPanel if separately authorized | assets registry routes; no demo store |
| Select approved contractor | `/[lang]/app/vendors` | existing procurement registry; no local grant |
| Open maintenance plan | `/[lang]/app/maintenance?view=plans`, PreventiveMaintenancePanel | GET `/api/customer/v1/maintenance-plans?context_id=...` → `list_calendar_plans_v1` |
| Save/generate plan occurrence | existing shared OperationsCommandGate | POST `/api/customer/v1/operations/commands`, existing `operations_command_v1` phases open/lookup/reserve/execute/ack |
| Open generated order | issued history's “Open work order”; `?work_order=<approved ID>`; WorkOrderLifecyclePanel | GET `/api/customer/v1/maintenance?context_id=...&view=work_orders&id=...&limit=1&offset=0`; matching row/detail required |
| Issue/start/complete/verify | WorkOrderLifecyclePanel through the same shared gate | existing command intent and receipt; **do not use the closed legacy mutation routes** |
| Record required checklist | WorkOrderChecklistPanel, unchanged | existing GET/POST `/api/customer/v1/work-orders/[id]/checklist` → `work_order_checklist_v1`; separate contract, not a new operations receipt |
| Observe current history | `/[lang]/app/maintenance?view=history` | existing maintenance reader `get_maintenance_v1`, history view |

Existing transitions only:

- save/generate plan intents use their current revision/occurrence rules;
- issue: draft or scheduled → assigned, to the recorded contractor;
- start: assigned or blocked → in_progress;
- complete: in_progress → completed, with required checklist and canonical completion input;
- verify: completed → verified under current granted authority.

Do not invent a separate assign command, vendor reassignment, close/payment action, receipt type or permission. Completion and verification are not an invoice, payment or financial close. A historical receipt proves the recorded command outcome only; current authority and current record readback remain separate.

## Delta behavior

- A closed/unconfirmed command or Context gate shows an unconfirmed state instead of claiming an empty canonical list.
- Plans immediately hide previous private details when readiness closes. Reads and writes remain fenced by the existing committed readiness and command owners; pending keys/wire are not recreated.
- Plan copy distinguishes unsaved panel edits from shared durable command reconciliation. It no longer says the command's recovery evidence is necessarily lost on reload.
- Work-order sending, canonical-reply/current-readback and final confirmed observation have distinct messages. Deny and revision-conflict messages use only the existing canonical rejection codes. A settled failure is not labelled as perpetual loading.
- The current history view can be opened and reloaded through its real route. Order deep links still take priority and invalid order IDs remain rejected.
- Detail dialogs receive focus, contain Tab/Shift-Tab, close on Escape and return focus to a connected opener. No force-click or global overflow hiding is used.

## Before any staging run

Every item below is BLOCKED until actually supplied and checked. This task performed none of the installation or Auth actions.

1. PM/Core/Platform provide the approved installed source binding, installation acceptance, environment identifier and health. A source artifact or local TypeScript success is not installation proof.
2. Auth/authority owners provide approved test accounts via the official sign-in flow, with current Context/membership/Workspace/action permissions and MFA where the existing contract requires it. No passwords or tokens go in this document or result evidence.
3. Bind building A and building B to approved Contexts, equipment, contractor, due plan and required checklist. Preserve the distinction between two buildings in one Workspace and separate cross-Workspace/cross-tenant negative fixtures.
4. Use operator and verifier accounts with only the actual approved grants. A separate account does not itself prove independence or permission; do not add a new policy requirement unsupported by the contract.
5. The owner-approved browser/fault adapter must bind exact session, command and fault phase. Without that adapter, network-loss/concurrency cases are NOT_RUN/BLOCKED. Do not install or improvise a new runtime adapter here.
6. Confirm the existing supported cleanup/retention procedure with the fixture owner. Do not reset SQL, delete receipts/history/audit or reprovision to hide a failed case.
7. Set `lang=ro` first; repeat affected scenarios in en/fa, with desktop and390px and RTL. Keep account/session A/B distinct in the evidence.

## OPS-UAT-01: normal canonical journey

1. Sign in to approved staging normally. Select building A through the existing Context selector; verify the displayed scope and approved fixture identifiers.
2. Open `/ro/app/assets`; locate the approved active equipment by its code/name/building. Do not register or seed equipment as an implicit prerequisite.
3. Open `/ro/app/maintenance?view=plans`. Select that equipment and the approved contractor. Review the existing suggested template and required checklist. Use only approved due dates/periods.
4. Save once. Capture the existing command key, exact wire/fingerprint, target and canonical outcome through the approved evidence adapter. Verify reserve/execute/ack and then the canonical list result. A matching row or local storage is not a receipt.
5. Generate the approved due occurrence once. Open its issued work order from plan history. Confirm exact order identity and draft state; generation does not imply dispatch.
6. Issue to the stored contractor; observe assigned. Start only when the canonical current status is assigned/blocked; observe in_progress.
7. Record each required checklist result using the existing form and note constraints. Before all required results are confirmed, completion must remain blocked.
8. Complete with approved notes and actual cost; include the explicit zero-cost fixture where designated. Verify under the currently granted verifier account.
9. Reload the exact order link and open history. Compare current status, dates and authorized records with canonical readers and the matching operations receipt. Do not invent a history event count or treat history alone as command proof.

PASS requires one permitted effect per command, no unsupported transition, and current authoritative readback. If history linkage cannot be established from existing authorized fields, record a Core reader dependency rather than inventing a field or receipt.

## OPS-UAT-02: lost response and reload

Repeat only separately authorized fault cases: before reservation acknowledgement, after reservation, after execution, and during ACK. Record the exact point and observed terminal state; do not blindly resend an ambiguous connection.

1. Lose one approved response. Retain original key/wire/fingerprint; UI must show pending/UNKNOWN and withhold success/next-step admission.
2. Reload in the original account/Context. Use “Reconcile command”. No new mutation or key may be generated automatically.
3. A matching committed/rejected receipt followed by the existing ACK resolves the command. Pending/absent may permit only the existing explicit exact retry under current authority.
4. A maintenance GET alone must not clear UNKNOWN. If the original command belongs to another Context, return through the authorized existing selector/link before any retry.
5. Confirm one matching effect for the occurrence and original command identity. Missing proof remains UNKNOWN, not PASS or inferred failure.

## OPS-UAT-03: two sessions

Use two independent approved browser sessions for the same authorized actor/Context; use a second approved actor as a separate case only if the existing reservation contract permits that comparison.

1. Open both sessions before sending. Race one approved action through the authorized adapter; retain each exact command identity.
2. Observe the existing server reservation/conflict rules. A navigator lock is not proof of server-wide exclusivity across devices.
3. Reconcile each session after canonical execution/ACK. Do not invent a lease duration, discard a pending command because a row looks current, or create a fresh retry key.
4. PASS requires existing uniqueness rules and matching receipts, with no duplicate occurrence/effect. Any unknown lock/connection settlement remains UNKNOWN and is escalated without reset.

## OPS-UAT-04: two buildings and stale continuations

1. Bind approved building A/B Contexts and distinct records. Delay an A list/detail/history response, switch explicitly to B, then release A.
2. Repeat while a plan/order/checklist action is pending; also close/reopen detail during a delayed response.
3. No A names, IDs, notes, cost, history or action may appear under B. An older read/write/finally must not clear B pending or operation ownership.
4. Return to A and reconcile its exact original command. B current records cannot resolve A UNKNOWN.
5. Repeat with an account that lacks B access using the separately approved negative fixture. A URL or selected label must not confer access.

Current source-only asset-list reproduction is recorded below; therefore this whole cross-building journey is not already accepted by this UI delivery.

## OPS-UAT-05: deny, revoke and expiry

Auth/authority fixture owners perform the separately approved grant change, not this scenario script. Refresh and attempt current reads and a permitted-to-test command/replay. Old private details must disappear; unresolved command identity remains retained but does not authorize a new action. Restore a grant only through its official workflow and explicitly re-read/reconcile. Preserve independent ownership rights where the fixture specifies them. No runtime evidence exists yet.

## OPS-UAT-06: checklist UNKNOWN boundary

Lose an existing checklist POST response with the approved adapter. Preserve open-panel notes, block duplicate posting and premature completion, and read current checklist state separately. This API has no operations command key/lookup receipt in the current contract. Do not present a current checklist as proof of that exact earlier request. Reload/close limitations remain explicit. If durable request-level recovery is required, Core must decide the existing contract's supported behavior; no new receipt/RPC is fabricated in this UI delta.

## OPS-UAT-07: locale, focus and responsive presentation

Check RO/EN/FA and RTL in desktop/390px. Open detail with keyboard, Tab/Shift-Tab inside it, close with Escape and verify focus return. During pending commands change locale and Context through supported controls. No automatic send, lost original identity, stranded busy or stale continuation admission is allowed. Pending, failed, denied, UNKNOWN and observed-current text must describe the actual branch. Confirm reading/focus/scroll visibility in an actual browser when staging is authorized; JSDOM alone cannot establish layout.

## Dependencies and closure owners

| Item | Existing path / owner | Evidence and closure |
| --- | --- | --- |
| Asset registry cross-Context response race | `CustomerAssetsDashboard.tsx`; Core/Registry domain owner and PM for UI allocation; outside this grant | Mounted actual reference component with fake transport: hold A response, render B, accept B, release A; A replaces B. Owner must fence list and detail/inspection/warranty continuations to committed Context/membership, hide data on readiness/deny, and supply cross-scope regression. No asset file edited here. |
| Shared command recovery receipt presentation | `OperationsCommandGate.tsx`, operations-command client/server; Core | The gate retains/validates the canonical receipt but does not expose it in the current consumer interface after ready. If explicit recovered-command confirmation is required, Core must provide an authorized existing-receipt summary in its own gate/interface, separate from current record display. No new authority or receipt type. |
| Checklist durable unknown recovery | `WorkOrderChecklistPanel.tsx`, checklist route/schema; Core/Operations | Existing checklist POST is separate from C03. Close with an approved existing-contract decision and matching lifecycle tests; never invent a lookup/receipt. |
| Staging installation / current grants | Core/Platform/Auth | Exact accepted install/environment/account/fixture evidence and separate runtime authorization. Runner/installer242+ are not overlaid into this UI task. |
| Context readiness / membership | `CustomerContextProvider.tsx`, Auth/Core | Current validated Context/dashboard and access-loss/expiry evidence in real staging. Provider/shell unchanged here. |

## Local evidence and execution commands

In the exact assembled source using already installed dependencies:

- `node scripts/test-procedure-operations-journey-253-4.mjs --probe-preimage`: reproduction of pinned preimage defects; requires the local preserved preimages, not a product execution mode.
- `node scripts/test-procedure-operations-journey-253-4.mjs`: focused mounted UI regression; fake command gate/transport explicitly, real components and validators.
- `node scripts/test-operations-app-journey.mjs`: unchanged accepted integration harness; actual UI and Next handlers, fake RPC/Auth/C03 persistence. Its historical task label is retained, not rewritten.
- Canonical TypeScript, scoped ESLint and Node syntax checks use the existing toolchain only. Zod available locally4.4.3 is not a target4.6.6 execution claim.

The delivery manifest records actual exit codes, source pins, test counts and apply/readback/reverse. No browser/server, SQL, DB, issued Auth, staging account, installation, env mutation, Push or deployment was run for253-4. Every staging case above starts NOT_RUN. PASS needs exact installed source/environment binding, approved accounts and fixtures, actual browser actions, canonical readbacks and existing receipt evidence where the contract provides one. Keep observed and owner-reported evidence separate. A missing dependency or unknown response is BLOCKED/UNKNOWN, never a successful product journey.
