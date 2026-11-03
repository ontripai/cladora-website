# V14-CE011-EXEC-01 — seven Event commands, source-only

Owner: CLADORA CE / CLADORA-CE-WORKER-01. PM205-C.
Input: BASE `8c8225fb3297035a2349357bd968d60779388063` plus accepted48
patch `60d0b97a4cf231332e9711a126cb859957dce77b` and manifest
`453ae7da6fe79332cd2fea1fe083d482b595c589`. No main/PR474/Public18 or
upgraded dependencies. This is a source candidate, not installed/live Backend.

## Existing consumer and authority

The existing `src/app/[lang]/app/community/events/page.tsx` already mounts
`CustomerEventInterestPage`; no navigation, menu, feature switch, activation or
route was invented. The real page now supplies create and correction forms as
well as the existing five actions to the same authenticated HTTP handler.
`event-interest-schema.ts`, `event-interest-domain.ts` and all SQL remain unchanged.
The existing `ce.event.basic`/`community_events` model is independent of Community,
Guide, capacity, BK01, tickets and payment. Interest reserves nothing and grants no
admission; RO/EN/FA text and RTL retain this boundary.

UI create visibility consumes the server dashboard `events.event.publish`
permission, the SAME mapping as existing domain/proposal create. Correction
consumes the distinct `events.attendance.correct` dashboard permission. Event
projection flags gate the five original controls and named eligible participant
choices. Client flags/permissions are affordances, never authority.
GET/POST retain request-scoped `getClaims`, strict UUID tuple, strict command
schema, trusted origin, JSON media type, 16KiB body cap and private/no-store/Vary
headers, including body-limit failures. No role/service-role credential is used.
`customer_api.command_ce_event_v1` resolves actor, tenant, membership, represented
party and exact permission from the current server context. No caller boolean,
actor ID or client permission enters the command. Unexpected failures are bounded;
raw server error text never enters UI feedback.

## Seven real form/action flows

| Command | UI and canonical inputs | Existing permission | Confirmed result |
| --- | --- | --- | --- |
| create_event | Named title, explicit UTC start/end, IANA timezone, reason; generated Event/occurrence IDs, workspace audience, community_ref=null, expected_version=0 | events.event.publish | event, submitted Event ID, v1 |
| publish_event | Selected Event and its exact read version | events.event.publish | event, same Event ID, expected+1 |
| cancel_event | Selected Event and its exact read version | events.event.cancel | event, same Event ID, expected+1 |
| register_interest | Selected Event/version and self interest version | events.interest.manage_self | event_interest, interest expected+1 |
| withdraw_interest | Selected Event/version and current positive interest version | events.interest.manage_self | event_interest, interest expected+1 |
| record_attendance | Named server-eligible participant; local observation and Event timezone; Event version | events.attendance.record | event_attendance, v1 |
| correct_attendance | Most recent attendance receipt for this Event confirmed during this page lifetime; current named roster binding; exact attendance version, attended flag, local time, reason (12 chars after cancellation, otherwise5) | events.attendance.correct | same attendance ID, attendance expected+1 |

No user types a UUID. Attendance correction does not infer record permission from
correction or vice versa. The current server projection supplies a roster ONLY
while record permission is present on a published Event; limitations below remain
NOT_READY. A latest confirmed attendance record, not an arbitrary UUID, supplies
the correction target. The visible target is bound to the current named roster.

## Strict result ABI, separate from current reads

`supabase/proposals/ce_011_event_interest_operational_v1.sql:297-306` emits exactly
`{entity_type, entity_id, version, command, replayed}`. The route and client enforce
this exact shape and correct per-command version progression; create/publish/cancel
bind Event ID, correction binds attendance ID. NULL, partial/extra fields,
wrong command/entity/type/known ID/version and invalid replay flags are rejected.
The SQL-generated interest/attendance IDs have no submitted known ID on first
write; only a strict UUID can be checked there. The HTTP response is associated
with the exact submitted request; this package does not invent a stronger signed
receipt/COMMIT proof or claim PostgreSQL rollback/race evidence.

GET validates the existing bounded projection, exact Workspace, unique Event IDs,
positive versions, valid timezone and time order; private/partial/foreign results
fail closed. A valid command result is displayed separately from the following
current read. A failed current read cannot erase or negate a valid command receipt.
A current interested state is never promoted into proof of the pending command.
Malformed RPC success becomes HTTP502/UNKNOWN, never a synthetic success.

