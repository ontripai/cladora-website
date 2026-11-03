# PLATFORM-STORAGE-DOCUMENTS-NATIVE-ABI-15 / ACL-R1-AND-HARNESS

**Per-object ACL review, a concrete reversible-privilege proposal, and the native
SDK harness source are delivered. Execution remains HOLD; native results NOT_RUN.**

Parent: `b7f61c027e9fd96afc663fc208d869760f14c791`.
Branch: `codex/program-local-runtime-lane-01`.
Consumer: Documents `16daca595aa2fad8300c8d4d3d6ea4b28980fed8`, readback Git
`3e4f4fa01f826ef451f14f6e48f6e83e47f375a6`.
This is additive to the accepted preflight, not an overwrite/replay. No Core/Docs
source, five sealed files, original receipt or restore13 evidence is changed.

## Observed access, before any proposed change

The old snapshot/SDK/custody receipts were consumed. Three **new targeted catalog
SELECTs** fill the previously missing per-object, actor-helper and ACL-recipient
metadata. No Auth row or function execution was requested. Full definitions and
raw catalog responses remain private. The safe JSONs are curated privilege
results, role attributes and definition/source hashes, not raw catalog exports.
Exact query bytes/hashes and UTC intervals are in the safe receipt; the first
per-object slice ran2026-11-03T15:06:02.417433Z–15:06:02.698909Z. Original bucket
counts were not rerun or used to establish the safety of other objects.

All ten relations below are owned by **supabase_storage_admin**. That owner is
LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and
NOREPLICATION. It nevertheless bypasses RLS on its own non-FORCE tables: owner
rights are not removed by NOINHERIT/NOBYPASSRLS. All ten have RLS enabled,
FORCE=false and no policies. Only nine have client table grants; migrations is
included separately to avoid hiding an object with different access.

| Relation | Direct authenticated rights | Direct service_role rights | RLS/policy |
| --- | --- | --- | --- |
| storage.buckets | INSERT/SELECT/UPDATE/DELETE | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.buckets_analytics | INSERT/SELECT/UPDATE/DELETE | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.buckets_vectors | SELECT | SELECT | enabled; no policy |
| storage.iceberg_namespaces | SELECT | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.iceberg_tables | SELECT | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.migrations | owner default / none for clients | owner default / none for clients | enabled; no policy |
| storage.objects | INSERT/SELECT/UPDATE/DELETE | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.s3_multipart_uploads | SELECT | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.s3_multipart_uploads_parts | SELECT | INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | enabled; no policy |
| storage.vector_indexes | SELECT | SELECT | enabled; no policy |

`anon` has the same direct DML set as authenticated on these nine, but schema
USAGE is absent for anon/authenticated/service_role. PUBLIC has no table grant;
these three roles have no inherited grant that supplies missing rights. The JSON
records direct/inherited/PUBLIC paths separately, all grantors and grant options.
All explicit table grants originate from supabase_storage_admin. PostgreSQL's
custodian postgres has the existing grant options on buckets/objects; that is
not a consumer identity and is not changed by this proposal.

The owner can SET anon/authenticated/service_role through memberships with
ADMIN=false, INHERIT=false, SET=true. authenticator can SET anon/authenticated,
not service_role through those observed edges. authenticated/service_role have
no membership back into the provider owner. The supplementary principal slice
verifies names/attributes instead of guessing an ACL recipient's OID.

**RLS does not constrain TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.** service_role
currently has all four on seven relations. A schema USAGE grant must not silently
expose those rights. DML is currently default-denied for non-owners with no policy;
that does not prove every namespace exposure harmless. There are **no sequences**
and **no custom pg_default_acl rows** in the storage/global slice. NULL relation
ACL is owner default, NULL function ACL includes PUBLIC EXECUTE. Objects' ID
expression is gen_random_uuid(); the observed fixture column expressions do not
require a sequence grant. Defaults/generated expressions are pinned as catalog
shape; no blanket sequence/default grant is proposed.

## All20 functions: direct/PUBLIC access, owner and scope

All20 are **SECURITY INVOKER**, owned by the same non-superuser storage owner.
Every proacl is NULL: each expands to owner EXECUTE plus PUBLIC EXECUTE, not an
explicit authenticated/service_role grant. No inherited path is needed for that
PUBLIC right. Only two pin search_path=pg_catalog; the other18 inherit ambient
search_path. INVOKER is not an actor check or a whole SQL-injection certification.
Data functions rely on caller privileges/RLS; parameters and operation labels do
not establish current actor authority. Trigger helpers have their own narrower
control checks. Every signature, owner attribute, grant source/option and full
SHA256 is in the machine-readable per-object review.

