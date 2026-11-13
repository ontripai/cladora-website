# CE011 basic events — v2 source candidate

Owner CE / CLADORA-CE-WORKER-01. Source base
`b5adc9bc392838dee384b1cd8c6e297084626659`. Independent worktree/branch
`codex/ce011-basic-events-c03`; CE010's branch/checkpoint is retained.
Assignment: shared Page sequence87, CE card
`af688e29-3ef0-4c1e-930b-6203463d5e4c`.

## Reused source and actual gaps

Existing `event-interest-schema/domain/client`, Event page/G1 selector/G2 lookup,
canonical CE011 tables, C01 permission helpers and CE's C03 SQL command were
found and reused. They already define all seven actions. No Event, attendance,
interest, receipt, ledger, audit/outbox or UI engine is recreated in JavaScript.
The runtime adapter does not import or persist the test model. The existing
Event page and all RO/EN/FA copy, timezone, interest-is-not-reservation copy and
keyboard/RTL controls remain unchanged and **are not mounted in Shell/menu**.

Actual changes:

| Gap | Before | This candidate |
| --- | --- | --- |
| Request-scoped command adapter | Legacy route directly calls v1 with getClaims | New fail-closed request-local binding contract + actual HTTP factory and `/api/customer/v1/community/events/command` entry |
| Post-wait authority/audience | Historical SQL uses statement-time audience and lacks final fresh checks | v2 RPC reuses exact C03 body and adds canonical session/Context/permission checks after waits and before replay/result return; domain audience uses current clock |
| State-machine consistency | Model allowed cancelling draft, canonical SQL/contract require published | One predicate now matches the existing published-only cancellation rule; historical receipts are not rewritten |
| UNKNOWN and identity | Existing session already freezes original command/wire | Reused. New transport ambiguity/malformed success/late abort return UNKNOWN; explicit same-wire replay reaches the same canonical SQL key/receipt |

Free, single occurrence only. No capacity/seat/resource allocation, Booking,
BK01, payment/ticket, Commerce/Loyalty, notification or external messaging.
Community reference remains optional; SERVICE/Finance/Documents are not
prerequisites. No new permission, role, module or entitlement is installed.

## Real code path / command contract

Candidate route POST → `createCe011EventCommandHttpV2` → immutable validated
snapshot → request-local `Ce011EventRuntimeV2.resolve` → verified binding →
`executeCe011EventCommandV2` → fixed `customer_api.command_ce_event_v2(jsonb)`.
The actual existing issuer verifier is imported unchanged; only its SDK boundary
is substituted in tests. Same original Request (body already consumed by the bounded parser; no clone/tee), signed actor/SID/exp, selected
Context/Workspace and assurance consistency are checked. All SDK waits precede
the RPC's canonical final checks; there is no post-RPC SDK wait followed by
exposing its old result. Client tuple/permission/hash fields are rejected.
No account/role/profile is inferred from social membership.

`CE011_EVENT_RUNTIME_V2.resolve` is **NULL**. Core must supply the request-local
port in `core-port-request.json`; that file is a **CE consumer proposal**, not an
existing official Core factory or an admitted query/role profile. A binding
label/object is not evidence of authority: the SQL still derives actor and C01
scope and checks exact action permission. Missing binding/helper/schema/mapping
is unavailable. No Guide/CE010/SERVICE pool, service_role client, generic SQL,
allow callback or weaker legacy fallback is used by this candidate route.

Original command shape is exactly `eventCommandSchema`. Values/IDs/key are not
regenerated; the new snapshot freezes the parsed command before awaiting the
binding. Parsing follows the existing schema's trim behaviour, and case-folded
UUID identity comparisons do not rewrite the outgoing command. Version checks
respect the existing PostgreSQL int4 columns and result increment limits.

