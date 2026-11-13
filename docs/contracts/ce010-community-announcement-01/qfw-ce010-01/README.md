# QFW-CE010-01 — final read verification ordering

Task: CE010-COMMUNITY-ANNOUNCEMENT-01. Direct parent: `cd6e84ffe8a11ce6f8e6a1ff365d1f358aeaf2f0`. Same branch `codex/ce010-community-announcement-01`. QA reference: https://github.com/ontripai/cladora-website/issues/463#issuecomment-6718763075 . Source fix awaiting independent QA review; native admission remains open.

## Reproduction and correction

Before: initial SDK -> canonical read/projection -> last canonical Context/Workspace/read/session guard -> acknowledged rollback/release -> final SDK await ->200. The final SDK wait could coincide with read revocation while actor/SID/AAL2 remained unchanged. The targeted before-test reproduced200 instead of403 on the exact parent.

After: initial SDK -> canonical read/projection -> final SDK verification await -> last canonical Context/Workspace/read/session guard in the admitted read scope -> acknowledged rollback/release -> response encoding. No new SDK/source verification wait follows that last guard. The SDK verification remains the official existing authenticator; no caller allow callback or substitute authority is added. Prepare/execute POST source, canonical SQL constants, audience projection, header policy and SDK verifier body are unchanged.

This closes the reproduced source-composition window. It does not promise permanent authority after transaction settlement/network delivery or establish native currentness. Actual role/lease/C01 barrier and installed current-time helpers remain Core/Platform admission responsibilities.

## Only affected checks run

The existing test setup gains a per-call SDK wait hook. No old case executes when these exact names are selected with `--case` in `scripts/test-ce010-announcement-c03.mjs`:

- QFW-CE010-01 revoke during final SDK wait withholds the former read projection: before FAIL200vs403; after PASS403/no projection/no modeled business write.
- QFW matching SDK precedes final canonical guard and rollback; bounded no-store read: PASS200 for matching current identity; traced SDK before last guard before rollback, no SDK after guard; same no-store/private/VaryCookie/native marker.
- QFW actor SID expiry and failed final SDK verification withhold without fallback: four direct controls PASS; actor/SID drift and expired SDK session401; SDK error503; no source row/error details or weaker reader.
- QFW revoke and restored GET cannot settle earlier UNKNOWN or replace its exact wire: PASS403 then authorized200, identical pending object/wire retained, no POST/new command or second modeled effect.

Four targeted groups (seven variant/control executions inside these groups) passed with the actual corrected route/consumer and controlled SDK/physical SQL responses. The UNKNOWN control uses the existing actual session/Core host to establish its modeled lost reply; it does not rerun the prior lifecycle suite. No14previous owner groups, QA suite or historical Guide/G1/G2/Request/MFA suite repeated.

Full unchanged-target TypeScript ES5 noEmit PASS; scoped lint of the one modified production TS file and affected MJS PASS; syntax/diff/identity checks PASS. Actual cache: Next16.4.1/Zod4.6.6/TypeScript5.9.3/Node24.19.0; no install/config change.

No native browser/issuer Auth/PG/SQL/parser/installation/RLS/restart execution. Real currentness remains NOT_RUN_NOT_PASS. Both domain runtime resolver and Guide provider stay NULL. Wire/hash/receipt/provider/persistence, UI/Context, Core/Auth/Docs/SERVICE and SQL/package/lock are unchanged.

Manifest contains before/after identities and local evidence digests (not a shared evidence path). The old manifest is a historical snapshot and remains unchanged. No private logs/credentials/binding or source paste in the issue report.

Skills policy CLADORA-SKILLS-USAGEv1.1.0; existing AGENTS/installed Next, managed runtime/network and Supabase security guidance retained. Automation: نیازمند بررسی؛ wait-order/source checks are mechanical candidates; Platform native execution and independent QA remain the existing ownership gates, not an automation grant.
