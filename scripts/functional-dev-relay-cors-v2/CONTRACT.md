# Task17 CORS-COMPAT-01 — versioned host transport v2

Same CLADORA-FIRST-SERVICE-PRODUCT-E2E-01 / Task17/08/09. Source successor of
Platform guard `1db6ce6c4095efed9a34dc088cf3b8ef8cbaf805`. No new product branch,
runtime engine, database, permission producer or authorization system.

**SOURCE candidate. Native activation and new login remain HOLD until Coordinator
reviews/pins the compatible launcher and final App source.** Current App
`5aa951bfbe8b1254b81212aa248f51a13179f890` is explicitly rejected as a v2 caller:
its official launcher still validates the legacy gateway process. The Core
installation stays `ee883b62cf4a318af3450c506931a969623b8987`; no SQL reinstall,
role/ACL change, provider configuration, storage operation or PG restart is needed.

## What changes and what does not

The actual browser failure used origin `http://localhost:3008`. The legacy relay
removed upstream Access-Control-Allow-Origin and emitted it only for the two
port3000 origins. The v2 exact set is:

* `http://127.0.0.1:3000`
* `http://localhost:3000`
* `http://localhost:3008`

No wildcard, origin suffix/prefix matching, arbitrary port, scheme substitution
or implicit 127.0.0.1:3008 is admitted. An origin is not an Auth principal.
Provider401/403/errors and payload bytes remain provider results; CORS never
creates a session, AAL2, API key, role, SQL privilege or business success.

`relay_v2.py` reuses the original sealed module's `state`, `status`, `relay` and
`pg_forward`. It does not implement another DB/wire/SDK layer. The fixed listeners
remain loopback55421 and55422, semaphore8, the original route/method/envelope/raw
response/timeout limits and physical Docker-exec forwarding. No new container,
host port, mount, image, installer or external destination is created.

The original five files are verified against `profile.json` hashes and remain
unchanged, as do the v1 descriptor/config/credential files. The original
gateway-process.json is NOT rewritten or removed. A private byte-identical
archive is added and the v2 PID/start/source/backend record has its own namespace.
An old launcher therefore fails on the ended old PID rather than mistaking v2
for v1 or treating a missing record as readiness.

The inherited environment uses the accepted pinned F01 closed child filter,
preserving proxy/CA/network guards. Only the existing Docker config selector is
additionally retained. No inherited cloud/app credential or NODE_ENV override is
introduced. The original helpers/source pins are references, not repackaged SQL
or dependency bytes.

## SDK and HTTP contract

Actual installed SDK source versions/hashes are recorded in sdk-source-pins.json.
Auth2.112.4 uses `X-Supabase-Api-Version`; SSR0.12.5 uses `X-Client-Info`. The old
exact header set is preserved and that one SDK API-version header is added to
forwarding and preflight admission. Tokens/passwords/header VALUES are not in
this packet. Source tests use only explicitly synthetic strings.

GET/HEAD/POST/PUT/PATCH/DELETE and ordinary OPTIONS retain the original method
behavior. A browser preflight is checked before forwarding: exact admitted
origin, exact supported method, unique explicit header names from the closed
SDK/legacy set. Invalid preflight returns403 without upstream dispatch. A valid
OPTIONS is forwarded to the same provider; its status is preserved, never
fabricated as Auth success. CORS allow-origin/method/header fields are generated
from the exact request policy, replacing upstream wildcards; no new
Access-Control-Allow-Credentials is introduced. Non-browser requests without
Origin retain their old behavior. A disallowed Origin receives no CORS read
permission, while provider authentication still determines the real response.

This is not a change to GoTrue Site URL, email redirect/sender, confirmation,
session lifetime, PostgREST exposure, database ACL or RLS. Those must not be
silently repaired to pass the next browser step.

## Compatible launcher ABI — explicit Coordinator integration

ABI: **platform17.relay-cors-preflight.v2**.
Export: `relay_v2.preflight(expected_binding_sha256)`; CLI:

```
python3 -I -B scripts/functional-dev-relay-cors-v2/relay_v2.py preflight EXACT_BINDING_SHA256
```

