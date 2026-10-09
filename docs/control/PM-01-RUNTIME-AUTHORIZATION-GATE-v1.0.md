# PM01 Runtime Authorization Gate v1.0

**Gate artifact:** PM01-B successor decision; not a new documentation package

**Proposed successor:** `PM01-RUNTIME-01`

**Runtime owner:** Core/Platform

**Control and evidence owner:** PM / CLADORA Documentation

**Dependency:** PM01-B in Draft PR #323, stacked on PM01-A in Draft PR #322

**Gate state:** Authorization required; no runtime, migration or deployment is authorized

## Successor decision

No additional independent and necessary documentation package remains after PM01-B. PM01-A defines the logical contract and PM01-B records the current-schema inventory, non-tenant scope decision, proposed physical boundary and verification requirements. The next genuine successor is Core/Platform runtime and migration work.

`PM01-RUNTIME-01` is a proposed runtime identifier only. It has no branch, PR, migration file or installed object. A branch and Draft PR may be created only after the independent implementation authorization in this gate. This gate remains an artifact of PM01-B and must not be represented as PM01-C or as another completed work package.

At the 2026-10-09 UTC observation, Draft PR #323 had head `1008cf769efa33a17122bca1c80e7632f77c2a69`. GitHub returned zero commit statuses and zero check runs for that head. Its check context is therefore **not registered**—neither SUCCESS nor FAILURE. Earlier check evidence for another commit must not be projected onto this head.

## Proposed schema and objects

The proposed database schema is `pm_private`, a private, non-Data-API schema for one program-scoped internal delivery ledger. It must not use a synthetic customer tenant or Workspace. The exact inventory must be regenerated from the authorized implementation base before SQL is written.

Proposed tables:

| Object | Purpose and required invariant |
| --- | --- |
| `pm_private.programs` | Immutable program root and allowlisted repository identity; no customer tenant foreign key |
| `pm_private.baselines` | Versioned controlling commit/PR and effective status; history retained |
| `pm_private.workstreams` | Stable workstream identity and bounded scope; labels confer no authority |
| `pm_private.assignments` | Platform-user permission, scope, validity and status; explicit, deny-first authority |
| `pm_private.work_packages` | Stable package identity, baseline/workstream binding, current cycle and optimistic version |
| `pm_private.execution_cycles` | Append-preserving cycle history; at most one active cycle per package |
| `pm_private.dependencies` | Typed blocking or non-blocking dependency, required state and reason |
| `pm_private.evidence_references` | Metadata-only exact-commit/run/artifact references; no raw logs, credentials or customer content |
| `pm_private.test_runs` | Check result bound to an exact commit and evidence source; stale results remain historical |
| `pm_private.acceptance_decisions` | Append-only independent-review decision and criteria snapshot |
| `pm_private.blockers` | Lifecycle-orthogonal blocker record with owner and resolution reference |
| `pm_private.change_requests` | Requested scope delta and decision; approval creates a linked execution cycle |
| `pm_private.transitions` | Append-only from/to state, actor, command, reason and expected/new version |
| `pm_private.release_references` | Observed deployment/migration reference separated from test, acceptance and closure |
| `pm_private.command_receipts` | Program-scoped idempotency receipt, request hash, bounded response and expiry |
| `pm_private.outbox_events` | Program-scoped ordered internal event with bounded payload and publish state |

Proposed supporting objects:

- Exact enum/check domains for lifecycle state, decision, permission code, evidence type and publish state; extensions to these domains require compatibility review.
- Primary, foreign-key, uniqueness and partial-uniqueness constraints that enforce one active cycle, monotonic aggregate version and one receipt per actor/namespace/key.
- Indexes for program/scope lookup, active assignments, dependency readiness, unpublished events and cursor-bounded package reads.
- Private versioned functions listed in the RPC contract below.
- A guarded writer into existing `audit.events`; only bounded and recursively redacted snapshots are permitted.
- Separate private command-receipt and outbox records because existing `platform.idempotency_keys` and `platform.outbox_events` require a real customer tenant.

No proposed object is installed by this document.

