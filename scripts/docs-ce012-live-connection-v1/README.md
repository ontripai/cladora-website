# DOCS-CE012-REF-01A / LIVE-CONNECTION-HARNESS-03

**Runnable harness candidate; live dispatch CLOSED.** This package adds no product, Core/CE, provider, selector, route, shared schema, migration, grant or activation change. Base/parent is `d10d8b9dddee3055a75304cc29f9b16cea68702f`; branch remains `codex/program-docs-ce012-provider-02`.

Assignment/review: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6572961395
Prior producer/source inventory: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6572785479
Five-item proof request: `docs/testing/CLADORA-DOCS-CE012-PROVIDER-CLOSEOUT-02-v1.0.md` at BASE, unchanged.

## Executable entrypoints

Offline inspection only:

```sh
node scripts/docs-ce012-live-connection-v1/run.mjs --inspect-request
node scripts/test-documents-ce012-live-admission-v1.mjs
```

`run.mjs` with no argument, unknown arguments or `--run` without complete separate coordinator admission exits 2 before importing pg, constructing a pool or contacting Auth. There is no `--exec`, custom module, SQL text, shell command, installer, always-allow authority or repair hook. The operational `--run` path is implemented but **must not be invoked until exact source/request admission and a separately authorized Platform invocation**. Offline ephemeral test signatures are not coordinator decisions.

The only proposed lifecycle slot is provision -> health -> accepted native-fixture installation/identity check -> this exact pinned consumer -> finally cleanup. Platform owns provisioning and resource custody; this code neither creates nor drops a DB/container/user/role/session. Health-only PG/Auth does not satisfy the native-fixture prerequisite. Platform's existing source/checkpoint is separate: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6572853368. Its reviewed inactive dispatcher/cleanup successor is now `10b840b023d62fd59ba265cd3fea6d325066fe70`; Documents-specific native setup, profile/effect envelope and code-pinned adapter are still OPEN. This producer request is not a directly admissible Platform request. No arbitrary callback is requested.

## Latest cross-owner reconciliation (read-only)

Consumed Platform successor report https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573380036 and Coordinator review46 https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573617800 before handoff. Platform cleanup finding is CLOSED_SCOPED_OFFLINE_CLI; do not report it as this package's open blocker. Its actual `scripts/local_runtime_consumer.py` at `10b840b023d62fd59ba265cd3fea6d325066fe70` was read: current request format is `cladora-local-consumer-v1`, typed only for Core/ACL-PROJECTION-02, and both review registry/code adapter map remain empty. Its current permitted effects/profile cannot authorize Documents/native/Auth-session probes.

Therefore `consumer-request.json` here is the exact immutable **producer payload for review**, not a replacement Platform registry, a registered consumer or a reusable execution grant. The secondary signed admission design in this harness remains proposed; it cannot replace the Platform registry/custody/admission-at-effect gate. The Platform owner must review/bind an explicitly typed Documents-native adapter/profile/envelope that seals this request and all executable dependencies, genuine local Auth session and the accepted installation inputs. No Core-specific effect/profile is silently relabelled and no Platform file or registry is changed. Until that owner delivery plus coordinator review, this connection is NOT_CONNECTED_TESTED and live invocation remains unauthorized.

Consumed CE47d1be3fc9ac8d8ca617e345f244c50a5d1fdc68 comparison/report https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573040373 and review45 https://github.com/ontripai/cladora-website/issues/463#issuecomment-6573312055 . CE already compared the exact Documents producer and preserved the same open joint mapping/label/receipt gates. CE's current attendance projection work is independent and is not interrupted or repeated.

## Exact source and request admission

`source-inventory.json` pins 322 unchanged inputs: 300 existing migration files in global filename order, plus 22 product/type/config files. This includes the producer, both Documents helpers/contract, unchanged actual CE bridge/evaluator and existing lifecycle request-pool binder, Core host, resolver/transaction authority/replay evidence modules, role-bound pool and their transitive TS dependencies, package and lock. The native evaluator's effective migration inputs (including the final building-setup migration) are byte pinned; not assumed installed. No hash bump or allowlist change is made.

`consumer-request.json` pins the inventory SHA-256, four executable harness modules, fixed entrypoint, nine named cases, 15 measured tables, audit sequence, allowed effects and limits. The entrypoint emits its exact request/inventory hashes. Source pins are verified again in the module loader; every relative product import must be in the inventory. The server-only build marker alone is ignored by the Node transpiler; no functional Core/Auth/CE module is mocked in live execution. Actual pg/TypeScript/Zod/Next/@supabase/ssr versions must match the exact lock before constructing pools; Node >=22 is required. No install or package/lock edit is provided.

