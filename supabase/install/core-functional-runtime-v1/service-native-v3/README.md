# Core15: owned Platform12 Service-first native cut

This package is a **development-only** derivation/installation recipe. It does not
install native Operations on populated staging, expose a public caller, activate
AIRPROP, or represent completion of Core15. The exact containing Git commit binds
this recipe. `service-cut.manifest.json` records source and payload identities,
observed native settlements, and remaining gates.

## Target, actors and trust

Use only a separately owned Platform12 at
`794f5a12c3928ae0a3585ab679a3cbe60aab49a3`. Its five infrastructure sources must match
Git, private descriptor custody and exact Docker CID/image/network/mount must
validate, and local relay collision checks must pass. Another agent's localhost
is not this target. Never infer role attributes from `postgres` or a claimed GUC.
This observed profile is PG17.11, database `postgres`; pgcrypto1.3 and btree_gist1.7
are in `extensions`. No staging/Production selectors or credentials are used.

| Actor | Capability in this profile | Never used for |
|---|---|---|
| lifecycle `postgres` | Actual isolated PG custodian, superuser; fixed setup/owner admission only | Application queries or authority decisions |
| `cladora_core_installer` | Ordinary LOGIN NOINHERIT CREATEROLE, no SU/BYPASSRLS/provider membership; application object owner | Auth bypass or runtime identity |
| `supabase_auth_admin` | Existing ordinary Auth table owner; exact closed session helper owner | Application pool login or role-attribute mutation |
| `cladora_core_runtime` | Ordinary LOGIN, no role memberships, DDL, owner privileges or direct Auth table SELECT | Setup, retention deletion, or bypass |

Provider role attributes, Auth row policies, four historical installers and
Core300 transfer/restoration guards are unchanged. The development delta maps
logical installer `postgres` to the named ordinary installer, exact target/OID
admission, and the one pinned historical fixture/backfill role-name body/hash.
The whole reverse transformation must equal the accepted source. This is not a
new authority engine. Claim accessors are not Auth table access. Session helper
ownership delegates the unchanged canonical check to the actual ordinary table
owner. Temporary schema CREATE is closed in the same transaction. No default ACL
mutation is permitted.

## Source and minimal dependency order

Accepted Core300 source is reconstructed from official manifest blob
`a13e382d31ea40b2ddd52306a34c56b648f3ed47`, SHA256
`94543e82513461f808037fdbfcb6c3d51531f4d826e82155a8844ace15929822`.
An already validated source300 directory may be reused. Do not rebuild historical
276/286/300 chains or substitute the stale product-tree installers, staging
send-images, reduced demo, or an unpublished local archive. `manifest.json`
contains exact four source pins and derived hashes; only foundation is a required
native unit for this Service cut. Assets happened to commit in the owned run;
it is not a dependency for a workspace-wide, non-reservation Request.

Fresh recipe, from repository root, after Platform12 target/custody review:

1. Existing accepted `04-session-bootstrap.sql`: fixed
   `scripts/run-core15-session-bootstrap.py --platform-source <exact-platform-worktree>`.
   This creates the two ordinary Core roles/session schema and private runtime
   credential. It is one-shot, not an existing-instance bootstrap.
2. Unchanged `05-session-auth-owner.sql` with
   `python3 scripts/run-core15-session-owner-admission-v1.py`.
   Its new fixed runner removes the obsolete dependency on an intentionally
   failed old proof; it does not change the accepted SQL. Existing receipt => STOP.
   These two setup receipts observe COMMIT tag and independent catalog, **not a
   captured ReadyForQuery**. Nine accepted native session tests are not repeated.
3. Generate exact native derivatives, without SQL execution:
   `node scripts/prepare-core15-service-native-v3.mjs --accepted-source <source300>`.
   Dispatch `prerequisites`, then `foundation`, individually using
   `node scripts/run-core15-service-native-v3.mjs <unit> --accepted-source <source300>`.
   Prerequisite passwords are generated privately and never embedded in source.
   Current owned target already has these receipts: do not rerun.
4. `node scripts/prepare-core15-service-domain-v1.mjs` only generates identities.
   Dispatch each selected unit individually using
   `node scripts/run-core15-service-domain-v1.mjs <id>` in **domain-manifest order**:
   catalog → module-registry → request → service-v14 → subject-validity →
   request-version → s01-store → canonical-sqlstate →
   session-authority-delegation → owner-execute-bindings → runtime-access.
   The two owner admission units use only the fixed lifecycle custodian;
   all other domain units use the ordinary installer. Every unit has its own
   transaction/COMMIT; no chain-wide rollback is claimed. Unit hashes refer to
   template source, exact generated SQL send-image, and preserved actual receipts
   separately. No historical migration is marked applied or replayed wholesale.
5. `node scripts/write-core15-private-service-binding-v1.mjs`: exact installed
   runtime precondition, actual owner-protected backend marker observation,
   private 0600 runtime-only credential file. The app cannot invoke Docker or
   acquire custodian/installer credentials. The marker is correlation, not allow.
6. Synthetic data is a separate explicitly authorized development lane:
   `prepare-core15-native-synthetic-auth-v1.mjs` signs in the two **existing**
   synthetic users and enrolls MFA once; it never signs up/recreates users.
   `prepare-core15-service-synthetic-fixture-v1.mjs` creates canonical taxonomy,
   membership/Context, scoped identity roles, published Offering and immutable S01
   agreement using the actual writer. It seeds **zero Requests/C03 receipts**.
   Offering publication/admin genesis is a fixture, not G2/onboarding or publish
   command proof. AAL2 comes from actual GoTrue. Reauthenticate an expired session
   with `reauth-core15-existing-synthetic-factor-v1.mjs` only after inspecting its
   one-shot receipt; it uses the existing factor, never re-enrolls or overwrites
   original evidence. No email/secret/identifier is included in public evidence.
