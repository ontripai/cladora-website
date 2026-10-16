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
| `READ-HOST-01` | Core-owned current-read transaction host/scope | `CoreTransactionScopeV1` is created only for a command and carries command transaction semantics. |
| `READ-AUTH-01` | Current read-authority request, observation and binder | The canonical authority provider requires a command ID and `command_aggregate` lock. |
| `CONTENT-DOMAIN-01` | Closed `content.policy` / `content-policy.v1` artifact schema | The artifact discriminated union contains four non-content domains only. |
| `READ-SELECTOR-01` | Current property/profile/artifact selection through the read host | Existing public selector/resolver exact-match command and receipt values. |
| `CE-READ-ADAPTER-01` | Inactive CE consumer of the Core read result | CE currently owns lifecycle command/replay providers, not a current content-policy read port. |

No blocker may be bypassed with a synthetic command, no-op mutation, fake aggregate, fabricated
receipt, historical receipt, cached allow, locale-derived country or consumer-owned resolver.

## Package sequence

### 1. Core current-read host

Create a sealed Core host that owns client checkout, transaction boundaries, verified actor
binding, fixed lock order, attempt lifecycle and cleanup. The host must permit provider `SELECT`
queries and shared locks only and reject all durable writes. It must expose no generic constructor
for consumer-created scopes.

The initial profile is fixed to CE Guide content-policy reads. Generalization to other read profiles
requires a closed Core registry, not caller-supplied permission, module, purpose, table or SQL data.

### 2. Core read authority

Add a read-specific request/observation/binder that consumes the same canonical authority truth as
the command provider. It binds read request ID, attempt, database transaction, Context, Workspace,
actor, property source lock, current revision, `experience.guide.read`, `experience_guides` and
`experience.guide.content-policy.read`.

The decision remains ephemeral and sets `reusable_as_command_authority=false`. It does not write a
receipt and cannot be accepted by `CoreTransactionHostV1.execute`.

### 3. Versioned content-policy domain

Extend the closed artifact schema with `content.policy` / `content-policy.v1` and synthetic contract
fixtures. The schema may model bounded content classification, disclaimer/review requirements and
source-provenance requirements. It must not contain a real country's law, tax/rate data, legal
advice, credentials, Guide body, translation, route or adapter configuration.

The existing generic artifact inventory can store canonical bytes for an approved domain. This
package does not authorize a migration, Country Pack row or seed. Any later persistence delta must
first prove that the current generic constraints are insufficient.

### 4. Shared private selection primitives

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

## Required static evidence

The implementation PR must prove:

1. no import or call from the read port to `CoreTransactionHostV1.execute`;
2. no construction of `core-transaction-command.v1/v2` or command authority receipt;
3. no historical evidence accepted as current authority;
4. exact fixed permission/module/purpose and content domain/version;
5. no locale/language/currency/timezone/IP field in the selection request;
6. all provider SQL is `SELECT`/shared-lock only;
7. output schema contains only bounded metadata and `reusable_as_command_authority=false`;
8. no CE/SERVICE/Documents authority store, artifact registry, ledger or resolver is introduced;
9. no migration, seed, grant, route or activation unless separately reviewed and authorized;
10. existing command selector/resolver and replay contracts remain byte/behavior compatible.

## Required disposable PostgreSQL evidence

| Scenario | Required result |
| --- | --- |
| Explicit property with one current profile/content artifact | Accepted bounded metadata; no durable writes. |
| Actor locale/language/currency/IP differs from property country | Same explicit property selection; inference inputs absent. |
| Missing content domain or artifact bytes | `CONTENT_DOMAIN_UNAVAILABLE` or `ARTIFACT_UNAVAILABLE`; zero writes. |
| Two current assignments/artifacts | Fail closed as ambiguous; zero writes. |
| Revoked membership or denied `experience.guide.read` | `AUTHORITY_DENIED`; no profile/artifact disclosure and zero writes. |
| Authority revision changes before evaluation | `STALE_AUTHORITY`; zero writes. |
| Context or property belongs to another Workspace | Bounded scope/property denial with no existence disclosure. |
| Assignment/profile/domain/artifact inactive or expired | Bounded denial; no fallback to newer, older or another-country artifact. |
| Historical receipt/reference supplied | Rejected as malformed/binding mismatch; never establishes current authority. |
| Concurrent assignment move/profile retirement | Writer blocks until read completes or reader receives real `40001`; no stale allow. |
| Genuine `40001` | Error reaches host and a new transaction/attempt rechecks authority and all current state. |
| Provider/internal failure | Bounded unavailable result; no durable writes. |

Zero-write evidence must snapshot domain tables plus Core idempotency, audit, outbox and receipt
tables before and after every denial. The accepted path must also leave those durable tables
unchanged.

## Security and privacy review

The implementation review must cover current actor binding on the same client, authority revision
locking, Context/Workspace/property ancestry, cross-Workspace denial, RLS and ACL behavior for the
eventual execution role, function ownership/search path, recursive role membership and output
redaction. `service_role`, an object owner or a command execution role is not an acceptable read
fallback.

Credentials and pool construction remain private deployment dependencies. No password, project
reference, connection string or provider token enters source, tests, fixtures or reports.

## Acceptance order

1. Core read host/scope and authority binder review.
2. `content.policy` schema and synthetic fixtures review.
3. Static and disposable PostgreSQL evidence on one exact head.
4. Inactive CE adapter review.
5. Separate role/ACL/RLS package if the installed inventory cannot execute the read safely.
6. Connected disposable validation.
7. Remote preflight and separately authorized installation, if any migration is required.
8. HTTP/Auth/AAL2 wiring and acceptance in a separate CE activation package.

Vercel Preview or repository CI is not evidence of Remote installation, runtime authority, Country
Pack data, HTTP/AAL2 behavior or Production acceptance.

## Stop condition

Result: **`core_extension_required`**.

CE must remain fail-closed for current Country Pack content-policy reads until the first three
packages above are implemented and independently reviewed. This document does not authorize Merge,
Remote DB access, migration apply, seed, grant, route wiring or activation.
