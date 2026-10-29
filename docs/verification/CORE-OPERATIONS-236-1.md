# شماره تسک: ۲۳۶-۱ — aggregated correction of SERVICE235-2

BASE `8c8225fb3297035a2349357bd968d60779388063`; predecessor patch
`7b0d80e4737f9b23fcf78fb8ac29b0147fd89171`, delivery
`780ddded8a5a55263d4f581c1e340408176b65d2`. Owner Core; reviewer SERVICE.
Target remains existing cladora-staging / ryygcqiunqqtfkpkflzf.
This supersedes only the three findings of235-2, not closed dependency/security or
other accepted contracts. Previous reports/verification remain historical evidence.

| Finding | Source correction | Affected verification |
|---|---|---|
| OPS-235-SR-01 | SQL OPEN returns original command Context after full current original tuple comparison. Codec/route reject mislabeled command/receipt; client storage and lookup/ACK use original Context. Foreign pending command requires return to original Context for exact retry. | Real codec/client/Next handler/React gate with explicit fake Auth/C03; two Contexts in one Workspace: pending, terminal, new device, revoke/restore, context switch, late response, malformed answer and old misbound storage. No duplicate modeled write/audit/outbox; NOT PG proof. |
| OPS-235-INSTALL-01 | Narrow operating-model source to1431–1439 single INSERT; maintenance WHERE belongs before that INSERT's semicolon. Canonical1441–1443 RLS ALTERs remain independent. Exact source/output ranges and hashes refreshed; source body/catalog assertion identities synchronized. | Independent single-statement/source-boundary text negatives, including a coherently resealed ALTER-WHERE and contaminated multi-statement source range. All four units' six transformation records reviewed; only two use the terminal-semicolon filtering operation. Both checked against exact single-INSERT ranges. |
| OPS-235-INSTALL-02 | preflight/verify both set transaction-local lock_timeout5s and statement_timeout60s before catalog reads. | Missing/zero/late/nonlocal/reset negatives for each setting in both files. STOP/UNKNOWN/cancel/quarantine contract in recovery.md. No successful receipt or blind retry on timeout. |

Original Context is immutable throughout the command. Only a bound OPEN response can
discover another authorized Context; all command-bearing answers name that original
Context, never the currently selected caller Context. Native original authority is
rechecked before disclosure and before every later reconciliation call. Denial or
changed full tuple gives bounded403/409/503 without wire/receipt details. Historical
receipt is not current permission. Actor+Workspace admission/resource fences remain.

Pending foreign discovery stores the exact envelope only under actor+original Context,
closes admission and shows the existing maintenance URL with the original Context.
Retry in the wrong Context rejects before dispatch; original key/wire is preserved.
If that Context cannot be selected or authorized, hold remains; no fallback, repaired
claim, new key/body or automatic execute. A terminal foreign receipt can be read/ACKed
under original authority, then a fresh OPEN of the selected Context is required before
admission. Recovery churn is bounded to three passes, then fail-closed. A predecessor
misbound local descriptor is preserved and held, not silently migrated/cleared. Late
callbacks from an unmounted gate cannot publish readiness into the new Context.

The source output ABI shape stays operations answer/receipt.v1; the correction is
original-Context semantics, not a new receipt/authority/ledger. Browser recovery state
adds recoveryContext for the return link. Retention/abandonment are unchanged proposals
D-OPS-RETENTION / D-OPS-ABANDON, not approved or inherited from CE/Building.

Statement-boundary review covers the physical canonical source ranges and all six
transformation records across four installers: Context resolver replacement, selected
module tuple, narrowed permission tuples, two narrowed compatibility INSERTs, and the
new C03 OPEN delta. The first three are unchanged; only the two INSERT transforms use
terminal-semicolon filtering, and their one-statement envelope is now independently
checked. Three installer units remain byte-identical; only maintenance/procurement is
modified. Schema/RLS/ACL/default/managed Auth guards remain. Historical migrations and
original proof NULL seals/fixed55000/ROLLBACK remain byte-identical.

A compatible preinstalled PostgreSQL syntax parser was not found: Python pglast/
pg_query absent; Node pgsql-parser, pgsql-ast-parser, @pgsql/parser, libpg-query,
pg-query-parser, pg-query-native and @libpg-query/parser unresolved; installed dependency
filename scan found no compatible parser. **SQL syntax-parser verification NOT_RUN**;
no package installed. Text boundary checks are not a parser or PG compile proof.

5s lock timeout bounds catalog waits behind concurrent DDL;60s statement timeout bounds
full observation resources/time and matches mutation-unit source limits. Both are SET
LOCAL inside read-only transaction before the first catalog SELECT; timeout/cancel
means STOP/UNKNOWN, no successful observation receipt, no blind retry, uncertain
connection quarantined/rolled back/closed until transaction state is known. No executor
connection, cancellation, performance or runtime behavior was executed/proven here.

Actual affected offline results, exact identities and full BASE apply/reverse are in
the delivery manifest. Tests use existing installed dependencies only; accepted Next/
env/SWC16.4.1 and Zod4.6.6 lock metadata remain byte-identical. No clean install/audit/
build, SQL/PG/DB/Auth/network/browser runtime, fixture, env/config, CI or Push. Native/
operator/execution bindings NULL, default_no_execute and EXECUTION_HOLD remain.
