# Listing — direct effect of Core Auth successor

Same AIRPROP-LISTING-NATIVE-01 card; no new parallel task.
Owner Base:c5f57f0ddf77879925909318b448888359a25225.
Core Auth source:ae1fe67187b0b09bcc3fc5b8d22d55d08a7139e6.

Coordinator confirmed QFW-R2-01 source closure on c5f57f0, independently checking
the2counterexamples and23successor controls. That exact source decision is
recorded, not re-run or claimed as this worker's independent verification. Native
Listing is still open. QA matrix/closure metadata is updated only for AIRPROP
against its existing canonical artifact; other lanes/history/native budgets stay.

## Non-cosmetic direct impact and correction

Only the official functional-command-runtime-v1.ts Auth postimage from ae1fe671
is integrated. Blob5c34552afe4323298730e7a622b2f437df1f874b,28727bytes,
SHA256ec5ada6a57427d06dea947da621d0039f51078c8aaeca358349195b5b015f9c0.
No Guide/S01 R3 WIP or old replacement of that shared file is imported.

With that actual Core postimage and the c5f57f0 Listing consumer, verified matching
AAL1 emits stable MFA_REQUIRED but the actual Listing route returned502
LISTING_RESULT_UNKNOWN. This new integration witness is reproduced before the
consumer adjustment; it does not reopen the accepted QFW-R2-01 snapshot.

The existing Listing request-local bridge now maps ONLY the genuine Core
MFA_REQUIRED error to its bounded mfa_required outcome; the HTTP result is403/
MFA_REQUIRED. Invalid/unverified claims or mismatched actors stay401; arbitrary
Zod errors are not MFA evidence. No claims upgrade, port/session/authority,
provider, effect or retry is created. Core verifies identity before the assurance
check and still gives the database only AAL2.

Existing QFW GET/catch classification, read/selector, binding/actions, UI/journal/
wire/key/UNKNOWN and mutation/SQL stay byte-unchanged apart from the new bounded
POST outcome. No old23-case/status sweep or successful native login/MFA replay.

## Actual targeted checks

`node scripts/test-airprop-core-auth-mfa-consumption-v1.mjs --before-dir <c5f57f0 API/runtime snapshots>`:
one real-module integration counterexample502 with stable Core MFA_REQUIRED,
zero pool checkout/preparation/SQL. Both owner snapshots are exact Git source;
Core is the new ae1fe671 file, not an old Auth implementation.

`node scripts/test-airprop-core-auth-mfa-consumption-v1.mjs`:7groups PASS.
Actual Listing route/resolver/Core bind executes over controlled SDK/PG:
verified AAL1403; malformed claims401; actor mismatch401; SDK denial401;
AAL2 reaches only missing-source503; assurance drop after bind stops before host
checkout with403 and original wire retained; AAL1 GET remains independent read.
The prepared-command provider in the drop case is negative-only and must never
be called for authority/mutation. No positive canonical source is fabricated.

TypeScript, limited lint/syntax/diff checks accompany this source. This cache is
Next16.3.8/Zod4.4.3/TS5.9.3; exact target16.4.1/4.6.6 remains NOT_RUN_NOT_PASS.
SDK callbacks are controlled, NOT real Auth/login/MFA; native SQL/DB/RLS/browser/
installation/restart/activation NOT_RUN_NOT_PASS. No dependency installation.

## Remaining native inputs

Full versioned Party/relationship companion, trusted original mapping/replay
producer, actual Platform storage/SQL/limited-role adoption and one real
UI→API→DB/same-ID readback/restart execution remain open. The55000 proposal is
not installed. Guide is not a dependency. Platform executes; QA independently
reviews. Automation: نیازمند بررسی; no new authority is inferred.
