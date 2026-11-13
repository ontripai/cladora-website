# Listing selected tuple — atomic domain persistence source

Card: AIRPROP-LISTING-NATIVE-01. Parent checkpoint:64399b44d6504ef6ae10bb704ee7e22adbefecb3.
Status: source implementation; adoption/native proof OPEN. Guide is unrelated.

## Concrete change

`mutateListingWithSelectedBindingV1` executes the existing publish/control native
function and inserts a complete immutable selected reference snapshot using ONLY
the supplied `CoreTransactionScopeV1.query`. There is no pool, independent BEGIN,
COMMIT, ledger, receipt generator, network provider or executor. Return value is
`{mutation_id: listing_id}` for the actual existing C03 host; it is not a commit
receipt. All failures escape; the host must roll back both effects. A model of
that rollback is tested; real PostgreSQL/C03 settlement has NOT been executed.

Persisted identity per Listing revision:
- server tenant/Context/Workspace and actor;
- actual Listing id/version, Property, explicit Unit/resource/version;
- selected Party id/kind and relationship id/kind/version;
- actual specification row id/version;
- original host command id/transaction id/key and SHA256 of original wire bytes.

No Party name, evidence/provenance string, token/cookie/credential or raw wire is
stored. This is a versioned domain reference snapshot, NOT an ownership registry
or evidence that the selected relationship is currently effective.

Candidate table: `airprop.listing_selected_bindings_v1`, one immutable row per
Listing revision. Scoped Listing FK and specification/Party FKs, generated join
columns, strict tuple consistency, AFTER-row validation and UPDATE/DELETE/TRUNCATE
rejection are included. AFTER is intentional: generated columns are not available
as final values in a BEFORE trigger. RLS and FORCE are enabled, PUBLIC/anon/
authenticated/service_role privileges revoked. No policy/positive grant/owner
change/default ACL change is supplied. Context is server-resolved, not a fictional
`platform.contexts` table. Existing canonical scope resolution remains mandatory.

A deferred constraint also checks the REAL host's existing
platform.idempotency_keys.response_ref after mutate returns: matching original
command/transaction/key/fingerprint, actor/Context/Workspace, Unit aggregate and
Listing mutation id, plus the same actual audit/outbox receipt links. It requires
the ledger tuple's xmin to belong to this physical transaction (xid32 compared
with the current transaction id modulo its epoch), preventing an old receipt from
authorizing a later backfill. No receipt is generated here; missing/mismatched
receipt fails settlement. This is candidate trigger SOURCE, not installed/PG
proof. Its read privileges on the canonical ledger/audit/outbox require explicit
limited-role review; no new grants are inferred. Host receipt retention/expiry is
unchanged; stored binding metadata alone must never resolve UNKNOWN after the
real receipt is unavailable.

The SQL lives in `supabase/proposals/airprop_listing_selected_bindings_v1.sql`,
starts with an unconditional55000 stop before DDL, and is NOT an installer or
migration. No SQL has been sent to a database. Adoption requires independently
reviewed role/RLS/ACL/host SQL admission and canonical writer coordination; do not
remove the stop or infer callability from source.

## No invented historical selection or spec

Existing DW02 resolver20261019170121 uses greatest(1,coalesce(max(spec.version),0))
for its resource version. That fallback is NOT a specification row. This provider
requires an explicit real spec id/version and verifies its Unit/tenant/Property,
exact current version and existing row identity through a parameterized SELECT
with row locks. No spec row => no write. No currentness lease or timestamp is minted.
The canonical writer's insert/revoke/expiry serialization still needs official
Core producer admission; the row locks alone are NOT a universal DDL/writer fence.

Publication creates binding revision1 only when the existing native publisher
returns a fresh result. An idempotent native reply without an existing Core
receipt is NOT adopted. Existing C03 exact replay must bypass mutate and use the
persisted receipt and current provider validation; UNKNOWN does not enter a new
native publication or create a new binding/key.

Control requires an existing exact binding at expected Listing version BEFORE
the native call. Missing historical binding => LISTING_LEGACY_BINDING_UNAVAILABLE,
no backfill/Party/revision inference. Stored/current tuple or spec drift => denied;
no automatic rebind. Successful edit/withdraw/republish retain the same Listing
id and append the next immutable snapshot. Reads of unrelated existing listings
are unchanged; this provider does not rewrite the accepted independent read path.

## Existing Core port consumption and remaining input

Actual Core source: `src/lib/core/postgres-transaction-host-v1.ts`:
`CoreTransactionProvidersV1.mutate(scope, command)` and
`createCorePostgresTransactionHostV1(...).execute(command, providers)`.
Core checks current authority/providers before entering mutation; scope rejects
transaction control, closes after settlement, and receipt is generated only after
domain mutation. The AIRPROP callback can call:

```ts
// Assign to the existing provider's mutate; no new host/transaction:
const mutate = createListingSelectedBindingMutatorV1(originalPlan,
  (scope, command) => officialListingProducer.recheckSelectedSource(scope, command));
```

