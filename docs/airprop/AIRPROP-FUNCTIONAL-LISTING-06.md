# AIRPROP-FUNCTIONAL-LISTING-06 — request-local checkpoint; task remains open

Shared Base ec639884452cc0cb6dfef520339791a5c20e9b39 was incorporated by FF
from f9d463f0f2ad713824312827fd954ce376219574. No WIP or sizing repair removed.
That Base includes Core14; owner confirmed final Core15 and Platform12 are pending.

The API now resolves native ports after validating input/session, per request.
A configured resolver returning null cannot fall back to static fixture ports.
AAL1 is denied before command runtime resolution. Static-port composition remains
compatible for existing controlled callers. No global authenticated principal/lease
registry is added.

The private request factory composes the actual Core read host and existing AIRPROP
native reader when role-scoped dependencies are supplied. Its returned callbacks
are bound to that actor/Context/Workspace; foreign use is rejected before checkout
or command dispatch. Control delegates only to the supplied official full-selection
C03 bridge. This factory is not a new authority evaluator, owner registry, storage,
accepted Core15 ABI or native producer. It neither expands Core's closed query
admission nor solves the currently incompatible command-only selector.

The installation boundary still returns unavailable because official dependencies
are missing. This is NOT completion of a configured product flow. New publication UI
and durable publish/C03 integration must consume the forthcoming official picker,
canonical producer and command ABI. No synthetic picker, success receipt or fake
persistent backend has been added to simulate completion.

The adjacent dependencies.json records exact existing source/RPC signatures,
requested Core read-selector delta, real canonical permission/purpose mismatch,
principal/expiry/receipt/replay requirements, role/schema/connection needs and
remaining acceptance. Proposed signatures are explicitly not approved ABI.
Core owns read-selector/canonical/C03 delivery; Platform owns the real isolated
role-scoped persistent target/profile; AIRPROP owns final consumer/publication
wiring and connected matrix after those handoffs.

Actual operations here: default Docker socket access was blocked; the required
additional tool permission allowed read-only docker info/ps/image metadata.
Docker28.4.0 is available; no images/containers exist. No SQL, Auth, image pull,
volume/container creation, installation, credentials or staging/Production access.
Absence of images does not forbid future authorized isolated setup.

Reproduce independent boundary checks:
`node scripts/test-airprop-functional-listing-runtime-06.mjs`
Real API/factory/Core read constructor/decoder with controlled session/ports; no
real Auth/PostgreSQL/C03 or durable write. No accepted52 or six browser cases replay.
Connected command is BLOCKED_ON_DEPENDENCY: starting Next alone currently leaves
safe503, and is not Listing functional acceptance. On official FullSHA/ABI/profile
receipt: verify identities and owned target, adapt read-compatible selector, compose
real role-scoped runtime/C03, then implement/use canonical publication picker and run
UI->API->commit->reload/restart readback/denial/conflict/concurrent exact-retry.

Classification: source checkpoint only; functional task OPEN. Native integration,
RLS/revoke/expiry/writer/receipt/currentness and persistence remain NOT_RUN_NOT_PASS.
Self-automation: نیازمند بررسی; scoped read validation/recovery checks are potential
work, current human decisions are Core/Platform admission and explicit user commands;
exceptions to Core/Platform/AIRPROP, dependency official runtime, value unmeasured.
