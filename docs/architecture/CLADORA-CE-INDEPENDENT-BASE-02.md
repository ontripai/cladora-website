# CE independent base flow 02 — Event source adoption

Task: `V14-CE-01 / INDEPENDENT-BASE-FLOW-02`.
Owner: CLADORA CE / CLADORA-CE-WORKER-01.
Assignment: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6570801523
Exact parent: `1afe40aedbfc44855ccea676fb92fd4e6ec61e83`.
Branch: `codex/program-ce-independent-base-02`.

## Completed gate

The designated Base still had the five-action Event page. The already reviewed
seven-command successor was absent from its application source. This delivery
closes that adoption gap, rather than rebuilding its schema, lifecycle, recovery
engine or previously reviewed UUID/read-generation fixes. The existing route
`/[lang]/app/community/events` now reaches create, publish, cancel, register
interest, withdraw interest, record attendance and correct attendance through the
actual existing HTTP handler. No new navigation, role, capability, table, RPC,
receipt kind or SQL was introduced.

Official source acceptance consumed:
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6422993437
(`REVIEW_ACCEPTED_SCOPED_SOURCE_DELTA`; G1/G2/G3 remain open).

| Official input | Git blob | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Complete seven-path successor | `6ed334dad9b16c820b99ca5d2b0e242c244e92b1` | 129220 | `60e373835cf747c8a302c1a2d2442ace4eb4787e0242fbc5eaea7edda2df5dcc` |
| Delivery manifest | `c42c3d419c36f1b99cb5b22e646393733624328c` | 29036 | `6941c4ad301856aff698e6881abc8d44a5423f4713ed02bf64996dfac797c102` |

Both were fetched fully from the repository, not accepted on the strength of a
retained workspace copy. All five existing preimages, both required absences and
all eight readonly dependencies match the official manifest on the new Base.
`git apply --check` succeeded; all seven outputs matched before the bounded
compatibility changes below. The historical architecture document is retained
byte-for-byte with its original input identity; this document binds the new Base.

## Bounded integration changes beyond the accepted artifact

1. The Event form associates local error/status feedback with its accessible
   name, declares fieldset busy state, and displays the relevant attendance or
   correction timezone next to the local-time input. Removing only these markup
   additions recovers the accepted component's exact SHA-256. Session, command,
   read fencing, request bytes and admission logic are unchanged.
2. The workflow's existing `test-ce-011-form-recovery.mjs` now resolves the
   accepted client import and uses valid UUID fixtures. It checks the actual
   accessible name and effective HTML disabled state, including inherited
   fieldset disabling. Its expected uncertain-result message and retained
   successful draft match the accepted component contract. All fifteen
   locale/action cases, exact payload/version/timezone assertions, simultaneous
   submission lock, current-version retry, private-ID nondisclosure,
   Event/Workspace reset and late-completion assertions remain. A zero automatic
   resend assertion was added. This standalone compatibility check is not the
   page-owned same-wire UNKNOWN recovery proof.
3. The existing route test loader preserves an existing `.ts` suffix instead of
   constructing `event-interest-schema.ts.ts`. Its missing-RPC fail-closed and
   error-redaction assertions are unchanged. No workflow or toolchain changed.

## Flow and evidence boundaries

| Flow | Source / controlled evidence | Remaining gate |
| --- | --- | --- |
| Audience and seven commands | Real page, ContextProvider, handler and domain evaluator; server-projection affordances; independent command permissions; synthetic DB boundary | Installed RPC, issued Auth, native RLS/ACL/locks and persistent currentness NOT_RUN_NOT_PASS |
| Named manual attendance | Current eligible roster, exact Event/interest/attendance versions; independent record/correct permissions; no raw identifier UI | Earlier-record/correct-only/post-cancellation projection remains G1 |
| Double event, UNKNOWN, revoke and replay | Synchronous admission; frozen request; explicit identical wire/key/body replay; valid read required; no auto POST; revoked authority denies | Shared durable receipt lookup and reload/device recovery remain G2/G3 |
| Draft / Context / locale | RO/EN/FA, RTL, scoped draft retention, Context return, loading/permission replacement, late JSON, unmount and owned-timer cleanup | Native browser and real server session NOT_RUN_NOT_PASS |
| Basic Event independence | Interest explicitly reserves nothing and guarantees no admission; no capacity/payment/Booking/Finance/SERVICE dependency added | Future dependent waves remain unactivated |

