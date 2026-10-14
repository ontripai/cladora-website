# SV-SUBJECT-LINK-HTTP-01 — isolated HTTP and AAL2 integration

## Purpose and authorization

Connect the merged private-message/Service Request link composition to an HTTP
handler in an isolated environment. Prove the complete path from a verified
user session through the existing Core transaction host to durable effects and
a bounded HTTP response. This package authorizes isolated implementation and
testing; it does not authorize a public production route, Remote database
operations, new grants, role assignments, notifications or activation.

Implementation owner: SERVICE. Core reviews the identity/transaction adapter
and command mapping. CE reviews only audience-provider consumption if changed.
AIRPROP owns any safety-manifest update. Documents & PM coordinates final-head
review and serial merges. Documents & Vault has no task in this package.

## Pinned starting evidence

- Product main: `63b458c01302699d54cb54cf63ba54eec92bdc1b`.
- CE audience delivery: PR #386, merge
  `e257d6facee29f78721db5062a9ac8645aa524d4`.
- SERVICE subject-link delivery: PR #385, merge equal to the pinned main.
- Pinned-main checks: `static-contract`, `postgres-runtime`, `depth-guard` and
  `application-contract` succeeded. The failed PostgreSQL startup attempt was
  an occupied local port; its failed-job rerun on the same SHA succeeded.
- Vercel commit status succeeded. That status does not prove database
  installation, user authentication or product runtime acceptance.
- Repository migration inventory: 253 SQL files. This is not Remote inventory.
- Existing [subject-link package](CLADORA-SV-SUBJECT-LINK-01-EXECUTION-PACKAGE-v1.0.md)
  defines the merged domain composition.

The control manifest remains an older pinned observation. This package neither
updates it nor creates a PM receipt. PM oversight and Remote inventory are
unavailable in this task; previously reported values remain reported.

## Existing contracts to consume

| Boundary | Existing source |
| --- | --- |
| Input intent | `src/lib/customer/service-collaboration-v14-schema.ts` |
| Command builder and mutation composition | `src/lib/customer/service-request-subject-link-v1.ts` |
| Transaction, replay, receipt and retry | `src/lib/core/postgres-transaction-host-v1.ts` |
| Current authority | `src/lib/core/current-authority-postgres-provider-v1.ts` |
| Audience evidence | `src/lib/core/communications-private-message-request-audience-provider-v1.ts` |
| Server authentication | `src/lib/supabase/server.ts` |
| Request origin controls | `src/lib/security/same-origin.ts`, `src/lib/security/origin.ts` |
| Existing isolated SQL regression | `scripts/test-service-request-subject-link-postgres-v1.mjs` |

No parallel command, authority resolver, audience policy, transaction engine,
receipt ledger, audit, outbox or idempotency store is required.

## SERVICE implementation

1. Create one server-side subject-link HTTP handler with injected, trusted
   authentication and database dependencies. Register it only in a loopback
   test application. Production routing must remain absent. A future route may
   follow `/api/customer/v1/services/requests/{request_id}/subject-links`, but
   adding that production route is outside this package.
2. Parse JSON with the existing strict collaboration intent schema. Narrow this
   handler to `reference_kind=message` and domain `relation=conversation`.
   A path Request ID, when present, must equal the intent Request ID. Reject
   extra fields, repeated/unknown query parameters, invalid versions and
   malformed/oversized bodies before a database call. Reuse project origin/CSRF
   controls; test rejected cross-origin requests and the policy for missing
   Origin explicitly rather than copying a permissive write route.
3. Authenticate through the existing server session boundary. Derive actor from
   a verified token, require actual `aal2`, and use the canonical session
   validity policy. Do not accept actor, tenant, AAL, authority revision,
   permission, module, provider code, input fingerprint, receipt or SQL settings
   from the HTTP body or headers as authority. `user_metadata` is not an
   authorization source. A Workspace/Context ID in the intent is a selection
   to validate, not proof of access.
4. Read the current canonical authority revision on the server and build the
   existing command using `buildServiceSubjectLinkCoreCommandV1`. Preserve the
   existing builder's fingerprint and idempotency contract. Core rechecks that
   revision under its locks; an earlier server read does not grant access.
5. Invoke `createCorePostgresTransactionHostV1` with
   `createServiceSubjectLinkCoreProvidersV1`. Bind the verified actor/session
   claims to the same backend connection used by the host. The existing Core
   resolver checks `auth.uid()` against the command actor; a standalone HTTP
   identity check or evidence mock cannot satisfy this boundary.
6. Keep the connection adapter request-scoped. Pool checkout/release, failure,
   rollback and retry must not leak claims or SQL role to another request.
   Never install a shared pool-connect listener capturing a particular user.
   Any SQL identity setting must come solely from verified server identity,
   remain on the host's connection and be cleared before reuse. A retry must
   bind the same verified request identity on its fresh transaction/connection.
   If these guarantees cannot be achieved with the current host interface,
   document the smallest required Core delta for review instead of bypassing it.
7. Leave the accepted CE and SERVICE implementations/migrations unchanged
   unless a demonstrated adapter defect requires a focused owner-reviewed fix.
   Do not replace the private resolver with a privileged public RPC or grant
   client access to make the HTTP path work.

### Command and version invariants

- Permission/module/purpose:
  `services.orders.subject_link / services_orders / service.request.subject_link`.
- Independent current reads: `services.orders.read` and
  `communications.feed.read`; neither grants subject-link mutation.
