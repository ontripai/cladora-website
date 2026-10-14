# AIRPROP-GATEWAY-READ-DESIGN-01

Status: executable design package; production remains pre_activation.
Baseline: `df8124807a702f3b6fdcce3903e74aed7c713c67`.
Owner: AIRPROP; Core reviews identity/authority and execution-role design.

## Delivery boundary

Connect only the existing portfolio read gateway to a real session in a disposable
Local environment. Reuse Artifact B2 and AP10; no mutation runtime, C/D, new
ledger, Documents store, authority provider or production composition is needed.
This PR changes documentation only. `commands=null`, `can_edit=false`,
`state=pre_activation`, `runtime=null` and production `portfolio=null` remain.
The isolated harness may inject a portfolio client into `createAirpropB2Api`;
that dependency injection is not production activation.

## Existing executable contracts

| Boundary | Source |
| --- | --- |
| Read-only RPC and canonical authorization | `supabase/migrations/20261009121000_airprop_management_portfolio_report_v1.sql` |
| Strict query/response projection | `src/lib/airprop/commercial-lifecycle-v1.ts` |
| Exact RPC adapter | `src/lib/airprop/artifact-b2-portfolio.ts` |
| GET controls/read and bounded errors | `src/lib/airprop/artifact-b2-api.ts` |
| Closed production composition | `src/app/api/customer/v2/airprop/artifact-b2/route.ts` |
| Cookie session integration | `src/lib/supabase/server.ts` |
| AP10 lifecycle/target proof | `docs/testing/CLADORA-AP10-AUTH-E2E-FIXTURE-v1.0.md` |
| Existing execute consumer | `scripts/lib/ap10-airprop-b2-consumer.mjs` |

The gateway is `customer_api.read_airprop_management_portfolio_v1(uuid,uuid)`.
The adapter sends only `p_context_id` and `p_workspace_id`; response validation
must use the existing strict schema. No property/unit query extension is part
of this delivery.

## Identity and scope binding

1. Resolve the session per HTTP request through the existing server Auth
   boundary. Verify the session/token with the target Auth service and its
   canonical session-validity policy. Derive actor only from verified `sub`;
   never accept actor, tenant, AAL, permission or revision from query/body,
   user_metadata, or a client-supplied SQL setting. Revoked-session enforcement
   and expiry/refresh behavior require explicit Core/Auth acceptance.
2. Use the same actor session for session resolution and the actor-bound
   `customer_api` RPC client. Reuse the existing SSR cookie client for a cookie
   transport. A bearer-only loopback harness needs a reviewed bearer verifier:
   the production route currently reads cookies, so merely sending an
   Authorization header does not establish that route's actor. Never mix one
   client's session check with another user's RPC token.
3. Accept exactly one `context_id` and one `workspace_id`, both UUIDs. These
   identify the user's explicit selection, not authority. B2 already rejects
   extra/repeated parameters. No implicit first Workspace or tenant fallback.
4. Artifact A independently calls `resolve_workspace_native_context_v2`, then
   `check_workspace_native_permission_v2` for `airprop.asset.read` and module
   `airprop_commercial`, using `auth.uid()` and real AAL2 claims. This current
   evaluation, not AP10 setup or an earlier allow response, governs each read.
5. Portfolio rows are restricted to the resolved tenant and explicit Workspace,
   accepted mandates with `valid_from <= current_date < valid_to`, and a current
   property mandate for purpose `property_operations`. Canonical property and
   owner labels come from existing portfolio tables. Cross-Workspace results
   must never be merged into a selected Workspace's UI.
6. Unit IDs occur only in existing action-link references under the accepted
   mandate. The RPC filters action links by tenant, Workspace and mandate; it
   does not independently reauthorize each unit at read time. Core must review
   whether write-time canonical work-order/unit binding plus current property
   authority is sufficient after unit reassignment/revocation. Do not claim
   unit-level read isolation until that question is resolved with fixtures.
7. Preserve immediate UI clearing, aborted requests and discarded late responses
   on Context/Workspace/session changes. No cached allow or prior portfolio may
   survive an identity switch. Permission revocation needs a fresh RPC decision.

GET with a query currently has no explicit HTTP AAL check: AAL2 is enforced
inside the SQL gateway. GET metadata alone requires authentication, not AAL2.
Do not infer portfolio acceptance from successful metadata. Mutation POST stays
closed with `runtime=null`; the read harness does not call mutation commands.

