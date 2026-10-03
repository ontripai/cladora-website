# CLADORA SERVICE catalogue persistence 002 — v1.0

Decision: CLADORA-ARCH-SERVICE-CATALOG-PERSISTENCE-20261003-01

## Scope and ownership

SERVICE owns the new `service_catalog` schema, its three `services.catalog.*` permission definitions, the `services_catalog` module and its bindings, the new customer catalogue gateway, tests and this document. No existing AIRPROP, Operations, financial, document or authority implementation is replaced. Base: main `3134b209a57f21c62227dc227d78c5c9ff8bedf2`; open PR collection was empty before implementation.

Shared dependencies are the existing canonical tenant Context resolver/native permission engine, parties, workspace/module registry, audit, outbox and idempotency tables. No role grant, module activation, entitlement, taxonomy compatibility or local-role assignment is automatically created. Empty compatibility/activation/authority denies access. Catalogue registry presence is not an active customer product.

## Behavior

`service_catalog.definitions` scopes service definitions to exact tenant/workspace. Offerings point to canonical provider parties and immutable commercial revisions. Current editing revision and published revision are separate pointers with composite same-offering/workspace/tenant foreign keys. Amounts remain exact decimal strings; SQL validates localized texts, supported currencies, validity, acquisition and price shape. JSON cannot change in place. Lifecycle metadata is separate from the immutable commercial payload.

`customer_api.mutate_service_catalog_v1(kind,request)` implements create, revise and transition. It derives the actor from `auth.uid()`, resolves the exact native Workspace and checks current effective module permission before retry handling. Publish requires `services.catalog.publish` and an actor different from both creator and submitter. Normal draft/transition operations require `services.catalog.manage`.

SQL computes a trusted SHA-256 fingerprint over tenant, actor, kind and JSONB request; it never accepts a client fingerprint. Namespace `service_catalog:sql_v1:<workspace>:<kind>:<key>` is intentionally distinct from the earlier TypeScript planning descriptor. PostgreSQL JSONB canonicalization preserves semantic object-key order, but the SQL fingerprint does not claim byte parity with the TypeScript descriptor. Differently spelled UUIDs or timestamps may conflict on the same key. Exact gateway retries preserve their validated request representation.

The canonical `(tenant_id,key)` unique insertion and row lock serialize competing claims. Actor/content conflicts and expired claims reject. Exact retry returns stored response only after current authorization. Offerings are locked before expected-version comparison; stale writers reject. Mutation, revision, audit, outbox and stored retry response commit together or all roll back. Claims expire after seven days; after a separate cleanup deletes a claim, its key is no longer a replay guarantee. No cleanup worker is added here.

The read RPC exposes only published currently valid selected revisions for the requested Workspace, with active definitions and non-archived provider parties. Future revisions are hidden and the end instant is exclusive. Projection omits tenant, actor, provider contact and document fields. Raw tables and internal helper functions are not customer/service-role APIs; RLS is enabled with no public table policies or grants.

`/api/customer/v1/services/catalog` GET requires exactly one context/workspace pair. POST accepts a strict `{kind,request}` envelope, validates the existing shared catalogue schemas, checks authentication and origin/JSON content, and calls the canonical SQL RPC. Errors are bounded codes; database details are not returned. All responses are private and non-cached.

## Validation and remaining delivery

Locally executed: actual migration in isolated PGlite PostgreSQL; 31 storage/lifecycle/retry/rollback/ACL scenarios; 28 actual Next route gateway tests; existing 90 catalogue contract cases; native authority regression and application typecheck/unit suites. Full clean migration-chain and separate-socket race tests are CI requirements, not local PGlite claims. Dedicated CI additionally runs PostgreSQL 17 with two independent connections for identical claims and competing expected versions.

This is a persistence/API delivery slice, not completion of SERVICE. No remote write or production certification is performed here. Production still reported 184 migrations at the start of this work; the three Oct 3 shared authority migrations must be coordinated before this migration is applied. Definitions and native role/module provisioning need audited UI/commands before an end user can create an offering. This slice supplies no definition issuer, provider onboarding, management UI, order/reservation/reception/benefit runtime or email.

Document version links remain blocked explicitly in both SQL and gateway (`DOCUMENT_LINK_CONTRACT_REQUIRED` at the gateway). A document UUID's tenant match alone cannot authorize sharing a document with a Workspace. The canonical secure document-link contract must be integrated before attachment support is enabled. No scanner, vault or document permission is bypassed.

## Change log

- v1.0: isolated catalogue storage, immutable versions, selected publication, separate approval actor, atomic canonical retry/audit/outbox transaction and authenticated gateway; bounded local and independent-connection CI verification.
