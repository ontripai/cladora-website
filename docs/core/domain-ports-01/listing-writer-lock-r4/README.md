# CORE-DOMAIN-PORTS-01 — canonical Listing writer lock closure

Parent51eaa511ff796703098f37fc759d38053d412c4a, same branch, source-only continuation.
This is an inactive reviewed-input candidate, NOT a ready producer, accepted
install, global lock-order proof or native witness. Shared target was not contacted.
No SQL parser/compile/query/Auth/GRANT/activation/restart was executed.

## Exact minimal delta

The prior proposal placed canonical epoch UPDATE in a BEFORE-statement trigger.
That is after the caller may already hold Property/Unit/ownership/import/invitation
row locks. Schedule: reader holds epoch SHARE and waits for row; writer holds row
and waits for epoch UPDATE. Patching just the final DML statement cannot fix it.

`prepare-core-listing-writer-lock-v1.mjs` extracts eight exact pinned canonical
functions, adds one entry block immediately after their outer BEGIN and emits
conditional CREATE OR REPLACE. Every other byte, including dollar delimiters,
header/SECURITY DEFINER/search_path, authorization/assurance checks, original key/
idempotency/receipt/effect/audit and exception behavior is retained (only the
CREATE OR REPLACE header normalization is permitted). No historical migration is
edited. The block is a SELECT constant FROM the EXISTING epoch singleton FOR UPDATE,
plus missing-singleton55000. It does NOT directly UPDATE the guarded epoch; only
the unchanged canonical trigger bump may do that. The epoch guard requires trigger
depth and is not disabled or bypassed. No new helper, role or privilege is created.

| Entry, exact source in manifest | Existing wait/effect | Why this entry participates |
| --- | --- | --- |
| customer_api.execute_verified_ownership_transfer_v1 | Property UPDATE; proposal/review SHARE; Unit UPDATE; evidence/document; outgoing ownership UPDATE; ownership close/new INSERT | Epoch first before those row locks and helper waits |
| customer_api.register_unit_invite_relationship_v1 | authorization helper; Unit UPDATE; Party/ownership INSERT | Participant of two source-table invalidators |
| app_private.onboarding_approve_import_commit_internal_v1 | import_context then import_runs UPDATE; nested commit | Outer approval must acquire epoch BEFORE run lock; correcting inner commit alone cycles |
| app_private.onboarding_commit_residential_internal_v1 | import run UPDATE; advisory; import rows UPDATE; Party/ownership INSERT | Also directly callable in canonical ACL; must protect direct and nested paths |
| customer_api.claim_unit_invitation_v1 | invitation UPDATE BEFORE core call; owner-portfolio membership changes | Real upstream wrapper discovered during closure; correcting only core is insufficient |
| customer_api.claim_unit_invitation_core_v1 | invitation UPDATE; membership upsert; membership-party INSERT; context writes | Effective core definition from later duplicate-grant fix, not obsolete pre-rename body |
| maintenance.register_contractor_v1 | actor helper; advisory vendor lock; Party INSERT | Existing Party invalidator also applies here; no Maintenance install prerequisite added |
| customer_api.register_service_self_person_v1 | request authorizer; Workspace SHARE; membership UPDATE; C03/advisory/ledger; Party/mapping INSERT | Existing participant remains pilot-limited; not new Listing registration/permission |

The import RPC wrapper is SQL INVOKER calling approval directly; contractor public
wrapper is SQL INVOKER calling the maintenance entry. They add no row lock and are
pinned, not replaced. Relationship authorizer reads Property/mandate then locks
workspace_property_authorities; can_manage_unit_invites is a nonlocking SQL reader;
import_context is a STABLE nonlocking SQL projection inside PL/pgSQL. Adding the
barrier before the selected entries covers their nested waits, without modifying
those helpers or treating a role name as proof. auth.uid() declaration defaults
remain unchanged; no fake session/identity capability is created.

## Participation / limits

The existing ownership revision proposal stays BYTE-IDENTICAL. It invalidates
ownerships, parties and membership_parties with the canonical bump in the same
source transaction, including INSERT/UPDATE/DELETE/TRUNCATE. Existing canonical
triggers on memberships, context and Unit/Workspace remain unchanged. On entry,
epoch FOR UPDATE is held until settlement; nested same-transaction entry is
reentrant. Canonical source bumps still occur at the original guarded trigger
boundary and roll back with the source transaction. No manual/global receipt or
side registry is introduced.

