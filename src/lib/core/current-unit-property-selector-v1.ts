import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { uuidSchema } from '../customer/workspace-composition-schema.ts';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1';
import type { CoreTransactionScopeV1 } from './postgres-transaction-host-v1';

export const CORE_CURRENT_UNIT_PROPERTY_SELECTOR_REQUEST_V1 =
  'core-current-unit-property-selector-request.v1' as const;
export const CORE_CURRENT_UNIT_PROPERTY_SELECTOR_DECISION_V1 =
  'core-current-unit-property-selector-decision.v1' as const;

const timestamp = z.string().datetime({ offset: true });
const authorityVersion = z.number().int().positive().safe();

export const currentUnitPropertySelectorRequestV1Schema = z.strictObject({
  contract_version: z.literal(CORE_CURRENT_UNIT_PROPERTY_SELECTOR_REQUEST_V1),
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersion,
  property_id: uuidSchema,
  unit_id: uuidSchema,
});

const decisionBase = {
  contract_version: z.literal(CORE_CURRENT_UNIT_PROPERTY_SELECTOR_DECISION_V1),
  selector_version: z.literal(1),
  decision_id: uuidSchema,
  evaluated_at: timestamp,
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  reusable_as_command_authority: z.literal(false),
} as const;

export const currentUnitPropertySelectorDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBase,
    decision: z.literal('accepted'),
    denial_reason: z.null(),
    binding: z.strictObject({
      context_id: uuidSchema,
      workspace_id: uuidSchema,
      actor_id: uuidSchema,
      authority_version: authorityVersion,
      property_id: uuidSchema,
      property_lifecycle: z.literal('active'),
      unit_id: uuidSchema,
      unit_lifecycle: z.literal('active'),
      current_unit_to_property: z.literal(true),
    }),
  }),
  z.strictObject({
    ...decisionBase,
    decision: z.literal('denied'),
    denial_reason: z.enum([
      'BINDING_MISMATCH',
      'AUTHORITY_DENIED',
      'STALE_AUTHORITY',
      'CURRENT_SCOPE_DENIED',
      'CURRENT_UNIT_PROPERTY_DENIED',
      'PROVIDER_UNAVAILABLE',
    ]),
    binding: z.null(),
  }),
]);

export type CurrentUnitPropertySelectorRequestV1 = z.infer<
  typeof currentUnitPropertySelectorRequestV1Schema
>;
export type CurrentUnitPropertySelectorDecisionV1 = z.infer<
  typeof currentUnitPropertySelectorDecisionV1Schema
>;
type DenialReason = Extract<CurrentUnitPropertySelectorDecisionV1,
  { decision: 'denied' }>['denial_reason'];

