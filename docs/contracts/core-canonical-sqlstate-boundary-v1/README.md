# CORE-CANONICAL-SQLSTATE-BOUNDARY-12

Base/direct parent: `847fa09039578eace8361ed00a4eedf815e03ded`.
Branch: `codex/program-core-service-s01-producer-01`. Scope: T10-D04 only.

## Worklog — paths recorded before implementation

New Core-owned files only:

- `scripts/generate-core-canonical-sqlstate-boundary-12.mjs`
- `scripts/test-core-canonical-sqlstate-boundary-12.mjs`
- `supabase/proposals/core-canonical-sqlstate-boundary-v1/delta.sql`
- `supabase/proposals/core-canonical-sqlstate-boundary-v1/pg-only-boundary.test.sql`
- `supabase/proposals/core-canonical-sqlstate-boundary-v1/caseplan.json`
- this README and `docs/contracts/core-canonical-sqlstate-boundary-v1/manifest.json`.

Existing installers, migrations/guards, Core11, other owners and package/config
remain unchanged. All SQL is inactive SOURCE. No parser/compile/SQL/PG/Auth runs.
Runtime NULL and both Documents slots BLOCKED. No installation/grant/activation.

## Delivered delta / precise source

This is a proposed independent guarded body delta, not a migration, native install,
a Source acceptance or a modification of accepted installers. The generator reads
ONLY exact Git-pinned Base source, emits an inactive review packet, and supports
local source generation/checking only. It has no SQL parser, pg library, connection,
installer/apply/activation command or credential input.

Canonical inputs:

- `supabase/install/v14-operations/foundation.sql` (ordinary v2 provider path).
- `supabase/install/v14-operations/building-provisioning.sql` (Core10 `_at_v1` path).

Lexical named-call closure from both workspace-native permission wrappers contains
22 mapped Core routines, no dynamic EXECUTE, and no unmapped app_private name.
Other qualified callees are only existing `auth.uid`, `auth.jwt` and
`pg_catalog.isfinite`; they are not replaced. This is NOT an overload resolution,
SQL compile/catalog or complete managed Auth implementation proof.

Exactly four catch sites per path require the same correction:

| Family | Ordinary source line | `_at_v1` source line |
|---|---:|---:|
| `workspace_context_covers_role_scope_v1` | foundation:5056 (catch5093) | building:695 (catch736) |
| `workspace_role_identity_source_current_v1` | foundation:5239 (catch5297) | building:740 (catch800) |
| `workspace_member_role_authority_active_v1` | foundation:5316 (catch5404) | building:804 (catch889) |
| `check_effective_permission_v2` | foundation:6110 (catch6158) | building:1491 (catch1533) |

The `_at_v1` family names append `_at_v1` to the ordinary names. The exact eight
signatures, definition/prosrc bytes, SHA256/Git identities and source locations
are machine-readable in caseplan.json; before images reconstruct from the fixed
Base and after images are in delta.sql. The dependency-free workspace permission
wrappers are unmodified. Nested helpers must also rethrow: fixing only the outer
root cannot recover40001 already swallowed by an inner helper.

The ONLY prosrc edit at each site inserts immediately after EXCEPTION:

```
when sqlstate '40001' then raise;
```

The existing `WHEN OTHERS THEN RETURN FALSE` bytes and all authorization predicates
remain. Removing the inserted bytes restores the complete original body exactly.
The DDL header changes CREATE to CREATE OR REPLACE where needed, because all exact
signatures MUST already exist. No IF EXISTS/IF NOT EXISTS, fake dependency, new
function signature, evaluator/store/permission, policy or managed Auth change is
introduced. No existing migration, guard, Core11 or owner source is edited.

Bare RAISE retains the native error's SQLSTATE/message/detail/hint. Other errors
inside these protected regions still fail closed as before. Cancellation57014
and assertion failureP0004 are excluded from PostgreSQL OTHERS and continue to
escape; no new cancellation catcher is added to product bodies. Deadlock40P01 and
other non40001 errors retain their existing handling; this is not a general retry
policy redesign. Invalid-time/input errors OUTSIDE a protected block keep their
original behavior; the boundary model is not a claim that every42501 anywhere
must become false.

## Proposal guards, privileges and rollback

`delta.sql` has BEGIN, transaction-local2s lock/10s statement budgets, an
UNCONDITIONAL55000 review-only guard BEFORE catalog reads/DDL, and final ROLLBACK.
It cannot be advertised as an installer or activated by deleting the guard. A
future authorized executable payload requires separate review; accepted sources
and this hold stay intact. Guard failure may abort before the final statement:
the future executor must explicitly establish same-lease ROLLBACK/ReadyForQuery and
cleanup; presence of ROLLBACK text alone is never an ACK or success receipt.

Beyond that hold the proposed checks are strict: PG17, every existing exact
regprocedure, original prosrc bytes/SHA256, PL/pgSQL/STABLE/SECURITY DEFINER,
non-strict scalar boolean and source-pinned search_path. Missing/changed/malformed
prestate stops before replacement. Executor needs ACTUAL owner privileges and
schema CREATE; membership ADMIN is not SET or inherited owner authority. No
executor/profile is selected and no superuser/postgres privilege is presumed.
No SET ROLE, GRANT, ownership transfer or ALTER DEFAULT PRIVILEGES occurs.

