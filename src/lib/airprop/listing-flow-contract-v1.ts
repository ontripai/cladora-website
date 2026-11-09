import { z } from 'zod';
import { airpropListingControlCommandV1Schema } from './commercial-lifecycle-v1';

const id = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const revision = z.number().int().positive().safe();
export const listingScopeSchema = z.strictObject({ context_id: id, workspace_id: id });
export const listingSourceVersionsV2Schema = z.strictObject({ version: z.literal(2),
  specification_id: id, resource_version: revision, party_version: revision, relationship_version: revision });
export const listingSelectionSchema = z.strictObject({
  listing_id: id, listing_version: revision, property_id: id, unit_id: id,
  resource_id: id, resource_version: revision, resource_type: z.literal('unit'),
  source_versions: listingSourceVersionsV2Schema.optional(),
  party_id: id, party_kind: z.enum(['person', 'company']),
  relationship_id: id, relationship_version: revision,
  relationship_kind: z.enum(['ownership', 'management', 'representation']),
});
const label = z.string().trim().min(1).max(240)
  .refine(value => !/[\u0000-\u001f\u007f]|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i.test(value));
export const listingActions = ['edit_listing', 'withdraw_listing', 'republish_listing'] as const;
export const listingActionAuthoritySchema = z.strictObject({
  edit_listing: z.enum(['allowed', 'denied', 'unavailable']),
  withdraw_listing: z.enum(['allowed', 'denied', 'unavailable']),
  republish_listing: z.enum(['allowed', 'denied', 'unavailable']),
});
export const unavailableListingActions = () => ({ edit_listing: 'unavailable', withdraw_listing: 'unavailable', republish_listing: 'unavailable' } as const);
export const listingBindingStateSchema = z.enum(['bound', 'legacy', 'stale', 'invalid', 'unavailable']);
export const listingViewSchema = z.strictObject({
  selection: listingSelectionSchema, source_name: label,
  // Missing old-server metadata never upgrades an action to safe command custody.
  binding_state: listingBindingStateSchema.default('unavailable'),
  actions: listingActionAuthoritySchema.default(unavailableListingActions),
  status: z.enum(['published', 'withdrawn', 'reserved']),
  available_from: z.string().datetime({ offset: true }),
  available_until: z.string().datetime({ offset: true }).nullable(),
});
export const listingReadResponseSchema = listingScopeSchema.extend({
  version: z.literal(2), listings: z.array(listingViewSchema).max(100),
  can_edit: z.boolean(), connection: z.enum(['read_only', 'command_bridge']),
}).superRefine((value, ctx) => {
  if (value.can_edit !== value.listings.some(row => listingActions.some(action => row.actions[action] === 'allowed')) || (value.can_edit && value.connection !== 'command_bridge')) ctx.addIssue({ code: 'custom', message: 'connection_mismatch' });
  if (new Set(value.listings.map(row => row.selection.listing_id.toLowerCase())).size !== value.listings.length) ctx.addIssue({ code: 'custom', message: 'duplicate_listing' });
});
/** AIRPROP transport, not a new Core ABI or an authority receipt. Native AP01 command is unchanged. */
export const listingCommandSchema = z.strictObject({
  contract: z.literal('airprop-listing-flow.v1'), selection: listingSelectionSchema,
  command: airpropListingControlCommandV1Schema,
}).superRefine((value, ctx) => {
  if (value.selection.source_versions && (value.selection.source_versions.resource_version !== value.selection.resource_version
    || value.selection.source_versions.relationship_version !== value.selection.relationship_version)) ctx.addIssue({ code: 'custom', message: 'source_version_binding' });
  if (!sameId(value.selection.listing_id, value.command.listing_id)
    || value.selection.listing_version !== value.command.expected_version) ctx.addIssue({ code: 'custom', message: 'listing_version_binding' });
});
export const listingCommandResponseSchema = listingScopeSchema.extend({
  version: z.literal(1), command_key: z.string(), selection: listingSelectionSchema,
  core_receipt_id: id,
  receipt: z.strictObject({ version: z.literal(1), idempotent: z.boolean(), listing_id: id,
    listing_version: revision, status: z.enum(['published', 'withdrawn']) }),
});
export type ListingView = z.infer<typeof listingViewSchema>;
export type ListingScope = z.infer<typeof listingScopeSchema>;
export type ListingCommand = z.infer<typeof listingCommandSchema>;
export type ListingReadResponse = z.infer<typeof listingReadResponseSchema>;
export const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function sameSelection(a: ListingView['selection'], b: ListingView['selection']) {
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  return Object.keys(a).every(key => {
    const k = key as keyof typeof a;
    if (k === 'source_versions') return sameListingSourceVersionsV2(a.source_versions, b.source_versions);
    return typeof a[k] === 'string' && typeof b[k] === 'string'
      ? String(a[k]).toLowerCase() === String(b[k]).toLowerCase() : a[k] === b[k];
  });
}
export function sameListingSourceVersionsV2(a: ListingView['selection']['source_versions'], b: ListingView['selection']['source_versions']) {
  return !!a && !!b && a.version === 2 && b.version === 2 && sameId(a.specification_id,b.specification_id)
    && a.resource_version === b.resource_version && a.party_version === b.party_version && a.relationship_version === b.relationship_version;
}
export function matchesListingReceipt(value: unknown, request: ListingCommand) {
  const parsed = listingCommandResponseSchema.safeParse(value);
  if (!parsed.success) return false;
  const r = parsed.data, c = request.command;
  return sameId(r.context_id, c.context_id) && sameId(r.workspace_id, c.workspace_id)
    && r.command_key === c.idempotency_key && sameSelection(r.selection, request.selection)
    && sameId(r.receipt.listing_id, c.listing_id) && r.receipt.listing_version === c.expected_version + 1
    && r.receipt.status === (c.action === 'withdraw_listing' ? 'withdrawn' : 'published');
}

