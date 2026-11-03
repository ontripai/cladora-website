# CE011 G1 — named attendance projection

Task: `V14-CE-01 / CE011-ATTENDANCE-PROJECTION-03`.
Owner: CLADORA CE / CLADORA-CE-WORKER-01.
Parent: `47d1be3fc9ac8d8ca617e345f244c50a5d1fdc68`.
Branch: `codex/program-ce-independent-base-02`.
Assignment / baseline admission:
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573312055

This is an inactive read-projection source candidate and connected **controlled**
consumer. It is not an installed RPC, native PostgreSQL/Auth/ACL proof or
activation. The accepted seven-command source, its exact-lock35 and official
same-SHA Next16.4.1 build/TSC evidence are consumed unchanged, not replayed.

## Additive ABI and authority

Existing `read_ce_events_v1`, its strict JSON schema, all seven command/receipt
schemas, domain lifecycle and command-session/recovery engine remain byte-equal
to parent. The new additive boundary is:

- GET `/api/customer/v1/community/events/attendance`;
- proposed `customer_api.read_ce_event_attendance_v1(uuid,uuid,uuid,uuid,integer,integer,uuid)`;
- response `contract=ce011-attendance-projection.v1`, `version=1`.

Request binds current Context, Workspace, Event, occurrence, expected Event
version, limit1–50 and nullable `after_attendance_id`. UI page size is25. Duplicate
or unknown query parameters, missing/malformed identities and invalid bounds
are rejected before the DB boundary. There is no actor/role/permission input.

Response strictly echoes that tuple, Event version/status, occurrence timezone,
order=`attendance_id.asc`, limit, after cursor, nullable next cursor, and bounded
targets. Each target has exact attendance ID/version, membership ID, current
authorized display name, attended state and recorded local time. No tenant,
user ID, role, contact data, receipt or private metadata is released.
The existing occurrence table has no version column: occurrence identity and
its timezone are bound to the exact Event/version; no invented occurrence
version is supplied. Per-attendance version remains a separate optimistic guard.

| Existing authority | New historical-name projection | Existing action affordances |
| --- | --- | --- |
| read + correct, without record | Allowed only for current actor/target audience and published/cancelled Event | Historical correction; no new record control |
| read + record, without correct | Denied by new RPC; no request from UI | Existing eligible roster/new-record control unchanged |
| correct, without read | Denied; correction is not a read profile | No private Event/attendance disclosure |
| read alone / revoked / inactive / cross-Workspace | No historical-name disclosure | Existing independent permissions still apply |

The proposal consumes `ce_event_authorize_v1` for **both** read and correct and
`ce_event_audience_eligible_v1` for actor and target. All joins bind tenant,
Workspace, Event and occurrence. It follows the existing CE privileged-read
family with a fixed `pg_catalog` search path and explicit canonical gates;
authenticated/public/anon/service_role execution is revoked in the same source
transaction, with **no positive grant**. Actual owner, function/schema ACL,
transitive evaluator rights and currentness/disclosure mapping are Core review
and native-admission prerequisites, not inferred from `can_correct=true`.
The existing command RPC remains the final authorization/version/lifecycle gate.

## Discovery, lifecycle and cursor semantics

Only current named profiles of currently eligible target memberships are
included. Missing, blank or out-of-bound names are omitted, never replaced by a
UUID, generated name or cached unapproved roster. Historical attendance can be
discovered without a same-page record receipt. No arbitrary-ID input is offered.
Selection is explicit; the first server row is not automatically selected.

The existing SQL command rejects corrections on draft Events, accepts published
or cancelled Events with independent correction authority, and requires a
trimmed reason of at least12 characters after cancellation (otherwise5).
The unchanged pure domain has the same status rule. G1 consumes those rules.
The existing form/domain's JavaScript UTF-16 length can overcount emoji relative
to SQL `length(text)`; G1's dispatch adapter additionally counts Unicode code
points against the existing server minimum, preserving the actual reason bytes.
Six emoji cannot satisfy the cancelled minimum. This does not edit the lifecycle,
codec, command schema, hash or shared form. Native SQL character-count proof
remains NOT_RUN_NOT_PASS.

Targets order by native UUID identity ascending, not mutable name/time. The RPC
reads at most limit+1 eligible rows, emits at most limit and uses the last emitted
ID as the next cursor only when lookahead exists. Client rejects duplicates,
reversed/non-progressing order, mismatched cursor/tuple/version, extra/private
fields and malformed result. Cursor is untrusted: an anchor must still be a
visible row of the same scope, otherwise40001. Event/occurrence/version mismatch
also returns40001. Pages replace rather than accumulate names.

These are live keyset pages, not a retained multi-page snapshot or authority
lease. Attendance updates do not advance Event version; each row's exact
attendance version is checked again by the unchanged command. Eligibility/name
changes between requests may change the page; refresh restarts from the first
page. No cross-request completeness or post-read revoke guarantee is invented.
Native index/plan performance is not proved by the output limit.

## Actual consumer and preserved recovery

