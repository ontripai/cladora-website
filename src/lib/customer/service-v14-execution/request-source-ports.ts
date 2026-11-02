import { z } from 'zod';
import {
  providerAgreementVerificationV1Schema,
  type ProviderAgreementVerificationV1,
  type ProviderAgreementVerificationV1Input,
} from '../../core/resource-contracts-v1';
import { resolveAuthority } from '../../core/current-authority-postgres-provider-v1';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
  type CurrentAuthorityTransactionRequestV1,
} from '../../core/current-authority-transaction-port-v1';
import type { CoreTransactionScopeV1 } from '../../core/postgres-transaction-host-v1';
import { SERVICE_OFFERING_DISCLOSURE_SQL } from '../service-offering-disclosure-source-v1';
import {
  serviceEligibilityPolicySchema,
  serviceOfferingCoverageSchema,
} from '../service-offering-v14-schema';
import type { ServiceOfferingRequestPreflightInputV1 } from '../service-offering-request-flow-contract';
import { uuidSchema } from '../workspace-composition-schema';
import {
  SERVICE_S01_PROVIDER_AGREEMENT,
  type ServiceOfferingRequestFlowPortsV1,
  type ServiceOfferingRequestPrincipalV1,
  type ServiceOfferingRequestSnapshotV1,
} from './application-flow';

export const SERVICE_REQUEST_SOURCE_PORTS_V1 = 'service-request-source-ports.v1' as const;

const version = z.number().int().positive().safe();
const databaseVersion = z.union([
  version,
  z.string().regex(/^[1-9][0-9]*$/).transform(value => Number(value)).pipe(version),
]);
const timestamp = z.iso.datetime({ offset: true });

