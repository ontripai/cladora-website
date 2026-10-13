# SV-SUBJECT-LINK-01 — inactive Request/private-message link

This package binds the existing `serviceCollaborationIntentV1Schema` message
operation to `CoreTransactionProvidersV2`. It does not define another command,
receipt, authority, message store, audience policy, audit ledger, outbox or
idempotency store.

## Canonical ownership

- Core owns the serializable transaction, lock order, current authority,
  idempotency claim/readback, audit event, outbox event and V2 receipt.
- Communications owns the message, version, lifecycle and actor read access.
- The CE-owned `communications.private_message_request_audience` provider owns
  the beneficiary/provider party audience decision. SERVICE consumes that
  provider and does not reproduce its membership or party resolution.
- SERVICE owns only `service_catalog.request_subject_links` and the associated
  Request version increment.

## Authority and version boundary

The Core command uses the dedicated `services.orders.subject_link` permission in
`services_orders`. The migration defines that canonical permission and its
non-delegable, AAL2 module binding, but assigns it to no role and grants no
client function access. `services.orders.read` and `services.orders.request`
cannot authorize the mutation.

The command and CE provider bind `aggregate_version` to the locked current
Request version. A successful domain mutation increments that version exactly
once and records the resulting version on the link. The mutation callback
rechecks the dedicated permission and the CE audience gate after acquiring the
Request lock.

The SERVICE link insert and Request version increment execute through the Core
host mutation callback. Core then writes its existing idempotency, audit, outbox
and receipt effects in the same PostgreSQL transaction. A denial or any later
failure rolls back every effect. Exact replay is handled by the Core ledger;
changed replay fails closed.

## Activation state

The composition is deliberately unwired. The migration grants no table or
function access to `PUBLIC`, `anon`, `authenticated` or `service_role`; there is
no role assignment, route, production consumer, notification send or Remote
apply in this package.