| Signature | search_path | Actor/scope review | Definition SHA256 |
| --- | --- | --- | --- |
| `storage.allow_any_operation(text[])` | ambient | Compares operation labels, not actor authority; invoker. Operation GUC is not an authorization envelope. | `a4ae3c8d1258ced584d91fed4bf7a9b0729937dd07cfe7d5fe45b2808a12b966` |
| `storage.allow_only_operation(text)` | ambient | Operation-label predicate only; no actor/tenant binding; invoker. | `a12f88ff4e00a9a63c24a93ea5b120e790be63a3555e840656c6525ff6dc0a85` |
| `storage.can_insert_object(text,text,uuid,jsonb)` | ambient | Attempts caller-scoped object INSERT then raises rollback sentinel. No own actor authorization; table ACL/RLS still required. | `d6a14645c2a2a394b759f3fb6bbbe5b67cceb6b8c4229a3e7e6c27e1f98c25cf` |
| `storage.enforce_bucket_lifecycle_service_role()` | pg_catalog | Trigger checks current role against configured trigger role argument; bucket control columns. Not an actor ownership check. | `1cb7aecc95a27f8600fc8e7aab11f6a40b9b46a5cb86e02438f3af9642a0d2c4` |
| `storage.enforce_bucket_name_length()` | ambient | Trigger validates bucket name length; no actor/scope authority. | `bf9dcf9beab8062d27f9f6f5db850fac0c22423d6d62d31a3fe9622b1244336e` |
| `storage.enforce_versioning_status_transition()` | ambient | Trigger restricts versioning transitions; no actor authorization. | `fcd699a13272ce769d3a94322d3a150562ea8c6fd191018e025f67815776fff5` |
| `storage.extension(text)` | ambient | Pure path/string helper; no actor authorization or row access. | `839c088c388a275fdfd10d7d909f12b55e643c8ba8a2c6ef674b62c641113b94` |
| `storage.filename(text)` | ambient | Pure path/string helper; no actor authorization or row access. | `6616e7416f58bfe6bcb2a58f1da44477d79e1383430a958dd6b2b854668817f0` |
| `storage.foldername(text)` | ambient | Pure path/string helper; no actor authorization or row access. | `a673a01626cb42e9eb507eb18e4cb038ce5db1da875a22e254df2ebb597bd2bc` |
| `storage.get_common_prefix(text,text,text)` | ambient | Pure prefix helper; no actor authorization or row access. | `62810fa1178c7e748df4393fca51900b36841187fcbcfa79740d45ea54b4357d` |
| `storage.get_size_by_bucket(text,text)` | ambient | Caller-selected bucket/version filters and object aggregation; no actor predicate of its own; invoker ACL/RLS boundary. | `25ec89ec6e8b55554c0403487a7f83f9331d13b3a01d1f5e44d56857cec8476e` |
| `storage.list_multipart_uploads_with_delimiter(text,text,text,integer,text,text,text)` | ambient | Caller-supplied bucket/prefix/cursor filters; invoker multipart-table RLS, not a canonical actor check. | `80bf7eb30e8b8b54536a0fbcc34f0da11310c375d56d358ca591d9e675e1e30e` |
| `storage.list_objects_with_delimiter(text,text,text,integer,text,text,text,text,text,timestamp with time zone,text)` | ambient | Bucket/prefix/version/cursor filters with dynamic SELECT; no actor identity check; invoker object RLS. Not a SQL-injection certification. | `2ea5b0041a685b122bc06e975e186c7b8bb6159c4561ff1e82c9ee142230a30e` |
| `storage.operation()` | ambient | Reads storage.operation GUC; pure status label, not authority. | `45b3c213bf286ff7601da09fd91d246339d8c79e0bd573bfb6984d806841fcde` |
| `storage.protect_bucket_control_columns()` | pg_catalog | Trigger checks configured-role membership for lifecycle insertion and bucket/version/lifecycle consistency. Not a user membership verifier. | `dac4257ed931d18bac0cbbc3135d0c75a36aae55309059d2913ed5e6792fa8de` |
| `storage.protect_delete()` | ambient | Trigger denies direct deletion unless provider sets allow_delete_query. GUC is a safety latch, not owner/actor authority. | `60b634ed07bf3c08749b31168c62d598f2a9d10f8cef4ee8251bde93909cd30b` |
| `storage.search_by_timestamp(text,text,integer,integer,text,text,text,text,text,text,text)` | ambient | Parameterized dynamic SELECT and sort/filter construction; caller bucket/prefix filters; invoker RLS; no own actor predicate. | `00035e14f49a1cd28b87d80e0aefde8e4bf1fb91fe4f8facbcb6001c27f8849b` |
| `storage.search(text,text,integer,integer,integer,text,text,text,text,text)` | ambient | Dynamic listing/filter branches; caller bucket/prefix/version filters, invoker RLS; no own actor predicate. No broad injection-safety claim. | `554f4855e4490792b6c854ba68e622f39f004515d092e7409b0167a44b4acc99` |
| `storage.search_v2(text,text,integer,integer,text,text,text,text,text,text,timestamp with time zone,text,boolean)` | ambient | Delegates to invoker listing/search helpers; caller scope arguments do not establish actor authority. | `cd96303762e94fbd02f84a408a09af8019d15c33b2df537bdf1909da8561bcaf` |
| `storage.update_updated_at_column()` | ambient | Timestamp trigger; no actor or tenant authorization. | `5b3d8ac75beaf9d1532159c055aa927297f5611ad2ea82c27dbadf76887bb25e` |

