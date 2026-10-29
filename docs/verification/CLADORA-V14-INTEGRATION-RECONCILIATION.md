# Release integration reconciliation

The release remains a Preview candidate. Main and the production aliases are unchanged.

## Environment separation

Management metadata verified two distinct healthy Supabase projects:
CLADORA (`jyomlehahwlyqzoacrvp`) and cladora-staging (`ryygcqiunqqtfkpkflzf`).
Only the public Supabase URL and existing publishable key were configured for the
`release/cladora-v14` branch, targeting Preview only. Production variables and server
credentials were not copied or modified. No SQL, migration, role or Auth administration
was performed against either project. Public configuration is not installed schema or
authenticated runtime proof.

## Corrections

- The static SQL test counter now accounts for mutually exclusive psql branches,
  `col_is_null`, `matches` and `no_plan` with a required dynamic-plan finish. Negative
  checks reject inconsistent plans, unequal branches and missing/duplicate plans.
  The SQL source files are unchanged. The manually gated Checklist native proof is
  sealed to its reviewed SHA256, not counted as TAP assertions, and explicitly reported
  as NOT_RUN_NOT_PASS. Unknown planless files continue to fail.
- The Documents ACL inventory check retains its original 296-file count after excluding
  exactly the four reviewed B01 additions, whose hashes are independently checked.
  Installed privileges are not inferred from this source check.
- The Checklist gateway harness resolves real local imports introduced by the accepted
  source. Existing validation, authentication, origin and conflict assertions pass.
- Demo app routes use their own shell instead of nesting the marketing header/footer.
  The demo-only shell wraps its top controls on narrow screens and allows its content
  column to shrink. Its authenticated application counterpart is unaffected.

## Verification and remaining failures

The complete `test:db:static` chain passes locally, including all downstream Documents
and Communications source checks. The boundary suite passes 79 offline checks.
Typecheck, lint and the local Webpack production build pass with the recorded existing
local Next16.3.8/Zod4.4.3 dependencies. Vercel built the previous audited commit using
the target Next16.4.1 toolchain; each new commit still requires its own deployment check.

Native Chromium checked 24 local route/viewport combinations in RO/EN/FA at 390 and
1365px: marketing, isolated demo dashboard, unavailable demo module and unauthenticated
app-to-login redirect. External requests were blocked and no credentials or data writes
were used. These checks do not establish real Auth, RLS, installed RPCs or persistence.

The broader historical `test:unit` chain is not PASS: after the fixed Checklist gateway,
its legacy lifecycle fixture cannot load the new durable panel/command gate. That
fixture must be reconciled with the actual canonical command protocol; re-enabling old
mutation routes or dropping its assertions is not a fix. The dedicated release suites
remain additional scoped evidence, not replacements for failing required checks.
The quote fixture now tests both the changed-key-body replay conflict (23505) and a
fresh-key stale revision (40001), with unchanged row counts. It also recovers its expected
failed statement using a savepoint before continuing a transaction-level observation.
All 34 sequential scenarios pass in isolated PGlite0.5.3 with bounded authority fixtures;
this does not prove native PG17 concurrency or managed Auth. Native/runtime and connected proof jobs remain
independent release gates. No failed check has been disabled or represented as passed.
