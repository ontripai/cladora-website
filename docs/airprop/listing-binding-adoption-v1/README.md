# AIRPROP selected-binding adoption packet — same native Listing card

SOURCE_ONLY / PLATFORM_ADOPTION_INPUT / NATIVE_NOT_RUN.
Base/Parent: `6cd4a6a593058da57d0884a13579f6e62cc02afc`.
Approved branch: `codex/airprop-listing-native-01`. No Core/Guide/App/Finance change.

Assignment: [parallel continuation, AIRPROP card](https://chatgpt.com/space/page_9e19234d21b88191b17ef6685d75f153),
Page sequence29 observed2026-11-09. This connection actually read the shared
announcement and AIRPROP card with can_read=true/can_write=false/can_comment=false.
The Page is NOT edited. Central Page registration remains with Coordinator.

## Concrete independent delivery

The existing selected-binding DDL was guarded and its target adoption requirements
were prose-only. Platform now has a bounded **catalog projection** and executable
**offline preflight/verify/recovery comparator** for that precise proposal. This
closes the packet gap, not the missing canonical producer or native product flow.

- `supabase/proposals/airprop-listing-binding-adoption-v1/observe.sql`:
  one read-only transaction, fixed seven relations/seven signatures; target and
  principal metadata, exact columns/default/generated expressions/column ACL,
  PK/FKs/checks/indexes, triggers/deferred state, policy/rule closure, table/function
  owner/ACL/effective privileges, role flags/memberships, scoped default ACL and
  event triggers. No business rows, helper/RPC invocation, raw function body,
  session token, credential or Auth table. Caps:256roles/1024memberships/
  128default-ACL/128event-trigger/32named-overload records; any overflow fails closed.
  Lock3s/statement15s bounds are for this metadata query only, not runtime proof.
- `scripts/prepare-airprop-listing-binding-adoption-v1.mjs`:
  pins seven existing inputs and emits `contract.json`; exports `assessProjection`
  and `recoverProjection` for a **saved, transport-bound private Platform catalog**.
  No DB client, network, SQL dispatch, installation, connection guess or new role.
- `scripts/test-airprop-listing-binding-adoption-v1.mjs`:
  new synthetic-catalog positive/negative controls. Not PostgreSQL compilation,
  RLS/privilege effectiveness, physical constraints/locks or authenticated UI proof.

The old proposal stays BYTE-IDENTICAL, including its first55000. Never run it as
an installer, strip its guard or replay historical migrations to make this packet
pass. No DDL replacement, positive activation grant, RLS policy, owner transfer,
role/membership/default-ACL change, runtime binding or backfill is introduced.
A separately reviewed minimal Platform adoption delta is still necessary.

## Exact object projection and capability boundary

`airprop.listing_selected_bindings_v1` has ten NOT NULL columns, four generated
columns (Unit/Party/spec/spec-version), `(listing_id,listing_version)` PK,
three unique indexes, seven checks and four RESTRICT FKs:

| Child | Parent |
| --- | --- |
| listing_id, tenant_id, workspace_id | airprop.market_listings(id,tenant_id,workspace_id) |
| spec_id | portfolio.unit_specification_versions(id) |
| party_id | portfolio.parties(id) |
| unit_id, spec_version | portfolio.unit_specification_versions(unit_id,version) |

The two spec FKs individually prove existence, not their combined tuple. The
existing invoker trigger also joins the same spec id/Unit/version/tenant, Party
tenant and current Listing Unit/Property/version; current canonical authority,
relationship revision and post-wait checks remain with Core's producer. No
invented relationship table, FK, first-Unit fallback or Property-as-Unit is added.
No Context table or guessed historical Party/revision/spec is created.

The two source-pinned trigger functions remain SECURITY INVOKER with existing
`search_path=pg_catalog`, not definer bypass. AFTER row INSERT/UPDATE/DELETE guard,
BEFORE statement TRUNCATE rejection, and AFTER INSERT DEFERRABLE INITIALLY DEFERRED
C03 receipt check are separately asserted. The receipt check observes the existing
ledger/audit/outbox in the same physical transaction and requires original actor,
Context/Workspace, key/hash/command/transaction/mutation/aggregate identity. It
creates no receipt. Trigger EXECUTE ACL is not itself a row authorization policy.

| Principal/object | Current source contract / remaining adoption |
| --- | --- |
| Table and both trigger owners | UNBOUND: private Platform profile must name actual owner and custody. No source default or transfer; no super/BYPASSRLS owner accepted by this conservative comparator. |
| Table RLS | ENABLE+FORCE; **zero policies** in proposal. This is deny-by-default, NOT a functional runtime policy. |
| PUBLIC/anon/authenticated/service_role | Existing REVOKE unchanged. No direct new SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants. |
| Ordinary runtime and indirect inherited roles | Metadata projects actual effective rights and complete bounded membership graph; dormant source expects no added rights. A policy/grant addition fails this source baseline and needs a distinct reviewed adoption profile/delta. |
| Owner/superuser/BYPASSRLS custodian | Their inherent capabilities are visible; never presented as limited runtime. FORCE RLS does not defeat BYPASSRLS/superuser. Owner membership/custody still needs Platform review. |
| Existing invoker guards | Their caller needs exact existing referenced-table/column/schema reads; declared invoker alone does not establish effective privilege or RLS access. |
| Selected-binding GET | Exact parameterized SELECT needs actual Core read-query admission, current read authority and adopted storage/RLS/role. Missing reader stays unavailable; no new write/audit/reservation. |
| Selected-binding INSERT | Existing C03 mutate scope only, current manage/AAL2 evidence and exact canonical tuple. UPDATE/DELETE/TRUNCATE/history backfill remain forbidden. |

`contract.json` intentionally has owner=null, compiled_catalog=null,
policy_adoption=null and activation=null. Source-only expression/name inspection
cannot prove PostgreSQL's normalized CHECK/generated/index definitions. The
comparator checks known structural facts and exact guard prosrc hashes, but gives
`COMPILED_CATALOG_UNOBSERVED` until a separately reviewed, exact compiled catalog
is available. It does **not** invent deparser hashes or weaken checks to accept a
coherent arbitrary CHECK body. The complete expected catalog is a private
comparison input, not a magic seal or authority; do not create it by blessing the
current unverified target. Platform/QA must bind it to the exact approved source
in an independently authorized process. Even equal metadata returns only
`CATALOG_MATCH_NOT_ACTIVATED`, never runtime READY or native acceptance.

## Platform consumption and settlement protocol

No command below connects or executes SQL:

```sh
node scripts/prepare-airprop-listing-binding-adoption-v1.mjs --check
node scripts/test-airprop-listing-binding-adoption-v1.mjs
```

Import the packet module in Platform's existing runner, passing saved JSON rather
than allowing this module to acquire a target. Its pure functions are:

```js
assessProjection(observed, expectedPrivateIdentity, actualReviewedOwner,
                 acceptedCompiledProjectionOrNull, 'preflight' /* or verify */);
recoverProjection(before, after, expectedPrivateIdentity, actualReviewedOwner,
                  acceptedCompiledProjectionOrNull, 'unknown' /* or commit_ack */);
```

1. Platform alone first verifies the actual owned backend/connection/target,
   limited role/custodian, exclusive window, bounds/capacity and existing mandate.
   Database name/OID/PID or a JSON/GUC value is **not** transport or authority proof.
   Do not transfer credentials, business/catalog dumps or raw logs to public Git.
2. Under that separate permission, collect the read-only projection. Missing or
   unreadable catalog visibility/overflow is a blocker, not “absent”. Save a complete
   private before projection. Validate exact identity and named dependency presence.
   A fully absent selected table+guards is `ABSENT_INSTALL_REVIEW_REQUIRED`;
   partial objects are `PARTIAL_INSTALL_OR_DRIFT`, not an invitation to overwrite.
3. Compare the separately accepted owner/ACL/RLS/FK/guard/compiled profile and Core
   query admission. Missing native publish/control RPCs, current canonical producer
   or necessary invoker rights stop only their dependent path. Do not recreate an
   unrelated module or copy Core writers. A future adoption must repeat preconditions
   in its DDL transaction; metadata from an earlier read alone cannot defeat drift.
4. The current packet supplies **no executable install or COMMIT**. Platform/Core
   must deliver the reviewed minimal adoption delta with installed policy/rights,
   source+preimage/postimage pins and actual writer/quiescence contract. Never
   replace55000 manually. Existing source compilation/execution remains NOT_RUN.
5. After a separately authorized adoption, collect an independent after projection
   on the same owned target and compare complete metadata against its accepted
   successor. OID/owner/ACL/check/generated/index/body/overload/default-ACL/role/
   trigger/event drift stops. Catalog equality cannot prove successful app writes.
6. If install connection/COMMIT ACK is lost, preserve the original transport receipt,
   before projection and ACK/UNKNOWN evidence. No blind DDL repeat/drop/recreate,
   grant repair, receipt fabrication or business-key replacement. Recovery compares
   fresh complete after metadata: mismatch ->STOP; equality with unknown settlement
   stays UNKNOWN; even ACK requires independent verification. Existing business
   journal UNKNOWN, endpoint/body/key/hash and explicit retry are never touched.

## Existing C03/selector consumption, no new producer

Official `selectCurrentUnitPropertyForReadV1` is already consumed by
`listing-native-read-v1.ts`; GET never uses a command receipt. Official request-local
`createCoreListingCommandBindingV1` is already consumed by
`listing-runtime-binding-v1.ts`. Auth ae1 postimage/MFA delta6cd4a6a stay pinned.

`contract.json.action_mapping` records the exact existing publish/control signatures
and positional domain mappings. `prepareListingPublicationV1` supplies publish;
`prepareListingControlV1` supplies edit/withdraw/republish; both preserve original
UTF8 wire and values. The selected-binding mutator shares the identical supplied
C03 scope/command, validates actual Unit/Property/Party/relationship/spec, rechecks
after waits, runs the native domain call and inserts its immutable binding before
Core settles its real receipt. It returns mutation_id only. The actual first
publication is version1; this must never become a default for spec/relationship
history. Edit/control expected_version and original key stay unchanged on retry.

Precise open seams (no fake port/allow):
- `ListingFunctionalDependenciesV1.canonical` / `ListingCanonicalProducerV1`:
  complete versioned Party/relationship, permitted disclosure and terminal time/
  invalidation after waits are still required from Core. Its R2 partial selector
  returns canonical_companion=null; it is not the full evidence or manage allow.
- `command.prepareControl` in `listing-runtime-binding-v1.ts`: original persisted
  command/plan/providers, `provider_current_state_required`, real mapping and replay
  revalidation. No fresh `resolveIdentity`/key/aggregate fingerprint on UNKNOWN.
- publication/create route composition and C03 prepared publication: dependent on
  that genuine producer; this packet does not pretend the current GET/control API
  already supports new creation. Existing selection/control/read stay unchanged.
- Core admission of `LISTING_SELECTED_BINDING_READ_SQL` and exact command/spec/
  binding SQL plus Platform adoption of actual storage/helpers/limited role/RLS.

Core writer-lock proposal97d7a81ea40db5f158fea10ed9ff9e679ca60949 was read directly.
It covers eight named canonical writer entries, requires epoch-first participation
and expressly does not prove arbitrary DDL/admin writers, all wait currentness,
expiry or a full producer. AIRPROP copies none of those writers and reuses no read
SHARE scope to write/upgrade it. The Platform-supplied catalog file was actually
received from this Page connection:46729bytes, SHA256
d8fbe25a86a7271981d3529fb2f02911bbb88c69017abdd6898ede240e372692.
It records metadata2026-11-08T10:51:26.306925Z:publish/control RPC absent. This is
historical metadata only; not a fresh target query/fixture/SQL or installation.
Do not import its private target identity into product defaults.

## Evidence and preserved work

27 new packet source/synthetic-catalog groups PASS; full typecheck, limited lint,
syntax and diff checks recorded in manifest. An added overload guard initially
classified a deliberately partial fixture too early; expected overload calculation
was corrected to actual function presence (assertions retained), then the affected
packet suite passed. No accepted MFA23/7/6, recovery, sizing, Request or native suite
repeated. No SQL parser/PG compilation executed:NOT_RUN_NOT_PASS; actual effective
RLS/ACL/constraints/locks/commit/restart, Auth/native API/UI likewise NOT_RUN_NOT_PASS.
Actual cache:Next16.3.8/Zod4.4.3/TypeScript5.9.3; target16.4.1/4.6.6 not installed.

Automation: نیازمند بررسی — deterministic source pins and metadata comparison can
be mechanized; disclosure/manage policy, target/custodian/adoption and real native
acceptance remain Core/Platform/QA/Coordinator responsibilities. No new engine or
execution authority. The whole native Listing card remains OPEN; first independent
source delivery does not wait for Guide, valuation, scanner or other domains.