`auth.uid()` is an additional policy dependency: INVOKER, fixed pg_catalog
search_path, owned by NOSUPERUSER/NOBYPASSRLS supabase_auth_admin. authenticated
has EXECUTE and USAGE(auth). Its definition hash is
`19bc12806121d6419808aec991e7c32210c7ffb35ce7ac949d937c5720c1808f`.
The source reads provider legacy/JSON claims; our harness does not SET/fabricate
user claims. The actual new user sessions must be issued/verified by real Auth.

## Principal path and minimum proposal

The provider-source review pins28 actual compiled JS files and their embedded
source identities in the same approved read-only Storage image. It distinguishes
static source analysis from an observed per-request database principal. Existing
private API selectors were checked against live configuration; their signatures,
expiry and roles resolve to anon and service_role. No new JWT/key/user/session was
created; token values/payloads are not published.

- SDK consumption: existing anon API binding plus a freshly issued real user
  bearer. Auth getUser/getClaims must match the fixed synthetic actor, issuer,
  session ID, role and actual AAL1. No service-key or fabricated AAL2 fallback.
- Private bucket metadata/limits: provider getServiceKeyUser→asSuperUser changes
  current transaction role to configured service_role. It is **not PG superuser**.
  SELECT on the exact bucket is needed; bucket INSERT/UPDATE policy is not needed
  for the consuming SDK. A separate custodian provisions the named bucket.
- upload(false): caller INSERT permission probe is rolled back. completeUpload
  rechecks through asCaller, then records through internal service_role. In the
  fixed DISABLED bucket that record is INSERT…ON CONFLICT DO UPDATE, so its existing
  table UPDATE privilege is syntactically relevant. No new table UPDATE grant or
  UPDATE RLS policy is assumed: a fresh non-conflicting insert is the intended
  positive case; update/upsert over the first object must be denied for the caller.
- info/download: service_role bucket lookup, then original verified authenticated
  caller's object SELECT/RLS. The filesystem renderer is not an authorization
  replacement. Other-user and anon paths are separate negative cases.
- Cleanup: a separate custodian service client, only exact run path/bucket DELETE,
  followed by database AND physical-file/directory observers. Never a consumer
  success result under an admin key. No user/old-session/volume removal.

The provider accepts a role from a verified JWT, but there is no **existing,
accepted narrower role binding** for this user/SERVICE_KEY path. Switching it would
require a separate supported Auth/config contract. No replacement role, new
signed claim, new credential or config edit is invented here.

The exact proposed bodies are versioned in `acl-delta.v1.sql` and
`acl-recovery.v1.sql`; `plan.py` prepends target/ACL/owner/RLS/function guards and
renders the exact private actor/run bindings. **No GRANT/REVOKE was executed.**

1. Verify existing Seat custody, original service identity, database/system,
   complete catalog fingerprint, owner/role/membership/default ACL and auth.uid
   dependency. Target drift stops before mutation. An exclusive Storage ACL
   change window is a coordinator prerequisite, not a generated lease claim.
2. In one bounded transaction, SET LOCAL ROLE to the existing owner for grantor
   fidelity; revoke precisely the four non-DML privileges from service_role on
   buckets, buckets_analytics, iceberg_namespaces, iceberg_tables, objects,
   s3_multipart_uploads and s3_multipart_uploads_parts. Then add schema USAGE to
   authenticated and internal service_role. No CREATE, new table/function grant,
   owner/role/default ACL change, RLS disablement or PUBLIC schema grant.
