# CE-011 — free event interest and manual attendance

Status: implemented and executable for the domain/schema/UI slice; operational persistence remains open.

CE-011 models one free event with exactly one occurrence, an explicit audience, optional `community_ref`, publication/cancellation, self interest/withdrawal, and host-recorded attendance with versioned correction. The occurrence carries schedule information only. It contains no seat, slot, quota, waitlist, resource allocation, payment, order, message, credential, or Booking command.

## Core contract alignment

| Contract | Existing Core evidence used | CE-011 boundary still open |
| --- | --- | --- |
| C01 authority and audience | `resolve_workspace_native_context_v2` and `check_workspace_native_permission_v2` | The domain consumes the server-derived tenant/Workspace/context/membership/actor/represented-party tuple and the exact current permission/audience decision. Client-supplied authority is never accepted. |
| C02 independent activation | capability `ce.event.basic`, future module `community_events` and entitlement `module.community_events` | The schema pins the official capability/module identifiers. No permission seed, module activation or entitlement mutation is included. |
| C03 idempotency, version and audit | `platform.idempotency_keys`, `audit.events`, `platform.outbox_events` | The in-memory slice models the canonical scoped key and replay checks. Atomic persistence, audit/outbox writes and expiry handling remain explicitly open for the later coordinated database package. |

The TypeScript domain accepts only an already resolved `AuthoritySnapshot` pinned to `ce.event.basic` and `community_events`. Attendance also requires a separately resolved `AudienceSubject` for the target member. The UI is a port-driven component and is intentionally not mounted in navigation or connected to an API.

The official permission mapping is: create/publish → `events.event.publish`; cancel → `events.event.cancel`; self interest/withdrawal → `events.interest.manage_self`; new attendance → `events.attendance.record`; correction → `events.attendance.correct`. `events.event.read` is the read permission and is not substituted for a mutation permission. The earlier proposed `community.events.*` names have been removed.

Rejected commands return the original state object and append no audit or receipt. The canonical receipt key is `ce.event.<command>.v1/<workspace_id>/<request_id>/<client_idempotency_key>` inside the existing `(tenant_id, key)` collision boundary; this executable slice uses `command_id` as the request identifier. Its request fingerprint covers schema version, actor, context, Workspace and canonical command input. Exact replay is bound to its original tenant, Workspace, context, actor and membership. Before returning the stored result, CE re-evaluates active membership, capability, the exact permission required by that operation and the current event audience. Revoked permission, changed audience or a different actor/membership rejects replay. Reuse with different content is rejected.

Interest commands carry both the expected event version and the expected interest-record version. The first registration expects interest version zero; withdrawal and a later registration advance the same record monotonically. This prevents an old request from mutating a record after withdrawal and re-registration.

New attendance is accepted only for a published event. Draft and cancelled events reject new attendance. A pre-existing attendance record may be corrected after event cancellation when the caller still has current attendance authority, supplies the exact attendance version, resolves the participant against the current audience, and provides a reason of at least 12 characters. The audit row marks this path as `post_cancellation_attendance_correction`.

Event timezone values must be valid IANA identifiers. Attendance input is a local wall-clock value paired with the event timezone, and the command timezone must exactly match the event timezone. The interface labels the input with that timezone. It receives eligible participants as a Core-derived display list and never asks the user to type an internal membership UUID. Switching event or Workspace remounts the attendance form so prior input cannot cross context.

## Proposed next files after shared-contract approval

- owner-approved Core adapter calling the two C01 resolvers and deriving the full tuple server-side;
- one CE persistence migration with event, interest and attendance records, RLS, guarded RPCs and atomic audit/idempotency use;
- customer API gateway that accepts `context_id` and command input but derives actor and authority server-side;
- page/navigation registration gated by the official CE Event capability;
- pgTAP concurrency, RLS, audit and zero-side-effect tests against the approved persistence contract.

M01/M02, Communications, Booking, Finance, Commerce and Loyalty are not dependencies of this slice. CE-010 and CE-012 remain unmounted pending the Communications contracts.
