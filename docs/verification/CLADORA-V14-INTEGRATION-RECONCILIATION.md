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

Read-only staging inspection subsequently returned no application tables in the
requested public/platform/identity/portfolio/customer_api/assets/maintenance/documents/
communications schemas, and an empty migration history. No user records were requested.
The staging backend still needs a separately validated installation profile.

The lifecycle component fixture now loads actual current modules and models the public
command-result port explicitly instead of dispatching removed legacy mutation routes.
The independent release Checklist/summary suites continue to exercise the real gate,
client, canonical wire and receipt protocol. Dashboard fixtures provide matching Context,
current dashboard and valid response schemas; parent private snapshots are asserted
separately from freshly authorized child observations. DOM identity failures are reported
as bounded booleans rather than recursively dumping React/DOM graphs.

This reconciliation reproduced an actual component admission gap on commit50ff9945:
a known command reply followed by a failed current read allowed a stale mounted handler
to submit another command before React committed. The correction holds edits/submission
until a successful current observation commits in the same scope. Known replies stay
known, true UNKNOWN remains held, and canonical rejections retain their existing behavior.
The exact previous component fails the counterexample; the corrected component passes
527 lifecycle/dashboard assertions and 40 settlement scenarios / 562 assertions. These
are mounted component tests with a controlled command-result port, not real DB effects.
The original accepted component identity is retained as an intermediate composition pin.
The complete `npm run test:unit` chain subsequently passed with loopback networking
available for its deliberate offline-database rejection probe. The earlier restricted
sandbox run could not produce that probe's expected ECONNREFUSED response. No test
assertion was relaxed for the sandbox. Registry/calendar fixtures now verify the closed
legacy POST (428, zero RPCs), real current intent validation and authenticated read mapping.

The summary ACK test now waits on the real client's ready state with a 2-second failure
bound after releasing the controlled ACK. It retains all receipt/privacy assertions.
Safe local Supabase startup diagnostics expose only allowlisted migration names,
SQLSTATE and fixed categories; raw CLI output and credentials remain withheld.

The later Communications fixture passes 33 mounted scenarios across all three locales.
It resolves the actual transport, expects omitted blank optional translations, and
checks localized denied feedback without reflecting an arbitrary raw server message.
The current country-signal inventory supplement classifies five byte-exact additions
from the official Platform264 manifest; the historical audit and its 15 findings remain
unchanged. Address presentation, current audit and application foundation checks pass.

The AIRPROP fixture loader resolves actual TSX files as well as TS modules. The
error-body suite isolates its unrelated valuation sibling and uses the current localized
error copy. All 111 mounted original-response controls pass: targets, opportunities and
B2 in EN/RO/FA, reader cancellation, malformed/oversized/deadline bodies, late Context
and exact pending-command retry. The B2 regression suite also passes. These are native
Response/ReadableStream objects with mocked fetch, not connected PostgreSQL/Auth proof.

On commit7ced0c47, CI completed with 27 successes, 9 failures and 1 skip. One remaining
application fixture failure is corrected in this follow-up. Native startup reached
`20261025214155_building_setup_command_receipts_v1.sql` and returned SQLSTATE55000.
Its first DO block unconditionally raises `building_g2_inactive_source_only`; this is
an independent, fresh-install source packet, not an authorized sequential migration.
Its guard and all null proof/authority bindings remain intact. Removing that guard,
claiming baseline-only tests prove G2, or installing the packet in hosted staging would
not be a valid fix. A separate installation/profile and native proof gate remain open.
Outer CI wrappers now preserve the same redacted diagnostic summary on failure.

The quote fixture now tests both the changed-key-body replay conflict (23505) and a
fresh-key stale revision (40001), with unchanged row counts. It also recovers its expected
failed statement using a savepoint before continuing a transaction-level observation.
All 34 sequential scenarios pass in isolated PGlite0.5.3 with bounded authority fixtures;
this does not prove native PG17 concurrency or managed Auth. Native/runtime and connected proof jobs remain
independent release gates. No failed check has been disabled or represented as passed.


## Exact local baseline migration profile

Eight native jobs stopped before their suites at the unconditional SQLSTATE 55000 guard in `20261025214155_building_setup_command_receipts_v1.sql`. This independently sealed fresh-install G2 packet is not an incremental migration. Its 732202 bytes, guard, proof bindings, inventory attribution and SHA-256 `254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3` remain unchanged.

