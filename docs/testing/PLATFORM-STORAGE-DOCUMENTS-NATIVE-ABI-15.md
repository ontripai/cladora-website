# PLATFORM-STORAGE-DOCUMENTS-NATIVE-ABI-15

**BLOCKED at the shared-schema privilege gate; native Storage ABI/RLS NOT_RUN.**
Parent: `432598c0c5b1ec4632161cf3f328d5092b7e68f2`.
Branch: `codex/program-local-runtime-lane-01`.
Consumer: Documents `16daca595aa2fad8300c8d4d3d6ea4b28980fed8`, readback Git
`3e4f4fa01f826ef451f14f6e48f6e83e47f375a6`. The immutable consumer/source identity
from the completed Storage14 investigation is reused; no consumer test was rerun.

## Actual observations

Existing private stack custody and all five sealed files were checked before the
metadata query, and service CID/image/start identity was compared afterward.
The same approved Storage digest is still configured:
`sha256:31c11d93a3c7840f97acba43f6df9894028dc85dd9c0781d23427e2009be5b76`.
No image was pulled/replaced, no service restarted and no volume mutated. Target
identifiers, CIDs, users, paths to private evidence and credentials are not included
in this report or the safe receipt. The private custody evidence retains them.

| Check | Result | Scope |
| --- | --- | --- |
| Existing stack/source5 custody | MATCH | Existing owned development target only |
| Actual cached `@supabase/supabase-js` | 2.112.4; executable load/constructor PASS | Full SDK, not a manifest-only materialization |
| Internal `@supabase/storage-js` / `@supabase/auth-js` | Both 2.112.4 | Actual resolved entries and loaded closure hashed |
| SDK closure | 43 loaded files | Entry pins and closure SHA in safe receipt |
| SDK load network/session effects | 0 fetch attempts; no session created | No fabricated user JWT/session and no Auth mock |
| `authenticated` table SELECT/INSERT/UPDATE | Present on buckets/objects | Insufficient without schema USAGE and RLS policy |
| `storage` schema USAGE | ABSENT for authenticated and service_role | Effective metadata function, including inherited rights |
| Table RLS / owner | Enabled; supabase_storage_admin | No owner/RLS change |
| Baseline buckets / objects / policies | 0 / 0 / 0 | Existing target metadata, not a fresh-install claim |
| authenticated/service_role elevated attributes | Restricted | No superuser/BYPASSRLS/CREATEDB/CREATEROLE/replication |
| Native upload/info/download and negative cases | NOT_RUN | Stopped before fixture provision |

The SDK probe imports the genuine SDK, constructs its real client using the local
public API binding privately, and finds upload/update/info/download/remove on the
real Storage client. Fetch is denied during this **load-only** operation. It is not
a mocked route response, an authenticated session, or an SDK-to-Storage success.
The 43-file loaded closure is a load-time observation; it does not prove every
future lazy module/dependency or native functional operation.

The recorded fixed catalog gate ran at **2026-11-03T14:44:26.415584Z** through
**14:44:26.700572Z** (18:14:26 Asia/Tehran); its exact source is
`scripts/storage-documents-native-abi-v1/catalog-preflight.sql`, 1500 bytes,
SHA256 `a0c615cdeea018cffbad173144a1a74ff2c90fc8d705b89bf5cb95e6cd572c2e`.
It is one fixed SELECT of metadata/counts, not a business RPC or Auth-row read.
Earlier narrow discovery SELECTs and a subsequent aggregate grant-impact SELECT
are retained separately; the receipt does not imply this was the task's only
read-only query. No Auth data was queried. None of these queries changes a role.

## Exact blocker and required decision

Both principal layers lack **USAGE on schema storage**. The running image's
embedded `src/internal/database/postgres/scope.ts` sets the transaction role from
scope/claims; embedded `src/storage/database/pg.ts` qualifies the tables as
`storage.buckets` and `storage.objects`. A bucket-specific RLS policy cannot supply
schema USAGE. This is metadata plus static implementation evidence, **not** an
observed HTTP403/SQL failure: no native request was sent to manufacture that error.

The relevant embedded source identities (selected lines inspected, not executed):

| Source in approved image | Bytes | SHA256 |
| --- | ---: | --- |
| src/internal/database/postgres/scope.ts | 2500 | 6dd93c6ec8a1d3b357f20e882ff4f91eb004618a662bec7c5a37a61583e3e22b |
| src/storage/database/pg.ts | 104499 | d3bcfa58b849cfe17e7fa311ecc3b119f50e0b41fc43e10024d761b03851496e |

This task does not claim a new official whole-image source attestation. The
release/digest distinction and provenance limits established in Storage14 remain.

The schema is shared. Aggregate effective-grant metadata shows that authenticated
and service_role each already have some DML on **9** relations and EXECUTE on **20**
functions in this schema. Adding schema USAGE is therefore a namespace prerequisite
for objects beyond the single proposed bucket. RLS, function internals and their
other checks would still apply; these counts do not establish successful access
to their data or effects. The task does not silently widen that namespace gate.

