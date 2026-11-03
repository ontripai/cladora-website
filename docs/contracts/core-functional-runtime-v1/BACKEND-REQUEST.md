# Core15 → Platform12: minimal real Service Request backend

Task remains IN_PROGRESS. Base ec639884452cc0cb6dfef520339791a5c20e9b39.
The full Service plan below is still an implementation/install INPUT. Platform12 now exists locally; the separate session-only native cut is recorded in NATIVE-SESSION-CHECKPOINT.md.
Service09 input 4c3abd7c26d8ae393fdb6acb3f88330c7b887097 is a consumer
requirement, not granted installation privilege. No staging/Production target.

## Required owned target and versions

The preliminary full-plan selector below requires a development DB named `cladora_dev_<owned_suffix>`. Actual Platform12 uses `postgres` and a privileged lifecycle custodian; this discrepancy is OPEN, not a reason to spoof a name or weaken guard300. Its separately owned database and Auth have named data volume,
owner/run/resource custody, loopback-only application/PG relays, no production or
staging connection fallback, synthetic accounts/data only. Platform records exact
FullSHA, image digests, versions, backend ID, DB name/OID, role graph, service
origins, health, backup/restore test and connection selectors in its handoff.
Core never derives these values from a generic staging secret or local receipt.

PG17 (170000–179999); existing reference PG17.11 is not a new live observation.
pgcrypto1.3 and btree_gist1.7 in `extensions`, as required by the pinned native
foundation. Platform must provision these with legitimate CREATE/database rights.
Auth compatibility baseline: existing Platform lane GoTrue v2.197.0 image/profile;
Platform must supply actual selected version/digest and published keys/issuer
metadata. Production clients use asymmetric verified tokens if configured; no
locally fabricated "successful" JWT replaces an issued session. Existing repo
Next16.4.1/Zod4.6.6/TypeScript5.9.3 are source test inputs, not backend inventory.
PostgREST/API is needed for normal app/context entry; Storage is not needed for
this non-financial Request cut, but remains a separate Documents dependency.

## Roles and access (actual observation required)

- Isolated bootstrap administrator: Platform custody only. Creates the owned
  database/Auth namespace and ordinary installer/runtime roles. No app credential
  or public API uses this principal. No startup admin is inferred from `postgres`.
- Native installer: exact accepted ordinary `postgres` profile/role graph of the
  four source installers, including guard300's temporary SET and exact restoration.
  New Core units demand current_user=session_user=postgres, PG17 and legitimate
  parent ownership. No guard removed, no managed-provider role changed to pass.
- `cladora_core_runtime`: dedicated LOGIN, NO SUPERUSER/BYPASSRLS/CREATEROLE/
  CREATEDB/REPLICATION, no membership/SET to provider admins or cladora_rpc_owner,
  no schema CREATE, no default role fallback. Strong credential stays private.
- Runtime receives USAGE/closed functions and column SELECT/row-lock-only UPDATE
  rights enumerated in `02-session-runtime-access.sql`, C03 ledger SELECT/INSERT/
  UPDATE, audit/outbox INSERT+RETURNING-id, audit identity sequence USAGE. No
  DELETE/purge, direct SERVICE mutation, Auth table access or financial writes.
- Existing row locks require PG UPDATE privilege even on SELECT FOR SHARE/KEY
  SHARE. The proposal uses minimal lock columns, scoped UPDATE USING and WITH
  CHECK(false); actual PG17 row-lock vs DML denial is a mandatory native oracle.
  Effective privilege is not grant option or table ownership.
- Auth owner/Platform MUST separately ensure runtime USAGE auth and EXECUTE
  auth.uid()/auth.jwt(); new Core installer does not modify managed Auth ACLs.
- Session barrier helper's ordinary owner MUST actually SELECT id/user_id/
  not_after and UPDATE(id) on auth.sessions (row-lock prerequisite), with effective
  rows visible under Auth RLS. Core preflight rejects row_security_active and
  missing column rights. Platform must verify access against synthetic sessions;
  grant-option/metadata alone is not proof. No runtime role receives those rights.
  If the chosen Auth topology cannot safely provide this owner profile, report
  the exact edge; do not add BYPASSRLS or return a fake session observation.

## Trust, pool and transaction contract

