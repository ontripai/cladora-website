# Core17 post-Auth and exact consumer adoption

Source Base: `b696ff211daabd4be3989522c569f24ccccd0dce`.
Installed Core remains `ee883b62cf4a318af3450c506931a969623b8987`.
This is source/contract delivery for Coordinator review. No native preflight,
relay mutation/restart, successful continuation, SQL, ACL or Auth operation is
executed by this task. The original App worktree, transport activation binding,
relay process record and receipts remain historical evidence.

## Auth contract for Frontend

The named owned-development profile changes transport/target selection, not
business authorization. Before AAL2, use the official Supabase Auth flows:
login/callback/session handling, `auth.getUser`, `auth.getClaims`,
`auth.mfa.listFactors`, `auth.mfa.getAuthenticatorAssuranceLevel`, and the
applicable official enrollment/challenge/verification flow. These operations do
not produce a customer Context, permission, entitlement or SERVICE allow.
Refresh success, a parsed JWT, `user_metadata`, browser state or an admitted App
source likewise does not produce authority. Do not duplicate an existing MFA
enrollment or real session as part of source adoption.

`src/lib/auth/post-auth-route.ts::resolvePostAuthRoute` currently calls
`hasActivePlatformAccess`/`has_platform_access_v1`, invitations and legacy Context
RPCs while choosing a destination. Those are business/data-access calls, not a
required authority bootstrap for an owned-profile MFA screen. Frontend owns the
minimal owned-profile Auth-only transition before AAL2: complete MFA first;
then invoke the current Core selections through the official routes. Do not
extend `customer_api`, roles or ACL simply to make that post-login routing code
succeed. Legacy/shared/hosted routing outside this profile is not changed here.
No Auth UI or Frontend-owned module is modified by Core in this delivery.

| Consumer operation | Owned-profile producer | Required boundary |
| --- | --- | --- |
| Auth/MFA before AAL2 | Official Auth SDK/GoTrue | Auth identity/factor flow only; no SERVICE business data/command |
| GET `/api/customer/v1/contexts` | `coreServiceAppReadV1(...,'selections')` | Verified user + matching claims + AAL2, canonical current session, canonical selection SQL |
| GET `/api/customer/v1/workspace/targets` | Same selections, filtered by exact Context | Same checks; foreign Context denied |
| GET `/api/customer/v1/dashboard` | Same selections; no legacy dashboard producer | Same checks; authorized Context yields explicit 404, never fake dashboard data |
| GET `/api/customer/v1/services/assembly-bootstrap` | Same official selections | Discovery only, not a reusable allow |
| GET `/api/customer/v1/services/catalog` | `readServiceApp('catalog')` | AAL2 + current session + scope resolver + `services.catalog.read` + final checkpoint |
| GET `/api/customer/v1/services/requests` | `readServiceApp('requests')` | AAL2 + current session + scope resolver + `services.orders.read` + final checkpoint |
| GET `/api/customer/v1/services/offering-request-flow` | SERVICE application flow → Core request-local `withRequestScope` | AAL2 + current canonical SERVICE/S01/disclosure checks, including after waits; positive read rollback |
| POST `/api/customer/v1/services/offering-request-flow` | Same official SERVICE flow → existing Core C03 host | AAL2 + current canonical scope/authority/session, atomic mutation/receipt/audit/outbox, canonical replay/UNKNOWN |

Authoritative source: `functional-command-runtime-v1.ts::authenticate`,
`makeConnect`, `readServiceApp`, `withRequestScope`, `execute`;
`service-functional-binding-v1.ts::bindRequest` and the existing SQL guards.
All are preserved. `authenticate` uses verified `getUser` plus claims, requires
`aal='aal2'`, matching actor, session ID and expiry before checkout. The lease
locks/verifies the actual session and resolves scope canonically. Its checkpoints
retain wait/current-authority handling and original 40001 semantics. For
selections, the canonical SQL owns returned-tuple authorization after waits.
An authenticated AAL2 session alone does not authorize a SERVICE operation.

AAL1 rejection currently reaches the existing fail-closed error path (a claim
schema failure may become 503 at the read facade). This contract does not promise
an invented 200/empty or a new 401 mapping. Frontend must handle the Auth assurance
state with official SDK responses and treat any failed SERVICE response as no
business data/authority. Session SQLSTATE42501 propagates for reads; the existing
C03 host may return its generic denied/TRANSACTION_FAILED without detail.
No HTTP error is converted to a successful bootstrap. Do not substitute legacy
Request POST/Data API, an admin client or service_role as a fallback.

## Why a separate admission is required

The accepted v2 `load_binding` validates the original App root, SHA, Tree and
launcher before checking the live relay PID/start ticks/argv and backend. Moving
that original root to a new HEAD invalidates its original premise; changing only
the launch directory also fails `LAUNCHER_APP_ROOT_MISMATCH`.

Keep the original root immutable at:

- App SHA `b696ff211daabd4be3989522c569f24ccccd0dce`
- Tree `534ec94f21699a65686bade5539517dfd818ec1e`
- launcher SHA256 `5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092`
- relay ABI `platform17.relay-cors-preflight.v2`
- relay seal `c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02`

Do not overwrite its activation-binding.json or process/history record. This
source does not change the relay, its closed module inventory, environment
filter, physical forwarding, CORS policy or canonical install source.

## Exact consumer admission ABI v1

