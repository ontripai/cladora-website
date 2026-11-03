# DOCS-CE012-REF-01A / FIXTURE-PLAN-COMPILER-05

Dependency: **DOCS-CE012-CASE-PLAN-01**. Consumer: **PLATFORM-DOCS-CE012-PGAUTH-BIND-05**.
Base/direct parent: `c0caf3e70d97c3d09b16cbff91188367804cba6b`.
Branch: `codex/program-docs-ce012-provider-02`.

Source-only pure compiler/validator candidate. The accepted live-scope source/control correction is consumed unchanged. No native catalog/ACL/session/receipt proof, installation or execution permission is supplied. The existing provider, closure, request, Core/CE product modules, registry and acceptance kits are not edited or replayed.

## Ownership and input ABI

`contract.json` is the machine-readable input/output/error/hash/case specification. `compiler.ts` is the mandatory executable validator; JSON Schema structure alone is insufficient. Its three canonical schema URNs resolve to the pinned existing exports, not to copied Core/CE definitions:

- `coreTransactionCommandV2Schema` (Core host);
- `ce012GuideSaveCommandV1Schema` and `fingerprintCe012GuideSavePayload` (CE);
- `currentAuthorityTransactionRequestV1Schema` (Core transaction authority request).

The existing source mapping is preserved: Guide Context/Workspace/ID, source expected version and next aggregate version, subject/relation, server-owned actor reference, command ID, key/fingerprint, exact immutable target and provider-source lock IDs must match. Document source_version remains target.document_version; Guide source version remains expected_guide_version. Parsing cannot silently normalize/trim IDs or command fields: noncanonical representations are rejected instead of producing changed commands.

**Platform-owned input** `documents-ce012-platform-provenance-input.v1` contains only run/custody, same native Documents PG/Auth consumer identity, DB identity/provenance references, Auth actor/session/AAL2 provenance references, explicit observation time and exact accepted harness source/request/closure seals. No token, credential, URL secret, committed/verified flag or Core pure-PG consumer can be substituted. The compiler checks references and equality, not genuine Auth or physical custody: Platform remains the owner of their actual verification. No keys or credentials are provisioned/read.

**Documents-owned input** `documents-ce012-documents-case-input.v1` binds the exact canonical Platform input SHA-256 and identical custody. It supplies tenant and up to the same nine named source entries, with original commands, Guide/document/immutable version/permission/scan rows, Context membership reference and Core native-fixture source reference. The canonical Documents read authority request is a request, not an authority decision or new evaluator. Its Context/Workspace/actor/revision/transaction/Guide-lock binding is checked. The native authority arrangement itself remains with Core and dispatch rechecks actual current authority.

No current DB read, installation or resolution happens here. The compiler neither discovers nor infers tenant, Workspace, actor, UUID, version or receipt. All identities and versions must be explicit in owner inputs. Historical NULL Workspace stays blocked; no inference/backfill/rebind exists. Permission projections use the existing tenant/document/membership columns; no permission Workspace column is invented.

`case_semantics` in the machine ABI and immutable `CASE_SEMANTICS` export define the exact existing nine cases. Platform does not invent Documents meaning: expected current/historical decision, same-tenant cross-Workspace relation, replaced/current immutable version relation, native Documents read expectation, scan/checksum/attestation state and conflict permission cardinality are explicit. Scan timestamps are compared only with the explicit Platform observation time, never the wall clock. These are fixture-consistency checks, not runtime authority or scan attestation acceptance.

## Pure API and private plan

`loadPinnedPlanCompiler()` loads only the fixed manifest-sealed compiler and canonical module/config preimages. No caller module path/callback or general-purpose command hook exists. Source loading reads code files only; the compiler function itself performs no filesystem, network, SQL, secret, clock or random operation. Imported canonical host/evaluator schemas do not execute the host/evaluator, create receipts or connect to a database.

API:

