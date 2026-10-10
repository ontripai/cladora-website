# CE010-OPS-01 — Community operational proposal

Owner: Community & Experience. Baseline: CLADORA v1.4, `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`.
Branch: `feat/ce-011-event-interest`. Draft PR: #318.
Status: technically complete and in_review; PostgreSQL/pgTAP and concurrency verification passed in disposable CI. No acceptance or release is claimed.

## Scope and ownership

The six existing CE010 commands persist Community content policy, in-app announcement drafts/publication/cancellation, and content reports with one versioned, reasoned moderation decision. Community is independently activated by Core; CE creates no activation command or community membership registry. Announcement content does not implement delivery, channels or external messaging. Booking and SERVICE are not prerequisites.

The package adds a review-only SQL proposal, a bounded server HTTP route and isolated tests. It does not create a migration file, install a remote migration, mount a customer page or alter central control documents. The Core adapters, platform idempotency store, shared audit and outbox are reused. Domain response receipts only project the committed result; key collision, fingerprint and expiry remain in `platform.idempotency_keys`.

## Explicit contract gate: CORE-CE010-MAP-01

The current domain permission names are proposed, not accepted Core registry entries. This proposal deliberately inserts no identity permission, module binding, role, entitlement or activation records. The following versioned mapping requires Core confirmation before operational installation:

| Command | Proposed exact permission | Expected version refers to |
| --- | --- | --- |
| Read | `community.community.read` | No mutation |
| Create Community | `community.community.manage` | Zero for a new Community |
| Create announcement | `community.announcement.publish` | Parent Community |
| Publish/cancel announcement | `community.announcement.publish` | Announcement |
| Report content | `community.report.create` | Zero for a new report |
| Decide report | `community.report.decide` | Existing report |

Proposed module: `community_basic`, version 1, entitlement `module.community_basic`. These names are not proof of registry acceptance. The RPC checks a live module/binding before calling `check_workspace_native_permission_v2`; absence raises SQLSTATE `55000`. The HTTP route translates missing registry or RPC into `503 CE_COMMUNITY_CONNECTION_NOT_READY`, without falling back to Event, Guide, Communications or another permission.

Real C01 derives actor, tenant, membership and Workspace from the authenticated session and the selected native Context. A read requires its own permission; mutation authority is never inferred from read access or a capability snapshot. There are no service-role API clients or client-supplied actor/tenant fields.

## Persistence and security

- Composite parent keys prevent crossing tenant, Workspace or Community boundaries.
- All four CE tables use RLS; direct privileges for `anon`, `authenticated` and `service_role` are revoked. Authenticated clients can use only the bounded customer API functions.
- All privileged functions pin `search_path=pg_catalog`, qualify relations and derive session authority. Private helpers have no client execution grant.
- SQL and HTTP reject missing, null, fractional, negative and unsafe versions; SQL also validates exact command keys so direct RPC calls cannot bypass HTTP validation.
- Each command locks the shared idempotency row before the Community aggregate. Duplicate active reports use a partial unique index. Concurrent decisions require the exact report version and can resolve a report only once.
- Exact replay rechecks live C01/C02 authority after acquiring the key lock. Reporting replay also rechecks both Community and target announcement audience, plus target publication. Operators may manage content outside its member audience only with the exact current publication/moderation permission, as in the existing domain contract.
- Member reads hide drafts, cancelled or excluded announcements. Report details are returned only to an authorized moderator. Each list is explicitly capped at 100 rows.
- Audience roles use the canonical base role or a live, Workspace-wide, lineage-valid local assignment. Narrower property/building/unit roles do not widen this Workspace content audience.
- Mutation, response receipt, audit, outbox and shared key result are one transaction. Rejected commands roll back all of them. Moderation audit includes decision, version and reason; outbox contains bounded entity/version metadata, not announcement body or private report text.

## Verification and evidence

Actually executed locally on the changed code:

- `node scripts/test-ce-010-route.mjs`: 55 checks passed, compiled HTTP handlers with a mocked RPC boundary. This is not live database evidence.
- `node --experimental-strip-types scripts/test-ce-010-community-base.mjs`: existing domain regression passed after the UUID/version schema correction.
- `npm run typecheck`: passed.
- Targeted ESLint: passed.
- `node scripts/check-database-package.mjs`: 237 migrations, 164 tests, 5220 assertions. Migration count is unchanged.
- `git diff --check`: passed.

Database verification introduced by this package:

- `supabase/tests/173_ce_010_community_proposal.test.sql`: 64 assertions, real shared Core functions, synthetic transaction-local registry/authority setup and behavioral SQL calls. CI `Database tests` runs this file in the existing disposable Supabase job.
- `scripts/test-ce-010-concurrency.mjs`: two independent PostgreSQL connections plus an observer; same-key replay, duplicate-report race, competing decisions and membership revocation while a replay waits.
- `.github/workflows/ce-community.yml`: CE-owned route/domain and real concurrency workflow. It uses pinned CLI 2.84.2 and an explicitly local disposable database. The concurrency runner refuses a remote host or a missing `CLADORA_EPHEMERAL_DB=1` guard.
- `ce_010_community_operational_v1.inc` must exactly match the proposal. Proposed Core seeds exist only in the separate synthetic test fixture; they are not shipped in the proposal.

Local Supabase startup was attempted but did not reach a usable database: ECR access was denied; the supported Docker registry mirror then exhausted the managed daemon's layer storage. Local PostgreSQL execution is not reported PASS; successful runtime evidence comes from disposable GitHub CI. No existing CE011 runtime suite was rerun locally; reference its original successful head `d12baf5c78eb846e1704646b931f876ea5a41b2e`, Database tests run `37812059448`, Application Foundation run `37812059553`, and READY Preview `dpl_Dg5Ys5foA2UjA35hWRM7AAyaEhSd`.

Runtime evidence at code head `1d6e183b978823a9317322454321173537a9c67a`:

- [Database tests run 37922107522](https://github.com/ontripai/cladora-website/actions/runs/37922107522): successful static and PostgreSQL jobs; CE010 64 assertions passed; full suite 164 files / 5220 assertions passed.
- [CE Community run 37922107595](https://github.com/ontripai/cladora-website/actions/runs/37922107595): domain, 55 HTTP checks and all four real PostgreSQL race scenarios passed.
- [Application Foundation run 37922107549](https://github.com/ontripai/cladora-website/actions/runs/37922107549): successful.
- Vercel Preview `dpl_AXy6sMxmfUdvT1hnWZdpRTTBJgde`, same code head, READY; target is Preview, not Production.
- Initial delivery `27db648d3145c285d51ce393494a426e04429612` failed the isolated fixture because UNION membership-status literals inferred text. The tested code head adds explicit enum casts to all four fixture rows; no production schema or proposal change was needed.

## Independent remaining gates

1. **CORE-CE010-MAP-01:** Core confirms the exact read/mutation/module mapping; any change requires a bounded CE adapter update and affected tests.
2. **CE010-MIG-01:** separate authorization and ownership for conversion/installation of the proposal. No migration file or installed remote version exists for this package.
3. **CE010-UI-01:** separately authorized public page/menu connection and live API/browser acceptance after persistence is ready.
4. **CE012-OPS-01:** next independent CE package, using safe Documents references; it does not wait for external delivery or SERVICE.

Merge, Supabase Remote migration and Production deployment remain separate approvals. Preview/CI success and a coordination receipt cannot accept, close or release a package. Manifest/PM recording belongs to CLADORA Documentation & PM; no private credential is required or requested by this workstream.