The disposable local/CI bootstrap now builds a fresh unlinked `baseline-v14` profile: all 300 source identities are verified, then the 299 sequential migrations are copied outside the source tree. Only the exact inactive G2 packet is excluded from automatic CLI migration discovery. The existing staged S4 denial, separately authorized STEP-SU-02 and final ACL checks remain required. Before native suites run, the original G2 source is submitted separately to local PostgreSQL and must reject with SQLSTATE 55000; migration history must not claim it was installed. No test suite or application assertion is disabled. Native jobs therefore prove the sequential baseline only; G2 remains `NOT_INSTALLED_NOT_PROVED`.

Offline profile controls verify exact after-images, preservation of all source files, omission of linked credentials, and rejection of changed inputs, inventory drift, unsafe destinations and reuse before allocation. This does not authorize hosted database changes, G2 installation, production promotion, or reuse of consumed rehearsal requests. Native CI results are reported separately.

The first baseline native run passed both Advisor probes and multiple connected HTTP/browser jobs, exposing three additional verification issues: four SERVICE/Core/CE inventory assertions still assumed the historical 296 files; the quote-version pgTAP check depended on a pretty-printed CHECK string; and the browser denial harness expected superseded AIRPROP copy. The inventory checks now retain 296 historical files plus independently hash-checked B01 additions. Active role-safety checks remain intact; the byte-sealed, unconditionally guarded G2 packet is expressly an independent inactive role graph. The quote test now exercises the installed constraint expression with NULL, minimum, maximum, zero, negative and unsafe-positive values. Browser assertions retain exact localized matching and all authority/network/cleanup checks using accepted current copy.

The explicit pgTAP runner executes every TAP file. The separately sealed, manually authorized Checklist native proof is not a TAP test: it remains unchanged and explicitly `NOT_RUN_NOT_PASS`, as already required by the static package checker. It is not assigned a synthetic success or supplied fabricated session/authority bindings.

Native execution confirmed all six quote-version boundary cases pass. Explicit CLI file arguments exposed a staging behavior that omits relative `.inc` fixtures; the runner now passes a complete fresh local profile, retaining every fixture and all 218 TAP files. An offline CLI contract verifies fixture preservation, local-only arguments, failure propagation and temporary-directory cleanup. The independent workflow preservation gate (44 controls) now verifies exact suite equivalence for this intentional runner change; the separate disabled G2 execution lane remains disabled and ungranted.

After TAP passed, the full native job exposed legacy Building Setup harness expectations: the safe cleanup helper had replaced a literal `finally` block; authenticated forms now correctly start blank rather than with synthetic defaults; and the separate G2 branch adds three counter sites without removing the 15 baseline sites. The integration gate now checks the registered `source-end` cleanup, the mounted harness explicitly enters its synthetic fixture and verifies blank/new-Context/no-dispatch behavior, and the safety check accounts for the three G2-only sites separately. All 882 mounted assertions, 93 mocked API checks, eight source negative controls and 29 cleanup/safety controls pass locally. No application component, migration, cleanup implementation or authority behavior changed for these corrections.

The next native preflight reached the owned clone runner and exposed its legacy registry allowlist: the pinned official CLI sets `SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`, while the runner recognized only Supabase ECR/Docker Hub names. The same exact `postgres:17.6.1.095` tag is now accepted under `ghcr.io/supabase/` too. Full-SHA lease, project label and version remain mandatory; negative controls reject foreign GHCR owners, `latest` and tag suffixes. The 29 offline safety controls pass. This change only affects the CI-owned clone harness, not application or hosted database authority.

The owned concurrency clone then reached full snapshot/restore and failed there, before application assertions. Managed Auth/extensions are part of that snapshot. Backup and restore now use the already available disposable `supabase_admin` operator, with restore still confined to the validated fresh `cladora_setup_fixture_*` database; actual fixture/proof calls remain under their original runtime identities. No grant, role mutation or hosted operator was added. Four additional safety controls verify bounded SQLSTATE diagnostics without forwarding raw stderr. Native re-verification is required; the prior failed snapshot is not relabeled a pass.