The unsigned request carries `live_default=CLOSED`, never an acceptance flag. The private coordinator review envelope is a separate JSON object `{payload, signature}`. It is verified using Ed25519 over sorted-key canonical JSON of payload. Platform must obtain the trusted public-key fingerprint from its independently controlled coordinator admission registry/custody, not this request, an embedded key, a Worker signature or `approved:true`. This is a **proposed test-execution admission handshake**, not a new domain authority interface or service; Platform/Coordinator acceptance of the handshake is a dependency.

The signed payload binds:

- contract `documents-ce012-coordinator-admission.v1`;
- exact request, inventory and private synthetic fixture-plan SHA-256;
- expiry no more than one hour from invocation;
- target: nonce-owned `docs_ce012_<16 hex>` DB name, database OID, cluster system identifier, loopback Auth origin/exact issuer, fixed `/user` or `/auth/v1/user` endpoint, existing reviewed observer role, optional existing conflict-writer role, 32-hex custody nonce and exclusive synthetic-only ownership;
- installation: this inventory hash, complete expected schema_migrations version set and separately accepted installed-catalog SHA-256, synthetic fixture setup source SHA-256, Platform lifecycle source SHA-256 and profile SHA-256;
- independently obtained decisions for source/request admission, CE/Core save-host mapping, neutral safe-label projection, and this live dispatch. All must be signed true. This package supplies **none** of those decisions, keys, credentials or target artifacts.

The installed catalog hash is computed by the fixed `CATALOG_SQL` projection over schema owners/ACL, full function/overload definitions, owners/ACL/config, table/sequence owners and ACL/RLS, columns/defaults/column ACL, constraints/validation, triggers/enabled state, policies, roles/options, memberships/grantor/inherit/set/admin options and default ACL. It remains local/private. The accepted target-specific installation attestation must link that catalog preimage to the exact source inventory; a digest generated by the running target and self-signed by this consumer is not acceptable. Empty, substituted or always-allow native functions cannot be admitted by a health result or schema_migrations presence alone. **schema_migrations digests are not file-byte hashes.**

Before provider dispatch, the observer verifies physical target identity, PG17, read-only connection, required native evaluator/role-safety functions and domain tables, exact installed migration set/catalog and complete observer ACL coverage. The actual Core role-bound pool independently enforces its existing checkout/transaction lease identity and role-safety rules. A populated/incompatible installation or guard300 mismatch is BLOCKED, never repaired or bypassed here.

## Private fixture inputs and identities

Fixed environment selectors are read only by an admitted invocation; values are never printed:

| Selector | Purpose |
|---|---|
| `DOCS_CE012_REVIEW_ENVELOPE_FILE` | Coordinator-signed private admission JSON |
| `DOCS_CE012_COORDINATOR_PUBLIC_KEY_FILE` / `DOCS_CE012_COORDINATOR_KEY_SHA256` | Separately trusted Platform custody anchor |
| `DOCS_CE012_FIXTURE_PLAN_FILE` | Hashed synthetic-only case plan |
| `DOCS_CE012_RUNTIME_DATABASE_URL` | Direct local physical login as existing `cladora_ce_guide_runtime` |
| `DOCS_CE012_OBSERVER_DATABASE_URL` | Same target, separately admitted existing read-only observer |
| `DOCS_CE012_CONFLICT_DATABASE_URL` | Optional same-target existing fixture-only writer; never used as provider/authority identity |
| `DOCS_CE012_ISSUED_AAL2_ACCESS_TOKEN` | Genuine existing local Auth AAL2 token; no fabricated JWT/session |

No generic SUPABASE/production selector, service_role, postgres or supabase_admin fallback. Hosted targets, system DBs and URL query/options are rejected. The observer needs complete synthetic-tenant visibility and sequence read, Auth-session/catalog/system-identity reads and lock-observation ability. It cannot have table writes, sequence update/usage, SUPERUSER, CREATEROLE/CREATEDB or replication. Its RLS bypass/owner configuration, if needed for complete observation, is part of the separately reviewed preexisting identity; no such identity/ACL is created here. `row_security=off` deliberately errors rather than silently accepting filtered state hashes. Missing coverage stops dispatch.

