# CE-011 operational connection package v0.1

Status: ready for review; SQL proposal and server API implemented, migration not created/applied, page not mounted.

## Boundary

This package closes the code gap between the executable CE-011 domain slice and an operational server connection. It reuses `resolve_workspace_native_context_v2`, `check_workspace_native_permission_v2`, `platform.idempotency_keys`, `audit.events` and `platform.outbox_events`. It creates no user, role, Booking, payment, order, messaging, audit, outbox or idempotency substitute.

`community_events` remains independently activatable. The proposal registers the module definition, entitlement key and permission bindings but deliberately creates no entitlement row, module activation, role-template grant or Production change.

## Domain tables and invariants

| Table | Purpose | Key/version invariant |
| --- | --- | --- |
| `community.events` | Event aggregate, lifecycle and audience-policy identity | PK `id`; tenant/Workspace triple unique; positive monotonic `version` |
| `community.event_occurrences` | Exactly one programme occurrence per Event | unique `event_id`; composite Event/occurrence scope key; `ends_at > starts_at`; timezone stored with programme times |
| `community.event_audience_roles` | Role audience members | unique `(event_id, role_code)` |
| `community.event_audience_members` | Explicit member audience | unique `(event_id, membership_id)` |
| `community.event_interests` | Current self-interest state with preserved version progression | unique `(event_id, membership_id)`; positive `version` |
| `community.event_attendance` | Current attendance record and correction version | unique `(event_id, membership_id)`; positive `version` |
| `community.event_command_receipts` | Immutable bounded CE command receipt | PK `request_id`; unique `(tenant_id, canonical_key)`; pins context, actor, membership and optional represented party |

`observed_local` is deliberately a wall-clock observation value, paired with the Event's validated IANA `timezone`; it is not presented as a Booking allocation or as an independently inferred UTC instant. The API returns the programme timestamps as instants plus the same display timezone, so clients render programme and attendance context consistently.

All tables have RLS enabled and all direct grants are revoked from `public`, `anon` and `authenticated`. Authenticated access is only through the bounded `customer_api` RPCs. The RPCs are security-definer only to reach locked domain/shared tables; each call derives `auth.uid()`, resolves C01, checks the exact permission and audience, and exposes no generic table operation.

## Command contract and acceptance matrix

| Command | Permission | Required input | Version/lock | Receipt | Successful acceptance | Rejected acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| `create_event` | `events.event.publish` | context, Workspace, request/key, Event/occurrence IDs, title, times, IANA timezone, audience, optional community | expected Event version `0`; unique Event and occurrence | Event v1 | draft Event + single occurrence + audience, one audit/outbox/receipt | inactive module/permission, bad timezone/time range/audience, duplicate ID; zero business effects |
| `publish_event` | `events.event.publish` | Event ID, expected Event version | locked draft Event; exact version | next Event version | status published and version increments once | missing/revoked permission, non-draft or stale version; replay cannot bypass authority |
| `cancel_event` | `events.event.cancel` | Event ID, expected Event version, reason | locked published Event; exact version | next Event version | status cancelled; history retained | publish permission alone, stale/non-published Event or wrong Workspace rejected |
| `register_interest` | `events.interest.manage_self` | Event ID, expected Event and interest versions | published Event + audience; unique participant/occurrence row | interest version | first registration starts v1; re-registration increments withdrawn row | duplicate active interest, stale version, changed audience or other actor rejected |
| `withdraw_interest` | `events.interest.manage_self` | Event ID, expected Event and interest versions | active interest row locked | interest version | interested → withdrawn, version increments | absent/withdrawn/stale row, cancelled Event or lost audience rejected |
| `record_attendance` | `events.attendance.record` | Event/target member, observed local time and exact Event timezone | published Event; unique Event/member attendance | attendance v1 | eligible member selected, v1 recorded | draft/cancelled Event, duplicate attendance, wrong timezone/member/audience rejected |
| `correct_attendance` | `events.attendance.correct` | Event/attendance IDs, expected Event/attendance versions, attended value, local time/timezone, reason | existing row locked; independent correction permission | next attendance version | correction increments version; cancelled Event sets explicit correction marker | record-only permission, stale row/version, draft Event, wrong timezone; cancelled correction without sufficient reason rejected |

Every accepted command uses one PostgreSQL transaction: current C01 check → aggregate/participant lock → shared idempotency claim → current authority/audience recheck → version/lifecycle validation → domain mutation → CE receipt → shared audit/outbox → shared response receipt. Any exception rolls back every business effect. A successful replay returns the immutable CE receipt only after matching its Workspace, context, actor, current membership and command and rechecking current authority/audience; it adds no duplicate rows. The canonical key uses `command_id` as C03's `target_or_request_id`.

## Server API

`GET/POST /api/customer/v1/community/events` uses the request-scoped authenticated Supabase client. GET calls `read_ce_events_v1`; POST validates the strict discriminated command schema and calls `command_ce_event_v1`. Mutation origin, JSON media type, 16 KiB body limit, authentication, no-store headers and bounded error mapping are enforced. No service-role client is used.

The route exists for review but is not linked from navigation or any page. The database RPC does not exist operationally until the reviewed proposal is converted to a migration and applied in an approved isolated environment.

## Verification status

Executable now: TypeScript domain/UI acceptance, static SQL/API package contract, targeted lint, typecheck and diff check.

Prepared but not executable under this instruction: real pgTAP/RLS/concurrency/rollback tests. They require applying the proposal in an isolated test database. Migration execution, public page connection, Production deployment and role/entitlement/module activation remain prohibited.
