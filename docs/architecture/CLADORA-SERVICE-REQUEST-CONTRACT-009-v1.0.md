# SERVICE request contract 009

This package validates the first request before quote or order creation. It is a pure contract, not a live route or authorization mechanism.

The caller supplies the canonical context/workspace tuple, offering ID, exact published revision ID, beneficiary party reference, description and retry key. Unknown fields are rejected, including actor, tenant, price, payer, status and execution/document references. The request creates no commercial or financial commitment.

The planning check rejects a different workspace/offering, a changed publication pointer, an unpublished/suspended offering, future validity, expiration and malformed dates. Revision changes require the customer to reread the offer; no silent replacement of accepted terms is allowed.

Persistence follow-up must consume canonical current Workspace authorization, validate the beneficiary through the existing party registry, and lock/re-read the publication pointer inside the transaction. The offering state passed to the pure planner is server data; it must never come from the request body. Reuse the existing idempotency, audit and outbox protocol. Location-dependent offerings must wait for the shared location/resource adapter; this payload must not be treated as sufficient for booking or work-order creation.

No migration, access grant, payment, work order, route or customer UI is introduced here. Current deployed acceptance evidence: pilot offer b88ab924-7c5c-48df-9230-9a3342fa5f6c was published by a separate approver and visible to Mahmoud on 2026-10-04, revision lock 3, audit/outbox count 3. Catalogue and review entry are deployed (#222, #225, #228, #235, #238, #245); login error classification is deployed (#248). Orders, reservations, reception and benefits remain separate implementation work.

Tests execute the actual TypeScript contract: strict validation and attempted actor/financial injection, Workspace mismatch, stale revision, status and time boundaries. CI runs these alongside the existing catalogue contract and application checks.
