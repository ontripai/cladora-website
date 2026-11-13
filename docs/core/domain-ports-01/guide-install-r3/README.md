# CORE-DOMAIN-PORTS-01 / R3 — first independent Guide installation cut

Parent: ae1fe67187b0b09bcc3fc5b8d22d55d08a7139e6. QFW-R2-03 and its accepted
source remain unchanged. S01/Listing WIP is excluded from this delivery.

## What is executable

The source packet is supabase/install/guide-no-document-v1. Exact ordered units:
preflight.sql ->00-fixed-roles.sql ->05-owner-delegations.sql ->
08-audience-dependency.sql ->10-guide-core.sql ->20-save-relation.sql ->verify.sql.
Each numbered unit commits independently. Recovery is recovery.md; no destructive
cleanup/uninstaller, auto-retention, role-assignment or route activation exists.
Default runtime binding remains NULL. Shared target installation remains Platform's
separately admitted action, never an effect of this source delivery.

Owner/principal split is explicit.00/05 require actual admitted lifecycle/owner
capability;00 verifies superuser capability rather than inferring it from a name.
08/10/20 use the actual ordinary Core installer. Runtime is the fixed LOGIN
cladora_ce_guide_runtime, executor the fixed NOLOGIN cladora_ce_guide_executor,
with exactly one edge ADMIN=false/INHERIT=false/SET=true. Neither owns any object.
No ordinary installer receives a new privileged membership or grant option.

Two Platform Markdown inputs were received and exact bytes/hash checked:
- PLATFORM-GUIDE-R1-CORE-HELPERS-HANDOFF-01.md:21015 bytes,
  6de81658370bf41e60b1ad306ef99641805ea874b532f63fae66e9a59a933569.
- PLATFORM-GUIDE-CORE-DISCOVERY-REVIEW-02.md:4116 bytes,
  95c5682624452c76da9bfb0e0898416899d97de9fd03e3420630731bc4ba1373.
Their private raw content/catalog is not embedded or republished. These are
historical observations; fresh execution preflight is still required.

## Closure / compatibility decisions

| Observed/source gap | Exact adoption and control |
| --- | --- |
| Missing experience and four tables | Canonical lifecycle schema/Guide/steps/references and typed save relation; explicit Guide no-document constraints, FORCE RLS, immutable/deferred source logic |
| Shared *_at helpers owned by ordinary Core installer | Definitions, owner and search_path preserved; exact observed pg_get_functiondef SHA pins checked; only narrow executor EXECUTE added with no grant option |
| Auth/RPC effective EXECUTE differs from grant authority | Separate fixed owner-side05 delegation; no installer grant-option/role expansion, no Auth table ACL/RLS change |
| Missing Guide roles | Separate00 fixed roles/closed SET edge; no credential in source; actual capability is mandatory |
| Missing audience dependency found through source/native closure | Exact canonical workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[]) extracted from20261007085940 migration; existing canonical table required; no parallel registry, handover writer or invented authority |
| Historical all-document role guard adds unrelated dependencies | New no-document role-safety implementation at the existing pool entry points, installed only when absent; fixed-role/ownership invariants plus exact shared helper pins retained; no shared historical guard is rewritten |
| Discovery/FOR SHARE | Exact SELECT columns include tenant legal_name and role name; UPDATE(id) for Context/member/Workspace and UPDATE(singleton) epoch, lock policies WITH CHECK(false). Read discovery uses own-actor structure, then actual CE canonical read checks; read does not require manage |
| C03 create/save/lifecycle | Exact scoped key namespace; narrow ledger rights/policies and audit/outbox allowlist for experience.guide.command/publish/unpublish; no new ledger or receipt host |
| Missing module metadata | Canonical read/manage registry identities/bindings; no role permission grant, Workspace activation or entitlement allocation |

New helpers are owned by the admitted installer; operational roles own none.
FORCE RLS also applies to the owner: a scoped SELECT-only owner policy is required
for the installer-owned ledger helper; this is not a BYPASSRLS grant. Denials retain
canonical permission/session checks and original40001. No shared helper owner/body
is changed to make role safety pass. The existing command host/Guide adapter and
all SERVICE/Auth/frontend sources are unchanged by this first cut.