## Proposed migration name

The logical migration name is:

`pm01_private_oversight_runtime_v1`

After rebasing the authorized implementation branch onto its exact base, the implementation owner must create the file with the repository-supported Supabase CLI command so the CLI allocates the next valid version. The expected path shape is:

`supabase/migrations/<generated-14-digit-version>_pm01_private_oversight_runtime_v1.sql`

No timestamp or filename is reserved now. The generated version must be strictly later than the then-current migration head; at this gate's source commit the observed latest filename is `20261007104000_airprop_commercial_lifecycle_v1.sql`. A later stacked migration changes that fact and requires regeneration rather than renaming an already-reviewed migration silently.

## RLS, ACL and permission impact

The implementation must satisfy all of the following before it can be accepted:

- Keep `pm_private` outside the Supabase Data API exposed-schema list.
- Revoke schema usage, table/sequence privileges and default function execution from `PUBLIC`, `anon`, `authenticated` and `service_role`; no browser client may receive a privileged database credential.
- Enable and force RLS as defense in depth on every PM table. Schema privacy and RLS are separate controls; neither substitutes for object ACLs.
- Use dedicated, `NOLOGIN`, non-`BYPASSRLS` ownership/execution roles only if the exact managed-Postgres role model is approved and proven in an isolated database. The function owner and table owner must not accidentally create an owner/RLS bypass.
- Revoke `EXECUTE` from `PUBLIC` for every function before granting only the minimum gateway execution surface. Every privileged function must pin a safe `search_path`, qualify referenced objects and reject caller-supplied actor or permission claims.
- Treat `SECURITY DEFINER` as an exceptional, separately reviewed boundary. It may be used only in the private schema with explicit actor, AAL, assignment, scope, deny, version and input checks; it must never be introduced merely to solve a permission error.
- Reuse `platform.platform_users` as actor identity. Existing coarse platform roles are an eligibility ceiling, not PM package authority. Customer Workspace, support-access or provisioning assignments grant no PM permission.
- Add the reviewed permission codes `pm.package.read`, `pm.package.manage`, `pm.evidence.attach`, `pm.review.read`, `pm.review.decide` and `pm.release.read` without expanding Production authority. Mutation requires an active platform user, AAL2, an active exact-scope assignment and no applicable deny.
- Prevent self-acceptance where independence is required. `PLATFORM_SUPER_ADMIN` has no implicit acceptance bypass.
- Preserve existing `audit.events`, customer isolation, platform roles, support access, provisioning, idempotency and outbox caller behavior. Any generalization of an existing platform object is a separate compatibility decision.

Permission impact is therefore additive only inside the private PM boundary. It must not expose a new client table, broaden `service_role`, alter customer RLS, infer authorization from GitHub identity or authorize migration/deployment actions.

## Proposed RPC contracts

All functions are private, versioned and unavailable to client roles. Names and minimum contracts proposed for the implementation review are:

| Function | Minimum input | Bounded result and principal failures |
| --- | --- | --- |
| `pm_private.list_packages_internal_v1` | program, filters, limit, cursor | Field-filtered page and next cursor; reject unbounded or unauthorized scope |
| `pm_private.get_package_internal_v1` | program, package | Authorized coordination/detail projection; restricted references independently filtered |
| `pm_private.register_package_internal_v1` | command envelope, package identity/scope | Package, initial cycle, transition, audit/outbox and receipt atomically; conflict on duplicate identity or changed replay |
| `pm_private.transition_cycle_internal_v1` | command envelope, cycle, from/to state | New version and transition receipt; reject invalid edge, stale version or closed/superseded cycle |
| `pm_private.attach_evidence_internal_v1` | command envelope, exact commit, bounded provider reference | Metadata reference and receipt; reject secrets, raw logs and unallowlisted repository identity |
| `pm_private.record_test_result_internal_v1` | command envelope, evidence, check/result/times | Historical exact-commit test record; never changes acceptance automatically |
| `pm_private.record_acceptance_internal_v1` | command envelope, criterion snapshot, decision/reason | Append-only reviewer decision; reject self-review, missing evidence or stale cycle |
| `pm_private.request_change_internal_v1` | command envelope, scope delta/impact/priority | Change request and, only after separate approval, linked cycle |

