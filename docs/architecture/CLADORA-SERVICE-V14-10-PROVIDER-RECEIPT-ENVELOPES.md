# SERVICE v1.4 provider receipt envelopes

SERVICE consumes canonical provider receipts. It does not mint provider receipts, copy an owner projection, or activate a runtime path. Every consumed receipt carries the contract and version, receipt identity, canonical source identity and exact source version, Workspace, current authority outcome, bounded decision and reason, evaluation time, idempotency key and binding identity, and an input fingerprint.

The specialized payloads remain owned by their canonical providers:

- Core owns provider agreement, DW-02 resource resolution, and Quote financial posting receipts.
- Communications and Documents/Vault own subject-link and evidence authorization receipts.
- BK01 owns capacity allocation receipts.
- PF01 owns portfolio action projection receipts.
- FIN01 owns financial operation receipts and all money, tax, currency, rounding, payer share, and ledger results.

SERVICE validates exact Workspace, source, version, authority, action and replay bindings before planning an operation. Missing, malformed, stale, tampered, cross-Workspace or replay-conflicting receipts produce bounded denial. These pure evaluators do not write a receipt, mutation, audit event, outbox event, allocation, portfolio projection, or financial posting. Runtime activation still requires the canonical providers, atomic persistence, current-authority recheck, and DB-HIST-01 closure.
