# SERVICE pilot self-person enrollment

A SERVICE requester may have valid workspace permissions without a person mapping. This pilot-only command creates a new synthetic person for the authenticated account's current membership. It does not verify legal identity or connect an existing person's records.

## Authority

The database derives actor, tenant and membership from the verified session and canonical workspace-native authority. AAL2, a confirmed email, a non-anonymous account, an active PILOT workspace, active own membership, and current services.orders.read/request permissions are required. The client cannot supply actor, tenant, membership, existing party or ownership identifiers.

The new person is labelled PILOT TEST. The mapping has a required future expiry within 72 hours. Existing mappings, including expired ones, require review and cannot be replaced or extended by this command. No ownership, occupancy, lease, vendor affiliation, delegation, role or financial record is created.

## Transactions and retries

Membership locking serializes enrollment across different keys. SQL computes the request fingerprint. Person, mapping, audit, outbox and idempotency response commit together. Exact retries must still satisfy live authority and mapping validity. Changed commands conflict. The UI freezes the exact command after an uncertain response and rejects a response with a mismatched expiry.

The route accepts same-origin JSON and a strict six-field payload. Errors are sanitized and responses are private/no-store. Anonymous and public execution of the RPC are revoked; authenticated callers have access only through the guarded command.

## Verification

Isolated PostgreSQL tests exercise authentication, authority, tenant/context isolation, pilot status, bounded expiry, immutable existing mappings, injection rejection, atomic failure, replay and concurrent different/same keys over independent PostgreSQL connections. Mounted RO/EN/FA tests verify own-account confirmation, exact expiry, lost replies, double submission and obsolete responses. SERVICE request tests continue to require a live membership-party mapping.

This is a pilot enrollment path. Production legal identity verification and attaching existing parties require a separate reviewed workflow.
