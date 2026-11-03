# Core Service real-app assembly v1

Task: CORE-SERVICE-REAL-APP-ASSEMBLY-17, including INSTALLER-CREDENTIAL-BINDING.
Base: `29ed18541c602dae4e6db5c98a96201250af630b` (main).
The containing Git commit is the source identity; the external delivery receipt
records its exact FullSHA/Parent. This is an owned-development assembly, not a
public activation, staged installation or complete browser product acceptance.

## Consumer contract (SERVICE / Antigravity)

Use **http://localhost:3008** as the application origin. The server binds only
127.0.0.1. Next normalizes loopback origins; do not change the origin guard to
accept a different write origin. Sign in with the existing official Supabase
client against this run's own real Auth, then satisfy real MFA. Synthetic test
accounts/factors must already belong to this owned instance; no email, password,
factor secret, token or session is in this contract.

| Step / endpoint | Exact input | Response / rule |
|---|---|---|
| GET `/api/customer/v1/services/assembly-bootstrap` | No query | `{contract_version:'core-service-app-read.v1',selections:[...]}` |
| GET `/api/customer/v1/services/catalog` | Exactly context_id + workspace_id UUIDs | `{offerings:[...]}` canonical published catalogue fields |
| GET `/api/customer/v1/services/requests` | Same two UUIDs | Existing `serviceRequestReadSchema`: can_request, beneficiaries, requests |
| GET `/api/customer/v1/services/offering-request-flow` | Same scope + offering_id + published_revision_id | Existing real provider preflight |
| POST same flow endpoint | Existing `serviceOfferingRequestPublicInputV1Schema` | Exactly `{request_id,status:'submitted'}` after existing C03 host success |
| GET requests again | Original scope under current authority | Includes the same Request ID if still readable; not a COMMIT receipt |

A selection contains actual context_id, membership_id, tenant_id, workspace_id,
tenant_name, role_code, role_name, workspace_type and environment. It is discovery
only. Show the real selections and require an explicit choice. Do not guess the
first workspace or promote the tenant/member fields to request authority.
Server scope is resolved afresh; actor/session come from official server
getUser/getClaims and current database session, never JSON or user_metadata.

Catalogue fields are the canonical SQL projection, not a new Offering producer:
offering_id, revision_id, localized labels/description, acquisition_mode, price,
valid_from/valid_until, cancellation_terms, acceptance_criteria. The assembly path
does not add fabricated missing fields or a product-capability allow. Other
profiles retain the old GET behavior. Existing POST implementations are untouched;
non-reservation Request must use the C03 flow, not a legacy fallback.

The tested Request is workspace-wide/non-reservation with resource=null. S01
agreement/disclosure and current command permission still gate it. This does not
create an Order, accept a quote, authorize payment or enable resource-specific
DW02/Unit requests. Those product domains are not removed from v1.4.

Each new read uses the existing Core authenticated lease: SERIALIZABLE,
lock-capable, canonical permission and session checks, positive ROLLBACK, then
same-backend server completion clock. No reservation, audit/outbox or domain
write is used to simulate reading. The three admitted read kinds are closed;
no caller query/callback/allow/time is accepted. C03 host/evaluator/S01 are reused.
40001 stays the original object through the trusted read port; the HTTP boundary
maps it to SERVICE_CONFLICT/409. Timeouts/cancellation/unavailability cannot
become a successful read. Scope denial is403, missing verified session401,
invalid query400 and unavailable configuration503, without private details.

The discovery routine locks the existing canonical epoch and actor's candidate
Context/member/workspace rows, uses the existing resolver/evaluator, then rechecks
all returned tuples after the last row wait. The two facades execute under the
same bound scope; the lease rechecks after their waits and before settlement.
Returned data is an observation at the guarded transaction, not a capability
lease valid through client delivery. No universal deferred/implicit COMMIT-wait
or currentness-through-ACK guarantee is added.

Keep original key/body and unresolved state on UNKNOWN. Explicit retry must use
that same command; a current Request GET is not proof of the old POST. Changed
body or authority/source drift does not authorize a new key or historical-success
inference. No retention/purge/cancel policy is introduced.

**UI boundary:** Core supplies these real reads and the existing command seam.
The global CustomerContextProvider/dashboard and workspace-target RPC path are
not replaced with fabricated dashboard state. Antigravity/Service must bind the
product entry to this bootstrap/selection contract (or an independently accepted
shared-shell adapter). Core's HTTP/DB evidence is not browser integration proof.
No frontend-owner files were changed.

