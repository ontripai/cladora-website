# CLADORA Core COM-01 communication request/receipt v1.0

**Baseline:** `feat/core-auth-01-authority-decision@3c6f097bb8ae3c9d03ad04a8d371ba2151a1de12`

**Owner:** Core Communications owns the shared request/receipt envelope and current communication delivery records. Domain owners own the event and business state that requests communication.

**Delivery boundary:** additive TypeScript contracts and static mapping only. No migration, endpoint, transport, queue worker, recipient registry, central manifest rewrite or Production effect.

## Existing sources reused

COM-01 maps to the existing `communications.channels`, `communications.channel_members`, `communications.notifications`, `communications.notification_preferences`, `communications.official_notices`, `communications.notice_recipients`, `communications.delivery_attempts`, `communications.notice_acknowledgements`, `communications.statutory_evidence` and `platform.outbox_events` sources.

It creates no parallel feed, notification, conversation, outbox, audit, idempotency, template, delivery-attempt or statutory-evidence engine. Existing private conversations and official-notice lifecycles remain distinct; the envelope does not merge them.

## `communication-request-receipt.v1`

The request pins an idempotent request ID/key, explicit context/Workspace, domain source entity and exact source version. It contains a purpose, bounded audience policy, ordered channel preferences, template/version, locale, opaque content reference and delivery class. It never accepts raw recipient email, phone number, address or arbitrary rendered body.

Audience selection is one of:

- the current actor only;
- an accepted Workspace audience policy;
- parties selected by an accepted relationship policy over `canonical-resource-reference.v1`.

The audience selector is not an authorization grant. The adapter must resolve the actor, current source version, exact domain permission, audience eligibility, communication preferences and channel policy server-side. Retry rechecks all current authority and audience conditions.

An accepted receipt proves only that Communications accepted an idempotent request and recorded its current delivery evidence. It does not prove delivery, acknowledgement, statutory service, audience eligibility at a later time or authorization for another action. `delivery_authorization = not_implied` and `action_authorization = not_evaluated` are invariant.

A rejected receipt contains no resolved audience, selected channel or delivery evidence. Delivery evidence with status `delivered` is channel evidence only. Digital notice acknowledgement remains separate from physical statutory evidence; a statutory request may remain `statutory_evidence_required` until the existing statutory lifecycle records valid evidence.

Recipient disclosure is always `withheld`. Consumers receive delivery references and attempt versions, not recipient identifiers or provider payloads. A content reference must identify an already-authorized immutable/versioned source; it is not a storage path or secret-bearing payload.

## Atomicity and idempotency boundary

A future command adapter must reuse the existing `platform.idempotency_keys`, `audit.events` and `platform.outbox_events` pattern. Within one transaction it must validate the source version and current authority, resolve the audience/channel policy, record or replay the communication receipt, write audit evidence and enqueue the existing outbox event. A repeated key with a different request fingerprint must fail closed.

The envelope does not itself send email/SMS/push, mark a notice delivered, acknowledge a notice or manufacture statutory evidence. Workers and official-notice commands continue to own those transitions and their retry rules.

## Existing verification and future runtime gate

Repository evidence already covers the customer projection, official notice lifecycle, delivery attempts, acknowledgement/statutory separation, private conversations, authorization and route containment through:

- `scripts/test-customer-communications-slice.mjs`;
- `supabase/tests/039_customer_communications.test.sql`;
- `supabase/tests/063_official_communications_delivery_evidence.test.sql`;
- `supabase/migrations/20260825001800_communications_feed_polls_notifications.sql`;
- `supabase/migrations/20260829005000_customer_communications_notifications_dashboard.sql`;
- `supabase/migrations/20260909115850_official_communications_delivery_evidence.sql`.

This slice does not repeat those runtimes or claim a new database execution. A future adapter requires a selected first consumer, exact source permission/audience mapping, atomic replay tests, suppressed/preference behavior, failed/delivered transitions and zero recipient leakage in a disposable database.

CI success is evidence, not acceptance, merge authorization, remote migration authorization or Production release. Documentation & PM owns the central manifest and final acceptance; this branch does not modify either.
