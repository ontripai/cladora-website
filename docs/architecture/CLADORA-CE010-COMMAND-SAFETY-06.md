# CE010 command safety 06

Task: V14-CE-01 / CE010-COMMUNITY-COMMAND-SAFETY-06.
Owner: CLADORA CE / CLADORA-CE-WORKER-01.
Parent:6cd5689b4a9021eabe1cbe23333b129f4f9da7e4.
Branch:codex/program-ce-independent-base-02.

This is a CE010 source/controlled-connection candidate. CE011/G1/G2 and its
frozen native evidence are untouched. No domain, lifecycle, SQL, authority,
permission, entitlement, Auth/Context or Communications producer was changed.
CORE-CE010-MAP-01 remains proposed; no mapping/registration/activation is inferred.

## Exact existing result

The existing SQL command emits exactly entity_type/entity_id/version/command/
replayed. The new narrow codec rejects null, partial, extra/private, mismatched
command/entity/known ID/version or non-boolean replay values, even on HTTP200.

| Existing command | Result entity | Known ID | Result version |
| --- | --- | --- | --- |
| create_community (codec only; no new UI) | community | submitted community_id |1|
| create_announcement | community_announcement | submitted announcement_id |1|
| publish_announcement / cancel_announcement | community_announcement | submitted announcement_id |expected_version+1|
| report_content | community_content_report | submitted report_id |1|
| decide_content_report | community_content_report | submitted report_id |expected_version+1|

Creation uses the new aggregate's version1, not Community version+1. Original
UUID/wire spelling is retained; comparison of known result identity is UUID case
insensitive. The five fields are not a new signed actor/body/COMMIT attestation.
Authority and canonical idempotency remain the existing server RPC's responsibility.

## Existing page/form connection

community-command-session.ts is a bounded CE010 HTTP/session adapter, not a new
receipt store, authority evaluator, durable retry engine or cross-domain kernel.
The existing schema canonicalizes once; a copied/deep-frozen command, its generated
identity and one encoded wire are retained before dispatch. A synchronous shared
flight/pending gate covers all forms/actions of that Community. Only an explicit
same-wire replay can resend UNKNOWN. Timeout/network/5xx/408/429/invalid success
preserve pending. Definitive rejection retains input and requires explicit reset
before a new reviewed command. Rejection after prior uncertainty stays UNKNOWN.
No automatic POST, lookup fallback or GET-derived confirmation.

The page lifetime holds ephemeral slots keyed by server-projected membership,
Context, Workspace and Community. Current actor remains implicit in the existing
server claims/canonical membership binding, not a caller actor or permission
field. Native actor/session lineage is a Core/Auth proof gate, not established by
the fixture or client cache key. Context/dashboard mismatch or loading denies
admission. Scope/locale changes revoke the commit owner in layout cleanup and
cancel only the local observer, never claiming server rollback. Response and JSON
are fenced after awaits. An abandoned operation keeps its original slot UNKNOWN;
it cannot update the new scope or publish its success callback.

Forms retain the existing feedback and draft/Context/Community guards. Optional
boolean command completion distinguishes a valid result from unconfirmed work;
an undefined return from existing standalone adapters retains backward compatibility.
The page adapter always returns an explicit boolean. In-page forms are locked
while pending; dirty and pending guards preserve the frozen request on navigation.
The local Community dialog explicitly says a pending request is retained, not
discarded/cancelled/resubmitted. Explicit ordinary draft discard remains available
when no unknown/in-flight command owns it.

Draft fields are scoped in the same ephemeral slot and survive read errors,
Community/Context return and locale replacement. Authorized reads are required
before showing a formerly unavailable scope. Read denial hides details; transient
read failures keep already-visible drafts disabled. Read generation/owner checks
prevent old reads from restoring denied data or admission. A separate explicit
current-read refresh never resolves UNKNOWN or sends a command.

A valid initial response permits only the original form's clear/success callback.
A valid explicit replay clears only its own still-matching submitted draft fields,
compared against both the pending command and the pre-replay raw draft snapshot,
under the same admitted owner. Unrelated/new fields are not cleared. Only then is
current data read separately. No receipt is synthesized from those reads.
Reload/device recovery is absent: slots last only while this page is mounted.
The UNKNOWN copy says reload cannot recover the pending request. No reload-safe
duplicate-free claim or G3 persistence is made.

Read/create/publish/cancel/report/moderation flags remain separate server read
projections and original RPC checks. No persona-derived affordance, new permission
or positive authority producer is introduced. Missing command/required mapping
returns NOT_READY and preserves exact pending; it does not pause Event/Guide.

## Actual affected verification

- New scripts/test-ce-010-command-safety.mjs:29 PASS_CONTROLLED groups, including
  all six result variants/54 negative results, deep-frozen caller mutation,
  duplicate events, timeout/lost reply/invalid200/503, exact same-wire replay,
  attached old action during Community selection, late response/JSON across
  Community/Context/locale, read-revoke/late GET, scoped draft return, and all five
  actual page commands/valid feedback in RO/EN/FA.
- Existing affected form-feedback harness:15 locale/form/action scenarios PASS.
- Existing affected real-provider page harness:48 Context +45 Community selection
  scenarios PASS, plus its initial command/projection checks. These are controlled
  React/JSDOM tests, not native browser or actual authorization evidence.
- Legacy fixtures now return the actual existing five-field RPC result instead of
  {ok:true}. UNKNOWN recovery uses an explicit same-wire action with an identity/
  body equality assertion; definitive rejection uses explicit reset. Reauthorized
  same-scope drafts are preserved, while new scopes stay clean. A pending read
  is refreshed through GET rather than bypassing admission with a second write.
  Existing scope/dialog/focus/guard/zero-navigation-write assertions remain.
- Scoped lint, TypeScript, MJS syntax, diff and protected source identities are
  recorded in delivery. Rechecks followed affected source/oracle corrections;
  no CE011/G1/G2 suite or SQL/runtime test was repeated.

Actual page, forms, ContextProvider and existing handler code execute with fake
Next response adapter, claims/RPC rows and transport. No issued Auth/session,
PostgreSQL/RLS/ACL/C03, native browser, installed RPC or notification evidence.
Existing Node24.19.0/TS5.9.3/React19.2.8/Next16.3.8/Zod4.4.3 were available.
The unchanged target lock is
c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc.
New Next16.4.1/Zod4.6.6 execution: NOT_RUN_NOT_PASS in this worker; no installation.
Other accepted target-version evidence is not reused as proof for this new code.

## Remaining integration gates

Coordinator reviews this exact child/inventory and runs only the affected CE010
checks on the exact lock. Core owns any required canonical current actor/membership,
permission/mapping and C03 proof; CORE-CE010-MAP-01 cannot be activated by UI code.
A separately admitted disposable native fixture must prove issued Auth, independent
command rights, receipt/key/hash/replay/expiry, currentness and atomic effects.
No real DB/Auth/install/grant/activation, parallel receipt/lookup port, producer
edit, new dependency, notification, main/release merge or deployment occurred.
