# SERVICE-FIRST-USER-JOURNEY-12

Core source parent: `ee883b62cf4a318af3450c506931a969623b8987`.
This SERVICE child consumes `core-service-app-read.v1`; it does not replace the
shared AppShell or `CustomerContextProvider`.

## Consumer behavior

The named owned-local assembly profile is selected only when
`NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY=v1` was supplied by the accepted
launcher. In that profile the Service page:

1. calls `GET /api/customer/v1/services/assembly-bootstrap`;
2. validates `contract_version=core-service-app-read.v1` and every complete
   selection tuple;
3. shows the real tenant, role, Workspace type and environment and requires an
   explicit selection;
4. passes exactly that selection's `context_id` and `workspace_id` to the
   accepted catalogue and request-history reads; and
5. keeps the existing V14 command endpoint, body and idempotency key for an
   explicit UNKNOWN retry; while that command is unresolved, the official
   selection control is synchronously locked so its keyed child cannot discard
   custody by switching Workspaces. A later conflict response or successful
   catalogue/history refresh does not resolve an earlier lost acknowledgement;
   only a valid result for that same command releases custody. An initial
   conflict remains definitive under the existing refresh behavior.

An unavailable, denied or malformed bootstrap fails closed. It does not fall
back to `/api/customer/v1/workspace/targets`, guess the first Workspace, or
promote discovery fields to command authority. The assembly view exposes only
the Offering-to-Request slice; catalogue management, Quote and publication
controls remain outside this first journey. Other application profiles preserve
their existing ContextProvider/workspace-target behavior.

## Platform execution handoff

Platform must first provide the already accepted owned, isolated and persistent
Core17/Platform12 environment, committed `catalog-compatibility` and
`read-access` receipts, the sealed runtime binding, and existing synthetic AAL2
fixtures. SERVICE does not install or activate them.

From the exact accepted combined source, Platform's official commands are:

```sh
node scripts/run-core-service-app-assembly-17.mjs build
node scripts/run-core-service-app-assembly-17.mjs start
```

The application origin is `http://localhost:3008`. In a real browser, use the
existing official sign-in and MFA flow, open `/{lang}/app/services`, explicitly
choose the synthetic selection and published non-reservation Offering, submit a
workspace-wide Request with `resource=null`, and record the returned
`request_id`. Confirm that exact ID through the request-history GET after browser
refresh. Platform then performs its official coordinated restart without
reinitializing or clearing the owned database; confirm the same ID again.

The acceptance run must also cover two Workspaces, current denial/revoke/expiry,
late responses, and a lost response followed by an explicit retry with identical
endpoint/body/key and one database effect. Current GET is not proof of a prior
UNKNOWN command. No new key or automatic resend is allowed.

## Evidence status

`scripts/test-service-first-user-journey-12.mjs` is controlled mounted-component
evidence for discovery/selection binding, fail-closed behavior, Context/Workspace
parameters, stale-response fencing, exact-wire UNKNOWN retry and release of the
selection lock only after a confirmed result. It uses no PostgreSQL or Auth and
is not native acceptance.

In the current SERVICE environment the private binding, Auth selectors and
Platform stack are absent. Real browser → API → database commit → refresh →
official restart evidence therefore remains `NOT_RUN_NOT_PASS` until Platform
supplies the accepted environment. Source acceptance does not authorize staging,
Production, installation or activation.

Automation classification: نیازمند بررسی. Contract/schema checks and controlled
selection fencing are candidates; target approval, MFA fixture custody, restart
and final process acceptance remain human-owned.