- `compileCasePlan(platformValue, documentsValue)` returns a private compilation result;
- `compileCasePlanJson(platformUtf8Text, documentsUtf8Text)` additionally preserves raw input byte hashes and rejects duplicate keys;
- `validateCompiledPlan(platformValue, documentsValue, planValue, expectedPlanSha256, expectedInputSourceBindingSha256)` regenerates and checks the exact plan from the same owned inputs;
- `validateCompiledPlanJson(platformText, documentsText, planText, expectedPlanSha256, expectedInputSourceBindingSha256, expectedRawInputBindingSha256)` additionally checks original UTF-8 bytes, including plan serialization;
- `contentHash` / `canonicalJson` define the stable data hash; `canonicalGuidePayloadFingerprint` directly reexports CE's existing hash helper.

Output `plan` is **exactly** existing `documents-ce012-synthetic-fixture-plan.v1`: tenant and nine rows containing only name, command, guide_command, receipt_id, receipt_hash. Canonical fresh commands are copied from explicit inputs after validation; no command/ID/version generator exists. A blocked row has all four data fields null. Missing case input preserves the named slot and blocks only that slot. Unknown/duplicate case names, malformed Platform/Documents envelope, custody or Platform hash mismatch invalidate the envelope and produce no plan.

Compilation also returns case outcomes, bounded error/producer/required-output descriptors, both owner input hashes, exact plan bytes/hash and source/input binding hash. `COMPILED_SHAPE` means only input consistency. `PARTIAL`/`BLOCKED` does not mean approved, installed, authenticated, authorized or ready. Every result has reusable_as_live_authority=false and runtime_proof=NOT_RUN_NOT_PASS. No extra metadata is inserted into the existing plan schema.

### Hashes / provenance

`source-manifest.json` pins this compiler/loader/CLI/ABI and the22 existing product/type/config inputs from the accepted offline inventory. The accepted harness source/request/closure are fixed at c0caf3e /3ca7a18b… /55093d83… respectively. This source manifest is not self-approval, runtime admission or a replacement Platform registry.

Canonical JSON recursively sorts object keys by ascending UTF-16 code unit, preserves array order and uses JSON.stringify UTF-8 without a trailing newline. Values must be plain finite JSON, at most1MiB/depth64. Accessors, proxies, cycles, unsupported values and malformed/duplicate-key JSON fail before validation. No secret-bearing getter/callback is executed.

- `platform_input_sha256` / `documents_input_sha256`: canonical owner input values; Documents must include the exact Platform semantic hash.
- `plan_sha256`: exact canonical plan_bytes UTF-8 hash, matching the existing harness raw-plan-byte boundary.
- `input_source_binding_sha256`: hash of compiler contract, accepted harness source/request/closure, both canonical input hashes and plan hash. It distinguishes even a coherently changed custody/source pair that happens to produce the same command bytes.
- JSON API raw input hashes: exact input UTF-8 text. Formatting changes keep semantic plan bytes but change the raw hashes. `raw_input_binding_sha256` binds those raw hashes to input_source_binding_sha256.

Validators require the original seals; recomputing only a changed plan hash cannot bypass source/input binding. Platform must retain/seal the private compilation metadata through its own reviewed adapter/custody boundary; a plan file alone loses provenance and is not sufficient. No reporting ledger or new store is created here.

## Historical boundary — deliberately incomplete rather than fabricated

Base has structural CE/Core receipt schemas and a Core receipt hash helper, but no accepted **pure verifier of the persisted CE-save/Core receipt relationship**. The existing live Core `validateReplay` path verifies persisted receipt/current authority inside an actual transaction; it cannot be replaced by a pure compiler's JSON check.

`historical_reference` is explicitly untrusted reference metadata only: existing Core store/contract, CE-save contract, receipt identifiers/hash and exact original command/target binding. No receipt body or committed flag is accepted. Reference ID/hash/binding mismatches block the historical case. Even internally matching references still yield **CANONICAL_PERSISTED_RELATION_VERIFIER_UNAVAILABLE** at this Base. Missing reference yields CANONICAL_STORED_RELATION_MISSING. The exact producer/output is returned:

