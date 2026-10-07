# Core LC-C03 temporal relationships and access transfer 031 v0.1

Date: 2026-10-06 UTC. Owner: Core and Operations. Source: [lifecycle implementation package v1.1](references/CLADORA-Lifecycle-Implementation-Package-v1.1.docx), LC-C03 and T03/T06/T07. This document specifies the next shared contract. It does not grant a real property right, activate a module, or accept those tests.

## Existing records and the boundary

| Fact | Existing source | Meaning and limit |
| --- | --- | --- |
| Canonical property and unit | `portfolio.properties`, `portfolio.units`; LC-C02 identity and lineage | UUID identifies the subject; a split or merge does not move an old relationship to a successor automatically. |
| Legal unit ownership | `portfolio.ownerships` (`party_id`, share, `valid_from`, `valid_to`, `evidence_id`) | Dated party relation. Its presence does not identify a signed-in user, workspace administrator, contractual buyer, or document recipient. |
| Lease and occupancy | `occupancy.leases`, `occupancy.occupancies`, `occupancy.occupants` | Distinct contract and physical-presence facts; a lease or occupancy does not transfer title. |
| Workspace purpose and software authority | `platform.workspace_property_authorities`, context grants, native roles and permission engine | A live property mandate and software permission are separate from party title. LC-C01 resolver alone grants no record access. |
| Invitation and owner account link | `communications.unit_invitations`, `platform.owner_unit_links` | Acceptance or verification connects an account to a party only for the defined purpose. Existing owner link checks current ownership, but an invitation is not a deed. |
| AIRPROP commercial interest | `airprop.property_interests` and opportunity/decision records | Property-level interest or internal approval is not unit title or a signed presale. AIRPROP owns presale terms and buyer case. |
| Documents | `documents` vault and links | A property association is not permission to disclose a prior party's private file or conversation. |

The current `portfolio.ownerships` read policy uses `can_access_unit(unit_id)`, which can reveal historical ownership rows to any context allowed on that unit. Existing customer projections have their own rules. Before a transfer-facing history endpoint, review both the table policy and every consumer; do not assume that a new buyer may read all predecessor party data. Existing `portfolio.ownerships` has no common verified-transfer command, version, or transition receipt. These are implementation gaps, not evidence that current transfers are approved.

## Proposed shared command envelope

Every Core relationship transition pins `request_id`, `idempotency_key`, actor and context, explicit workspace, tenant, canonical property and unit, relationship kind, exact party IDs, effective interval, expected relationship version, evidence reference and decision reason. The server resolves ancestry and tenant, current purpose-bound workspace mandate, current module and target permission, the account-to-party proof when the actor claims a party right, and the domain prerequisite **at execution and replay time**. Client-provided IDs are lookup keys only.

The first release should be a private proposal and verification ledger with immutable decisions. It must not silently write `portfolio.ownerships` or `occupancy.leases`. A separate reviewed transition command may update the appropriate canonical relation after evidence verification and independent approval. The command commits relation change, previous interval closure, new interval, audit/outbox receipt and idempotency response atomically. Same-key retries return the same receipt after fresh authority checks; changed payloads conflict. Competing expected versions, duplicate transfer and overlapping rights are rejected under the unit lock. A failed transaction leaves the prior relation and permissions intact.

| Relation | Origin of truth and transition owner | Effective authority |
| --- | --- | --- |
| Contractual buyer | AIRPROP signed presale case and evidence; Core stores a purpose-limited reference after verification | Buyer-case access only. No owner, association-manager, unit transfer or financial-book right. |
| Ownership transfer | Core verified deed/closing evidence and `portfolio.ownerships`; AIRPROP supplies commercial case | Old interval closes, new dated share begins; existing historical records keep their original party and workspace provenance. Rights change only through current relation plus independent account and software grants. |
| Lease or occupancy | Core/Operations canonical lease and occupancy commands; AIRPROP supplies terms where applicable | Tenant rights need current lease, verified party-to-account link and scoped software permission; lease end, occupancy end, key return and settlement remain separate events. |
| Management mandate | Business principal, agent, property/unit, allowed actions, interval, evidence and revocation; Core workspace mandate plus local role grant | Manager can act only where both current business mandate and role/permission allow it. Handover of a role preserves historic actor attribution; new actions carry the new actor. |

An explicit `effective_at` is interpreted under the relation's date or timestamp semantics. Do not backdate an access grant from a future legal date. Revocation blocks new actions and retries immediately; it does not erase immutable evidence. Corrections need a compensating version and reason, never an in-place rewrite of the actor, subject, evidence or old receipt. A partial unit handover stays independent of full building handover, payment, subscription and occupancy.

## Access transfer and visibility

At transition, calculate access for each request from the **current** relationship, verified account-party association, explicit workspace/purpose, module and permission, and the record's visibility/provenance class. Never copy the seller's context grant, workspace role, private document ACL, conversation membership or payment authority to the buyer. A successor may see expressly transferable property/unit facts and the permitted handover manifest; personal seller documents, prior private messages, credentials and unrelated financial records remain outside it. Historical facts retain original authors and workspace. A revoked former actor cannot create new records merely because they authored old ones. Every read projection must test a second authorized workspace on the same property and an unrelated workspace.

## Acceptance sequence and owning workstream

