# CORE-SERVICE-S01-SOURCE-CLOSEOUT-02

Base/direct parent `681a3743ff49c48adc00a737d59d2b5a4c848c04`.
Decision/finding: [6574525414](https://github.com/ontripai/cladora-website/issues/463#issuecomment-6574525414).
**Source closeout for review; runtime binding NULL; SQL/native proof NOT_RUN.**
Previous reports and Base evidence remain historical. D01 architecture and D02
operational date/disclosure designs are CLOSED_OWNER_DESIGN, not pending owner
permission. This does not mean DDL installed, native writer safety proved, or a
real session/authority observed.

## Finding: exact before/after evidence

```
node scripts/review-core-service-s01-producer-01/test-producer.mjs --prove-predecessor
node scripts/review-core-service-s01-producer-01/test-producer.mjs --closeout-only
```

The first command loads only the reader from the exact predecessor Git object,
not a hand-recreated bug. It reproduces independently: during the second
canDisclose await, invalidate session; separately deny canonical authority while
still returning disclosure. Each returns effective and its post-wait Core log
contains only clock. The allowed control also passes. Three targeted checks only;
old30 suite is not replayed.

The after command runs16 new/affected checks. After the last disclosure/source
wait, the reader invokes the unmodified canonical authority provider+binder and
session helper again. Its final same-scope SQL observation uses the **existing**
canonical evaluator and session helper, plus current authority revision, DB XID,
actor, isolation and fresh server UTC clock. Permission is not cached; a clock
alone cannot replace authority. CTE materialization and returned session_guard
keep the session helper in the observation. Denial is redacted; missing/malformed
observation and non-allowlisted errors are unavailable. Scope/attempt/transaction
and final actor/revision mismatches cannot disclose. No async operation follows
this observation before pure output/date validation.

Both formerly successful invalidations now yield withheld. Positive control,
source absence, timeout, final binding mismatch and expiry are covered. A later
server clock checks both agreement date validity and the exact Offering's timestamp
interval. Unrelated scope codes are filtered from the response. A newer agreement
version outside the exact Offering binding is withheld rather than leaking its
version or dates; the old disclosable-stale-version behavior is superseded by the
new source-bound disclosure decision. Public v1 response variants are unchanged.

These are controlled transport observations. SERIALIZABLE source, existing
session-helper snapshot semantics, all writer/invalidator participation, expiry,
40001 and final backend settlement still need native two-connection proof. No
currentness-through-COMMIT/ACK/delivery guarantee is inferred from these mocks,
clock reads or SERIALIZABLE alone. The existing host owns rollback/UNKNOWN/retry;
no new evaluator, transaction host, ticket/receipt engine or connection is added.

## Exact SERVICE source consumed, without a second reader

Accepted coupling successor: `4c0dcc075797ce8fc08d0e80ddb531370ebfc46f`,
confirmed by the coordinator's explicit update for this task. Module
`src/lib/customer/service-offering-disclosure-source-v1.ts`, Git blob
`894aa9ce5428d7c4215acb959ff18851dcca721d`, SHA256
`b450d50f1dcac9bb83b5d29c9984cc2646b20093485e93252d6bacca1297cbaf`.
The module is byte-identical to e6e33; consumer catches changed. Actual SERVICE
preflight and provider/replay modules are loaded from the same accepted4c FullSHA,
not copied or edited in Core. The controlled harness checks the actual source
hash and Git identity and the unchanged shared Core ABI files before loading.

Core's `offering-disclosure-policy-v1.ts` delegates to the actual
`projectServiceOfferingDisclosureSourceV1` for the strict full binding witness,
and the actual `createServiceOfferingDisclosureCanDiscloseV1` callback for the
final disclosure decision. Both come from the same pinned owner module. No
SERVICE SQL, second Offering reader, registry, provider source-port or retry
engine is copied into Core. The full witness preserves provider/version/expiry
and NOT_READY distinctions that a flattened boolean cannot prove alone.

The binding fixes the selected Offering/version, published revision/version,
provider, agreement/version, Context/Workspace, exact scope and permission.
It is supplied by trusted server composition, not public request flags. SERVICE
itself validates actual rows, canonical actor/current authority and availability.
Core validates the strict witness, exact tenant/scope/tuple and not_evaluated
fields, then compares the provider and Offering/revision across both policy calls.
Missing module or source metadata stays NOT_READY; ambiguous/malformed/conflicting
or foreign sources cannot reveal agreement metadata. A metadata pin is not runtime
code authentication: source/profile admission must verify the module bytes.

Only a current, authorized, published, valid, available, workspace-wide,
non-reservation request source is accepted. The request operation remains
nonfinancial: no payment, quote acceptance/posting, Booking, S02/S03 resource or
geography action is authorized. No nonexistent financial flag is added to the
SERVICE ABI. No source text/signers/financial terms or unrelated scopes appear in
the Core verifier result. `action_authorization=not_evaluated` always.

The dependency code does NOT call Core S01. Core calls SERVICE's source projector;
there is no dependency cycle. Both runtime bindings remain NULL. This is code
integration with the delivered source, not installed SERVICE metadata/rights or
independent acceptance of its owner's18 tests. Those tests were not replayed.

## Concrete inactive schema and writer

`supabase/proposals/core-service-s01/store-v1.sql` is a single BEGIN/final-ROLLBACK
source capsule, outside automatic migrations. No statement has run. It creates:

- two Core-owned head/immutable-version tables over the existing canonical IDs;
- two **additive parent support UNIQUE(id,tenant_id) constraints/indexes** on
  actual portfolio.parties and platform.customer_workspaces; no replacement
  parent, history rewrite or duplicate registry;
- composite Workspace/tenant, party/tenant and version/full-head-tuple FKs, plus
  deferred current-version FK. Parent tenant retarget is constrained too; the
  child cannot rely on parent id PK alone;
- row and TRUNCATE guards: immutable versions, immutable head tuple, monotone
  revision and sequential content version, terminal revoke, no silent resume,
  validated bounded/unique scope codes and valid operational date interval;
- deferred publication-link guard: a new version must be linked by the head
  before constraint settlement. No orphan future version can be committed;
- one closed private SECURITY INVOKER administrative writer for create,
  append_version, suspend and revoke. Expected revision mismatch is40001;
  append and head advance are one statement/transaction, not a new command or
  idempotency/receipt/audit engine. No customer endpoint or positive grant.

Existing canonical schema files/parents' data, Auth/evaluator/host, fresh
installers, Operations300 and SERVICE runtime/SQL are not edited. The future
capsule's parent support constraints are an explicit new S01 source effect needing
ordinary owner/ALTER rights, not permission to apply them now.

The valid order for this bounded S01 family is:

| Path | Lock order |
|---|---|
| Existing host / SERVICE source | existing host aggregate/provider locks; canonical authority revision barrier; Offering KEY SHARE → published revision SHARE → definition KEY SHARE → provider party SHARE, using exact owner source |
| Core reader | authorized nonlocking head discovery; canonical party SHARE → Workspace SHARE → head SHARE → immutable version SHARE; same-head reread; exact source refresh; final canonical/session/date observation |
| Core source writer | canonical party SHARE → Workspace SHARE → the same head UPDATE → insert next immutable version → advance head/revision; no later SERVICE/authority acquisition inside writer |
| Version guard | same head UPDATE already held by writer; immutable tuple; deferred publication constraint; no additional parent or SERVICE lock |

Discovery grants no disclosure and is revalidated after parent/head locks; drift
is withheld. All paths use one exact tuple, not an unordered batch. Direct-owner
head updates cannot alter parent identity; new parent FKs prohibit parent tenant
retarget while referenced. The new explicit functions' lock order has no reverse
head→parent acquisition. All other canonical/domain writers, reentrant source
refresh and any future compound administrative transaction still require native
participation/deadlock review; this is not an assertion that every application or
managed-session writer follows that order. Such a profile cannot be activated
from the offline result.

Both tables ENABLE+FORCE RLS and have no policy: deny-default. New tables and all
four invoker routines receive explicit PUBLIC/anon/authenticated/service_role
revokes inside the creation transaction; catalog assertions reject unexpected
owner/path/effective ACL, raw ACL grants and any pg_default_acl delta. No role or
default privilege changes, managed Auth changes, positive grant, SECURITY DEFINER,
SET ROLE, IF-NOT-EXISTS repair or native guard removal. Version/head history cannot
be deleted or truncated through ordinary DML. Privileged DB administration that
can disable guards is outside this runtime trust boundary.

The definition capsule requires exact PG17 parent ownership/schema-create rights,
no collisions (including function overload/type/index names), and existing
ordinary role definitions. It does not assume superuser or create a role. Closed
FORCE RLS intentionally does not establish a working hosted non-BYPASS reader
principal; actual server principal/policies/rights remain an admission gate. The
separate isolated store fixture explicitly requires a superuser/BYPASS lab
principal for testing; that is not target compatibility or a proposed bypass.

## Source tests and native request

```
node scripts/review-core-service-s01-producer-01/check-store.mjs
node scripts/review-core-service-s01-producer-01/compose-proof.mjs
```

The checker passes one static positive and9 targeted source mutations. Composite
FK mutations remove the tenant on both sides, so they remain coherent weaker
SQL, not merely a syntax error. Other mutations cover immutability, FORCE RLS,
expected revision, revision advance, default equality, invoker mode and final
rollback. This is bounded source inspection, **not** SQL parsing/compilation or
proof of catalog contents.

`store-proof-v1.sql` is real executable future fixture/assertion source using the
actual writer and actually consumed canonical parent rows. It tests create,
append/revoke, stale revision, foreign parent, real parent-retarget FK errors,
immutable update/delete/TRUNCATE, orphan version settlement and exact residue.
No fake provider/Auth helper or ready JSON result is substituted. No fixture ran.
The composer inserts the exact fixture only at the explicit unique source marker;
no DDL/guard is deleted. One BEGIN and final ROLLBACK remain. `verify-clean-v1.sql`
is a bounded read-only observer for exact new-object/support-constraint/fixture
residue on the **same** admitted database.

The machine-readable request pins actual definition, fixture, observer, composer,
composed send-image, canonical parent statement ranges and exact SERVICE source.
It requires a separately admitted PG17 canonical-parent-definition profile;
no all-migration replay or application/Auth installation is included. Pre-existing
fixture IDs or non-FK parent triggers stop, not skip. Only rollback-local new S01
objects, additive support constraints and named synthetic parent rows are allowed.
There are zero role/grant/Auth/business/receipt/audit/outbox/activation effects.

A marker alone is not success: same-attempt backend ROLLBACK CommandComplete and
ReadyForQuery I, exact observer residue0, protected/default baseline equality and
Platform-owned cleanup acknowledgement are all needed. Timeout/cancel/loss or
mismatch is STOP/UNKNOWN; no blind retry/retarget. All invocation/profile/review
bindings remain NULL. The earlier ACL02 invocation cannot be reused for S01.
Store-only PG proof is not the real SERVICE/host/session lane; actual metadata
schema/rights and two-connection session/revoke/expiry/40001/barrier/settlement proof
remain separately specified and NOT_RUN.

Only16 new/affected controlled checks,3 predecessor counterexample/control checks,
9 static SQL-source negatives, composition/pin/JSON checks, narrow typecheck and
lint/diff were run. Exact unchanged lock is
`c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc`
(Next16.4.1/Zod4.6.6/TS5.9.3; existing Node24.19.0). No install/package/lock change,
SQL parse/compile/execute, real Auth/DB/fixture, deployment, CI dispatch, native
activation, Operations chain or old suite replay. Source/model admission is not
runtime acceptance; coordinator remains the reviewer.

## Historical SQLSTATE checkpoint — superseded by accepted4c coupling below

Core's outer reader rethrows the original40001 object before unavailable mapping.
The existing Core authority provider already preserves that SQLSTATE and remains
unchanged. A new controlled invocation of the **actual existing host** proves
three bounded attempts and rollbacks, no commit/mutation, when the reader's final
observation throws40001. The final observation starts SELECT (nested CTE), fitting
the host's unchanged read-scope guard; no guard widening is used.

`--serialization-integration-only` is the required final coupling test: SERVICE
projection, preflight, transactional provider and original host must all retain
the error. With initial fd8/37af source, the actual SERVICE provider loses the
error and the host sees only one attempt instead of three. This is a dependency
failure, not PASS and not authorization for a replacement wrapper/retry engine.
The original fd8 pin is diagnostic only after the addendum; no final admission
uses it. The reviewed full successor SHA must replace both relevant consumer
source and disclosure-module pins, followed only by affected coupling checks.
At that checkpoint, pending the reviewed successor, WIP stayed local and no final
direct-child commit/source-success was claimed. The final result below supersedes
that dependency status; this historical evidence remains preserved.

Historical candidate update: source branch contained e6e33a57555b42d145ed39be0b3d45380ab6e35c
with projection blob894aa9ce5428d7c4215acb959ff18851dcca721d / SHA256
b450d50f1dcac9bb83b5d29c9984cc2646b20093485e93252d6bacca1297cbaf.
It is consumed locally for diagnostic checks only, not final reviewed admission.
That delta changes the projection catch only. Actual application-flow.ts
providerAgreementGate and provider-binding.ts validateCurrentState still catch
reader40001 and return NOT_READY/PROVIDER_UNAVAILABLE. New sensitive coupling
checks reproduce missing rejection and one host attempt instead of three.
These SERVICE-owned consumer paths are not modified by Core. The final required
input is a reviewed full successor including those two catch boundaries; no
Core restoration/retry wrapper is substituted for the fix.


## Final accepted successor coupling

The coordinator supplied reviewed FullSHA4c0dcc075797ce8fc08d0e80ddb531370ebfc46f.
Only the affected controlled coupling selection was rerun:

```
node scripts/review-core-service-s01-producer-01/test-producer.mjs --serialization-integration-only
```

Four controls PASS: exact Core reader40001 reaches SERVICE preflight, transactional
validation and replay unchanged; actual SERVICE provider reaches the existing
Core host, which owns exactly3 attempts/3 rollbacks and zero mutation/commit.
Replay's receipt sentinel also proves receipt inspection does not continue after
this provider failure. Each direct boundary sees the injected final-observation
fault exactly once and preserves the original error object. This is controlled
transport, not a PG serialization or settlement test.

Prior16 checks, the additional actual-canDisclose-to-existing-host check,9 static
source negatives,3 predecessor controls and earlier narrow typecheck/lint remain
retained evidence; their successful suites were not rerun at final coupling.
The new SERVICE clock/source-port finding is outside this delta. Neither its
source-port nor its repair is imported here. DDL/proof bytes remain unchanged.

Current source status: SOURCE_LOCAL_DELIVERED / INDEPENDENT_SOURCE_REVIEW_REQUIRED.
Runtime/source binding and native invocation fields remain NULL. SQL parsing,
compilation/execution, PG/Auth, store/writer concurrency, managed session behavior,
install/grant/activation and native admission remain NOT_RUN/NOT_READY.
