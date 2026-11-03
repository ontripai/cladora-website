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

## Official-source follow-up

The official pgTAP [1.3.3 to 1.3.4 comparison](https://github.com/theory/pgtap/compare/v1.3.3...v1.3.4)
and the SQL sources at both tags were inspected: all 15 overload definitions
in these eight function families are byte-identical. An upgrade to 1.3.4 is
therefore not a demonstrated fix for these diagnostics and was not performed.

The [CLI 2.84.2 mass-check query](https://github.com/supabase/cli/blob/v2.84.2/internal/db/lint/templates/check.sql)
checks every PL/pgSQL function in a schema, including extension members, using
the checker's default context. The [checker 2.7 SQL contract](https://github.com/okbob/plpgsql_check/blob/v2.7.0/plpgsql_check--2.7.sql)
defaults its historically misspelled `anyelememttype` argument to integer.
Its [documented temporary-table limitations](https://github.com/okbob/plpgsql_check/blob/v2.7.0/README.md#temporary-tables)
are relevant to TAP session caches.

`scripts/sql/advisor-extension-context-probe.sql` is a separate rollback-only
experiment, not a replacement for global lint. It retains raw diagnostics for
18 cold/default, initialized/default and initialized/typed observations. Exact
version, checker membership/signature, original function hashes, completeness
and rollback are gated. The warm/typed hypotheses must pass in disposable CI
before their results can be claimed. The global eight-error inventory is
unchanged; this experiment does not mark any finding resolved or grant Release.
