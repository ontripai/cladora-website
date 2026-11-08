import { z } from 'zod';
import { mapAirpropCoreCompanionV1 } from '../core/airprop-companion-mapping-v1';
import { listingScopeSchema, listingViewSchema, listingSelectionSchema, listingActions, unavailableListingActions, sameSelection, sameId, type ListingScope } from './listing-flow-contract-v1';

/** Server-only output from a canonical DW02/C01 read in its authorized scope.
 * No runtime implementation is claimed by this port. Never supply browser JSON here. */
export type ListingSourceRead = (actorId: string, scope: ListingScope) => Promise<unknown>;
const actionProjectionsSchema = z.array(z.strictObject({
    actor_id: z.string(), context_id: z.string(), workspace_id: z.string(), selection: listingSelectionSchema,
    action: z.enum(listingActions),
    core: z.strictObject({ request: z.unknown(), companion: z.unknown(), authority: z.unknown() }),
  })).max(3);
const sourceRow = z.strictObject({
  context_id: z.string(), workspace_id: z.string(), tenant_id: z.string(),
  listing_id: z.string(), listing_version: z.number(), property_id: z.string(), unit_id: z.string(),
  status: z.enum(['published', 'withdrawn', 'reserved']),
  available_from: z.string(), available_until: z.string().nullable(),
  core: z.strictObject({ request: z.unknown(), companion: z.unknown(), authority: z.unknown() }),
  action_projections: z.unknown().optional(),
  selected_binding: z.unknown().optional(),
});
const bindingRecord = listingScopeSchema.extend({ tenant_id: z.string(), selection: listingSelectionSchema,
  spec_version: z.number().int().positive().safe() });
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
    const result = listingViewSchema.parse({
      selection: { listing_id: row.listing_id, listing_version: row.listing_version,
        property_id: row.property_id, unit_id: row.unit_id,
        resource_id: mapped.resource.resource_id, resource_version: mapped.resource.resource_version,
        resource_type: mapped.resource.resource_type, party_id: mapped.party.party_id, party_kind: mapped.party.party_kind,
        relationship_id: relationship.relationship_id, relationship_version: relationship.relationship_version, relationship_kind: relationship.relationship_kind },
      source_name: mapped.resource.display_name, status: row.status,
      available_from: row.available_from, available_until: row.available_until,
    });
    // Domain custody is independent of current read permission and manage authority.
    // Only the server-supplied actual stored reference is compared; no inference
    // from current Party/version, boolean allow, bridge presence or native row.
    const binding = row.selected_binding as { state?: unknown; value?: unknown } | null | undefined;
    if (binding?.state === 'legacy') result.binding_state = 'legacy';
    else if (binding?.state === 'invalid') result.binding_state = 'invalid';
    else if (binding?.state === 'record') {
      const record = bindingRecord.safeParse(binding.value);
      if (!record.success || !sameId(record.data.tenant_id, row.tenant_id)
        || !sameId(record.data.context_id, scope.context_id) || !sameId(record.data.workspace_id, scope.workspace_id)
        || !sameId(record.data.selection.listing_id, row.listing_id)) result.binding_state = 'invalid';
      else result.binding_state = sameSelection(record.data.selection, result.selection)
        && record.data.spec_version === result.selection.resource_version ? 'bound' : 'stale';
    } else if (binding != null && binding.state !== 'unavailable') result.binding_state = 'invalid';
    if (result.binding_state !== 'bound') return result;
    // Optional server-produced current projection. DW02 read disclosure alone grants nothing.
    // Reuse the accepted Core mapper; never evaluate roles or permissions in AIRPROP.
    const projections = actionProjectionsSchema.safeParse(row.action_projections ?? []);
    if (!projections.success) return result;
    const seen = new Set<string>();
    for (const projection of projections.data) {
      if (seen.has(projection.action)) { result.actions = unavailableListingActions(); break; }
      seen.add(projection.action);
      try {
        const actionRequest = projection.core.request as typeof row.core.request & {
          evaluation_time: string; resource: { permission_code: string; purpose: string };
          authority: { module_code: string; evaluation_purpose: string };
        };
        const readTime = (row.core.request as { evaluation_time: string }).evaluation_time;
        if (!sameId(projection.actor_id, actorId) || !sameId(projection.context_id, scope.context_id)
          || !sameId(projection.workspace_id, scope.workspace_id) || !sameSelection(projection.selection, result.selection)
          || actionRequest.resource.permission_code !== 'airprop.opportunity.manage'
          || actionRequest.resource.purpose !== 'airprop.b2' || actionRequest.authority.evaluation_purpose !== 'airprop.b2'
          || actionRequest.authority.module_code !== 'airprop_commercial'
          || Date.parse(actionRequest.evaluation_time) !== Date.parse(readTime)) continue;
        const action = mapAirpropCoreCompanionV1(projection.core);
        if (action.disclosure !== 'verified' || !action.resource || !action.party || !action.context_id) {
          result.actions[projection.action] = 'denied'; continue;
        }
        const relationship = (projection.core.companion as { relationship: { relationship_id: string; relationship_version: number; relationship_kind: string } }).relationship;
        if (!sameId(action.context_id, scope.context_id) || !sameId(action.resource.workspace_id, scope.workspace_id)
          || !sameId(action.resource.tenant_id, row.tenant_id) || action.resource.resource_type !== 'unit'
          || !sameId(action.resource.resource_id, result.selection.resource_id) || action.resource.resource_version !== result.selection.resource_version
          || !sameId(action.party.party_id, result.selection.party_id) || action.party.party_kind !== result.selection.party_kind
          || !sameId(relationship.relationship_id, result.selection.relationship_id)
          || relationship.relationship_version !== result.selection.relationship_version || relationship.relationship_kind !== result.selection.relationship_kind) continue;
        result.actions[projection.action] = 'allowed';
      } catch { /* Missing/invalid action evidence must not withhold an independently authorized read. */ }
    }
    return result;
  });
}