3. Require exact poststate: those service grants become DML-only; original SELECT
   rights elsewhere, function EXECUTE, all grantors/options, roles, owners and
   defaults stay fixed. Schema gains only the two USAGE entries, owner grantor.
4. Provision one fresh private STANDARD/DISABLED PNG bucket and seven named policies:
   authenticated object SELECT+INSERT with exact actor/bucket/path; internal
   service object SELECT+INSERT+DELETE and bucket SELECT+DELETE with exact scope.
   No authenticated/service object UPDATE policy and no bucket INSERT/UPDATE
   policy. This fixture is not canonical Documents authority.
5. After native cleanup and exact custody checks, drop only owned policies and
   recover original effective grants/options with the same owner grantor. Foreign
   catalog drift, unknown transaction state or unproved custody blocks recovery;
   no blind repair, replay, broad DROP or direct catalog update.

**Recovery representation gate:** initial nspacl=NULL. Ordinary GRANT then REVOKE
restores the effective owner-only USAGE/CREATE and initial grantor, but leaves an
explicit owner ACL representation. It does not restore physical NULL. This is
recorded, not hidden by normalization or pg_namespace writes. The future curated
review must explicitly accept semantic/grantor recovery with that representation
difference. If raw-byte/NULL identity is mandatory, this proposal stays HOLD;
it cannot promise that recovery with ordinary ACL DDL.

## Complete native harness, closed admission

`harness.py` and `native.mjs` implement the real sequence, not callbacks waiting
for implementation. Existing stack custody, admission helpers and physical Wire
are reused; no parallel DB transport, new server/runner topology or generic exec.
The SDK is genuine2.112.4 with internal Storage/Auth clients2.112.4.46 real cache
files (43 load-observed files plus3 manifests) are pinned. The actual guarded
loader smoke passed; it is not a native Storage/Auth result. An unpinned require,
file/hash drift, path alias or injected executable hook is rejected. The existing
NODE_PATH selector is preserved/pinned; it cannot authorize an unpinned module.
Actual Node/Python/Docker binaries are hashed, and the worker's parent/entry/run
claim, argv, actors, private selectors and bytes are independently checked.

The consumer uses actual SDK signInWithPassword/getUser/getClaims, upload(false),
info and download. It checks real Id/Key↔id/path/fullPath, required raw-to-camel
bucket_id/content_type mapping, size/MIME and download SHA256. Missing/null optional
version/ETag are reported separately for raw and SDK; neither creates a brand.
Duplicate(false), upsert(true), update, other-user and anon info/download plus a
real GET of the SDK-generated public URL are required negatives. A random4xx,
401/expired JWT, rate limit or malformed route is not accepted as RLS denial.
After each negative, original UUID/generation/MIME/size and exact bytes are checked.

Every HTTP effect rechecks curated admission/currentness/source/SDK/target through
its private parent gate. Original expiry is rechecked after waits/fsync/import;
expiry equal to now stops, never renews. Requests cannot supply SQL/shell/path/
review authority; approved:true is rejected. SQL bytes are independently rebuilt
from source, not merely accepted because a request recomputed their hashes.
A durable exclusive claim consumes any admitted attempt; lost ACK never resends.

Private Storage raw response evidence has order/hash chains and fsync. Normal and
cleanup capacities cannot borrow; write-short/fsync/disk-full breach quarantines
normal effects across phases. Cleanup has a separate bounded lane and retains
the last stable anchor. Driver/body-capture/persistence causes are distinguished
and the original first cause survives SDK wrapping and later cleanup errors.
The9MiB local HTTP limits are not an approved disk quota or a mathematical future
provider response bound; body/capacity breaches are UNKNOWN, never truncation-PASS.
The unchanged Wire's1MiB incoming bound remains; outgoing maximum is10307+6 bytes,
below its documented12KiB envelope. No old capture budget/request is changed.

A failed/lost worker result is DISPATCHED/UNKNOWN, not NOT_RUN. Unknown native
terminal state cannot turn a zero point-observation into residue proof. Empty
physical directory residue also blocks complete cleanup. No filesystem deletion
fallback is implemented: only provider exact remove/deleteBucket, then read-only
observers. Leftovers/unknown outcomes remain Platform custody, immediate stop,
follow-up within1hour and private evidence retention30days. Auth local signout
ACK does not instantly invalidate an already issued access JWT.

