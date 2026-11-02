# DOCS-CE012-REF-01A / PROVIDER-CLOSEOUT-02

Status: source candidate; producer-to-CE connection PASS_CONTROLLED. Independent acceptance, real PostgreSQL/Auth/roles, hosted integration and activation remain OPEN / NOT_RUN_NOT_PASS. This document does not close the earlier nine-scenario/four-compatibility acceptance kit.

Base: `1afe40aedbfc44855ccea676fb92fd4e6ec61e83`.
Branch: `codex/program-docs-ce012-provider-02`.
Assignment: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6570801523

## Existing identity and bounded delta

The existing `docs-ce012-reference-request.v1` and `docs-ce012-reference-decision.v1`, CE provider bridge/command evaluator, canonical Core authority provider and transaction scope are consumed directly. Their bytes are preserved. The baseline contains contracts and the current-state selector; this delivery fills the missing request-to-selector producer implementation. No earlier acceptance of this new producer is inferred from those inputs.

`documents-ce012-reference-provider.v1` implements the existing bridge's `documentsImmutableSelector.select` shape. It is an inactive server capability, not an HTTP endpoint or a replacement authority interface. Construct it inside Core's read-phase `validateProviders` or matched-receipt `validateReplay`, after the Guide aggregate lock and current Core authority recheck. Discard it before the transaction ends. No pool, transaction host, replay hook, store, schema, ledger, write, Storage access or grant is added.

### Exact binding / source_version

The factory takes the actual Core V2 host command, canonical post-lock authority receipt and existing parsed CE save command, copying their schemas into its private closure. It binds command ID, Context, Workspace, Guide, permission/module/purpose, recomputed CE payload fingerprint, host input fingerprint and idempotency key. `source_version` for the document reference is the existing wire `target.document_version`, bound exactly to the immutable UUID and the CE command target. Separately, the Guide source version is CE `expected_guide_version`: it must equal Core `subject_reference.version`, and Core `aggregate_version` must be that version plus one. No independently supplied wire alias or shared schema revision is introduced. The Core subject is `experience.guide` / `save_draft` / request version 1; the aggregate is `experience_guide`. The proposed host command mapping is source-bound here; its adoption by a future CE save runtime still requires joint consumer/Core review.

The exact document ID, immutable version UUID and numeric document version are taken from the same CE command target. Both IDs must also be in Core's provider source lock set. Requests cannot substitute another Context, Workspace, Guide, target or mode. Actor is absent from the strict request: it is read through `auth.uid()` in the server-authenticated Core SQL scope, then compared against the host scope, command and authority receipt. Client-created claims are not authenticated server-session evidence.

The canonical selector checks transaction ID, database transaction identity, serializable isolation, attempt, lock, actor, authority revision, current membership/Context and entitlement binding. It resolves `documents.vault.read` / `documents` / `documents.reference.read` directly through Core, then applies the canonical Vault visibility and version gates. The authority revision shared lock precedes document reads; document/version/permission shared locks and visibility checks remain unchanged.

### Current versus historical

Existing exported current selector functions retain their current-version-only behavior for every existing caller, including CE lifecycle. Both now delegate to the same private query/authority logic. The new historical entrypoint shares that logic and changes only version comparison: the exact version must exist and not be newer than document.current_version; it need not still be current. All current authority, AAL2, tenant/Workspace, NULL binding, lifecycle, visibility, clean scan/checksum and exact ClamAV attestation gates still apply.

`new_command` produces only `current_authorized` after current-state success. Server-bound `replay` produces only `historical_authorized` after historical disclosure success. Replay mode is supplied by a trusted server invocation, and must never be forwarded from an HTTP request. Core/CE remain responsible for matching committed command/receipt identity before constructing a replay provider; this read port neither finds nor synthesizes a receipt and does not claim durable exact-replay proof. Historical acceptance is disclosure authority only, never authority for a fresh command. No receipt or document history is rewritten.

### Disclosure and failures

Authorized decisions release only the Documents-owned neutral `safe_label="Document reference"`. The producer does not fetch document titles or use caller labels, object paths, signed URLs, hashes, permission rows or Storage metadata as output. Existing v1 binding/status fields remain. Denials use `safe_label=null, redaction=none`, with no SQL details. Stale version maps to `stale`; unavailable provider maps to `not_ready`; other selector denials map to `denied`. The existing selector conservatively classifies some canonical Core exceptions (including cross-tenant mismatch) as provider unavailable; these remain non-disclosing `not_ready`, with no fallback. Malformed wire requests fail strict parsing before querying. Serialization `40001` is rethrown for Core's existing bounded retry, not retried or converted to an allow by this provider.

