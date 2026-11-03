# PLATFORM-DEV-BACKUP-RESTORE-13

Base/direct Parent: `794f5a12c3928ae0a3585ab679a3cbe60aab49a3`.
Branch: `codex/program-local-runtime-lane-01`.
Result: **real restore fidelity and restart/readback proved; historical security
drift remains, NOT runtime readiness**. Core15 was not required or installed.

## Fixed input and independent reference

The accepted existing backup receipt is740 bytes, SHA256
`d784ee048bdb98950fbd138a2f017d11914c8283171e7ade0975993222ed8b0e`.
The helper validates all four original file byte counts/hashes before effects:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| database.dump | 241877 | bbad080435502bfbedd7e5b37481b07c682faaa3ea5c0007bac144b73166cbfa |
| globals.sql | 2687 | a839c4052afc3acb72ea07c86a28e9d14bac2da4b440466fd52446374f618895 |
| storage.tar | 10240 | 8fd7c357cc1fc884feb0c551bb6cf1cb7b9c1f2ea9ea15fd3692ae89e7ea8e0a |
| helper.json | 213 | a4e9f5406907ca6cd263f9bbcc49c8b4b8f063dc76f9eee971e2e3cd66e29ba2 |

No new dump of the original database was taken. References were extracted from
the accepted custom archive with pg_restore schema-only/data-only output and
the original globals SQL. The restored target alone was subsequently dumped
for comparison. Expected values were never copied from candidate output.

Normalization removes only standard pg_dump envelope/version comments and its
random psql restrict/unrestrict key. Owner/ACL/function/DDL contents remain in
the per-address schema comparison; duplicate addresses fail. COPY rows compare
complete raw text multisets with NULL/escaping preserved, all40 table scopes
and sequence setvals. Globals compare completely, including password hashes
privately. Raw rows, definitions, passwords and dump outputs are not published.

## Real target and execution

One actual restore run: `cladora-restore13-5daa9f465410`. Separate owned named
PG and Storage volumes; actual CID and a newly initialized system identifier
were observed. PG version170011, no custom roles/schemas before restore and a
system identifier different from the original were mandatory. All containers
used the existing exact PG image:

`docker.io/library/postgres@sha256:2cd2c0f809604aaeff6f0ec8f40aecbd025613107561015c69369a1a7f1d3416`

Image ID `sha256:99445113a4a19e82dd3713c65bd9f6fb5bf972065ab043df8d1e1c93e957da9a`,
linux/amd64. No pull or dependency install was needed. Network none, no published
ports or host mounts, read-only root, cap-dropALL, no-new-privileges, bounded
resources; PG runs UID999. Storage extraction's separate short-lived root helper
has only CHOWN/FOWNER to preserve numeric ownership/mode on its new volume;
observation runs UID1000 with a read-only mount. No shared ownership was changed.

Fresh PostgreSQL already has its bootstrap postgres role. The only globals send
adapter omits exactly one redundant `CREATE ROLE postgres;`, after observing an
otherwise empty target. Re-inserting that exact statement reproduces the entire
original bytes. All ALTER/GRANT/password/role-setting statements are retained;
original and send hashes are private receipts. No ignore-error, blanket DROP,
privilege workaround or alternate restore is used. pg_restore uses
--exit-on-error/--single-transaction for the database.

Real schema/data/globals comparisons matched immediately after restore, then
again after actual stop/start/readiness and readback. Recovered records include
two synthetic Auth users, eight archived sessions, two platform_dev workspaces
and one note. These are point-in-time backup values, not today's session count.
Actual password-authenticated authenticator access was checked with restored
credentials: NOSUPERUSER/NOBYPASSRLS; explicit authenticated role and archived
synthetic owner input see one own workspace and zero foreign ones. That is an
RLS restoration probe, not a newly issued/current Auth session or canonical
product principal. No GoTrue server, real email or AAL2 ran on the restore target.
Provider signing secrets/configuration outside the database backup were not
restored; full Auth runtime recovery is not claimed.

