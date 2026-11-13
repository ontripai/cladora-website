# CE010 — inactive installation and dependency packet

Owner: CLADORA CE / CLADORA-CE-WORKER-01. Base: `d23346a88253290d8842dfa0780a67c00c250390`.
Input: Viewer Page `page_9e19234d21b88191b17ef6685d75f153`, sequence 29,
“ادامه موازی کارت های جاری”, CE010 card. Viewer grants no Page editing rights.

## Delivered source

`supabase/install/ce010-announcement-v1/` contains local, review-only
preflight, fresh-install candidate, verify and recovery SQL, plus `packet.json`.
**Every SQL file raises SQLSTATE 55000 before any catalog read or DDL.** No tool
removes that guard or connects to a database. These are review inputs for the
existing Core/Platform installation lane, not an installer, migration, admitted
ACL, permission to run SQL, or activation recipe. `activation`, target, role names
and Core admission/seal slots remain NULL. There are no credentials or private
session/binding/evidence files.

The packet reuses exact canonical declaration spans from the existing CE
proposal: three tables, five indexes, four routines. Constraint/default/index
SQL and function bodies are unchanged. `content_reports` is necessary because
the accepted read RPC references it, even in the announcement-only slice. No
report writer, legacy community command RPC, alternate CE receipt ledger,
receipt trigger, permission/module seeds, schema creation or shared Core grant
is installed or duplicated. Existing C03 remains the sole transaction,
idempotency, receipt, audit and outbox authority. Existing provider INSERT/UPDATE,
HTTP factory, QFW-CE010-01, same-ID/version/replay/UNKNOWN wire and all Guide
files are byte-identical to the base.

## Reproduce without target access

Use the already provisioned toolchain; no install or package/config changes:

```sh
node scripts/build-ce010-install-packet.mjs --output=/absolute/fresh/local/directory
node scripts/test-ce010-install-packet.mjs
```

The builder requires immutable whole-source pins before extracting spans and
query inventory. It uses the installed TypeScript AST only to inventory TS
string literals; **it does not parse or execute SQL**. Some Core templates are
explicitly marked `Core closed-admission expansion`; listing them is not a
closed SQL/admission proof. Nonidentical existing output is rejected before any
write; existing WIP is preserved. `packet.json` records input roots, byte
spans/lengths/hashes, function signature/body hash/definer status, query sources,
exact CE column requirements, proposed policies, omissions and SQL file hashes.
It does not claim an observed database catalog.

Independent regeneration checks all executable file bytes **before** trusting
mutable packet hashes. Re-sealing altered SQL cannot authorize extra DDL,
grants, owner changes, policies or removing the review guard.

## Proposed CE rights; no role authority inferred

Only distinct ordinary NOLOGIN domain-owner and executor roles are considered;
the real names, OIDs, membership graph, runtime principal and exact target must
be supplied and sealed by Core/Platform. The domain creator is also its owner;
this packet makes no role, membership, schema or ownership transfer. The
admitted Core/Platform wrapper must supply and close its temporary schema-CREATE
lane. The domain owner retains **inherent DDL/admin power**; FORCE RLS does not
remove ownership or make that principal read-only. The `owner.SELECT` inventory
in packet.json lists query requirements, not an ownership privilege ceiling.

All three CE tables propose ENABLE + FORCE RLS. Executor grants are column-only;
there is no executor report write or table-wide grant. The read definer's full
accepted audience filtering remains intact. Proposed RLS also checks canonical
current-time Context/Workspace/read authority with fully qualified outer tenant
columns. Publish does not silently grant read, report or organizational roles.

The existing provider locks Community with `FOR UPDATE` without updating it.
PostgreSQL requires an UPDATE privilege for that row-lock query. The candidate
therefore proposes only `UPDATE(version)` with a scoped UPDATE policy whose
`WITH CHECK(false)` prevents actual Community updates. **This combination has
not been run against PostgreSQL** and is an explicit Core/Platform acceptance
gate; a class assertion/source test is not row-lock/RLS proof. Existing C03
Workspace/revision row-lock privileges remain Core's responsibility.

CE postchecks reject owner/RLS drift and excess table/column/function ACLs, and
check the expected policy count. **These checks alone are not a complete
postimage seal.** Full policy expressions, defaults/constraints/indexes,
function ABI/body/properties and protected role/defaultACL snapshots must be
compared inside the separately admitted Core wrapper before a real COMMIT.
No wrapper/admission is asserted here. Existing target objects, even apparently
identical ones, block the fresh-only candidate; reconciliation is a separately
reviewed delta, never DROP/replay/adoption by name.

## Core / Platform handoff

`dependencies.json` gives exact root table/column/function consumers and closure
owners. Shared-object requirements are **not grants**. In particular:

1. Core must deliver/admit the request-local CE010 producer and mapping for
   `community_basic`, `module.community_basic`, read and publish, and the
   CE-proposed `community.announcement.command` purpose. The existing consumer
   `CE010_ANNOUNCEMENT_RUNTIME_V1.resolve` remains NULL. Its proposed input/output
   requirements are not presented as an official Core factory ABI.
2. Core owns C01/C03, recursive evaluator/lineage/session/default/sequence
   dependencies, source/role/helper seals and exact closed query admission.
   Platform owns the target, role-safe leases, private pool, server-only verified
   claims/scope carriage at every BEGIN and cleanup. The original Request,
   issuer SID/exp/AAL2 and current authority must bind every use. A copied
   SERVICE/Guide pool or caller JSON is not an implementation.
3. App injects only the official provider into the existing CE slot after those
   inputs are real. Current routes remain unavailable/fail-closed meanwhile;
   no legacy fallback or stronger service principal is added.
4. Platform must establish the canonical Community parent through its accepted
   owner path before exercising announcement creation. This slice does not
   invent a Community provisioning writer or fixture. Native create→publish→
   cancel, same-ID readback/restart, audience, version, denial, revoke/expiry,
   same-key replay/UNKNOWN and independent QA remain **NOT_RUN_NOT_PASS**.

Catalog readers select bounded object metadata and role flags, no app/session
rows or secret catalog fields. Direct role edges do not prove transitive
SET/INHERIT/ADMIN closure. The metadata diagnostics accept a supplied reference
only as an offline comparison input; a truthy `core_seal` is **not authenticated
or sufficient to execute anything**. There is no runtime code consuming the
comparison. Missing reference/seals are BLOCKED. Drift/partial/unsettled state
is UNKNOWN/no ACK/no mutation; exact postimage means no replay; exact empty
preimage permits human review of retry, never automatic execution.

## Evidence boundary

23 new source-byte/synthetic-catalog controls passed. They include coherently
re-sealed negatives, qualified scope references, protected role/defaultACL
changes and conservative recovery/output-conflict handling. No old product
suites, frozen Guide/QFW witnesses, parser, SQL, Auth/PG, native browser,
installation or activation were run. Typecheck/lint results are recorded in the
delivery manifest. No Page or central issue record is edited in this Viewer
wave; Coordinator owns that record.

خودکارسازی: نیازمند بررسی؛ بازتولید و تطبیق بایت‌ها تکرارپذیر است،
اما تصمیم admission با Core/Platform و پذیرش مستقل با QA است.