`CustomerEventInterestPage` wraps its existing form with the new read-only
`CustomerEventAttendanceTargets`. It supplies current scope/lifetime admission
and uses the same existing command session. New target selection maps only the
server row's ID/version and Event version/timezone to the existing correction
command. No new write/retry/receipt engine is created. Correcting a row that
predates this page no longer assumes that a same-page membership map exists;
the updated row is read again rather than manufacturing a membership binding
from a correction result.

Read generations invalidate synchronously on refresh/pagination. Context,
membership/Workspace, Event/version, permission/loading, locale and unmount fence
the response **and JSON decode**. A stale attached form cannot dispatch while a
new read is pending. A changed named selection cannot reuse the prior target's
dispatch capability. Drafts are scoped by Context/Workspace and attendance ID;
selection changes, Context return and locale replacement retain the right draft.
RO/EN/FA names, local time, timezone, status/error and native form controls remain.

Missing RPC42883/PGRST202 returns503 NOT_READY; invalid result502, stale409,
authorization403, missing404, auth401 and bounded500 remain distinct. Every HTTP
response is private/no-store/Vary Cookie. Raw SQL errors are never displayed.
No missing projection is converted into an empty successful historical roster.

The previously accepted same-page record→correction path remains usable from its
actual confirmed result plus current eligible roster and independent permission
when the additive RPC is absent. That existing path is **not** fallback evidence
for any earlier/correct-only/post-cancel target. G1 never synthesizes such a row.
An actual denial hides existing details and revokes page admission. A failed G1
read cannot clear an existing pending command or create an automatic POST.
UNKNOWN same-wire replay and its potentially-writing meaning are unchanged;
G2/G3 durable receipt lookup/reload recovery remain OPEN.

## Checks actually executed

`node scripts/test-ce-011-attendance-projection.mjs`: **26 groups PASS_CONTROLLED**:

- strict additive ABI,25 negative shapes/bindings/order/versions and old ABI;
- actual new GET mapping, query/auth/error/private-no-store boundaries;
- EN/RO/FA × published/cancelled historical correction without record, canonical
  target/version/timezone, short/emoji reason rejection and existing audit policy;
- read/record/correct separation; missing projection;25+1 keyset pages;
- stale target, stale Event/cursor and cross-Workspace denial;
- synchronous attached-form refresh fence, response/JSON generation ordering,
  Context/locale/permission replacement;
- target-scoped draft retention across selection, Context and locale;
- G1 UNKNOWN interaction with the existing exact-wire replay;
- preserved same-page record→correction without the additive RPC;
- limited inactive SQL source structure checks (not SQL execution).

Actual modules run: Event page, ContextProvider, new projection component/client,
old/new HTTP handlers and existing domain evaluator. SQL/session/RPC rows and
transport are fixtures; in-memory receipt/audit plans are not committed proof.
Roots unmounted, deferred responses released, no unhandled rejections.
An initial static assertion matched the word grant in a SQL comment; it was
corrected to inspect non-comment source. React ref reads during render were
removed; dispatch refs remain event-only. No assertion/guard was removed and no
previously passing full suite was replayed.

Scoped lint, project TypeScript, MJS syntax, source identity and whitespace checks
are recorded in the delivery. Existing local Node24.19.0/TS5.9.3/React19.2.8/
Next16.3.8/Zod4.4.3 ran the checks. Lock remains exactly
`c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc`.
No installation/repair. New G1 execution under Next16.4.1/Zod4.6.6 is
**NOT_RUN_NOT_PASS in this worker**; the parent's accepted exact-lock35/build gate
is not reopened or replaced. Native browser, SQL, Auth/session, RLS/ACL, durable
zero-write, revocation/concurrency and installation remain **NOT_RUN_NOT_PASS**.

## Core review and Platform native request

`docs/testing/CE011-ATTENDANCE-PROJECTION-03.native-request.json` pins exact source,
unchanged prerequisites, ABI, request effects, scenarios and required external
admission. It is a proposed request, not its own authorization or a new runner
registration. Hash/Git identity proves bytes, not operational authority.

Core reviews only this C01 mapping/currentness/disclosure intersection: existing
read+correct permission, exact actor/tenant/Context/Workspace/occurrence binding,
target current audience, minimal profile label, statement read-window semantics,
and function owner/ACL ceiling. No evaluator, ContextProvider or shared permission
change is requested. Any unsupported disclosure/currentness/owner assumption
stays BLOCKED rather than becoming a grant or always-allow fixture.

Platform must bind a separately admitted loopback-only disposable PG17/Auth
fixture, exact accepted installed CE prerequisites and real fixture principal
before the proposed native stage. No live endpoint, provider-managed grant or
existing shared staging installation is assumed. Absent prerequisites stop only
that native stage. Setup/cleanup and before/after durable write census are part
of its proof, not supplied by this source/control test.

CE010, Guide/Docs/Core producers, F001–F122, public frontend, package/lock,
Foundation/runner and historical WIP remain untouched. No SQL/Auth/DB action,
grant, activation, installation, new PR, force/rebase/merge or deployment.

Skills: CLADORA-SKILLS-USAGE v1.1.0;
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482 .
Applied cloud-environment-runtime, supabase0.1.2,
supabase-postgres-best-practices1.1.1 (keyset/least privilege),
react-best-practices and installed Next route/client guides.