Coordinator must preserve the official launcher's `legacy.state()` and
`legacy.cid('pg')` checks and replace its legacy `gateway_process()` check with
this explicit v2 preflight. Before import/execution, the integration verifies the
exact reviewed v2 source path, seal-file SHA256 and every listed module hash.
There is no module fallback, legacy-PID alias, selectable arbitrary plugin or
any-HEAD/descendant rule. The final App FullSHA, tree and launcher file SHA256 are
bound exactly by the separate reviewed transition input. The existing Core
runtime binding's platform794 provenance still describes the unchanged backend;
host transport v2 is recorded separately, not relabeled as a new installation.

The bundle does not modify that official launcher or App5aa. Coordinator owns
its integration and final source pin. `profile.final_app_binding=null` explicitly
records this remaining gate; it is not an executable approved placeholder.

## Noncircular binding / activation

The source seal excludes itself and covers all eight new source/contract files.
Its file SHA256 is supplied in an external binding AFTER source and compatible
App artifacts are fixed. No source commit embeds its own Git hash and no file
embeds its own SHA256. activation-binding.template.json is deliberately invalid
for execution; NULL fields fail closed. No private values are shipped.

After Coordinator integration, the owner-reviewed binding is privately placed
at the fixed `legacy.PRIVATE / profile.operator_binding` selector, mode0600 in
owned0700 directories, no symlink/alias/hardlink. It contains only the exact
versioned fields: run_id, fixed Core base and origin, v2 seal identity, observed
backend snapshot, and compatible App root/FullSHA/tree/launcher hash. The snapshot
comes from current custody-checked existing resources, not a guessed target.
No arbitrary URL, shell, SQL, role, credentials or execution callback is accepted.

Its SHA256 must be pinned in the actual owner-approved execution request. That
digest is an integrity comparison, **not authorization**; possession of a hash,
`approved:true`, a self-signed fixture or this document does not grant execution.
The code rejects extra binding fields, missing pins, wrong source/tree/launcher,
foreign backend, private file drift and the known-incompatible App5aa.

Only after that approval and exact preflight may the existing Platform executor
perform the single bounded source-compatible host transition:

```
python3 -I -B scripts/functional-dev-relay-cors-v2/transition.py activate EXACT_BINDING_SHA256
```

The app's own process must already be stopped and port3008 free. The transition
does not kill an app by name or stop any backend container. It records a durable
exclusive claim before effect, validates the legacy PID/start ticks/argv and
actual five-file source, signals only that owned relay, and observes its end.
Already absent/exited is SKIPPED, never an acknowledged stop. Both relay ports
must be free. It checks source/target again immediately before one process
creation. The child acknowledges both bound listeners with real PID/start and
source/backend binding; the controller independently rechecks those identities.

Deadlines: old stop10s, new startup20s, cleanup of only the created child10s.
First error is preserved, even if cleanup/persistence fails. Timeout/lost ACK is
UNKNOWN/HOLD with no automatic retry, old-relay fallback, replacement process,
rollback claim, original-record rewrite, volume cleanup or database restart.
Result separately records attempted/acknowledged/skipped/unknown stages.

## Evidence and remaining gates

Tests exercise policy and actual HTTP parser/header output entirely in memory,
using a fake upstream only in the tests; they never connect to PG/Auth/Docker.
Binding/transition fault tests are mocks and not native activation proof.
The old browser login outcome remains UNKNOWN; no broad session deletion or
blind resend is performed. Inspecting a session later must use an authorized
actor/run-scoped tool. Browser close is not server-session cleanup proof.

Task09's current execution/evidence plan (blob4ec6f2181c2f832b281b4d54a874950825930801,
SHA256017d3fd9d4026378848022f44401af1ddc5b4410fce473192e9913e0feda05b1)
allows the existing browser tool; a separate runner is NOT a prerequisite for
P01/login. After this source's compatible activation is accepted, start a NEW
browser run without session injection, using actual UI and real existing MFA.
Stop at the first real boundary; retain original attempts/28templates unchanged.

Request/refresh/denial/logout/Context/UNKNOWN and one real effect remain pending.
The fresh browser Request restart claim is still
PLATFORM17-INTEGRATED-BROWSER-RESTART-01 and may occur only after a real new
Request and refresh. Historical Docker ACK remains UNKNOWN; restore NOT_RUN.
No raw trace/session/credential/private guide is part of this source packet.

Automation: نیازمند بررسی. Exact pin/CORS/transition checks are mechanical;
Coordinator approves compatible source/binding, Platform owns execution and
UNKNOWN escalation, Procedure/Antigravity review actual evidence. Value is
preventing fake readiness/repeated effects; no new authority or engine follows.
