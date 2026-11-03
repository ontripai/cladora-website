# CLADORA C14 Workspace cost benchmark v1.0

This minimum runtime slice compares posted/reversed expense-account movements for the selected Workspace and period with the immediately preceding period of equal length. It reads the existing Finance ledger; it creates no analytics ledger, cost record, journal, regional cohort or write path.

`workspace-cost-benchmark.v1` is scoped by the explicit Workspace, current AUTH-01 `finance.reports.read` decision, active `accounting` module and current Workspace/property bindings. It returns category code/name, current/previous amounts, deltas, currency, exact periods and source semantics. Tenant IDs, actors, journal IDs, entry IDs and unbound-property accounts are withheld.

The comparison kind is always `workspace_prior_period`. Regional/neighborhood comparison is `withheld` with `approved_regional_dataset_unavailable`; internal Workspace history must never be presented as a regional benchmark. A future regional adapter requires an approved retained dataset, cohort/privacy rules, freshness/version evidence and separate review.

The bounded GET API and the existing Financial Reports page are the real consumer. The projection is zero-write and does not mutate or recreate FIN01 or the Finance ledger. Local tests are review evidence only; they do not authorize activation, merge, remote migration, Production deployment or publication.
