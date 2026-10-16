# CLADORA Core current content-policy read port v1.0

Package: `CORE-CURRENT-CONTENT-POLICY-READ-PORT-05`

Status: **`core_extension_required`**

Baseline: `main@e11cfda735f50a8969b8f6f791183db9047e2fa4`
(`tree bfa5b1228648a70fd54015b64b0487427811bad8`)

This document defines the missing Core boundary for current Country Pack content-policy reads.
It does not export a TypeScript interface, create a read host, install a Country Pack, or activate a
CE route. The repository has no canonical read scope or read-authority binder that can implement
this boundary without fabricating a command, so this package is intentionally documentation-only.

## Decision

The existing command contracts are not a safe implementation substrate for a CE read projection:

- `CoreTransactionScopeV1` is created only by `CoreTransactionHostV1.execute` after command,
  idempotency, Workspace, aggregate and provider-source locks are acquired.
- `resolveAuthority` requires a `CurrentAuthorityTransactionRequestV1` containing a command ID and
  a `command_aggregate` lock.
- `selectCurrentPropertyJurisdictionProfileV1` exact-matches that command and its post-lock
  authority receipt.
- `resolveCurrentJurisdictionDomainArtifactV1` calls that selector and exact-matches the same
  command, attempt, lock and receipt.
- Historical artifact evidence proves which immutable bytes a committed command used. It is
  explicitly non-reusable and cannot establish current read authority.

Constructing placeholder command, aggregate, idempotency or receipt values in a GET/read path would
weaken these exact bindings and is prohibited. CE must remain fail-closed until Core supplies the
read host and binder described below.

## Reviewed canonical inventory

The baseline contains 260 migration files. Repository presence does not prove Remote installation
or runtime activation.

| Boundary | Canonical artifact | Current capability | Read-port gap |
| --- | --- | --- | --- |
| Property Country Pack selection | `jurisdiction-profile-selector-v1.ts` | Selects one current property assignment/profile and required domain hashes under command locks. | Requires a Core command and command receipt. |
| Domain artifact schema | `jurisdiction-domain-artifact-v1.ts` | Supports `address.structure`, `finance.tax-accounting`, `documents.retention` and `payments.policy`. | No official content-policy domain/schema exists. |
| Domain artifact resolution | `jurisdiction-domain-artifact-resolver-v1.ts` | Current command mode and committed historical mode; validates canonical bytes and SHA-256. | Current mode is command-bound; historical mode is not current authority. |
| Transaction scope | `postgres-transaction-host-v1.ts` | Creates a sealed scope for mutation commands and exact replay. | No Core-owned current-read scope or host exists. |
| Current authority | `current-authority-postgres-provider-v1.ts` | Resolves the canonical revision, actor, Workspace, permission and entitlement inside a command transaction. | Request schema requires command identity and command aggregate lock. |
| Unit/property selection | `current-unit-property-selector-v1.ts` | AIRPROP-specific command selector for `airprop.asset.read`. | Cannot authorize CE or serve as a generic property read binder. |
| CE Guide provider | `experience-guide-lifecycle-provider-v1.ts` | Validates publish/unpublish and exact replay in Core command scope. | No current content-policy read projection. |
| Replay hook | `transaction-replay-provider-hook-v1.ts` | Revalidates current provider state before exact command replay. | Replay validation is not a general read host. |

Reviewed artifact hashes:

| Artifact | SHA-256 |
| --- | --- |
| `src/lib/core/jurisdiction-profile-selector-v1.ts` | `279c75fc6b0401836fbad5268fcc6ca5b51a16878b2d712f1502adda25b268ad` |
| `src/lib/core/jurisdiction-domain-artifact-v1.ts` | `8ec7d8b4a0d0ef80ffdbb06f48b9c5cb65c0fc8fa5c8b0fd0f42cc0e746fd168` |
| `src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts` | `285770357c485b8cd05121f30f9220d765d4d14ba017066c179b62745c348e69` |
| `src/lib/core/postgres-transaction-host-v1.ts` | `ce0360f30f1c49ff06e8ec944ba7263e0012c56fb2c27e5094d6604a1cf09a6e` |
| `src/lib/core/current-authority-postgres-provider-v1.ts` | `0703bd3a6268a9f86c321e714eb1a28ee791c4bf3c7747865c7576106247334a` |
| `src/lib/core/current-unit-property-selector-v1.ts` | `cf8649d0196c4d87e6bb17a756ab24194faddd1cec382cde97e17c5466c55dcd` |
| `src/lib/community/experience-guide-lifecycle-provider-v1.ts` | `0656476203b0cbefaa0852848f84221924fb2c9c01ff2b83e4bb36dac264822e` |
| `src/lib/core/transaction-replay-provider-hook-v1.ts` | `eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4` |

## Required canonical content domain

The future Core extension must register one public, versioned domain pair:

- domain code: `content.policy`;
- domain contract: `content-policy.v1`.

Registration means adding the domain to the closed Core artifact schema and contract tests. It does
not create a Country Pack row, legal rule, rate, translation, disclaimer, content body or country
seed. An artifact remains bound to exact profile identity/code/version, explicit country, profile
manifest hash, domain code/version, canonical bytes SHA-256, effective interval, lifecycle and
approved reviews. Locale, language, currency, timezone, telephone number, postal-code shape and IP
address are absent from selection inputs and must never infer country.