The neutral label is a deliberate bounded projection policy in this candidate. The old acceptance kit's fixed example label is not claimed to have passed against this implementation. Consumer review must approve the projection policy; no nine-scenario kit assertion or fixture was changed to hide a mismatch.

## Producer / consumer connection

| Dependency | Producer / consumer | Version / minimum output | Evidence / open gate |
| --- | --- | --- | --- |
| DOCS-CE012-REF-01A | Documents -> CE012 bridge / save evaluator | Existing request/decision v1; exact immutable target and safe label or non-disclosing denial | Actual new producer -> actual unchanged CE bridge -> actual unchanged pure evaluator, positive and current-Documents-denial PASS_CONTROLLED |
| Core C01 / AUTH-TX | Core -> Documents selector | Existing current-authority transaction receipt + live CoreTransactionScopeV1 after Guide lock | Actual Core resolver code runs against controlled SQL rows; issued Auth, actual role/ACL, row locks and native evaluator execution NOT_RUN_NOT_PASS |
| CE source binding | CE -> Documents factory | Parsed existing save command, source version, exact target, matched server mode | No CE product changes. Joint review of save-command-to-host mapping and label projection OPEN |
| Core replay hook / CE committed result | Core/CE -> Documents historical disclosure | Existing matched-receipt read-phase invocation | No new replay hook; no durable receipt readback/retry tested. Real integration OPEN |
| Local runtime lane | Platform -> Documents/CE | Owned disposable PostgreSQL/Auth identity, installed exact source, verified executor/cleanup | No environment provisioning or DB connection made in this delivery; target binding remains OPEN |

The two CE connections exercise real production module code with a controlled `scope.query`, and fixture Core upstream bridge ports. Positive evaluation creates only the existing pure CE mutation-plan/receipt objects in memory; the Documents read port writes neither. Denial creates no CE plan or receipt. No CE command, Core evaluator or shared layout file is edited. This is an adapter-level connection, not `CONNECTED_TESTED` against a real DB or authorization to open Guide commands.

## Executed verification

- `node scripts/test-documents-ce012-reference-provider-v1.mjs`: nine NEW producer-specific groups PASS_CONTROLLED. These are not a rerun of the old nine acceptance-kit scenarios. Includes two real-module CE connections, source/mode/target mismatch, historical-vs-current separation, server-session actor/revision/Context/tenant/AAL2 denials, NULL/missing row, quarantine/pending/deleted/visibility/attestation denials, unavailability redaction, 40001 propagation, post-lock receipt/source-lock/scope mismatch and private-copy protection.
- Scope fixture asserts every executed SQL statement starts with SELECT; exact tenant/Workspace/target predicates and shared-lock query presence are asserted. This proves the controlled read boundary; it is not PostgreSQL zero-durable-write or lock/concurrency proof.
- `node scripts/test-documents-reference-authority-v1.mjs`: 7/7 PASS; rerun is justified only by the shared-helper refactor. Existing current selector remains stale for replaced versions. Old nine-scenario/four-compatibility kit, unrelated suites/build and PostgreSQL suites were not run.
- `node --check scripts/test-documents-ce012-reference-provider-v1.mjs`: PASS.
- Scoped ESLint on the three touched TS files and new harness: PASS.
- `tsc --noEmit --incremental false`: PASS against this worktree using existing local node_modules; no install or build.
- `git diff --check`: PASS before commit. Final targeted rerun follows the added canonical CE fingerprint recomputation; no old acceptance-kit run is substituted.
- Initial new harness run surfaced the canonical selector's cross-tenant exception classification; the expectation was corrected to non-disclosing `not_ready`, preserving canonical product behavior. Only affected new tests were rerun after that correction and new binding assertions.

## Remaining real-target proof request (not executed)

Use Platform's approved disposable runtime lane and the existing Core host, real canonical permission function and role-bound pool; never administrative/service-role fallback or an always-allow authority stub. Bind exact installed source inventory, server-session identity/AAL2, native evaluator and actual executor role. Existing role-bound pool migration contains Documents read/lock policies, but their installed state and applicability to the proposed CE save entrypoint are not established by this source delivery. No grants are proposed or silently supplied.