The five-field existing result ABI remains
`entity_type/entity_id/version/command/replayed`. A current GET is not proof of a
pending command. A fulfilled wrapper promise is not an invented commit receipt.
UNKNOWN keeps its exact pending request for the mounted page lifetime; a hard
reload cannot restore it. A replay may apply the original command if it did not
commit. No durable/reload duplicate-free guarantee is made.

## Dependencies and closure

Consumer identity is this delivery's CE source inventory and commit recorded in
#463. Producer identities below are source pins, never evidence of installation.

| ID / producer → consumer | Version / request → response / errors | Idempotency and current authority | Closure / blocking extent |
| --- | --- | --- | --- |
| CE011 operational RPC / CE → Event page | Existing `customer_api.read_ce_events_v1(context_id, workspace_id)` and `command_ce_event_v1(p_request)`; strict existing projection and five-field result; missing RPC 503; 401/403/404 deny, 409 conflict, invalid success 502/UNKNOWN | Existing command key/version; actor and authority resolved at RPC; client permissions only affordances | Controlled actual-handler connection passed. Real RPC install/Auth/RLS proof still open, not blocked on BK01 |
| G1 / CE producer, Core C01 review → attendance correction | Existing `events.attendance.correct`; canonical attendance/eligible-name read projection is incomplete | Record permission cannot stand in for correction/read authority; no arbitrary ID input | CE supplies reviewed projection/RPC delta; Core checks disclosure/currentness. Only earlier/correct-only/post-cancel correction blocked |
| G2/G3 / CE domain + Core C03 → UNKNOWN recovery | Dedicated canonical result lookup tied to existing key/fingerprint/authority is absent; current ABI does not attest actor/request/COMMIT | Absence is not non-COMMIT; same-wire replay remains potentially writing; no parallel ledger | Reviewed receipt/lookup ABI + native atomic/revoke/replay proof needed for durable recovery; no fabricated RPC in this delivery |
| Core Context / Core → CE | Existing ContextProvider, server dashboard context/membership/Workspace and permissions | CE compares UUID identity case-insensitively without rewriting wire; shared ContextProvider UUID seam retained | Shared producer change requires Core; no shared hook edit here |
| DOCS-CE012-REF-01A / Documents → CE bridge | Request/decision v1, detailed below; producer source candidate `d10d8b9dddee3055a75304cc29f9b16cea68702f` | Read-only selector; no receipt or write; exact server mode and current authority required | Delivered source candidate, not jointly accepted/live. Blocks only live linked reference, not basic Guide |
| CORE-CE012-MAP-01 + CORE-AUTH-TX-PORT-06 / Core → CE bridge | Existing map v1 plus `CurrentAuthorityTransactionalPortV1.recheckAfterLock` | Command/Guide lock, Context, Workspace, actor, authority version, transaction/attempt/purpose must match; preflight alone never authorizes | Native host/current-authority/commit integration remains open; no always-allow provider |
| Platform local lane → CE native verification | Source `61a05b5dbbc72e1b60d7bcb5204cf5e5244eeb19`, report `6572758564`; provision/health/cleanup reported, fixture removed | No live shared endpoint or authenticated CE executor inferred | Exact disposable domain install + principal/admission/proof request needed; no automatic use of staging/Production |

### CE012 / Documents direct contract comparison (readonly)

New Documents source delivery:
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6572785479
The producer and its delivery document were independently read at the exact
reported commit. Provider bytes: 6458,
SHA-256 `14c37f949f120fb071e0834773e3c7939022511673506bd1d2260ba881e6d0d3`.
Documentation SHA-256:
`c998d5fb56ecc1ff4f5dd6dde38323e8522d00ca7bac427c5a8c522a4b0e5626`.
The producer was not merged, edited or executed here. Its reported nine new
producer groups are distinct from the old nine-scenario/four-compatibility kit.

