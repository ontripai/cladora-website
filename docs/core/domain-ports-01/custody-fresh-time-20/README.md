# QFW-DOCS15-01 — post-wait canonical fresh-time successor20

Implementation parent: c332983d6064aa20855aeb4ca309ce443888e164. Documents baseline
5eeaeecef756fb1827deeb198deac5ee4fe657dd and sibling SERVICE custody22 are preserved
in Git history. Their old hashes are historical evidence, not source acceptance
of the permission checkpoint. CE010's independent six-file WIP/checks are retained
in a separate hashed local checkpoint and are not in this delta. No target action.

## Precise cause and fixed checkpoints

The old top-level RPC samples current session/TTL but calls
check_workspace_native_permission_v2. That STABLE wrapper calls the canonical
legacy chain using statement_timestamp. Within one RPC, time-only Context/member/
role/entitlement expiry after a lock wait can therefore be missed even though the
session remains current. The sibling SERVICE22 calls at old74/90 have the same
cause; this is not a separately proved native finding or general C03 bypass.

The accepted canonical fresh-time ABI is reused without modifying its definitions:
resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz),
check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz), and
require_request_session_current_at_v1(timestamptz). The13-function source closure
includes the temporal Context/Workspace/member/role/scope/entitlement/permission
chain and two non-temporal scope-containment helpers. No new authority engine,
parallel resolver or caller-selected time/allow is introduced.

Five source checkpoints sample checked_at=clock_timestamp AFTER their waits:
Documents custody/advisory row wait, Documents C03 receipt lock, Documents final
metadata/effect wait before return, SERVICE custody/advisory wait and SERVICE final
insert/effect wait before return. The fresh resolver must still return the same
original tenant/member; the whole canonical evaluator sees that same instant.
Docs final expiry checks cover both custody and the actual locked C03 row expiry.
There is no TTL extension, new command, fingerprint rewrite or receipt creation.
Existing command/provider/host/consumer logic is unchanged.

## Install/dependency boundary

Fresh preflight/install/verify/recovery compose a full successor with the original
atomic/deadline/target guards. Only the two entry-helper EXECUTE requirements for
the existing dedicated custody owner change; neither PUBLIC nor Auth ACL nor
transitive helper ownership/ACL is broadened. Source bodies/config/security and
actual preimage owner/ACL are pinned through13 helpers. Platform must supply the
observed metadata binding fields; absence/drift is STOP, never guessed. No helper
function definition is rewritten. Owner/ACL requirements and normalized hash format
are in each recovery file. SERVICE remains guarded/proposed/unadmitted.

A fresh CREATE image is not an upgrade for a populated target. Platform must bind
any existing installation to exact before/after routine and ACL identities and
prepare a separate admitted forward adaptation. Known install rollback is not
reversal of committed business data; unknown settlement remains UNKNOWN/STOP.

## Evidence

New targeted checker only:30 source-derived expired-after-wait schedules (six
independent temporal layers × five checkpoints), five unexpired controls, four
coherent regressions rejecting statement-time substitution, legacy evaluator or
missing fresh resolver,13 exact helper bodies and owner/ACL/config pin coverage.
Documents table/immutable trigger and SERVICE table are byte-identical. Composer
regenerates exact install/preflight/verify image hashes from these final bytes.
No old17/13/12 controls, owner23 or closed diagnostic suites were executed.

This is SOURCE/TIMELINE MODEL evidence; no SQL parser, compile, query, Auth, PG,
fixture, installation or native two-connection execution occurred. Native gate:
Session A holds the actual advisory/custody/C03 lock; B starts the same RPC before
one canonical layer expires, waits, then is released afterward. Expected42501/no
new custody/stream admission and unchanged original record; an unexpired same-scope
control succeeds only after separate admission. Test ledger/custody expiry equality,
owner/ACL/RLS,40001/rollback/UNKNOWN and protected residue in that later lane.

Runtime bindings remain NULL/maintenance. Automation: نیازمند بررسی؛ source/ABI
identity and schedule checks are automatable, target role/ACL correspondence and
native execution require Platform/Coordinator approval. No publication of private
metadata/credentials occurs in this packet.
