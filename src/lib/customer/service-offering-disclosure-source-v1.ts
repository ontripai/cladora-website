import { z } from 'zod';
import {
  providerAgreementVerificationV1InputSchema,
  type ProviderAgreementVerificationV1Input,
} from '../core/resource-contracts-v1';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionRequestV1,
} from '../core/current-authority-transaction-port-v1';
import type { CoreTransactionScopeV1 } from '../core/postgres-transaction-host-v1';
import {
  serviceEligibilityPolicySchema,
  serviceOfferingCoverageSchema,
} from './service-offering-v14-schema';
import { uuidSchema } from './workspace-composition-schema';

export const SERVICE_OFFERING_DISCLOSURE_SOURCE_V1 =
  'service-offering-disclosure-source.v1' as const;

const version = z.number().int().positive().safe();
const timestamp = z.iso.datetime({ offset: true });
const databaseVersion = z.union([
  version,
  z.string().regex(/^[1-9][0-9]*$/).transform(value => Number(value)).pipe(version),
]);

export const serviceOfferingDisclosureBindingV1Schema = z.strictObject({
  contract_version: z.literal(SERVICE_OFFERING_DISCLOSURE_SOURCE_V1),
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  offering_version: version,
  published_revision_id: uuidSchema,
  published_revision_version: version,
  provider_party_id: uuidSchema,
  provider_agreement_id: uuidSchema,
  provider_agreement_version: version,
  requested_service_scope: z.literal('service.request.create'),
  permission_code: z.literal('services.orders.request'),
});

export type ServiceOfferingDisclosureBindingV1 = z.infer<
  typeof serviceOfferingDisclosureBindingV1Schema
>;

const offeringRowSchema = z.strictObject({
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  offering_version: databaseVersion,
  published_revision_id: uuidSchema,
  provider_party_id: uuidSchema,
  definition_id: uuidSchema,
});

const revisionRowSchema = z.strictObject({
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  published_revision_id: uuidSchema,
  published_revision_version: databaseVersion,
  provider_agreement_id: uuidSchema,
  provider_agreement_version: databaseVersion,
  revision_status: z.enum(['draft', 'submitted', 'published', 'suspended', 'archived']),
  valid_from: timestamp,
  valid_until: timestamp.nullable(),
  acquisition_mode: z.enum(['direct', 'pre_quote', 'on_site', 'project', 'reservation']),
  coverage: serviceOfferingCoverageSchema,
  eligibility: serviceEligibilityPolicySchema,
});

const definitionRowSchema = z.strictObject({
  definition_id: uuidSchema,
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  definition_current: z.boolean(),
});

const providerRowSchema = z.strictObject({
  provider_party_id: uuidSchema,
  tenant_id: uuidSchema,
  provider_current: z.boolean(),
});

const sourceRowSchema = offeringRowSchema.omit({ definition_id:true }).extend({
  ...revisionRowSchema.omit({ tenant_id:true, workspace_id:true, offering_id:true }).shape,
  definition_current: z.boolean(),
  provider_current: z.boolean(),
});

const clockRowSchema = z.strictObject({
  database_transaction_id: z.string().regex(/^[1-9][0-9]*$/),
  actor_id: uuidSchema.nullable(),
  evaluated_at: timestamp,
});

export const SERVICE_OFFERING_DISCLOSURE_SQL = Object.freeze({
  offering: `select o.tenant_id::text as tenant_id,o.workspace_id::text as workspace_id,
    o.id::text as offering_id,o.lock_version::text as offering_version,
    o.published_revision_id::text as published_revision_id,
    o.provider_party_id::text as provider_party_id,
    o.definition_id::text as definition_id
  from service_catalog.offerings o
  where o.tenant_id=$1::uuid and o.workspace_id=$2::uuid and o.id=$3::uuid
  for key share of o`,
  revision: `select r.tenant_id::text as tenant_id,r.workspace_id::text as workspace_id,
    r.offering_id::text as offering_id,r.id::text as published_revision_id,
    r.revision_version::text as published_revision_version,
    r.provider_agreement_id::text as provider_agreement_id,
    r.provider_agreement_version::text as provider_agreement_version,
    r.status::text as revision_status,
    to_char(r.valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as valid_from,
    case when r.valid_until is null then null else
      to_char(r.valid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as valid_until,
    r.commercial_terms->>'acquisition_mode' as acquisition_mode,
    r.coverage,r.eligibility
  from service_catalog.revisions r
  where r.tenant_id=$1::uuid and r.workspace_id=$2::uuid
    and r.offering_id=$3::uuid and r.id=$4::uuid for share of r`,
  definition: `select d.id::text as definition_id,d.tenant_id::text as tenant_id,
    d.workspace_id::text as workspace_id,d.active as definition_current
  from service_catalog.definitions d
  where d.tenant_id=$1::uuid and d.workspace_id=$2::uuid and d.id=$3::uuid for key share of d`,
  provider: `select p.id::text as provider_party_id,p.tenant_id::text as tenant_id,
    p.archived_at is null as provider_current
  from portfolio.parties p where p.tenant_id=$1::uuid and p.id=$2::uuid for share of p`,
  clock: `select txid_current()::text as database_transaction_id,
    auth.uid()::text as actor_id,
    to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at`,
});