1. **Core LC-C03 contract and inventory:** map all direct ownership/lease mutations and reads, role and party links, vault visibility, and operational audit; identify consumer compatibility and migration/backfill plan before changing the existing RLS or canonical tables. This document is that contract, not an implementation pass.
2. **Core private relationship ledger and transition:** enforce same-tenant ancestry, evidence state, immutable versions, bounded time, share/overlap and serialized race checks; add an authorized gateway only after the isolated pgTAP fixture and a second-connection race test pass. Test forged context, two workspaces, revocation before commit/replay, changed idempotency payload and unchanged prior history on failure.
3. **AIRPROP T03:** signed presale creates only a contractual buyer relationship; verify that owner, manager, owner-invite and SERVICE payer operations deny that buyer without their own prerequisites.
4. **Core/AIRPROP T06:** verified transfer closes the former interval and starts the new one without changing unit UUID or old author/provenance. Verify buyer sees allowed property history and manifest while seller personal documents and private conversations remain hidden. A former owner loses current write access; prior records remain auditable.
5. **Core/Operations/AIRPROP T07:** lease activation and end, occupant move, key/access return and settlement each have distinct evidence and dates. SERVICE verifies requester and payer independently against current links. Test end/revocation in a live second session.

For each acceptance row record the exact migration, API/UI path, fixture, CI run, PR, deployed SHA and environment. The existing LC-C02 synthetic two-unit fixture may be extended, but no production pilot row is inferred from it. Real use still needs an identified property, verified legal evidence, a purpose-bound mandate and authorized accounts. This contract does not authorize production creation of those records.

## Source and production inventory, 2026-10-06 UTC

The canonical tables already have `occupancy.enforce_customer_registry_integrity()` and `customer_ownership_integrity` / `customer_lease_integrity` triggers from `20260829005200_customer_occupancy_parties_ownership_lease_registry.sql`. They validate unit and party tenant, overlapping same-party ownership and total share, landlord ownership at lease start, and overlapping active leases. Do not add a duplicate tenant or share guard. This trigger does not supply the missing verified, versioned transfer and access manifest.

Two located ownership insert paths are `app_private` residential import completion in `20260913063638_residential_pilot_import_completion.sql` and `customer_api.register_unit_invite_relationship_v1` in `20260928113655_scoped_unit_invitations.sql`. The latter also inserts an active lease, only after its manager attestation and existing relationship checks. A future transfer command must explicitly reconcile these writers and the current customer registry read projections before changing canonical relations or their RLS. Search of the migration source found no general verified ownership transfer command. The production read-only aggregate at this checkpoint found three ownership rows, two lease rows, zero `platform.workspace_property_authorities` rows, zero tenant mismatches and zero overlapping ownership pairs. No party name, evidence or private document was inspected for this inventory.

The first LC-C03 implementation, PR #300, is the private `portfolio.relationship_proposals` / `portfolio.relationship_reviews` ledger and pgTAP 164. Squash `30a8aea40b7a4b0089bfc8f98465d143ae2a73d7`; Supabase migration history records `20261006084035` for source file `20261006082904_lifecycle_relationship_review_ledger.sql`; Database tests run `37436970525` and AIRPROP regression run `37436970400` passed. Vercel Production `dpl_9DPZSK4H35kb3ZBnHegKiessHVaE` is READY. Production has zero proposals and zero reviews, RLS enabled and no customer or service-role direct table access; the pre-existing three ownerships and two leases were unchanged. The ledger has no customer command, review workflow UI, canonical transition, or access-transfer effect. These remain implementation gates.

## Implementation update, 2026-10-06

PR #303 added the customer proposal, independent evidence review, read and native property discovery commands, with exact workspace permission, module entitlement, live property mandate, AAL2, party conflict and idempotency checks. PR #304 exposed the page through the native workspace route. PR #305 added scoped context discovery for a reviewer whose setup context is intentionally absent from the ordinary customer dashboard selector. The three PRs were squash merged and deployed; see [the delivery and browser acceptance report](CLADORA-CORE-LC-C03-DELIVERY-2026-10-06.md).

The first live synthetic proposal was independently rejected because it had no verified legal document. This is an evidence decision only: it did not mutate canonical title, lease or access. Legal transfer, lease transition, historical visibility handover and production use on a real property remain separate implementation and acceptance gates.

## Implementation and acceptance update, 2026-10-07

PR #307 delivered T03 contractual-buyer activation, PR #308 delivered T06 verified ownership transfer and PR #309 delivered T07 verified lease activation/handover plus explicit termination. Their squash commits are `58a27a17`, `c4c1cbdf` and `bbd0b68b`; all three migrations are recorded in Supabase Production and their Vercel Production deployments are READY. Direct receipt-table writes remain closed and every transition retains the exact workspace/property mandate, module permission, AAL2, verified version-pinned evidence, immutable receipt, audit and outbox boundaries described above.

The connected rollback acceptance fixture now exercises T03, T06 and T07, including T07 activation and termination as distinct commands. It checks exact replay, changed-payload conflict, canonical lease/occupancy creation, exact access return, separate settlement, immutable receipts and the absence of implicit title, invitation, account-party, workspace-role or private-document authority. See [the delivery and pilot acceptance report](CLADORA-CORE-LC-C03-DELIVERY-2026-10-06.md).

LC-C03 synthetic implementation acceptance is therefore closed at this boundary. Real-property pilot evidence remains a separate human/legal authorization, and T08 multi-workspace whole-lifecycle acceptance plus T09 event-consumer recovery remain open shared-core stages rather than implicit extensions of T03/T06/T07.
