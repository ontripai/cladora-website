# DOCS-CE012-CORE14-MATCHER-ADOPTION-10

**V2_CONSUMER_SOURCE_DELIVERED / HISTORICAL_MATCH_ONLY / RUNTIME_NOT_READY**

Base/direct parent: `f64fa2dacf895fdea698e46ffc178aa0d8270f0e`.
Existing branch: `codex/program-docs-ce012-provider-02`.
Core input: `3e9593af25433dcf32042f624731f514d09ec35b`.

## Strict versioned consumer ABI

NEW module: `src/lib/customer/documents-ce012-closed-replay-adopter-v2.ts`.

- `DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2` =
  `documents-ce012-closed-replay-adopter.v2`.
- `documentsCe012ClosedReplayExpectationV2Schema`: strict root with exactly
  `contract`, `original`, `matcher`; strict imported schemas at every nested level.
- `original`: actual `coreCe012StoredRelationRequestV1Schema`, preserving original
  Core command, Guide command and expected Core/CE receipt IDs/hash contract.
- `matcher`: actual `coreCe012ClosedBindingExpectationV1Schema`, contract
  `core-ce012-closed-binding-matcher.v1`, with ALL full binding fields required.
- `readDocumentsCe012ClosedReplayV2(actualResult, exactResponseBytes, expectation)`:
  synchronous read-only consumer of the real `matchCoreCe012ClosedBindingV1`.
- Exported inferred input type: `DocumentsCe012ClosedReplayExpectationV2`.

No parallel Core schema/interface/matcher/authority callback is defined. The v1
module/contract/schema/function and its historical matcher-required behavior are
unchanged. Old v1 input does not silently upgrade to v2. Migration to v2 requires
explicit complete matcher expectation; no field defaults, guessed tenant/member,
UI membership inference, current GET or limited-metadata repair is provided.

### One relationship, not two independently valid expectations

Before calling Core, the exported Documents schema's refinement requires:

1. **Entire canonical parsed original Core command equals matcher.command**,
   not merely two independent valid commands or one supplied command hash.
2. Command/Guide command ID, Context, Workspace, Guide, next aggregate version,
   prior Guide source version, save subject/relation and fixed CE profile match.
3. Original Guide fingerprint is recomputed using the existing CE helper; full
   original command fingerprint/key and all Guide/document/version source IDs bind.
4. Full binding's original transaction/command/actor/Context/Workspace/revision,
   canonical key and recomputed parsed-command SHA256 agree with that command.
5. **original.expected.ce_save_receipt_id equals matcher.binding.ce_save_receipt_id**;
   expected Core receipt ID and exact receipt hash also agree across both inputs.
6. Full binding target exactly equals original Guide document ID, immutable version
   ID and numeric version; no current-version or label substitution.

Mutation ID, tenant, membership, execution attempt/backend/DBtx and every other
Core binding field must be present in the actual imported strict schema and match
the private record through the official matcher. These fields are comparison data
from separately trusted producers, not permission. Neither UI nor the getter's
limited metadata is used to invent missing values. Production expectation producer/
custody remains a separate unbound assembly/native gate.

Thus a correct matcher expectation that MATCHes in Core cannot hide a wrong
original CE receipt expectation: the consumer schema rejects the pair. If both CE
IDs are changed consistently, the consumer schema is coherent but the REAL Core
matcher returns NO_MATCH for the same actual result/bytes. Recomputing command/hash/
fingerprint/key coherently still describes another private record and fails Core.

### Bounded output and authority boundary

Frozen output has only:

```
contract: documents-ce012-closed-replay-adopter.v2
match: MATCH | NO_MATCH
code: HISTORICAL_CLOSED_BINDING_MATCH | NO_CLOSED_BINDING_MATCH | INVALID_EXPECTATION
status: not_ready
projection: null
current_authority: not_evaluated
runtime_binding: null
reusable_as_command_authority: false
```

MATCH requires the real Core matcher contract/MATCH/not_ready/null/not_evaluated
result. Invalid/missing/extra/incoherent input returns NO_MATCH. Nothing echoes
input identifiers, private labels, document content/path/Storage metadata, raw
receipt/hash, candidate or error. No query, write, await, host.execute, registration,
retry, key, receipt or settlement issuer exists in this module.

MATCH means historical equality to the actual closed host-created record ONLY.
It does not adopt an outside candidate, reopen the closed token, recheck current
managed session/authority/retention/scan/lifecycle, authorize publication/download,
create a new command, establish native custody, or prove ACK/delivery. The existing
Core matcher owns actual result identity/exact bytes/closed replay settlement and
private full binding comparison; the consumer does not reconstruct that engine.

