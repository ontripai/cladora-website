# Guide alias source adoption / exact CE7d discovery consumption

Base9811a9074c802d77d677b1387f9a01f14090172a, same CORE-DOMAIN-PORTS-01 branch.
The reviewed Guide-only proposal is now applied to the OFFICIAL source file
src/lib/core/platform-role-bound-pool-v1.ts. Old decision/evidence/proposal remains
historical and byte-identical; it is not stacked/reapplied on the new source.
No runtime/target/provider slot is activated by this source adoption.

## Operational source behavior

After RESET ALL and RESET ROLE, verify physical runtime identity, then explicitly
blank request.jwt.claim and request.jwt.claim.email with pg_catalog.set_config at
session scope. It is the SAME cleanForReuse path at checkout and successful reuse.
On BEGIN, after executor identity and BEFORE the transaction safety lease, blank
both aliases LOCALLY. The later CE verified plural carrier remains unchanged.
The branch is only the fixed Guide contract, not a caller role/profile flag.
The SERVICE subject-link path does not execute these added statements.

Existing first40001/checkout failure propagation, BEGIN poisoning, unsafe/open/
COMMIT-attempted lease destruction and asynchronous cleanup-failure destruction
are preserved. No fresh session/retry/host, new permission or fallback. No Auth
function/owner/public ACL, installer SQL, CE-owned implementation or shared
SERVICE business behavior is changed. Qualified set_config is an existing builtin,
not a new administrative privilege. Reviewed physical role/target/connection-model
admission remains required; direct/session_pooler are supported, not transaction
pooling. Default runtime activation remains NULL.

## Exact discovery decision

Consumer:7d5ec54a4718bdac600b6a668453d51818f22a4e, fetched as exact Git object without
changing checkout. Source src/lib/community/experience-guide-discovery-v1.ts,
CE_GUIDE_DISCOVERY_CANDIDATES_SQL_V1.

SOURCE QUERY ACCEPTED for this exact consumer and existing Core port:
- New1269bytes SHA2564fbe16a342af4bfdcb42dffb1b3ac8b8dc6ddf3095b3f75027a6ada7386a5f9c.
- Prior766bytes SHA25638e105274f5d7fd1dab49b86f93a99b2beafd11af91134b965fac8b15f1fa72d
  remains HISTORICAL, not the candidate pin for this new module.
- FROM/joins/WHERE/order/LIMIT51/FOR SHARE of g,m,w are byte-identical. Same relation
  columns and lock-column rights; no new relation/column, UPDATE/write or RLS grant.
- Projection adds pg_catalog.octet_length/char_length bounds and private
  transfer_bounds_valid. CASE returns full text or NULL; no LEFT/substring/silent
  row filtering. Consumer requires the marker true and rejects the whole result
  for malformed/oversize rows or51row overflow. Public ce-guide-discovery.v1 stays
  unchanged.104448 is a bound on transferred LABEL octets only, not total frame,
  driver memory, database work, time or capacity.
- Exact CE canonical read query is unchanged from6259:604bytes
  SHA256bd4030118c726fa003ea86189c2e51d4c623b0c1ae8a47d299c3f7ab5ce72202.
  Canonical current-read/revision/session gates now follow final SDK verification
  while holding the transaction; no later SDK wait after rollback. No manage or
  command authority is inferred from discovery/read.

Core fixed-role pool checks identity/role/transaction safety, not a discovery-SQL
SHA allowlist. It is a trusted SERVER composition seam, not a client SQL endpoint.
There is therefore no obsolete Core per-query hash to loosen/replace in product
code. Exact Core admission/handoff is discovery-admission.json: candidate/source,
fixed controls and new Core alias statements all have bytes/hash pins.
Where the existing Platform adapter/closed execution profile pins frames/SQL/source,
its owner must rebind ONLY those exact new pins, alongside the actual integrated
App/Core identities. This delivery does not edit that owner's profile or claim
it was consumed. Unknown/old-only census must STOP, never accept arbitrary HEAD,
a permissive SQL regex or an unreviewed SELECT. Historical pins remain preserved.

## Source rights versus actual installed compatibility

Canonical source declares platform.tenants.legal_name and identity.roles.name TEXT;
Guide installer10 grants SELECT on these SAME columns. g/m/w SELECT and UPDATE(id)
lock rights, epoch SELECT/UPDATE(singleton) and RLS are unchanged. No installer or
unit05 SQL successor is needed for the new CASE projection.

Actual target types/overloads, builtin EXECUTE under the admitted Guide role,
UTF8 server/client encoding, RLS, final session/currentness, CASE execution and
wire bytes remain Platform native gates. No existing PUBLIC/default privilege is
assumed as proof. No GRANT, role selection, SQL/parser/PG/fixture/target operation,
restart or activation was performed. The same exact new query can be admitted at
source level while a native privilege/type/binding mismatch remains STOP/NOT_RUN.
Guide still does not depend on Storage/S01/Listing or all historical migrations.

## Checks actually run

- Eight new groups over the ACTUAL adopted Core module and controlled physical
  Pool/GUC model: after-reset checkout order; transaction-local aliases before
  safety lease under direct/session_pooler; cleanup; exact unchanged SERVICE SQL/
  state; checkout/BEGIN40001 identity; cleanup destruction; unsafe/COMMIT destruction.
- Three new actual Core->CE7d production discovery ROUTE couplings with controlled
  SDK/SQL: bounded successful public projection, final SDK-wait revoke denial,
  and same40001 at the new alias boundary mapped to409 with lease destruction.
  No business mutation/commit or fallback; new Core alias ordering observed.
  Only owner test SETUP is reused; old CE lifecycle/discovery scenarios not run.
- Exact old/new query, same relational tail, source/module and fixed-control pins.
- Full existing ES5 tsconfig typecheck; limited lint of affected TS/new scripts,
  Node syntax/diff and full patch apply/reverse/postimages/seal.

```sh
node scripts/test-core-guide-alias-adoption-v1.mjs
node scripts/test-core-guide-discovery-consumption-v1.mjs
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/eslint src/lib/core/platform-role-bound-pool-v1.ts scripts/test-core-guide-alias-adoption-v1.mjs scripts/test-core-guide-discovery-consumption-v1.mjs
```

This is operational SOURCE with CONTROLLED transport proof, not native Auth/PG/
session-pooler/installation success. Private unit05 definition metadata is not
re-read from target or republished. No previous unaffected successful suite or
native login/MFA is repeated. Recovery remains existing fail-closed lease destroy;
new source/profile admission must precede future execution; unknown settlement is
not successful receipt/rollback and cannot authorize a blind retry/new key.

Automation: نیازمند بررسی — exact source/pin/coupling checks are candidates;
private profile rebind, existing-role rights and native acceptance remain formal
Platform/Coordinator dependencies. No target or shared-provider change occurred.