Every mutation command includes `program_id`, exact package/cycle identity, `expected_version`, bounded reason, client-generated `request_id` and idempotency key. The server derives actor, authentication assurance, permission, repository allowlist and current state. One transaction must persist domain change, transition, redacted audit event, internal outbox event and command receipt or persist none.

## Proposed HTTP contracts

The server-only gateway is proposed under `/api/platform/v1/internal-work`; it is not authorized or implemented by this gate.

| Method and path | Contract |
| --- | --- |
| `GET /packages` | Cursor-bounded coordination projection; private/no-store response |
| `GET /packages/[id]` | Exact-scope detail with independent restricted-field filtering |
| `POST /packages` | Register package and initial cycle through the register RPC |
| `POST /cycles/[id]/transitions` | One expected-version lifecycle transition |
| `POST /cycles/[id]/evidence` | Metadata-only exact-commit evidence attachment |
| `POST /cycles/[id]/tests` | Authenticated provider/check observation without acceptance side effect |
| `POST /cycles/[id]/decisions` | Independent criterion decision |
| `POST /cycles/[id]/changes` | Change request; no implicit reopen or rollout |

Mutation routes require authenticated server-derived platform identity, AAL2, trusted-origin enforcement, strict JSON/content-type and body-size limits, idempotency and optimistic concurrency. Responses must exclude tokens, private URLs, raw provider payloads, SQL errors and unauthorized object existence. The gateway-to-database mechanism, credential scope and Preview configuration each require separate approval; this document defines no Secret.

## Rollback strategy

1. Before implementation, capture the exact base SHA, migration chain, object/privilege catalogs and database-package fingerprint. Generate and review a rollback companion plan against an isolated database.
2. Apply the migration only to an authorized isolated environment, with runtime routes disabled. Run the full chain and catalog/security tests before enabling any gateway.
3. Enable read paths first, then synthetic mutation paths behind an approved non-Production gate. Stop rollout immediately on privilege drift, audit/outbox atomicity failure, replay mismatch or cross-program visibility.
4. Before real PM records exist, rollback may disable routes, revoke gateway execution, drain/quarantine unpublished synthetic events, verify zero retained records, and remove functions/tables/schema in reverse dependency order using a separately reviewed rollback script.
5. After any durable real record exists, destructive down-migration is not the default. Freeze mutations, preserve/export auditable records, revoke access and use an authorized forward corrective migration. Data deletion or history rewriting requires its own authorization.
6. Production rollback, restoration or migration repair is never implied by implementation approval and requires a separate Production operation authorization.

The rollback must leave existing platform/customer objects and callers unchanged and must prove that no orphan audit, outbox or receipt state remains.

## Required real tests

Mock-only evidence is insufficient. The authorized implementation must produce:

- A clean full migration-chain run and a rollback rehearsal against an isolated database created from the exact implementation base.
- pgTAP existence, constraints, foreign keys, indexes, enum/check domains, function signature and transaction assertions with exact plan counts.
- Catalog tests for schema exposure, owners, `relrowsecurity`, `relforcerowsecurity`, table/sequence ACLs, default privileges, function `proacl`, volatility and pinned `search_path`.
- Real-role negative tests for `PUBLIC`, `anon`, `authenticated`, `service_role`, unauthorized platform user, customer-only actor, expired/revoked assignment, AAL1, cross-program and narrower-scope actors.
- Positive least-privilege tests for each PM permission and scope; read, manage, evidence, review and release permissions must not imply one another.
- Independent-review and self-acceptance denial tests, including any platform administrator path.
- Exact replay, changed-payload conflict, actor-bound key, revoked-on-replay, stale-version and superseded-cycle tests.
- Real two-connection races for package registration, cycle start, transition, close, reopen and outbox claiming; assertions must prove one durable winner and no partial writes.
- Forced failure of audit, outbox and receipt insertion proving complete transaction rollback.
- Recursive redaction and size-bound fixtures, restricted-reference non-enumeration and SQL/error sanitization.
- Duplicate and reordered webhook/provider observations, stale/superseded commit results and exact-commit binding; CI success must not create acceptance.
- HTTP integration tests through a real local server for authentication, AAL, origin, content type, size limit, cache headers, cursor bounds, idempotency and error mapping.
- Repository database-package validation, lint/type/test/build checks applicable to the changed runtime files, and Supabase database advisors where supported by the pinned CLI.

