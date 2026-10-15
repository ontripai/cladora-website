import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { uuidSchema } from '../customer/workspace-composition-schema.ts';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1';
import {
  coreTransactionCommandV1Schema,
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV1,
  type CoreTransactionCommandV2,
  type CoreTransactionScopeV1,
} from './postgres-transaction-host-v1';

export const CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1 =
  'core-jurisdiction-profile-selector-request.v1' as const;
export const CORE_JURISDICTION_PROFILE_SELECTOR_DECISION_V1 =
  'core-jurisdiction-profile-selector-decision.v1' as const;

const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,79}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const timestamp = z.string().datetime({ offset: true });
const commandSchema = z.discriminatedUnion('contract_version', [
  coreTransactionCommandV1Schema,
  coreTransactionCommandV2Schema,
]);

export const jurisdictionProfileSelectorRequestV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_PROFILE_SELECTOR_REQUEST_V1),
  property_id: uuidSchema,
  expected_country_code: countryCode.optional(),
  required_domain_codes: z.array(code).min(1).max(32)
    .refine(values => new Set(values).size === values.length, 'Domain codes must be unique')
    .refine(values => values.every((value, index) => index === 0 || values[index - 1] < value),
      'Domain codes must use canonical ascending order'),
});

const decisionBase = {
  contract_version: z.literal(CORE_JURISDICTION_PROFILE_SELECTOR_DECISION_V1),
  selector_version: z.literal(1),
  decision_id: uuidSchema,
  evaluated_at: timestamp,
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  reusable_as_command_authority: z.literal(false),
} as const;

const domainBindingSchema = z.strictObject({
  domain_code: code,
  contract_version: code,
  artifact_sha256: sha256,
});

export const jurisdictionProfileSelectorDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBase,
    decision: z.literal('accepted'),
    denial_reason: z.null(),
    binding: z.strictObject({
      context_id: uuidSchema,
      workspace_id: uuidSchema,
      actor_id: uuidSchema,
      authority_version: z.number().int().positive().safe(),
      property_id: uuidSchema,
      assignment_id: uuidSchema,
      assignment_version: z.number().int().positive().safe(),
      profile_id: uuidSchema,
      profile_code: code,
      profile_version: z.number().int().positive().safe(),
      country_code: countryCode,
      default_currency_code: currencyCode,
      default_timezone: z.string().min(1).max(80),
      calendar_code: code,
      profile_manifest_sha256: sha256,
      domains: z.array(domainBindingSchema).min(1).max(32),
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
      'CURRENT_PROPERTY_DENIED',
      'JURISDICTION_UNAVAILABLE',
      'REQUIRED_DOMAIN_UNAVAILABLE',
      'PROVIDER_UNAVAILABLE',
    ]),
    binding: z.null(),
  }),
]);

export type JurisdictionProfileSelectorRequestV1 = z.infer<
  typeof jurisdictionProfileSelectorRequestV1Schema
>;
export type JurisdictionProfileSelectorDecisionV1 = z.infer<
  typeof jurisdictionProfileSelectorDecisionV1Schema
>;
type CoreCommand = CoreTransactionCommandV1 | CoreTransactionCommandV2;
type DenialReason = Extract<JurisdictionProfileSelectorDecisionV1,
  { decision: 'denied' }>['denial_reason'];