7. Start configured Next with
   `node scripts/run-core15-private-service-next-v1.mjs 3007`.
   Only this child gets local public Auth selectors and private binding-file
   identity. No `.env` change. Server logs are private 0600. Unconfigured/default
   and Vercel bindings remain closed; there is no production activation.

The current owned run installed prerequisites incrementally and corrected known
ROLLBACKs. The fresh order above is derived from those concrete dependencies;
**it has not been rehearsed again from an empty environment as one complete run**.
Receipt-specific continuation flags preserve that actual history, and are not
fresh-install instructions or permission for generic retry.

## Runtime ABI and consumers

`createCoreServiceFunctionalBindingV1({pool,target}).bind(Request)` returns
request-local `service-functional-request-runtime.v1` ports, after official
server getUser/getClaims. Context/Workspace/tenant/member come from the existing
DB resolver and canonical evaluator, not client JSON or user_metadata. Selected
Offering/revision are checked against authorized database source. S01 uses the
actual accepted Service disclosure projector and existing immutable store.

Core read scopes are SERIALIZABLE, lock-capable, and positively settle by
ROLLBACK before returning completed_at from a same-backend server clock. They do
not reserve C03 keys. Mutation uses the existing C03 host and canonical
`platform.idempotency_keys`, audit and outbox. The original command/key/body/hash
and scope fences are not replaced by current GET. Public Service success remains
exactly `{request_id,status:'submitted'}`; replay is an internal host result,
not a new public receipt field. No reservation/Booking/Order/payment is proven.

Next's official async cookies API transports refreshed cookies to the actual
response; a WeakMap shares only one request's verified SSR client/refresh state.
Non-Next controlled transports without a response cookie port fail on refresh.
Active query failures and original40001 propagate; the existing bounded host
owns retry. Idle pool loss only emits a nonsecret diagnostic, never an ACK.
Provider evidence timestamps now use the actual same-scope DB clock at the two
original observation sites, preserving microseconds and DBtx/actor/Workspace;
no Date.now, TTL, or external restamping is used as authority.

## Verify and proof lanes

- `scripts/check-core15-service-cut-v1.mjs`: offline pins, generated images,
  dependency order, closed source set and targeted coherent negative controls.
- `scripts/test-core15-service-cut-v1.mjs`: twelve distinct controlled SSR/clock controls; `--auth-only` selects the six affected Auth cases.
- `scripts/test-service-v14-execution.mjs --clock-only`: three affected Service
  evidence controls, not the unrelated accepted suite.
- Native scripts `prove-core15-service-first-native-v1.mjs`,
  `prove-core15-service-next-existing-v1.mjs`,
  `prove-core15-service-native-settlement-v1.mjs`,
  `prove-core15-service-restart-v1.mjs`,
  `prove-core15-service-currentness-v1.mjs`, and
  `verify-core15-service-native-cut-v1.mjs` are one-shot, private-receipt consumers.
  They must not be executed against an existing dispatch without reading its
  receipt. Their first-cut row-count oracles deliberately require this isolated
  genesis fixture; they are not generic production verification.

The ACK-loss test throws **after actual node-pg COMMIT resolution** and records
actual CommandComplete/RFQ. It proves native persistence + host UNKNOWN/recovery
under a controlled driver fault, not a naturally occurring packet loss. Explicit
same-key/body recovery returns the exact stored receipt without another effect.
The rollback test temporarily reduces only runtime outbox INSERT privilege,
observes real42501/ROLLBACK and zero surviving Request/C03/audit/outbox, then
restores the exact ACL/grantor. WAL/sequence rollback is not claimed.

Two-connection expiry uses a real S01 row lock and real DB clock: after release,
canonical context/checkpoint denies42501; the existing Service source boundary
redacts it to SOURCE_UNAVAILABLE, with no value or partial output. The initial
harness incorrectly expected the private exception's unredacted name/code; that
oracle was corrected using preserved native evidence. Current membership revoke
also denies, and synthetic fields are restored through canonical writers;
authority epoch increments are preserved, not reset to old receipt revision.

## Stop/recovery and limits

Before every unit, independently inspect exact target/custody, actual principal,
source/payload pins and predecessor receipt. Mismatch => STOP. Capture one backend
PID, CommandComplete and ReadyForQuery I for each new Service/native install
unit. COMMIT error, transport loss, timeout/cancel or observer disagreement =>
UNKNOWN/STOP; never advance or resend blindly. A later cleanup ROLLBACK cannot
undo an already attempted COMMIT. Inspect catalog under the same target and
reconcile that unit; choose a reviewed additive repair or explicit owned-target
restore, never IF NOT EXISTS/repair-as-applied. Keep completed earlier units.

An absent C03 receipt after UNKNOWN is not proof that resend is safe. Retain the
same immutable command and unresolved hold; no new key/body is invented. Native
exact replay was proven while the original binding remained valid. After
canonical authority/source epoch drift, fail-closed revalidation may prevent the
historical receipt from serving a new command; no successful new authority is
inferred from receipt existence. No retention/purge/cancel policy is added.

Maintenance's OC1 rejected unexpected private helper/table rights to
cladora_rpc_owner and its transaction rolled back. Building was not dispatched.
They remain independent gates, not softened prerequisites for this cut. No
staging/managed Supabase installation compatibility is claimed. No valuation,
DW02/Unit producer, CE writer or Documents custody binding is activated. Browser
UI/full production build, hosted RLS acceptance and independent source/native
review remain separate. Locks prove only the observed participating writer and
session barriers; no currentness-through-client-ACK/delivery guarantee is made,
and no universal implicit/deferred COMMIT-wait theorem is claimed.
