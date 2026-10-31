# CE253-3 — canonical notice journey

Owner: CLADORA CE / CLADORA-CE-WORKER-01. Source delta only, independent
review required. Program: accepted v1.4, existing official Communications
notice contracts. This does not replace the separate CE010 Community aggregate.

## Exact input and scope

Core236 fullpatch `15fdf8e9fcf3b2d0bc2f00ff641993cc96f23cf5`, manifest
`ba425cec89daedb5aea15206762f46acd63d4700`, followed by accepted CE238,
CE239 and PROCEDURE240 deltas. BASE is
`8c8225fb3297035a2349357bd968d60779388063`. No demo source is used.
Core242 changes installer order and remains outside this CE delta; the four
installer files and shared dependencies are untouched. No commit/ref is made.

Changed: the CE dashboard component, one new mounted journey test, two
transport-selection conditions and per-case selection in the existing CE
composer test, and this document. No product change to API routes, codec,
guard, storage engine, SQL or shared ContextProvider.

## Reviewable user path

1. Open `/{en|ro|fa}/app/communications` with a current server-selected Context.
   An existing manager creates an official notice. Choose the existing
   recoverable-save option explicitly; the legacy path remains available under
   its accepted local inventory/protocol restrictions. Nothing auto-selects it
   after a durable failure.
2. Submit the form once. Its synchronous gate and immutable snapshot feed the
   existing durable route, guard, codec and official command RPC. A second
   simultaneous event cannot dispatch a second command. The existing canonical
   receipt supplies `notice_id`; no ID, hash or receipt shape is manufactured.
3. Matching completion closes the composer and presents **Open saved draft**.
   The same handoff is used for explicit receipt recovery and exact retries.
   The message says the save result does not confirm publication or delivery;
   an old receipt is not a claim about the notice's current lifecycle state.
4. Open saved draft switches to the official-notice view, resets local list
   filters/pagination and selects only that canonical ID. Its body and current
   status must come from a fresh existing detail GET, never the submitted
   snapshot or a fabricated list row. Failure, denial or a foreign notice ID
   cannot reveal the saved body or create another draft.
5. A lost reply remains UNKNOWN. Close/reload retains metadata only. Reopen the
   composer and explicitly check the existing lookup. A matching committed
   result enables the same handoff without another POST. An authorized absence
   enables only explicit retry of the original key/hash; after reload identical
   text re-entry is required. Conflict/expiry cannot rotate a key or clear
   evidence. Erased storage/new devices are not guaranteed duplicate-free.
6. Existing approval and publication buttons retain their existing HTTP/RPC
   contracts. Publication fixes the recipient list; it does not prove delivery
   or receipt acknowledgement. An authorized recipient uses the existing list
   and detail path and sees the canonical flat `my_acknowledgement` if one
   exists. Reading an existing receipt does not POST another acknowledgement.

## Local currentness and security boundaries

The CE parent and composer now include the existing server-projected
`dashboard.workspace_id` in their local identity alongside Context,
membership and role. A changed Workspace cannot resurrect a saved handoff or
let a late composer callback navigate into another Workspace. A layout fence
checks parent callbacks against the current tuple. This is UI fencing only;
it does not grant permission or repair the shared Provider's authority model.
Existing read, denial, pending, lifetime, keyboard, RTL and unsaved guards remain.

No cached command receipt authorizes a detail read. Existing HTTP handlers use
the request client and existing RPC authority. No service-role client, role,
entitlement, table, RPC, receipt type or permission is added. Missing durable
RPCs remain bounded UNKNOWN/unavailable; there is no automatic legacy fallback.

## Evidence and limitations

`test-ce-notice-canonical-journey.mjs` mounts the actual page with the actual
ContextProvider and executes existing command/lookup/list/detail and explicit
approval/publication handlers. Only the Auth/RPC boundary is replaced. Its
fixtures, role/audience decisions, committed effects and cross-remount Map are
test oracles, **not real persistence or authorization** and not a new demo.
It includes a before/after original-component witness, EN/RO/FA, one-command
dispatch, canonical target reads from another view, reload/UNKNOWN, exact retry,
denial, malformed/foreign replies, Workspace drift/late reads and an existing
recipient acknowledgement. Root unmount disposes the real controller and reads.

The old composer harness's `--connected` selection also includes CF01 cases.
Its previous fetch branches used only the `--cf01` flag, so the selected cases
did not reach their required actual legacy handler or bootstrap fault fixture.
The branches now use the current case's CF01 classification. Every assertion,
expected result, negative and normal-mode fixture is retained.

No target installation is performed. Local installed Zod4.4.3/Next16.3.8 are
supporting offline evidence only; target Zod4.6.6/Next16.4.1 execution is NOT_RUN
in CE. Earlier target results belong to Platform and are not rerun or relabeled.
Actual SQL/PostgreSQL/Auth/AAL/session/revoke/browser/persistence proof is
**NOT_RUN_NOT_PASS** for this task.

## Dependencies and exact closure

| Dependency | Owner | Closure evidence still required |
| --- | --- | --- |
| Accepted R4 command/lookup packet and product integration | CE owns domain ABI/source; Core owns composition; Platform owns any separately authorized installation | Integrate the accepted sealed R4 packet without changing ABI or ceiling, verify exact physical callable command/lookup signatures and current source identity. Core236 does not itself contain the separate R4 SQL files; do not interpret the present UI route as proof they are installed. |
| Canonical receipt/persistence | CE domain + Core transaction/currentness contracts, Platform authorized proof | Real same-key replay, lost COMMIT reply, lookup, immutable receipt/correlation and rollback checks, with zero second effect and current binding; offline Map is insufficient. |
| Auth and live authority | Core/Auth owner | Issued session, current membership, AAL, expiry/revoke and read/mutation authority re-evaluated by official RPC; browser projection/getClaims alone is insufficient. |
| Shared ContextProvider | Core shared UI owner | Same authoritative Context/member/Workspace projection, no stale projection after switch, late bootstrap or denial, and case-consistent UUID identity. CE consumes it and adds a local fence; shared source is unchanged. |
| Recipient visibility and acknowledgement | CE owns notice contracts; Core supplies authority/RLS/currentness; Platform supplies authorized runtime | Real list/detail enforce current Workspace/target/audience, draft exclusion and revoke/isolation. Existing detail SQL resolves actor and selects notice by tenant; this source shape alone is not proof of every Workspace/recipient condition. Current actor/RLS/target behavior must be verified against accepted R4 and existing domain contracts, not replaced with guessed permissions. Show only the current canonical flat acknowledgement; no automatic resend. |
| Publication/delivery | CE existing notice workflow; delivery owner for external channels | Real approved publication and fixed authorized recipients under existing RPC. External delivery/receipt outcomes require their own actual evidence; this task sends no notification/email. |

These are bounded integration/runtime gates, not new source/API/activation
authority. Backend packet adoption or a discovered predicate mismatch must use
the existing owner/contract review path; SQL, installation, Auth and shared files
are not silently repaired here. The source delta is reviewable independently.

Latest external evidence read before handoff: Platform252-1, Issue463 comment
6476092556, stopped in foundation with SQLSTATE42P01 for the absent
`platform.workspace_property_bindings` relation. Later installer units and
rollback/residue verification were not proved. Core owns that foundation
dependency/order closure; Platform/SERVICE own the missing error/rollback ACK
evidence. Neither the earlier lab startup nor these CE offline tests establish
an installed or usable program backend. No retry or installer repair is made here.
