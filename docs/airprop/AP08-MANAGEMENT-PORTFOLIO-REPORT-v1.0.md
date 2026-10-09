# AP08-RPT-01 — management portfolio report

**Owner:** AIRPROP read model; Operations and Finance retain canonical detail

**Program baseline:** CLADORA v1.4 at `2fb9d7d264666d68d2f0063110c99b8a7a76acb9`

**Parent delivery:** AP07-OPS-01 / Draft PR #343 at `0a927f543e354ee53097453b70072c1e3054aace`

**Status:** Exact-head CI verified; review acceptance pending

## Scope

AP08 returns current, AAL2-authorized AIRPROP management portfolio rows for one explicit Workspace. Each property requires a currently effective accepted commercial mandate, `airprop.asset.read`, and a current Core `property_operations` authority. Revocation removes the property on the next read.

The report uses canonical property and owner labels and exposes AIRPROP-owned immutable action references. Operations status is explicitly a link-time snapshot; current Work Order detail remains in Operations. Finance is explicitly `not_connected` while its accepted canonical receipt contract is absent.

## Boundary

The read model creates no table, role, permission, authority, audit event, outbox event, Work Order, Service Order or financial row. It does not query or copy Operations live detail or Finance amounts. Unauthorized and expired properties are omitted without counts or labels.

Named blockers:

- `FIN01-PORTFOLIO-RECEIPT`, owner Finance/Core: versioned canonical receipt/posting read contract absent.
- `SERVICE-RESOURCE-REF`, owner SERVICE/Core: canonical resource reference absent from the accepted SERVICE request contract.

## Verification

| Check | Result |
| --- | --- |
| Database package static contract | 245 migrations, 170 test files, 5364 assertions passed |
| AP08 pgTAP contract | 24 assertions cover AAL2, current authority, revoke, cross-property non-disclosure, expired mandate, owner/property labels, Operations snapshot boundary, Finance blocker and zero write effects |
| AIRPROP commercial route | 43 checks passed; context/workspace-only mapping has no client tenant or Finance filter |
| TypeScript / ESLint / diff check | Passed |
| GitHub Actions database runtime | Run `37928834714`: 170 files / 5364 assertions passed, including AP08 24/24 |
| Exact-head checks | Commercial `37928834802`, foundation `37928834750`, all AIRPROP workflows and Vercel Preview passed at `215b0db1dd10e826e0578f7a62bcc5da98510bc8` |

Fixtures are synthetic and use no human account. The migration is an unmerged development artifact and has not been applied to Supabase Remote or Production.
