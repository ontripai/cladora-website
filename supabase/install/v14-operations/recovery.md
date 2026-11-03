# Operations inactive installation v1 — source-only recovery contract

Owner: Core; independent source/security reviewer: SERVICE. Target: existing
`cladora-staging / ryygcqiunqqtfkpkflzf`, PostgreSQL17 only. No execution has occurred.
No command in this document authorizes a query, installation, fixture or activation.

## Lineage and admission

This is a new, selected-effect Operations lineage, not historical migration replay.
The manifest pins every accepted effect/canonical range, transformation and output.
No Supabase migration ledger is written. Historical migrations and the original
Building proof retain their NULL seals, fixed55000 and finalROLLBACK. Their proof
wrapper is not an installer and is never edited, renamed or reported as applied.
The new four files have their own entry/poststate/ACL guards and one BEGIN/COMMIT.
They require independent review before a separately authorized rehearsal/install.

Order: foundation → assets → maintenance-procurement → building-provisioning.
The foundation includes the *physical* cross-schema FK SCC, including canonical
assets/plans/orders/vendors, documents, utility meters and access points. It also
includes existing dashboard read-target structures (including financial tables).
Those dependencies confer no permission for finance/payment/close or other modules.
Later units install the effective domain declarations. No business/Auth rows,
Workspace lifecycle transition, module activation, fixture or runtime grant occurs.
The building unit supplies accepted G2 proposal/approval/provision/receipt routines;
an authorized prepared Workspace remains a separate data/runtime prerequisite.
It does not claim a generic production Workspace onboarding/payment workflow.

## Before each unit

1. Obtain fresh explicit execution authority, independently bound provider transport,
   exact source hash and SERVICE review. Native/operator/execution bindings are NULL
   in this delivery. Operator-set GUC values are consistency inputs, not identity or
   authorization proof. A nonempty string does not grant an installation right.
2. Authorize metadata-only preflight separately. Confirm target, PG17, extensions,
   non-superuser `postgres` identity, exact CREATE/ownership and role ADMIN/SET rights,
   existing Auth REFERENCES/column reads and the protected role graph. Do not infer
   capabilities from a login name. No managed Auth/default ACL mutation is permitted.
3. Foundation requires fresh absence of all declared application schemas and fresh
   approved owner-role prestate. Subsequent units require the previous verified
   receipt and fresh same-database full catalog fingerprint. Bind that exact
   observation SHA256 as `cladora.install.prestate_sha256`. Unexpected/mixed state
   fails, not repair-as-applied. Nothing fetches a credential or executes these files.
4. Review the complete observation and source-to-effect manifest. Source inventory
   is not a compiled catalog/reference oracle. TOAST/array/row types, both FK trigger
   sides, policies, expressions, dependencies and effective privileges need PG17
   rehearsal. Counts and function presence alone are insufficient.

## Transaction and inactive poststate

All selected DDL, temporary SET/CREATE rights, explicit OC1 revokes and assertions
are inside the unit transaction, under one installation advisory lock. Any failure
must abort the transaction. No default privileges are changed. PUBLIC, anon,
authenticated, service_role and unexpected positive ACLs must be closed before
COMMIT. Only the accepted F64/F80 nested owner edges/schema USAGE remain. The accepted
permanent shared-owner ADMIN edge is not temporary SET or runtime authority.
All application tables have RLS enabled. This delivery does not enable endpoints.
Original managed objects/ACLs remain equal. New internal referenced-side RI triggers
on auth.users are allowed only as children of application FKs to auth.users(id),
never as a managed ACL exception. Existing managed triggers cannot be changed.

The precommit result contains source contract/unit/transaction identity and complete
same-database catalog receipt. It is explicitly **not COMMIT proof**. Persist its
exact bytes in the future operator's external execution record before accepting a
successful COMMIT acknowledgement. There is no new authority or migration ledger.

## Failure and unknown COMMIT

- Known rollback: preserve diagnostics/receipts; all transaction DDL/temporary rights
  must disappear. Re-observe the exact prestate before any separately authorized retry.
- Lost connection before/after COMMIT: stop subsequent units. Do not blindly rerun.
  In a separately authorized read lane, use verify.sql to capture full catalog,
  owner/ACL/defaults/role graph and protected managed state.
- Exact recorded prestate means not committed. Exact recorded complete poststate,
  source assertions and closed inactive ACLs, plus independent transaction evidence,
  support committed classification. A matching UI GET or object count does not.
- If the precommit receipt was lost too, do not manufacture a poststate seal. Require
  independent full source-to-effect/catalog review. Missing/extra/unmapped/collision,
  partial/mixed state or unprovable lineage stays UNKNOWN; no next unit/activation.
- Commit acknowledgement alone is unit installation evidence, not application
  readiness, actual provider Auth or successful Operations workflow.

