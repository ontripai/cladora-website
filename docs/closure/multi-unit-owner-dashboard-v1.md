# Multi-unit owner dashboard v1 — acceptance scope

Date: 2026-09-26

This completes the private owner pilot dashboard on top of ADR-055 and PRs 137–146. It does not activate paid owner subscriptions.

## Delivered

- Authenticated workspace choice for users with owner, platform and/or building access. Each destination retains its own authorization. Explicit owner login/MFA continuation is preserved.
- Private units, draft/activate/end/cancel lease lifecycle, personal income/expense records, and verified links to official building charges.
- Portfolio overview: active units, units with current leases, contractual monthly rent, actual receipts/payments this Bucharest calendar month, recorded unpaid overdue amounts and contracts ending within 60 days or awaiting closure. Currencies remain separate; monetary addition uses exact decimal cents.
- Recording a full payment on an unpaid personal record. This never settles an official building invoice or initiates a bank payment. Partial payments are not supported by this action.
- Paginated unit records (100 per page), annual bookkeeping summary and formula-safe UTF-8 CSV in Romanian, English and Persian.
- All new owner/account interface text, errors, status labels and CSV headings/categories have RO/EN/FA versions. Persian uses RTL. ISO dates and currency codes remain unambiguous across locales. User-supplied names are not translated.

## Evidence and limits

Local executable tests cover 81 login/MFA continuation scenarios, 24 role combinations, exact monetary sums, date/currency boundaries, overview pagination, access denial, payment transitions, CSV safety and all three locale labels. React DOM tests exercise delayed/failed unit loads, stale responses, form reset and saving isolation in RO/EN/FA. Existing database tests verify owner RLS, verified links and lease lifecycle.

HTTP/database boundaries in these local application tests are mocked. They do not establish a successful production login with an actual owner identity. No production identity or financial data was created for testing.

Overview reads use the user's RLS session, with no service-role client. It refuses more than 10,000 records per source table instead of returning misleading partial totals. Separate paginated reads are not a database snapshot; a concurrent edit can require refreshing the overview.

Overdue totals include only recorded unpaid items, not an automatically generated rent schedule. Renewal means ending the old agreement and creating a new draft; active terms remain immutable. Tax calculation/filing, bank execution, automatic reminders and contract-file storage are outside this dashboard release. The annual report is bookkeeping data, not tax advice or a calculated tax return.

Browser screenshot verification remains blocked in this execution environment: Chromium cannot create its process socket (`Operation not permitted`). RO/EN/FA DOM behavior is tested, but no successful mobile/desktop screenshot check is claimed. The temporary visual fixture route was removed before publishing.
