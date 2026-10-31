# Building G2: inactive source packet

Owner: CLADORA Core. Independent reviewer: SERVICE; coordinator: PM.
BASE `8c8225fb3297035a2349357bd968d60779388063`; historical parent
`51fdf2e30916e1ff48c5567230dae9b7b6f05029`. Target binding is exclusively
`cladora-staging / ryygcqiunqqtfkpkflzf`. This source has not been installed,
compiled, queried, activated or tested against PostgreSQL, Auth or HTTP.

Authority: [PM165](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6401614734),
[PM169 owner decision](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6402239373),
[PM170](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6402345164).
Packaging completion: [PM175](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403801070).
Unified patch/response/EOF correction: [PM176](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403870018).
The design prerequisite was accepted by SERVICE. This packet requests independent
source review; it does not award itself source, backend or installation approval.

## Source, composition and official naming receipt

The generated JSON manifest pins all six immutable inputs with SHA-256, Git blob
identity and bytes. They are the accepted Building SQL and its manifest, shared
foundation SQL, and BASE Building authority/attempt/binding sources. Materialize
those exact input artifacts at the listed paths to reproduce this text composition.
They are dependencies, not additions to this patch or instructions to execute them.
No accepted foundation, CE, AIR, bootstrap or historical migration is rewritten.

`scripts/build-building-setup-command-receipts-source-v1.mjs --emit` reads/hash-checks
source and writes the module and manifest only. It does not parse or run SQL. It
selects the fresh Building structural effects, the transitive Building/runtime
and attached trigger/policy functions, and only eleven required generic temporal
foundation functions. It excludes fixture authority and prepare/invite/claim/revoke
endpoints and CE/AIR checkpoints. Every selected source byte range, source hash,
output range and omission reason is recorded. New G2 definitions explicitly
replace F17/F47/F79 once; duplicate function definitions fail the offline checker.
The current minimal reviewer reader is copied from canonical source; it does not
expand reviewer access to full runs or histories.

The module is a fresh selected-effect composition with **empty declared application
schemas as prestate**, not a concatenation of Building and CE installation scripts.
Reconciliation with a nonempty application state is not authorized by this packet.
Its first independent seals are literal NULL, it raises unconditional `55000`, and
it ends in `ROLLBACK`. No installer/apply runner, positive authenticated/fixture
grant or exposure is included. Every object closes ACLs before commit could become
possible; managed objects and their ACL/default ACL remain unchanged. New object
defaults are not mutated. Independent final catalog capture/assertions include
policies, constraints, expressions, types, routines, defaults, dependencies and role
edges. Capturing candidate facts does not establish expected facts or equivalence.

The first PM170 delivery was historically `SOURCE_PARTIAL_WITH_EXACT_TOOL_GAP`,
with fourteen paths and no guessed migration filename. That receipt remains in
the report history. The isolated portable CLI v2.121.0 later produced the actual
empty skeleton; [Core naming receipt](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6403717235)
and blob `331c7274e728e73967c093312bae7f59092bff5c` seal its bytes and provenance.
PM175 accepts `20261025214155_building_setup_command_receipts_v1.sql` as canonical.
The CLI is not invoked again by this packaging change.

The fifteenth path is
`supabase/migrations/20261025214155_building_setup_command_receipts_v1.sql`.
It consumes the exact existing `buildSource().forward` text, byte-identical to
the complete module: 732202 bytes, SHA-256
`254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3`.
PM176 removes exactly one framing blank-line byte at EOF from the original
732203-byte module (`c963898c9782681bfc56b15eb15313f9d65b0a5cceb0cd049ec1fd2a233cf32c`).
Every SQL statement, function body, mapped effect range/hash and source contract
is unchanged; the whole-output/migration hashes change explicitly for this EOF fix.
The original empty naming skeleton remains preserved in isolated scratch. The
generator writes this reserved target only from an empty skeleton or identical
prior output; different WIP fails closed. It records the official receipt,
target/forward identities and `SOURCE_LOCAL_DELIVERED` with independent review
still required. All fifteen authorized paths are now packaged. SQL/authority/ABI/
coverage semantics are unchanged; PM176 only tightens validation of malformed
response combinations as described below. This file's location does not make the fresh
composition an upgrade-safe migration or establish an executed ledger. No serial
installation or application against an old/nonempty database is implied.

## Atomic receipt and recovery contract

The three new owner-only RLS tables are
`platform.building_setup_command_receipt_epochs`,
`platform.building_setup_command_coverage`, and
`platform.building_setup_command_receipts`. Exact columns, immediate constraints,
generated index implications and immutable triggers are in `G2.DOMAIN`; none has
a sequence or generated identity. Epoch metadata is a source contract, never an
installation receipt. Its retention policy is NULL and pruning is disabled.
Only an actual new G2 creation writes coverage from expected revision one in the
same transaction. Creation replay does not adopt/backfill an old run.

