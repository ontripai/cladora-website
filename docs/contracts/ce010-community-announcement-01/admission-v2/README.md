# CE010 admission packet v2 — current source, capability still blocked

CE parent/source: `c89feaedb8ffe7f7302fe6e34864aad6e06bb7b1`.
Producer: Core `6adb3e3f0ffc72f1f138a4990b23653a7c5b62cd`.
Corrected metadata: Core `103ee9ad61c033a0745b2558b052912f16381ee2`.
Assignment: shared Viewer Page sequence73, CE block
`af688e29-3ef0-4c1e-930b-6203463d5e4c`.

The independently reviewed CEc89/Core6adb coupling is reused, not rerun or
rewritten. This delta closes the **source-packet** gap documented by c89: the
historical packet still described a missing producer and pinned an earlier
Core host. Its immutable989 artifacts and all product/Guide/public binding
files remain unchanged. This new version does not implement Core/Platform
primitives or supply target credentials, grants, installed ownership or native
proof.

| Area | Historical v1 input | v2 consumption |
| --- | --- | --- |
| Producer | Missing-producer observation on old base | Actual official factory source6adb, current couplingc89 and metadata103 pinned |
| Core host | SHA2569436c082… | Effective Core103 host SHA256e269802f…; exact31-query official profile0069780e… |
| Root requirements | CE declaration/column/function inventory | Same unchanged CE requirements explicitly reused; not mistaken for recursive Core closure |
| Role/lease | Core admission placeholders | Exact Core profile semantics and two safety signatures; definition/owner/ACL/lease evidence still NULL/BLOCKED_CAPABILITY |
| Catalog source | CE-only routines and direct role edges | CE + shared roots + both safety routines; routine ABI/config/hash/owner/ACL, column ACL, constraints, RLS/policy expressions, triggers, schema/defaultACL and cycle-deduplicated reachable roles |
| Existing target | Fresh-only unit rejects presence | Separate fresh-plan and adaptation-plan; any partial/existing CE object selects adaptation; missing inventory is UNKNOWN |
| Recovery | Prior QFW diagnostic retained | New metadata-only recovery checks expected target before any before-image fallback; never ACKs, mutates or auto-retries |

## Files and reconstruction

`supabase/install/ce010-announcement-v2/` contains:

* `packet.json`: v2 file identities and immutable input roots.
* `inventory.json`: current source/factory/query/mapping and CE root requirements,
  canonical declaration spans, exact column/policy candidates, owner/role/helper
  boundary and unresolved target postimage.
* `fresh-plan.json`: reference to the exact **guarded** canonical CE989 domain
  unit, with its existing single transaction; no duplicate business SQL.
* `adaptation-plan.json`: target before-image requirements; forward delta NULL
  until an actual reviewed target image exists. No generic CREATE/replace/upgrade.
* `00-preflight.sql`, `20-verify.sql`, `30-recovery.sql`: passive catalog-source
  proposals. **Each raises55000 before any catalog observation.** No helper is
  invoked and no DDL, DML or grant is generated in these three files.

Use existing installed tools and normal Git object custody. Both formal refs
and their history must be available locally; no shared workspace/archive is
required. The builder does not fetch or connect anywhere:

```sh
node scripts/build-ce010-admission-packet-v2.mjs --output=/absolute/fresh/local/directory
node scripts/test-ce010-admission-packet-v2.mjs
```

The fixed14 roots in `scripts/lib/ce010-admission-packet-v2.mjs` are independent
of generated manifests: immutable Git refs, source byte lengths, SHA256 and Git
blob identities are checked before deriving anything. Metadata103's corrected
source references are matched to the historical objects, including the real
`docs/contracts/ce010-community-announcement-01/install-packet/dependencies.json`
path. There is no `dependencies.json` beside v1 `packet.json`.

Executable/source file bytes are independently rederived before trusting mutable
candidate hashes. A coherently resealed catalog, inventory or adaptation plan
is rejected. Existing differing output is preserved with a conflict; there is
no install flag. Regeneration is optional validation, not needed merely to
transfer this already generated packet.

## Exact consumption boundary

The live source consumer remains
`src/app/api/customer/v1/community/base/route.ts` →
`createCoreCe010RequestRuntimeV1({runtime_pool,target,connection_model})` →
`createAnnouncementHandlersV1` → existing CE provider and C01/C03. GET read is
independent of publish; native failure/denial cannot choose a weaker fallback.
The original Request, command, wire/key/hash, version, receipt and UNKNOWN
behaviour remain unchanged. `CE010_PLATFORM_PROVIDER_V1` is still NULL.

The official31-query profile includes SQL text, arity and source symbols/paths;
it is carried verbatim in inventory.json. Existing HTTP/provider/root query
bytes remain pinned to c89; current Core factory/role-pool/host/authority-provider
bytes are pinned to103 (runtime code is unchanged from6adb). Mapping comes from
the actual Core contract: community_basic / module.community_basic;
community.community.read; community.announcement.publish;
community.announcement.command; AAL2. Presence in source is not a grant or
permission/module seed.

Canonical CE tables/constraints/functions/policies/column requirements are
reused from989 as **domain source candidates**. Domain owner SELECT inventories
are query requirements, not ownership privilege ceilings. A real domain owner
retains inherent DDL/admin power. The old Community `FOR UPDATE` lock-only
`UPDATE(version)` proposal and scoped `WITH CHECK(false)` remain proposals,
not tested PostgreSQL privileges. Existing reports are a transitive dependency
of the reader, not a new report writer. No alternate receipt/idempotency engine,
legacy writer, backfill, ownership transfer or shared grant is introduced.

