# DOCS-CE012-CORE13-CLOSED-REPLAY-ADOPTION-09

**CLOSED_REGISTRATION_READER_DELIVERED / OFFICIAL_MATCHER_REQUIRED / NOT_READY**

Base/direct parent: `6f69db12455b9c750eae0c2a24c7a7c7faa16d3d`.
Branch: `codex/program-docs-ce012-provider-02`.
Core input: `1971770a7ee92c2020387c5222b0c7da03a552d8`.

## New pure Documents adopter

`src/lib/customer/documents-ce012-core13-closed-replay-adopter-v1.ts` exports
`readDocumentsCore13ClosedReplayV1(actualResult, exactResponseBytes, expectation)`.
It calls the real Core getters:

- `coreHostJointReplaySealV1(actualResult)`;
- `coreHostTerminalLifecycleV1(actualResult)`;
- `coreHostTerminalResponseMatchesV1(actualResult, exactBytes)`.

It also consumes the canonical Core stored-relation request/receipt/hash/subject
contracts and existing CE fingerprint helper directly. No getter, host, interface,
authority engine, candidate issuer, registry or matcher is duplicated or stubbed.
No query, host.execute/executeReplayOnly, write, await, retry, current session lookup,
key/receipt generation or runtime dispatch is performed by this adopter.

Expectation is a strict **comparison input**, not authority or custody. The exported
Zod schema contains the existing original Core stored-relation request and expected
attempt/backend PID/DB transaction. Extra candidate/allow/verifier/committed fields
are rejected. There is no argument for an external Docs token. A caller cannot turn
an older externally created candidate into the host-created one by supplying equal
fields, candidate_id, target, flags or serialized getter output.

## Checks implemented without inferring hidden data

| Boundary | Actual check | Meaning / limit |
| --- | --- | --- |
| Result identity | BOTH real identity-gated getters recognize the exact host-issued object | Copies/foreign JSON/lifecycle-shaped data cannot populate either WeakMap |
| Closed replay | actual result exact_replay; lifecycle replay_rolled_back + sealed_and_closed + no first error; joint closed_opaque_candidate/replay_rolled_back | A transaction outcome, not current permission or a fresh mutation |
| Lifecycle privacy | non-live/non-reusable/not-ready disclosure and joint not_evaluated/null projection | Closed metadata never becomes live Docs authority |
| Bytes/hash | private stable byte copy; real Core response matcher; exact core-host-result-json-utf8.v1; SHA256 matches lifecycle AND joint response hashes; seal hashes agree | Exact whole Core result only: not CE wrapper, later projection/HTTP/ACK |
| Candidate/seal hash | Digest/UUID format from the recognized getter; exact corresponding public hashes | Does NOT reconstruct candidate descriptor/token/private binding hash preimage |
| Execution | joint and lifecycle attempt/backend/DBtx agree with each other AND explicit expectation | Expected values are comparison data, not native provenance; another replay cannot substitute its tuple |
| Original input | canonical strict schemas; CE fingerprint recomputation; command/Guide Context/Workspace/Guide/version/subject/key/purpose/source-ID relation | No guessed version/UUID/source reference, no arbitrary provider authority |
| Receipt/hash | actual canonical V2 receipt/hash + exact expected Core receipt ID/hash, original transaction/command/actor/Workspace/Context/key/fingerprint/aggregate/version/revision/subject | Does not expose or match the private expected CE receipt ID or tenant |
| Target | recognized joint getter's exact document ID, immutable version ID and numeric version match original Guide target | The actual registered host target is read; no current-version substitution or private label fallback |

All outputs are bounded and frozen:

```
contract: documents-ce012-core13-closed-replay-adopter.v1
status: not_ready
projection: null
runtime_binding: null
current_authority: not_evaluated
reusable_as_command_authority: false
code: bounded enum
```

Failure codes: INVALID_EXPECTATION, UNRECOGNIZED_RESULT,
REPLAY_ROLLBACK_REQUIRED, RESPONSE_BYTES_MISMATCH, EXECUTION_MISMATCH,
INPUT_BINDING_MISMATCH, RECEIPT_MISMATCH, TARGET_MISMATCH.
After all exposed comparisons match, code remains
**OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED**. There is no accepted/ready/allow result
or outward label/receipt/target payload. This module is inactive, with no route,
installation, grant or production import wiring.

## Exact ABI limitation / minimum official matcher dependency

Core13 now **really registers** a candidate created inside the fixed host hook from
the actual official Docs factory. The recognized joint getter is evidence of that
closed host record. This supersedes the old Core11 lack of a joint record, but it
does not make the separate Docs08/Core11 adopter behave differently; that code is
byte-identical and intentionally unchanged.

