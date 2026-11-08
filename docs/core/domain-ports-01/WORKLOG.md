# CORE-DOMAIN-PORTS-01 — R0

Product source base: bfadc5042cb00841dd605862a2a72ddc0dbafb87.
PR478 is still open at inspection; this is not the Coordinator-announced merged main.
Previous Core17 worktrees and accepted Request proof are preserved.

Before edits, authorized source inventory:
- src/lib/core/domain-command-identity-v1.ts (new closed identity ABI)
- src/lib/core/service-authoring-identity-port-v1.ts (new server consumer adapter)
- src/lib/core/functional-command-runtime-v1.ts (additive identity read, existing transport/session/authority)
- scripts/test-core-domain-command-identity-v1.mjs (new controlled transport coupling)
- docs/core/domain-ports-01/{WORKLOG.md,README.md,manifest.json}

No route, owner-domain module, SQL, installer, environment, pool credential, UI,
package/lock, prior evidence or runtime binding is changed. No target execution.
This first independently usable source port resolves trusted identity for Offering
command preparation; it does not make Offering/Quote or other domains native.

## R1 — independent document-free Guide composition

Parent checkpoint: 4d15a37797fc9f0d5ef49565606e400e94f88d27.
CE handoff report: #463 comment6718840636, reported local source6259b70268a851113c8f981e2d346da5428e343f.
The CE object is NOT present in this environment; the report is not its source.
Before editing, R1-owned paths:
- src/lib/core/guide-request-binding-v1.ts (new Core composition)
- scripts/test-core-guide-request-binding-v1.mjs (new targeted checks)
- docs/core/domain-ports-01/guide-r1/{README.md,manifest.json}
- this worklog only; no CE owner source or accepted R0 source is edited.

Use the existing fixed-role pool and CE official authenticator; no SERVICE runtime,
caller allow/authenticate factory, global registration or arbitrary SQL callback.
Native/coupling acceptance of the CE successor remains pending actual source input.

CE6259 was fetched from its now-published branch, with exact parent/tree checked.
Coordinator announced main6cecfa15b00f445be68817e756d766fb0e6fe026;
its complete tree equals the assigned published Base. Parent is not rewritten.

Additional Core-owned R1 edit, identified before editing:
- src/lib/core/platform-role-bound-pool-v1.ts: exact CE-only admission of the
  consumer's literal BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY. The previous
  parser rejects it before SQL. Keep fixed-role and transaction-safety checks;
  no generalized transaction-control relaxation, no SERVICE admission change.
Coupling uses read-only Git overlays of CE6259; owner files remain untouched.
- scripts/test-core-guide-ce-r1-coupling.mjs (new exact-CE Git-overlay coupling;
  reuses CE's transport setup only, never runs its accepted journey cases).