## Outcome contract and known adapter limitations

| Observed outcome | Meaning and presentation |
| --- | --- |
| Verified authenticated metadata GET, no query | Existing B2 controls; no resource-read evidence |
| Authorized SQL/strict response, properties=[] | Successful empty authorized portfolio; render empty state |
| Missing session | Existing HTTP 401; no resource disclosure |
| Invalid/repeated/extra query | Existing HTTP 400; no RPC |
| Production portfolio dependency absent | Existing HTTP 403 AIRPROP_PRE_ACTIVATION |
| RPC error, malformed response, timeout or exception | Existing adapter denied/PROVIDER_UNAVAILABLE; HTTP 503 AIRPROP_PROVIDER_UNAVAILABLE; render unavailable |
| AAL1, revoked Context/authority, denied permission or cross-Workspace SQL rejection | SQL denies; current B2 read adapter also maps these to unavailable/503 |

The existing adapter collapses authorization and infrastructure failures. Keep
that bounded behavior in this package; never invent a finer reason from private
rows, turn an error into properties=[], or report a 503 as a proven specific
permission denial. The future HTTP adapter should reject verified AAL1 before
RPC; public denial/error distinctions need owner-reviewed implementation and
error-contract evidence. Raw SQL/session/credential details must stay private.
Use existing `no-store, private` response headers; do not share/cache projections.

## Execution-role proposal and explicit unknowns

The installed migration revokes EXECUTE from PUBLIC, anon, authenticated and
service_role. It is SECURITY DEFINER with a fixed pg_catalog search_path and
canonical checks; the installed gate must remain closed in shared/Production
environments. A publishable-key actor client cannot bypass this gate.

Proposed isolated mechanism: Core-owned test infrastructure permits the exact
read signature to an actor-bound execution role only inside the disposable
Local target, with the existing Auth/JWT identity path. Prefer the existing
PostgREST authenticated actor path for real-session evidence if Core approves
its test-only exact EXECUTE and customer_api schema access. Do not grant broad
schema/table/function access or enable mutation signatures. A custom role is an
alternative requiring a reviewed authenticator membership and verified claim
mapping; its name alone proves nothing. No role/grant is created by this PR.

Required decisions before execution:
- Confirm effective local grants, function owner, schema exposure/USAGE and
  PostgREST JWT/session behavior against the pinned disposable stack.
- Approve the narrow test-only execution mechanism and teardown proof; it does
  not establish a deployment execution role or grant acceptance.
- Confirm session revocation policy, current Context/Workspace module and
  entitlement checks, and property/unit reassignment behavior with Core.
- Prove all dependencies are read-only. SECURITY DEFINER plus STABLE is not by
  itself proof of no durable writes; compare domain/Core audit/outbox/idempotency
  counts before and after reads, including negatives.
- Decide the future production role/composition separately. service_role,
  postgres, manually forged claims and direct privileged SQL cannot satisfy
  real actor-bound HTTP/Auth/AAL2 acceptance.

## Isolated execution sequence

1. Freeze the candidate SHA and target manifest. Use AP10's existing Local
   identity verifier before any Auth/authority/domain setup. A loopback URL
   alone is insufficient. Test/Preview are blocked by the current AP10 verifier
   (`disposable_target_identity_unavailable`); Preview build success is not a
   trusted isolated database identity.
2. Lifecycle owner provisions a disposable Local stack with canonical migrations
   and existing AP10 target proof. AP10 owns actual Auth sign-in/TOTP challenge,
   Membership/Context/Workspace/property/unit authority setup and finally cleanup.
   Synthetic authority claims cannot replace this flow. Setup writes are test
   infrastructure and require separate execution authorization; this design PR
   performs none.
3. AIRPROP seeds accepted/expired/revoked mandate and action-link scenarios only
   within that verified disposable database, with explicit cleanup ownership.
   Seed one nonempty and one authorized empty projection; an empty fixture cannot
   prove property or unit isolation. No product Remote target is eligible.
4. Core approves/install the exact test execution gate, or record EXECUTE blocked
   and stop acceptance. Start a loopback-only test HTTP harness injecting B2's
   portfolio adapter and request-scoped real session. Keep production route
   unchanged, runtime=null, bind=>null and B2 controls pre_activation.
