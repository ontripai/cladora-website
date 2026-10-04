# AIRPROP diligence drafts runtime 011

2026-10-04. Baseline main #242 `7a478bff2c43f1cb0506253486c9abe594cc2423`. This slice implements persistence and create/list customer gateways for the initial immutable diligence draft. It does not implement evidence attachment, findings, review/approval transitions or a user interface.

## Authority and owned paths

`airprop.diligence.manage` is a separate nondelegable, AAL2 module binding in the existing AIRPROP commercial module. No base role/local role, assignment, workspace activation or entitlement is granted. Read requires existing opportunity.read. Create requires both opportunity.read and diligence.manage, exact native workspace authority and current module/entitlement gates. The existing native and underwriting helpers are reused unchanged. The AIRPROP binding validator is updated to the exact six-action manifest; its existing regression label now refers to the current manifest.

Only AIRPROP SQL/contracts/routes/tests and its workflow are changed. The shared authority fixture receives one AIRPROP test entry point; no shared runtime or document resolver is changed. Check independent main/open PR state before merging. Preserve SERVICE and Operations changes.

## Persistence and retry

`airprop.diligence_cases` references canonical workspace, opportunity and underwriting case/version. Foreign keys and an insert-integrity trigger require exact tenant/workspace/parent consistency. RLS is enabled and table privileges are closed to all client roles; initial drafts are immutable. The fixed policy v1 checklist contains pending legal/financial/technical checks with no evidence. One draft per opportunity/evaluation baseline is allowed. A later evaluation creates a separate historical baseline; old drafts are not overwritten or presented as currently approved.

Creation serializes on the same opportunity lock as underwriting, reauthorizes after waiting, then checks published current evaluation and opportunity status. It records the draft, audit, shared outbox event and canonical retry atomically. Exact replay rechecks current access and returns its immutable original response, even after later evaluation. Changed requests/new keys cannot duplicate an existing baseline. Initial draft creation leaves opportunity status Underwriting; it neither completes diligence nor approves an acquisition.

The create/list route is `/api/customer/v2/airprop/diligence`. Mutation accepts only version 1, context/workspace/opportunity, expected_underwriting_version and idempotency_key. It enforces trusted origin, JSON type/size, strict inputs and authenticated claims. Errors are redacted, retries return 200 versus 201 for creation, and responses have private/no-store headers. GET rejects duplicate/unknown parameters and is limited to 50 scoped historical drafts by the database.

## Evidence dependency retained

The checked document gateway separately controls classification, physical scope, verified evidence and current scanner status. No AIRPROP target exists in the latest shared integrity allowlist or the inspected production function. No generic tenant link, arbitrary object path, forged clean flag or implicit document authorization is introduced here. A coordinated exact-version evidence gateway and live scanner checks remain a prerequisite for completing checklist items and exposing review/approval.

## Validation

The dedicated runtime workflow runs actual canonical authorization/opportunity/underwriting/diligence functions in both disposable PGlite and independent PostgreSQL connections. It covers baseline/version preservation, no automatic grants, retry identity, current deny/expiry/module/AAL2/scope enforcement, direct-table/helper ACLs, and reauthorization of a waiting replay after concurrent revocation. The isolated fixture is not the complete Supabase chain. The full database workflow additionally runs a 15-assertion canonical bootstrap/role issuance/opportunity/evaluation/draft/retry/AAL/ACL integration test against all migrations. Actual compiled route tests exercise security/input/error/retry/cache behavior. Hosted results and production reconciliation must be checked before release; these tests are not a live browser acceptance claim.

## Production schema identity

After the initial 12 workflows succeeded, the unchanged tested SQL was applied through Supabase apply_migration. Its recorded identity is 20261004112140 and SHA-256 is `7e2e57a79165969cc1140f7308364336ec40701461ca9de633be14248951d2a1`. The CLI draft filename was aligned to that recorded identity without reapplying or changing SQL. Remote checks confirm authenticated gateway execution, closed anon/table access. Final validation incorporates independently merged Operations #243 and uses distinct pgTAP fixture 146. No production diligence role was granted and no customer draft was created by this rollout.

Scoped security-advisor review: [RLS without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is informational for the intentionally closed diligence table; no client SELECT or writes are granted. [Authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) is expected for guarded customer RPCs, with private helpers closed. Neither notice is an authorization bypass or a claim of a clean global advisor report; unrelated findings are outside this slice.