The command writer preserves the original PostgreSQL JSONB request-hash expression
and ordered arrays. The durable key also binds actor, tenant, Workspace, run,
expected revision, operation, Context, membership and exact input descriptor.
Its immutable result contains the exact existing ten-field v2 receipt and minimal
before-state descriptor. The old session ID is private trigger-frame evidence,
not a requirement that a later recovering session equal the original session.
An exact own command is looked up before stale revision rejection; a later command
does not erase the original receipt. Different intent or authority cannot reuse
that key. Legacy last-slot replay and legacy/different-intent conflict rules remain;
no historical receipt, coverage, ledger or migration execution is forged.

Provision evidence is inserted before run status changes invoke F47. The trigger
uses that owner-only same-transaction evidence and exact membership/session tuple,
not a caller GUC or self-asserted proof. Binding, property Context and audit effects
receive fresh canonical checkpoints. A later failure rolls back the run, evidence,
portfolio/period/binding/Context/revision/audit effects together. No new outbox
dispatch is added; existing in-transaction dependencies remain in closure.

`customer_api.get_building_setup_command_receipt_v1(uuid,uuid,uuid,text,text,integer)`
is an invoker gateway to the owner-definer reader with `search_path=pg_catalog`.
It returns only a current authorized own exact receipt. Reviewer recovery also
requires current approve authority; it does not return another actor's history.
The scope, command, coverage and activation-held retention fields are strict. A
missing receipt is typed `absent` only for genuine coverage and unchanged expected
revision in the creator case and never for `approve`. `unknown/legacy_uncovered`
requires uncovered coverage; `unknown/coverage_gap` requires covered coverage.
All swapped reasons and `approve/absent` fail strict parsing. Complete/conflict
can legitimately have uncovered run coverage and a new G2 command receipt;
they are not incorrectly restricted to covered runs. Absence never proves no COMMIT globally or reserves a
reusable key. Coverage gaps, old runs and nondisclosing reviewer misses are
`unknown`; the reader does not inspect foreign evidence to choose an outcome.

The additive GET route is
`/api/customer/v1/onboarding/building-setup/[id]/commands/[command_key]` with exactly
one each of `context_id`, `workspace_id`, `operation`, `expected_revision`.
It uses the existing SSR client, provider-validated claims, `customer_api` RPC,
strict response schema, exact trusted actor/scope echoes, and existing private
no-store/Vary headers. It does not compute a browser imitation of PostgreSQL's
JSONB hash. Malformed/foreign/incomplete replies return 502, errors never become
absence/receipts, and lookup failures preserve UNKNOWN. Existing routes, command
transport, UI, recovery helper and generated database types are untouched.

## Fresh admission, waits and privilege model

The thin Building checkpoint fixes action-to-permission internally. It accepts no
clock, policy or evaluator selector. Each VOLATILE checkpoint obtains trusted
`clock_timestamp()`, requires READ COMMITTED, and evaluates current provider session
and temporal native Building authority in one fresh SPI snapshot. It compares the
full actor/tenant/Workspace/membership/Context/session tuple after controllable waits.
The domain temporal binding preserves F71 predicates using accepted `_at_v1`
foundation routines; no shared evaluator is forked or replaced.

| Boundary | Checkpoint / next effect |
| --- | --- |
| Entry | fresh session + full native domain tuple before processing |
| Creation advisory/run wait | fresh full tuple before new coverage or sensitive replay |
| Command run lock | fresh tuple, then exact replay or stale/state validation |
| Portfolio/building/unit/period DML | fresh check before the next controllable effect |
| Private evidence write | fresh check before run/status trigger effects |
| F47 binding/Context/audit | trusted private frame; checkpoint before each next controllable effect and return |
| Run/revision/audit writes | fresh checks between controllable steps; final closure + fresh check before successful return |
| Lookup run SHARE lock | fresh recovery/approve authority before evidence disclosure; final fresh check |
| Reviewer metadata | existing AAL1 prepared-metadata semantics; active domain projection gated and freshly rechecked |

PM169 supersedes the earlier impossible “before every resumed internal native
effect” requirement **only for this new G2 Building closure**. Tentative writes
inside native operations are allowed. Any invalidity actually observed causes the
whole application transaction to roll back. The follow-on guard rejects unexpected
reachable triggers, unvalidated/deferrable constraints and deferred follow-ons;
the selected deferred T35 assignment-source trigger is not on G2 write relations.
Independent PG17 trigger/FK/type/TOAST/all-call closure remains an installation gate,
not something lexical source checks prove. No managed Auth row lock or heavy global
prelock is added. A trigger's native implicit wait may occur before its next fresh
check: no per-native-effect serialization guarantee is claimed.

