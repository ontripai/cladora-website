# AP09-UX-01 — tri-language management portfolio wizard

**Owner:** AIRPROP customer UI; AP08 remains the current-authority read model

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP08-RPT-01 / Draft PR #344 at `215b0db1dd10e826e0578f7a62bcc5da98510bc8`

**Status:** Locally verified; exact-head Draft PR CI pending

## Scope

AP09 adds an EN/RO/FA wizard to the existing AIRPROP workspace. A user explicitly selects a Workspace and then a named property, reviews the accepted management mandate scope and dates, and reviews immutable Operations references. The browser refreshes the AP08 report through a read-only `GET`; a revoked property disappears on the next refresh.

Workspace, property, unit, mandate, Work Order and action-link UUIDs remain transport identifiers and are never rendered as user-facing labels. Changing context or Workspace remounts the wizard, resets the selected property and re-reads current authority.

## Boundary

The wizard creates no authority, role, permission, mandate, Work Order, Service Order, Finance record, audit event, outbox event or resource registry. Operations retains live Work Order detail; AIRPROP displays only the immutable link-time status snapshot returned by AP08. Finance remains explicitly unavailable until its canonical receipt contract is accepted.

The read route accepts only `context_id` and `workspace_id`, requires authenticated claims, calls `read_airprop_management_portfolio_v1`, strictly validates the response and sends private no-store headers. Unknown client filters, malformed cross-domain detail and authority denial fail closed.

## Verification

| Check | Result |
| --- | --- |
| Commercial lifecycle route | 48 checks passed, including strict GET query, authentication, authority denial redaction, bounded RPC arguments and malformed-response fail-closed behavior |
| Rendered UI integration | Named properties, hidden UUIDs, three steps, EN/RO/FA direction/copy, live revocation and context isolation passed under React/JSDOM |
| TypeScript | Passed |
| Database package static contract | 245 migrations, 170 test files and 5364 assertions passed |
| ESLint / diff check | Passed |
| Production build | Webpack compilation passed; repository-wide Next route type generation remains blocked by pre-existing non-AIRPROP route exports |
| Exact-head CI | Pending Draft PR |

No Supabase Remote or Production migration and no Production deployment was performed.