1. Run this producer's positive and revoked-access connection under real Core validateProviders read phase after actual Guide/provider locks; assert the exact immutable target and output projection.
2. Repeat replaced-version fresh denial and server matched-receipt historical disclosure, including revoked authority, NULL/cross-Workspace, quarantined/deleted state. Verify no historical substitution and no new receipt/evidence rows from this provider.
3. Observe zero durable writes from a separate connection across Documents, Guide and shared audit/outbox/idempotency/receipt tables. Fixture setup is outside the measurement window. SELECT text assertions are not sufficient.
4. Exercise actual serialization conflict and fresh-transaction retry with the same provider input; the controlled 40001 throw proves propagation only. Never retry an unknown commit blindly.
5. Verify actual RLS/ACL, auth/session provenance, lock blocking/revocation boundaries and cleanup using the exact accepted target/principal. Any unavailable evaluator/schema/grant is a bounded not-ready result, not a reason to broaden privileges.

All five items: NOT_RUN_NOT_PASS. No Docker/DB/Auth/Storage startup, connection, SQL installation or runtime activation occurred. Independent source admission, joint CE review, real target evidence and separately authorized runtime wiring/release are remaining gates, not implied by Push/CI.

## Byte inventory

Changed implementation/test bytes (delivery HEAD/parent/tree are recorded in the #463 report):

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lib/customer/documents-ce012-reference-provider-v1.ts` | 6458 | `14c37f949f120fb071e0834773e3c7939022511673506bd1d2260ba881e6d0d3` |
| `src/lib/customer/documents-reference-authority-v1.ts` | 14569 | `444c9b2c7b11be04ef6867887ebc77f7a0308414daee33ab41ecbf6eb9870b81` |
| `src/lib/customer/documents-reference-tx-selector-v1.ts` | 10550 | `dd0834afe07bb61f7d00e43ace31e73faa9b9e6754a5f4e6a281bb0104ebfcca` |
| `scripts/test-documents-ce012-reference-provider-v1.mjs` | 16343 | `2f31187b35d2436db0916ee7bbb3115861e03f936823968398d4fd2e7f18fc08` |

Existing inputs, unchanged from exact BASE:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lib/customer/documents-ce012-reference-contract.ts` | 1998 | `1c6cae9052fb8bb1910f88af4ef264dbd973c52fe81e5394e1527db4aa2d4b93` |
| `src/lib/community/experience-guide-provider-bridge.ts` | 9983 | `ddeda87fc4d19fb9516198fbcb1290240b1d3e152a5e85a936d513a7994b52ca` |
| `src/lib/community/experience-guide-command-contract.ts` | 14414 | `324d30b10eecb1b1f03f706118b51b7dc80605892f1ec267e9d4dc44a5f8e2e6` |
| `scripts/ce012-provider-acceptance-kit.mjs` | 9846 | `e80b054dfb35aa1f54bd270010aa7fb5315c864ec860666606a5532158dffd30` |
| `src/lib/core/current-authority-postgres-provider-v1.ts` | 7831 | `0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a` |
| `src/lib/core/current-authority-transaction-port-v1.ts` | 9496 | `02e0b85d1dba7ca87ec0eddff5d3f3552bed518794888e9ee0f34c0de962c14f` |
| `src/lib/core/postgres-transaction-host-v1.ts` | 39738 | `5ae0d49cde0850c3d8b2c55bc2398d685e1c833d2e9a9e176ee8eab8d1cdce06` |

Migration inventory remains unchanged; no new schema or migration. Historical frozen audits/pins, writer/routes, earlier candidate artifacts, worktrees and branches are preserved.

## Skills / action limits

CLADORA-SKILLS-USAGE v1.1.0: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482
Applied: cloud-environment-runtime (network policy, current environment observations), supabase v0.1.2 (security boundaries), supabase-postgres-best-practices v1.1.1 (short transaction/lock guidance). Supabase changelog HTTP fetch was denied by the existing proxy (CONNECT 403); no bypass or alternate credential. This task adds no Supabase API/schema feature and directly consumes repository canonical providers. Actual PostgreSQL/Auth/Storage verification remains unavailable/not run here. No Next.js/UI/API change requiring a new framework convention.

Only scoped source commit and ordinary Push on the assigned branch plus one safe #463 report are authorized. No force/rebase/merge/manual deployment, new PR, main/release change, staging/Production install, activation or private artifact publication.
