# QFW-R2-01 — Listing HTTP failure categories

Same card AIRPROP-LISTING-NATIVE-01. Correction Base/Parent:
9faf577f37103d3abe3c97fef63704222e3c7922.
QA source report: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6718763075
QA witness source blob:c53869bff9fe3a8c0ce87c018c4d8b1602109319;
results blob:4afab9d8be2218c83139994d6b3452e829667150.

## Scoped correction

listing-flow-api-v1.ts now preserves bounded categories across session, resolver
and operation failures. Actual Core authentication/actor mismatch =>401;
explicit scope/disclosure denial =>403; actual missing producer/host =>503.
Other GET infrastructure/driver failures are503, not evidence of denied access.
Known Core codes require actual Core Error class identity and own data fields;
message matching, plain JSON, raw driver codes, lookalike names and getters cannot
become authentication or business-denial evidence. Core classes are loaded lazily
only when a candidate failure requires classification; no runtime/host/session is
constructed by the classifier. A classifier/import failure remains bounded unknown.

The existing read mapper emits a typed SCOPE_DENIED for its existing withheld/
foreign read branch. This one-line normalization is necessary to retain explicit
403 without treating arbitrary exception messages as authorization. Its authority
mapper, selection, binding and action logic are unchanged. The synthetic fixture
uses that same typed denial; it no longer treats a generic test Error as an allow/
denial contract. No Core source, storage/query, guard, role or permission changed.

POST catch-all was reviewed/corrected in the SAME QFW-R2-01, not a newly reproduced
separate finding. Known preflight/Auth/scope categories stay bounded401/403/503.
Unclassified errors, raw40001 and COMMIT-ACK uncertainty stay502
LISTING_RESULT_UNKNOWN. The existing explicit unknown_commit result remains409
READBACK_REQUIRED; no new retry loop, key, successful receipt or definitive conflict
is inferred. UI/journal/discard/request wire and all binding/action checks are
byte-unchanged. Failed reads release no rows or actor header and preserve private
no-store headers; errors expose no private text, source metadata or driver detail.

## Before/after and direct affected checks

```sh
git show 9faf577f37103d3abe3c97fef63704222e3c7922:src/lib/airprop/listing-flow-api-v1.ts > /tmp/qfw-r2-01-before.ts
node scripts/test-airprop-listing-qfw-r2-01.mjs --before /tmp/qfw-r2-01-before.ts
node scripts/test-airprop-listing-qfw-r2-01.mjs
```

Both QA witnesses reproduced against the predecessor API: actual Core read-host
issuer SDK failure after outer session403; actual native reader/null producer
with QA's exact throwing-host input403. Successor returns401 and503 respectively.
The real R2 host/selector absent-companion path is also tested separately:503,
no domain effects. The second exact QA negative is an opaque unavailable host;
its generic failure is not falsely labelled an explicit authorization denial.

23 successor groups PASS: the two witnesses plus direct GET/POST controls at
session/resolver/operation boundaries, typed Auth/denial/unavailability, raw
serialization/permission codes, uncertain ACK, unknown/private/lookalike/JSON/
accessor failures, actual host40001 and lost read COMMIT discard/settlement,
positive binding/actions and direct null guards, explicit UNKNOWN/malformed
receipt/invalid input. Original Core error identity/metadata is retained;
rolled-back versus unknown settlement remains Core-owned.

Evidence uses real API/Core modules and controlled SDK/SQL transports. Physical
SQL, actual Auth/login/MFA, DB, browser, install, restart and native effects:0 /
NOT_RUN_NOT_PASS. SDK-negative callbacks are not real account operations.
QA observed Next16.4.1/Zod4.6.6; this worker ran existing Next16.3.8/Zod4.4.3/TS5.9.3
without install. Exact-target execution stays NOT_RUN_NOT_PASS. TypeScript,
scoped lint/syntax/diff are separate source checks. No unrelated successful owner/
Request/browser/sizing suite was rerun. This is reported correction, not independent
QA acceptance.

## Unchanged native dependencies

Core R2 selector and command port remain integrated from365d47 exactly. Full real
versioned Party/relationship/currentness/prepared-replay producer is still missing;
no fake companion/authority is supplied. Platform must review actual limited target,
helpers/roles/RLS/ACL and selected-binding adoption/exact SQL admission. The55000
proposal is not an installer. Platform owns the single real Listing lifecycle and
restart/readback execution; independent QA acceptance remains open. Guide is not
a dependency. Automation: نیازمند بررسی; no new operational authority.
