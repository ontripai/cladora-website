# SERVICE R10 target compatibility / two fixed façades

Status: SOURCE_PACKET_PREPARED; target UNCHANGED; native NOT_RUN_NOT_PASS.
Parent: ef27911abce11d1a9e39607ed4d5c894d7b282d7.

Private PLATFORM-SERVICE-R10-TARGET-PREFLIGHT-13.md was read and independently
verified: 8287 bytes, SHA256 2615cc0a32e3519693d72a68b24ba8e3bb9905d7e70ef29c6341a21a82e7c00e.
The observation is evidence of the stated prestate, not installation or ongoing
identity. Raw metadata, report and private SERVICE source remain private.

| Boundary | Observed gap | Packet / remaining gate |
|---|---|---|
| Data API | customer_api not exposed; authenticated cannot use schema/functions | Only two fixed platform_dev façades. No exposure or customer_api caller grant |
| Bootstrap | dedicated Quote owner absent; installer effective Auth privilege has no grant option | Real lifecycle custodian delegates only fixed dependencies, then ordinary installer; one transaction; actual grantor removes temporary membership |
| Store | quote_drafts and reservation store absent; Request unique target missing | Exact narrow historical Quote DDL, safe request_version field; canonical R10 reservation/functions; no second ledger |
| C03 | Request lock/read and Quote insertion missing | Column grants + current canonical permission/session RLS and exact reservation/Request binding; no audit/outbox/ledger widening |
| Consumer | R10 SDK adapter selects customer_api | SERVICE-owned fixed-literal schema adoption required; Core does not edit its files |

## Fixed transport / exact errors

See facade-contract.json. Both SQL wrappers are SECURITY DEFINER, owned by the
same dedicated canonical store owner, search_path=pg_catalog. They call one
fixed canonical function each. An INVOKER wrapper would require the caller's
missing customer_api USAGE/EXECUTE, so would not solve the observed gap.

The JSON envelope is canonical input only; actor, tenant/scope, session/AAL2,
current services.quotes.manage authority and post-wait checks remain in the
original R10 bodies and C01 providers. Selectors do not establish authority.
All four entire canonical function definitions (including headers/delimiters)
remain byte-identical. No exception catch or error translation exists in the
façades. Existing SERVICE SQLSTATE mapping, especially same-object 40001
propagation to the trusted host, remains the consumer contract.

The actual R10 consumer at bd6b9033cc6ca8a4f882cc6efa209a9c8b584f63,
src/lib/customer/service-quote-canonical-store-v1.ts, still calls
`client.schema('customer_api').rpc`. SERVICE must adopt only the fixed literal
`platform_dev` in that internal call (or a separately reviewed fixed adapter),
with unchanged function names, arguments, response validators and errors. No
schema option from caller, exposure fallback or resolver activation is approved.
This owner dependency is not claimed complete by the Core source packet.

## Reconstruct / review offline

Use the exact private SERVICE R10 bundle and prerequisite recorded in manifest;
no historical broad installer replay. Core composer reads only the pinned Git
object and authored fragments, validates exact source identity, emits source
without env/credentials/connections and does NOT run SQL:

```
node scripts/prepare-core-service-quote-target-v1.mjs --output=/PRIVATE/NEW-install.sql
node scripts/test-core-service-quote-target-v1.mjs
node --check scripts/prepare-core-service-quote-target-v1.mjs
node --check scripts/test-core-service-quote-target-v1.mjs
```

Output path must be new (wx). The private image embeds the already-private
canonical R10 source and is not a public artifact. `prepare()`,
`readonlyPreflight()` and `readonlyVerify()` return exact SQL images for a
reviewed Platform executor. Raw SQL files here are fragments, not independent
install steps. Order is manifest-defined; do not commit bootstrap independently.

Twenty-one new offline source-invariant groups, JS syntax and limited lint pass;
full TypeScript typecheck is not repeated because no TS/config changed.

Preflight uses observed missing-object state and stops on drift/collision,
owner/RLS mismatch or missing provider privilege. Existing target may differ
by the time execution is authorized. Existing permission registry entries are
not actor grants. No entitlement/session/positive capability is seeded.

Request membership belongs to the beneficiary, which may differ from the
coordinator actor. C03 Quote policies compare that membership to the same
Request, while actor/session/Workspace authority is independently current.
No coordinator==beneficiary assumption or financial action is introduced.

New role has no login/inheritance/bypass or lasting membership/CREATE. Auth
USAGE makes existing PUBLIC auth.email() reachable as well as auth.jwt(); the
scalar/singular/plural GUC accessors are not claimed equivalent or verification.
No provider Auth function, PUBLIC ACL, default privilege, table or owner changes.
SERVICE identity/claim custody remains the existing trusted session contract.

See recovery.md for target admission, exact missing inputs, timeout/UNKNOWN,
COMMIT/backend correlation, pre/post verification and recovery. Success here is
source preparation only. No SQL parser, compile, native PG/Auth/RLS or target
execution was performed. Existing Request/Guide/Listing acceptance is unchanged.

Automation: needs review (نیازمند بررسی): deterministic source composition and
hash checking are automated offline; Platform admits target/custodian and
Coordinator approves execution, with mismatch/UNKNOWN referred back to them.
No execution authority follows from the classification.