## Fingerprint impact

The implementation is expected to change the database-package fingerprint and must make that change explicit:

- The ordered migration filename/content hash, migration count, pgTAP file count and assertion count must advance from the exact implementation base. `scripts/check-database-package.mjs` must continue to pass its strictly increasing 14-digit migration rule, transaction checks and test-plan/assertion equality.
- Release evidence must pin the exact source commit and SHA-256 of the migration and test files. A renamed, regenerated or rebased migration has a different identity and invalidates earlier migration evidence.
- Each command receipt request hash must be computed from a versioned canonical envelope containing program, package/cycle, expected version, action and bounded payload. Server-derived actor/authority is bound to the receipt namespace. Exact input may replay; changed input under the same key must conflict.
- The GitHub/CI evidence fingerprint remains the exact commit plus provider/check/run identity. Results from a prior head—including a green Vercel result—cannot satisfy a later head with no registered context.
- This Gate changes controlled-document SHA-256 values in the manifest only. It does not change application contact/request HMAC behavior or `src/lib/security/fingerprint.ts`; any such change is out of scope and requires separate review.

## Rollout order

1. Obtain the design and implementation authorization listed below.
2. Create one Core/Platform branch and Draft PR from the then-approved base; do not reuse or duplicate the documentation PR.
3. Refresh schema/authority/ACL inventory and collision analysis at the exact base SHA.
4. Generate the migration filename with the pinned Supabase CLI, add pgTAP/catalog/concurrency tests, and validate in an isolated database.
5. Add private functions and server gateway disabled by default; validate real HTTP and negative-authorization paths in local/isolated execution.
6. Obtain separate Preview migration/config/deployment authorization; exercise synthetic identities and rollback.
7. Complete security, evidence and independent acceptance review. A green CI/Vercel result is evidence, not approval.
8. Request separate Production migration authorization.
9. Request separate Production configuration/Secret authorization if an approved gateway requires it.
10. Request separate Production deployment/enablement authorization and monitor bounded rollout/rollback signals.

No later step is authorized by approval of an earlier one.

## Independent user authorizations required

The following decisions are independent and must be explicit; silence, PR review, mergeability or passing checks cannot substitute for them:

1. **Runtime design authorization:** accept/revise the program-scoped non-tenant model, proposed schema/objects, permission model, independent-review policy and gateway pattern.
2. **Implementation authorization:** permit creation of the Core/Platform runtime branch, Draft PR, migration source, runtime code and isolated tests for `PM01-RUNTIME-01`.
3. **Isolated database authorization:** permit creating/applying/reverting the migration only in the named non-Production test environment.
4. **Preview configuration and credential authorization:** permit only the specifically named environment bindings required by the approved gateway; no credential is requested or inferred now.
5. **Preview migration/deployment authorization:** permit applying and deploying the reviewed commit to Preview with synthetic identities.
6. **Production migration authorization:** separately approve the exact migration SHA and target after acceptance evidence.
7. **Production Secret/settings authorization:** separately approve each named Production configuration change, if any.
8. **Production deployment/enablement authorization:** separately approve the exact runtime commit and rollout plan.
9. **Merge authorization:** separately approve merging each Draft PR after its own review gates.

This artifact grants none of these authorizations.

## External unavailable references

`CE010`, private CE/PM credentials or bindings, and commit `1f010c4` remain `external/unavailable` and non-blocking. No Secret, hostname, private file path or private package/bundle source is requested, assumed or created. `PM01-RUNTIME-01` has no dependency on those unavailable references unless a future verified contract explicitly introduces one.