`officialListingProducer.recheckSelectedSource` above is descriptive PSEUDOCODE,
NOT a delivered/approved Core symbol. No default-null composition is claimed as
an active producer. The concrete module accepts the existing canonical mapper's
`{request,companion,authority}` plus explicit spec row identity; it reuses
`mapAirpropCoreCompanionV1` and exact tuple joins, never evaluates roles itself.
Only actual same-scope server evidence may supply these arguments.
`createListingSelectedBindingMutatorV1(plan, recheckCanonical)` is implemented and
typed to that exact existing Core mutate port; it passes the identical host scope
and command to the canonical producer and implemented storage mutation. It does
not implement/replace that still-missing canonical producer. A targeted controlled
connection test verifies scope/command identity and unchanged40001 propagation
before any write. There is no storage callback placeholder.

The callback is invoked again AFTER spec/binding query waits, before the native
effect. A controlled late-denial/spec-drift counterexample proves the pre-lock
observation is not reused. The real producer must establish currentness and hold
canonical locks in that same scope; two calls or the name recheck alone do not
prove live revoke/expiry correctness. No Date.now or manufactured lease is used.
When composing real read/action projections, a missing stored binding keeps
independent read available but actions unavailable; canonical permission alone
must not advertise a command this provider cannot safely execute.

Current command composition requirement (AIRPROP domain proposal, not accepted
Core Listing producer ABI): original command/key, manage permission
airprop.opportunity.manage, module airprop_commercial, purpose airprop.b2;
aggregate portfolio.unit/explicit Unit; provider source lock set includes Unit,
Property, Party, relationship and spec ids. Input fingerprint is sha256 of the
unchanged original wire bytes. Identity and canonical lock/evidence producers
must supply these without replacing an uncertain command. No established
Request/Offering/Guide fingerprint or evaluator is changed.

Concrete open inputs:

| Owner | Missing input / integration | Blocks |
| --- | --- | --- |
| Core | Actual Listing request-local identity/current canonical producer, read-compatible selector, command locks and exact source/spec/relationship currentness evidence | Live binding and authorized picker, not this domain SQL/provider source |
| Core + AIRPROP | Review the domain Unit aggregate/source set/fingerprint mapping against actual producer; implement provider-current-state replay hook using real C03 receipt and immutable stored binding | Activation and exact replay disclosure; no invented receipt or accepted ABI |
| Platform | Reviewed adoption of only this candidate storage with limited role/RLS/ACL/closed SQL admission and actual canonical writer coordination | Any DB execution; source is inactive |
| Platform | Exact owned target/build/installed units/Auth/observer/capacity/restart and permitted Chromium path | One real UI/API/DB/reload/restart execution; this chat remains BLOCKED_TOOL |
| AIRPROP | Consume real selector/identity/producer, bind callback and persisted reference read into route; authorized create UI follows actual discovery | Functional final acceptance remains OPEN |
| QA/Coordinator | Independent native evidence review | Product acceptance |

Current route remains fail-closed and old read/control paths are not quietly
enabled. Official Core62f3 adds Guide only; no other domain permission can fill
this missing producer. Next concrete unit is the Core Listing-specific handoff
plus reviewed storage adoption, followed by route wiring and Platform execution.

## Targeted evidence

`node scripts/test-airprop-listing-selected-binding-v1.mjs`: real AIRPROP code,
real accepted canonical mapper, controlled SQL model. Covers fresh publication,
edit/withdraw/republish same ID and immutable version history; missing historical
binding/spec; foreign identity/command/fingerprint; canonical denial/Party/
relationship/resource drift; model rollback after binding insert failure;
SELECT-only missing/corrupt/foreign reads; wrong native result; native replay
without receipt; tampered plan/persistence return and inactive DDL guards.

These tests are NOT actual host/PG transaction, installed trigger/FK/RLS/ACL,
authenticated app, real restart or revoke-after-wait proof. Import-only host
probing was removed after the old local test loader failed on host generics; no
Core source/assertion was changed. Parser is unavailable in the default Python
environment; PostgreSQL parse/compile remains NOT_RUN_NOT_PASS, no tool installed.
Prior successful suites/browser sizing cases were not replayed.

Platform's native case set must additionally check the deferred receipt boundary:
ordinary C03 commit links exactly one binding/native revision/audit/outbox;
missing/foreign/old-transaction or altered receipt rejects settlement; insert or
constraint failure leaves neither the native effect nor binding committed; exact
Core replay invokes no mutate/insert; lost COMMIT acknowledgment remains UNKNOWN
until genuine same-command receipt recovery. These cases are NOT_RUN_NOT_PASS.

Automation: نیازمند بررسی. Mechanical tuple/effect correlation is testable;
real authority, reviewed adoption, explicit user retry and native execution remain
with their actual owners; no automatic migration/backfill/activation is added.