`createCoreFunctionalCommandRuntimeV1({pool,target,offering})` is constructed by
server deployment composition, never request JSON. Target schema is exported;
backend_id, DB OID/name, exact runtime role, owned loopback PG endpoint and Auth
origin are required. Pool selectors are compared before checkout; current/session
role, PG version, DB identity and forbidden memberships are checked on checkout.
No secret is placed in a manifest. Platform supplies a private configured pg Pool
with bounded checkout/query timeouts (5s/15s), max10, TLS where applicable, and a
fixed trusted server Auth origin matching the existing SSR client configuration.

Each execute verifies actual server `getUser` AND `getClaims`, exact actor/session,
AAL2 and expiry schema; no user_metadata or client allow. Minimal verified claims
are SET LOCAL only after BEGIN. Tenant/membership come from the canonical current
Context/Workspace resolver; selected Context is never authority by itself.
`lock_core_request_session_v1` locks the actual managed Auth session in the SAME
transaction, then rechecks expiry. Real logout/delete/update participation must
be proved with the official Auth version. No new authority engine or ledger.

Mutation uses existing C03 and canonical resolveAuthority; each SQL boundary
following authorization has pre/post fresh checkpoint and the final pre-COMMIT
checkpoint. The guard delegates permission to the existing evaluator and holds
session/revision/context/member/workspace barriers. Original40001 reaches existing
bounded host attempts; no retry engine. Unknown COMMIT is READBACK_REQUIRED, not
success. No commit claim is based on JSON, localStorage or a log marker.

SERVICE needs a separate SERIALIZABLE **ROLLBACK-only** preflight read scope:
actual Workspace + service_request/Offering aggregate lock, canonical request
identity, DB clock, S01/DW02 reads and positive ROLLBACK acknowledgement before
returning values. It must not reserve/write C03 or masquerade a command receipt.
This is distinct from Core08's COMMIT-settled Listing read. Core implements this
adapter in this task; this requirement is not delegated back to SERVICE.

## Exact install order / independent lineage

Machine-readable manifest pins each selected source and distinguishes existing
source, new install effects and unresolved compatibility preimages. On the actual
empty isolated application target, preflight first; no blind apply to populated
staging. One unit transaction/COMMIT at a time, no global rollback claim.

1. Real GoTrue schema/migrations, local Auth helpers/JWT verification and
   extensions. Real Auth users are created only through the official API later.
2. Accepted native foundation → assets → maintenance-procurement →
   building-provisioning, exact source bytes/guards/owner-transfer. This creates
   the canonical application baseline, not a reduced demo.
3. Selected SERVICE catalogue baseline, then non-binding Request baseline;
   each source pinned with exact absent/prestate gate. This is an independent
   source→effect install lineage, not replay-all or a claim those historical
   migrations were applied. Neither source creates an Order/payment/Booking.
4. Existing canonical Unit specification/lineage and DW02 resolver units if not
   present in the admitted baseline; incompatible present definitions STOP.
   Exact selectors need their full canonical dependencies, never dummy versions.
5. Existing SERVICE V14 extension on exact baseline.
6. New `01-s01-store.sql`: mechanically derived from the accepted closed S01
   definition capsule, retaining the COMPLETE installer/DDL/ACL/default guards.
   Only its explicitly declared proof ROLLBACK boundary becomes COMMIT in a NEW
   install unit; original source remains byte-identical and is not executed.
8. Core15 session/currentness/runtime-access additive unit. It adds two guards,
   role-scoped policies/ACL and installer-only S01 writer policy, no parallel
   store or ledger. No ALTER DEFAULT PRIVILEGES; exact pg_default_acl unchanged.
7. Canonical SQLSTATE/Core12 guarded successor: existing review-only delta has
   an intentional55000 execution hold. It is NOT an executable install unit;
   the NEW `03-canonical-sqlstate.sql` derived install successor retains its complete
   eight-function pre/postimage, owner, ACL, default and dependency checks, and
   replaces ONLY the review-only envelope with explicit named-development/PG17/
   installer admission plus COMMIT. The ORIGINAL hold/source remains unchanged.
   Target custody outside SQL is still mandatory; a database name is not authority.
9. Catalogue verify, native negative tests, actual run-scoped synthetic data via
   official writers/Auth, then real Request execution/readback/restart proof.

Every mandatory compatibility unit must be delivered before installation; an
unresolved unit is an explicit STOP, not a skipped/applied migration. Existing
four installers retain their independent source lineage and receipt identities.

## Verify and recovery