- `Vcurrent = Vexpected`; `Vresult = Vexpected + 1`.
- `command.aggregate_version = Vresult`; resolver/CAS consume `Vresult - 1`.
- Request, link, receipt and outbox versions are all `Vresult` after commit.
- Core reference: `message / subject_link`; reference version and
  `subject_reference.request_version` both equal the message source version.
- `provider_source_ids` contains exactly that message ID.
- Return CE's accepted audience evidence unchanged to Core. All current
  participants must map to the allowed canonical parties and both beneficiary
  and provider must be represented, with the existing same-party exception.

### HTTP outcome contract

Define a strict, minimal public projection of the existing Core result. Return
`Cache-Control: no-store, private`; do not serialize the complete internal
authority/provider receipt, raw SQL error, session data or credentials.

| Outcome | HTTP behavior |
| --- | --- |
| Invalid input | 400; no host invocation |
| Missing, invalid or expired session | 401; no host invocation |
| AAL1 or rejected origin | 403; no host invocation |
| Permission, Workspace or audience denial | Bounded denial; no writes and no existence oracle |
| Confirmed commit or exact replay | 200 with outcome, receipt ID and resulting Request version |
| Changed replay | 409; no additional writes |
| Exhausted transaction failure | Bounded failure; never claim success |
| Unknown commit | Pending/readback-required response; never claim rollback or create a new idempotency key |

Use existing Core distinctions. In particular, `PROVIDER_UNAVAILABLE` is not
proof of a particular stale or permission reason. Do not invent a finer error
from private rows. Durable readback must use canonical Core records and a
fresh current-authority check; a cached historic receipt is not fresh authority.
If a complete readback endpoint is beyond the delivery, report that limitation
and preserve `READBACK_REQUIRED` without claiming recovery acceptance.

## Isolated HTTP/AAL2 evidence

Use a loopback HTTP server and a disposable local database. The harness must
refuse Remote database URLs and production Supabase endpoints. Run requests
through the actual handler, accepted providers and Core host. Do not substitute
provider evidence or successful command receipts with mocks in acceptance.

Actual AAL2 acceptance requires a local Supabase Auth sign-in and MFA challenge
flow yielding a verified AAL2 session. Manually constructed JWT claims,
`set_config(... aal2 ...)`, or a mocked authentication adapter may support
contract tests, but are labelled synthetic and cannot close HTTP/AAL2 acceptance.
If local Auth/MFA is unavailable, deliver the adapter and negative tests, report
the missing evidence and leave real HTTP/AAL2 `NOT_RUN_NOT_PASS`.

| Scenario | Required evidence |
| --- | --- |
| Valid real AAL2 session, exact authority and audience | HTTP commit; Request/link/receipt/outbox versions agree; one effect set |
| Anonymous, forged/expired token or AAL1 | 401/403 before host; no durable effects |
| Attempted actor/authority/permission injection | Strict input denial; no durable effects |
| Valid session but missing subject-link permission | Denial; all domain/Core effect counts unchanged |
| Missing read permission or Communications module/scope | Denial; no body or participant disclosure |
| Revoked authority, invalid audience or cross-Workspace binding | Denial; zero durable writes |
| Stale Request/message | Bounded denial/conflict using existing Core semantics; zero durable writes |
| Same HTTP intent and idempotency key replayed | Same receipt and version; no second increment or event |
| Changed intent with reused key | Conflict; no extra writes |
| Concurrent users using recycled pool connections | Correct per-request actor; no claim leakage on success, failure or retry |
| Genuine SQL `40001` | Existing host fresh-transaction retry; no swallowed exception or fabricated evidence |
| Failure after mutation / unknown commit | Full rollback where known; otherwise explicit readback-required, no blind new-key retry |

Capture expected zero-write counts across Request version, links, Core
idempotency, audit and outbox. Use ephemeral test-only privileges already
required by the disposable harness, explicitly classified as test infrastructure;
they do not establish any deployment execution-role or grant acceptance.

## Review and delivery order

1. SERVICE delivers one Draft PR from the pinned main or a newer observed main,
   with the transport/identity adapter and focused real HTTP tests.
2. Core reviews only command mapping, actor/session connection binding,
   authority recheck, pooled-connection cleanup, retry and replay/readback delta.
   CE reviews changed audience consumption only; accepted unchanged bytes do
   not require another full provider review.
3. If protected additions are necessary, AIRPROP alone registers exact final
   filenames/hashes after owner review. No consumer edits the shared guard.
4. Refresh only when dependencies/main change. Preserve accepted bytes and
   report head, tree, base, delta and exact-head checks/Preview. Run affected
   tests and normal CI; do not manually repeat unchanged historical suites.
5. Documents & PM performs the final exact-head/base/check read and exclusive
   GLOBAL MAIN-WRITER merge. No concurrent main writers.

Deliver a bounded evidence receipt in the PR description: pinned environment,
head/tree/base, source of authentication, synthetic versus real sessions,
database target classification, HTTP scenarios, effect counts, changed bytes,
pending readback/role limitations and exact-head CI/Preview URLs. Never include
private credentials, access tokens or user/participant payloads.

## Current result and later boundary

This file is an execution package, not an implementation or acceptance result.
Isolated HTTP tests, real local AAL2, deployed execution-role verification,
Remote database installation and production runtime acceptance are all
`NOT_RUN_NOT_PASS` at package creation. Earlier PostgreSQL provider evidence
remains valid for its stated inactive scope only.

Any deployed connection role, Remote history reconciliation/apply, public route,
role assignment, activation, notifications or real production/browser acceptance
requires a separate reviewed rollout package and authorization. This package
does not write baseline/Page/PM or close workstream stages.
