# AIRPROP native opportunity runtime 004

Status: repository implementation; not a production migration or entitlement rollout.
Baseline: main 3134b209a57f21c62227dc227d78c5c9ff8bedf2.

## Behavior

AIRPROP treats workspace as its commercial world. A physical subject is optional.
The selector uses the existing Context provider and canonical `list_workspace_targets_v2`.
It does not infer a workspace from a property or choose the first result automatically.
`/en/app/airprop`, `/ro/app/airprop`, `/fa/app/airprop` offer creation and the latest
50 opportunities. API list limit is bounded to 1–100; pagination beyond this window
is not implemented in this slice.

`POST /api/customer/v2/airprop/opportunities` accepts the merged strict v2 contract.
`GET` requires exactly `context_id`, `workspace_id`, optionally `limit`.
Both call authenticated `customer_api` functions, with private no-store responses.
No service-role client, client actor/tenant/hash or legacy retry fallback is used.

## Shared ownership and changes across three works

| Area | Canonical owner | Runtime use/change |
| --- | --- | --- |
| Context, membership, workspace assignment, permissions | CORE | Reuses native resolver and effective permission engine from 003; no new grant store |
| Commercial opportunity | AIRPROP | Uses existing `airprop.investment_opportunities`; immutable workspace identity remains |
| Retry records | CORE | Uses existing `platform.idempotency_keys`; key namespace is `airprop.opportunity.create.v2/<workspace>/<client-key>` |
| Evidence | CORE audit | One opportunity creation event in the same transaction |
| Exchange with Operations/SERVICE | CORE outbox | One `airprop.opportunity.created.v2` event; domain consumers are not implemented here |
| Native selector navigation | Shared application | Exact discovery route classification; tenant Context presentation gate, authoritative RPC checks |
| Operational tasks/services | Operations/SERVICE | No duplicate opportunities, memberships, financial records or automatic service/task creation |

The persisted key includes a slash, forbidden in legacy v1 client keys, and is
scoped by tenant plus workspace. Same-key different actor or canonical payload is
a conflict. Decimal strings preserve numeric(20,4) without binary floating point.
SQL reconstructs the descriptor's ordered JSON hash server-side. Context is not
part of that business hash; current context and module permission are checked
before every retry lookup, and again after acquiring the transaction lock.

A transaction advisory lock covers first insert and retry. The domain row, audit,
outbox and response record commit or roll back together. Shared retry retention
cannot remove domain deduplication: the opportunity's persisted key/hash/creator
preserve the original creation response, even after lifecycle advancement.
Subject references must currently belong to the exact tenant/workspace binding;
list reads omit inactive/unbound references. Subjectless opportunities are readable
under native workspace authority. Unresolved legacy null-workspace rows remain hidden.

The exact native discovery route does not use a physical dashboard's permissions
as native authority. Opening the selector grants no module capability: target
listing checks canonical assignments and each domain operation checks permission,
module activation, entitlement, taxonomy, deny rules and AAL2 in SQL.
Other routes retain their existing persona/permission checks.

## Recovery and verification

The browser stores a versioned pending command in sessionStorage keyed by context
and workspace before dispatch. Uncertain network/server results keep its exact key
and payload, lock edits and recover on remount. Successful confirmation clears it.
A denied retry of an uncertain command keeps the pending command. This is session
recovery, not durable recovery across closed browser sessions.

Tests execute the actual migration with the merged core authority fixture, and the
actual compiled API/component code. The fixture models referenced canonical columns,
not the full application migration chain. Dedicated CI additionally runs that same
SQL on disposable PostgreSQL 17 with independent connections, observes real lock
contention and proves one opportunity identity/audit/outbox result. Existing Database
tests still apply all migrations and run the repository pgTAP suite.

## Remaining wider AIRPROP work

This delivers create/list opportunities and their workspace UI. Native underwriting,
approval/transaction lifecycle, financial integrations, assignment issuance, legacy
resolution execution, outbox consumers and production migration rollout are separate
remaining work. Existing v1 commands are not silently promoted to native authority.
No production user, role, module, entitlement, data or migration has been changed by
this implementation.
