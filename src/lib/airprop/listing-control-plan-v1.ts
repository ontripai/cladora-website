import { parseServiceOfferingInstantMicrosV1 as parseInstant } from '../customer/service-offering-time-precision-v1';
import { listingCommandSchema, listingScopeSchema, sameId, type ListingScope } from './listing-flow-contract-v1';

export const LISTING_CONTROL_NATIVE_SQL = 'select customer_api.control_airprop_listing_v1($1::uuid,$2::uuid,$3::uuid,$4::text,$5::integer,$6::timestamptz,$7::timestamptz,$8::text,$9::text) as result';
export const LISTING_CONTROL_NATIVE_SIGNATURE = 'customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)';
const nativeAction = { edit_listing: 'edit', withdraw_listing: 'withdraw', republish_listing: 'republish' } as const;

/** Owner-domain parameter preparation, not authorization or execution.
 * The existing C03 provider must recheck the ENTIRE selection/current authority
 * in its admitted physical transaction, then execute this fixed native call.
 * Do not compare a retry with a newer GET to rewrite its original version/key.
 * No dispatch, pool, transaction, receipt, fallback or replacement key here. */
export function prepareListingControlV1(wire: string, expectedScope: ListingScope) {
  if (typeof wire !== 'string' || new TextEncoder().encode(wire).byteLength > 16384) throw Error('LISTING_CONTROL_TOO_LARGE');
  const request = listingCommandSchema.parse(JSON.parse(wire)), scope = listingScopeSchema.parse(expectedScope);
  const command = request.command, selected = request.selection;
  if (!sameId(command.context_id, scope.context_id) || !sameId(command.workspace_id, scope.workspace_id)
    || !sameId(selected.resource_id, selected.unit_id)) throw Error('LISTING_CONTROL_BINDING');
  // Native expected_version and version+1 are int4; no coercion, rounding or wrap.
  if (!Number.isSafeInteger(command.expected_version) || command.expected_version >= 2147483647) throw Error('LISTING_CONTROL_VERSION');
  const from = command.action === 'withdraw_listing' ? null : command.available_from;
  const until = command.action === 'withdraw_listing' ? null : command.available_until;
  if (from !== null) {
    const start = parseInstant(from), end = until === null ? null : parseInstant(until);
    if (start === null || (until !== null && end === null) || (end !== null && start >= end)) throw Error('LISTING_CONTROL_INTERVAL');
  }
  return Object.freeze({
    kind: 'airprop-listing-control-plan.v1' as const,
    status: 'CURRENT_CORE_SOURCE_VALIDATION_REQUIRED' as const,
    wire,
    request: Object.freeze({ contract: request.contract, selection: Object.freeze(selected), command: Object.freeze(command) }),
    native: Object.freeze({ sql: LISTING_CONTROL_NATIVE_SQL, signature: LISTING_CONTROL_NATIVE_SIGNATURE,
      values: Object.freeze([command.context_id, command.workspace_id, command.listing_id, nativeAction[command.action],
        command.expected_version, from, until, command.reason, command.idempotency_key]) }),
  });
}
