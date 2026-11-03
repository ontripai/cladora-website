# Core15 installation and recovery (no execution performed)

Only a Platform12-custodied persistent isolated development target is admitted.
Source hashes alone do not establish it. No staging/Production or old fixture
account/credentials are reused. Per-unit SQL is independently committed; a later
failure does NOT undo prior units. Do not execute the old review/proof capsules.

1. Before send: verify Platform handoff FullSHA, backend/DB OID, direct/session pg
   transport, ordinary installer principal/role graph, source/ACL/owner preimage,
   parent unit receipt and backup/restore evidence. Existing incompatible object
   means STOP; no IF NOT EXISTS/repair-as-applied/assumed historical migration.
2. Send each exact pinned file ONCE, on the owned physical lease. Retain private
   driver/backend PID/attempt, bytes/hash, server CommandComplete and ReadyForQuery
   settlement correlation. Do not infer ACK from an exit code, source or JSON.
3. Positive COMMIT only permits postimage/default/ACL verify; a separate admitted
   connection confirms durable catalog effects. Only then consider the next unit.
4. Lost reply/timeout/cancel/disconnect: UNKNOWN, quarantine lease and stop. A
   subsequent rollback is not proof the prior COMMIT failed. Observer compares
   complete before/after metadata on the SAME actual backend target. Incomplete
   state stays UNKNOWN and is referred to Platform/Core; never blind retry.
5. Installer error before COMMIT: use same physical lease only when its state is
   known; positively acknowledge ROLLBACK and compare independent residue. No new
   install attempt while the first outcome is unknown.
6. Prior to fixture/product data, a reviewed reverse plan may drop ONLY precisely
   owned new policies/functions/S01 objects after checking zero live references.
   No automatic DROP is shipped. With data present, forward migration or tested
   consistent backup restore into an owned target is required; immutable versions,
   C03/audit/outbox and unresolved commands are never silently purged.
7. Runtime lost COMMIT uses original frozen command/key/body and canonical C03
   replay under current Auth/authority. GET current Request is not commit proof;
   readback must include the persisted exact C03 receipt. Expired/missing receipt
   remains unresolved/denied; no new identity, TTL extension or fake receipt.
8. Read preflight has no command reservation. Only positive ROLLBACK exposes the
   detached read value, followed by a same-backend server clock. Uncertain cleanup
   or rollback returns no value; original40001 is preserved, not a successful read.

Neither the catalog verify script nor controlled transport tests establish actual
PG locks, Auth currentness, RLS, restart persistence or receipt custody. Native
execution remains explicitly NOT_RUN until Platform12 supplies a real target.
