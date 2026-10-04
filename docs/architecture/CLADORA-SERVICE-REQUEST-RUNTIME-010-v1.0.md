# SERVICE non-binding request runtime 010

A published catalogue offering can now receive a request through `/api/customer/v1/services/requests` and the three-language catalogue form. This expresses interest only: it does not accept commercial terms, reserve capacity, create an order, authorize payment or create a maintenance work order. Reservation offerings are excluded until a capacity contract exists.

The guarded SQL resolves the authenticated actor, tenant and membership through the shared native workspace authority. Separate `services_orders` module bindings require `services.orders.read` or `services.orders.request`; submission also requires canonical `services.catalog.read`. Registry entries alone grant no account access and do not activate a module or entitlement.

Only the current membership's valid `identity.membership_parties` link can supply a beneficiary. The form and read RPC disclose no tenant-wide person picker. History is limited to the current actor, membership and workspace, latest 50 entries. The pinned revision must still be the current published revision. Offering, revision, definition and provider are locked and checked. Private table privileges and RLS prevent direct client writes.

The actor/workspace-scoped idempotency key and trusted SQL fingerprint serialize duplicate requests. Live permission and beneficiary checks precede saved response replay. Request, audit, outbox and saved response commit together. A failed audit rolls back all four. An exact retry returns the original result without another request. Replay preserves the original request even if its offering later changes; new requests require an available publication.

The UI freezes an uncertain command and retries its exact payload/key. A confirmed write remains confirmed if history refresh fails. Context/workspace remounts abort old reads/writes and clear local commands. Pending commands are not persisted across page reloads. A definitive conflict offers a catalogue refresh.

Validation uses actual migration execution in isolated PostgreSQL/PGlite with bounded canonical-authority fixtures, route execution with an authenticated-client mock, and actual rendered React components. CI additionally exercises duplicate requests using independent PostgreSQL 17 connections. The shared authority suite remains the full implementation regression gate. Production pilot request acceptance is a separate check after deployment and explicitly scoped access.

On 2026-10-04, read-only production inspection found a verified person link on Parastoo's owner membership b9daf668-0dbf-4598-a4c7-c03e21b03bf5. Mahmoud's administrator membership and Parastoo's review membership had no person link; neither may be used to bypass the beneficiary rule. Existing catalogue publication b88ab924-7c5c-48df-9230-9a3342fa5f6c is retained; no duplicate offering is needed.