## New consumer evidence only

`node scripts/test-documents-ce012-core14-matcher-adoption-v2.mjs`:
**10 NEW consumer groups PASS**. Real Core14 matcher/host/private records, unchanged
Docs factory/provider/selector and CE R1 run on controlled memory SQL-pool data.
No Core matcher/getter is replaced by an allow callback.

1. Same actual result/bytes + correct coherent Core/CE receipt gives MATCH, still
   NOT_READY/null/non-authorizing; matcher called directly is also MATCH.
2. Only CE receipt changed consistently in both expected inputs: real matcher
   NO_MATCH with SAME result/bytes.
3. Wrong original CE receipt with independently correct matcher expectation:
   direct matcher MATCH, consumer INVALID_EXPECTATION/NO_MATCH. Reverse mismatch too.
4. Two valid unrelated original/matcher commands cannot give consumer MATCH.
5. Independent command/key/hash/receipt/mutation/scope/tenant/member/target/version/
   attempt/backend/DBtx mismatch returns NO_MATCH at the consumer boundary.
6. Coherently recomputed changed command/key/hash/Guide fingerprint is still not
   the retained actual host record.
7. Required fields at each root/nested boundary, extra fields, NULL/unknown tenant/
   member, candidate/verifier/allow-like inputs fail strict consumer parsing.
8. Changed bytes, wrapper/reordering/truncation, copied/forged result and another
   real invocation's DBtx cannot produce MATCH.
9. Actual modeled lost replay ROLLBACK ACK/UNKNOWN cannot MATCH.
10. Focused genuinely affected v1 compatibility: the unchanged v1 consumer still
    returns its historical matcher-required gate for correct/changed CE expected;
    v1 input is not a v2 input. The old v1 suite is not executed.

Every adopter call measures unchanged modeled query/attempt/write counts and the
same original joint record identity. This is pure-consumer evidence, not durable
DB zero-write or native settlement proof. Modeled records are produced by actual
owner code; synthetic tenant/member come explicitly from the fixture producer,
never a production UI/metadata inference or fabricated real provenance.

Scoped strict ES5/bundler/noEmit typecheck uses repo ESNext/DOM libs and a read-only
virtual official-source overlay. A virtual compile-time ABI witness assigns
Documents v2 matcher input directly to the real Core expected type. No Core/CE
module/interface is copied into this branch. Scoped ESLint, MJS syntax and staged
diff checks are recorded with delivery. No full build/standalone integration run.

Core88 and accepted23+33 scripts/test bodies are **NOT_RERUN**. Only helper fixture
DEFINITIONS are reused to create real source-controlled host records for these new
consumer tests. Prior Docs/CE/native/old suites are not replayed for report status.
Node24.19.0/TS5.9.3/cached Zod4.4.3; exact-lock Zod4.6.6 NOT_RUN_NOT_PASS. No install.

## Preservation, pins and open gates

Four NEW Documents paths only: new v2 module, consumer test, this README, manifest.
All existing tracked bytes remain unchanged, including factory/provider/selector,
v1 adopter/source/schema/test/manifest, Core11 consumer behavior, compiler/blocked
slots, closure/request/kit, Core/CE/Platform/registry, SQL/migrations/package/lock and
WIP/history. No historical pin bump or dual-source bypass. Adjacent manifest pins
37 exact owner/FullSHA/path/bytes/SHA256/Git preimages; new source is externally bound
by this delivery commit/tree, not a self-hash claim.

The standalone Docs Base does not contain all Core14 modules/exports. Virtual type/
ABI success is **NOT bundle/runtime import/assembly evidence**. Exact official
owner composition, production expectation producer/provenance/custody and target
package/native validation remain separate. runtime=NULL and projection=null;
both historical compiler slots BLOCKED. D02/D03/D04/native/current authority and
complete Release acceptance are NOT closed by historical MATCH.

SQL/parser/PG/Auth/Storage/install/grant/activation/native locks/40001/driver/actual
settlement/durable-zero-write/assembly proof: **NOT_RUN_NOT_PASS**. No merge/deploy.

خودکارسازی: نیازمند بررسی؛ ورودی result/bytes و دو expected نسخه‌دارِ مرتبط؛
فرصت تطبیق تاریخی و ارجاع mismatch؛ تصمیم انسانی Core/Documents/CE/coordinator؛
شرط اجرا expectation/custody/assembly/proof واقعی؛ استثنا به مالک همان مرز؛
وابستگی Core14 و producer رسمی و native؛ ارزش سنجیده نشده؛ MATCH اختیار جاری نیست.
