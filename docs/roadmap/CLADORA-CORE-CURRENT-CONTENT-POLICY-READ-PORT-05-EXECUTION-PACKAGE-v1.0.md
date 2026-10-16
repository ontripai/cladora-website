# CORE-CURRENT-CONTENT-POLICY-READ-PORT-05 execution package

Status: **`core_extension_required`**

Baseline: `main@e11cfda735f50a8969b8f6f791183db9047e2fa4`

Contract: [CLADORA Core current content-policy read port v1.0](../contracts/CLADORA-CORE-CURRENT-CONTENT-POLICY-READ-PORT-v1.0.md)

This package records the implementation order and acceptance evidence for the missing Core read
boundary. It is not an implementation result. It adds no interface, host, migration, runtime
provider, CE route or activation.

## Blocking gaps

| ID | Gap | Why current code cannot close it |
| --- | --- | --- |
| `READ-AUTHORITY-PROFILE-01` | Canonical permission/module/entitlement registry plus sealed read execution profile | `experience.guide.read`, `experience_guides` and `module.experience_guides` are proposal/fixture identifiers, not installed canonical registry state. |
| `READ-HOST-01` | Core-owned current-read transaction host/scope and read authority binder | `CoreTransactionScopeV1` is created only for a command and the authority provider requires a command ID plus `command_aggregate` lock. |
| `CONTENT-POLICY-DECISION-01` | Closed `content.policy` schema and bounded evaluated decision | The artifact union has four non-content domains; a hash alone does not answer CE applicability, disclaimer, review-window or provenance requirements. |
| `READ-SELECTOR-01` | Current property/profile/artifact selection through the read host | Existing public selector/resolver exact-match command and receipt values. |
| `CE-READ-ADAPTER-01` | Inactive CE consumer of the Core read result | CE currently owns lifecycle command/replay providers, not a current content-policy read port. |

No blocker may be bypassed with a synthetic command, no-op mutation, fake aggregate, fabricated
receipt, historical receipt, cached allow, locale-derived country or consumer-owned resolver.

## Package sequence

### 1. Read authority profile

Install and validate `READ-AUTHORITY-PROFILE-01` through a separately reviewed package. Its closed
server registry binds:

- permission `experience.guide.read`;
- module `experience_guides`;
- mandatory entitlement `module.experience_guides` for the exact Workspace and authority revision;
- purpose `experience.guide.content_policy.read`;
- domain `content.policy` / `content-policy.v1`;
- a dedicated read execution profile.

None of these values comes from the request. The entitlement is mandatory. Manage-only actors and
fallbacks to manage permission, `service_role`, an object owner, a command role or an unprofiled
connector are denied.

### 2. Sealed read host and binder

Create a sealed Core host that owns client checkout, transaction boundaries, verified actor
binding, fixed lock order, attempt lifecycle and cleanup. The host must permit provider `SELECT`
queries and shared locks only and reject all durable writes. It must expose no generic constructor
for consumer-created scopes.

The initial profile is fixed to CE Guide content-policy reads. Generalization to other read profiles
requires a closed Core registry, not caller-supplied permission, module, purpose, table or SQL data.

Add a read-specific request/observation/binder that consumes the same canonical authority truth as
the command provider. It binds read request ID, attempt, database transaction, Context, Workspace,
actor, property source lock and current revision to the server-selected profile. A supplied
`expected_authority_revision` is only a stale precondition; it never creates authority.

The decision remains ephemeral and sets `reusable_as_command_authority=false`. It does not write a
receipt and cannot be accepted by `CoreTransactionHostV1.execute`. Every path ends with `ROLLBACK`.
The host has no `COMMIT`, acknowledgement-loss, `unknown_commit`, audit or outbox behavior.

### 3. Content-policy schema and decision

Extend the closed artifact schema with `content.policy` / `content-policy.v1` and synthetic contract
fixtures. The schema may model bounded content classification, disclaimer/review requirements and
source-provenance requirements. It must not contain a real country's law, tax/rate data, legal
advice, credentials, Guide body, translation, route or adapter configuration.

The existing generic artifact inventory can store canonical bytes for an approved domain. This
package does not authorize a migration, Country Pack row or seed. Any later persistence delta must
first prove that the current generic constraints are insufficient.

Implement `CONTENT-POLICY-DECISION-01` so an accepted result includes a bounded evaluated policy
payload for applicability, disclaimer requirement/version, review window and versioned
source/provenance requirements. It must redact Guide body, raw sources, source bodies, reviewer
identity and private signoff references. A fingerprint without this evaluated decision is
insufficient.

### 4. Selector and resolver

Refactor only the minimum private logic necessary for command and read entry points to share:

- current Context/Workspace/property validation;
- property country and current assignment/profile selection;
- exact domain/hash/effective-period validation;
- canonical byte parsing and SHA-256 verification;
- bounded output/redaction.

Public command schemas and exact receipt/lock matching stay unchanged. Historical resolution stays
separate and cannot be called by the current read path.

### 5. Inactive CE adapter

CE may consume only the accepted Core decision. The adapter must not create another transaction,
authority provider, Country Pack store or receipt ledger. The Guide read result remains governed by
current CE audience/read permission independently from Country Pack eligibility.

No route, `commands`, `can_edit`, grant or Production composition changes belong in this package.

### 6. Role, ACL and RLS