## Admission, ownership and recovery

One actual-page session per context/membership/Workspace owns synchronous admission
across create, Event actions and attendance. Role/permission refresh does not give
an unknown request a new session/key. Admission is revoked synchronously on refresh
and in layout cleanup on Context/Workspace/locale/loading/permission replacement.
Edit and submit handlers consult that synchronous gate, not only disabled DOM or
React state. The input is validated once, cloned/deep-frozen and encoded once;
replay sends the same wire, IDs, key, expected versions and body. No automatic POST.

Each dispatch captures one commit owner. Response, JSON decode and finally are
fenced; timeout/cancellation cannot prove server cancellation. A discarded owner's
response cannot publish success, update another Context, erase pending or unlock
a newer operation. GET generations fence out-of-order reads after decode too.
Actual page unmount cancels owned deadlines; requests ignoring abort remain unable
to update UI. Named form drafts are retained in the scoped page session across
read errors and component replacement. A valid read is required before admission.
Denial hides previous private Event details. Submitted inputs/wire remain scoped
in memory, not displayed as an authorized old private read.

Network/lost reply/5xx/408/429/malformed success are UNKNOWN. Refresh is a read only
and cannot erase UNKNOWN or generate a new key. An explicit button truthfully
re-sends the SAME request: existing command replay reauthorizes and returns its
receipt if present, and may apply the command if absent. It is NOT advertised as
a read-only lookup. Fresh 400/401/403/404/409 rejections remain distinct; only a
non-uncertain rejected command can be explicitly released for editing after a
valid current read. A rejection following UNKNOWN keeps uncertainty/pending.
Drafts and pending survive Context return within the mounted page. Actual page
reload/unmount/new device do NOT have durable recovery; no browser store or new
ledger/protocol was added.

## Precise producer gaps — CE domain ownership, Core shared-seam review

| Gap / exact existing source | Domain owner, consequence and required producer delta |
| --- | --- |
| CE011-G1: proposal lines309-343 read_ce_events_v1 has no attendance rows or correction-specific named roster; lines329-338 emit eligible_attendance_members only for record permission and published Event | CE owns community.event_attendance, SQL/RPC/read shape/UI. Core reviews C01/currentness/shared identity and safe-label disclosure. Correction permission does NOT imply events.event.read; an explicit read profile is required.  Selecting an older attendance record, correction-only users, and correction after cancellation are NOT_READY in the consumer. Need authorized bounded attendance ID/version/Event/occurrence/member/safe-label projection under events.attendance.correct, including permitted post-cancellation correction; no raw UUID input, guessed can_correct flag, duplicate RPC or client positive grant is supplied. Current same-page record→correction works with current named roster and independent correction permission. |
| CE011-G2: proposal command function lines194-306 and existing route have no read-only command receipt lookup | CE owns community.event_command_receipts, Event canonical key and domain lookup. Core reviews C03/tuple/fingerprint/current authority/retention seams only. Absence or absent-unproven is NOT evidence of non-COMMIT.  UNKNOWN recovery is explicit exact-command replay with potential effect, never a fabricated GET lookup. Durable reload/device reconciliation requires an owner-defined authorized read-only lookup/retention/binding contract; not implemented in SQL here. |
| CE011-G3: proposal lines297-306 return only five result fields; request/tuple/subject/version proof is internal to RPC receipt | CE owns domain receipt/response version; Core reviews common C03/currentness/COMMIT seams. No new attestation/signature/self-proof or ABI field is added.  Client cannot independently prove tenant/actor/request/hash binding or actual COMMIT from extra nonexistent result fields. Existing server path and exact HTTP invocation consumed; actual database proof remains NOT_RUN_NOT_PASS. |
| SQL proposal is read-only source, existing execute ACL closed until authorized installation | Missing RPC maps503/NOT_READY; no product readiness, role grant or installation claimed. |

These block only the listed producer-dependent branches. No community/Guide/BK01
or valuation dependency was introduced. A separate Core producer artifact A was
not necessary or substituted with an always-allow port for these existing Event
RPCs; exact source contracts above were reused.

## Offline evidence and finish