## Official production-build profile

`node scripts/run-core-service-app-assembly-17.mjs build`
then `node scripts/run-core-service-app-assembly-17.mjs start`.

These use installed Next16.4.1's actual build/start, not next dev. NODE_ENV is
removed from the child override so Next selects production normally. No framework
or node_modules patch. The named profile is
`core-service-real-app-assembly.v1`; both the server profile and explicit public
owned-local marker are required. Only exact Auth origin127.0.0.1:55421 is accepted
in this production profile. External browser host, Vercel flags, missing markers,
wrong private file/hash/owner/mode/target all fail closed. The existing hosted URL
contract and development/test profile remain unchanged.

The launcher checks owned Platform12 custody and both exact unit receipts/hash
identities. Build receives only local browser-safe selectors, not the runtime
binding/password. Start receives a private 0600 runtime-only file selector and
hash. Staging/admin selectors are removed only from the application child;
proxy/CA/guard variables stay inherited. No .env file or persistent environment
configuration is changed. CSP adds only that Auth loopback origin, only for the
named profile. The ordinary app role has no owner membership or Auth table read.

## Explicit installer credential binding v1

Official producer: `run-core15-service-native-v3.mjs prerequisites ...`.
After actual COMMIT/RFQ I and poststate observation it issues
`core15/service-native-v3/installer-binding.json`, contract
`core-installer-credential-binding.v1`, profile
`platform12-owned-development.ordinary-installer.v1`, generation **v3**.
The file points only at v3/installer-secret.json and pins its bytes, producer
receipt and session-bootstrap provenance to the accepted backend/OID/ordinary
installer. No password is embedded in the binding or public manifest.

`loadInstallerCredentialBindingV1` requires an explicit generation, exact binding
file and accepted target. It checks version/profile, target, fixed path, file
identity, committed producer/session provenance and custody before a consumer
constructs a connection. Files use O_NOFOLLOW, one link, current owner, private
mode and private ancestor directories. Password is non-enumerable in the returned
operator object. There is no exists-based v2/v3 choice or path scan.

The current already accepted run is **historical-v2**. Its credential and evidence
stay where they were; no file was copied into v3 or a historical path fabricated.
An explicit metadata binding at core17-historical-installer-binding.json pins the
real accepted v2 receipt and the same session/target. It is not a fresh-v3 witness.
Current native/domain ordinary-unit CLIs intentionally require the explicit binding; old bare invocations are not silently reinterpreted. To continue an accepted historical target, select historical-v2 and its bound receipt. The old fixture CLI remains explicitly historical; its domain body is
byte-identical and unknown new CLI arguments are rejected. The new versioned
fixture wrapper validates a binding before importing/executing the shared body.

### Platform continuation: existing target

Do not reinitialize stack/users or replay successful SQL. Inspect the existing
receipts, source hash and actual target. In this run the historical binding was
already issued/verified and both new units committed. Do not rerun one-shot tools.
For a separately authorized continuation, the explicit forms are:

```
node scripts/bind-core-service-installer-17.mjs historical-v2
node scripts/verify-core-service-installer-binding-17.mjs historical-v2 <exact-historical-binding-file>
node scripts/run-core-service-assembly-17-install.mjs catalog-compatibility historical-v2 <exact-historical-binding-file>
node scripts/run-core-service-assembly-17-install.mjs read-access historical-v2 <exact-historical-binding-file>
```

The binding issuer is metadata-only, exclusive-create. Unit order above is the
correct fresh order; actual historical read-access committed before the missing
compatibility edge was diagnosed and added. No receipt was rewritten as though
the corrected order had already been rehearsed from empty state.

### Platform continuation: genuinely fresh owned target

1. Materialize exact accepted Platform12 source and a new owned synthetic backend,
   with independent collision/custody checks. Another agent's localhost is not
   your target. Use existing accepted Core15 session04/05 and exact Core300
   Foundation/profile; do not replay Maintenance/Building/Storage or all migrations.
2. Generate the selected native payloads from the official Core300 source pins.
   Run prerequisites once. This creates **v3** secret + committed binding.
3. Subsequent ordinary native units now require explicit generation/binding:
   `run-core15-service-native-v3.mjs foundation --accepted-source <source300> v3 <v3-binding>`.
   Do not run the other three units for this cut. Assets in the prior run is
   incidental, not a Service prerequisite.