**Owner: Platform + coordinator, with Documents reviewing the consumer boundary.**
The smallest candidate prerequisite is a separately reviewed grant of schema
USAGE to the actual required provider/client principals; no table-wide grant,
BYPASSRLS, owner change, RLS disablement or service-key consumer is proposed.
Review its existing-function/relation exposure first. The candidate SQL spelling
is `GRANT USAGE ON SCHEMA storage TO authenticated, service_role;` — **not executed,
not supplied as an approved fix, and not confined to one bucket**. Alternatively,
an exact provider-supported narrower principal binding needs its own reviewed
source/ACL contract; there is no automatic fallback or extra stack/database here.
The five sealed files and provider config remain unchanged.

Once that decision is accepted and the prerequisite is actually observed, a
separate continuation can implement/admit the narrow run-bucket fixture and run
the requested native sequence. This delivery contains the executable **preflight**,
not a completed functional upload harness. It does not claim the goal is achieved.
Nothing about this shared-schema blocker prevents independent Core15 source work.

## Commands, actual results and preservation

Only the following new targeted checks were run; earlier suites/health/bootstrap/
users/restore/restart were not replayed:

```sh
PYTHONDONTWRITEBYTECODE=1 python scripts/test-storage-documents-native-preflight-v1.py
node --check scripts/storage-documents-native-abi-v1/sdk-load.cjs
PYTHONDONTWRITEBYTECODE=1 python scripts/storage-documents-native-abi-v1/preflight.py
```

Six offline tests PASS (table grants with missing USAGE, unknown privilege,
changed policy/data baseline, owner/RLS/table drift, positive metadata gate, and
symlink/receipt-overwrite rejection). They do not mock Storage/Auth or establish
native denial. Node syntax, Python in-memory compilation and diff whitespace
checks PASS. The real preflight exited **2**, with the two schema-usage reasons;
this is the expected **blocked** status, not exit0 or native PASS.

Targeted ESLint also PASS after correcting the new probe's core-module imports
to dynamic import (no rule suppression). The first lint invocation could not
resolve the worktree's absent node_modules; the existing cache's config was then
used explicitly after proving its bytes equal this worktree config (SHA256
`b8e19062ff97ec73e56b47e37c4d66ed5b0f51a53a21f91c9d27ca2645185ba9`).
Its no-require-imports finding was corrected only in the new probe. Because that
source changed, only the SDK load smoke was repeated: final output exactly
matches the earlier 43-file observation, with zero fetch attempts. The original
preflight receipt/executed source is preserved privately; its catalog gate and
the full wrapper were not rerun after that import-style correction. No dependency,
product source, rule or configuration was repaired to pass the check.

The preflight has a fixed existing local target, exact five-file pins, no arbitrary
SQL/target/exec argument and no DDL/Auth/upload path. Its private attempt directory
is created exclusively; a rerun cannot overwrite/retry this receipt. Do not rerun
it just to repeat this result. Even a future empty reasons list returns HOLD for
functional fixture review; metadata is not the required native experiment.

No bucket, policy, file object, session, user, grant or run container was created.
Cleanup is **NOT_REQUIRED_NO_RUN_RESOURCES_CREATED**, not native Storage cleanup
PASS. Existing services/volumes/users/data and five sealed files stayed unchanged.
Product package/lock and every existing tracked source file stayed byte-identical.
Original private restore13 evidence remains immutable. Only the new task15 files
are added. The safe receipt and manifest omit live target/user/session identities.

## Native acceptance matrix still open

| Required observation | Status |
| --- | --- |
| Current real Auth session for existing synthetic actors | NOT_RUN |
| Private fresh run bucket; exact actor-scoped provision and RLS | NOT_RUN |
| upload upsert=false; actual UUID ACK and Key/path | NOT_RUN / NOT_OBSERVED |
| raw bucket_id/content_type to SDK bucketId/contentType mapping | NOT_RUN / UNKNOWN |
| info size/MIME and input/download SHA256 equality | NOT_RUN / UNKNOWN |
| duplicate, upsert overwrite, update, foreign actor and anonymous denial | NOT_RUN |
| Same original ID/bytes after every negative attempt | NOT_RUN |
| Exact run-resource cleanup with known ACK | NOT_RUN |

No null/missing raw response fields are fabricated: there was **no response to
inspect**. No unknown upload was retried. There is no canonical Documents authority,
AAL2, admitted non-overwrite verifier, verified-object brand, conditional delete/
restore, scanner, durable custody or domain installation acceptance here. No
staging/Production, hosted preview, real email or consumer route was touched.

قابل خودکارسازی: **نیازمند بررسی**. Input: exact approved image, sealed source5,
cached SDK and effective ACL metadata. Automatable: readonly custody/version/
namespace gate and safe receipt. Human decision: Platform/coordinator approve any
shared-schema exposure; Documents owns the functional ABI/canonical boundary.
Conditions: owned target, exact pins, no mutation through preflight. Exception:
missing/unknown ACL or native evidence goes to Platform/coordinator. Formal
dependency: accepted namespace/actor scope, then native fixture and Documents
contract. Value: catch a real prerequisite before creating resources; estimate
UNKNOWN. No parallel automation engine/Tracker was created.