`test-ce-011-event-page.mjs` retains existing strict projection/schema/version,
named labels, navigation/access-matrix and SQL-source projection assertions. Its
mounted baseline now calls the actual page, ContextProvider and GET/POST handler
with a fake DB boundary, not an `{ok:true}` fake-success response.
`test-v14-ce011-seven-commands.mjs --commands-only` exercises seven real mounted
commands in EN/RO/FA, result-oracle negatives for each command, distinct permission
denials via the actual handler + actual domain evaluator, lost reply/replay after
revoke, stale409 with explicit new-intent reset, pre-render edit/action/refresh
admission, foreign/null/partial results, loading/locale/Context/unmount late JSON,
timeout and pending Context return. These are synthetic DOM and fake transport/DB
only. Domain application is used as a fake-DB adapter; SQL atomicity, RLS, race,
real Auth/HTTP/browser/DB/COMMIT/rollback are NOT_RUN_NOT_PASS.

Existing installed dependencies only. Canonical TypeScript with original ES5
config, scoped lint, both MJS syntax and exact seven-path BASE patch apply/output
readback/reverse are recorded in the delivery manifest. No accepted48 notice,
codec/guard/R4 suites repeated. Patch replaces COMPLETE seven outputs on verified
input48; it is BASE-relative, not blindly stackable over an existing overlay.
No install, container, query/SQL parser/compiler/runtime, config/credential/GRANT,
commit/tree/branch/ref/Push/PR/Merge/CI/deployment/Production/activation was performed.
Independent Core/PM functional/ABI review remains pending.


## PM212 successor — CE208-CF-01 / CE208-CF-02

CF01: every refresh/restart, accepted-command reload callback, denial and layout
owner invalidation increments the read epoch synchronously BEFORE scheduling
render. Passive setup also takes a new epoch. Cleanup invalidates only its own
still-current read; an old cleanup cannot invalidate a newer epoch. Response,
JSON decode, and functional state commits recheck epoch/view ownership. An old
GET cannot set data or reopen admission after a newer refresh, even before
passive cleanup; relying only on abort/readAdmission=false is insufficient.

The mounted regression invokes the actual mounted refresh callback from the real
button's React props in the same transition as a real parent's state update.
This keeps one transition lane (a DOM click would create a separate discrete
lane). It does not replace any product hook, effect, React/Scheduler method or
consumer implementation. A bounded12ms parent-layout scheduling fixture forces
a normal Scheduler yield. The trace MUST prove layout → drained stale response/
JSON continuation → parent passive cleanup. MutationObserver checks active,
non-hidden headings during this interval, not merely after cleanup. Response and
JSON variants, one/two consecutive refreshes, retained UNKNOWN and captured real
old submit callback admission are covered. New current read returns403. A later
valid read plus explicit replay must preserve the original wire.

CF02: eventUuidKey/sameEventUuid validate the existing UUID grammar before
canonical identity comparison. The key may index a UI/session/attendance/draft
map or compare Event/member/Context/Workspace/result binding; it never transforms
any submitted command/UUID, serialized body, key, version or pending snapshot.
The route accepts typed-UUID-equivalent read/result identities; the existing
strict five-field shape and actual foreign/malformed/type/version denials remain.
Canonicalization is NOT added to the domain fingerprint or SQL. The tests hash
the immutable wire bytes and check exact original RPC arguments; they do not
claim to execute PostgreSQL's JSONB fingerprint algorithm.

Fresh/replay create/publish/cancel/correction case-equivalence and explicit session
replay use controlled typed-UUID result envelopes at the fake DB boundary only;
these do not replace the domain engine or prove RLS/permission/persistence. The
unchanged actual seven-command positive flow and affected lifetime/denial guards
are selected, not the whole29-group predecessor suite.

External shared boundary (unchanged, not bypassed):
CustomerContextProvider.tsx:133-134 still selects active/dashboard by exact strings.
If its own contexts/activeId/dashboard.contextId spellings disagree only by case,
it may withhold the Context/dashboard before this CE consumer sees the tuple.
The seven-path scope cannot recover an object that the provider withholds.
CE accepts valid equivalent tuples at ALL its own Page/client/handler boundaries;
end-to-end acceptance through such a withheld shared projection remains NOT_READY.
Owner of a possible shared-provider change: shared CustomerContextProvider
maintainer, to be explicitly assigned by PM (Core reviews common identity seam).
No shared provider change, guessed Context, new API/SQL/lookup or positive grant
is supplied here. This is separate from CE-owned G1/G2 and five-field G3 limits.

Successor source remains uninstalled; independent delta review and all real
PostgreSQL/Auth/HTTP/browser/COMMIT proofs remain pending/NOT_RUN_NOT_PASS.