## Proposed read request

The future exported request should be a strict, versioned value such as
`core-current-content-policy-read-request.v1`. The name is reserved by this contract; no runtime
schema is created here.

| Field | Requirement |
| --- | --- |
| `read_request_id` | Server-generated UUID unique to one read attempt; never an idempotency key or command ID. |
| `request_version` | Positive contract version, initially `1`. |
| `attempt` | Positive bounded attempt number. A PostgreSQL `40001` creates a new transaction and attempt. |
| `context_id`, `workspace_id`, `actor_id` | Explicit and exact. Derived from the verified server session/context, not artifact or locale data. |
| `property_id` | Explicit property source. It must be locked and revalidated in the same transaction. |
| `expected_authority_revision` | Caller-observed revision used only for stale detection. Core reads and returns the current canonical revision. |
| authority profile | Exact `experience.guide.read` / `experience_guides` / `experience.guide.content-policy.read`. No manage-permission fallback. |
| domain profile | Exact `content.policy` / `content-policy.v1`. Arbitrary client domain codes are rejected. |

The request contains no locale, language, currency, timezone, IP address, historical receipt,
command ID, aggregate version, mutation intent or reusable grant.

## Required Core read host and authority binder

Core must own one sealed current-read host rather than allowing a consumer to assemble a scope. Its
scope must be distinct from `CoreTransactionScopeV1`, because that existing type proves command
host invariants. The future read host must:

1. begin one PostgreSQL transaction and bind the verified actor on the same client;
2. acquire canonical Workspace and property/source locks in a fixed order;
3. create the read scope internally with database transaction ID, read request ID and attempt;
4. read and lock the canonical authority revision, Context, membership and Workspace state;
5. evaluate `experience.guide.read` in `experience_guides` for the exact Context and Workspace;
6. bind an ephemeral current-authority observation to the read request and property locks;
7. select the current property jurisdiction and `content.policy` artifact in that same scope;
8. commit only after the result has been schema-validated and all provider queries have settled;
9. retry only a genuine PostgreSQL `40001` in a fresh transaction with a new attempt;
10. execute no durable `INSERT`, `UPDATE`, `DELETE`, ledger, audit or outbox operation.

“Read-only” here means zero durable write. The implementation may use shared row locks to close
assignment/profile races; it must not claim PostgreSQL `READ ONLY` mode while issuing lock clauses
that PostgreSQL disallows in such a transaction.

The authority result is ephemeral status evidence. It must include the current revision,
transaction/read-request binding and `reusable_as_command_authority=false`. It is not persisted as a
command receipt and cannot be passed to the command resolver.

## Current selection and artifact resolution

The future implementation must factor shared private selection logic from the existing command
selector/resolver without weakening their public schemas. Both command and read entry points must
continue to use the same canonical tables, byte parser and SHA-256 calculation.

For a read request, Core must exact-match and hold until transaction end:

- actor, Context, Workspace and current authority revision;
- active Workspace-to-property binding and active property lifecycle;
- explicit property country from its canonical address;
- exactly one active property-jurisdiction assignment;
- exact profile ID/code/version, country and manifest hash;
- exact `content.policy` / `content-policy.v1` row and artifact SHA-256;
- active/effective profile, domain and artifact intervals and approved reviews;
- canonical serialized bytes, parsed schema and recalculated SHA-256.

Missing, multiple, inactive, suspended, expired, superseded, hash-mismatched, revoked,
cross-Workspace or stale-revision state is a bounded denial. A concurrent assignment/profile change
must remain blocked by the held locks or cause a real serialization abort and fresh-attempt retry.

## Bounded result

The future accepted result may disclose only:

- decision, decision/read-request version and `evaluated_at`;
- Context, Workspace, actor and current authority revision;
- property ID and current assignment version;
- profile ID/code/version, country and manifest SHA-256;
- domain code/version and artifact SHA-256;
- artifact effective interval and bounded lifecycle status;
- `reusable_as_command_authority=false`.

It must not disclose an address, postal code, Guide body, document/payment payload, permission row,
membership row, entitlement source row, reviewer identity, private signoff reference, credential or
raw artifact governance evidence. A historical command receipt or artifact reference may be shown
separately as history, but it cannot satisfy this current decision.

## Bounded denial model

The future port must distinguish only operationally useful classes:

- `BINDING_MISMATCH`;
- `AUTHORITY_DENIED`;
- `STALE_AUTHORITY`;
- `CURRENT_SCOPE_DENIED`;
- `CURRENT_PROPERTY_DENIED`;
- `CONTENT_DOMAIN_UNAVAILABLE`;
- `ARTIFACT_UNAVAILABLE`;
- `PROVIDER_UNAVAILABLE`.

These codes expose no row-existence detail across Workspace boundaries. Every denial is zero-write.
Unexpected SQL errors are bounded except `40001`, which propagates unchanged to the host.

## Inactive boundary

This contract does not add code, migration, role, grant, policy, seed, route, provider wiring,
Country Pack data or Production behavior. CE remains fail-closed for jurisdiction-specific Guide
reads. Existing command selection, exact replay and historical evidence behavior remain unchanged.
