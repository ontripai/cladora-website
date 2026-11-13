# CORE-DOMAIN-PORTS-01 / R3 — Listing canonical revision continuation

Parent:34753cb4c92e3c5ea2100404e3096b7eb379de04. This is a separate SOURCE
PROPOSAL checkpoint, not the positive Listing producer or a native-ready install.
The first Guide and S01 deliveries are already independent and unchanged.
AIRPROP consumer remains dc3fcceaf1439e7bf91fb257d449b2b4e1ace4b0.

## Real source and counterexample

`portfolio.ownerships` is the existing official ownership relationship, created
by20260825000300_portfolio_properties_buildings_units.sql:37. It has id, tenant,
Unit, Party, share, valid_from/valid_to and evidence; finalized_at is added by the
canonical occupancy registry migration. It has NO stored relationship revision.
PF01's20261019193000_pf01_owner_portfolio_projection_v1.sql:185 emits literal1
(and source/evidence strings ending:v1). That literal cannot detect a later edit
to the SAME relationship ID. The exact Core read selector already delivered
real Unit/spec ancestry; it correctly leaves canonical_companion=NULL.
Do not relabel PF01's permission/purpose or its fixed1 as Listing version proof.

## Concrete additive proposal, not a registry

`supabase/proposals/core-listing-ownership-revision-v1.sql` is explicitly inactive:
unconditional55000 and finalROLLBACK. No automatic migration/installer/cutover.
It proposes a nullable native_revision_v1 on the EXISTING ownership row, without
DEFAULT/backfill. Old rows remain NULL and must remain NOT_READY in a future
producer, including after unrelated or real historical updates. No version is
inferred from timestamps, hashes, id, apparent row freshness or legacy PF01.
Only a real new canonical INSERT receives its first recorded version through the
writer trigger. A versioned row's actual content edit increments it atomically;
no-op preserves it, caller override is denied, overflow fails. Delete means source
absence, not a fabricated retained receipt. No historical receipt/relationship is
rewritten and no legacy adoption action is implemented.

The source proposes BEFORE-statement epoch invalidation on ownerships, parties
and membership_parties by the EXISTING canonical bump function, including DELETE
and TRUNCATE, ENABLE ALWAYS. Ownership's revision trigger runs after the existing
customer_ownership_integrity trigger, preserving finalized/tenant/share/period
checks. No function/evaluator body, owner, existing trigger, RLS/ACL/defaults or
permission is replaced. No role/grant/policy or data is added. The guard deliberately
requires separately reviewed target/owner/ACL/native adoption; the source is not an
instruction to remove55000 and execute it.

## Writer order is a real remaining blocker

A table BEFORE trigger is NOT proof that the whole caller acquires epoch first.
Existing routines acquire rows BEFORE their DML statement. Exact source evidence:

| Existing writer | Prior locks/source effect | Minimal next owner delta / closure |
| --- | --- | --- |
| customer_api.execute_verified_ownership_transfer_v1;20261007092932_lifecycle_verified_ownership_transfer.sql:144,162,194,201 | Property UPDATE, Unit UPDATE and outgoing ownership UPDATE locks precede ownership DML | Core lifecycle writer: acquire canonical session/epoch barrier before first conflicting domain lock, after reviewing called authorization helpers; preserve evidence/finalization/idempotency and one transaction. New two-connection cycle/revoke/rollback proof needed |
| customer_api.register_unit_invite_relationship_v1;20260928130116_20260928113655_scoped_unit_invitations.sql:134,150,153 | Unit UPDATE lock before Party/ownership INSERT | Core/communications writer: barrier before Unit lock; unchanged invite authorization, no first-Party inference or grant |
| app_private.onboarding_commit_residential_internal_v1;20260913063638_residential_pilot_import_completion.sql:168,208 | Multi-entity import writes and parent mappings precede ownership INSERT | Core onboarding writer: bind barrier at existing transaction entry before first dependent parent lock; validate all approval callers and rollback behavior |

Counterexample SOURCE schedule: reader holds epoch SHARE and waits for Property/
Unit; transfer/registration holds that Property/Unit and then the new DML trigger
waits for epoch UPDATE. The BEFORE trigger alone does not eliminate this cycle.
This is a source-derived schedule, NOT an executed deadlock or SQLSTATE observation.
All direct/admin/dynamic writer and invalidator participation is not closed by
these three examples; no global lock order is declared frozen. Earlier native
Guide installation does not prove these writers. The existing reader, current
shared host and all writer bodies remain byte-identical in this checkpoint.

## Consumer/source contract to close next

The positive companion must consume a stored non-NULL native_revision_v1 plus
current Unit/spec, exact selected Party/kind and ownership ID/version, actual
Context/tenant/Workspace, current membership-party mapping and explicit official
read authority. It must lock/recheck those sources and perform terminal canonical
session/authority/expiry after all relevant waits in the same opaque read scope.
Read: airprop.asset.read / airprop_commercial / airprop.portfolio.read.
Command: airprop.opportunity.manage / airprop_commercial / airprop.b2, AAL2.
Neither ownership nor read is a manage grant. C03 remains the only command host.
Historical fixed-version selected bindings are not automatically rebound.

Precise policy choice still needing AIRPROP/Coordinator acceptance: recommend
initial own-party ownership only, requiring current membership_parties link and
canonical read permission. Disclosure of other parties for a Workspace manager,
or management/representation relationships, needs its own canonical source and
explicit disclosure policy; it is not implied by generic asset.read or S01.
This narrow proposed first family does not reduce the full v1.4 roadmap.

Before a positive producer: review/adopt revision source with exact existing writer
order, all relevant invalidators and current disclosure; decide explicit handling
of legacy NULL revisions (recommended keep NOT_READY; no silent backfill). Then
add exact bounded discovery/query admission/rights and couple the actual AIRPROP
mutator. Missing source stays CANONICAL_PRODUCER_NOT_READY. This checkpoint adds
no pretend producer, arbitrary verifier, synthetic positive or registry.

## Checks / execution boundary

`node scripts/test-core-listing-ownership-revision-v1.mjs`:10 new focused SOURCE
controls, including coherent negative mutations for fake historical1, caller
revision injection, epoch-after-row ordering, omitted membership invalidation,
replica-disabled trigger, lost guard, auto-commit and parallel registry.
Node syntax, limited lint, diff, seals and apply/reverse also checked. These are
not SQL parser/compile/PG/lock/trigger proof. No SQL, PG, Auth, target fixture,
GRANT, activation or restart executed for this checkpoint. All such proofs remain
NOT_RUN_NOT_PASS. Native adoption belongs to separately admitted Platform work.

Automation: نیازمند بررسی — deterministic proposal checks are candidates; source
policy, writer participation/lock order and native adoption are formal dependencies.
