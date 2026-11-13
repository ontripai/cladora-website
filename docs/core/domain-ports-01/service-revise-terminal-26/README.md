# Core26 — same-host revise terminal / canonical replay

Core parent742d3ef9203c8135b56e45a941a3f664f09f097e; same branch/card.
Effective SERVICE0f876064025c3073eb13dcbb53aba6377fadbe43, Parent e2c8d7ba18be7abc578d9127e74a89483a1c0049,
Tree472f1b3064fb041048526dfe7ec17dcc2e05cef5. The combination is exact Core source
plus actual SERVICE postimages; it is not a merged/deployed App or installed target.
Public runtime and permit remain NULL. No SQL/parser/PG/Auth/install/activation ran.

## Inputs and effective pins

Official SERVICE0f876 bundle blob f94be3f49f274980bba6e4e2f34b30d9f342b5ad:
10222 bytes; SHA2562a85aba5e8f46af4141959f57d58f8981c75135b9d5ceb80973dfbb3881cca65.
Only prerequisite e2c8; its actual Page bundle was verified/imported first, not
reconstructed from a title or local archive. Head/Parent/Tree, delivery and packet
Git identities and all12 delivery payloads were checked. source-review.json seals
12 actual final files and FOUR whole function definitions, including the new
service_offering_revise_assert_current_v1 helper. No a988/e2c8 pin is final admission.

The final source has explicit non-NULL checks for all five effect metadata columns,
uses runtime.reviseSource and calls Core25 after the writer await. Replay143's
mutation/receipt comparison remains. These are source observations; independent QA,
PostgreSQL compile and installation are not inferred or marked PASS. SERVICE owns
all domain SQL/body/constraint/factory logic; Core edits none of those files.

## Exact consumer ABI

Server-only explicit method on the EXISTING C03 host and official functional runtime:

```
const runtime = createCoreFunctionalCommandRuntimeV1({
  ...acceptedServerOptions, offering: null, agreement_family: 'revise'
});
const binding = createServiceOfferingCoreReviseProviderV1(canonicalOriginal, runtime);
const result = await runtime.host.executeServiceOfferingReviseV1(
  binding.command, binding.providers, canonicalOriginal
);
```

SERVICE's actual factory is at the exact effective SHA above. canonicalOriginal is
the immutable canonical domain command from preparation/custody, not raw browser
JSON or a newly synthesized recovery body. Core checks its complete wire/hash against
the original Core command; it never rewrites actor, authority, IDs, key, fingerprint,
terms or TTL. Passing data to this method supplies comparisons, not authority.
Auth still comes from the official server SDK, scope from canonical resolver and
C01/S01 from database sources. No caller allow/verifier/clock callback exists.

The legacy generic execute path rejects the revise family without this explicit
entry. Other operations/families retain their existing path; no new generic-purpose
host or receipt/ledger engine exists. The method itself is a source capability,
not global registration or activation. SERVICE request/route adoption is a separate
review against this ABI and the integrated source identity.

## Query / phase / argument / result boundary

- Provider scope has22 EXACT query literals from seven pinned Core/SERVICE roots.
  No raw SQL/object/multi-statement/schema/target choice exists. Arity and Context,
  Workspace, tenant, party, agreement/version, source head/revision and permission/
  module arguments are checked before transport. Time-shaped intermediate parameters
  are not treated as current-authority proof; final time always comes from DB.
- The volatile write SELECT is MUTATION only. Readback is read-only, with the
  strict actual SERVICE writer-request/command/fingerprint and canonical scope tenant.
  C03's own ledger/audit/outbox/wire queries stay engine-internal, never admitted to
  providers by the 22-query profile. Unknown SQL/family/scope/args fail closed.
- Terminal scope admits only THREE Core-fixed SELECT statements: effect row FOR
  SHARE; actual SERVICE readback; combined currentness/ledger observation. It cannot
  issue business DML, reservation, receipt, audit/outbox or independent transaction.
- Core24 strict command/query/result validator is reused byte-identically. Readback
  must match command/new revision/version/head and receipt.mutation_id. Result shape
  alone, callback output, GET or caller receipt JSON cannot prove persistence.

