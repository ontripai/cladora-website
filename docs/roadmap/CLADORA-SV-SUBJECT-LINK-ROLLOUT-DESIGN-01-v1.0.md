# SV-SUBJECT-LINK-ROLLOUT-DESIGN-01

## Parallel design task

SERVICE prepares the application-connection design while Core independently
reviews the corrected isolated HTTP candidate. This is a documentation task,
not permission to install a role, expose a route or enable the capability.

Product base: `c7c17f78fd854509b141bd488753716580881b9e`.
Candidate PR #389: `ae1c3cd194257447fae2de7142449bddc5c9f087`.
Candidate tree: `12fbe624e7cefcf805200c4def7ffdd718781ef5`.
Candidate remains Draft pending the head-bound Core result. Its files must not
be changed by this parallel task. If its head changes, update the design's
dependency identity without claiming the changed delivery accepted.

## Evidence and limitations

- Observed: #389's corrected delta changes only the HTTP handler and its two
  harnesses. Existing Core host, CE provider, AIRPROP guard and migrations are
  unchanged.
- Observed: exact-head CI run `38524725729` demonstrates real loopback HTTP,
  local Supabase Auth/MFA and disposable PostgreSQL, `18/18 PASS`, including
  poisoned role claim, real SSI `40001`, and lost COMMIT acknowledgement.
- Observed: product-base application source has no instantiated `pg.Pool` for
  this Core host. The SERVICE PostgreSQL harness constructs its own pool.
- Observed: subject-link table/client-function privileges were deliberately
  withheld in the accepted SERVICE migration. Existing Supabase SSR/admin
  clients are HTTP clients, not substitutes for the host's SQL connection.
- Unavailable: target-environment execution role, installed schema/history,
  secret binding and deployed end-to-end acceptance. Do not infer these from
  local test privileges or Vercel READY.
- PM oversight is not queried or written in this design task. Baseline/Page
  artifacts remain unchanged.

## SERVICE design deliverable

Create a documentation-only delivery on a separate branch from product main.
Reference the exact #389 candidate; do not copy its implementation commits or
modify its five files. Answer the following concrete questions.

### Server connection and identity

1. Propose the Next.js Node-runtime entry point and wiring to the existing
   `handleServiceSubjectLinkHttpV1`, server authentication function and Core
   host. Consume accepted contracts without another transaction engine or
   receipt store. The design may name a future route; this task adds none.
2. Specify a server-only connection factory, pool lifecycle/limits, timeout,
   TLS and failure behavior for the target hosting model. Reuse a compatible
   existing connection path if one is found. A Supabase publishable/admin API
   key is not a PostgreSQL password. Never place secrets in client variables,
   documents, receipts or logs.
3. Specify how the verified session reaches the same checked-out SQL connection
   across BEGIN, retry, rollback, COMMIT and uncertain acknowledgement. Reuse
   #389's request-scoped identity adapter and its role-claim cleanup, subject
   to Core acceptance. State whether a target pooler preserves every required
   transaction property; do not assume local direct-connection tests prove it.

### Execution role and database installation

4. Inventory the exact SQL objects reached by the host, authority resolver,
   CE audience provider and SERVICE mutation. For each, list required schema,
   table/column or function access, transaction/locking behavior, RLS behavior
   and the source file that establishes the requirement. Start from actual
   queries, not broad schema-wide grants.
5. Identify an existing suitable application execution role if one is known
   from authorized evidence. If no such role is observable, label it unknown
   and propose a least-privilege role model for review. Avoid use of the
   disposable harness's owner/superuser privileges as the rollout model.
   Explain the trusted server-only boundary for installing verified JWT claims
   and why untrusted SQL/API clients cannot impersonate another actor.
6. Record whether additional grants, function ownership or RLS policies would
   be necessary. Do not execute SQL or broaden `anon`, `authenticated` or
   `service_role`. Preserve the existing domain functions and Core ownership;
   any required change must be an explicit, separately reviewed proposal.
7. Describe how a later authorized operation would establish actual installed
   schema/history before apply. Current repository count is not Remote state.
   Do not use this task to run Remote inspection with unapproved credentials,
   migration repair, replay or db push.

### Public API, recovery and rollout

8. Specify the proposed path, strict request schema, trusted origin/session/AAL2
   handling and minimal public response using the existing handler. Preserve
   dedicated subject-link authority and independent Request/Communications
   read checks. No new audience policy or privacy disclosure is needed.
9. Preserve `202 READBACK_REQUIRED` for unknown commit and recovery using the
   same intent/idempotency key. Describe the current limitations, especially
   authority-revision changes: existing Core exact replay binds the authority
   revision. Do not silently relax those bindings to recover an old receipt
   or retry with a new key. A new recovery path, if required, is a separate
   Core-reviewed delta using canonical records and fresh authority.
10. Define disabled-by-default behavior, configuration failure behavior,
    bounded rollout/disable procedure and retained audit evidence. Turning
    off the caller must not delete committed links or rewrite history.

## Focused review and next authorization

SERVICE owns the connection/route design and operation proposal. Core reviews
only execution-role access, session/transaction binding, pooled connection
semantics and recovery. CE reviews changed audience consumption only; unchanged
accepted CE bytes do not need another full review. AIRPROP has no implementation
task unless a later protected addition requires an exact approved manifest entry.
Documents & Vault has no dependency in this package.

The design PR must state which findings are observed, reported or unavailable,
and separate proposed configuration/SQL from operations actually performed.
Validate document links/source references and the access inventory; no old
product suite needs a manual rerun for this documentation-only task.

After #389 is accepted and merged, re-pin the eventual implementation to its
merge SHA or newer main. The documentation design does not block #389's merge.
Its own merge is serial under GLOBAL MAIN-WRITER; no concurrent main writers.

Any target-role installation/grant, Remote migration/history operation, secret
change, public-route deployment or activation requires its own concrete reviewed
operation and authorization. No such action is authorized or executed here.
Deployed execution-role acceptance, Remote database installation and Production
HTTP/AAL2 acceptance remain `NOT_RUN_NOT_PASS`.