No DROP/cleanup script is supplied. A destructive recovery requires separate reviewed
backup/restore/drop authority. Preserve all history and data; never mark unexecuted
historical migrations applied. WAL/sequence advancement may survive rolled-back work.

## Runtime boundary and new Operations product policies

C03 reservation(status102) is durable intent with zero business mutation. Execute
atomically stores the domain mutation/audits, command audit/outbox and terminal
receipt in the existing C03 row. ACK changes only delivery metadata. Current issued
AAL2 session and native authority are checked for reserve/execute/lookup/ACK/replay;
a historical receipt grants no current access. All explicit waits are followed by
fresh checkpoints; after domain/implicit waits, before audit/outbox/receipt/response,
invalidity rolls the whole execute attempt back. No strict concurrent logout/COMMIT
serialization is claimed. Actual deferred/implicit-wait behavior needs PG proof.
Legacy direct mutable RPCs remain closed. Checklist retains the canonical provider;
the trigger serializes admission with the Workspace row and rejects unresolved C03.
Deadlock/timeout/cancellation is a rollback/UNKNOWN condition, never success.

Proposed owner decisions (not inherited from CE/Building, not approved here):

- **D-OPS-RETENTION:** keep unresolved full wire until canonical reconciliation and
  terminal receipt/key/fingerprint without automatic expiry. Current source uses
  infinity. Notes are duplicated in private C03/browser write-ahead storage; review
  data retention/compaction before activation. Never forget a key then replay it.
- **D-OPS-ABANDON:** retain the safe blocking hold. Recommend a separately approved
  serialized terminal cancellation tombstone on the same key/body: if already
  committed, return the real receipt; otherwise fence both pending and delayed
  reserve/execute. Deleting storage or a status102 row is not cancellation. This
  source has no cancel endpoint/admin/service fallback. Revocation blocks disclosure
  and retries until legitimate current authority is restored or an approved recovery
  protocol exists. Terminal rejection has zero mutation/audit/outbox for that attempt.

Reload/remount first reconciles C03; fresh GET is only current-state observation.
Same key/wire retry is explicit; changed body conflicts. Another tab/device cannot
infer COMMIT from localStorage. Server-held reservation/receipt recovers a deleted
local descriptor/new device for the same actor+Workspace. If reserve never reached
server and the descriptor is also deleted, the lost local key cannot be recovered;
late requests can still arrive. Server admission/resource fences prevent a second
pending stage, but the user cannot safely abandon that unknown intent automatically.
Browser Web Locks are a convenience; SQL C03/Workspace/resource locks are authoritative.
Missing storage/locks, malformed receipt or permission loss stays blocked.

## 236-1 correction: original command Context and observation deadlines

An actor+Workspace reservation may belong to another Context. OPEN rechecks the
original Context's current full canonical tuple against reservation binding (only
revision may change), and returns that original Context as answer.context_id.
Current denial/binding conflict returns only bounded403/409/503 through the route;
wire and receipt are not disclosed in an error. The route accepts a foreign Context
only on a fully bound command-bearing OPEN answer. Lookup/ACK use that original
Context, strict original key/wire/fingerprint and current authority. Storage uses
actor+original Context, never the caller's newly selected Context.

A foreign pending intent keeps admission closed and exposes a return-to-original-
Context link; retry is disabled until the user returns. Terminal reconciliation in
another authorized Context is read/ACK only, then OPEN rechecks the selected Context
before allowing new commands. At most three recovery passes are allowed under churn;
continued churn remains held. No automatic execute/new key/body or GET-as-receipt.
Revoked/deleted original Context, malformed/mislabeled answer, poisoned old local
storage or missing return capability stays fail-closed; no silent storage migration
or cancellation. Late responses remain bound to their original client/Context;
unmounted gate callbacks cannot publish into the newly selected gate.

Both preflight.sql and verify.sql now set transaction-local lock_timeout=5s and
statement_timeout=60s after BEGIN/read-only/search_path and **before catalog reads**.
These match the mutation-unit conservative deadlines:5s bounds waiting on concurrent
DDL;60s bounds the full observation. They are not PG resource/performance proof.
Timeout/cancellation means STOP/UNKNOWN and no successful observation/receipt; the
executor must roll back/close, quarantine an uncertain connection, establish its
transaction state independently, and obtain fresh observation/authority before any
retry. No blind retry or fallback lane is supplied. No deadline is disabled/reset.

The operating-model INSERT is selected only from canonical1431–1439; maintenance
WHERE precedes its own semicolon. Canonical1441–1443 contains separate unchanged
RLS ALTERs. All four units' transformation inventories were checked for the same
boundary defect; only the two narrowed compatibility INSERT transforms use this
terminal-semicolon operation, and both are checked against their exact canonical
single-statement source. Other transforms and three unaffected units are unchanged.
Offline text checks are not a general SQL parser. Compatible preinstalled parser
probes found none; syntax-parser verification is NOT_RUN. No package was installed,
and no SQL/PG compile/execute, installation or runtime evidence is claimed.