`core17ConsumerAdoptionPreflightV1` layers a closed source-compatibility admission
above the original preflight. The admission contains exactly:

```text
contract = core17.exact-app-consumer-admission.v1
source_base = b696ff211daabd4be3989522c569f24ccccd0dce
installed_Core_base = ee883b62cf4a318af3450c506931a969623b8987
origin = http://localhost:3008
transport = {abi, binding_sha256, relay_seal_sha256,
             app:{root, sha, tree, launcher_sha256}}
consumer = {root, sha, tree, launcher_sha256}
```

Coordinator selects the exact final reviewed App SHA/Tree/launcher and actual
new root, then reviews this new record against Platform's existing transport
root and binding digest. No `HEAD`, wildcard, `approved:true`, null pin, guessed
path, directory scan or a consumer-provided JSON assertion is accepted as a
selection. Observed HEAD is compared with the supplied expected pin; it never
populates that pin. A self-created record/hash is not approval. The digest only
protects the exact operator-admitted bytes and does not grant Auth/business or
execution authority. HTTP/caller data never supplies this record.

After that review, the operator stores it as a new owner-only 0600 single-link
regular file inside an owner-only 0700 directory, at an explicitly selected
absolute path. Do not reuse or rewrite the original relay binding. Both build
and start use the existing transport selectors plus:

```text
CLADORA_CORE17_CONSUMER_PROFILE=core17.exact-app-consumer-admission.v1
CLADORA_CORE17_CONSUMER_ADMISSION_FILE=<exact new private admission file>
CLADORA_CORE17_CONSUMER_ADMISSION_SHA256=<reviewed SHA256 of that file>
```

Do not pass these selectors to the browser or the Next child. The accepted child
environment filter already excludes them. Partial selection, foreign/deployed
profile, wrong record/custody/source/lineage/launcher/target, untracked source or
unreviewed production dotenv fails closed; no old-lane fallback follows failure.
Both selectors absent retain the old preflight behavior for historical callers;
a new App without admission still fails the original exact App/root check.

The code validates the actual new root's clean exact Git HEAD/Tree and launcher,
requires Base ancestry, and compares the protected installed runtime/Auth/host/
SQL/package sources with the installed EE commit. It then invokes the original
reviewed preflight **at its unchanged transport App root**, with the same exact
binding digest. That code retains real backend snapshot and relay PID/start/
argv verification. The new and old source identities are checked again after
the preflight wait. No PID/result or `ready:true` supplied by a browser is proof.

The operator record must pin the finalized integrated commit, not this document's
containing branch name or an arbitrary current HEAD. Final integrated source and
runtime admission remain Coordinator/Platform inputs. `review-request.json` in
the local delivery names this Core candidate's exact post-commit SHA/Tree/launcher
for review; it is not a completed runtime admission or execution authorization.

## Coordinator / Platform continuation (not executed)

1. Preserve the existing transport-bound B696 worktree/binding/receipts. If that
   root has moved or original relay readiness fails, STOP and refer to Platform;
   do not invent a new activation or repeat successful continuation.
2. Integrate the Frontend-owned Auth-only pre-AAL2 branch and this source; record
   final exact SHA/Tree/launcher. Keep install base EE and protected runtime/SQL
   bytes unchanged. Use a separate clean consumer root, exact dependencies and
   owned origin; no production dotenv or inherited credential fallback.
3. Review the new private admission against actual old transport identity and
   finalized consumer identity, record its digest and the independent permission
   for any later execution. No secret values are needed in review artifacts.
4. Only in a separately authorized continuation, use the two transport selectors
   and three admission selectors with the existing official launcher commands:
   `node scripts/run-core-service-app-assembly-17.mjs build`, then `start`.
   This source preflight does not stop/start relay or App, install SQL, mutate ACL,
   recover sessions or issue a command. An already busy App port remains a STOP;
   exact owned process/build replacement is Platform's existing lifecycle task.
5. Later browser acceptance must verify login→MFA→current Context→catalog→same
   Request command/readback. Old success, CORS readiness and admission match do
   not prove this new flow. UNKNOWN/40001 and command recovery remain unchanged.

## New source checks and evidence limits

Run `node scripts/test-core17-consumer-admission-v1.mjs` and
`node scripts/test-core17-post-auth-security-contract.mjs` for the new controlled
cases. They execute real Core/launcher/admission modules with synthetic filesystem,
Git/SDK/transport facts. No live preflight, SQL, Auth, relay restart, successful
continuation or browser run is performed. Native/current-source consumer adoption
and browser E2E remain `NOT_RUN_NOT_PASS`. Historical manifests, source seals,
Core install source and successful receipts are not relabeled or regenerated.

Automation: نیازمند بررسی — source/custody/pin comparison can be mechanical;
Coordinator still selects the reviewed integrated consumer and Platform owns the
actual target/lifecycle permission and exceptions.

Results for this candidate: 39 new admission controls and 19 new Auth-boundary
controls passed, with synthetic transports only. Full current ES5 typecheck,
limited lint, syntax and diff checks passed. No prior 27/20/native suite or
successful Platform continuation was repeated. The prior relay compatibility
record/checker belongs to its recorded B696 source; it is not rewritten to make
an old launcher seal describe this new launcher. The new source inventory and
preserved pin closure are checked by
`node scripts/check-core17-post-auth-consumer-adoption.mjs`.
