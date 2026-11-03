# Core CE012 closed binding matcher v1 — Core14

Base/Parent: `1971770a7ee92c2020387c5222b0c7da03a552d8`.
Branch: `codex/program-core-service-s01-producer-01`.
Documents09 input: `f64fa2dacf895fdea698e46ffc178aa0d8270f0e`.

## Official read-only ABI

`matchCoreCe012ClosedBindingV1(exactHostResult, exactResponseBytes: Uint8Array, expected: unknown)`
resides at the existing host's PRIVATE `jointResults` boundary. It never returns
that binding or token. `coreCe012ClosedBindingExpectationV1Schema` is strict at
all levels. Its inferred type is `CoreCe012ClosedBindingExpectationV1`:

- `contract`: `core-ce012-closed-binding-matcher.v1`;
- `command`: complete existing strict `coreTransactionCommandV2Schema` command;
- `binding`: every field below is REQUIRED, with no extra fields accepted:
  - UUIDs: `transaction_id`, `actor_id`, `tenant_id`, `context_id`, `workspace_id`,
    `membership_id`, `command_id`, `ce_save_receipt_id`, `core_receipt_id`, `mutation_id`;
  - positive safe integers: `attempt`, `backend_pid`, `authority_revision`;
  - positive decimal transaction string: `database_transaction_id`;
  - exact canonical `canonical_key`, SHA256 `command_hash`, `core_receipt_hash`;
  - strict `target`: UUID `document_id`, UUID `document_version_id`, positive safe
    integer `document_version`.

Returns frozen `{contract, match: 'MATCH' | 'NO_MATCH', status: 'not_ready',
projection: null, current_authority: 'not_evaluated'}`. Denials contain no field
values, private labels, candidate/token, timing, authority receipt or diagnostic.
No wall clock, receipt generation, query, host execution, registration, retry,
reservation, mutation, callback, verifier or configurable owner import is added.

Only the exact result OBJECT already recognized in both existing WeakMaps can
match. Its response bytes must match the retained byte image exactly and its
closed replay settlement/seal must agree. The canonical command hash is recomputed
from the parsed full command; a hand-built hash alone cannot stand in for it.
Every binding scalar and exact target is compared against the retained PRIVATE
record, including independent CE/Core/mutation identities, member, scope, revision
and execution identity. Missing, extra, malformed or mismatched expectations fail
closed. JSON expectation data is only a comparison description: JSON/copied
results, opaque candidates and external allow/verifier values cannot mint a record.

`MATCH` describes ONLY historical equality to the host-created closed record.
It is not live session/authority, custody, publication, current disclosure,
commit of a new command, or delivery acknowledgement. Core13's actual candidate
is already closed; no other candidate is adopted by comparing its JSON shape.
Both historical Docs slots stay BLOCKED; runtime binding remains NULL.

## Scope and owner handoff

The sole production change is an ADDITIVE synchronous matcher/schema block in the
existing host file. Removing that block exactly reconstructs the entire Base
host bytes. The Core13 transaction, preflight, fixed Docs observation, settlement,
cleanup and result registration remain unchanged, as do all Core12/installers.
No Documents file is copied or edited. The existing fixed Core13 owner factory
stays pinned to 6f69db; its bytes are IDENTICAL in the supplied Docs09 commit.

The real Docs09 adopter still returns
`OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED`, including the known changed-CE-ID
counterexample. This Core-owned ABI closes its missing comparison primitive;
Documents must separately consume the accepted Core FullSHA, supply the complete
strict expectation (including canonical tenant/member/execution identity), and
retain its own disclosure/NOT_READY gates. Core14 does not change that adopter
or declare its integration complete. No arbitrary callback is a substitute for
this matcher. No current-authority claims are created.

## New verification only

`node scripts/test-core-ce012-closed-binding-matcher-14.mjs` extracts existing
fixture DEFINITIONS only, not prior test bodies. It loads actual Core/CE R1,
unchanged actual Docs factory and real Docs09 adopter from pinned Git source.
The controlled in-memory transport creates real host PRIVATE records; it is not
native database/Auth/lock/clock/driver/custody evidence. Source identity, inventory
seal and exact additive source reconstruction are checked in the same new test.

Controls include valid exact record; Docs09 counterexample before/after; independent
mismatch of every binding/target/full-command field (including coherently recomputed
supplied hash); omission of every required field; malformed/extra fields/types;
CE-ID change with SAME actual result/bytes; copied/forged results; bytes mismatch;
actual UNKNOWN settlement; different real invocation/DBtx; zero matcher queries,
write/attempt/registration changes; positive control. Old 23+33 suites NOT_RERUN.

Full repository ES5 typecheck, limited lint, MJS syntax and diff checks are separate
source checks. SQL/parser/PG/Auth/Storage/lock/session/native settlement, activation
and final owner assembly remain NOT_RUN_NOT_PASS. No package/config/lock changes.

خودکارسازی: نیازمند بررسی؛ ورودی رکورد بستهٔ رسمی و expected نسخه‌دار؛ بخش
قابل بررسی تطبیق خواندنی و کنترل منفی است؛ تصمیم پذیرش با coordinator و
Core/Documents؛ شرط اجرا نسخه‌های رسمی و scope مصوب؛ استثنا به مالک همان مرز؛
وابستگی Core13/Docs09 و proof مستقل؛ ارزش هنوز سنجیده نشده و مجوزی ایجاد نمی‌کند.
