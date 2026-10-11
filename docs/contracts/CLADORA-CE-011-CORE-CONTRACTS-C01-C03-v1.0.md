# CLADORA CE-011 Core Contracts C01-C03 v1.0

**Status:** Final consumer contract for CE-011 implementation planning
**Owners:** Core owns C01/C03 infrastructure; Platform/Core owns C02 activation; CE owns Event domain commands and records
**Production impact:** None; no permission seed, module activation, migration or deployment is authorized by this document

## Official identifiers

| Kind | Code | Meaning |
| --- | --- | --- |
| Capability | `ce.event.basic` | Free single-occurrence Event with explicit audience, interest/withdrawal and manually observed/corrected attendance; no capacity/time/resource allocation |
| Future module mapping | `community_events` | Independent Event module; it must not depend on Community, SERVICE or Booking |
| Future entitlement mapping | `module.community_events` | Contractual availability key; a valid legacy row with null `contract_id` remains valid |
| Read | `events.event.read` | Read Events visible under the evaluated audience policy |
| Publish | `events.event.publish` | Create/update/publish an Event and occurrence within the authorized Workspace |
| Cancel | `events.event.cancel` | Cancel a published Event without deleting history |
| Self interest | `events.interest.manage_self` | Register or withdraw the current represented participant's interest |
| Attendance | `events.attendance.record` | Record observed attendance for an assigned occurrence |
| Attendance correction | `events.attendance.correct` | Correct attendance with expected version and mandatory reason |

These identifiers are the CE-011 contract vocabulary. They are not present in the current registry and are not effective permissions until a separately approved CE database package seeds and binds them through the existing module/permission registries.

## C01 — Server-side authority and audience tuple

The client supplies only `context_id`, `workspace_id`, the domain target/request identifiers, `expected_version`, `idempotency_key`, `reason` where required, and validated domain input. The command derives and pins this tuple server-side before any replay or write:

```text
tenant_id
workspace_id
context_id
membership_id
actor_user_id
represented_party_id | null
capability_code = ce.event.basic
module_code = community_events
permission_code
target_type = event | occurrence | interest | attendance
target_id
audience_policy_id
audience_policy_version
audience_result = eligible | ineligible
assurance_level
evaluated_at
```

Required Core calls are `resolve_workspace_native_context_v2(context_id, workspace_id)` and, after the module/permission registry mapping exists, `check_workspace_native_permission_v2(context_id, workspace_id, permission_code, 'community_events')`. CE additionally validates the exact Event/occurrence Workspace, audience policy, participant representation and lifecycle state. Workspace capability availability is not action authorization.

Audience eligibility may use current membership/party/role evidence but never creates a membership, party, role, ownership relation or physical credential. `ref_community` is optional. An Event can be active without Community or SERVICE.

## C02 — Independent activation

`ce.event.basic` is available only when the future `community_events` module is active and the current entitlement evaluation is effective. The module has no dependency edge to Community, SERVICE, Booking, Finance, AIRPROP or complete PC-01/DW-02.

DW-01A reports Workspace availability only. Missing descriptive taxonomy or null `contract_id` cannot independently turn an otherwise-effective legacy right into unavailable. Every action still calls C01 with its exact permission. Disabling Event stops future CE-011 commands but does not rewrite Events, interest history, attendance receipts or audit attribution.

## C03 — Idempotency, receipt, audit and outbox

CE uses the existing `platform.idempotency_keys`, `audit.events` and `platform.outbox_events`; it does not create parallel idempotency, audit or event-envelope infrastructure.

### Idempotency scope

The canonical key stored in `platform.idempotency_keys.key` is:

```text
ce.event.<command>.v1/<workspace_id>/<target_or_request_id>/<client_idempotency_key>
```

The existing primary key `(tenant_id, key)` is the collision boundary. `actor_id` must equal the current actor. The SHA-256 request hash covers schema version, actor, context, Workspace, command, target/request ID, expected version and canonical domain input. Same key/hash/actor returns the stored receipt after C01 authority and audience are rechecked. Same key with another actor or hash, or an expired claim, is a conflict. Retry never bypasses revoked authority.

### One atomic transaction

Each accepted CE mutation must execute in one database transaction:

1. resolve C01 and recheck the exact permission/audience;
2. lock the aggregate/participant row and claim the existing idempotency key;
3. return an existing receipt only after the authority recheck;
4. verify `expected_version` and lifecycle invariants;
5. write the CE domain change;
6. create the immutable CE receipt/version;
7. insert one bounded `audit.events` row with actor, action, entity, before/after and reason;
8. insert one versioned `platform.outbox_events` row;
9. store the bounded receipt in `platform.idempotency_keys.response_ref` and status code;
10. commit.

Any failure rolls back the claim, domain change, receipt, audit and outbox together. A rejected command creates no CE business/audit/outbox side effect; bounded security/operational logging remains outside the CE business transaction. A successful replay creates no duplicate domain row, receipt, audit event or outbox event.

### Command mapping

| Command | Permission | Aggregate lock and receipt |
| --- | --- | --- |
| Create/update/publish Event | `events.event.publish` | Event/occurrence version |
| Cancel Event | `events.event.cancel` | Event version; history preserved |
| Register/withdraw own interest | `events.interest.manage_self` | Unique participant + occurrence; repeated identical request returns same receipt |
| Record attendance | `events.attendance.record` | Occurrence + participant attendance version |
| Correct attendance | `events.attendance.correct` | Same attendance row; expected version and reason mandatory |

Interest copy must state: “Registering interest is not a reservation, confirmed place, capacity allocation or admission guarantee.” Event start/end is programme information only and is not a Booking allocation.

## Open dependencies

1. CE-owned migration proposal to register `community_events`, `module.community_events` and the six permissions/bindings; not part of DW-01A.
2. CE-owned domain persistence and mutation RPC contract using the atomic C03 sequence.
3. Core/Platform DW-01A read RPC acceptance for C02 display; Event commands must still enforce C01 independently.
4. Concrete role-template/local-role assignment review. Permission codes, not role names, authorize actions.
5. Typecheck remains open until dependencies are installed and the command succeeds.
