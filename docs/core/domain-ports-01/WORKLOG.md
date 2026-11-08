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
