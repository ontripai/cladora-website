# ACL-PROJECTION-02 — bounded consumer request, source only

Base/parent: `91a8c05a13ef890f386997f29230a352e235e79c`.
Branch: `codex/program-ops-transition-01a`.
Assignment: [coordinator6572853368](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6572853368).

**SOURCE_READY_FOR_COORDINATOR_REVIEW_EXECUTION_HOLD.** No PostgreSQL/SQL parser,
compile, connection, Docker, catalog query, Auth/session, installation, grant or
activation has been executed by Core. The synthetic SQL is executable source for
Platform after coordinator review, not an executed witness or a native installer.
The previous four-file proposal/mapper checkpoint is byte-identical. Existing
mapper tests and the276/286/300 chain were not replayed.

## Delivered runnable source

```
python3 scripts/review-ops-populated-transition-01a/acl-projection-02/packet.py check
python3 scripts/review-ops-populated-transition-01a/acl-projection-02/test_packet.py
# Only for a privately supplied existing capture, no connection:
python3 scripts/review-ops-populated-transition-01a/acl-projection-02/packet.py inspect-private-catalog PRIVATE_CAPTURE.json
```

`packet.py` performs offline byte/hash/Git-blob integrity and bounded source-anchor
checks. It is **not** a SQL parser, PostgreSQL proof, authorization service or
sandbox. Coherently resealed mutations are rejected by selected independent source
invariants; this is not a claim that arbitrary SQL can be admitted by these checks.
Only the exact reviewed bytes, request hash and Platform's independently reviewed
typed adapter/profile may be admitted. No `--exec`, shell hook or self-declared
`approved` bit is provided. All bindings in the proposed request are NULL; source
consistency never authorizes execution. The response prints no private rows.

## Exact source path and decisions

`acl-path.json` pins the product route, server adapter and SSR client at this task
Base, the accepted300 native installer (308614 bytes, SHA256
`6ce3f721329f6cbdd7c945769b022a1afa6b65cf2e898abc19b8c11447c8bcad`),
and the accepted four-function/three-trigger spans. Official300 delivery identity
is carried forward from the accepted checkpoint, not rebuilt. No private SQL
source packet, full canonical body, send-image, or raw catalog is copied here.
Native line numbers below refer to that pinned native file, not reduced staging
send-images and not an unreviewed current schema.

| Edge / decision | Required SQL rights or contract | Evidence / consequence |
|---|---|---|
| HTTP POST -> SSR client -> RPC | Validated session sub; canonical Context/key/wire/fingerprint; actual API role selection must be observed separately | `src/app/api/customer/v1/operations/commands/route.ts:1`; `operations-command-server.ts:25–27`; SSR `server.ts:6–10`. This client uses session cookies/public config, not a service-role fallback. No runtime role is inferred from source alone. |
| Database caller -> public facade | `customer_api` USAGE + exact `operations_command_v1(text,uuid,uuid,text,text)` EXECUTE, including inherited/PUBLIC/owner effects | Native4030–4033: SQL SECURITY INVOKER, fixed pg_catalog path, explicit runtime REVOKE. Source is inactive. |
| Invoker facade -> private command | **The same caller** needs `app_private` USAGE and exact private EXECUTE before entering the SECURITY DEFINER body | Native4030–4032; native3833. Grant only facade is insufficient. Source facade has no distinct authorization predicate to bypass. |
| Private body -> checkpoint, mutators and tables | Effective rights of pinned owner postgres, including schema/callee/type/sequence/table rights, RLS/owner/BYPASS profile | Native3833–3849,3986–3993. Owner context does not replace original actor/session/Context authority. |
| Checkpoint/receipt | Session-currentness, AAL2, original tuple, effective resource permission/revision; post-wait checks, same C03 command, atomic audit/outbox and canonical receipt | Native3795–3830,4008–4027; preserved, not reimplemented by this toy witness. |
| A — retain inactive closed source | No positive runtime grant | Current status; no caller/native acceptance. |
| B — grant facade only | Private rights absent | Not a viable adoption contract; D01–D03 model denial layers. |
| C — exact private USAGE/EXECUTE as well | Exact private entry becomes directly **SQL-callable**; unrelated private functions remain closed | P01/P02 model this reachability. It does not establish that PostgREST exposes private schema, or that native authorization can be bypassed. A Core/SERVICE review and explicit coordinator contract decision remain required. No grant is implemented on native objects. |
| D — restricted DEFINER wrapper | Would change trust boundary and owner/callee graph | Not selected, implemented or authorized here; cannot silently replace accepted facade. |

The selected deliverable is A plus evidence for deciding B/C. It does not select C
as an approved native exposure policy. Effective privilege and grant option are
separate, as are schema USAGE, function EXECUTE and native-domain permission.

