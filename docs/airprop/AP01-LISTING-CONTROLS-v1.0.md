# AP01-LC-01 — listing edit, withdrawal and republish controls

**Owner:** AIRPROP

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AIRPROP commercial lifecycle v1 / PR #310

**Status:** Implemented on a development branch; database runtime acceptance pending

## Scope

This additive slice closes the AP01 control gap for an existing AIRPROP listing. It adds three commands without changing canonical Resource, ownership, lease, Workspace role or payment contracts:

- edit the publication availability window;
- withdraw a published listing with a reason;
- republish a withdrawn listing with a new availability window.

## Safety and authority

- The client supplies no actor, tenant, role or permission decision.
- The existing server-side `airprop.opportunity.manage` and property-mandate resolver remains authoritative.
- Every command requires the current listing version; stale commands fail with a conflict.
- A listing with an active reservation cannot be withdrawn or republished.
- Editing is allowed only while published; republishing is allowed only from withdrawn state.
- Exact idempotent replay returns the recorded result; reuse of a key with changed input fails.
- Every successful change creates an immutable AIRPROP revision and a shared audit event.
- The revision table has RLS enabled and no direct Data API grants.

## Verification

| Check | Result |
| --- | --- |
| Route positive and negative checks | 22 passed |
| TypeScript typecheck | Passed |
| ESLint | Passed |
| Database package static contract | 238 migrations, 163 test files, 5126 assertions passed |
| Local pgTAP runtime | Blocked: Docker/Podman is not installed in the execution environment |

The migration file is a development artifact only. It has not been applied to Supabase Production.