function denied(evaluatedAt: string, reason: DenialReason): CurrentUnitPropertySelectorDecisionV1 {
  return currentUnitPropertySelectorDecisionV1Schema.parse({
    contract_version: CORE_CURRENT_UNIT_PROPERTY_SELECTOR_DECISION_V1,
    selector_version: 1,
    decision_id: randomUUID(),
    decision: 'denied',
    denial_reason: reason,
    binding: null,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

function authorityIsBoundToScope(
  scope: CoreTransactionScopeV1,
  request: CurrentUnitPropertySelectorRequestV1,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
) {
  return authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.reusable_as_command_authority === false
    && scope.workspace_id === request.workspace_id
    && scope.actor_id === request.actor_id
    && authority.context_id === request.context_id
    && authority.workspace_id === request.workspace_id
    && authority.actor_id === request.actor_id
    && authority.authority_version === request.authority_version
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && authority.transaction_context.lock.workspace_id === scope.workspace_id
    && (authority.entitlement === undefined || (
      authority.entitlement.workspace_id === request.workspace_id
      && authority.entitlement.authority_revision === request.authority_version
      && authority.entitlement.module_code === authority.module_code
    ))
    && Number.isFinite(Date.parse(authority.evaluated_at))
    && Date.parse(authority.evaluated_at)
      >= Date.parse(authority.transaction_context.lock.acquired_at);
}

function contextCoversUnit(
  context: {
    scope_type: string;
    property_id: string | null;
    building_id: string | null;
    unit_id: string | null;
  },
  propertyId: string,
  buildingId: string,
  unitId: string,
) {
  if (context.scope_type === 'tenant') {
    return context.property_id === null && context.building_id === null && context.unit_id === null;
  }
  if (context.scope_type === 'property') {
    return context.property_id === propertyId
      && context.building_id === null && context.unit_id === null;
  }
  if (context.scope_type === 'building') {
    return context.property_id === propertyId
      && context.building_id === buildingId && context.unit_id === null;
  }
  return context.scope_type === 'unit'
    && context.property_id === propertyId
    && context.building_id === buildingId
    && context.unit_id === unitId;
}

/**
 * Core-owned, transaction-scoped current unit-to-property selector. It consumes
 * the post-lock authority receipt from the same Core transaction, then holds
 * shared locks on the canonical revision, Context, Workspace, property binding,
 * property, building and unit until the host commits or rolls back.
 *
 * The selector performs only SELECT statements. Its accepted result discloses
 * bounded identity/lifecycle metadata and is never reusable as command authority.
 */
export async function selectCurrentUnitPropertyV1(
  scope: CoreTransactionScopeV1,
  authorityValue: CurrentAuthorityTransactionDecisionReceiptV1,
  requestValue: unknown,
): Promise<CurrentUnitPropertySelectorDecisionV1> {
  const request = currentUnitPropertySelectorRequestV1Schema.safeParse(requestValue);
  const receipt = currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(authorityValue);
  const fallbackTime = receipt.success && Number.isFinite(Date.parse(receipt.data.evaluated_at))
    ? receipt.data.evaluated_at : new Date().toISOString();
  if (!request.success || !receipt.success
    || !authorityIsBoundToScope(scope, request.data, receipt.data)) {
    return denied(fallbackTime, 'BINDING_MISMATCH');
  }
  const authority = receipt.data;
  if (authority.decision !== 'allowed') return denied(fallbackTime, 'AUTHORITY_DENIED');

  try {
    const execution = await scope.query<{
      transaction_id: string;
      actor_id: string | null;
      isolation: string;
      evaluated_at: string;
    }>(`select txid_current()::text as transaction_id,auth.uid()::text as actor_id,
      current_setting('transaction_isolation') as isolation,
      clock_timestamp()::text as evaluated_at`);
    const current = execution.rows[0];
    const evaluatedAt = current?.evaluated_at
      ? new Date(current.evaluated_at).toISOString() : fallbackTime;
    if (execution.rowCount !== 1 || current.transaction_id !== scope.database_transaction_id
      || current.actor_id !== request.data.actor_id || current.isolation !== 'serializable') {
      return denied(evaluatedAt, 'BINDING_MISMATCH');
    }

    // The provider has already locked this singleton after the host locks. The
    // selector reads it again to reject a substituted or historical receipt.
    const revision = await scope.query<{ revision: string }>(`select revision::text
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    const revisionValue = Number(revision.rows[0]?.revision);
    if (revision.rowCount !== 1 || !Number.isSafeInteger(revisionValue)
      || revisionValue !== request.data.authority_version) {
      return denied(evaluatedAt, 'STALE_AUTHORITY');
    }

    const context = await scope.query<{
      tenant_id: string;
      workspace_status: string;
      actor_id: string;
      membership_status: string;
      membership_current: boolean;
      context_current: boolean;
      scope_type: string;
      property_id: string | null;
      building_id: string | null;
      unit_id: string | null;
    }>(`select w.tenant_id::text,w.lifecycle_status::text as workspace_status,
      m.user_id::text as actor_id,m.status::text as membership_status,
      (m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())) as membership_current,
      (g.starts_at<=statement_timestamp()
        and (g.ends_at is null or g.ends_at>statement_timestamp())) as context_current,
      g.scope_type::text,g.property_id::text,g.building_id::text,g.unit_id::text
      from platform.customer_workspaces w
      join identity.context_grants g on g.id=$2
      join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      where w.id=$1 for share of w,g,m`, [request.data.workspace_id, request.data.context_id]);
    const contextRow = context.rows[0];
    if (context.rowCount !== 1 || contextRow.tenant_id !== scope.tenant_id
      || contextRow.actor_id !== request.data.actor_id || contextRow.workspace_status !== 'ACTIVE'
      || contextRow.membership_status !== 'active' || contextRow.membership_current !== true
      || contextRow.context_current !== true) {
      return denied(evaluatedAt, 'CURRENT_SCOPE_DENIED');
    }

    const permission = await scope.query<{ allowed: boolean }>(
      `select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed`,
      [request.data.context_id, request.data.workspace_id,
        authority.permission_code, authority.module_code],
    );
    if (permission.rowCount !== 1 || permission.rows[0].allowed !== true) {
      return denied(evaluatedAt, 'AUTHORITY_DENIED');
    }

    const workspaceBinding = await scope.query<{ id: string }>(`select b.id::text
      from platform.workspace_property_bindings b
      where b.tenant_id=$1 and b.customer_workspace_id=$2 and b.property_id=$3
        and b.status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp())
      order by b.id for share`,
    [scope.tenant_id, request.data.workspace_id, request.data.property_id]);
    if (workspaceBinding.rowCount !== 1) {
      return denied(evaluatedAt, 'CURRENT_UNIT_PROPERTY_DENIED');
    }

    const property = await scope.query<{ status: string }>(`select p.status::text
      from portfolio.properties p where p.id=$1 and p.tenant_id=$2 for share`,
    [request.data.property_id, scope.tenant_id]);
    if (property.rowCount !== 1 || property.rows[0].status !== 'active') {
      return denied(evaluatedAt, 'CURRENT_UNIT_PROPERTY_DENIED');
    }

    const ancestry = await scope.query<{
      unit_status: string;
      building_status: string;
      property_status: string;
      building_id: string;
      property_id: string;
    }>(`select u.status::text as unit_status,b.status::text as building_status,
      p.status::text as property_status,b.id::text as building_id,p.id::text as property_id
      from portfolio.units u
      join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
      join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id
      where u.id=$1 and u.tenant_id=$2 for share of u,b,p`,
    [request.data.unit_id, scope.tenant_id]);
    const ancestryRow = ancestry.rows[0];
    if (ancestry.rowCount !== 1 || ancestryRow.property_id !== request.data.property_id
      || ancestryRow.unit_status !== 'active' || ancestryRow.building_status !== 'active'
      || ancestryRow.property_status !== 'active'
      || !contextCoversUnit(contextRow, ancestryRow.property_id,
        ancestryRow.building_id, request.data.unit_id)) {
      return denied(evaluatedAt, 'CURRENT_UNIT_PROPERTY_DENIED');
    }

    return currentUnitPropertySelectorDecisionV1Schema.parse({
      contract_version: CORE_CURRENT_UNIT_PROPERTY_SELECTOR_DECISION_V1,
      selector_version: 1,
      decision_id: randomUUID(),
      decision: 'accepted',
      denial_reason: null,
      binding: {
        context_id: request.data.context_id,
        workspace_id: request.data.workspace_id,
        actor_id: request.data.actor_id,
        authority_version: request.data.authority_version,
        property_id: request.data.property_id,
        property_lifecycle: 'active',
        unit_id: request.data.unit_id,
        unit_lifecycle: 'active',
        current_unit_to_property: true,
      },
      evaluated_at: evaluatedAt,
      source_disclosure: 'status_only',
      source_reference: null,
      reusable_as_command_authority: false,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return denied(fallbackTime, 'PROVIDER_UNAVAILABLE');
  }
}