## Local candidate and commands

Run commands **only in this assigned Seat/worktree**; copying Git source does not
provide another Seat's runtime/credentials/custody. No target, SQL, --exec, shell
or arbitrary payload argument exists. Secrets remain in the original private
custodian selectors and memory, not Git/session files or this report.

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/storage-documents-native-abi-r1/harness.py --inspect
# --prepare was already performed locally; do not rerun to reproduce a receipt.
# ONLY after exact separate ACL/native review and single-use curated admission:
PYTHONDONTWRITEBYTECODE=1 python scripts/storage-documents-native-abi-r1/harness.py --run
```

Final PRIVATE request: **6177bytes**, SHA256
`6bdfe4ab4504dd39fd41f1bf434d103ec2c01c0ae0f071d79c4a93def4d2339c`.
Source seal21files:
`25c7181f417248b7bf31b0cfda7492809c11125a937c27a3ab2b9f4d65ff7a5c`.
Authority/execution_binding=NULL; curated reviews EMPTY. The actual CLI negative
control on this exact candidate exits2 before any run claim, Docker/SQL/Auth/native
dispatch. It is an admission rejection check, not a consumed native attempt.
All four SQLs are complete, privately bound source outputs, **not executed or
parsed by PG in this task**. Their safe identities:

| Private unit | Bytes | SHA256 |
| --- | ---: | --- |
| acl_apply | 10307 | `f1736abcf35bbe222d703c438d638a33f13d724dc7d607eed6ec29664abbe09c` |
| fixture_create | 6188 | `f56341f09f36022b7c2830027cf120a677028e3812ba2d4d49fa763f3ba1dea7` |
| fixture_drop_policies | 4411 | `e8566fc772f99928be6e7fcbac20daa189ff0eed4f2563127b1d5958ae1c8738` |
| acl_recover | 4739 | `6b28645b8e927a335b984b1147376ee516e2d8d3a2292a8dd895d77d922ec8f8` |

The earlier unexecuted6177-byte candidate SHA1e43a0… and exact source seal6f59be…
were preserved before the final error-cause refinement. This final request replaces
that local proposal; they are not stacked, replayed or treated as approved runs.
The original accepted task15 preflight and all older execution/restore receipts
are independently preserved and unchanged.

## Checks, limits and next decision

**23 unique new offline controls PASS**: Python12 (scope, source-bound SQL plan,
owner/grantor recovery, expiry after metadata work, arbitrary SQL with recomputed
hash, first-error/recovery failure), Node ABI/route/error7 and filesystem capture
fault4. Only changed R1 interactions were rechecked during construction; accepted
preflight6,69backend, product suites, health/provision/users/restore were not rerun.
Python in-memory syntax, Node syntax and targeted lint pass using existing tools;
no install/lock/config/rule suppression. Early test-fixture errors were corrected,
not used to weaken runtime assertions. No model/fixture/SDK-load result is native
Storage/Auth proof. Full worker IPC, PG parsing, real sessions, every object route,
RLS negative and native cleanup remain **NOT_RUN**.

Needed decisions: coordinator/Platform accept or reject this exact namespace plus
seven-relation hardening delta and raw-NULL recovery difference; reserve the
owned Storage ACL window; review the6177-byte private request and activate only
its exact one-use record. Native execution needs its own explicit owner scope.
Do not install a shared grant separately and assume the request's original
prestate still matches: a changed prestate requires a reviewed rebind. Core15
continues independently; no Core installer, domain SQL, staging/Production,
frontend route, image/config, real email or existing user/volume changed here.

This proof would establish only the limited Storage ABI/RLS fixture. Canonical
Documents intent/authority, actual AAL2, official non-overwrite verifier,
verified-object brand, conditional delete/restore, scanner and durable custody
remain separate gates. ETag/version/upsert=false are not that authority.

قابل خودکارسازی: **نیازمند بررسی**. Input: exact source/image/SDK and per-object
ACL/definition pins. Automatable: safe catalog diff, deterministic SQL binding,
closed admission, ABI comparisons and bounded evidence. Human decision:
Platform/coordinator approve shared exposure/recovery/window and the exact native
unit; Documents owns canonical authority/assurance. Conditions: owned Seat,
unchanged pins and independently accepted scoped request. Unknown state/cleanup
escalates to Platform/coordinator; no automatic retry. Dependency: pinned provider
and Documents readback, accepted ACL prerequisite. Value: prevent broad grants
and false native acceptance; estimate UNKNOWN. No new automation engine/Tracker.
