# SERVICE quote presentation 015 — v1.0

Adds explicit non-binding presentation of an immutable draft to its verified requester. The catalogue and draft APIs retain their contracts. `services.quotes.publish` is a separate, non-delegable AAL2-bound permission in the existing `services_orders` module. The migration grants no role, activation or user access.

`publish_service_quote_v1` accepts only the canonical context/workspace, quote ID, expected version and idempotency key. The existing request row lock serializes presentation against draft creation. New presentations require the latest unexpired draft, live canonical publication authority, a current unarchived beneficiary mapping and an unarchived provider. Exact retries recheck current authority and relationships before reconciling a committed result even after supersession/expiry. A different key cannot re-publish the same version. Publication, audit, outbox and retry response commit atomically; both draft and publication records are immutable.

The coordinator projection requires `services.quotes.manage`; publication still independently requires `services.quotes.publish`. The recipient projection requires `services.orders.read`, the original requester user AND membership, its current verified party link, and a publication record. Drafts belonging to other users or unpublished versions are never exposed. Both projections are workspace/tenant scoped, bounded to the latest 50 matching versions and distinguish presented, superseded and expired states. Supersession is conservatively derived from any newer draft; the historical publication remains visible. Direct table access is revoked and RLS enabled; authenticated RPCs use fixed search paths and the existing canonical authorization helper.

The same-origin JSON API rejects unknown, duplicate and invalid parameters. RO/EN/FA views show the exact amount, proposed provider/payer, scope, version and expiry. The UI explicitly says tax treatment and provider approval remain pending, and no acceptance/order/payment is possible. Presentation creates only an in-app projection and outbox event, not email/WhatsApp delivery. No external notification integration is added.

Unknown outcomes freeze the original command for same-key retry; scope changes unmount it and ignore late replies. Confirmed publication remains confirmed if refresh fails. Permission/validation/conflict failures require refresh. No financial acceptance controls exist.

## Remaining acceptance gates

Commercial acceptance requires explicit tax treatment from shared Finance, verified provider/contracting-party authority, immutable terms and independent payer acceptance. No invented VAT rate, provider representation, payment share approval or order is introduced. Shared relationship and financial functions remain dependencies rather than competing SERVICE implementations. This step does not complete the full SERVICE roadmap.

## Isolation and verification

Base: `7d317d3` (#259). Open Operations PRs #258 and #260 were inspected before implementation; this change adds only SERVICE migration/API/UI/tests and updates its own workflow. No Operations/AIRPROP/shared authority implementation is modified.

Behavioral tests execute the actual migration with isolated PostgreSQL fixtures (canonical resolver fixtures, not a substitute for the core native-authority suite), API requests and mounted React views. CI also exercises two independent PostgreSQL connections for retry serialization and a new draft racing presentation. The shared database CI remains a release gate.

## Lifecycle reference received during implementation

The user attached the lifecycle package v1.1. Its unchanged source and SERVICE requirement/evidence/dependency matrix are registered in [SERVICE lifecycle alignment v1.1](CLADORA-SERVICE-LIFECYCLE-ALIGNMENT-v1.1.md). Presentation 015 does not complete LC-S01 or LC-S02 and creates no competing Core or Operations model.
