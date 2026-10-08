# AP02-RSV-01 — commercial reservation controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP01-LC-01 / Draft PR #315 at `27a69d2d2067a0770115f08c29fcc7d19605f91a`

**Status:** Locally verified; ephemeral database runtime and Draft PR evidence pending

## Scope

This additive slice controls an existing AIRPROP exclusive commercial reservation. It adds four versioned commands:

- cancel an unexpired reservation;
- record expiry only after its agreed deadline;
- extend an unexpired reservation within the listing availability window;
- convert an unexpired reservation into a typed commercial handoff receipt.

## Safety and authority

- The existing server-side `airprop.opportunity.manage` and property-mandate resolver remain authoritative.
- The client supplies no actor, tenant, role, permission decision, ownership or membership fact.
- Stale versions, changed idempotency payloads and invalid state transitions fail closed.
- The existing exclusion constraint remains the single-winner control for overlapping unit reservations.
- Cancel or expiry returns the listing to `published` only while its availability remains current; otherwise it becomes `withdrawn`.
- Conversion completes the listing and rejects remaining active applicants, but creates no title, canonical lease, membership, journal or payment.
- Every successful transition creates an immutable AIRPROP revision and shared audit event.
- The revision table has RLS enabled and no direct Data API grants.

## Verification

| Check | Result |
| --- | --- |
| Route positive and negative checks | 27 passed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| Database package static contract | 239 migrations, 164 test files, 5142 assertions passed |
| Local pgTAP runtime | Not available: Supabase CLI and Docker/Podman are absent from the execution image |
| GitHub Actions database runtime | Pending Draft PR push |

The route checks use synthetic requests and no human account. Ephemeral GitHub Actions is required for pgTAP runtime evidence.

The migration file is a development artifact only. It has not been applied to Supabase Production.