## Platform request and exact order

`request.json` contains identity pins (bytes/SHA256/Git blob) for exactly two SQL
payloads. It is a review input, not an instruction to run immediately. The request's
own approval fields cannot supply coordinator authorization. Platform must bind:

| Missing binding | Owner | Use |
|---|---|---|
| Exact coordinator source/request review identity and request SHA256 | coordinator | External admission of these exact bytes; never an arbitrary SQL path or an `approved:true` field |
| Reviewed Platform typed adapter and profile hash | Platform | Bounded stage after health and before finally-cleanup; existing runner is not changed by Core |
| New disposable run/attempt, loopback container custody/system identifier/database | Platform | Assert isolation and backend correlation. SQL database-name checks alone cannot prove target isolation. No inherited staging credentials/endpoints |
| PG17/bootstrap privileges and fixture absence | Platform, asserted by witness | Lab-only superuser can create synthetic roles and SET LOCAL ROLE; tested roles are ordinary. This is **not** a Supabase principal prerequisite or provider-role modification |

1. **Preflight/setup, in `witness.sql`:** BEGIN; local lock/statement/idle deadlines
   3s/20s/30s before reads; fixed pg_catalog path; PG17 and disposable default
   database `postgres`; current_user=session_user and lab bootstrap superuser;
   absent product schemas including Auth and both synthetic role/schema names.
   A mismatch fails55000, never SKIP/IF NOT EXISTS. An existing Auth-enabled PG
   database is deliberately rejected: Platform must not retarget/rewrite this
   payload silently. Use a freshly admitted pure-PG disposable profile or leave
   this request unexecuted pending a reviewed profile change.
2. Create only two NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/
   NOREPLICATION/NOBYPASSRLS roles, two schemas and three functions, all inside
   the transaction. Synthetic owner owns both schemas/functions; caller owns
   none and has no role memberships (as member or role). No permanent grants,
   roles, ledger, table, sample domain data or default ACL mutation. The toy
   private routine validates only a fixed `allow` argument; that **does not**
   emulate native authorization, claims, sessions, MFA or receipts.
3. Assert attributes, owner, security mode, fixed path and absence of PUBLIC
   function grants. Test each case under SET LOCAL ROLE caller. Fixture grants
   are made only as the synthetic owner. No role membership grants are used.
4. Assert all eleven cases, in the order below. Every expected denial catches
   **only42501**; NULL preconditions fail closed. Unexpected errors propagate.
   A caught expected denial is not a global primary error; any other error must
   be retained as the primary stage failure. No catch-all or successful fallback.
5. Emit one **pre-rollback marker** `ACL02_ASSERTIONS_REACHED` with exact case list
   and backend PID, then final ROLLBACK. The marker is not a receipt or cleanup
   success. Platform must observe CommandComplete ROLLBACK and ReadyForQuery I
   on the same actual backend/attempt. A transaction-aborted rollback without
   the complete assertion marker is not a witness PASS.
6. Only after positive rollback settlement, `verify-clean.sql` runs on that same
   admitted database in an independent read-only observer (PID recorded), under
   local3s/10s deadlines and final ROLLBACK. Expect exact integer role/schema
   residue counts0; validate PG17/database and observer completion. Missing or
   mismatched output is not zero. No new PostgreSQL instance may substitute for
   the original database when checking residue.
7. Platform finally-cleanup still runs for its owned resources. Overall consumer
   acceptance requires assertions + acknowledged rollback + exact residue result
   + acknowledged observer completion + Platform lifecycle cleanup. Source/checker
   success, health alone or a callback mock is not CONNECTED_TESTED.

| Case | Privileges / operation | Expected PG17 result — NOT_RUN |
|---|---|---|
| D00 | API schema/caller EXECUTE closed |42501 |
| D01 | API USAGE + facade EXECUTE only |42501 nested private access |
| D02 | additionally exact private EXECUTE, private schema USAGE absent |42501 |
| D03 | private USAGE present, exact private EXECUTE revoked |42501 |
| P01 | both private rights; call facade('allow') |Exact synthetic JSON, executor synthetic owner |
| P02 | same rights; directly call private('allow') |Same exact JSON: extra SQL entry reachability, **not** a native guard bypass |
| D04/D05 | facade/direct call with toy-guard-denied argument |42501 even with both SQL rights |
| D06 | call unrelated private function |42501; schema USAGE is not blanket EXECUTE |
| D07/D08 | revoke private command EXECUTE; facade/direct retry |42501; positive rights are not assumed permanent |

