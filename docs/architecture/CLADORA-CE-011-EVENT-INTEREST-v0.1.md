# CE-011 — free event interest and manual attendance

Status: domain and proposal persistence are implemented and tested; the capability-gated customer page is implemented on `feat/ce-011-event-page`. Remote migration and Production activation remain open.

CE-011 models one free event with exactly one occurrence, an explicit audience, optional `community_ref`, publication/cancellation, self interest/withdrawal, and host-recorded attendance with versioned correction. The occurrence carries schedule information only. It contains no seat, slot, quota, waitlist, resource allocation, payment, order, message, credential, or Booking command.

## Core contract alignment

| Contract | Existing Core evidence used | CE-011 boundary still open |
| --- | --- | --- |
| C01 authority and audience | `resolve_workspace_native_context_v2` and `check_workspace_native_permission_v2` | The domain consumes the server-derived tenant/Workspace/context/membership/actor/represented-party tuple and the exact current permission/audience decision. Client-supplied authority is never accepted. |
| C02 independent activation | capability `ce.event.basic`, future module `community_events` and entitlement `module.community_events` | The schema pins the official capability/module identifiers. No permission seed, module activation or entitlement mutation is included. |
| C03 idempotency, version and audit | `platform.idempotency_keys`, `audit.events`, `platform.outbox_events` | The reviewed proposal uses these shared stores atomically. It has not been converted to or installed as a migration. |

The TypeScript domain accepts only an already resolved `AuthoritySnapshot` pinned to `ce.event.basic` and `community_events`. Attendance also requires a separately resolved `AudienceSubject` for the target member. The customer page connects that component to the authenticated API and derives the Workspace from the server-returned active dashboard context.

The official permission mapping is: create/publish → `events.event.publish`; cancel → `events.event.cancel`; self interest/withdrawal → `events.interest.manage_self`; new attendance → `events.attendance.record`; correction → `events.attendance.correct`. `events.event.read` is the read permission and is not substituted for a mutation permission. The earlier proposed `community.events.*` names have been removed.

Rejected commands return the original state object and append no audit or receipt. The canonical receipt key is `ce.event.<command>.v1/<workspace_id>/<request_id>/<client_idempotency_key>` inside the existing `(tenant_id, key)` collision boundary; this executable slice uses `command_id` as the request identifier. Its request fingerprint covers schema version, actor, context, Workspace and canonical command input. Exact replay is bound to its original tenant, Workspace, context, actor and membership. Before returning the stored result, CE re-evaluates active membership, capability, the exact permission required by that operation and the current event audience. Revoked permission, changed audience or a different actor/membership rejects replay. Reuse with different content is rejected.

Interest commands carry both the expected event version and the expected interest-record version. The first registration expects interest version zero; withdrawal and a later registration advance the same record monotonically. This prevents an old request from mutating a record after withdrawal and re-registration.

New attendance is accepted only for a published event. Draft and cancelled events reject new attendance. A pre-existing attendance record may be corrected after event cancellation when the caller still has current attendance authority, supplies the exact attendance version, resolves the participant against the current audience, and provides a reason of at least 12 characters. The audit row marks this path as `post_cancellation_attendance_correction`.

Event timezone values must be valid IANA identifiers. Attendance input is a local wall-clock value paired with the event timezone, and the command timezone must exactly match the event timezone. The interface labels the input with that timezone. It receives eligible participants as a Core-derived display list and never asks the user to type an internal membership UUID. Switching event or Workspace remounts the attendance form so prior input cannot cross context.

## Customer page connection

`/app/community/events` is registered in the existing route classifier and persona matrix. The menu requires all three existing signals: module `community_events`, entitlement `module.community_events`, and permission `events.event.read`. The database remains authoritative for every read and command, and the page does not accept a Workspace or membership identifier from user input.

The read projection is strict and bounded to 100 events and 500 named attendance candidates per event. It returns only audience-eligible events, server-derived action flags, the caller's own interest version, and attendance candidates resolved from active canonical memberships and profiles. Internal tenant, actor, policy and permission records are not returned. Event selection displays title and localized time rather than a UUID.

The page handles session expiry, access denial, a missing proposal RPC, empty results and retryable failures separately. Commands create a fresh request/idempotency identity, carry exact event and interest versions, use same-origin JSON requests, and refresh after success. A conflict refreshes authoritative state before presenting the preserved-input failure state. Interest copy in RO/EN/FA continues to state that interest is neither a booking nor guaranteed admission.

The page and navigation can ship safely before activation because an inactive module is absent from the menu and route guard, while an absent RPC fails closed as `503 CE_EVENT_CONNECTION_NOT_READY`. Installing the proposal as a migration, granting/activating the module, and enabling it for a Production Workspace remain separate gated operations.

## Remaining release work

- review and merge the capability-gated page package;
- separately approve conversion of the reviewed proposal to an immutable migration;
- run the existing pgTAP/RLS/concurrency suite against the exact migration in an isolated database;
- separately approve Remote migration and Production activation before enabling any real Workspace.

M01/M02, Communications, Booking, Finance, Commerce and Loyalty are not dependencies of this slice. CE-010 and CE-012 remain unmounted pending the Communications contracts.