5. Wrap the scenario with runAp10AuthE2EFixture and its existing execute consumer.
   Its transports use the fixture actor's real cookie session or verified bearer
   session. Test both explicit Workspaces/two properties/three units; assert
   exact expected nonempty rows and absence of cross-property/unit references.
   The existing consumer only checks property IDs and counters; additional
   harness assertions are required for unit membership, nonempty reads and HTTP.
6. Collect redacted HTTP status/headers/body-schema results and Auth AAL proof
   from the same requests. Record unavailable separately from empty success.
   The existing consumer hardcodes httpAal2=NOT_RUN_NOT_PASS; retain that field
   and attach separate independently verified evidence rather than overwrite it.
7. Revoke Context/Workspace/property authority through fixture ownership and
   repeat fresh requests. Verify session expiry/revocation and actor switching,
   including concurrent sessions, without leaking a prior response/client.
8. Finally clean AIRPROP fixture rows, execute AP10 authority/Auth teardown and
   destroy the disposable stack. Cleanup failure invalidates acceptance. Never
   compensate against an unrelated client after failed target identity proof.

## HTTP/Auth/AAL2 evidence matrix

All network/runtime rows below are NOT_RUN_NOT_PASS in this documentation PR.
Required artifacts are redacted and tied to exact code SHA, target proof and
request correlation IDs. Do not publish tokens, cookies, OTP secrets, private
connection values, or actor/resource IDs; use stable case labels in receipts.

| Case | Required observation |
| --- | --- |
| Real TOTP AAL2, current permission and nonempty portfolio | Real loopback HTTP 200, strict B2 view, exact allowed property/unit references; verified actor matches RPC; no durable write delta |
| Authorized empty portfolio | HTTP 200 with strict properties=[] after canonical allow; distinct from all unavailable cases |
| No/forged/expired/revoked session | Verified rejection without resource disclosure; zero reads where precheck applies and zero durable writes |
| Real AAL1 | Metadata behavior documented; resource read denied by A gate; current B2 503 limitation recorded, not called HTTP MFA 403 |
| Missing permission/module/entitlement or revoked Context | Fresh denial; no historical/cached allow, zero durable writes |
| Cross-Workspace/tenant, expired/revoked property mandate | No disallowed projection; zero durable writes; private existence not disclosed |
| Unit moved outside authorized property/Workspace | No disallowed unit reference; unresolved semantics block scope acceptance |
| Provider timeout/malformed data/closed EXECUTE | 503/unavailable, never successful empty portfolio; zero durable writes |
| Identity switch, overlapping responses, concurrent users | Correct session per request; UI clears prior data; no late/cross-user projection |
| Repeated identical GET | Fresh current authorization; no mutation receipt/idempotency row, no extra audit/outbox/domain effects |
| Production route unchanged | Metadata controls unchanged; resource GET remains 403 pre-activation; no activation or grant evidence inferred |

Current evidence classification:
- Source inspection: completed for installed A SQL, B2 API/portfolio/production
  composition, AP10 lifecycle and execute consumer at the baseline above.
- Existing API/AP10 tests: `node scripts/test-airprop-b2-api-ap10.mjs` passed
  5/5 cases on this documentation candidate. This is in-process contract
  evidence only; mocked Auth and deterministic pool are not real HTTP, session
  or MFA acceptance.
- Actual HTTP transport: NOT_RUN_NOT_PASS.
- Actual Auth sign-in/TOTP/AAL2 portfolio request: NOT_RUN_NOT_PASS.
- Actor-bound PostgreSQL read and execution-role proof: NOT_RUN_NOT_PASS.
- Unit reassignment/revocation scope: BLOCKED_CORE_REVIEW.
- Test/Preview target identity: BLOCKED_TRUSTED_VERIFIER_UNAVAILABLE.

## Review and handoff

Core accepts identity/session/current scope, role proposal and unit-scope decisions.
AIRPROP implements only the loopback read harness after those decisions and the
separate isolated execution authorization. Documents & PM coordinate release;
merging this documentation does not activate AIRPROP. Deliver a run receipt with
per-case expected/actual results, evidence classification and cleanup proof.
Guard/hash updates require a real consumer byte delta; this design has none.
