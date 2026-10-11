# CLADORA AP10 synthetic AAL2 E2E fixture v1.0

**Package:** `AP10-AUTH-E2E-FIXTURE`

**Owner:** Core/Platform

**Consumers:** AIRPROP authenticated browser and gateway tests

**Environments:** disposable Local; Test/Preview remain blocked pending a trusted identity verifier

**Production:** prohibited

## Contract

`runAp10AuthE2EFixture` creates a synthetic Auth user whose address is in the reserved
`.invalid` domain, signs in, enrolls and verifies a TOTP factor, and proves that the
session is `aal2`. It then provisions the existing Core records rather than a parallel
authorization model:

- one canonical tenant and one tenant-scoped `identity.membership` using the existing
  system role `airprop_portfolio_director`;
- one temporal `identity.context_grant`;
- two active `platform.customer_workspaces` with canonical taxonomy, AIRPROP module
  activation and entitlement;
- a published workspace-local role and current assignment for each Workspace;
- two canonical properties, two buildings, three units, Workspace bindings and
  purpose-bound `workspace_property_authorities`.

Before handing control to AIRPROP, the driver proves `airprop.asset.read` and
`airprop.asset.manage` on both explicit Workspace targets with the synthetic AAL2
identity, then proves the same requests fail closed at AAL1.

The consumer callback receives only in-memory test inputs:

```js
await runAp10AuthE2EFixture({
  // environment and private bindings omitted
  execute: async ({ client, accessToken, contextId, workspaceIds, propertyIds, unitIds }) => {
    // Install the AAL2 session in browser storage or call the AIRPROP gateway.
    // Assert the two-Workspace / two-property / three-unit scenario here.
  },
});
```

The callback result is deliberately discarded. The emitted receipt contains no email,
password, TOTP secret, access/refresh token, factor ID, user ID or resource ID.

## Cleanup guarantee

Cleanup runs from `finally`, including when setup or the consumer fails. It:

1. revokes both immutable workspace assignments and both property authorities;
2. expires the Context, revokes the Membership and archives the fixture roles;
3. unenrolls MFA, globally revokes the Auth session and locally signs out;
4. soft-deletes the synthetic Auth user;
5. queries the current Core records and fails unless no effective fixture authority
   remains.

Core authority history is forward-only and cannot be physically deleted. Therefore the
fixture additionally requires an explicitly disposable database. Local CI guarantees
final physical cleanup with `supabase stop --no-backup` in an `always()` step. Test or
Preview consumers must provide an isolated Supabase branch/database whose lifecycle
controller resets or destroys it after the run. A shared or Production database is not
a valid target.

## Fail-closed environment gate

The fixture runs only when `CLADORA_AP10_EPHEMERAL_DATABASE=1` and
`CLADORA_AP10_TARGET` is `local`, `test` or `preview`.

- `local` additionally requires a loopback Supabase URL.
- `test` and `preview` require `CLADORA_AP10_PROJECT_REF` and
  `CLADORA_PRODUCTION_PROJECT_REF`; they must differ and the target URL must match the
  non-Production ref.
- these labels alone never authorize execution. R1 additionally requires identity
  proof before the first Auth/authority side effect; mismatch does not run cleanup
  against an unrelated client.

The runtime verifies the local project ID from checked-in `supabase/config.toml`
and the live API/database endpoints and key hashes from read-only
`supabase status --output json`. Both actual clients must match that API endpoint,
Auth endpoint and the corresponding local key. The driver compares its configured
PostgreSQL endpoint/database/user to the stack descriptor and probes the connected
`current_database()` in a `BEGIN READ ONLY` transaction. Proof includes environment
classification and project ID; missing or mismatched proof fails closed.
Passwords and key hashes never appear in receipts or diagnostics. No configuration,
secret or environment variable is changed by this verifier.

The current verifier supports Local only. Test/Preview intentionally fail with
`disposable_target_identity_unavailable`: their labels, URL and non-production ref
are insufficient proof. Enabling either requires an independently reviewed trusted
provisioning verifier; this revision does not add a fallback or remote write.

R1 regressions spy on Auth user/MFA creation and authority setup (which owns
Membership, Workspace and DB rows), and assert zero mutations for endpoint,
project, database, environment, key and connected-database mismatches. The driver
checks explicit AAL1 `read` **and** `manage` denial on every Workspace; null or
missing decisions fail closed. Existing AAL2 allow, revoke and redacted cleanup
receipt guarantees are retained.

Private bindings are read only from the execution environment:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_DB_URL`. Never pass their values on a command line, place them in a fixture,
artifact, PR comment or test log, or expose them to browser code. Only the synthetic
AAL2 access token is handed to the consumer callback in memory.

## Local and CI execution

With a clean local Supabase stack already running and migrations applied:

```sh
npm run test:ap10-auth-fixture
npm run test:ap10-auth-fixture:runtime
```

The runtime command is wired into `Database tests`. The workflow obtains local-only
keys from `supabase status`, masks them before use, runs the real GoTrue TOTP flow and
canonical authorization gateway, and always tears down the ephemeral stack. Local TOTP
enrollment and verification are enabled explicitly under `[auth.mfa.totp]` in
`supabase/config.toml`; this local CLI setting does not change any Remote or Production
Auth configuration.

## AIRPROP consumption

AIRPROP should wrap its browser scenario in this fixture and use the supplied
`accessToken`, `contextId`, and explicit `workspaceIds`; it must not infer the first
Workspace. AIRPROP may add its own mandate/report rows inside the same disposable
database, then verify the AP10 management flow, authority revocation and context
remount. The fixture owns Auth/Core authority cleanup; AIRPROP owns cleanup of its
domain rows. Neither side may enable routes or operate on Remote/Production data as
part of this contract.