After the eight replacements, assert exact postsrc hashes, same full pg_proc
attributes/OIDs/owners/ACLs (excluding ONLY target prosrc), no source changes to
unrelated routines including managed Auth, unchanged pg_default_acl and target
pg_depend. Any unexpected delta fails and must rollback. These checks are SOURCE,
not evidence of real DDL success or target compatibility. Native effective
ownership/ACL/RLS/search_path/DDL hooks and before/after catalog acceptance remain
separate execution gates. Current target, role and execution authority are NULL.

## Limited future PG-only request / no execution now

`pg-only-boundary.test.sql` is a purposefully narrow native witness SOURCE for
exception-clause semantics. It DOES NOT install or clone the full evaluator, call
Auth, fabricate canonical tables or test an allow decision. It creates16 private
pg_temp invoker wrappers carrying the eight EXACT before/after handler clauses,
with a synthetic fault raised INSIDE each protected region. Normal true/false
controls are function-return controls, not product authorization fixtures.

Caseplan fixes a disposable PG17 database `core_sqlstate_boundary_proof`, an
ordinary non-superuser/non-BYPASSRLS executor with TEMP/own temporary-function and
PL/pgSQL language rights, no function default-ACL rows, no existing auth/app_private/
identity/platform namespaces. PUBLIC EXECUTE is explicitly revoked on every new
temporary wrapper. No role or positive grant is created. The guard acknowledgement
GUC is an accidental-execution latch, NEVER an approval or an authority source;
real target/executor/authorization bindings remain NULL and NOT_RUN_NOT_PASS.
Platform/coordinator must bind and approve the exact request before execution.

Order: review/hash/preflight → one SERIALIZABLE transaction → bounded local budgets
and PG-only guard →16 temporary wrappers → matrix/oracles → final ROLLBACK →
same-backend positive cleanup ACK and fresh observer verification. Guard failure,
timeout/cancel, partial/unknown settlement means STOP/UNKNOWN; no blind retry or
success receipt. Request must identify actual backend/attempt and observer; none
is guessed here. Existing Platform runner is not changed or invoked.

11 cases x8 boundaries x2 versions =176 PLANNED native calls, NOT EXECUTED:

- normal true and false: identical before/after controls;
-40001: predecessor false, successor bare-rethrows40001;
-57014 andP0004: both versions propagate unchanged;
-42501,22023,42P01,40P01,XX000,P0001 inside the region: false before/after.

Future GET STACKED DIAGNOSTICS oracles compare returned SQLSTATE plus exact
synthetic message/detail/hint for every propagated condition. Raising SQLSTATE40001
is a boundary-semantics witness if actually run; it is NOT a genuine concurrent
SSI conflict. Actual timeout/backend cancellation, two-connection SSI, full
canonical evaluation/managed source, stored privilege and Core11/native transport
coupling need separate authorized proof. All remain NOT_RUN, not model-PASS.
No real source errors, data, credentials or raw logs are embedded.

## Actual offline evidence / immutability

- `node scripts/generate-core-canonical-sqlstate-boundary-12.mjs --write`: generated
  ONLY these inactive source artifacts, no SQL execution.
- `node scripts/generate-core-canonical-sqlstate-boundary-12.mjs`: deterministic
  source/identity comparison with the pinned Base.
- `node scripts/test-core-canonical-sqlstate-boundary-12.mjs`:25 new source/byte and
  explicitly labeled JS-model groups PASS. Coherently recomputed identity negatives
  reject missing/incorrect rethrow, ordinary/cancellation/predicate edits, duplicate
  boundary, changed source/target, removed guard, COMMIT, default ACL/positive grant,
  extra SQL and fabricated execution binding/expected native state.
- Limited JS lint/syntax/diff/JSON/hash/inventory checks. No TS/product edit, so
  prior typecheck/Core11/CE/S01/SERVICE suites are not rerun for status.

The model's counterexample is old40001→false versus proposed40001→model exception.
It is NOT a real SQLSTATE result. Native SQL/parser/compile/PG/Auth/install/grant/
activation/merge/deploy and full Release acceptance are NOT_RUN. T10-D04 has a
source delta for review; runtime acceptance is not closed. D01/Core11 and D02/D03
are unchanged; runtime=NULL and both historical Docs slots remain BLOCKED.

قابل خودکارسازی: نیازمند بررسی؛ ورودی source پین‌شده و clause دقیق، فرصت استخراج و کنترل byte/hash؛ تصمیم انسانی Core/coordinator/Platform برای پذیرش و proof؛ اجرا فقط با binding و اختیار مستقل؛ mismatch/UNKNOWN به همان مالکان؛ وابستگی رسمی PG-only و native authority/host proof؛ ارزش سنجیده نشده. این ثبت مجوز اجرا نیست.