export const LISTING_COMMAND_ENDPOINT = '/api/customer/v2/airprop/listings';
export const LISTING_ACTOR_HEADER = 'x-cladora-listing-actor';
export const listingRecoveryOwnerSchema = listingScopeSchema.extend({ actor_id: id, membership_id: id });
export type ListingRecoveryOwner = z.infer<typeof listingRecoveryOwnerSchema>;
const legacyJournalSchema = z.strictObject({ recovery_version: z.literal(1), state: z.enum(['uncertain', 'blocked']),
  wire: z.string().min(1).max(16384) });
const journalSchema = z.strictObject({ recovery_version: z.literal(2), state: z.enum(['uncertain', 'blocked']),
  owner: listingRecoveryOwnerSchema, endpoint: z.literal(LISTING_COMMAND_ENDPOINT), method: z.literal('POST'),
  wire: z.string().min(1).max(16384) });
export function sameListingRecoveryOwner(a: ListingRecoveryOwner | null, b: ListingRecoveryOwner | null) {
  return !!a && !!b && (Object.keys(a) as (keyof ListingRecoveryOwner)[]).every(key => sameId(a[key], b[key]));
}
/** Same existing journal; ownership/custody is local recovery evidence, NEVER command authority.
 * Legacy records have no actor witness: retain them, do not auto-upgrade or expose their wire. */
export function readListingRecovery(raw: string | null, scope: ListingScope, owner: ListingRecoveryOwner | null = null):
  { state: 'empty' | 'invalid' | 'unverified'; wire: null } | { state: 'uncertain' | 'blocked'; wire: string } {
  if (raw === null) return { state: 'empty', wire: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (legacyJournalSchema.safeParse(value).success) return { state: 'unverified', wire: null };
    const stored = journalSchema.parse(value), request = listingCommandSchema.parse(JSON.parse(stored.wire));
    if (!sameId(request.command.context_id, scope.context_id) || !sameId(request.command.workspace_id, scope.workspace_id)
      || !sameId(stored.owner.context_id, scope.context_id) || !sameId(stored.owner.workspace_id, scope.workspace_id)) throw Error();
    if (!owner) return { state: 'unverified', wire: null };
    if (!sameListingRecoveryOwner(stored.owner, listingRecoveryOwnerSchema.parse(owner))) throw Error();
    return { state: stored.state, wire: stored.wire };
  } catch { return { state: 'invalid', wire: null }; }
}
export function writeListingRecovery(wire: string, state: 'uncertain' | 'blocked', owner: ListingRecoveryOwner) {
  const request = listingCommandSchema.parse(JSON.parse(wire));
  if (!sameId(request.command.context_id, owner.context_id) || !sameId(request.command.workspace_id, owner.workspace_id)) throw Error('LISTING_RECOVERY_SCOPE');
  return JSON.stringify(journalSchema.parse({ recovery_version: 2, state, wire, owner,
    endpoint: LISTING_COMMAND_ENDPOINT, method: 'POST' }));
}

/** Affordance only; POST must recheck canonical authority in its transaction.
 * Exact retry may reconcile a committed Listing revision; all other bindings stay exact. */
export function listingActionAvailable(view: ListingReadResponse | null, request: ListingCommand, retry = false) {
  if (!view || view.connection !== 'command_bridge'
    || !sameId(view.context_id, request.command.context_id) || !sameId(view.workspace_id, request.command.workspace_id)) return false;
  const row = view.listings.find(item => sameId(item.selection.listing_id, request.selection.listing_id));
  return !!row && row.binding_state === 'bound' && row.actions[request.command.action] === 'allowed'
    && sameSelection(retry ? { ...row.selection, listing_version: request.selection.listing_version } : row.selection, request.selection);
}