No SQL or grants are actually executed by this task. If Platform sees a timeout,
cancel, connection loss or missing rollback ACK: STOP/UNKNOWN, retain first error,
no blind retry and no destructive fallback. Disconnection is not a claimed rollback
ACK. The witness has **zero COMMITs**, unlike a future native install. Cleanup
uncertainty must fail the lifecycle even if all assertions were reached. A fresh
observer may classify catalog residue only against the original admitted database;
it cannot replace missing same-attempt settlement evidence.

## Bounded private catalog projection proposal

`catalog-projection.sql` and `catalog-contract.json` are **separate, unadmitted**
read-only proposal artifacts. They are expressly excluded from request.json's two
stages. No hosted extraction is authorized by this delivery. Reuse the existing
complete private Platform05 snapshot/receipt first; the present environment has
no matching full snapshot files, so no existing capture is claimed to have been
consumed and no historical SELECT has been repeated. Historical public summaries
are not new catalog evidence.

The proposal uses a repeatable-read/read-only transaction with local3s/30s/30s
lock/statement/idle deadlines; only pg_catalog reads, no application/Auth rows,
credentials, ledger contents or database settings changes. It preserves raw OIDs
and structured metadata **privately**, with 5001-row sentinels and totals per
section; >5000, missing fields, external truncation, partial permissions, timeout
or cancellation mean incomplete. Oversized sections require a separately reviewed
narrow scope or keyset pagination on the **same snapshot**, not silent LIMIT,
multiple inconsistent connections or a claim that the first5000 are complete.

| Required projection | Exact source / limits |
|---|---|
| All overloads/ABI/security | pg_proc, namespace, regprocedure, identity/full arguments, modes/type IDs/defaults/result, kind (including procedures), owner/config/security/volatility/parallel/leakproof/strictness, source for app routines; Auth helper bodies withheld |
| Dependencies and generated objects | pg_depend forward recursive closure seeded with relations/routines/types/triggers/constraints/rules/column defaults/policies; both FK sides; TOAST and its indexes; composite/array/enum types and ordered labels; indexes/expressions/predicates; extension versions/memberships through dependencies |
| ACL and role graph | Raw routine/schema/relation/column ACLs with grantor/grantee/grantability; effective runtime-principal **and owner** USAGE/EXECUTE, data/DML/REFERENCES/TRIGGER and grant options; pg_roles safe attributes, pg_auth_members ADMIN/INHERIT/SET + grantor; SET/USAGE/MEMBER distinct |
| Lineage/protected objects | Existing independently bound safe receipt/source/ledger identity needed; no invented applied records and no application-row query is supplied. Full protected managed metadata/reference remains an external prerequisite |
| Trigger/writer boundary | Internal and user triggers, enablement, callable routines, definitions, transition/deferred metadata, FK source/target, rules and all app routine/procedure sources, table/column DML reachability. External direct SQL, dynamic dispatch and runtime-generated edges require a separate reviewed writer inventory |

`pg_depend` does **not** recover all SQL-string/PLpgSQL/dynamic calls. Counts and
routine names cannot prove transitive closure or writer participation. Catalog
normalization must resolve OIDs into portable qualified identities and preserve
all semantic fields and grantor options. There is no automatic MD5/SHA source
identity equivalence, no new AST authority, no controller or self-authored oracle.
Rules/view definitions and reverse callers not recoverable from the dependency
walk must be reviewed from explicit metadata/source; missing coverage remains
BLOCKED. Read-window/freshness/project binding require the external receipt; a
SQL database name or timestamp alone is insufficient.

The offline `inspect-private-catalog` command checks section totals/truncation and
mode only. Even a complete synthetic shape returns **BLOCKED/CAPTURE_SHAPE_ONLY**
until the contract's external lineage, normalization, managed-reference,
source-edge and writer reviews are supplied. It never emits a fabricated mapper
reference, or changes complete_sections to true. The accepted mapper/proposal
and its activation state remain unchanged.

## New checks and remaining gates

Run only test_packet.py (10 methods, with focused coherently resealed mutations),
packet.py check, Python syntax and diff/immutability checks. No accepted old
mapper suite or historical reconstruction is needed. These tests cover payload
mismatch; nested-invoker versus accidental DEFINER rewrite; restricted roles;
NULL-safe denial preconditions; catch-all/transaction/public-grant changes;
direct-private control; wrong target/order/admission/effect boundary; missing or
truncated private capture. They are Python/static-source tests, not SQL validation.

ACL01 remains open for actual witness execution/review and native contract choice.
MAP01 remains BLOCKED without full private capture and independently reviewed
closure. OWN01 (hosted principal versus guard300/DEFINER/RLS) and CUT01
(trigger/writer/caller cutover) are independent. Native install, actual
MFA/currentness/resource revision, S3/S4/G2 and business acceptance are NOT_RUN.
Foundation, guard300, Platform runner, product callers and private old artifacts
are untouched. Push is limited to the assigned branch; no PR/merge/deploy.
