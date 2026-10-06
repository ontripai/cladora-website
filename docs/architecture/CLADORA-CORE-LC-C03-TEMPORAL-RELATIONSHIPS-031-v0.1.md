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