The fixed Core pool switches to existing `cladora_ce_guide_executor`, retaining `cladora_ce_guide_runtime` as session_user and holding canonical role-safety leases. The existing CE request-pool binder sets transaction-local identity only after verification of the **same token** through local Auth `/user`, AAL2/expiry/issuer checks, and an actual current `auth.sessions` row. Verification repeats before each case. No user creation, password sign-in, MFA enrollment, email, key provisioning or Storage operation is implemented. Missing valid session blocks dispatch instead of synthesizing success.

The private fixture plan has exactly `contract=documents-ce012-synthetic-fixture-plan.v1`, `tenant_id`, and nine `cases`. Each case has only `name, command, guide_command, receipt_id, receipt_hash`. Core V2 and CE save commands are parsed by canonical schemas, exact binding/fingerprint/source lock set is verified and actor must equal the verified session. Missing commands stop only that case. No SQL or setup executable is accepted in the plan.

Fixture arrangement occurs **before** provider measurement, by an independently admitted native fixture/setup package. It must supply live source-compatible native functions and roles, real local Auth session, exact bound documents/immutable versions/clean attestations, existing draft Guide and denial states. Replaced-version and cross-Workspace/quarantine preconditions are checked against canonical rows rather than trusted plan labels. `documents_denied` / `historical_revoked` require the actual native Documents read evaluator to deny while the Guide host authority is allowed. No mutable arrangement callback runs between measurements.

### Historical receipt dependency

`historical_disclosure` and `historical_revoked` never call the producer through fresh validation. Only the existing Core host's `validateReplay` callback can invoke historical mode, after Core has read/matched the persisted idempotency response/receipt, command hash, current authority/entitlement and replay marker. The callback additionally binds the admitted receipt ID and Core's exact canonical receipt hash. There is no fresh document lookup substituted for a receipt, no receipt auto-upgrade and no JSON receipt seed accepted by this consumer.

The host provider code is the existing `documents-ce012-reference-provider.v1`; the stored receipt must carry its required replay marker and match the exact CE save/immutable-target fingerprint. BASE does not supply an accepted live CE save-host/receipt writer for this mapping. **CE012_SAVE_CORE_RECEIPT_BINDING remains OPEN**: Core/CE must deliver/admit the real committed receipt/setup path. Existing publish/unpublish receipts cannot be substituted. The harness does not create that writer or a parallel receipt store. Missing/mismatched/legacy receipt stops only the historical case. The actual CE bridge runs for historical disclosure, but no fresh CE evaluator receipt is used as evidence of historical acceptance.

## Five proof steps, implemented

1. **Admission / physical installation / identity:** exact files plus trusted review before any connection; physical/catalog/native/session/role-pool preconditions before domain dispatch.
2. **Provider -> CE:** actual producer/selectors, native Core resolver, bridge and unchanged pure CE save evaluator in the actual host read phase. Fresh positive returns an in-memory CE plan only. Fresh denial/stale/quarantine/cross-Workspace returns no plan/receipt. A dedicated sentinel stops the fresh host before its idempotency/audit/outbox/receipt mutation phase; the host's expected terminal TRANSACTION_FAILED is a read-probe fence, **not successful command acceptance**. `mutate` is forbidden.
3. **Zero-write:** independent observer backend must differ from provider PID. Consistent read-only snapshots cover all rows of the synthetic tenant in the exact 15 tables in the request, plus audit sequence last_value/is_called. Server-side SHA-256 prevents raw rows/paths/receipt/counter values from being emitted. Snapshots compare before/after the provider and after host settlement. All-user-table transaction tuple counters inside the provider scope must also remain equal, catching staged writes that a later rollback could hide. Sequence drift is watched separately because nextval is not transactional. Provider failure/serialization abort still requires a separate post-settlement durable comparison. This is not SELECT-text/rollback-only proof. Limits: coverage is the named tables/sequence plus transaction tuple counters, not arbitrary external effects; catalog is bound and network/Storage operations are absent.
4. **Actual shared lock:** after the provider has completed while Core's scope is live, another admitted fixture writer attempts the fixed permission-row `id=id` update. The observer must see `pg_blocking_pids` include the provider PID and the contender must receive real PostgreSQL `55P03`. This witnesses the canonical permission-row lock, not every document/version lock separately.
5. **Actual serialization and retry:** on attempt 1, a separate fixture writer commits a single byte-identical permission-row `id=id` update after the host snapshot and before the selector's shared lock. The actual pg client must report native `40001`; the existing host must retry with attempt 2 and a different DB transaction ID, then complete the read probe. A thrown fixture error is not accepted as native evidence. Actual conflict/retry availability remains NOT_RUN until executed.

### Conflict-writer boundary

