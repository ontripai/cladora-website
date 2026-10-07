# AIRPROP opportunity input contract 003

Date: 2026-10-03
Parent: CLADORA-WORKSPACE-NATIVE-OPPORTUNITY-CONTRACT-v1.0.md
Status: implemented input validation and persistence-key descriptor only.

## Delivered behavior

`src/lib/airprop/opportunity-contract-v2.ts` validates a strict version-2 request:
version, context_id, workspace_id, idempotency_key and payload. The workspace is
explicit and the existing canonical property_id is optional. There is no generic
unchecked subject_type/subject_id pair or artificial physical anchor.

The strict payload accepts name (1–160 characters), country_code RO, city (1–120),
currency RON/EUR, positive asking_price as an exact decimal STRING, optional
property_id and optional source_ref (1–500). Text is NFC-normalized and trimmed;
ASCII control characters are rejected. Nonempty multilingual names are retained.
UUIDs normalize to lowercase. Omitted optional references normalize to null.
The price preserves the existing numeric(20,4) storage range: up to sixteen
integer digits and four fractional digits. It normalizes to four places without
floating-point conversion. Numeric JSON values, exponents, separators, leading
zeros, negative/zero amounts, excessive precision and overflow are rejected.

These are proposed V2 input limits; existing V1 SQL limits/behavior are unchanged.
No claim is made that every commercial workflow is limited to this opportunity
payload. Further agreements, mandates and commercial resource types belong to
their own delivery slices and the shared registry contract.

Client-supplied tenant, actor, creator, membership, status, approval and input_hash
fields fail validation at both envelope and payload levels. Valid syntax does
not authenticate the caller, establish a mandate or authorize any reference.

## Idempotency descriptor

`opportunity-idempotency-v2.ts` takes the request and a SERVER-RESOLVED tenant/workspace
pair, checks request/workspace equality and returns these persistence-key fields:

| Component | Value/source |
|---|---|
| namespace | airprop.opportunity.create.v2 |
| tenant_id | trusted core resolution |
| workspace_id | trusted core resolution matching requested workspace |
| idempotency_key | validated client key, 8–128 allowed ASCII characters |
| input_hash | SHA-256 of the normalized, explicitly ordered business payload |

The required future uniqueness key is
(namespace,tenant_id,workspace_id,idempotency_key). This slice DOES NOT install
that key or change legacy (tenant_id,idempotency_key) uniqueness. The descriptor
has no storage access and does not decide whether a retry succeeds.

The hash includes version, workspace and all business fields. It excludes the
context ID and key: a fresh equivalent authorized context may retry the same
command, but every retry MUST authenticate and authorize again. Key-order changes,
equivalent decimal forms and omitted versus null optional references preserve
the normalized hash. Changed business fields conflict in the future gateway.
Different workspaces produce distinct workspace key components and hashes.
Tenant remains its own required key component even when payloads match.

No hash is an authentication signature. A caller must not supply the resolved
scope from HTTP input, infer it from a physical subject or treat the descriptor
as proof of access. Database concurrency still requires an atomic unique key,
locking/compare-and-swap and transaction-safe audit/outbox behavior.

## Gateway prerequisite and execution order

The core audit is recorded in
CLADORA-WORKSPACE-NATIVE-CORE-PREREQUISITES-003-v1.0.md. After that prerequisite:

1. Validate request shape; authenticate current session and AAL2.
2. Resolve the selected canonical context; establish named workspace authority.
3. Check exact target, current grant/membership validity and canonical effective
   opportunity.manage permission. If property is present, also validate its
   canonical tenant, workspace binding and context ceiling.
4. Build the descriptor from trusted identifiers; perform the atomic v2 lookup.
5. Deny a changed normalized payload, or return the existing SAME-WORKSPACE
   authorized result. Create one opportunity/audit/outbox transition otherwise.

No endpoint imports these modules yet. No command, customer UI, authorization
grant, migration, backfill, booking, agreement, invoice or payment is delivered.
Underwriting/read integration and audited legacy resolution remain prerequisites
for a complete workspace-native commercial flow.

## Verification

Run `node scripts/test-airprop-opportunity-contract-v2.mjs`. The test compiles and
executes the actual TypeScript modules, with strict TypeScript checking, rather
than reproducing their logic in the test. All 66 behavioral checks passed locally.
Focused ESLint, full application typecheck, existing npm run test:unit and
git diff --check also passed. A dedicated path-triggered workflow runs these
checks in CI. Local results do not imply full CI or runtime database certification.

The changed paths do not overlap the inspected #215/#217/#218 work. Dependencies,
existing shared authorization files and existing workflows remain unchanged.