4. Follow existing eleven-unit domain-manifest order. Ordinary domain units:
   `run-core15-service-domain-v1.mjs <unit> v3 <v3-binding>`.
   The fixed session-owner/owner-EXEC units use their separate custodian lane and
   take only the unit name; installer/runtime/custodian are not interchangeable.
5. Materialize the existing private runtime binding after the access unit. Apply
   this task's catalog-compatibility and read-access with explicit v3 binding.
   No historical migration ledger entry is fabricated.
6. Use existing real synthetic Auth users/MFA only once, then the new fixture
   consumer: `prepare-core-service-synthetic-fixture-v2.mjs v3 <v3-binding>`.
   Apply the test-only catalog role/module/entitlement addon via
   `prepare-core-service-assembly-17-fixture.mjs v3 <v3-binding>`.
   The old fixture entry is not the fresh-v3 consumer. On an existing fixture,
   do not rerun genesis; use preserved receipts/current authority.
7. Build/start with the official profile; UI consumers use the contract above.

Fresh-v3 credential consumption has controlled positive/negative proof. A new
empty backend installation of this complete recipe has **NOT_RUN_NOT_PASS** in
Core17. Do not convert those tests into a native install claim.

## Roles, closure, recovery and evidence limits

Runtime is `cladora_core_runtime`, ordinary/no privileged memberships, fixed
private Pool. Installer is the actual ordinary `cladora_core_installer`, distinct
from Platform lifecycle postgres. Existing Auth-owner delegation is unchanged.
The new grants are only three read-function EXEC edges to the dedicated runtime;
no authenticated/anon/service_role positive grant, public schema exposure,
provider-role mutation or default-ACL change. Managed Auth/RLS and guard300 remain
unchanged. The compatibility body comes exactly from existing canonical
`20261004083750_20261004083058_service_catalog_registry_compatibility_v1.sql` and
preserves explicit compatibility decisions; no evaluator rule is changed.

One transaction per additive unit. Mismatch/timeout/cancel/unknown COMMIT stops
before another dispatch. A later rollback cannot undo attempted COMMIT. No blind
retry, IF-NOT-EXISTS repair, receipt seed or repair-as-applied. Recovery first
stops the named app profile, preserves business data/receipts, and inspects
same-target metadata. Restore only demonstrated preimage ACL/objects; if before
state or settlement is unknown, STOP for reviewed reconciliation. Never use a
blanket down migration to delete Requests, Auth users or shared foundation.
Default environment is not activated by this profile's existence.

Manifest contains source/payload hashes, before/after inventory and safe witness
hashes; raw receipts/backend IDs/cookies/logs stay private. Browser UI, independent
review, clean install, a fresh-v3 native rehearsal and any staging/Production
execution remain distinct gates. Existing Core15 proofs were not rerun or relabeled.

Automation: نیازمند بررسی — source pin and binding/custody validation can be
mechanical; Coordinator/Platform retain target approval, fixture authorization and
installation decisions. This classification creates no execution permission.

## Scoped source review R1 (F01/F02)

Reviewed Parent: `686475cc9606888f41b46ffd7a0ef544484b6b30`.
The launcher now constructs both build/start child environments from a closed
OS/proxy/CA/host-guard allowlist in
`scripts/lib/core-service-assembly-environment-v1.mjs`. Runtime network-guard
preloads (`NODE_OPTIONS`), module resolution, TLS trust, deployment rejection
markers and existing session proxy settings are preserved. Inherited application,
GitHub/cloud/database credentials and unrelated public/private selectors are not
copied. Only the validated local profile adds application selectors; build still
receives neither the runtime binding selector nor its digest. No real inherited
secret was printed or inspected for this review.

Each private runtime access revalidates selector, profile, custody, digest,
platform and target before using its cache. An absent selector returns no binding
and no read runtime, including after warm-up. Invalid inputs fail before factory
use. A valid changed identity (including digest/target or mode/profile) throws
`CORE15_PRIVATE_BINDING_RESTART_REQUIRED` before reusing the pool. Restart under
the newly validated configuration is the supported identity transition; an old
pool is never silently relabeled. This check does not revoke previously leased
transactions or replace their existing session/current-authority checks.

Run only the affected review checks:

```sh
node scripts/test-core-service-assembly-review-r1.mjs
node scripts/check-core-service-assembly-17.mjs
```

The manifest preserves native receipts/source pins at the reviewed Parent.
Those receipts are historical evidence, not native proof of this source revision.
Fresh-v3 complete installation, browser product acceptance and a new native run
of this revision remain `NOT_RUN_NOT_PASS`.