| Existing command | Exact permission | Result/version |
| --- | --- | --- |
| create_event | events.event.publish | Event v1; expected_version=0 |
| publish_event | events.event.publish | Event expected_version+1 |
| cancel_event | events.event.cancel | Published Event expected_version+1 |
| register_interest | events.interest.manage_self | Current represented participant interest, expected_interest_version+1 |
| withdraw_interest | events.interest.manage_self | Same active interest, expected_interest_version+1 |
| record_attendance | events.attendance.record | Server-created attendance v1 |
| correct_attendance | events.attendance.correct | Same attendance, expected_attendance_version+1; published/cancelled rule and long cancellation reason preserved |

Record permission is not correction permission. Participant/attendance IDs in
results remain server identities; no arbitrary target UUID or fake name is
made into a projection. G1 target projection remains the existing separate
contract; native acceptance is still required before connecting a product menu.

The result remains the strict existing five fields:
`entity_type, entity_id, version, command, replayed`; actual
`parseEventCommandResult` checks command/type/version and known Event/correction
IDs. No private row is returned. Event GET/G1/G2 and the legacy v1 route are
unchanged. This is a separately versioned command candidate, not an automatic
cutover of those accepted consumers. App/CE only selects it after API/persistence
review and the official port; no fake browser binding is supplied here.

## Existing C03, not another host

`supabase/proposals/ce011-basic-event-command-v2/command.sql` is INACTIVE source.
An unconditional55000 guard precedes the two new routine definitions and there
are no permission/module seeds, table creation or positive grants. Both routines'
default EXECUTE rights are revoked from PUBLIC/anon/authenticated/service_role
inside the candidate source transaction. Owner/RLS/ACL remain Platform/Core
review inputs. No guard is stripped and no SQL is executed.

The builder pins the whole historical operational proposal SHA256
`5894363db4fa0fee49737371546e9cd1cbeddb2dcc44723a81cca396004feafc`, extracts the
existing command body and domain audience predicate, and applies explicit v2
guards. The canonical key and PostgreSQL JSONB hash lines remain **byte-identical**:
`ce.event.<command>.v1/workspace/command_id/client_key`. Existing
platform.idempotency_keys / community.event_command_receipts / audit.events /
platform.outbox_events remain the sole persistence and atomic receipt path.
The prior namespace, collision/expiry boundary, receipt identity, expected
versions, lifecycle, audit/outbox writes and immutable history are preserved.

The function runs in the **one existing RPC transaction**; JS adds no BEGIN,
COMMIT, retry, reservation or audit/outbox effect. Do not wrap this RPC in a
second generic TS C03 host: that would reserve another `core-tx.v1` key and
change the accepted CE contract. An official Core request-local port must
admit this exact C03 RPC family, not silently replace the key/hash. The v2
function's namespace intentionally shares the v1 key/receipts, so it cannot
create a second effect from the same original command merely by changing ABI.

The new audience helper also closes a specific inherited temporal gap: the
role-code arm now checks that the matching role itself has a current validity
window. An unrelated live workspace role cannot make an expired/future matching
role eligible. This source counterexample was checked statically and the SQL
source/reproduction case was rerun; real DB execution remains NOT_RUN.

Fresh guards consume existing Core `_at_v1` Context/permission and request-session
primitives. They bind initial/current actor, tenant, membership and represented
party; target audience is checked with the inherited domain policy at current
clock. Guards run before effects, after idempotency/interest/attendance waits,
for replay and after all ledger/audit/outbox writes before return. A final denial
raises and rolls back the RPC transaction. The domain helper is not a parallel
Core evaluator. Fresh SQL source is **not proof** of real isolation, revision
barriers, two-session revoke, RLS or a held role lease; Core must review that
closure and Platform/QA must prove it under the real target/session model.

Do not execute the historical whole proposal: registry seeds, permissive
service-role policies and installation ownership must not be adopted by name.
Only its canonical definitions/body are source inputs. Platform must supply
an exact before-image, scoped owner/ACL/RLS and a separately reviewed fresh or
forward-adaptation plan; do not DROP/backfill or relabel an installed v1 writer
as the new profile. Legacy write exposure must not bypass v2 currentness.
Existing G2 lookup's exact canonical key/hash/receipt shape remains compatible;
its native currentness gate is separate, not rerun or declared closed here.

## Error / recovery contract