## Security finding retained

The accepted backup predates final task12 hardening. Its globals contain
service_role and supabase_storage_admin with BYPASSRLS and a service_role grant
to authenticator. Both backup reference and actual restored/restarted globals
agree on that historical state. The current ORIGINAL environment was separately
observed NOBYPASSRLS for those roles and without that authenticator membership.

This is **MISMATCH_HISTORICAL_BACKUP_NOT_RUNTIME_READY**, not a passed current
privilege gate. No role was weakened to pass a test or silently edited to hide
the mismatch. The faithful restore existed only in the isolated sandbox and was
not activated as an API/runtime. A future operational recovery needs an explicit
privilege/config reconciliation or a separately accepted post-hardening backup;
the accepted old backup remains unchanged. Do not regenerate a dump merely to
replace this result.

## Storage boundary and cleanup

Storage tar extraction and independent numeric owner/mode/mtime/content manifest
readback matched: **two directories, zero files**. It proves recovery of that
empty archive structure only, not a real document, object identity, download
authorization or scanner result. Scanner and domain runtime remain NOT_RUN.

Three owned containers and two owned volumes were independently deleted and
absence acknowledged. Helpers mask PGDATA with tmpfs to avoid anonymous-volume
leaks. Cleanup checks exact run labels/CID and refuses foreign or in-use resources;
each resource has its own deadline, later safe cleanup continues after failure,
and missing/unknown cleanup cannot report success. No prune/image deletion or
product volume deletion occurred. All private evidence is retained.

Original CID, volume names, system identifier and note fingerprint matched
before/after. All five sealed task12 files and their custody/config remained
unchanged. No source12 lifecycle operation stopped/restarted the original.

## Helper and evidence

`python -I -B scripts/functional-dev-stack-v1/restore13.py inspect` validates the
fixed existing private input only. `... restore13.py run` is a closed fixed
operation; its native attempt is already consumed and the private claim stops
blind reuse. No target, DSN, arbitrary SQL/path or --exec argument exists.
Do not rerun the completed restore to repeat a report.

The first preflight saw Docker's shortened ID and stopped before any resource or
SQL mutation. Its receipt remains private; full-CID acquisition was corrected
and regression-tested. Fresh inventories confirmed zero resources for that
preflight before the single actual restore run. No ambiguous mutation was
retried. A post-run diagnostic initially passed text instead of bytes to the
normalizer; that local reporting invocation was corrected, without DB mutation.

Ten new targeted offline tests passed across scoped runs: envelope normalization,
owner/ACL/duplicate schema identity, COPY NULL/row/terminal semantics, unsafe tar,
fixed CLI, portable synthetic shape checks, full CID, cleanup failure/foreign
custody and preserving historical privilege differences. These are separate
from the actual native restore. Original accepted suites/dump/health tests were
not replayed. Python AST and staged diff checks pass.

Private native receipt:29810 bytes,
SHA256 `9273d0da59e70b8b73ccd6c0d144a9228aeb8018121804c54ad6f5476c91b74d`.
It contains actual command acknowledgements and eight comparisons. Safe public
receipt/manifest expose aggregates and hashes only. Actual target/source IDs,
row data, Auth hashes, passwords and full SQL snapshots stay private.

قابل خودکارسازی: **نیازمند بررسی**. Input: accepted backup/receipt and sealed
stack. Automatable: hash/fresh-target checks, restore, snapshot comparison and
owned cleanup. Human decision: Platform/coordinator accept backup age and
privilege reconciliation before activation. Conditions: exact pins/private
custody/empty isolated target. Exceptions: mismatch or UNKNOWN to Platform;
no blind replay. Formal dependency: accepted task12 backup only, not Core15.
Value: demonstrated recoverability and explicit security drift; estimate UNKNOWN.