WAL/sequence side effects can survive rollback. Logout/revoke/expiry after the last
valid check but before COMMIT can still race. Unknown COMMIT is neither confirmed
success nor confirmed rollback: retain the original key, exact lookup, and explicit
exact retry. These limitations are contractual, not hidden test gaps.

The migration/profile owner is postgres. F64's real owner is cladora_rpc_owner and
F80 remains postgres; only the accepted nested owner EXECUTE/schema edges remain.
PM137 ADMIN management edges are not confused with PG17 SET permission. Grantor-
sensitive temporary CREATE/SET is cleaned and entry/final role/default ACL assertions
must match independently approved inputs. No native product LOGIN, ticket kernel,
service_role fallback, public session query or managed Auth ACL mutation is present.

## Verification and remaining gates

`node scripts/test-building-setup-command-receipts-v1.mjs` exercises strict schemas,
all five operation receipts, scope/intent/ordered arrays, actual GET handler with
fake RPC only, malformed replies, UNKNOWN mappings, provenance and independently
coherently resealed source negatives. It never starts a server or connects to SQL.
`node scripts/test-building-setup-integration.mjs --g2-only` checks only changed G2
source oracles; existing accepted legacy suites are retained and not repeated.
The checker is a source invariant/hash checker, not a PostgreSQL parser or security
proof. Canonical full-config TypeScript and scoped lint are separate checks.
For the PM175 packaging-only delta use
`node scripts/test-building-setup-command-receipts-v1.mjs --packaging-only`:
it checks the official name/receipt, prior SQL pin, complete forward/module byte
identity, manifest metadata, NULL/55000/ROLLBACK gates and targeted resealed negatives.
The normal checker also reads the reserved migration and verifies its identity.
The earlier 82-case handler/ABI suite and TypeScript were not repeated for naming.
For PM176 use `--response-matrix-only` on the same test script. Its 160-case
outcome/reason/coverage/operation matrix invokes the actual GET handler with fake
RPC, checks exactly one RPC per case, and requires exact 502 error-only bodies for
126 invalid combinations while preserving 34 positive combinations. The optional
`--schema-before <path>` counterexample input must hash to the original official
14-path schema: it records 11 malformed acceptances before this correction, and
the fixed source records zero. This is an offline test selector, not a product
compatibility flag. TypeScript/lint/syntax checks for the affected correction are
performed separately; no closed 82-case suite or SQL/runtime test is required.

The first patch's five existing BASE files were incorrectly encoded as additions
after a failed local Git-object read. That applicability claim is withdrawn in the
report history. The unified successor uses exact GitHub BASE tree/blob preimages,
ten additions and five modifications, and a separate temporary index/object store
for real `git apply --cached --check --whitespace=error-all` plus exact output
roundtrip. A failed local object read is never interpreted as an absent BASE path.

The SQL and concurrency files under `supabase/hosted-building-slice/tests/` are
executable **test source only**, not executed evidence. The MJS module has no driver,
connect(), auto-main, URL/env read, fixture initializer or installation path. A future
authorized harness supplies connected task-owned disposable clients and genuine
prepared native session/authority fixtures. It implements observed real controller/A/B
blocking, Context revoke while A waits, zero application writes after denial, exact
same-key concurrency, later-command replay, different-input conflict, outer FK failure
rollback across guarded stores, simulated lost acknowledgment after actual COMMIT,
same-key lookup/retry, and genuine pre-G2 UNKNOWN. No provider tables are modified.
The SQL test exercises the complete five-command chain and reviewer own recovery
after provision without authorizing a full-run reader. Neither fixture nor role
grants are fabricated by those tests. Fixture/native session/issued Auth evidence
requires separate future authorization.

The existing 223 and PostgreSQL runner keep legacy conflict controls. G2 opt-in
assertions require genuine coverage from creation, and extend zero-write fingerprints
to evidence/coverage/epoch/revision stores. Existing cleanup/failure safeguards remain.
No old successful runner, Operations, CE, AIR, G1 or foundation suite is repeated.

Before any live action: independent SERVICE source review; independently sealed
PG17 compile/catalog/normalized reference and role/custody/
quiescence facts; newly observed empty application state; actual managed prerequisites
and REFERENCES/session access; tested privilege transfer/default ACL equality; approved
execution authority/profile; D3 retention/legal/duration/manual-expiry decision; separate
installation and PG/Auth/HTTP/browser authorization. All NULL seals and activation HOLD
remain. Source acceptance alone does not satisfy any installation or runtime gate.