* Before dispatch: invalid input400; issuer failure401; tuple/permission
  denial403; missing port/schema/function503. No command RPC fallback.
* Canonical rolled-back SQL outcomes:42501→403;23505/23514/40001→409;
  invalid input22023/22P02/22003→400; canonical P0002→bounded404. The adapter preserves the original error
  object (including40001); the HTTP body exposes only bounded codes.
* Lost reply, malformed/mismatched success or unclassified post-dispatch error:
  HTTP202 UNKNOWN. Late abort/expired issuer after dispatch also withholds the
  success. There is no auto-resend, key replacement or command reconstruction.
* Explicit same-wire replay / existing G2 lookup resolves uncertainty only with
  a valid bounded receipt and current authority; GET is not command success.
  Lookup absence/expiry or a changed permission does not prove prior failure.

## Reproduce and evidence limits

Use the already installed Next16.4.1/Zod4.6.6/TypeScript5.9.3 toolchain; no
package/lock/config repair. From this checkout:

```sh
node scripts/test-ce011-basic-events-v2.mjs --case='SQL source'
node scripts/build-ce011-basic-command-v2.mjs --output=/absolute/new/command.sql
```

Builder output is a source file, not an install command; differing existing
output is preserved. Tests use actual route/HTTP/adapter/schema/issuer verifier,
with explicit SDK substitution and **existing domain model as the RPC/SQL
substitute**. Its in-memory receipts/audits are test evidence only, never used
by runtime persistence. Every real fetch is forbidden. No old27/35/G1/G2, CE010
or Guide suites were executed. Eight boundary/API/source groups plus one new
state-machine mismatch witness and two missing-row/missing-executable-port checks eventually passed across scoped runs. The first
combined run stopped after three passes on a fixture failure: cloning a consumed
Request threw before the intended mismatch. That FAILED_NOT_PASS receipt is
retained; only that fixture was fixed, with one-case continuation and remaining
unrun groups. There is **no claim of one all-green full-suite rerun**.

SQL checks are byte/provenance/static guard checks, not parser/compile/PG tests.
Actual seven-action DB persistence, rollback/audit/outbox/receipt atomicity,
replay/concurrency/expiry and restart remain NOT_RUN_NOT_PASS. A model effect
or fake session is not a native save/receipt.

Typecheck was run on the exact isolated composition: Core103 snapshot plus
CE common-ancestor62f3→b5 overlay plus this source delta. The CE branch by
itself still requires the official Core dependency introduced by CE010; its
standalone typecheck is not claimed. Core sources are unchanged. The
reconstruction method is the same as CEc89's published recipe; use this
successor instead of c89 and metadata103 instead of6adb. No target connection
or SQL is needed for this reconstruction.

## Remaining owners / gates

Core: official CE011 request-local factory/profile for the exact fixed RPC,
verified session/actor/selected scope/module/permission, canonical revision/
currentness and recursive helper/role/RLS closure, bounded/abort-safe dispatch.
Only this real port/coupling is blocked; CE domain/API/SQL candidate is delivered.

Platform/App: real dedicated Pool/target/role binding and accepted installation
of canonical tables plus reviewed v2 routines; owner/ACL/RLS, private custody,
window/capacity/observer. Actual implementation and identities are not inferred.

QA/Platform: compile/parse (not done here), real Auth/C01/PG, scope/denial/expiry,
version/concurrency/same-key/rollback/UNKNOWN/restart. Product menu/adoption and
native verdict are separate gates. Guide/CE010/Finance are not this Event's
business prerequisites; no Booking/paid feature is enabled.

خودکارسازی: نیازمند بررسی؛ ورودی، فرمان نسخه‌دار و source پین‌شده است؛ بررسی
مرزی adapter و provenance قابل تکرار است. تصمیم اختیار و پذیرش با Core/QA،
اجرا با Platform و target/window/lease معتبر؛ استثناهای capability به همان
مالک ارجاع می‌شوند. معیار ارزش، جریان مستقل هفت‌فرمانی با حفظ wire/receipt
و جلوگیری از اثر دوباره، بدون تبدیل مدل به persistence واقعی است.
