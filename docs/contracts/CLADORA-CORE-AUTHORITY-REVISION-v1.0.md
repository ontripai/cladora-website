# Canonical transactional authority revision v1

Status: Draft schema dependency. No Remote apply, grants, route activation or
consumer cutover is authorized by this package. The previous provider preflight
candidate remains unpublished; this change is based directly on main.

## Canonical truth and revision

The existing Core evaluator remains the sole authority truth:
`app_private.check_workspace_native_permission_v2`. The new private singleton
`app_private.canonical_authority_revision_v1` contains only a transactional
invalidation epoch. It has no actor, permission, entitlement or cached decision
rows and is neither a projection nor a second authority ledger.

The machine-readable source inventory lists the 25 canonical relations and the
12 transitive evaluator functions. It covers Context grants and membership;
identity roles, permissions and role permissions; Workspace identity/lifecycle;
module definitions, bindings and activation; entitlements including overrides;
taxonomy, profiles, models and compatibility; local roles, modules, permissions,
assignments and recursive authority lineage; delegations and grantor authority;
property bindings, building and unit ancestry. JWT actor/AAL are transaction-local
inputs, checked on every decision, never user metadata. Time validity is evaluated
again at the decision statement instant, even when no DML has occurred.

One global epoch deliberately over-invalidates: changing one Workspace may make
requests for another Workspace stale. This closes shared-registry and grantor
invalidation gaps without choosing an incomplete role, tenant or actor version.
The tradeoff is contention and extra stale retries; sharding this primitive would
require a separate completeness proof.

## Writer and reader protocol

Each listed relation has an ALWAYS, AFTER STATEMENT hook for INSERT, UPDATE,
DELETE and TRUNCATE. Source changes and the epoch increment commit or roll back
in the same PostgreSQL transaction. Cascades also invalidate, and statements that
match zero rows conservatively invalidate. The committed epoch increases; an
aborted transaction does not consume a version. A missing singleton or safe-integer
overflow aborts the entire writer transaction. Direct insert/update/delete/truncate
of the epoch is rejected. No consumer has been granted read or write access.

The canonical provider executes inside the existing serializable TX-HOST-01
connection, after the idempotency, Workspace, aggregate and provider-source locks.
It then locks the epoch row FOR SHARE, retaining that lock through the host's
commit or rollback. No authority-source row locks are acquired after this barrier.
The provider reads Workspace, actor Context and sources from the same snapshot,
then asks the sole Core evaluator. The host independently verifies permission.

An authority writer updates its source before obtaining the epoch's exclusive
row lock. A reader holding the barrier can linearize before that uncommitted
writer; the writer cannot commit until the reader finishes. If a writer commits
after the reader's serializable snapshot was established, the locking epoch read
produces a serialization failure and TX-HOST-01 retries in a fresh transaction.
Revoke while waiting for a host lock therefore cannot produce a stale allow.
Multi-statement writers may deadlock with existing host lock orders; PostgreSQL
aborts one participant. The host fails closed for deadlocks/timeouts and performs
bounded retries only for confirmed serialization aborts. No network retry may
reuse an allow receipt.

## Provider and consumer receipt

`resolveAuthority(scope, request)` validates the exact Workspace, actor, database
transaction, host attempt, isolation level and post-lock time. It never opens a
transaction or writes a revision. A successful observation and derived receipt
bind the actual epoch, actor, Context, Workspace, permission, module and
`evaluated_at`, with the versioned entitlement binding (module-definition ID,
entitlement key or null for a module requiring no entitlement, Workspace and
revision). Raw entitlement/override values are never disclosed.

The entitlement field remains optional for older contract-only adapters, so their
contracts remain compatible. The canonical PostgreSQL provider always supplies it;
it has no fallback to a legacy adapter, role lock_version or fingerprint revision.
The binding validator rejects inconsistent Workspace/module/revision metadata.
Stale/future versions, revoked membership, cross-Workspace bindings, unknown sources,
not-found, AAL failure and provider failure produce bounded denial with no domain,
idempotency, audit, outbox or epoch write. The epoch row is not created on a read.

Replay first performs the same canonical recheck. If an intervening mutation makes
the original epoch stale, replay is denied; updating the original command version
changes its request hash and cannot repeat effects. Successful exact replay at an
unchanged epoch returns the original immutable receipt.

## Validation and rollout boundary

The new pgTAP test checks private ACL/RLS, counter tamper denial, ALWAYS hooks and
all-source statement/rollback coverage. Real PostgreSQL host tests exercise actual
populated-source mutations on every inventory relation, rollbacks, allow/denial,
shared-revision concurrency, writer/reader linearization, replay and revoke while
waiting for locks. Actual truncations are isolated tests that roll back; no runtime
or Remote database is truncated. Existing SERVICE and CE contract conformance is
also run; no tasks, routes or production consumers are activated.

A definition digest freezes the dependency review and fails conformance on
unreviewed evaluator DDL. It is a compatibility check, never a decision revision.
Privileged schema/function/policy changes and disabling triggers remain outside
the DML writer protocol and require governance review and explicit invalidation.

The Draft must stay unmerged until schema review and an independent migration
rollout decision. Remote apply, provider execution-role grants, backfill activation
and consumer wiring each remain separate authorization gates. Existing migrations
are byte-identical. Rollback before apply is withdrawal of this Draft. After a
future apply, preserve the revision rather than decrementing/reusing it; disable
consumer wiring first and use a separately reviewed forward migration for changes.