CE consumer is6259b70268a851113c8f981e2d346da5428e343f for the accepted Core62f3
composition. Discovery source is pinned62ce7bcc5c52acb043b9e35e25803a3c99c71485.
Platform's adapter a42d978880a9a3adf8e093d8d4389625677a34eb remains the owner port;
this packet does not create another adapter or install its reported bundle.
The containing app must reconcile CE's current prepare_create/execute_create
consumer with its actual merged source; no default native entry is activated.

## Real disposable PG17 evidence and its boundary

scripts/test-core-guide-install-pg17.py is a NEW standalone lab consumer, not a
replacement Platform/shared runner. It accepts ONLY an exact accepted source300
foundation file (SHA f0e13f0c8b50f2dd43c80aaab1d3bc9a3b76b627f5118f9dfb4219b1f30c5d27)
under --accepted-source. This can be reconstructed from the official Core300
manifest blob a13e382d31ea40b2ddd52306a34c56b648f3ed47; no private prior archive or
276/286/300 chain replay is required. Current product-tree foundation differs and
is rejected by the existing accepted ordinary-installer adapter.

Pinned cached PG17.11 and GoTrue images initialize a UNIQUE disposable lab over
an INTERNAL network, no published ports or old volume/credentials. GoTrue performs
its own official Auth schema migrations; no signup/login/email/API call occurs.
The accepted Platform bootstrap, session-owner setup, Core300 ordinary foundation,
minimal module-dependency table and canonical SQLSTATE/session-delegation source
produce the relevant prestate. No Maintenance/Building/assets/S01 installer is
required by Guide. Unrelated target Service data is not cloned or declared equal.

Actual PG execution reached all Guide units and verify with ordinary installer.
The physical Guide runtime/executor role graph and lease succeeded; discovery
FOR SHARE queries executed without extra column privilege errors. No-session
Guide DML and canonical session access failed with exact42501; no Guide/step/
reference/save residue remained. A real transaction abort removed its new table
while preserving the independently committed Guide installation. The scoped
source assertions are distinct from these native PG cases.

Prestate equivalence is limited to this dependency closure: same PG version,
canonical shared bodies/owners, Auth schema source, relevant table/RLS/ACL
architecture and missing Guide objects. It is NOT a full live database clone,
fresh observation of Platform, native Auth/AAL2/issuer proof, positive business
C03 receipt, concurrency, UI or restart acceptance. psql reports COMMIT and a new
connection verifies state; ReadyForQuery protocol bytes were NOT captured.
Platform still owns fresh target admission, actor/MFA fixtures, caller/module/
entitlement grants, observer capacity/custody and live native journey/QA.

Failures remain in the private lab receipts: initial missing external prestate
binding, temporary PG initialization readiness, Auth log-channel readiness,
record/SQL alias collision, and the missing canonical audience helper. No guard
was dropped and no fake table/function introduced. Every run's created containers
and internal network were removed with ACK; existing stacks were untouched.

Reproduce ONLY with explicit disposable-lab authority:

```sh
node scripts/prepare-core-guide-install-v1.mjs --check
node scripts/test-core-guide-install-v1.mjs
node scripts/test-core-guide-save-adoption-v1.mjs
python scripts/test-core-guide-install-pg17.py --accepted-source <official-source300> --output <new-private-run-directory>
```

The tests are targeted; accepted historical suites/login/MFA are not repeated.
Raw receipts/env/passwords/catalog stay private. Source inventory and sanitized
case evidence are in manifest.json. Existing pure source assertions are never
called installation proof. The two successful _at hash matches do not prove full
session/writer currentness or allow mutation after a revoke.

## Remaining consumption gates

Native Guide create/edit/publish/cancel, saved C03/CE relation readback, duplicate/
conflict/unknown-COMMIT/concurrency and data after restart on the shared target
remain Platform/CE/Coordinator QA. No receipt is seeded. Real transport correlation
and capacity must be refreshed. Exact caller privileges/registry are distinct from
business grants. Read-only discovery's current CE query retrieves free text before
its Zod projection; no schema/row limit alone proves a transport byte bound.
CE owns a bounded-query/byte-capture successor (no silent truncation), with Core
rights/source revalidation if that SQL changes. This is an explicit source gate,
not a change to the accepted discovery query or arbitrary SQL admission.

Automation: نیازمند بررسی — deterministic extraction/pins and disposable PG cases
can be automated; target admission, lifecycle authority, recovery and acceptance
remain separate human/Platform/Coordinator decisions.