function denied(evaluatedAt: string, reason: DenialReason): JurisdictionProfileSelectorDecisionV1 {
  return jurisdictionProfileSelectorDecisionV1Schema.parse({
    contract_version: CORE_JURISDICTION_PROFILE_SELECTOR_DECISION_V1,
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

function authorityIsBoundToCommand(
  scope: CoreTransactionScopeV1,
  command: CoreCommand,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  request: JurisdictionProfileSelectorRequestV1,
) {
  return authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.reusable_as_command_authority === false
    && scope.workspace_id === command.workspace_id
    && scope.actor_id === command.actor_id
    && scope.transaction_id === command.transaction_id
    && scope.attempt === authority.transaction_context.attempt
    && command.provider_source_ids.includes(request.property_id)
    && authority.context_id === command.context_id
    && authority.workspace_id === command.workspace_id
    && authority.actor_id === command.actor_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === command.permission_code
    && authority.module_code === command.module_code
    && authority.evaluation_purpose === command.evaluation_purpose
    && authority.transaction_context.transaction_id === command.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && authority.transaction_context.lock.workspace_id === command.workspace_id
    && authority.transaction_context.lock.kind === 'command_aggregate'
    && authority.transaction_context.lock.aggregate_type === command.aggregate_type
    && authority.transaction_context.lock.aggregate_id === command.aggregate_id
    && authority.entitlement !== undefined
    && authority.entitlement.workspace_id === command.workspace_id
    && authority.entitlement.authority_revision === command.authority_version
    && authority.entitlement.module_code === command.module_code
    && Number.isFinite(Date.parse(authority.evaluated_at))
    && Date.parse(authority.evaluated_at)
      >= Date.parse(authority.transaction_context.lock.acquired_at);
}

async function contextCoversProperty(
  scope: CoreTransactionScopeV1,
  context: { scope_type: string; property_id: string | null;
    building_id: string | null; unit_id: string | null },
  propertyId: string,
) {
  if (context.scope_type === 'tenant') {
    return context.property_id === null && context.building_id === null && context.unit_id === null;
  }
  if (context.scope_type === 'property') {
    return context.property_id === propertyId
      && context.building_id === null && context.unit_id === null;
  }
  if (context.scope_type === 'building' && context.building_id !== null
    && context.property_id === propertyId && context.unit_id === null) {
    const building = await scope.query<{ property_id: string; status: string }>(`select
      b.property_id::text,b.status::text from portfolio.buildings b
      where b.id=$1 and b.tenant_id=$2 for share`, [context.building_id, scope.tenant_id]);
    return building.rowCount === 1 && building.rows[0].property_id === propertyId
      && building.rows[0].status === 'active';
  }
  if (context.scope_type === 'unit' && context.unit_id !== null
    && context.property_id === propertyId && context.building_id !== null) {
    const unit = await scope.query<{ property_id: string; building_id: string;
      unit_status: string; building_status: string }>(`select b.property_id::text,
      b.id::text as building_id,u.status::text as unit_status,b.status::text as building_status
      from portfolio.units u join portfolio.buildings b
        on b.id=u.building_id and b.tenant_id=u.tenant_id
      where u.id=$1 and u.tenant_id=$2 for share of u,b`, [context.unit_id, scope.tenant_id]);
    return unit.rowCount === 1 && unit.rows[0].property_id === propertyId
      && unit.rows[0].building_id === context.building_id
      && unit.rows[0].unit_status === 'active' && unit.rows[0].building_status === 'active';
  }
  return false;
}

/**
 * Selects the current, signed Country Pack and the exact legal/accounting/payment
 * domain artifacts required by a command. All reads and shared locks occur inside
 * the caller's Core transaction after its canonical authority recheck.
 *
 * The selector executes SELECT statements only. Its bounded result is provider
 * input and can never be reused as command authority.
 */
export async function selectCurrentPropertyJurisdictionProfileV1(
  scope: CoreTransactionScopeV1,
  commandValue: CoreCommand,
  authorityValue: CurrentAuthorityTransactionDecisionReceiptV1,
  requestValue: unknown,
): Promise<JurisdictionProfileSelectorDecisionV1> {
  const command = commandSchema.safeParse(commandValue);
  const authorityReceipt = currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(
    authorityValue,
  );
  const request = jurisdictionProfileSelectorRequestV1Schema.safeParse(requestValue);
  const fallbackTime = authorityReceipt.success
    && Number.isFinite(Date.parse(authorityReceipt.data.evaluated_at))
    ? authorityReceipt.data.evaluated_at : new Date().toISOString();
  if (!command.success || !authorityReceipt.success || !request.success
    || !authorityIsBoundToCommand(scope, command.data, authorityReceipt.data, request.data)) {
    return denied(fallbackTime, 'BINDING_MISMATCH');
  }
  const authority = authorityReceipt.data;
  if (authority.decision !== 'allowed') return denied(fallbackTime, 'AUTHORITY_DENIED');

  try {
    const execution = await scope.query<{
      transaction_id: string; actor_id: string | null; isolation: string; evaluated_at: string;
    }>(`select txid_current()::text as transaction_id,auth.uid()::text as actor_id,
      current_setting('transaction_isolation') as isolation,
      clock_timestamp()::text as evaluated_at`);
    const current = execution.rows[0];
    const evaluatedAt = current?.evaluated_at
      ? new Date(current.evaluated_at).toISOString() : fallbackTime;
    if (execution.rowCount !== 1 || current.transaction_id !== scope.database_transaction_id
      || current.actor_id !== command.data.actor_id || current.isolation !== 'serializable') {
      return denied(evaluatedAt, 'BINDING_MISMATCH');
    }

    const revision = await scope.query<{ revision: string }>(`select revision::text
      from app_private.canonical_authority_revision_v1 where singleton for share`);
    const revisionValue = Number(revision.rows[0]?.revision);
    if (revision.rowCount !== 1 || !Number.isSafeInteger(revisionValue)
      || revisionValue !== command.data.authority_version) {
      return denied(evaluatedAt, 'STALE_AUTHORITY');
    }

    const context = await scope.query<{
      tenant_id: string; workspace_status: string; actor_id: string;
      membership_status: string; membership_current: boolean; context_current: boolean;
      scope_type: string; property_id: string | null; building_id: string | null;
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
      where w.id=$1 for share of w,g,m`, [command.data.workspace_id, command.data.context_id]);
    const contextRow = context.rows[0];
    if (context.rowCount !== 1 || contextRow.tenant_id !== scope.tenant_id
      || contextRow.actor_id !== command.data.actor_id || contextRow.workspace_status !== 'ACTIVE'
      || contextRow.membership_status !== 'active' || contextRow.membership_current !== true
      || contextRow.context_current !== true
      || !await contextCoversProperty(scope, contextRow, request.data.property_id)) {
      return denied(evaluatedAt, 'CURRENT_SCOPE_DENIED');
    }

    const permission = await scope.query<{ allowed: boolean }>(
      `select app_private.check_workspace_native_permission_v2($1,$2,$3,$4) as allowed`,
      [command.data.context_id, command.data.workspace_id,
        command.data.permission_code, command.data.module_code],
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
    [scope.tenant_id, command.data.workspace_id, request.data.property_id]);
    if (workspaceBinding.rowCount !== 1) {
      return denied(evaluatedAt, 'CURRENT_PROPERTY_DENIED');
    }

    const property = await scope.query<{ status: string; country_code: string }>(`select
      p.status::text,btrim(a.country_code::text) as country_code
      from portfolio.properties p join portfolio.addresses a on a.id=p.address_id
      where p.id=$1 and p.tenant_id=$2 for share of p,a`,
    [request.data.property_id, scope.tenant_id]);
    const propertyRow = property.rows[0];
    if (property.rowCount !== 1 || propertyRow.status !== 'active'
      || request.data.expected_country_code !== undefined
        && propertyRow.country_code !== request.data.expected_country_code) {
      return denied(evaluatedAt, 'CURRENT_PROPERTY_DENIED');
    }

    const selection = await scope.query<{
      assignment_id: string; assignment_version: string; assignment_country_code: string;
      assignment_manifest_sha256: string; profile_id: string; profile_code: string;
      profile_version: string; profile_country_code: string; default_currency_code: string;
      default_timezone: string; calendar_code: string; profile_manifest_sha256: string;
      legal_signed: boolean; accounting_signed: boolean;
    }>(`select a.id::text as assignment_id,a.assignment_version::text,
      btrim(a.country_code::text) as assignment_country_code,
      a.profile_manifest_sha256 as assignment_manifest_sha256,p.id::text as profile_id,
      p.code as profile_code,p.version::text as profile_version,
      btrim(p.country_code::text) as profile_country_code,
      btrim(p.default_currency_code::text) as default_currency_code,
      p.default_timezone,p.calendar_code,p.manifest_sha256 as profile_manifest_sha256,
      (p.legal_signoff_reference is not null and p.legal_signed_at is not null) as legal_signed,
      (p.accounting_signoff_reference is not null
        and p.accounting_signed_at is not null) as accounting_signed
      from platform.property_jurisdiction_assignments a
      join platform.jurisdiction_profiles p on p.id=a.jurisdiction_profile_id
      where a.tenant_id=$1 and a.customer_workspace_id=$2 and a.property_id=$3
        and a.status='active' and a.valid_from<=statement_timestamp()
        and (a.valid_to is null or a.valid_to>statement_timestamp())
        and p.status='active' and p.valid_from<=statement_timestamp()::date
        and (p.valid_to is null or p.valid_to>statement_timestamp()::date)
      order by a.id for share of a,p`,
    [scope.tenant_id, command.data.workspace_id, request.data.property_id]);
    const selected = selection.rows[0];
    if (selection.rowCount !== 1 || selected.assignment_country_code !== propertyRow.country_code
      || selected.profile_country_code !== propertyRow.country_code
      || selected.assignment_manifest_sha256 !== selected.profile_manifest_sha256
      || selected.legal_signed !== true || selected.accounting_signed !== true) {
      return denied(evaluatedAt, 'JURISDICTION_UNAVAILABLE');
    }

    const domains = await scope.query<{
      domain_code: string; contract_version: string; artifact_sha256: string;
    }>(`select d.domain_code,d.contract_version,d.artifact_sha256
      from platform.jurisdiction_profile_domains d
      where d.jurisdiction_profile_id=$1 and d.domain_code=any($2::text[])
        and d.status='active' and d.valid_from<=statement_timestamp()::date
        and (d.valid_to is null or d.valid_to>statement_timestamp()::date)
      order by d.domain_code for share`,
    [selected.profile_id, request.data.required_domain_codes]);
    if (domains.rowCount !== request.data.required_domain_codes.length
      || domains.rows.some((domain, index) =>
        domain.domain_code !== request.data.required_domain_codes[index])) {
      return denied(evaluatedAt, 'REQUIRED_DOMAIN_UNAVAILABLE');
    }

    return jurisdictionProfileSelectorDecisionV1Schema.parse({
      contract_version: CORE_JURISDICTION_PROFILE_SELECTOR_DECISION_V1,
      selector_version: 1,
      decision_id: randomUUID(),
      decision: 'accepted',
      denial_reason: null,
      binding: {
        context_id: command.data.context_id,
        workspace_id: command.data.workspace_id,
        actor_id: command.data.actor_id,
        authority_version: command.data.authority_version,
        property_id: request.data.property_id,
        assignment_id: selected.assignment_id,
        assignment_version: Number(selected.assignment_version),
        profile_id: selected.profile_id,
        profile_code: selected.profile_code,
        profile_version: Number(selected.profile_version),
        country_code: selected.profile_country_code,
        default_currency_code: selected.default_currency_code,
        default_timezone: selected.default_timezone,
        calendar_code: selected.calendar_code,
        profile_manifest_sha256: selected.profile_manifest_sha256,
        domains: domains.rows,
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
