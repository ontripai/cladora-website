# CE011 G2 receipt lookup — inactive source candidate

Task V14-CE-01 / CE011-RECEIPT-LOOKUP-04. CE owner.
Parent477ca41c2b75b597b5c0934f6f01bf9c1ac3581a; same branch
codex/program-ce-independent-base-02. G1 stays frozen; no old27/35/G1-26 rerun.

## Contract

Explicit POST /api/customer/v1/community/events/receipt carries the ORIGINAL
bounded command privately. POST is a body carrier, not a business mutation.
Strict existing command schema rejects caller actor/tenant/hash/permission extras.
The route validates but forwards the original object without a second trim or
JSON-derived hash. Server SQL reuses the exact canonical key and jsonb text/hash
expressions from command_ce_event_v1. JSON.stringify is only retained transport,
not a substitute for PostgreSQL jsonb::text canonical hashing.

Additive ce011-receipt-lookup.v1 has only unresolved, or matched + existing strict
five-field command result. No receipt/tenant/actor/member/idempotency row escapes.
The original command/result ABI and lifecycle remain unchanged.

The inactive reader maps each command to its existing permission, resolves the
current actor/tenant/membership/represented-party via canonical CE authorization,
then takes a bounded FOR SHARE lock on an EXISTING idempotency row. It never
inserts a missing key. Lock timeout returns unresolved after reauthorization.
Missing row cannot see an uncommitted insert and conservatively stays unresolved.
After waiting, identity and target audience are rechecked; hash/actor mismatch
fails closed. Expiry uses clock_timestamp AFTER waiting, without renewal.
Receipt request/scope/identity/command/key and response_ref/status/result metadata
must all match. Expected version is derived from the original command, not the
current aggregate state: a historical valid result is not rejected because the
Event subsequently advanced. Exact known Event/correction IDs are checked.
Current authority is checked again before releasing the bounded matched result.
Native snapshot/revocation/lock behavior is NOT established by source inspection.

No command invocation, DML, reservation, expiry update, audit/outbox or receipt
creation. Row locks can cause physical PostgreSQL lock bookkeeping; no zero-WAL
claim. Logical zero-write, effective ACL and transitive authorization effects
require native observation. SQL is review-only with default execution revoked;
no positive grant, owner or installed RPC is assumed.

## Existing session connection

One explicit lookup action is added beside the existing same-wire replay. It
uses the original pending wire, existing flight lock, owner fence, deadline and
cancellation. Response and decoded JSON must still belong to the exact owner and
pending object. Only matched + parseEventCommandResult success clears pending
and publishes the result through the EXISTING accepted callback. Unresolved,
expiry/in-flight, missing RPC, denial/mismatch, bad JSON/result and late response
never clear UNKNOWN, create a new key, resend or call command. Missing RPC is
NOT_READY. Denial revokes page admission. Replay remains the same explicit,
potentially-writing operation. No browser persistence or G3 engine is added.
RO/EN/FA explicit lookup labels preserve the distinction from resend.

## Evidence and native request

New scripts/test-ce-011-receipt-lookup.mjs:13 groups PASS_CONTROLLED. Actual session
and actual route execute with controlled transport/RPC rows. Tests cover exact
wire, valid historical result, unresolved/error/malformed results, scope/result
mismatch, caller-proof rejection, server claims, private/no-store, late decode,
flight/cancellation and exact canonical SQL expression identity. They do NOT
compute a pretend JavaScript equivalent of the PostgreSQL hash or prove native
SQL checks. Test RPC fixtures are not real authority or durable receipts.
TypeScript and scoped lint pass. Available Next16.3.8/Zod4.4.3 only; unchanged lock
c0d6201b9dddab56818ee2c6a547cdba318b0f6979f2a27657b7ac5a41c9b4dc targets
Next16.4.1/Zod4.6.6. New exact-target run NOT_RUN_NOT_PASS; no installation.
Parent accepted exact-lock gates are consumed, not reopened.

Native proof request (Core review then separate Platform admission; NOT executed):
1. Bind this exact child/source hashes, existing CE command/receipt/idempotency
   schema and canonical auth helpers to a reviewed disposable PG17/Auth fixture.
   Missing native schema/caller/owner/ACL/session stops the stage; no fresh
   installer, administrative success fallback, positive grant or runner expansion.
2. Create only owned synthetic original commands/receipts via separately admitted
   fixture setup. Compare SQL-generated request_hash and key byte-for-byte against
   the original SQL writer for all seven command types, Unicode and UUID case.
   Never use client actor/tenant/digest as evidence.
3. Matched and historical results must exactly match recorded entity/version,
   receipt.response_json, idempotency.response_ref and identity tuple. Tamper each
   hash/key/actor/membership/represented-party/scope/result field independently:
   deny without disclosure or writes.
4. Missing, expired, missing response_ref, uncommitted row and lock timeout remain
   unresolved. Concurrent commit can yield matched only after current authority
   recheck. Revoke/expiry while waiting must deny; document actual snapshot/window
   and any canonical currentness gap rather than asserting continuous authority.
5. Separate observer census before/after lookup over domain, idempotency expiry,
   receipt, audit and outbox for every positive/negative case; fixture setup is
   outside measurement. Check actual principal/RLS/ACL and owned cleanup. No row
   count or final rollback alone substitutes for zero durable logical writes.
6. Real HTTP/Auth, native browser and G3 persistence remain separate gates.

Native SQL/hash/waits/revoke/zero-write, issued Auth, installed RPC and browser:
NOT_RUN_NOT_PASS. Source hashes/Git identities bind bytes, not authority or an
operational signature. Normal assigned-branch source push only; no SQL/Auth/DB,
install/grant/activation, Core/Docs/Auth/lifecycle edit, merge or deployment.