- Producer: **Core/CE**;
- dependency: **DOCS-CE012-CASE-PLAN-01/CE_SAVE_CORE_STORED_RELATION**;
- required output: canonical verifier of the actual persisted CE-save/Core receipt relation, bound to original command, immutable target and custody.

No callable verifier option, always-allow stub or caller-selected module can turn that gap into historical success. Receipt-shaped JSON, `committed:true`, a current GET and a receipt hash alone are not proof. The ABI advertises historical_completion_available=false. A future accepted canonical output requires separately reviewed consumption; this task does not invent it. Thus the controlled complete source fixture produces **7 COMPILED_SHAPE +2 BLOCKED historical slots**; zero historical-positive/runtime proof is claimed. Independent fresh cases continue.

## Explicit CLI output (local preparation only)

```sh
node scripts/docs-ce012-case-plan-v1/compile-private-plan.mjs \
  --platform-input <owner-selected-platform.json> \
  --documents-input <owner-selected-documents.json> \
  --private-plan-output <explicit-new-private-plan.json>
```

The CLI reads only those two explicitly selected regular input files and fixed source-code pins, with no symlink/default/env/credential discovery or stdin. Bounds and strict UTF-8/JSON apply; BOM/duplicate keys are not silently normalized. It writes only the explicitly named **new0600 private plan** with exclusive-create; it does not overwrite. stdout is empty. stderr has only bounded status/counts/error codes, no path, IDs, hashes, row data or secret/error stack. No diagnostics/sidecar is silently written. Consumers needing private compilation hashes/diagnostics use the pure API and their approved private custody handling.

Exit2 = invalid input/source/output or existing output; no new plan written. Exit3 = private partial/blocked non-authorizing plan written, not all-cases or live readiness. Current ABI intentionally has no successful all-nine-ready exit because historical verification is unavailable. This CLI is not an installer/seed/role/receipt generator or dispatch entrypoint. Generated plans/owner inputs are private; do not publish them in GitHub comments/blobs.

## Checks and limitations

Run only the new affected controlled compiler tests:

```sh
node scripts/test-documents-ce012-case-plan-compiler-v1.mjs
```

12 new groups PASS_CONTROLLED_COMPILER_ONLY: exact nine-slot shape/commands; Workspace/tenant/document/version/source-version/actor mismatch; custody/run/DB/source/input hash mismatch; permission/scan/lifecycle/case belonging; historical reference mismatch and missing verifier; forged receipt/committed/GET/verifier rejection; missing/duplicate cases; semantic/raw/source seal preservation; strict JSON/privacy; purity/frozen inputs; actual source/ABI pins; actual CLI private-output/no-overwrite/invalid/BOM behavior. All rows/identities/provenance references are synthetic controlled inputs. No seed SQL, issued session or committed receipt is represented by them.

Scoped TypeScript compiler check, scoped ESLint, MJS syntax and diff check passed. Initial new-file import-depth error was corrected locally before final checks; no product module was changed. Actual local toolchain: Node24.19.0 /TypeScript5.9.3 /Zod4.4.3. Exact-lock Zod4.6.6 and native execution are not claimed; no dependency install or lock change. Platform must bind its actual reviewed toolchain during consumer adoption.

Prior8+5scope controls, full baseline11, producer9+7 and old kit were **NOT_RERUN**. All accepted provider/harness/closure/request/source-inventory/Core/CE bytes remain unchanged. No Platform code/profile/registry change, workflow/package/migration edit, live/SQL/Auth/Storage/startup/install/grant/activation, staging/Production action or actual business effect occurred.

Next: independent compiler/ABI/source review and Platform's bounded Documents-native adapter adoption. Actual native catalog/ACL, session, receipt relation, zero-write/lock/retry and runtime review remain separate gates. Pure-PG Core lane grants no authority for this payload. No existing Core/CE work is interrupted.

Skills: CLADORA-SKILLS-USAGE v1.1.0, https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482 . Same-session cloud-environment-runtime and Supabase security guidance applied; no new Supabase API/schema feature or DB query. No required skill missing; native evidence not run. Source delivery is not acceptance or release permission.
