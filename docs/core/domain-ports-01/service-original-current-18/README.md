# Core18 — original/current observation and private revision-source

Parent22e0192ef03cbeec6b483e54b8aceed84db061a1, same branch. Core15/16/17 remain
unchanged. New SERVICE input d1b85ef23779025f9c792c7b1cb37a2852d91d15 was imported
as objects only from the official3540-byte bundle; Parent8393 and Treeca8f5d298487802783b2ab1632825c0b51062187 MATCH. No consumer file changed.

## Actual need for two bindings, not permission to dispatch stale commands

The new controlled coupling executes actual SERVICEd1 authoring composition,
Core17 custody, official Auth/identity and C03 host with canonical authority
provider. Current permission remains true at revision8; recovered command still
has original revision7 and unchanged bytes. The actual host returns
`denied/AUTHORITY_DENIED`, ROLLBACK, before reading/reserving a C03 key or DML.
The known stored preparation stays present. This is a controlled transport witness,
not native PG, an unknown COMMIT proof, or the full consumer-resolver native flow.

This is intentional fail-closed behavior in the current ABI:
- canonical provider requires observed version == requested command version;
- host builds its authority request from the immutable command;
- receipt/provider/entitlement and replay validation bind that same version;
- changing the command to8 changes its request hash and conflicts with original7.
No fingerprint, receipt, evaluator or guard was changed to make this green.
A caller-supplied boolean/current epoch or memory snapshot cannot bridge it.

`observeCoreServiceOriginalCurrentBoundaryV1(scope, originalAuthorityRequest)` is a
versioned internal read-only DIAGNOSTIC, not host admission or an authority token.
It separates the historical request from a fresh canonical DB epoch observation,
uses the existing resolver/evaluator/binder, and rechecks the existing same-scope
session/permission/epoch after waits. Current denial dominates. Same version yields
`aligned/EXISTING_C03_RECHECK_REQUIRED`; allowed-current8/original7 yields
`hold/ORIGINAL_CURRENT_C03_ABI_REQUIRED`. Every result has dispatch_admitted=false,
action_authorization=not_evaluated and reusable_as_authority=false. A diagnostic
request's current version is never copied into the original command. No execution,
query port factory, caller verifier, retry engine or settlement is exported.

The selected behavior is safe hold, not an automatic C03 ABI upgrade. To permit an
original command across epoch changes in the future requires an explicitly versioned
host/receipt/replay dual-binding contract: canonical persisted original wire/hash and
original identity remain immutable; a separate same-attempt current observation
must bind actor/session/Context/Workspace, permission, entitlement, effect/receipt,
DB transaction/backend and final waits. Existing historical receipts must still
match their old bytes; neither old allow nor new allow is transferable. A missing
receipt/unknown COMMIT must recover the same key, not run a replacement. A wider
positive execution ABI is not implemented or silently enabled in this increment.

## Executable private revision-source; missing writer stays missing

`readCurrentOfferingRevisionForAuthoringV1(scope, expected, originalAuthorityRequest)`
reads the actual `service_catalog.offerings` and `service_catalog.revisions` through
the existing live host scope. The expected shape is exported as
`coreServiceOfferingRevisionExpectedV1Schema`; it compares exact tenant/Workspace,
Offering/head lock_version, current old revision ID/version, Party and agreement
ID/version. Queries are fixed parameterized SELECTs, head then old revision SHARE.
Content comes from locked canonical rows, never input JSON. Current canonical
session/permission/version is re-observed after the final read wait. Expiry uses
server time and the existing exact microsecond helper; start inclusive/end exclusive.
Malformed/missing/ambiguous/unversioned/foreign/mismatched source is redacted with
source=null. Historical NULL versions are not backfilled or relabelled.

Even a matching source returns full status=not_ready, source_status=matched_private,
projection=null, provider_agreement_verification=not_evaluated and no dispatch or
current-authority grant. It is an internal snapshot, not a public disclosure port.
Canonical S01 agreement validity/scope is deliberately not inferred from IDs. The
actual accepted authoring S01 profile currently excludes service.offering.revise.
The actual Core authoring host accepts create/transition (and separate Quote),
not revise. These closed guards were preserved, not bypassed by this reader.

SERVICE owns the exact revise plan/schema and writer ABI under revise-contract.json.
Until received, Core cannot choose new revision body/ID semantics, expose a fake
revise method, use create as revise, or admit the operation. admission.json records
that precise dependency and the Core source/host/S01 work which follows it. Current
producer source, read-SQL admission and role/RLS/row-lock privileges are separately
reviewed by Platform; presence of SELECT text grants no FOR SHARE permission. Native
writer/reader lock order and actual adoption must be verified before installation.

## New affected checks and counterexample

Eight new groups across targeted runs: original/current aligned/hold/denial;
canonical private head/revision; six independent binding mismatches; postwait
session revoke and exact microsecond expiry; same40001/scope/attempt/version drift;
actual SERVICEd1/Core17/C03 mismatch denial with zero reservation/DML; missing/
unversioned/malformed redaction; closed purpose/permission pair before any query.
Old fixture definitions are reused without running12/13/17 previous successful
controls. Full current ES5 typecheck, focused lint, syntax/diff and scratch
apply/reverse were checked for this increment; this is not native proof.

A separate source counterexample remains with SERVICE: service-catalog-schema.ts
serviceOfferingRevisionSchema uses Date.parse in its valid_until refinement.
2026-11-09T12:00:00.000100Z → .000900Z is a valid positive interval per the accepted
microsecond helper, but the real schema rejects it (both truncate to the same ms).
The Core reader reuses that schema and fails closed; it does not remove the check,
round, or copy/reimplement the owner's validator. SERVICE owns a minimal precision
fix and focused schema tests. This false-negative is not a current-authority bypass,
not a native witness, and not a claim that the revision-source is generally ready.

Runtime=NULL, revise admission=false. SQL/parser/PG/Auth/install/activation/native
remain NOT_RUN_NOT_PASS. Documents/Listing and accepted Request remain independent.
Automation: نیازمند بررسی؛ exact source/ABI and binding checks can be automated;
host/receipt-version decisions and Platform execution require their respective
owners. Value is preserving UNKNOWN identity while rejecting invalid adoption.
