# AIRPROP Listing — official Core R2 consumption

Parent owner checkpoint:2f2867b773713fbb973ab399db76c329b911b4fb.
Official dependency:365d47b59d0cd0b5f7bb13604f1497c2104ed6e7.
Main reference remains6cecfa15b00f445be68817e756d766fb0e6fe026.

Six Core dependency files are selectively integrated BYTE-IDENTICALLY from R2:
airprop-read-host-v1.ts, airprop-read-selector-queries-v1.ts,
current-unit-property-read-selector-v1.ts, domain-command-identity-v1.ts,
functional-command-runtime-v1.ts and listing-command-binding-v1.ts.
This is not a full merge/cherry-pick of Core's Guide/SERVICE increment. No Core
logic/ACL/schema is edited. Manifest records each official blob identity.

## Real consumer change

The actual Listing route delegates to createListingFlowApi, which now passes its
ORIGINAL Request to createListingRequestRuntimeResolverV1. No registry/global
actor, environment guess, service-role or old control bridge fallback is added.

GET uses selectCurrentUnitPropertyForReadV1 inside the actual R2 withScope callback.
Old bindSelector/currentUnitPropertySelector command-receipt construction is
removed. The official selector performs genuine live opaque host checkpoints and
returns real Unit/Property/building/spec identity. Its result is passed explicitly
to readCanonical, joined to the mapped resource version, and its covered expiry
bounds the complete producer's current_until. Selector identity is NOT Party,
relationship, label or command authority.

Missing complete canonical producer => populated Listing read503/NOT_READY after
the actual selector; authorized empty read still200 without requiring management
or companion. Foreign ancestry is withheld, no real spec => NOT_READY,40001
propagates. No synthetic relationship/version1 or first-Unit fallback. The five
stored-binding UI states/independent authority/draft/UNKNOWN rules stay intact.

POST consumes createCoreListingCommandBindingV1(options).bind(originalRequest).
Its exact AAL2/manage/module/purpose profile is independent of GET. Existing API
origin/body/schema/MFA guards remain before control. Official verified Auth denial
maps401; AAL1 is403 before binding. Missing canonical preparation returns503 before
SQL; no positive provider is created to satisfy the port.

When the trusted prepared-control source becomes available, the consumer checks
its original plan against the same parsed request/actor/scope/key/raw-wire
fingerprint and requires provider_current_state_required. It forwards the EXACT
prepared V1 command/providers to the official host, without automatic identity
resolution or replacing command IDs/version/key/epoch/hash on retry. Commit/replay
projection uses the REAL Core receipt/mutation identity and the validated original
control operation; UNKNOWN remains READBACK_REQUIRED. It is not a GET-derived
receipt. The canonical producer must validate/persist the matching native domain
effect and original selection through the existing mutation/replay hooks.

The prepareControl seam must recover the original prepared command/plan under
existing custody on retry. It is missing, not implemented with a Map, fresh random
IDs, guessed epoch, authority boolean or replacement persistence. Default runtime
resolution remains null until actual Platform configuration, and no active native
flow is claimed. Publication/create still needs actual named Resource/Party source.

## Targeted evidence

`node scripts/test-airprop-core-r2-consumption-v1.mjs`:
8 distinct groups established across targeted runs: real Core read-host/selector
and owner API with controlled PG/Auth; no-companion503 vs empty200; no old GET
receipt; foreign/missing spec/40001; version/expiry bound; actual route/official
request-local command bind missing source503 and verified Auth401 with zero SQL;
AAL1 POST403 vs independent GET; exact original forwarding/UNKNOWN/replay and
bad fingerprint rejection. The last command-result projection uses a MOCK Core
result, not a native/C03 positive claim. Full real C03 domain execution is NOT_RUN.

`node scripts/test-airprop-listing-binding-read-ui-v1.mjs --only native`:
3 retargeted groups now use the actual R2 host rather than the old fabricated
scope: absent storage connection preserves read; configured binding SQL cannot
bypass closed admission; copied/model scope cannot mint an opaque checkpoint.
The old6 fake-host groups remain historical evidence, not relabelled R2 proof.
No assertions weakened; unsupported binding-query admission is explicitly denied.

Full typecheck, scoped lint/syntax/diff and official dependency identities checked.
Cache Next16.3.8/Zod4.4.3; exact target16.4.1/4.6.6 NOT_RUN_NOT_PASS. No repeated
accepted52/105/six sizing/browser cases. Native PG/Auth/RLS/helper compatibility,
concurrency/restart/UI: NOT_RUN_NOT_PASS. Chromium remains BLOCKED_TOOL; Platform
is the single actual executor with independent QA. Guide is not a dependency.

## Short remaining input for Platform / Core

1. Core/domain: real permitted VERSIONED Party/relationship family, complete
   companion/discovery/current_until and same-C03 canonical prepared/replay
   producer. PF01 literal version1/unversioned ownership is not a substitute.
   Confirm aggregate/source/fingerprint mapping as part of that actual producer.
2. Platform/Core: exact owned target/limited read and command role/RLS/ACL,
   lock_core_request_session_v1 and functional checkpoint helper definitions/
   owner/EXECUTE, actual canonical sources and row-lock rights. Adopt the selected
   binding table by a reviewed separate delta; DO NOT install the55000 proposal.
   Core R2 still does not admit LISTING_SELECTED_BINDING_READ_SQL; keep its reader
   absent until exact new SQL admission and table rights are reviewed.
3. Platform/QA: after those specific inputs, actual publish/edit/withdraw/republish
   same Listing, readback/reload/restart/denial/concurrency/UNKNOWN execution and
   independent evidence review. No native failure or acceptance is fabricated.

The existing tuple mutation/SQL, UI sizing/journal/wire, Request acceptance,
Core command selector, Guide/SERVICE/shared shell and package/lock are unchanged.
Automation: نیازمند بررسی; no new execution/installation authority is inferred.
