# AIRPROP workspace-native underwriting runtime 007

Date: 2026-10-04. Baseline: main e045b88377409a807a47986d0e7cad2615757870,
including shared role expiry #230, independent maintenance UUID correction #231,
and the exact arithmetic/input/retry contract #232. Implementation slice: SQL and
customer GET/POST gateway; UI and production application are separate steps.

## Ownership and existing stores

Reuse `airprop.underwriting_cases` and immutable `underwriting_versions`, inheriting
the exact tenant/workspace from the existing opportunity. No physical subject is
required. Current canonical context, assignment, module activation, entitlement,
taxonomy, deny and AAL2 checks remain authoritative, including every retry.
The AIRPROP private native helper extends its permission whitelist with the already
seeded `airprop.underwriting.manage`; no permission catalogue, role or grant changes.
Reads use existing `airprop.opportunity.read` independently of evaluation manage.

Only AIRPROP API, migration, dedicated tests/workflow and this document change.
The shared test harness `scripts/test-workspace-native-authority-003.mjs` receives
an opt-in `--airprop-underwriting` branch; existing core/AIRPROP/role modes retain
their behavior. This is test coordination, not a shared production authority change.
SERVICE and Operations domain sources and tables remain owned by their other works.

## Mutation and concurrency

`POST /api/customer/v2/airprop/underwriting` uses the strict merged v2 contract,
authenticates the real user, and calls `customer_api.create_airprop_underwriting_v2`.
SQL independently validates direct-RPC input; server derives scope, actor, hashes,
currency and results. Body size, JSON media type and same-origin checks are enforced.
No service-role key or client-supplied actor/hash/result is accepted.

Cases serialize evaluations for the whole opportunity, even when command keys
differ. Lock order matches the actual legacy v1 writer: case row, case advisory
lock, then opportunity row. Current native authority, subject binding, scope and
currency are rechecked after lock acquisition. The immutable command result is
checked before the current-version/lifecycle preconditions; authorized exact retries
return their original version after later versions or lifecycle advancement.
New commands require expected_version=current_version and a draft/qualified/
underwriting opportunity, with an uncancelled case. Version numbers cannot overflow.

Identical assumptions under a *new* key return `CONTENT_CONFLICT`; they do not
republish or move the current pointer backward. This resolves the equal-content
policy left open in contract 006. A new key with stale expected_version returns
`VERSION_CONFLICT` first. An uncertain request must retain its original key/payload.
Versions append; prior assumptions/results/creator/command evidence cannot change.

The immutable version gains three nullable native-only fields: persisted request
key, request hash and original response. Existing versions are untouched. A partial
unique tenant/key index and all-or-none evidence constraint prevent mixed identities.
This uses domain-backed deduplication alongside canonical `platform.idempotency_keys`,
not a second retry store. Removing the shared retry record cannot create another
version or another audit/outbox event. A dangling shared key without its domain
version is an internal recovery error, never permission to create a duplicate.

Case pointer, opportunity status, immutable version, canonical audit, shared
outbox `airprop.underwriting.created.v2` and shared retry response commit atomically.
The event uses underwriting_case identity and evaluation_version. No consumer,
financial ledger posting, acquisition approval, contract or payment is executed.

## Reading and errors

`GET` requires exactly context_id, workspace_id, opportunity_id and optional limit
(1–100, default 50). Duplicate/unknown query parameters are rejected. Versions are
returned newest first, with current_version=0 for no case. The response includes
recorded assumptions/results as decimal text, including historical v1 values;
it exposes neither internal keys/hashes nor creator IDs. Pagination beyond the
bounded history window is not implemented in this slice.

Both methods are private no-store with Cookie variance. SQL failures map to bounded
403 access/MFA, 404 missing opportunity, 409 retry/version/content/state conflicts,
400 validation, or generic 500. Internal schema/error messages are not exposed.
The existing direct RLS policies are unchanged; native data goes through the
authenticated gateway. Private helpers remain non-executable by caller roles.

## Evidence and rollout boundary

Tests apply actual core authority and opportunity SQL, extract the exact canonical
underwriting tables/immutability trigger, and apply the new migration in a disposable
database. Behavioral cases cover subjectless creation, exact arithmetic/hashes,
workspace/tenant/subject isolation, revoked/expired permissions, AAL2, replay after
retention/lifecycle advancement, immutable versions, stale/content conflicts and
rollback after outbox failure. API tests execute the compiled real route.

Dedicated CI also runs real PostgreSQL 17 over independent connections. It observes
case-lock blocking for same-key and different-key commands, tests revocation while
a retry waits, and executes the actual legacy v1 writer concurrently with native
evaluation. Full Database CI must apply the entire migration chain and its existing
pgTAP/advisory checks; the isolated fixture alone is not full-chain evidence.

No remote DDL, production evaluation, new pilot grant or signed-in browser success
is claimed here. Next: three-language evaluation form/history, pending-command
recovery and stale-context isolation, then authorized migration rollout and live
acceptance with an explicitly scoped underwriting role. Existing pilot read/manage
opportunity permissions must not be treated as underwriting permission.