This removes the described cycle in the named-entry source graph. It does NOT
prove that arbitrary callers arrive without older conflicting locks. External
SQL/admin callers, dynamic writers and future entry points remain outside this
admission. Runtime adapters that already hold domain rows must be checked BEFORE
calling these routines. Reader-held epoch SHARE followed by upgrade to writer
UPDATE is not an allowed write-entry pattern; do not reuse a read scope to write.
The target executor must enforce bounded runtime lock/statement deadlines (not
inferred from this packet's separate catalog/install deadlines), and admit only
audited entry transactions with epoch before
conflicting domain locks, or remain BLOCKED. No total program lock order is frozen.

DML relation RowExclusive is compatible with reader AccessShare/RowShare; this
source/model analysis concerns the row cycle. TRUNCATE/DDL takes relation-level
locks BEFORE its BEFORE-statement trigger. Its caller must pre-acquire epoch
before issuing that statement or use an independently admitted quiescent window.
A table trigger alone does not establish that order. The packet does not authorize
TRUNCATE, DDL or direct mutation and does not remove any invalidation trigger.

The original can_manage_unit_invites/import_context include statement-start time
conditions. Their freshness/session semantics are NOT redesigned here. A wait at
entry does not turn those predicates into post-wait clock evidence. Canonical
terminal currentness/expiry and all writer/session participation still require
separate actual proof before any positive companion. No auth assurance, business
allow, new currentness guarantee or unknown-settlement success is claimed.

## Preflight / adoption / verify

Directory: supabase/proposals/core-listing-writer-lock-v1.
- observe.sql: proposed read-only catalog projection for eight EXACT signatures,
  body SHA256 and hashes of all non-prosrc pg_proc attributes. No raw function
  body, ACL, row data, secret or customer identity is returned. NOT EXECUTED.
- preflight.sql: read-only target/presence/body/metadata/owner/epoch privilege gate.
- delta.sql: guarded55000/finalROLLBACK, exact conditional replacements, repeated
  IN-TRANSACTION preflight, before/after non-body catalog equality and final gates.
- verify.sql: independent read-only postimage/metadata/presence gate.

The private target plan `cladora.listing_writer_target_v1` must contain actual
`database_name`, `database_oid`, `routine_presence` and `routine_metadata` for every
signature. This GUC is an ADMINISTRATIVE expected-value carrier, not proof of the
transport/target, authority or an execution license. Platform must first verify
its owned backend/profile/connection correlation, private custodian/installer
identity, schema-change quiescence and expected target. Localhost/OID/name alone
is not a target identity across environments. Plan absence/mismatch is55000.

Presence is strict: expected absent MUST really be absent; expected present MUST
have the exact canonical original prosrc and all admitted metadata. Missing or
unexpected entries STOP. An absent unrelated module stays absent and no function
is CREATEd for it. Replacements retain object OID, owner, ACL (including grantors),
security, volatility, search_path and ALL other pg_proc columns; mismatch aborts.
Only actual owner capability admitted through existing membership is accepted.
No superuser-by-name, role selection, ownership transfer or privilege expansion.

The function OWNER (SECURITY DEFINER effective principal), not merely installer,
must already have schema USAGE, SELECT(singleton), UPDATE(revision) needed for row
locking. Epoch RLS must demonstrably permit it. Gate conservatively accepts existing
table owner/non-FORCE or existing bypass attributes; a different existing RLS-policy
path is NOT guessed from effective ACL or policy text. It needs independent proof/
review and otherwise STOP. This never authorizes adding BYPASSRLS or widening ACL.
Missing owner rights mean this delta is not yet executable on that target; report
actual owner/privilege mismatch privately for a separately reviewed minimal existing
Core lock-port/delegation decision, not a fallback or broad grant.

The unchanged entry SQL performs no business mutation. Existing bodies still own
all actual domain effects, C03/legacy idempotency, audit and outbox. An explicit
future adoption must preserve every preflight/preservation check; do not hand-edit
away55000 or replace ROLLBACK with COMMIT on a target. The candidate is deliberately
not an install command. Runtime/source bindings stay NULL/NOT_READY.

## Tests and consumption

```sh
node scripts/prepare-core-listing-writer-lock-v1.mjs --check
node scripts/test-core-listing-writer-lock-v1.mjs
node --check scripts/prepare-core-listing-writer-lock-v1.mjs
node --check scripts/test-core-listing-writer-lock-v1.mjs
./node_modules/.bin/eslint scripts/prepare-core-listing-writer-lock-v1.mjs scripts/test-core-listing-writer-lock-v1.mjs
```

28 NEW source/model controls: eight full-definition minimality checks; four actual
source-derived lock-cycle schedules; upstream approval omission; two writers and
recursive epoch reentrance; historical NULL/invalidation preservation; delimiter,
security/auth, late/SHARE barrier, missing singleton and wrong-pin negatives;
owner/metadata/presence, absent-domain recreation and auto-COMMIT packet negatives.
Exhaustive schedules are a scoped two-actor abstract model, NOT executed PG locks,
SQLSTATE/serialization, session/Auth, persisted revision or producer proof.
No previously successful suite is rerun. No TS or product binding is changed.
Caseplan.json provides native proof requests, prerequisites and expected terminals
for Platform/QA; all native results remain NOT_RUN_NOT_PASS. Recovery is separate.

## Party policy / legacy decisions explicitly separated

Existing NULL history remains NULL, including future updates. No backfill, adopt,
default1 or timestamp/hash revision is added. Ownership disclosure is not manage
permission; read/manage retain the exact distinct AIRPROP profiles. This checkpoint
creates no read/discovery positive and no Party label output.
AIRPROP/Coordinator still decide the precise disclosure family: recommended first
own-party ownership plus current membership-party link and canonical read authority;
other-party manager/representation disclosure needs its own real source/policy.
That decision does not block this independent writer-order source delta.

Automation: نیازمند بررسی — deterministic extraction/minimality and source/model
checks are candidates; target binding, custodian/RLS capability, native concurrency
and disclosure acceptance remain formal Platform/Core/AIRPROP/Coordinator gates.
