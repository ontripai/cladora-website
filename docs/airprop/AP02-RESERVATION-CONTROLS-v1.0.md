# AP02-RSV-01 — commercial reservation controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP01-LC-01 / Draft PR #315 at `6e6f6fc4996446798df9b4d85518eca762be8657`

**Status:** Exact-head CI verified; review acceptance pending

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
| Database package static contract | 239 migrations, 164 test files, 5185 assertions passed |
| Reservation pgTAP contract | 39 assertions cover direct RPC success/failure, replay, stale/null version, authority denial, audit/revision effects, listing/applicant transitions and the single-winner overlap constraint |
| Local pgTAP runtime | Not executed: the managed Docker socket denied access and no local Supabase CLI is installed |
| GitHub Actions database runtime | 39/39 assertions passed; database run `37921276462` |
| Exact-head application checks | Commercial run `37921276448`; foundation run `37921276455`; Vercel Preview passed |

The route and database fixtures are synthetic and use no human account. The overlap assertion exercises the database exclusion constraint directly; a separate simultaneous-session race harness is not claimed. Ephemeral GitHub Actions is required for pgTAP runtime evidence.

The exact tested head is `bea9e3064f1695b54eb5f468ffe41e1eae3e94cb` on Draft PR #319. Green CI and its receipt are not review acceptance or closure. The migration file is a development artifact only and has not been applied to Supabase Production.