const offeringRowSchema = z.strictObject({
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  offering_version: databaseVersion,
  published_revision_id: uuidSchema.nullable(),
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
const clockRowSchema = z.strictObject({
  database_transaction_id: z.string().regex(/^[1-9][0-9]*$/),
  actor_id: uuidSchema.nullable(),
  evaluated_at: timestamp,
});

type RequestSourceAuthorityInputV1 = {
  context_id: string;
  workspace_id: string;
  offering_id: string;
  purpose: 'service.request.preflight' | 'service.create_request';
};

export type ServiceRequestSourceAuthorityRequestFactoryV1 = (
  scope: CoreTransactionScopeV1,
  input: RequestSourceAuthorityInputV1,
) => CurrentAuthorityTransactionRequestV1;

export type AcceptedServiceS01ReaderV1 = (
  scope: CoreTransactionScopeV1,
  input: ProviderAgreementVerificationV1Input,
) => Promise<ProviderAgreementVerificationV1>;

export type ServiceOfferingRequestSourceDependenciesV1 = {
  authorityRequestFor: ServiceRequestSourceAuthorityRequestFactoryV1;
  /** Absent until Core's accepted S01 implementation is bound. */
  resolveProviderAgreement?: AcceptedServiceS01ReaderV1;
};

export type ServiceOfferingRequestSourcePortsV1 = Pick<
  ServiceOfferingRequestFlowPortsV1,
  'loadOffering' | 'resolvePrincipal' | 'resolveProviderAgreement' | 'now'
>;

export class ServiceOfferingRequestSourceUnavailableV1 extends Error {
  constructor(readonly code: 'INVALID_SCOPE' | 'SOURCE_UNAVAILABLE' | 'S01_UNAVAILABLE') {
    super(code);
    this.name = 'ServiceOfferingRequestSourceUnavailableV1';
  }
}

const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const sqlState = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error
  ? (error as { code?: unknown }).code : undefined;

function sanitize(error: unknown): never {
  if (sqlState(error) === '40001') throw error;
  if (error instanceof ServiceOfferingRequestSourceUnavailableV1) throw error;
  throw new ServiceOfferingRequestSourceUnavailableV1('SOURCE_UNAVAILABLE');
}

/**
 * Read-only adapters for a single trusted serializable transaction scope.
 * The caller owns the transaction, Workspace lock and authority-request identity.
 * This factory never creates a transaction, retries, writes, or activates runtime.
 */
export function createServiceOfferingRequestSourcePortsV1(
  scope: CoreTransactionScopeV1,
  dependencies: ServiceOfferingRequestSourceDependenciesV1,
): ServiceOfferingRequestSourcePortsV1 {
  const identity = Object.freeze({
    transaction_id: scope.transaction_id,
    database_transaction_id: scope.database_transaction_id,
    workspace_id: scope.workspace_id,
    tenant_id: scope.tenant_id,
    actor_id: scope.actor_id,
    attempt: scope.attempt,
  });
  const scopeUnchanged = () => Object.entries(identity)
    .every(([key, value]) => scope[key as keyof typeof identity] === value);
  let lastEvaluatedAt = Number.NaN;

  const authority = async (
    input: RequestSourceAuthorityInputV1,
  ): Promise<CurrentAuthorityTransactionDecisionReceiptV1> => {
    if (!scopeUnchanged() || !same(input.workspace_id, identity.workspace_id)) {
      throw new ServiceOfferingRequestSourceUnavailableV1('INVALID_SCOPE');
    }
    const request = currentAuthorityTransactionRequestV1Schema.parse(structuredClone(
      dependencies.authorityRequestFor(scope, input),
    ));
    if (!same(request.context_id, input.context_id)
      || !same(request.workspace_id, input.workspace_id)
      || !same(request.actor_id, identity.actor_id)
      || request.permission_code !== 'services.orders.request'
      || request.module_code !== 'services_orders'
      || request.evaluation_purpose !== input.purpose
      || request.transaction_context.transaction_id !== identity.transaction_id
      || request.transaction_context.attempt !== identity.attempt
      || request.transaction_context.isolation_level !== 'serializable'
      || !same(request.transaction_context.lock.workspace_id, identity.workspace_id)
      || request.transaction_context.lock.aggregate_type !== 'service_request'
      || !same(request.transaction_context.lock.aggregate_id, input.offering_id)) {
      throw new ServiceOfferingRequestSourceUnavailableV1('INVALID_SCOPE');
    }
    return bindCanonicalCurrentAuthorityObservationV1(
      request,
      await resolveAuthority(scope, request),
    );
  };

  const clock = async () => {
    const result = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.clock);
    if (result.rowCount !== 1 || result.rows.length !== 1) {
      throw new ServiceOfferingRequestSourceUnavailableV1('SOURCE_UNAVAILABLE');
    }
    const row = clockRowSchema.parse(result.rows[0]);
    if (!scopeUnchanged()
      || row.database_transaction_id !== identity.database_transaction_id
      || row.actor_id !== identity.actor_id) {
      throw new ServiceOfferingRequestSourceUnavailableV1('INVALID_SCOPE');
    }
    lastEvaluatedAt = Date.parse(row.evaluated_at);
    return row;
  };

  const loadOffering = async (
    input: ServiceOfferingRequestPreflightInputV1,
  ): Promise<ServiceOfferingRequestSnapshotV1 | null> => {
    try {
      if (!same(input.workspace_id, identity.workspace_id)) return null;
      const authorityInput = {
        context_id: input.context_id,
        workspace_id: input.workspace_id,
        offering_id: input.offering_id,
        purpose: 'service.request.preflight' as const,
      };
      if ((await authority(authorityInput)).decision !== 'allowed') return null;
      const offerings = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.offering, [
        identity.tenant_id, input.workspace_id, input.offering_id,
      ]);
      if (offerings.rowCount === 0 && offerings.rows.length === 0) return null;
      if (offerings.rowCount !== 1 || offerings.rows.length !== 1) {
        throw new ServiceOfferingRequestSourceUnavailableV1('SOURCE_UNAVAILABLE');
      }
      const offering = offeringRowSchema.parse(offerings.rows[0]);
      if (!same(offering.tenant_id, identity.tenant_id)
        || !same(offering.workspace_id, identity.workspace_id)
        || !same(offering.offering_id, input.offering_id)) return null;
      if (offering.published_revision_id === null) return null;
      const revisions = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.revision, [
        identity.tenant_id, input.workspace_id, input.offering_id, offering.published_revision_id,
      ]);
      const definitions = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.definition, [
        identity.tenant_id, input.workspace_id, offering.definition_id,
      ]);
      const providers = await scope.query(SERVICE_OFFERING_DISCLOSURE_SQL.provider, [
        identity.tenant_id, offering.provider_party_id,
      ]);
      if ([revisions, definitions, providers].some(result =>
        result.rowCount !== 1 || result.rows.length !== 1)) return null;
      const revision = revisionRowSchema.parse(revisions.rows[0]);
      const definition = definitionRowSchema.parse(definitions.rows[0]);
      const provider = providerRowSchema.parse(providers.rows[0]);
      if (!same(revision.tenant_id, offering.tenant_id)
        || !same(revision.workspace_id, offering.workspace_id)
        || !same(revision.offering_id, offering.offering_id)
        || !same(revision.published_revision_id, offering.published_revision_id)
        || !same(definition.definition_id, offering.definition_id)
        || !same(definition.tenant_id, offering.tenant_id)
        || !same(definition.workspace_id, offering.workspace_id)
        || !same(provider.provider_party_id, offering.provider_party_id)
        || !same(provider.tenant_id, offering.tenant_id)) {
        throw new ServiceOfferingRequestSourceUnavailableV1('SOURCE_UNAVAILABLE');
      }
      // Source locks can wait. The result is unusable without a fresh authority
      // observation in the same transaction after every source lock is held.
      if ((await authority(authorityInput)).decision !== 'allowed') return null;
      await clock();
      if ((await authority(authorityInput)).decision !== 'allowed') return null;
      if (!definition.definition_current || !provider.provider_current
        || revision.revision_status !== 'published') return null;
      return {
        workspace_id: offering.workspace_id,
        offering_id: offering.offering_id,
        offering_version: offering.offering_version,
        published_revision_id: revision.published_revision_id,
        published_revision_version: revision.published_revision_version,
        provider_party_id: offering.provider_party_id,
        provider_agreement_id: revision.provider_agreement_id,
        provider_agreement_version: revision.provider_agreement_version,
        status: 'published',
        acquisition_mode: revision.acquisition_mode,
        valid_from: revision.valid_from,
        valid_until: revision.valid_until,
        coverage: revision.coverage,
        eligibility: revision.eligibility,
        current_actor_can_request: true,
      };
    } catch (error) {
      sanitize(error);
    }
  };

  const resolvePrincipal = async (input: {
    context_id: string;
    workspace_id: string;
    offering_id: string;
  }): Promise<ServiceOfferingRequestPrincipalV1 | null> => {
    try {
      const authorityInput = {
        ...input,
        purpose: 'service.create_request' as const,
      };
      const first = await authority(authorityInput);
      if (first.decision !== 'allowed') return null;
      await clock();
      const current = await authority(authorityInput);
      if (current.decision !== 'allowed'
        || current.actor_id !== first.actor_id
        || current.authority_version !== first.authority_version) return null;
      return { actor_id: current.actor_id, authority_version: current.authority_version };
    } catch (error) {
      sanitize(error);
    }
  };

  return {
    loadOffering,
    resolvePrincipal,
    async resolveProviderAgreement(input) {
      if (input.contract_version !== SERVICE_S01_PROVIDER_AGREEMENT
        || dependencies.resolveProviderAgreement === undefined) {
        throw new ServiceOfferingRequestSourceUnavailableV1('S01_UNAVAILABLE');
      }
      try {
        return providerAgreementVerificationV1Schema.parse(
          await dependencies.resolveProviderAgreement(scope, input),
        );
      } catch (error) {
        sanitize(error);
      }
    },
    now() {
      if (!Number.isFinite(lastEvaluatedAt)) {
        throw new ServiceOfferingRequestSourceUnavailableV1('SOURCE_UNAVAILABLE');
      }
      return lastEvaluatedAt;
    },
  };
}