Catalog-source contract: no prepared SQL arguments or app payload. After a
separately admitted observer execution (not supplied here), each catalog SELECT
would yield one `ce010_admission_catalog_v2` JSON value with target, current/
session principal, relations, routines, roles, role_edges, schemas and default_acl.
The optional `cladora.ce010.owner` session setting only selects an additional
role to inventory; it is not proof of ownership/authority. This packet does not
set it. Missing requested objects remain explicit present=false entries.

Catalog SQL deliberately does not validate a whole recursive evaluator/session/
lineage/helper closure or implement a role-safety predicate. Role reachability
and metadata snapshots cannot exclude concurrent writers or establish a held
lease. It records requested identities even when absent so missing records
cannot silently become fresh. Defaults and owner/ACL/config fields are for
Platform's exact pre/postimage reconciliation, not evidence of installation.
No app/auth/session rows, passwords or credential values are selected.
Output/resource bounds and observer rights require actual Platform admission;
this source has no capacity guarantee or borrowed Finance/Guide/SERVICE budget.

## Owners and remaining inputs

| Owner | Required input / exact closure | Status |
| --- | --- | --- |
| Core | Recursive C01/C03/session/evaluator/lineage/default/sequence closure and source/query/permission admission for this family; existing authority/host only | Input beyond the CE root inventory remains Core-owned; no producer-source blocker |
| Platform | Implement `app_private.assert_ce010_role_safety_v1()` with the actual role/helper/owner/ACL/defaultACL/SET graph invariants | BLOCKED_CAPABILITY until real implementation and owner/body/ACL evidence |
| Platform + custodian | Implement `app_private.acquire_ce010_role_safety_lease_v1()` with real catalog/role mutation exclusion or proven invalidation **through settlement** | BLOCKED_CAPABILITY; cooperative lock, old no-writer observation or modeled safe=true is insufficient |
| Platform | Actual target/OID/version/marker, ordinary domain-owner/creator lane, exact runtime/executor graph, column grants, FORCE RLS/policy/function postimages and before-image custody | UNKNOWN, not inferred from source-proposed role strings |
| Platform + App | Dedicated server-only CE010 Pool/target/direct-or-session-pooler binding; destroy-on-release capacity | NULL; Guide/SERVICE profiles are not substitutes |
| Platform + QA | Exclusive admitted window, bounded observer/capture/resources, install/verify/recovery and real Auth/currentness/denial/concurrency/UNKNOWN/restart/native | NOT_RUN_NOT_PASS |

Core's required result for either safety call is exactly one row `safe=true`
only under its real invariant. The source-proposed roles are
cladora_ce010_runtime LOGIN and cladora_ce010_executor NOLOGIN; neither may
have superuser/BYPASSRLS/CREATEROLE/CREATEDB/replication/INHERIT or unintended
SET/ADMIN/owner/CREATE paths. These strings are **not observed installed roles**.
Use metadata103's complete `safety_semantics`, not this paragraph alone.
CE supplies neither function body, role graph nor positive grant.

## Fresh / existing / recovery

Fresh is a source planning path only when **all seven requested CE tables and
routines are explicitly inventoried as absent on the exact expected target**.
All capability gates remain blocked; no source metadata can authorize SQL.
The historical guarded CE unit is a declaration reference, not a ready current
Core installer. Its guard is not removed, and an outer transaction is not added
to independent existing units. Platform's admitted wrapper must reconcile full
postimages and protected role/defaultACL images before any real ACK.

Any existing or partial CE object routes to adaptation, never fresh CREATE.
Without a real before-image, `forward_delta` remains NULL and the packet states
BLOCKED_TARGET_BEFORE_IMAGE. A matching name/count or apparently identical
schema is not adoption of authority. No data, historical receipt/command or
old ledger is rewritten. A real structural defect is returned to its owner.

The offline classification/recovery helpers cannot dispatch SQL and never
return admitted/runnable/ACK/mutation true. Target mismatch or incomplete
inventory is UNKNOWN. Missing reference postimage is blocked. Exact before
image permits **manual review only**, with automatic retry false; exact post
metadata match is review-only, not an execution receipt or proof of COMMIT.
Partial/drift/unsettled state remains UNKNOWN/stop/no ACK/no mutation. Expected
reference metadata is an external comparison input, not an authenticated seal.

## Limited evidence

17 new offline source-binding/synthetic metadata checks passed. They cover
current refs/query/mapping, unchanged legacy unit, missing/duplicate inventory,
wrong target, separate fresh/adaptation, caller flags that cannot activate,
coherently resealed negatives, protected metadata drift and conservative
recovery/output conflict. After deduplicating role traversal, only the two
changed catalog/reconstruction checks were rerun. Syntax, focused lint and
staged diff checks passed. No old17/13/12/23/3/6 suites or accepted coupling were
run. No TS/product source changed; the prior composed typecheck is reused as
historical evidence, not counted as a new run.

No SQL parser/compiler, PG, real Auth, installation, build, restart, native
browser/API, grant or activation ran. All positive evidence is source or
synthetic metadata. Viewer Page is not edited; Coordinator records the handoff.

خودکارسازی: نیازمند بررسی؛ ورودی، refs رسمی و inventory سورس است؛ بازسازی و
تطبیق بایت‌ها قابل تکرار است. تصمیم admission با Core/Platform و پذیرش با QA؛
اجرای واقعی مشروط به target/window/lease و ظرفیت معتبر است. نبود capability
به Platform/custodian ارجاع می‌شود؛ معیار ارزش، جلوگیری از مصرف pin قدیمی و
fresh/adaptation یا recovery نادرست بدون تکرار کنترل‌های پذیرفته‌شده است.