export type ServiceOfferingDisclosureSourceDecisionV1 =
  | {
    status: 'disclosed';
    contract_version: typeof SERVICE_OFFERING_DISCLOSURE_SOURCE_V1;
    tenant_id: string;
    workspace_id: string;
    offering_id: string;
    offering_version: number;
    published_revision_id: string;
    published_revision_version: number;
    provider_party_id: string;
    provider_agreement_id: string;
    provider_agreement_version: number;
    requested_service_scope: 'service.request.create';
    acquisition_mode: 'direct' | 'pre_quote' | 'on_site' | 'project';
    coverage_kind: 'workspace';
    revision_status: 'published';
    valid_from: string;
    valid_until: string | null;
    availability: 'available';
    evaluated_at: string;
    agreement_verification: 'not_evaluated';
    action_authorization: 'not_evaluated';
  }
  | { status: 'withheld'; code: 'AUTHORITY_DENIED' | 'SOURCE_DENIED' }
  | { status: 'conflict'; code: 'SOURCE_CHANGED' }
  | { status: 'not_ready'; code: 'SOURCE_NOT_READY' | 'SOURCE_UNAVAILABLE' };

export type ServiceOfferingDisclosureSourcePortsV1 = {
  authorityRequestFor(
    scope: CoreTransactionScopeV1,
    input: ProviderAgreementVerificationV1Input,
  ): CurrentAuthorityTransactionRequestV1;
};

