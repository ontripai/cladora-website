# Core15 first native cut — authenticated session

Task: CORE-FUNCTIONAL-RUNTIME-15. Parent ec639884452cc0cb6dfef520339791a5c20e9b39;
containing Git commit identifies this checkpoint. Task remains IN_PROGRESS.

Platform input: 794f5a12c3928ae0a3585ab679a3cbe60aab49a3, consumed in its own
detached worktree. Core checked private-path/container/network/port collisions,
then ran the pinned init/pull/bootstrap/start/users/verify on this environment's
owned persistent synthetic development stack. Staging and Production were unused.
PG17.11/database postgres was observed. Platform's actual postgres is a privileged
lifecycle custodian; authenticator is PostgREST infrastructure. Neither is the Core
runtime principal. Secrets, session/actor IDs and backend-instance identity remain
private. Platform verify observed its own workspace isolation and durable note;
that is infrastructure evidence, not Request or C03 persistence.

The first relay parent exited before any signup dispatched. Core checked absent
PID/free ports/no users or signup receipts/Auth count zero, preserved its receipt,
and supervised the unchanged official relay in a live parent session. Completed
bootstrap/users were never replayed. This is process supervision, not a replacement
Platform runner/controller. Process-exit cause is UNKNOWN.

## Usable narrow ABI

`createCoreAuthenticatedSessionRuntimeV1({pool,auth_origin,publishable_key,database_oid})`
returns `check(accessToken)`. Server composition owns these inputs and must verify
Platform private custody/current relay/DB identity before binding. It is not an
HTTP endpoint or caller-selected profile. The ordinary `cladora_core_runtime`
LOGIN has no role memberships, SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION,
direct Auth SELECT, or execute on the raw caller-time guard. Real Supabase SDK
getUser/getClaims verifies the issuer's actual session token; subject/SID/expiry/AAL
are server-derived. No user_metadata or caller allow callback establishes authority.

The same runtime connection checks its principal/database/PG17, begins SERIALIZABLE,
sets transaction-local claims and 5s lock/10s statement deadlines, then calls only
`core_runtime.lock_request_session_v1()`. This locks the actual Auth session row
FOR SHARE, captures fresh DB clock after the lock and reuses the exact canonical
current-session guard. It returns current actor/AAL/six-decimal UTC checked_at only
after a positive ROLLBACK tag. The checked_at describes that guarded observation,
not settlement/ACK/delivery time. Revocation after lock release remains possible.
This result is **not** Context/Workspace permission, command authorization or a
reusable authority receipt. action_authorization/Context_authority are not_evaluated.
There is no domain/C03/audit/outbox table or write in the reader.

Known denial gives only bounded denied/null fields. Original 40001/cancellation
and transport errors escape; no retry engine exists. Unknown settlement is recorded
as unknown, not successful rollback. Pool leases are destroyed on release. A cleanup
failure after an otherwise successful read prevents disclosure of that result.

## Exact local installation and the real counterexample

04-session-bootstrap.sql creates the private two-function cut and ordinary roles.
Its canonical helper is byte-identical to the building-provisioning guard except
namespace; the generator verifies roundtrip. Password is privately bound by the
one-shot runner, never stored in source. Bootstrap has COMMIT tag plus independent
catalog poststate; raw ReadyForQuery was not captured for DDL.

The first native proof FAILED. Actual Auth sessions had RLS=true, FORCE=false,
owner=supabase_auth_admin and zero policies. An ACL-only ordinary helper owner saw
no session row despite valid JWT/actual matching unexpired session. The canonical
guard safely denied; no positive evidence was invented. This exposed a real
dependency not established by source/memory tests.

05-session-auth-owner.sql is an explicit separately guarded local compatibility
delta. The EXISTING ordinary provider Auth table owner owns the two closed private
functions; runtime gains no membership or direct Auth read. Temporary CREATE on
core_runtime is revoked before commit. Function bodies/security/search_path,
Auth relation owner/RLS/table ACL, default ACL and membership catalogs are compared.
The ineffective Core-added column/schema/function grants to the earlier helper
owner are removed. Clarification of the SQL header's broad “ACL unchanged” comment:
**those Core-added grants are revoked**; pre-existing provider grants are not a new
authority source. Provider role attributes and Auth object definitions/policies
are unchanged. The schema remains Core-owned. This exact local ownership solution
does not establish permission to do the same on managed hosted Auth.

Both DDL sends used only the pinned owned local custody path. Their output and
dispatch/poststate receipts are private; no repeat install is permitted. Recovery
starts with read-only catalog/dispatch inspection. UNKNOWN never triggers blind
replay. Reversing this independent cut needs explicit review: functions first,
then only cut-owned schema/role/grants after exact dependency checks; no Auth user,
provider role, session or historical receipt deletion is part of automatic recovery.

## Real evidence, separate from source tests

The second native proof consumed the actual module, actual Supabase SDK and actual
node-pg. Only Next's documented server-only compiler marker alias was resolved for
the Node harness; no Auth/PG/crypto implementation was mocked. It observed:

- Real issued session current; known ROLLBACK and ReadyForQuery I on the same PID.
- Runtime direct Auth SELECT/raw caller-time helper denied with 42501.
- Tampered JWT rejected; official local logout made the token deny.
- A separate connection held the real synthetic session row. pg_stat_activity
  observed Lock blocking; its DB deadline passed while waiting; reader denied.
- A concurrent update of that same synthetic row produced real 40001; the original
  error escaped and the failed reader rolled back without an internal retry.
- No Core session tables/ledger or runtime role memberships exist.

The deadline fixture modifies only a named real synthetic session's not_after;
it is not a claim about a production Auth lifetime policy. Tokens/credentials and
raw private receipts are excluded from the deliverable. A safe evidence projection
pins original receipt/module/DDL bytes without exposing user or backend IDs.

## Remaining Core15 work — not delegated as completed

The full four-native-installer plan still conflicts with actual P12: ordinary
installer postgres checks versus privileged lifecycle postgres, and preliminary
cladora_dev_* DB selector versus actual postgres. Do not demote provider roles,
spoof a selector/GUC, weaken guard300, or run the preliminary plan. A bounded
ordinary-installer ownership/grantor/profile mapping with exact verification is
needed, including multi-owner Core12 transfer/SET restoration.

C01 Context/entitlement, C03 Request/receipt/audit/outbox atomic persistence and
replay/UNKNOWN, S01 real store/writer, Service native Request, AIRPROP read selector,
canonical Unit/party/versioned relationship/manage and publish/control remain open.
No consumer binding or Documents historical slot was activated. Existing Service
JS-clock replay evidence remains an owner seam, not re-stamped by Core.

Automation: نیازمند بررسی — session proof inputs/owned-target assertions are
repeatable only on a freshly approved synthetic attempt; target/privilege review
is human-owned, unknown settlement escalates to Core/Platform, and value is safe
reproducible evidence rather than automated activation.
