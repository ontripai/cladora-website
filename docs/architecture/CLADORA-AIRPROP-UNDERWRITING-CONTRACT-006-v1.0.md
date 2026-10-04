# AIRPROP native underwriting contract 006

Date: 2026-10-04. Baseline: main e0d8385b11b9c01b1dae94c0735dfe7187d71695.
Status: executable pure input/arithmetic/retry contract; no native underwriting RPC or UI yet.

## Existing model and delivery boundary

Reuse `airprop.underwriting_cases` and append-only `airprop.underwriting_versions`.
Cases inherit immutable tenant/workspace identity from their canonical opportunity;
do not create a second evaluation store or require a fabricated property.
Existing v1 evaluation resolves physical context and cannot be reused as native
authority. Keep its API compatibility; do not silently route v2 into v1.
PR #230 already preserves submitted role expiry; this slice does not change roles.
The previous authorized production pilot established native create/read/revocation;
it did not establish evaluation authorization or approve a new permission grant.

This slice introduces a strict v2 envelope with explicit context, workspace,
opportunity, retry key, expected current evaluation version and assumptions.
PostgreSQL canonical UUIDs include deterministic pilot IDs. Client tenant, actor,
status, approval, result, subject and currency-conversion fields are rejected.

## Arithmetic and assumptions

Cost is positive; annual rent and annual operating expenses are nonnegative decimal
strings fitting numeric(20,4). Expenses cannot exceed rent in this initial simple
model, preserving the existing v1 domain restriction. Loss-making scenarios require
an explicitly versioned extension. Inputs are normalized to four decimal places.
All three values are denominated in the currently authorized opportunity currency,
RON or EUR. No implicit FX, tax, country-pack rule, financing, appreciation,
vacancy, capital expenditure or legal valuation is calculated.

Annual NOI = rent minus operating expenses. Gross/net yield = annual rent/NOI
divided by acquisition cost. Yields are fractions, not percentages, rounded to eight
places half-away-from-zero, matching PostgreSQL numeric `round(x,8)`. Outputs are
decimal strings; no monetary or yield arithmetic passes through Number.
BigInt handles the extreme allowed inputs without overflow or loss of precision.
This calculation has no approval, transaction, payment or ledger side effect.

## Native persistence contract for the next slice

1. Authenticate and require AAL2. Resolve the exact current native workspace target
   and `airprop.underwriting.manage` with the canonical module/entitlement/deny gates.
   Existing `require_airprop_native_context_v2` currently whitelists only opportunity
   read/manage; extending that whitelist belongs to the native runtime migration.
2. Resolve opportunity in the exact tenant/workspace. Check any optional subject's
   current canonical binding. Deny legacy unresolved/null-workspace opportunities.
   Use server-resolved opportunity currency and actor, never request-owned authority.
3. Serialize all evaluations for one opportunity, including different retry keys;
   coordinate with v1 case/version locks, not only a per-key advisory lock.
   Reauthorize after lock acquisition. Recheck scope, subject, currency and state.
4. Look up retry before checking expected_version. Same-key different request hash
   or actor conflicts; an authorized exact retry returns its original version even
   when the current version advanced. A revoked/expired role cannot recover it.
5. For a new command, compare current_version to expected_version (zero for no case).
   Only draft/qualified/underwriting opportunities can receive a new evaluation.
   A stale version is a conflict and produces no writes. Reject int overflow.
6. Reuse existing unique case/input_hash content deduplication, keeping it distinct
   from command identity. The request hash includes expected_version and the
   server-resolved actor; content hash contains only the versioned assumptions.
   Specify equal-content no-op behavior explicitly without moving current_version
   backward, changing creator evidence or emitting duplicate version-created events.
7. Persist immutable assumptions/results plus one canonical audit and outbox event,
   the case pointer, opportunity status and `platform.idempotency_keys` result in
   one transaction. New retry retention cannot remove domain deduplication; a
   durable domain command reference is required before exposing this RPC.
8. Read versions through current opportunity.read authority, exact opportunity scope
   and subject binding. Reuse that permission; do not grant evaluation rights from
   an admin menu. Private no-store GET/POST, bounded errors, and stale-context
   cancellation/pending-command recovery are required in the subsequent API/UI.

Retry identity is tenant plus
`airprop.underwriting.create.v2/<workspace>/<opportunity>/<client-key>`.
Slash separators cannot occur in client keys. Context is omitted from the business
hash because an equivalent current grant can address the same command, but every
attempt still requires current authoritative context resolution. SQL must reproduce
the descriptor's explicit field order/UTF-8 SHA-256; native SQL tests must compare
real results to these vectors before deployment.

## Coordination and completion evidence

Only two new AIRPROP library files, an isolated behavioral test, dedicated workflow
and this handoff document change. No CORE, SERVICE, Operations, dependency, auth,
module, role, customer data or remote migration mutation is included.
Tests compile and execute actual TypeScript for precision, rounding boundaries,
currency mismatch, strict fields, canonical pilot IDs, stale-version request identity,
actor/scope isolation and content-versus-command hashing. They do not claim database
authorization, atomicity, independent-connection concurrency or live browser proof.
Those remain required evidence for the next native runtime slice, followed by UI.