/** Exact compatibility shape consumed by Core S01's existing canDisclose port. */
export type CoreS01CanDiscloseCompatibilityV1 = (
  scope: CoreTransactionScopeV1,
  input: ProviderAgreementVerificationV1Input,
) => Promise<'disclose' | 'withhold'>;

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function rowsEqual(left: z.infer<typeof sourceRowSchema>, right: z.infer<typeof sourceRowSchema>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sourceMatchesBinding(
  row: z.infer<typeof sourceRowSchema>,
  binding: ServiceOfferingDisclosureBindingV1,
) {
  return same(row.workspace_id, binding.workspace_id)
    && same(row.offering_id, binding.offering_id)
    && row.offering_version === binding.offering_version
    && same(row.published_revision_id, binding.published_revision_id)
    && row.published_revision_version === binding.published_revision_version
    && same(row.provider_party_id, binding.provider_party_id)
    && same(row.provider_agreement_id, binding.provider_agreement_id)
    && row.provider_agreement_version === binding.provider_agreement_version;
}

function sourceIsUnavailable(row: z.infer<typeof sourceRowSchema>, now: number) {
  const start = Date.parse(row.valid_from);
  const end = row.valid_until === null ? null : Date.parse(row.valid_until);
  return row.revision_status !== 'published'
    || row.acquisition_mode === 'reservation'
    || row.coverage.kind !== 'workspace'
    || !row.definition_current
    || !row.provider_current
    || !Number.isFinite(now)
    || !Number.isFinite(start)
    || now < start
    || (end !== null && (!Number.isFinite(end) || end <= start || now >= end));
}

function sourceRequiresAnotherDomain(row: z.infer<typeof sourceRowSchema>) {
  return row.eligibility.required_resource_types.length > 0
    || row.eligibility.required_capabilities.length > 0
    || row.eligibility.required_policy_codes.length > 0;
}

function sqlState(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code : undefined;
}

export async function projectServiceOfferingDisclosureSourceV1(
  scope: CoreTransactionScopeV1,
  inputValue: ProviderAgreementVerificationV1Input,
  bindingValue: ServiceOfferingDisclosureBindingV1,
  ports: ServiceOfferingDisclosureSourcePortsV1,
): Promise<ServiceOfferingDisclosureSourceDecisionV1> {
  const input = providerAgreementVerificationV1InputSchema.safeParse(inputValue);
  const binding = serviceOfferingDisclosureBindingV1Schema.safeParse(bindingValue);
  if (!input.success || !binding.success) return { status: 'not_ready', code: 'SOURCE_NOT_READY' };
  const request = input.data;
  const expected = binding.data;
  if (!same(request.context_id, expected.context_id)
    || !same(request.workspace_id, expected.workspace_id)
    || !same(request.provider_agreement_id, expected.provider_agreement_id)
    || request.provider_agreement_version !== expected.provider_agreement_version
    || request.permission_code !== expected.permission_code
    || request.requested_service_scope.length !== 1
    || request.requested_service_scope[0] !== expected.requested_service_scope
    || !same(scope.workspace_id, expected.workspace_id)) {
    return { status: 'withheld', code: 'SOURCE_DENIED' };
  }

  const scopeIdentity = Object.freeze({
    transaction_id: scope.transaction_id,
    database_transaction_id: scope.database_transaction_id,
    workspace_id: scope.workspace_id,
    tenant_id: scope.tenant_id,
    actor_id: scope.actor_id,
    attempt: scope.attempt,
  });
  const scopeUnchanged = () => Object.entries(scopeIdentity)
    .every(([key, value]) => scope[key as keyof typeof scopeIdentity] === value);
  const authorityAllowed = async () => {
    const authorityRequest = currentAuthorityTransactionRequestV1Schema.parse(
      structuredClone(ports.authorityRequestFor(scope, request)),
    );
    if (!same(authorityRequest.context_id, expected.context_id)
      || !same(authorityRequest.workspace_id, expected.workspace_id)
      || !same(authorityRequest.actor_id, scopeIdentity.actor_id)
      || authorityRequest.permission_code !== 'services.orders.request'
      || authorityRequest.module_code !== 'services_orders'
      || authorityRequest.evaluation_purpose !== 'service.create_request'
      || authorityRequest.transaction_context.transaction_id !== scopeIdentity.transaction_id
      || authorityRequest.transaction_context.attempt !== scopeIdentity.attempt
      || authorityRequest.transaction_context.lock.workspace_id !== scopeIdentity.workspace_id
      || authorityRequest.transaction_context.lock.aggregate_type !== 'service_request') return false;
    const observation = await resolveAuthority(scope, authorityRequest);
    return bindCanonicalCurrentAuthorityObservationV1(authorityRequest, observation).decision === 'allowed';
  };
  const readSource = async () => {
    const offerings = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.offering, [
      scopeIdentity.tenant_id,
      expected.workspace_id,
      expected.offering_id,
    ]);
    if (offerings.rowCount === 0 && offerings.rows.length === 0) return null;
    if (offerings.rowCount !== 1 || offerings.rows.length !== 1) throw new Error('offering_cardinality');
    const offering = offeringRowSchema.parse(offerings.rows[0]);
    const revisions = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.revision, [
      scopeIdentity.tenant_id, expected.workspace_id, expected.offering_id,
      offering.published_revision_id,
    ]);
    const definitions = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.definition, [
      scopeIdentity.tenant_id, expected.workspace_id, offering.definition_id,
    ]);
    const providers = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.provider, [
      scopeIdentity.tenant_id, offering.provider_party_id,
    ]);
    if ([revisions, definitions, providers].some(result =>
      result.rowCount !== 1 || result.rows.length !== 1)) throw new Error('source_cardinality');
    const revision = revisionRowSchema.parse(revisions.rows[0]);
    const definition = definitionRowSchema.parse(definitions.rows[0]);
    const provider = providerRowSchema.parse(providers.rows[0]);
    if (!same(revision.tenant_id, offering.tenant_id)
      || !same(revision.workspace_id, offering.workspace_id)
      || !same(revision.offering_id, offering.offering_id)
      || !same(definition.definition_id, offering.definition_id)
      || !same(definition.tenant_id, offering.tenant_id)
      || !same(definition.workspace_id, offering.workspace_id)
      || !same(provider.provider_party_id, offering.provider_party_id)
      || !same(provider.tenant_id, offering.tenant_id)) throw new Error('source_relation_mismatch');
    return sourceRowSchema.parse({
      tenant_id:offering.tenant_id,
      workspace_id:offering.workspace_id,
      offering_id:offering.offering_id,
      offering_version:offering.offering_version,
      published_revision_id:offering.published_revision_id,
      provider_party_id:offering.provider_party_id,
      published_revision_version:revision.published_revision_version,
      provider_agreement_id:revision.provider_agreement_id,
      provider_agreement_version:revision.provider_agreement_version,
      revision_status:revision.revision_status,
      valid_from:revision.valid_from,
      valid_until:revision.valid_until,
      acquisition_mode:revision.acquisition_mode,
      coverage:revision.coverage,
      eligibility:revision.eligibility,
      definition_current:definition.definition_current,
      provider_current:provider.provider_current,
    });
  };
  const readClock = async () => {
    const result = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.clock);
    if (result.rowCount !== 1 || result.rows.length !== 1) throw new Error('clock_cardinality');
    const clock = clockRowSchema.parse(result.rows[0]);
    if (!scopeUnchanged()
      || clock.database_transaction_id !== scopeIdentity.database_transaction_id
      || clock.actor_id !== scopeIdentity.actor_id) throw new Error('scope_changed');
    return clock;
  };

  try {
    if (!scopeUnchanged() || !await authorityAllowed()) {
      return { status: 'withheld', code: 'AUTHORITY_DENIED' };
    }
    const first = await readSource();
    if (first === null) return { status: 'withheld', code: 'SOURCE_DENIED' };
    // The first read may wait for Offering/revision/provider locks. Recheck the
    // canonical authority in the same host transaction before trusting it.
    if (!await authorityAllowed()) return { status: 'withheld', code: 'AUTHORITY_DENIED' };
    const current = await readSource();
    if (current === null) return { status: 'withheld', code: 'SOURCE_DENIED' };
    if (!same(current.tenant_id, scopeIdentity.tenant_id)
      || !same(current.workspace_id, expected.workspace_id)) {
      return { status: 'withheld', code: 'SOURCE_DENIED' };
    }
    if (!rowsEqual(first, current) || !sourceMatchesBinding(current, expected)) {
      return { status: 'conflict', code: 'SOURCE_CHANGED' };
    }
    // A second source query is also a potentially waiting operation. No cached
    // authority result is accepted after it.
    if (!await authorityAllowed()) return { status: 'withheld', code: 'AUTHORITY_DENIED' };
    const clock = await readClock();
    if (sourceRequiresAnotherDomain(current)) {
      return { status: 'not_ready', code: 'SOURCE_NOT_READY' };
    }
    if (sourceIsUnavailable(current, Date.parse(clock.evaluated_at))) {
      return { status: 'withheld', code: 'SOURCE_DENIED' };
    }
    // Keep the successful variant structurally narrower than the source row.
    if (current.acquisition_mode === 'reservation' || current.coverage.kind !== 'workspace') {
      return { status: 'withheld', code: 'SOURCE_DENIED' };
    }
    return {
      status: 'disclosed',
      contract_version: SERVICE_OFFERING_DISCLOSURE_SOURCE_V1,
      tenant_id: current.tenant_id,
      workspace_id: current.workspace_id,
      offering_id: current.offering_id,
      offering_version: current.offering_version,
      published_revision_id: current.published_revision_id,
      published_revision_version: current.published_revision_version,
      provider_party_id: current.provider_party_id,
      provider_agreement_id: current.provider_agreement_id,
      provider_agreement_version: current.provider_agreement_version,
      requested_service_scope: expected.requested_service_scope,
      acquisition_mode: current.acquisition_mode,
      coverage_kind: 'workspace',
      revision_status: 'published',
      valid_from: current.valid_from,
      valid_until: current.valid_until,
      availability: 'available',
      evaluated_at: clock.evaluated_at,
      agreement_verification: 'not_evaluated',
      action_authorization: 'not_evaluated',
    };
  } catch (error) {
    // The trusted transaction host owns bounded serialization retries. Preserve
    // the exact PostgreSQL error object; every other failure remains redacted.
    if (sqlState(error) === '40001') throw error;
    return { status: 'not_ready', code: 'SOURCE_UNAVAILABLE' };
  }
}

/** No S01 call occurs here: this is the source-bound policy witness S01 consumes. */
export function createServiceOfferingDisclosureCanDiscloseV1(
  bindingValue: ServiceOfferingDisclosureBindingV1,
  ports: ServiceOfferingDisclosureSourcePortsV1,
): CoreS01CanDiscloseCompatibilityV1 {
  const binding = serviceOfferingDisclosureBindingV1Schema.parse(structuredClone(bindingValue));
  return async (scope, input) => (
    await projectServiceOfferingDisclosureSourceV1(scope, input, binding, ports)
  ).status === 'disclosed' ? 'disclose' : 'withhold';
}