Core13's private `jointResults` stores `{info, token, binding}`. Its only public
joint getter returns `info`. It does not expose token equality, the complete
`CoreCe012TerminalBindingV1`, expected CE-save receipt ID, tenant/membership,
parsed-command hash/canonical key or descriptor binding-hash preimage. Candidate
UUID/hash and equal target fields are not an official matcher for those hidden
fields. The new adopter does NOT infer them, look them up with a query, recompute
an imaginary preimage or consult an external candidate/allow callback.

A controlled counterexample changes only expected.ce_save_receipt_id to another
valid UUID. All EXPOSED checks still finish at the same NOT_READY matcher gate;
this is intentionally **unverified**, not an accepted CE receipt match. It is not
a failure to reject a falsely authorized result: this ABI offers no positive full
match/authority variant at all. Actual target/command/hash mismatches are rejected
at their available checks.

Minimal Core-owned follow-up (proposal, not imported/unpublished ABI): provide a
read-only, identity-gated **official closed-binding matcher** against the exact
recognized result's private record. It should compare the existing original
stored-relation request (including expected CE receipt ID), trusted expected full
scope/tenant/member/execution binding, command/key/hash, independent receipt/
mutation identities and target/version with the private registered binding. Return
only bounded match/mismatch/unavailable of CLOSED metadata, never token/body/label,
a registration issuer, current permission or a caller-Boolean verifier. It must
use the actual private record and actual host-created identity, not correlate an
outside Docs token by field equality. Core chooses/reviews the versioned ABI and
exact successor FullSHA; Documents does not guess a function/export here.

Even a future closed match cannot close D02/D03/D04/native/session/custody or full
Release security gates. No outward projection is authorized. Historical compiler
slots remain BLOCKED. Missing/expired/UNKNOWN host records do not cause adopter
queries, reservation, new command/key or retry. It never dispatches the host.

## New targeted evidence only

`node scripts/test-documents-ce012-core13-closed-replay-v1.mjs`:
**8 NEW adopter groups PASS**. Actual Core13 shared host/getters/replay-only path,
real unchanged Docs08 factory/selector and CE R1 execute on synthetic memory
transport. Reused only existing helper DEFINITIONS, not accepted23+33 checks or
other old suite bodies. New coupling setup produces modeled owner receipts;
none is represented as native committed provenance or a compiler input.

1. Real host result/registered replay/lifecycle/bytes/receipt/target/tuple reaches
   only matcher-required; adopter itself adds zero modeled queries/writes.
2. Copied result, serialized joint/lifecycle metadata and caller flags reject.
3. Whole response bytes: newline, receipt wrapper, reordered/truncated image reject.
4. Expected attempt/backend/DBtx or another actual replay mismatch reject.
5. Original command/receipt ID/hash/Context/target/version/source relation drift reject.
6. Hidden expected CE receipt ID cannot be verified; NOT_READY is preserved.
7. Older external candidate with equal target is not substituted for host token;
   candidate/candidate_id inputs reject, even though the real joint record exists.
8. Actual unknown replay ROLLBACK ACK yields lifecycle unknown with no joint record;
   actual new COMMIT also has no usable closed replay record. Both are negative
   fixtures, not adopter effects or permitted command fallback.

Scoped ES5/strict/bundler/noEmit typecheck uses repository ESNext/DOM libs and a
read-only virtual official Git-source overlay. Owner files written/copied:0. The
standalone Docs Base lacks the required Core13 modules/exports; full application
assembly/build is NOT_RUN. Scoped lint, syntax and staged diff checks are recorded
in delivery. Node24.19.0/TS5.9.3/cached Zod4.4.3; exact-lock Zod4.6.6 NOT_RUN_NOT_PASS.
No install/package/config change.

The adjacent manifest pins34 source preimages by owner, exact FullSHA/path/bytes/
SHA256/Git identity. New adopter is locally byte-pinned and externally bound by the
commit/tree; no self-hash/dual-source acceptance. All existing tracked bytes,
factory/provider/selector, old Core11 adopter/tests/manifests, compiler/slots,
closure/request/kit, Core/CE/Platform/registry, SQL/migrations/package/lock and WIP
are preserved. Accepted23+33 and prior successful tests are **NOT_RERUN**.

SQL/parser/PG/Auth/Storage/install/grant/activation/driver/RLS/ACL/custody/native
40001/durable-zero-write and actual settlement proof: **NOT_RUN_NOT_PASS**.
runtime=NULL, projection=null, historical slots BLOCKED; no merge/deploy.

خودکارسازی: نیازمند بررسی؛ ورودی result/bytes و انتظار نسخه‌دار؛ فرصت تطبیق
محدود ثبت بسته و ارجاع mismatch؛ تصمیم انسانی Core/Documents/CE/coordinator؛
شرط اجرا matcher رسمی و proof/custody/اختیار مستقل؛ استثنا به مالک همان مرز؛
وابستگی matcher و D02/D03/D04؛ ارزش سنجیده نشده؛ metadata بسته‌شده مجوز جاری نیست.