| Boundary | Existing CE contract / new producer source | Disposition |
| --- | --- | --- |
| Request | `docs-ce012-reference-request.v1`, version1; exact Context/Workspace/Guide, target.document_id, immutable document_version_id, positive safe document_version, new_command/replay | Names, versions and selector shape match. No actor in client request |
| Version / host | document source_version uses target.document_version; Guide expected_guide_version binds host subject version and aggregate next version; fingerprint, key, command, purpose bound | Source mapping proposed by Documents; joint CE/Core host admission still required; not a new accepted ABI |
| Allowed response | `docs-ce012-reference-decision.v1`, version1, exact echo; current_server_session; current_authorized/historical_authorized; only safe_label/redaction=safe_label_only | Strict schema-compatible. Producer's neutral `Document reference` label requires joint projection-policy admission; old kit's fixed label not silently changed |
| Denial/error | stale/denied/not_found/not_ready with null label and redaction=none; bridge binding mismatch throws; strict parse failures abort | Producer maps stale/unavailable/other denial without internal details; it propagates 40001 to Core's bounded transaction retry. No allow/fallback on error |
| Currentness | Core map allow+active entitlement followed by exact post-lock authority receipt, then selector; actor from server SQL session; factory private copies | Proposed producer uses existing selectors. Issued Auth, RLS/ACL, locks and native currentness not proved here |
| Replay | new command requires current immutable target; historical_authorized only for matched-receipt server-bound replay | CE/Core must supply the actual committed-result read-phase invocation. Client-supplied mode is insufficient; selector does not create/find a receipt |
| Guide independence | null document_target needs no Documents call; basic Guide independent of SERVICE/Event | Public Guide editing remains `commands=null` and `can_edit=false`; no runtime gate opened |

The existing kit's nine rows are accounted for without rerunning them:
Core current, revoked, inactive entitlement and cross-Workspace; Documents
current immutable, historical replay, stale/mutable, revoked and cross-Workspace.
Its four compatibility checks and mutation-digest/zero-write requirements are
unchanged. Existing kit source is an acceptance contract, not a passing receipt
for the newly delivered producer. Joint policy/mapping review and real-target
proof remain open. No new live reference, selector, provider or permission is
invented. CE012 bridge, command evaluator, contracts, client and page bytes remain
equal to Base; accepted CE010 work and F001–F122 inventory are untouched.

## Actually executed checks

- Base adoption witness: the new actual-page harness against extracted original
  Base source fails its `button exists` assertion; the new controls were absent.
- Adopted seven-command harness `--commands-only`: 35 cases PASS with actual page,
  real ContextProvider/handler/domain and fake DB/transport. No SQL or Auth call.
- Existing page-test entrypoint: PASS, 18 cases (12 overlap the above UUID/read
  regressions; do not add these counts as unique tests). Adds strict GET,
  unavailable-RPC and HTTP-boundary coverage.
- Existing standalone form recovery: PASS, 15 locale/action cases plus its
  Event/Workspace late-completion and hidden-control checks. Initial loader and
  fixture/accessible-markup mismatches were exposed and aligned as described;
  rejected requests were not made to pass by changing product semantics.
- Existing route harness: PASS, absent RPCs return 503 with bounded errors.
- TypeScript, scoped ESLint, MJS syntax, readonly identity and diff checks are
  recorded with actual command outcomes in the final delivery manifest/#463.

Available toolchain: Node24.19.0, TypeScript5.9.3, React19.2.8,
Next16.3.8 and Zod4.4.3. No installation or dependency/config change. Target lock
Next16.4.1/Zod4.6.6 execution: **NOT_RUN_NOT_PASS**. The installed-toolchain checks
do not substitute for that gate. Native browser, real PostgreSQL/Auth/ACL/RLS,
durable receipt/replay/concurrency, hosted environment and Release:
**NOT_RUN_NOT_PASS**. Old CE010/CE012/provider/lifecycle suites were not repeated.

Historical worktrees/WIP/artifacts remain. Only this task branch may be pushed
normally for review. No PR, merge, force/rebase, public-site edit, runner edit,
SQL execution, stack startup, install, grant, activation or deployment is made.

Skills policy: CLADORA-SKILLS-USAGE v1.1.0,
https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482 .
Applied: cloud-environment-runtime; supabase v0.1.2; react-best-practices; relevant
installed Next guides. Skills supplement verification, not replace it. Source
adoption does not imply product/runtime acceptance or programme completion.
