# CE010-COMMUNITY-ANNOUNCEMENT-01

Direct parent: `c84f13ffeb97a8365385243c7712216d47a04c4e`. Independent branch: `codex/ce010-community-announcement-01`. Guide branch/checkpoint and NULL provider remain unchanged. This is a source candidate for review, not native acceptance.

## Executable slice

The EXISTING Community page/form and command session now consume an explicit native-read marker for announcement create/publish/cancel only. The actual existing `/api/customer/v1/community/base` route selects the new CE handler when its server-only resolver is configured. The handler prepares a Core V2 envelope, and the existing session freezes that execution wire before dispatch. No automatic POST/re-key/retry. Existing legacy reader and unrelated commands remain intact; a selected native failure never falls back. The original command schema, domain model, canonical wire fields and five-field response decoder are unchanged.

The CE provider runs inside `createCorePostgresTransactionHostV1`, with existing C01 canonical evaluation, versioned provider evidence and required current-state replay validation. It writes only canonical `community.announcements`; C03 owns idempotency reservation/expiry, receipt, audit/outbox and transaction settlement. It does NOT call the legacy mutating RPC inside the host, does not double-write an audit/receipt and does not run the in-memory domain model. The scoped SQL strings are inactive until real Core/Platform binding. No table/migration/ACL/helper/permission was installed or modified.

Create validates the existing parent Community/version and audience helper, writes draft/version1; publish/cancel consume existing lifecycle rules and CAS the current announcement version. Social audience membership is content eligibility only, never publish authority. Current C01 authorization is rechecked after source waits, at mutation and after effects; native provider evidence additionally requires independent current community read permission (publish permission alone cannot assert readability), without granting either permission from the other; read checks actor/SID/exp against the verified SSR session plus current permission before/after projection, and fresh SDK actor/SID before disclosure. C03 replay returns its historical result only after current authorization and current domain validation; GET cannot resolve UNKNOWN.

`community.announcement.command`, module/permission mapping and the private request capability in `dependencies.json` are CE consumer requirements for Core review, not accepted new Core ABI or activation. No approved mapping, role/principal, OID or authority is guessed. The mandatory resolver defaults NULL and explicit native calls return503. Guide/SERVICE pools and service_role are not borrowed.

## Changed source and checks

Four CE provider/protocol/runtime/HTTP modules, the small existing route/session/page connection, one new harness and this delivery documentation. Before/after inventory is in `manifest.json`; itself excluded. No shared Core/Auth/Docs/package/lock/Guide/public-page changes.

Targeted command:

```sh
node scripts/test-ce010-announcement-c03.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Toolchain actually used: Next16.4.1, Zod4.6.6, TypeScript5.9.3, Node24.19.0; existing cache reused, no install. Fourteen distinct NEW controlled groups passed on final source: actual route/C03 create→publish→cancel/read; lost reply same-key; coherent same-key payload tamper/stale/foreign actor-scope/denial; audience projection; expiry after source wait/host-only serialization attempts; absent/selected binding and preserved legacy; post-effect rollback/malformed contracts; late preparation/execute JSON; DB identity/read-wait revoke; FA/EN/RO actual mounted forms; mounted UNKNOWN across locale/Context/GET denial; exact40001 object propagation and unknown COMMIT same-wire replay. After strengthening the native provider readability gate, all14 new affected cases passed in the final run; earlier scoped failures/corrections remain historical and are not counted as extra groups. Old Guide/CE010/G1/G2 successful suites were not replayed.

The harness loads CURRENT product modules and the real C03 host, reusing only accepted historical generic SQL fixture/loader SETUP. SDK/physical SQL responses and Context projection are controlled test boundaries. No modeled receipt/authority store is imported into production. Rollback/atomicity/read audience checks demonstrate adapter behavior under that model, not native SQL/RLS correctness. Exact author/source fixture parent must be fetched with history, not a shallow single-file copy.

Full TypeScript ES5 noEmit, scoped lint, syntax and diff checks PASS. Initial test-loader require-name/unused-fixture constant failures and one ref-lint issue were corrected without assertion/rule weakening. No native browser/Auth/PG/parser/SQL/install/restart/notification execution. All real persistence/security/native outcomes remain NOT_RUN_NOT_PASS.

## Remaining integration and runtime

Read `dependencies.json` for the exact consumer symbols, input/output, Core currentness/pool/target/claims/mapping requirements, canonical objects/helpers, App Context entry, Platform fixture/limited observer and independent QA closure. Core supplies a genuine request-local CE010 capability; App attaches it to the existing resolver; Platform reviews/installs the narrow exact canonical object set and executes the first ready synthetic flow. The original SQL proposal is only a schema/behavior reference and is NOT automatically a deployable recipe.

There is no persistence/reload recovery journal in this slice. UNKNOWN retains the exact command while the page/session holder exists; current reads or permission restoration alone do not settle it. No adoption of legacy receipt rows or parallel receipt engine. Guide still awaits its separately delivered Platform adapter; it is not a dependency of Community announcements. Event, attachments, payments and external messages are outside scope.

Skills: managed runtime/network, current AGENTS and installed Next route/client guide, Supabase security, Postgres best practices1.1.1 and React review. Policy CLADORA-SKILLS-USAGEv1.1.0. Query review: parameterized full tenant/Workspace/Community predicates on existing indexed keys; bounded existing read; no new grants/default ACLs/owner/role selection, and query waits followed by current authority checks.

Automation: نیازمند بررسی؛ mechanical scope/version/wire checks are candidates; publish/cancel/retry remain explicit authorized human actions, with Platform native execution and independent QA. UNKNOWN or missing currentness/producer returns to its owning boundary, with no invented savings or new execution authority.