The existing CE executor has `UPDATE(id)` grants for shared locks but `WITH CHECK(false)` on Documents update policies. It is **not** a fixture writer. Documents rows also have an updated_at trigger; a document self-update would not be byte-identical. Therefore the only concurrency effect in this request is a self-update of one existing `documents.document_permissions` row, under an independently reviewed existing fixture-only writer, outside provider measurement. Exactly one synthetic permission candidate is required; missing/ambiguous candidate blocks the two conflict cases. Writer must be the direct admitted identity with no SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/replication or service-role fallback. No writer role, grant or credential is created.

Before committing the deliberate conflict, row bytes must be unchanged and transaction counters must show exactly one UPDATE and no additional inserts/deletes/updates; otherwise rollback and fail. This is a physical MVCC fixture mutation, expressly outside the provider's zero-write window, never a permission/authority change. All bounded durable content must still match after the complete case. No trigger disabling, historical rebinding, scan promotion or data repair is provided. Missing conflict identity blocks only `shared_lock` / `serialization_retry`.

## Test/result matrix

| Case | Required live result | Current evidence |
|---|---|---|
| current_positive | current_authorized -> actual CE evaluator accepts an in-memory plan; read fence prevents persistence | NOT_RUN_NOT_PASS |
| documents_denied | actual native read denial -> no label/plan/receipt | NOT_RUN_NOT_PASS |
| replaced_fresh | exact replaced version -> stale, no label/plan | NOT_RUN_NOT_PASS |
| historical_disclosure | actual matched committed receipt -> historical_authorized, exact replay result | NOT_RUN_NOT_PASS |
| historical_revoked | same matched-receipt path, current Documents read revoked -> no label, Core replay conflict | NOT_RUN_NOT_PASS |
| cross_workspace | actual foreign bound target -> denied, no label/plan | NOT_RUN_NOT_PASS |
| quarantined | actual quarantined version -> denied, no label/plan | NOT_RUN_NOT_PASS |
| shared_lock | real blocking PID relation + native lock timeout, zero provider effects | NOT_RUN_NOT_PASS |
| serialization_retry | actual native40001, fresh second transaction, zero provider effects | NOT_RUN_NOT_PASS |

Executed here: 11 new offline admission/measurement-control groups, standalone CLI closed-gate behavior, request hash/pin inspection, JS syntax and scoped lint. Tests use ephemeral admission-test keys and fake catalog/counter objects solely to test rejection/control logic. They do not run the producer, Core host, native evaluator, real roles, Auth or PostgreSQL. Previous producer9 + refactor7 groups are **NOT_RERUN**. No build/typecheck needed for unchanged TS/product; no DB startup/install/query or live `--run` performed.

Structured live output includes bounded case/status codes only. A missing dependency yields BLOCKED; failed observed invariants yield non-PASS. An overall live-read-probe pass requires every case to pass, but is still not domain-install/command-write/runtime/release acceptance. Case timers fence/destroy checked-out runtime sockets and reject further retries; a timeout or lost connection is never cleanup proof. No new case starts past the total deadline. Platform must still execute and prove finally-cleanup for every owned resource; unknown cleanup cannot become a successful lifecycle.

## Remaining gates / ownership

- Coordinator: exact source/request admission, installed catalog-to-source provenance, trusted review key/custody and one separately authorized invocation. No acceptance or target is supplied here.
- CE/Core: joint save-host mapping and neutral-label review; real CE save receipt producer/admission. Preserve current CE work; this blocks only linked-reference live dispatch.
- Core/Platform: compatible native installation/guard300 and fixed role-bound identity, issued AAL2 session, complete read-only observer and optional admitted conflict writer. Health success is not these outputs. No managed-role/guard relaxation.
- Platform: register this fixed consumer only after review, run within owned provision/consumer/finally-cleanup lifecycle; no arbitrary hook, shared target, staging or Production install.
- Independent reviewer: real PostgreSQL/native authority, zero-write, lock and retry evidence. All remain NOT_RUN_NOT_PASS.

Skills policy: CLADORA-SKILLS-USAGE v1.1.0 (https://github.com/ontripai/cladora-website/issues/463#issuecomment-6316739482), current at package start. Applied existing session guides: cloud-environment-runtime, Supabase v0.1.2, Supabase Postgres Best Practices v1.1.1. No Docker/network/auth provisioning or schema tool is invoked. This package performs no new Supabase feature integration or migration. No paid resources, product/PM/private ledger changes, force/rebase/merge/deploy or runtime activation.
