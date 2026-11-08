import { z } from 'zod';
import { parseServiceOfferingInstantMicrosV1 as parseInstantMicros } from '../customer/service-offering-time-precision-v1';
import { commercialLifecycleCommandV1Schema } from './commercial-lifecycle-v1';
import { listingScopeSchema, listingSelectionSchema, sameId, type ListingScope } from './listing-flow-contract-v1';

/** Domain intent only. Parsing a selection never resolves authority or ownership. */
export const listingPublicationSelectionSchema = listingSelectionSchema.omit({ listing_id: true, listing_version: true });
const publication = z.strictObject({
  contract: z.literal('airprop-listing-publication.v1'),
  selection: listingPublicationSelectionSchema,
  command: commercialLifecycleCommandV1Schema,
});
export const LISTING_PUBLICATION_NATIVE_SIGNATURE = 'customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text)';
export const LISTING_PUBLICATION_NATIVE_SQL = 'select customer_api.publish_airprop_listing_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::timestamptz,$8::timestamptz,$9::text) as result';

/** Prepare the existing native call, without executing SQL or inventing C03 IDs.
 * Core must validate CURRENT Unit/party/relationship/spec/Opportunity binding in
 * the SAME admitted C03 transaction before executing this plan. The API does not
 * accept this new creation intent until that producer/bridge has been delivered.
 * The original control wire, journal and existing endpoint remain untouched. */
export function prepareListingPublicationV1(wire: string, expectedScope: ListingScope) {
  if (typeof wire !== 'string' || new TextEncoder().encode(wire).byteLength > 16384) throw Error('LISTING_PUBLICATION_TOO_LARGE');
  const request = publication.parse(JSON.parse(wire)), scope = listingScopeSchema.parse(expectedScope);
  const command = request.command, selected = request.selection;
  if (command.action !== 'publish_listing') throw Error('LISTING_PUBLICATION_ACTION');
  if (!sameId(command.context_id, scope.context_id) || !sameId(command.workspace_id, scope.workspace_id)
    || !sameId(command.property_id, selected.property_id) || !sameId(command.unit_id, selected.unit_id)
    || !sameId(selected.resource_id, selected.unit_id)) throw Error('LISTING_PUBLICATION_BINDING');
  const start = parseInstantMicros(command.available_from);
  const end = command.available_until === null ? null : parseInstantMicros(command.available_until);
  if (start === null || (command.available_until !== null && end === null) || (end !== null && start >= end)) throw Error('LISTING_PUBLICATION_INTERVAL');
  // Opportunity has no revision column in the existing schema. Do not invent one.
  // The native writer checks exact Opportunity tenant/Workspace/property binding;
  // the C03 provider must lock/recheck that row along with the canonical source.
  return Object.freeze({
    kind: 'airprop-listing-publication-plan.v1' as const,
    status: 'CURRENT_CORE_SOURCE_VALIDATION_REQUIRED' as const,
    wire,
    request: Object.freeze({ contract: request.contract, selection: Object.freeze(selected), command: Object.freeze(command) }),
    native: Object.freeze({ signature: LISTING_PUBLICATION_NATIVE_SIGNATURE, sql: LISTING_PUBLICATION_NATIVE_SQL,
      values: Object.freeze([command.context_id, command.workspace_id, command.opportunity_id, command.property_id,
        command.unit_id, command.kind, command.available_from, command.available_until, command.idempotency_key]) }),
  });
}