Add the minimum dedicated read execution role, ACL and RLS package only after the inactive adapter
has fixed the exact object inventory. It cannot reuse a command role, owner or `service_role`, and
it installs no credential or product activation.

### 7. Connected and HTTP evidence

Run connected disposable catalog/transaction evidence first, followed by inactive HTTP/Auth/AAL2
evidence. Remote installation, credentials, route wiring and Production activation remain separate
authorization gates.

## Required static evidence

The implementation PR must prove:

1. no import or call from the read port to `CoreTransactionHostV1.execute`;
2. no construction of `core-transaction-command.v1/v2` or command authority receipt;
3. no historical evidence accepted as current authority;
4. authority profile, permission, module, entitlement, purpose and domain are absent from caller
   input and selected only from the exact server profile;
5. no locale/language/currency/timezone/IP field in the selection request;
6. all provider SQL is `SELECT`/shared-lock only;
7. output contains the bounded `CONTENT-POLICY-DECISION-01` payload and
   `reusable_as_command_authority=false`;
8. no CE/SERVICE/Documents authority store, artifact registry, ledger or resolver is introduced;
9. no migration, seed, grant, route or activation unless separately reviewed and authorized;
10. every accepted, denied, unavailable and error path attempts `ROLLBACK`, with no `COMMIT`,
    receipt, audit, outbox or unknown-commit branch;
11. existing command selector/resolver and replay contracts remain byte/behavior compatible.

## Required disposable PostgreSQL evidence

| Scenario | Required result |
| --- | --- |
| Explicit property with one current profile/content artifact | Accepted bounded fingerprint plus evaluated applicability/disclaimer/review/provenance decision; no durable writes. |
| Actor locale/language/currency/IP differs from property country | Same explicit property selection; inference inputs absent. |
| Read permission exists but `module.experience_guides` entitlement is missing, false, stale or belongs to another Workspace/revision | `AUTHORITY_DENIED`; zero writes. |
| Actor has `experience.guide.manage` but not `experience.guide.read` | Denied; manage is never a read fallback. |
| Binder offers `service_role`, object owner, command execution role or an unregistered role | Fail before product query; zero writes. |
| Caller supplies or changes authority profile/permission/module/entitlement/purpose/domain | Strict request rejection; server-fixed profile remains unchanged. |
| Missing content domain or artifact bytes | `CONTENT_DOMAIN_UNAVAILABLE` or `ARTIFACT_UNAVAILABLE`; zero writes. |
| Two current assignments/artifacts | Fail closed as ambiguous; zero writes. |
| Revoked membership or denied `experience.guide.read` | `AUTHORITY_DENIED`; no profile/artifact disclosure and zero writes. |
| Authority revision changes before evaluation | `STALE_AUTHORITY`; zero writes. |
| Context or property belongs to another Workspace | Bounded scope/property denial with no existence disclosure. |
| Assignment/profile/domain/artifact inactive or expired | Bounded denial; no fallback to newer, older or another-country artifact. |
| Historical receipt/reference supplied | Rejected as malformed/binding mismatch; never establishes current authority. |
| Bounded output inspection | Applicability/disclaimer version/review window/provenance requirements present; Guide body, raw sources, reviewer identity and private signoff absent. |
| Concurrent assignment move/profile retirement | Writer blocks until read completes or reader receives real `40001`; no stale allow. |
| Genuine `40001` | Error reaches host and a new transaction/attempt rechecks authority and all current state. |
| Provider/internal failure | Bounded unavailable result; no durable writes. |
| Accepted, denied and unavailable completion | PostgreSQL trace shows `ROLLBACK`, never `COMMIT`; connection is clean or destroyed before release. |

Zero-write evidence must snapshot domain tables plus Core idempotency, audit, outbox and receipt
tables before and after every accepted or denied attempt. Transaction tracing must prove every path
ends with `ROLLBACK`, and that retry creates a fresh transaction/attempt.

## Security and privacy review

The implementation review must cover current actor binding on the same client, authority revision
locking, Context/Workspace/property ancestry, cross-Workspace denial, RLS and ACL behavior for the
eventual execution role, function ownership/search path, recursive role membership and output
redaction. `service_role`, an object owner or a command execution role is not an acceptable read
fallback.

Credentials and pool construction remain private deployment dependencies. No password, project
reference, connection string or provider token enters source, tests, fixtures or reports.

## Acceptance order

1. `READ-AUTHORITY-PROFILE-01`: canonical permission/module/entitlement and read execution profile.
2. Sealed Core read host and current-authority binder.
3. `content.policy` schema plus `CONTENT-POLICY-DECISION-01`.
4. Current selector/resolver integration.
5. Inactive CE adapter.
6. Dedicated role/ACL/RLS package.
7. Connected disposable evidence, then inactive HTTP/Auth/AAL2 evidence.

Remote preflight, any separately authorized installation and Production activation follow this
sequence and are not part of it.

Vercel Preview or repository CI is not evidence of Remote installation, runtime authority, Country
Pack data, HTTP/AAL2 behavior or Production acceptance.

## Stop condition

Result: **`core_extension_required`**.

CE must remain fail-closed for current Country Pack content-policy reads until the first three
packages above are implemented and independently reviewed. This document does not authorize Merge,
Remote DB access, migration apply, seed, grant, route wiring or activation.
