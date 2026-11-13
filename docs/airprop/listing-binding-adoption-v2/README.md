# AIRPROP storage V2 — inactive adoption packet

Same AIRPROP-LISTING-NATIVE-01, source base/parent
`067464d07cb08629adf59490febf6222f5c0d878`.
Assignment: shared Page section «ادامهٔ موازی چت‌های آزاد تا اتصال نهایی»,
AIRPROP block9efb1280-493e-4f9a-82f4-cff353416c87, sequence73 actually read
2026-11-11 Asia/Tehran. Viewer only; no Page write. Coordinator owns central entry.

## Existing output inspected and actual gap

067464d has versioned Party/selection/binding consumer, dual-version history reader
and a guarded fresh-schema V2 candidate. It has **no** existing V2 adaptation,
preflight/verify/recovery or byte-sealed loader. Packet8ecb is V1 and is unchanged;
its27accepted controls and original seal are neither replayed nor relabelled as V2.
This successor adds only the missing packet/tooling and exact Core input handoff.
Product/UI/API/Core/shared host/Auth/package/lock are unchanged.

Directory: `supabase/proposals/airprop-listing-binding-adoption-v2`.

| Unit | Exact source purpose |
| --- | --- |
| preflight-fresh.sql | Target/private expected logical catalog + absent table/guard family + storage dependencies/Core Party revision. |
| fresh.sql | Fresh source only; same physical table/columns/FKs/indexes/history trigger; v2 tagged INSERT and mixed history-compatible CHECKs. |
| verify-fresh.sql | Independently expected logical fresh successor; not install/COMMIT proof. |
| preflight-adapt.sql | Existing **exact V1**, expected source bodies, schema/role/catalog shape, existing object IDs and named CHECK expression commitments. |
| adapt-v1.sql | ACCESS EXCLUSIVE, repeat V1 image gate after wait, replace only two obsolete key-whitelist CHECKs, add version-aware CHECKs, replace only existing invoker subject guard. |
| verify-adapt.sql | Expected adapted logical shape and same existing table/guard/receipt-function OIDs; receipt source is unchanged. |
| recovery.sql | Proposed metadata observation only; zero business-row reads, writes or recovery command. |
| private-plan.template.json | All actual target/principal/compiled-image/OID/CHECK-name commitments remain NULL. |
| seal.json | Source pins + exact bytes/SHA256/Git-blob identity of the eight preceding frames. Not a runtime/installation seal. |

Every SQL unit raises unconditional `AIRPROP_BINDING_V2_SOURCE_ONLY/55000` before
metadata/DDL and ends ROLLBACK. No SQL executed or compiled. These are inactive
reviewable sources, **not an executable installer or permission**. Never strip the
guard, change ROLLBACK to COMMIT or substitute a JSON/GUC claim for Platform admission.
Any future activated successor needs independent review and actual target/role/
writer/capacity/window custody. Keep original packets and history intact.

## Exact non-destructive V1 adaptation

The table name remains `airprop.listing_selected_bindings_v1`. No second ledger or
ownership registry, column rewrite, DROP TABLE, backfill, synthetic Party/revision,
new role, GRANT, owner transfer, policy/default-ACL mutation or new Core helper.
Common existing columns/generated expressions, PK/FKs, unique indexes, immutable
triggers and deferred C03 receipt guard stay. Only these changes are proposed:

1. Identify the **two actual V1 key-whitelist CHECKs** by private reviewed name and
   exact compiled expression SHA256. Do not guess generated CHECK names. Missing,
   duplicate, wrong-type/unvalidated or drifted expressions abort. The entire V1
   before-image must already match; arbitrary CHECK names in JSON do not grant power.
2. Replace those two CHECKs with named v2 root/selection whitelists and add the
   named source_versions consistency CHECK. Each retains a legacy branch that
   requires BOTH version members absent and the exact original V1 whitelists.
   Existing JSON, NULL historical source revisions, IDs/keys/hash/receipt history
   remain byte-unchanged. `ALTER CHECK` validates existing rows, not UPDATEs them;
   trigger logic never backfills them. Bad historical shape stops adaptation.
3. `CREATE OR REPLACE` only `guard_listing_selected_binding_v1()` with the pinned
   V2 Party revision comparison and explicit numeric-v2 tag for new INSERTs. Existing
   UPDATE/DELETE/TRUNCATE rejection is preserved. New legacy INSERTs are rejected;
   existing legacy references remain readable but are not promoted to command allow.
   Function identity/owner/ACL/invoker mode/search_path are retained, never widened.
4. `assert_listing_selected_binding_c03_v1()` is neither replaced nor dropped.
   Both its exact original prosrc and OID are checked, as is table/subject-guard
   identity. Native Core ledger/audit/outbox/receipt sources are not modified.

Fresh source uses the same logical constraints, but must find table and entire
same-name guard function family absent (including unexpected overloads). Existing,
partial or drifted installation is not `CREATE IF NOT EXISTS`, guessed fresh state
or an automatic adaptation choice. Fresh and adapt are alternative paths, never a
concatenated installer. Each existing transaction unit remains independent.

## Shape, owner/ACL/RLS and evidence boundaries

One fixed logical catalog expression covers table owner/ACL/RLS/FORCE/options;
columns/default/generated/identity/ACL; all checks/FKs/indexes; user/internal
trigger semantics; policies/rules; exact guard bodies/ABI/owner/ACL/security/config;
relevant schemas; referenced relation/column/constraint shape; required scope-helper
bodies/metadata; role graph/default ACL/event triggers. No credentials, business
rows, raw function body or password field is projected. Actual metadata must remain
private; do not publish actual target snapshots with this public source packet.