Terminal parameter/result shapes (no arbitrary function/overload):

| Statement | Parameters | Required result |
|---|---|---|
| effect FOR SHARE | tenant, Workspace, new revision UUID (3) | one strict row: id/offering/version/mutation/key/fingerprint/full original body/head version |
| domain readback | strict writer request JSON (1): contract, tenant, original command, fingerprint | one result with exact6 writer-result fields; terminal NULL is denied |
| final combined observation | Context, Workspace, tenant, actor, original authority revision, Party, agreement/version, canonical key, Core request hash, matched receipt JSON (11) | one strict11-field observation with same PID/DBtx/actor/scope/revision, true matched-unexpired receipt and precise UTC server instant |

The full domain effect is real source-reviewed: one new immutable draft revision,
conditional advance of exact current head/version, no implicit publish/old revision
rewrite. Core7e's expired/future OLD commercial window policy is unchanged; exact
current draft/submitted head, new terms and valid current S01 remain necessary.
Other read/publish families are not relaxed.

## Last waits / final observation / settlement

Fresh flow remains one C03 backend/transaction: canonical Auth/scope/authority,
S01 and source validation -> existing reservation -> actual SERVICE writer and
Core25 checkpoint -> existing audit -> outbox -> receipt clock -> receipt UPDATE.
Then the provider's raw scope closes permanently and pending work drains. Core:

1. FOR SHARE locks the actual new revision's effect row in the same tenant/Workspace.
   Full immutable original body/key/fingerprint/command/effect IDs and versions
   must match; the actual SERVICE readback must agree.
2. Invokes the fixed real SERVICE currentness helper. It locks Party/Workspace/S01
   head/version and samples real server clock AFTER its lock waits, then uses the
   accepted canonical session/Context/member/permission/entitlement fresh-time ABI.
3. The same final SQL returns actual PID/DBtx/actor/isolation/selected Context/
   Workspace/tenant/member/authority revision plus exact canonical ledger response,
   actor/request hash and stored expiry compared to that server instant.
4. Core seals command/scope/attempt/backend/DBtx, receipt/effect/observation hashes
   and EXACT response bytes. Only raw COMMIT follows, on that backend. A positive
   raw CommandComplete COMMIT is required before publishing success.

The official runtime previously ran extra checkpoint/principal queries immediately
before COMMIT. The new PRIVATE transport handshake moves these potentially waiting
checks BEFORE the final combined observation. It forbids another query after sealing;
no post-observation principal query silently invalidates S01. Unknown/unregistered
transport fails before BEGIN; other families' wrapper behavior is unchanged.

The last currentness point is the server instant returned by that final combined
SQL, before raw COMMIT dispatch. Participating row/session/epoch barriers stay held
until settlement; native participation still needs Platform proof. No guarantee of
unchanged authority/expiry through client ACK/delivery/display is made. Natural time
can advance while COMMIT itself waits. This source does not redefine SERVICE policy
or assert expiry validity at durable COMMIT; stronger temporal acceptance than this
last observation remains an explicit acceptance gate, not a fabricated clock/TTL fix.

Every query/await/error/retry invalidates an earlier internal seal. Raw provider
scope, copied JSON, a boolean or callback cannot re-seal it. Closed result metadata
is recognized only on the EXACT host-issued object by coreServiceReviseTerminalInfoV1
and exact bytes by coreServiceReviseTerminalResponseMatchesV1. It is historical
completion/as-of evidence, not a reusable current permission, projection or token.

## Canonical matched replay

Existing C03 locks/reads its canonical ledger, validates original actor/key/request
hash, full stored receipt/subject/provider/command bindings and DB-clock expiry.
Only then does actual SERVICE replay143 read the persisted exact domain effect and
compare its mutation with canonical receipt.mutation_id. After provider/clock/expiry
waits, Core locks the real effect row again, compares the full original command,
readback and exact stored receipt, then runs the final combined current S01/C01 /
ledger-expiry observation. It uses no Core25 writer-only WeakMap, never reconstructs
one from JSON and never asks an advanced old head to be current again.

