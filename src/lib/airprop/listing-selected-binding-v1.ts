import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CoreTransactionCommandV1, CoreTransactionScopeV1, CoreTransactionProvidersV1 } from '../core/postgres-transaction-host-v1';
import { mapAirpropCoreCompanionV1 } from '../core/airprop-companion-mapping-v1';
import { listingSelectionSchema, sameId, sameSelection } from './listing-flow-contract-v1';
import { prepareListingControlV1 } from './listing-control-plan-v1';
import { prepareListingPublicationV1 } from './listing-publication-v1';

const uuid = z.string().uuid();
const revision = z.number().int().positive().max(2147483647);
const storedSchema = z.strictObject({
  tenant_id: uuid, context_id: uuid, workspace_id: uuid, actor_id: uuid,
  selection: listingSelectionSchema, spec_id: uuid, spec_version: revision,
  command_id: uuid, transaction_id: uuid, command_key: z.string(), wire_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
type Stored = z.infer<typeof storedSchema>;
type Plan = ReturnType<typeof prepareListingControlV1> | ReturnType<typeof prepareListingPublicationV1>;
export type ListingSelectedCanonicalV1 = Readonly<{
  core: Parameters<typeof mapAirpropCoreCompanionV1>[0];
  spec: Readonly<{ id: string; version: number }>;
}>;
type CanonicalRecheck = (scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1) => Promise<ListingSelectedCanonicalV1>;
/** Consume the EXISTING Core mutate port. Only canonical observation is supplied
 * by its still-required official producer; storage/native mutation is implemented
 * below, not delegated to a placeholder callback. No authority evaluator replaced. */
export function createListingSelectedBindingMutatorV1(plan: Plan,
  recheckCanonical: CanonicalRecheck,
): CoreTransactionProvidersV1['mutate'] {
  return async (scope, command) => mutateListingWithSelectedBindingV1(scope, command, plan, recheckCanonical);
}
export const LISTING_SELECTED_BINDING_READ_SQL = `select binding as value from airprop.listing_selected_bindings_v1
  where tenant_id=$1::uuid and workspace_id=$2::uuid and context_id=$3::uuid
    and listing_id=$4::uuid and listing_version=$5::integer`;
export const LISTING_SELECTED_SPEC_SQL = `select s.id::text,s.version from portfolio.unit_specification_versions s
  join portfolio.units u on u.id=s.unit_id and u.tenant_id=s.tenant_id
  join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where s.id=$1::uuid and s.unit_id=$2::uuid and s.tenant_id=$3::uuid
    and b.property_id=$4::uuid and s.version=$5::integer
    and not exists(select 1 from portfolio.unit_specification_versions newer
      where newer.unit_id=s.unit_id and newer.tenant_id=s.tenant_id and newer.version>s.version)
  for share of s,u,b`;
export const LISTING_SELECTED_BINDING_INSERT_SQL = `insert into airprop.listing_selected_bindings_v1
  (tenant_id,workspace_id,context_id,listing_id,listing_version,binding)
  values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::integer,$6::jsonb) returning binding as value`;

/** Internal authorized-scope read; no write/backfill/fallback and no public existence API.
 * Caller must establish current read authority before calling; stored history is not an allow. */
export async function readListingSelectedBindingV1(scope: CoreTransactionScopeV1, context: string, listing: string, version: number) {
  uuid.parse(context); uuid.parse(listing); revision.parse(version);
  const r = await scope.query(LISTING_SELECTED_BINDING_READ_SQL, [scope.tenant_id, scope.workspace_id, context, listing, version]);
  if (r.rowCount === 0 && r.rows.length === 0) return null;
  if (r.rowCount !== 1 || r.rows.length !== 1) throw Error('LISTING_BINDING_INVALID');
  const value = storedSchema.parse(r.rows[0].value);
  if (!sameId(value.tenant_id, scope.tenant_id) || !sameId(value.workspace_id, scope.workspace_id)
    || !sameId(value.context_id, context) || !sameId(value.selection.listing_id, listing)
    || value.selection.listing_version !== version) throw Error('LISTING_BINDING_SCOPE');
  return value;
}

/** Actual domain mutation for an EXISTING C03 mutate(scope, command) callback.
 * No pool, COMMIT, receipt or retry engine. Every error must escape to the host;
 * it must roll back the native write AND this binding insert together.
 * Core still owns current authority/lock/evidence/replay. The supplied canonical
 * observation must come from that same admitted scope, never from request JSON.
 * Not wired to the default route until its official Listing producer is delivered. */
export async function mutateListingWithSelectedBindingV1(scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV1, plan: Plan, recheckCanonical: CanonicalRecheck) {
  const request = plan.request, c = request.command, selected = request.selection;
  if (!sameId(scope.actor_id, command.actor_id) || !sameId(scope.workspace_id, command.workspace_id)
    || !sameId(scope.transaction_id, command.transaction_id) || !sameId(command.context_id, c.context_id)
    || !sameId(command.workspace_id, c.workspace_id) || command.idempotency_key !== c.idempotency_key
    || command.permission_code !== 'airprop.opportunity.manage' || command.module_code !== 'airprop_commercial'
    || command.evaluation_purpose !== 'airprop.b2') throw Error('LISTING_BINDING_COMMAND');
  const fingerprint = `sha256:${createHash('sha256').update(plan.wire, 'utf8').digest('hex')}`;
  if (command.input_fingerprint !== fingerprint || command.aggregate_type !== 'portfolio.unit'
    || !sameId(command.aggregate_id, selected.unit_id)
    || ![selected.unit_id, selected.property_id, selected.party_id, selected.relationship_id]
      .every(id => command.provider_source_ids.some(source => sameId(source, id)))) throw Error('LISTING_BINDING_COMMAND');
  // Reparse original bytes; a caller-mutated plan/SQL/value array cannot redirect effects.
  const parsed = 'listing_id' in selected
    ? prepareListingControlV1(plan.wire, { context_id: c.context_id, workspace_id: c.workspace_id })
    : prepareListingPublicationV1(plan.wire, { context_id: c.context_id, workspace_id: c.workspace_id });
  if (JSON.stringify(parsed) !== JSON.stringify(plan)) throw Error('LISTING_BINDING_PLAN');
  const validateCanonical = (canonical: ListingSelectedCanonicalV1) => {
    const mapped = mapAirpropCoreCompanionV1(canonical.core);
    const coreRequest = canonical.core.request as { resource?: { permission_code?: string; purpose?: string }; authority?: { module_code?: string } };
    if (mapped.disclosure !== 'verified' || !mapped.context_id || !mapped.resource || !mapped.party
      || !sameId(mapped.context_id, c.context_id) || !sameId(mapped.resource.tenant_id, scope.tenant_id)
      || !sameId(mapped.resource.workspace_id, scope.workspace_id) || mapped.resource.resource_type !== 'unit'
      || !sameId(mapped.resource.resource_id, selected.unit_id) || !sameId(selected.unit_id, selected.resource_id)
      || mapped.resource.resource_version !== selected.resource_version
      || !sameId(mapped.party.party_id, selected.party_id) || mapped.party.party_kind !== selected.party_kind
      || coreRequest?.resource?.permission_code !== command.permission_code || coreRequest.resource.purpose !== command.evaluation_purpose
      || coreRequest.authority?.module_code !== command.module_code) throw Error('LISTING_BINDING_CANONICAL');
    const relationship = (canonical.core.companion as { relationship: { relationship_id: string; relationship_version: number; relationship_kind: string } }).relationship;
    if (!sameId(relationship.relationship_id, selected.relationship_id) || relationship.relationship_version !== selected.relationship_version
      || relationship.relationship_kind !== selected.relationship_kind) throw Error('LISTING_BINDING_RELATIONSHIP');
    const spec = z.strictObject({ id: uuid, version: revision }).parse(canonical.spec);
    if (spec.version !== selected.resource_version
      || !command.provider_source_ids.some(source => sameId(source, spec.id))) throw Error('LISTING_BINDING_SPEC');
    return spec;
  };
  const spec = validateCanonical(await recheckCanonical(scope, command));
  const actual = await scope.query(LISTING_SELECTED_SPEC_SQL, [spec.id, selected.unit_id, scope.tenant_id, selected.property_id, spec.version]);
  if (actual.rowCount !== 1 || actual.rows.length !== 1 || !sameId(actual.rows[0].id, spec.id)
    || actual.rows[0].version !== spec.version) throw Error('LISTING_BINDING_SPEC');
  if ('listing_id' in selected) {
    const old = await readListingSelectedBindingV1(scope, c.context_id, selected.listing_id, selected.listing_version);
    if (!old) throw Error('LISTING_LEGACY_BINDING_UNAVAILABLE');
    if (!sameSelection(old.selection, selected) || !sameId(old.spec_id, spec.id) || old.spec_version !== spec.version) throw Error('LISTING_BINDING_DRIFT');
  }
  // A pre-lock observation cannot authorize effects after the spec/binding waits.
  // The official producer must re-evaluate expiry/revoke and hold its canonical
  // source locks in this SAME scope. No Date.now, cached allow or synthetic lease.
  const finalSpec = validateCanonical(await recheckCanonical(scope, command));
  if (!sameId(finalSpec.id, spec.id) || finalSpec.version !== spec.version) throw Error('LISTING_BINDING_SPEC');
  const result = await scope.query(parsed.native.sql, [...parsed.native.values]);
  const native = z.strictObject({ version: z.literal(1), listing_id: uuid, listing_version: revision.optional(),
    status: z.enum(['published', 'withdrawn']), idempotent: z.boolean() }).parse(result.rows[0]?.result);
  if (result.rowCount !== 1 || result.rows.length !== 1 || native.idempotent) throw Error('LISTING_NATIVE_REPLAY_REQUIRES_CORE_RECEIPT');
  const next = 'listing_id' in selected ? selected.listing_version + 1 : 1;
  if (('listing_id' in selected && (!sameId(native.listing_id, selected.listing_id) || native.listing_version !== next))
    || (!('listing_id' in selected) && native.listing_version !== undefined && native.listing_version !== 1)
    || native.status !== (c.action === 'withdraw_listing' ? 'withdrawn' : 'published')) throw Error('LISTING_BINDING_RESULT');
  const value: Stored = storedSchema.parse({ tenant_id: scope.tenant_id, context_id: c.context_id,
    workspace_id: scope.workspace_id, actor_id: scope.actor_id, selection: { ...selected, listing_id: native.listing_id, listing_version: next },
    spec_id: spec.id, spec_version: spec.version, command_id: command.command_id, transaction_id: command.transaction_id,
    command_key: c.idempotency_key, wire_sha256: createHash('sha256').update(plan.wire, 'utf8').digest('hex') });
  const stored = await scope.query(LISTING_SELECTED_BINDING_INSERT_SQL,
    [scope.tenant_id, scope.workspace_id, c.context_id, native.listing_id, next, JSON.stringify(value)]);
  if (stored.rowCount !== 1 || stored.rows.length !== 1 || JSON.stringify(storedSchema.parse(stored.rows[0]?.value)) !== JSON.stringify(value)) throw Error('LISTING_BINDING_PERSISTENCE');
  // Host generates/stores the real commit receipt AFTER this callback; this is only
  // its mutation identity. JSON binding/id/version is NEVER a committed receipt.
  return { mutation_id: native.listing_id };
}