The fresh postimage excludes newly allocated table/function/constraint/index/trigger
OIDs and internal generated trigger names: no future object IDs are fabricated.
Existing-target table and two guard OIDs are separate required before/after
commitments for adaptation. Metadata SHA is calculated on PostgreSQL jsonb::text;
it is **not** a JS JSON hash or a source-file hash. Server-normalized CHECK/index/
generated forms are NOT observed here. All actual compiled commitments remain
NULL; only Platform/QA's authorized exact-source compilation/review can supply them.
Do not bless an unverified current catalog as its own expected successor.

Owner names and effective privileges are not invented. Fresh creation uses the
actual admitted executor's ownership/defaults followed by the original source
revocations; adaptation transfers no owner or ACL. RLS/FORCE stay enabled with no
new policy. Deny-by-default is not functional runtime authority. Existing caller
must have the exact schema/column/table rights and RLS path for both invoker guards;
owner/superuser/BYPASSRLS is not a limited runtime profile. Core Party.native_revision
adoption and listed FK/C03 tables/scope helpers are explicit prerequisites.

Expected catalog/target fields in `cladora.airprop_binding_adoption_v2` are an
administrative comparison carrier, not authentic transport, authorization, an
installed seal or successful compile evidence. Complete writer/DDL/ACL ingress
custody and quiescence must be independently established by Platform. Enabled
event triggers are explicitly rejected; before/after hashing alone cannot fence
concurrent writers. No universal lock-order/DDL isolation is claimed. Metadata
capture/role census size and physical CHECK-validation lock/time/capacity still
need Platform's actual bound and budget. The3s/30s SQL timeouts are not proof of
whole-process output bounds or sufficient resources. Runtime binding stays NULL.

## Loader/seal and offline consumption

```sh
node scripts/prepare-airprop-listing-binding-adoption-v2.mjs --check
node scripts/test-airprop-listing-binding-adoption-v2.mjs
```

`--write` deterministically generates only this new source packet from five pinned
067/V1/V2 inputs. It downloads/installs/executes nothing. The loader requires an
independently obtained expected SHA256 for seal.json, verifies the seal against
those exact input pins and complete generated inventory, then verifies **every**
frame's bytes/hash. Missing, modified or coherently resealed content fails. The
result exposes immutable UTF8 strings with `dispatch:null`, `activation:null` and
status `INACTIVE_SOURCE_VERIFIED`, never SQL execution or READY.

```js
const expected = /* exact delivered seal SHA256, independently verified */;
const source = loadSealedPacket(name => readFileSync(packetDirectory + '/' + name), expected);
// source.units is verified source only; there is no pg/execute/launcher API.
```

`selectSourceMode` compares explicit observed object-presence triples and private
before-image commitments. Absence/partial/drift/unknown and already-present V2
have distinct outcomes. It is a source-plan selector with dispatch:null, not
permission or freshness evidence. No UNKNOWN install chooses a mode automatically.

`classifyRecovery` compares saved before/after/expected logical hashes without
changing settlement: matching postimage requires independent reverify; old image
is preserved; other image is DRIFT_STOP; missing/invalid input is BLOCKED. Lost ACK
stays unknown. It never repeats install, drops partial state, synthesizes receipt,
settles a business UNKNOWN or changes its endpoint/body/key/fingerprint/history.
A later real install requires actual transport ACK/rollback/close plus independent
source/target and data-preservation verification by Platform/QA. This packet does
not recreate existing command recovery or the C03 engine.

## Exact remaining Core handoff

See `core-inputs.json` for actual symbols, argument/result shape, native writer/read
query mappings and operation-specific missing producer. No successful ABI is
invented. Important existing handoff gap: current POST's bounded parser consumes
the original Request stream and returns parsed JSON; prepareControl receives that
parsed object. It is **not** an original-wire source. A durable official original
operation lookup or explicitly agreed bounded raw-wire custody handoff is required
before fresh dispatch/replay. Do not JSON.stringify parsed/current GET data and
call it the original command. This task changes no parser/shared host/API.

Core owns independent manage/publish authority, original mapping/replay and current
source_versions after waits; AIRPROP supplies its existing plans/mutator; Platform
owns storage/query/role adoption and real execution. Read companion Core16 remains
own-party asset.read only. Finance review is not a dependency for this packet.

## Actual verification

22 new source/offline-byte controls PASS. Initial19 then added shape/dependency
controls were rerun only as this new packet changed. No old27/Core13/consumer14,
MFA, Request or sizing suite replay. Deterministic generation/loader pins, source
boundaries, legacy-whitelist preservation, fresh/adapt separation, readback hashes,
negative tamper/reseal/partial/drift and UNKNOWN no-retry rules are verified.
Node syntax/scoped lint/full typecheck/diff and patch apply/reverse results are in
manifest. No SQL parser/compile/query/installation or embedded/native PG executed:
NOT_RUN_NOT_PASS. Logical schema/lock/constraint reasoning is not physical SQL
validation or RLS/role/adoption/native UI/API/DB acceptance. Cache versions and
exact-target limitations remain explicit. Activation=NULL.

Automation: نیازمند بررسی. Byte/source comparison can be mechanical; private
compiled source acceptance, target/owner/writer capacity/admission and native
acceptance stay with named Platform/Core/QA/Coordinator owners.
