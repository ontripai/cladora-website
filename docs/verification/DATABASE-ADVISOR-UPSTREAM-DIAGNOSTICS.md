# Database Advisor: upstream diagnostic boundary

This is an evidence inventory, not a waiver or release approval.

The official pinned local image runs PostgreSQL 17.6, pgTAP 1.3.3 and
plpgsql_check 2.7. The CLI is 2.84.2. Tests 216 and 219 verify installed
signatures, extension membership, exact definition hashes and runtime behavior.
Unknown versions, signatures or changed diagnostic tuples require review.

| Functions | Raw SQLSTATE | Observed boundary |
| --- | --- | --- |
| plan, add_result, check_test, _currtest | 42P01 | TAP cache/sequence state is absent in an uninitialized session; cold and initialized calls are tested separately. |
| _prokind, has_tablespace | 42703 | Static analysis visits legacy catalog branches; runtime probes verify the current PostgreSQL branch. |
| _def_is, row_eq | 42883 | Polymorphic static calls cannot resolve the tested type combination; valid typed and incompatible calls are tested separately. |

The global lint report retains all eight raw errors and all warnings. The
inventory gate only proves that no unexpected error was added: zero application
errors and exactly these eight unchanged upstream diagnostics. It does **not**
mark these eight findings resolved. Warning remediation is not covered here.

The Assets-only lint gate separately requires zero errors with `--fail-on error`.
Its explicit nine-column record bindings preserve existing domain logic and
ACLs; tests 215, 217 and 218 exercise ordinary-role boundaries. Denial coverage
of all 22 public wrappers is not proof of every positive business workflow.

No upstream function replacement, extension upgrade, suppressing annotation,
remote database action or Production change is performed. Hosted backend,
real-data, device and Release acceptance remain separate gates.

Initial catalog evidence: exact SHA
`a942c805b9691c6f0790d49c99d85943610b991d`,
[Coordinator report](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6312584982).