Before each unit: confirm owned backend/DB OID/role/PG17, full schema/function/
column/index/trigger/policy/owner/ACL/default preimage and exact payload hash.
Mismatch: STOP before send. Back up data+schema+Auth consistently and prove restore
into a SECOND owned isolated target before a populated development transition.
No snapshot/model PASS stands in for restore. No reset of existing product data.

After each unit: same backend CommandComplete COMMIT and ReadyForQuery I (or an
explicit pg-driver settlement correlated to that physical backend), durable
independent readback of intended catalog/default/ACL effects. Unknown ACK:
quarantine lease, STOP next unit; independently inspect exact before/after state.
If after state is complete, record observed committed state; partial/ambiguous is
UNKNOWN. Never blindly rerun or repair-as-applied. Prior committed units remain.

Before any data exists, only explicitly reviewed reverse DDL may remove OWNED
new objects. After Request/audit/outbox/receipt exists, no destructive DROP or
receipt deletion: use backup/restore or forward repair under separate review.
S01 immutable versions/head and original C03 identities remain historical.

Acceptance lane: actual issued Auth/AAL2, two isolated Contexts/Workspaces,
valid/non-financial Request, positive COMMIT and independent durable readback,
API restart; same-key/body concurrent requests produce one Request/audit/outbox/
receipt; changed-body conflict; real lost ACK and same-key recovery; actual
rollback on domain/receipt/audit/outbox failure; foreign/expired/revoked denial;
revoke and expiry during each real wait;40001 identity/rollback; no leaked partial
output. Read preflight settles ROLLBACK, never writes/reserves/commits a command.
Full Service/C03/S01 native cases remain NOT_RUN; Platform12 and the independent session cut are now observed. Clock time at C1 does not
prove validity through later COMMIT/ACK/delivery; all such boundaries must be
reported exactly and unresolved guarantees remain open, not silently weakened.

خودکارسازی: نیازمند بررسی؛ ورودی source/target/payload رسمی؛ فرصت preflight،
identity/hash و آزمون‌های محدود پس از اتصال؛ تصمیم انسانی با Core/Platform/
coordinator؛ شرط target مالکیت‌شده و اختیار واقعی؛ استثنا به مالک همان مرز؛
وابستگی Platform12 و canonical authority؛ ارزش، persistence پایدار با یک اثر است.


## Concrete consumer commands (inspect now; apply NOT_RUN)

- `node scripts/prepare-core-functional-runtime-v1.mjs --check`
- `node scripts/prepare-core-functional-read-queries-v1.mjs --check`
- `node scripts/test-core-functional-install-packet-v1.mjs`
- `node scripts/core15-install-consumer.mjs inspect --unit core15-unit-11`
- After REAL Platform12 target custody/admission and exact handoff hash ONLY:
  `node scripts/core15-install-consumer.mjs apply --unit core15-unit-11 --target <PRIVATE_PLATFORM12_TARGET_JSON> --target-sha <REVIEWED_TARGET_SHA256>`

The last command is a fixed **one-unit** Core consumer of node-pg, not Platform's
lifecycle/controller. It cannot provision, select arbitrary SQL, apply-all, retry
or repair history. It requires a private explicit connection binding, validates
loopback/name/OID/ordinary installer/PG17 before send and same backend afterward.
Its successful state is only COMMIT_ACK_OBSERVED_POSTSTATE_PENDING. It does NOT
invent a separately captured ReadyForQuery frame or declare catalog/native
acceptance; independent poststate/ACL/default verification is required before
another unit. The full Service installer/principal compatibility integration is pending; separate session-cut custody and Auth/PG evidence are recorded in NATIVE-SESSION-CHECKPOINT.md.

New source coupling discovered node-pg int8 revision text: Core's adapter converts
ONLY pinned S01 discover/head revision strings to exactly representable safe
integers, rejects overflow and leaves the accepted reader and all other fields
unchanged. S01's actual SERVICE witness requires service.create_request purpose;
Core creates a new REQUEST in the actual held read/mutation scope and both real
canonical providers re-evaluate it. No preflight allow is relabelled as command
permission. The accepted date-only policy is unchanged.

Separate SERVICE-owned source gap observed while tracing the real provider:
`service-v14-execution/provider-binding.ts` replay evidence uses `new Date()`;
its named-resource catch also discards40001. The first workspace-wide cut does
not invoke named-resource lookup, but the clock boundary still needs a bounded
SERVICE-owned change and real coupling. Core must not rewrite that evidence's
timestamp after the fact or falsely call it database time. No native acceptance
is asserted while any such required contract seam is open.
