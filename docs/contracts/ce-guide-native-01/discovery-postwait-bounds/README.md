# Guide discovery: post-wait guard and text-transfer bounds

Direct parent: `c84f13ffeb97a8365385243c7712216d47a04c4e`. Same `codex/ce-guide-native-01` branch. CE010/QFW-CE010-01 is unchanged and not reopened. No native/SQL/parser/installation or target operation.

## Two source corrections

The exact parent reproduced both witnesses. Revocation during the final SDK wait still returned200 with the old selection. A250000character tenant label was rejected by downstream Zod, but the controlled transport had already returned the full label; row LIMIT could not bound that text transfer.

Discovery now finishes the final official SDK verification BEFORE its last per-selection canonical Context/Workspace/read guard and the final current-session guard, while retaining the admitted transaction. Only rollback/lease cleanup and synchronous response encoding follow; no extra SDK verification await after rollback. Actor/SID binding, expiry checks, authority revision, no-store/private and no-fallback behavior remain. This is the requested post-wait boundary, not continuous authority after network delivery.

The SELECT projects each label through `CASE`: only1..256characters and at most1024octets return the complete source value. Invalid values return SQL NULL and an explicit false `transfer_bounds_valid` marker. The consumer requires true and validates all rows; any invalid row or51row overflow withholds the whole response. No `LEFT`, substring, shortened label, silent WHERE filtering or partial first50success. Public schema stays unchanged; the private marker is never disclosed.

At most51rows ×2labels ×1024UTF8octets =104448label octets in that SELECT result. UUID/boolean/metadata/driver overhead is separate: no claim that this is a total memory/framing budget or a target capacity measurement. Guard work/storage reads inside PostgreSQL are also separate from transferred text bounds.

## Core handoff

`core-sql-pins.json` contains exact old/new SELECT text, UTF8 byte lengths and SHA256, unchanged relation/column/row-lock inventory, new pg_catalog length calls and explicit Core acceptance conditions. Core must verify actual types/encoding/overloads/ACL/RLS/ordinary role/lease/currentness and reconcile the exact closed query/source pin; this packet does not grant rights or update Core/Platform allowlists. CASE-builtins require review even though the relations/columns/filters/order/lock targets are unchanged.

The existing Guide provider slot remains NULL. Installed RPC/role/physical query compatibility and native guard semantics are NOT_RUN_NOT_PASS. No parallel adapter/host/evaluator or authority proof is added.

## Affected checks only

Five new scoped cases of `scripts/test-ce-guide-routes-r2.mjs` passed:

1. SDK-wait read revocation: before200vs403 counterexample; after403 with no selection/business writes.
2. Oversize250000character label: before modeled transfer unbounded despite503; after bounded SQL result model and whole-response503.
3. Matching identity and exact256ASCII,256emoji,256combining-codepoint labels: full unchanged values; SDK -> last canonical read -> current-session guard -> rollback; no later SDK; no-store/private/VaryCookie retained.
4. Empty/NULL/257ASCII/257emoji in each label, plus51row overflow: all reject without partial rows or silent truncation; finite modeled transferred labels.
5. Final issuer SID drift, expiry and SDK failure: bounded401/503, no selection/private error/weaker fallback.

Production route, official Core request binder/authenticator and CE read consumer are real modules; only SDK/physical SQL transport is modeled. The fixed independent256character/1024byte expectations model the SQL projection. This is NOT PostgreSQL execution, native driver/network-byte proof, or proof of the CASE/ACL itself. Core has the exact source/pins for that remaining review. No old Guide/CE010/G1/G2/Request/MFA or already successful lifecycle suites rerun.

Unchanged-target ES5 TypeScript noEmit, scoped lint one TS + affected MJS, syntax/diff/hash checks PASS. Actual existing Next16.4.1/Zod4.6.6/TS5.9.3/Node24.19.0; no install or package/config change. Test setup only gained bounded projection/wait instrumentation; no fixture becomes a runtime provider.

Old report/manifests are preserved as historical snapshots. The successor manifest pins before/after source/doc identities and evidence digests; no credential/private target/raw session is published.

Skills: current AGENTS/installed Next, managed runtime/network, Supabase security/Postgres source review; CLADORA-SKILLS-USAGEv1.1.0. Automation: نیازمند بررسی؛ deterministic byte/pin/order checks are candidates, but Core rights admission, Platform execution and independent QA remain owner gates.