Positive replay settles by ACKed ROLLBACK; it is not a new COMMIT. Zero mutation,
receipt minting, audit/outbox or TTL renewal occurs in that branch. Original wire
and historical authority revision stay fixed; current revision mismatch stays closed.
Missing/malformed/expired/mismatching effect/receipt or current denial cannot turn
into an accepted response. UNKNOWN never creates a replacement identity.

## Failure and recovery

Before COMMIT, a failed premise requires rollback; only known settlement supports a
known denied result. Raw-scope drift, pending/backend error or late query invalidates
the observation. First error is retained through cleanup. Exact40001 goes to the
existing bounded C03 loop, with no new retry engine. After COMMIT dispatch, only an
exact raw PG40001 associated with that raw COMMIT can prove its serialization abort;
a backend event with the same code cannot. Unknown rollback stops automatic retry.

Lost/malformed COMMIT ACK, lost replay ROLLBACK ACK, unknown cleanup/settlement =>
UNKNOWN/READBACK_REQUIRED, no closed positive metadata and no blind resend. A cleanup
ROLLBACK cannot undo an attempted unknown COMMIT. Positive raw ROLLBACK tag is never
success. Synchronous cleanup failure cannot leak an earlier positive result.

Recovery uses the SAME original command/key/body/actor/authority/IDs/fingerprint with
current Auth/scope rechecked, canonical C03 lookup and exact read-only replay. No
repair-as-applied, current GET inference, new key, TTL extension, data compensation
or automatic installation occurs. Installed/business committed data is not rolled
back by source recovery. Target/native recovery must use Platform's admitted lane.

## Verify / installation gates

No Core SQL or new SQL helper is introduced. Platform must use the EXACT final
SERVICE0f876 packet, not historical a988/extraction or an arbitrary overload. Its
pinned preflight/install/verify/recovery are referenced in source-review.json;
ordinary target owner/grantor, exact function definitions/config/volatility/ACL,
closed roles/default privileges, RLS, effective column row-lock rights and all
trigger/writer/invalidation paths must be independently established.

Extra final effect SELECT/FOR SHARE and the currentness helper require precise
existing/new rights, not a public grant or definer fallback. Core fresh-time13-helper
source identities are reused from the existing20 record, not rebuilt/retested and
not treated as installed proof. No target/schema/credential assumption is filled in.
CE6adb/correction103 and both CE safety contracts/bodies remain untouched; Platform
owns implementation/role/lease and Core reviews compatibility after actual delivery.

Before activation: source/integrated application pin and loader/adoption; exact
native object/helper/role/RLS pre/poststate; PG17 compile; two-session revoke/expiry/
concurrency, same-key one effect, actual unknown settlement and restart persistence;
capacity and independent QA/Coordinator acceptance. All native gates remain open.

## Reproduce this source delivery

```
node scripts/check-core-service-revise-terminal-source-v1.mjs
node scripts/check-core-service-revise-terminal-types-v1.mjs --proof=/tmp/core26-types.json
node scripts/test-core-service-revise-terminal-v1.mjs
```

Requires the actual SERVICE0f876 Git object and prerequisite chain, not local-only
archives. Input blob identities and exact source pins are in source-review.json.
The full ES5 composition overlays15 ACTUAL SERVICE TS postimages virtually, including
an explicit real factory -> Core entry assignment, and loads REAL Core custody.
No owner file is copied/edited and no import/provider/type dependency is mocked.
Installed Next16.4.1/Zod4.6.6 and existing lock are used without dependency changes.

Controlled tests run actual Core host/runtime/transport and actual SERVICE factory/
provider/writer with modeled SDK/PG. They are not SQL execution/compile, target
role/RLS proof or durable native persistence. Healthy24/25, SERVICE suites, clock,
CE/Request suites are NOT rerun. Source checks verify protected CE terminal bodies
and Core24/25/S01/7e policy bytes instead. Inventory, checks and artifact transport
identities are in the manifest/external delivery.

Automation: نیازمند بررسی؛ exact source/typed coupling/late-wait negatives are
repeatable; authority participation, temporal acceptance, target rights, installation
and native QA require the existing owners/Platform/Coordinator, not auto-execution.
