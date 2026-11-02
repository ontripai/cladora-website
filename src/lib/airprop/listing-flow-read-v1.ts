import { z } from 'zod';
import { mapAirpropCoreCompanionV1 } from '../core/airprop-companion-mapping-v1';
import { listingScopeSchema, listingViewSchema, sameId, type ListingScope } from './listing-flow-contract-v1';

/** Server-only output from a canonical DW02/C01 read in its authorized scope.
 * No runtime implementation is claimed by this port. Never supply browser JSON here. */
export type ListingSourceRead = (actorId: string, scope: ListingScope) => Promise<unknown>;
const sourceRow = z.strictObject({
  context_id: z.string(), workspace_id: z.string(), tenant_id: z.string(),
  listing_id: z.string(), listing_version: z.number(), property_id: z.string(), unit_id: z.string(),
  status: z.enum(['published', 'withdrawn', 'reserved']),
  available_from: z.string(), available_until: z.string().nullable(),
  core: z.strictObject({ request: z.unknown(), companion: z.unknown(), authority: z.unknown() }),
});
/** Consume the actual accepted Core mapper; no ownership/representation evaluator is duplicated. */
export async function readListingFlow(read: ListingSourceRead, actorId: string, input: ListingScope) {
  const scope = listingScopeSchema.parse(input);
  const rows = z.array(sourceRow).max(100).parse(await read(actorId, scope));
  return rows.map(row => {
    const mapped = mapAirpropCoreCompanionV1(row.core);
    const request = row.core.request as { resource?: { permission_code?: string; purpose?: string } } | null;
    if (!sameId(row.context_id, scope.context_id) || !sameId(row.workspace_id, scope.workspace_id)
      || mapped.disclosure !== 'verified' || !mapped.resource || !mapped.party || !mapped.provenance
      || !mapped.context_id || !sameId(mapped.context_id, scope.context_id)
      || !sameId(mapped.resource.workspace_id, scope.workspace_id) || !sameId(mapped.resource.tenant_id, row.tenant_id)
      || request?.resource?.permission_code !== 'airprop.asset.read' || request.resource.purpose !== 'airprop.portfolio.read'
      || mapped.resource.resource_type !== 'unit'
      || !sameId(mapped.resource.resource_id, row.unit_id)) throw Error('LISTING_SOURCE_WITHHELD');
    // Relationship identity/version/kind come from validated canonical evidence, not a form.
    const relationship = (row.core.companion as { relationship: { relationship_id: string; relationship_version: number; relationship_kind: string } }).relationship;
    return listingViewSchema.parse({
      selection: { listing_id: row.listing_id, listing_version: row.listing_version,
        property_id: row.property_id, unit_id: row.unit_id,
        resource_id: mapped.resource.resource_id, resource_version: mapped.resource.resource_version,
        resource_type: mapped.resource.resource_type, party_id: mapped.party.party_id, party_kind: mapped.party.party_kind,
        relationship_id: relationship.relationship_id, relationship_version: relationship.relationship_version, relationship_kind: relationship.relationship_kind },
      source_name: mapped.resource.display_name, status: row.status,
      available_from: row.available_from, available_until: row.available_until,
    });
  });
}
