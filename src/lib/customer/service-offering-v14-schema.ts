import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { serviceOfferingRevisionSchema } from './service-catalog-schema';

const timestampSchema = z.iso.datetime({ offset: true });
const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const codeSchema = z.string().trim().regex(/^[a-z][a-z0-9_.:-]{1,95}$/);

/**
 * Consumer shape for the future DW-02 canonical resource reference.
 * SERVICE stores the exact reference/version it consumed; it does not mint a
 * resource identity or infer authority from the reference.
 */
export const serviceResourceReferenceSchema = z.strictObject({
  resource_id: uuidSchema,
  resource_version: versionSchema,
  resource_type: codeSchema,
});

export const serviceProviderAgreementReferenceSchema = z.strictObject({
  agreement_id: uuidSchema,
  agreement_version: versionSchema,
});

const workspaceCoverageSchema = z.strictObject({
  kind: z.literal('workspace'),
});

const resourceCoverageSchema = z.strictObject({
  kind: z.literal('resources'),
  resources: z.array(serviceResourceReferenceSchema).min(1).max(100),
});

const geographicCoverageSchema = z.strictObject({
  kind: z.literal('geographic'),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  region_codes: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
});

export const serviceOfferingCoverageSchema = z.discriminatedUnion('kind', [
  workspaceCoverageSchema,
  resourceCoverageSchema,
  geographicCoverageSchema,
]).superRefine((coverage, ctx) => {
  if (coverage.kind === 'resources') {
    const keys = coverage.resources.map(resource => `${resource.resource_id.toLowerCase()}:${resource.resource_version}`);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: 'custom', path: ['resources'], message: 'Duplicate resource reference' });
    }
  }
  if (coverage.kind === 'geographic') {
    const regions = coverage.region_codes.map(region => region.toLocaleLowerCase('en-US'));
    if (new Set(regions).size !== regions.length) {
      ctx.addIssue({ code: 'custom', path: ['region_codes'], message: 'Duplicate region code' });
    }
  }
});

export const serviceEligibilityPolicySchema = z.strictObject({
  policy_version: versionSchema,
  required_resource_types: z.array(codeSchema).max(50),
  required_capabilities: z.array(codeSchema).max(50),
  required_policy_codes: z.array(codeSchema).max(50),
}).superRefine((policy, ctx) => {
  for (const key of ['required_resource_types', 'required_capabilities', 'required_policy_codes'] as const) {
    if (new Set(policy[key]).size !== policy[key].length) {
      ctx.addIssue({ code: 'custom', path: [key], message: `Duplicate ${key}` });
    }
  }
});

/**
 * V14 command contract only. It must not be exposed by an operational route
 * until Core supplies a server-verified provider-agreement and DW-02 resource
 * resolver. Client-supplied references are never proof of validity or access.
 */
export const createServiceOfferingV14Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  definition_id: uuidSchema,
  provider_party_id: uuidSchema,
  provider_agreement: serviceProviderAgreementReferenceSchema,
  coverage: serviceOfferingCoverageSchema,
  eligibility: serviceEligibilityPolicySchema,
  revision: serviceOfferingRevisionSchema,
  idempotency_key: idempotencyKeySchema,
});

export const createServiceRequestV14Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  published_revision_id: uuidSchema,
  provider_agreement: serviceProviderAgreementReferenceSchema,
  resource: serviceResourceReferenceSchema.nullable(),
  beneficiary_party_id: uuidSchema,
  description: z.string().trim().min(5).max(5000),
  idempotency_key: idempotencyKeySchema,
});

export const serviceConditionEvidenceV1Schema = z.strictObject({
  evidence_id: uuidSchema,
  workspace_id: uuidSchema,
  resource: serviceResourceReferenceSchema,
  service_request_id: uuidSchema.nullable(),
  service_order_id: uuidSchema.nullable(),
  category: z.enum(['inspection', 'repair', 'maintenance', 'renovation']),
  status: z.enum(['observed', 'estimated', 'completed', 'accepted']),
  amount_minor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/).nullable(),
  currency: z.enum(['RON', 'EUR', 'GBP', 'USD']).nullable(),
  occurred_on: z.iso.date(),
  source_version_id: uuidSchema,
  recorded_at: timestampSchema,
}).superRefine((evidence, ctx) => {
  if ((evidence.amount_minor === null) !== (evidence.currency === null)) {
    ctx.addIssue({ code: 'custom', path: ['amount_minor'], message: 'Amount and currency must appear together' });
  }
  if (evidence.service_request_id === null && evidence.service_order_id === null) {
    ctx.addIssue({ code: 'custom', path: ['service_request_id'], message: 'Service evidence requires a source service record' });
  }
});

export type ServiceOfferingEligibilityResult =
  | 'OK'
  | 'PROVIDER_INVALID'
  | 'AGREEMENT_INACTIVE'
  | 'OFFERING_UNAVAILABLE'
  | 'SCOPE_DENIED'
  | 'STALE_REFERENCE'
  | 'ROLE_REVOKED'
  | 'PREREQUISITE_MISSING';

export type TrustedServiceOfferingSnapshot = {
  workspaceId: string;
  providerPartyId: string;
  providerActive: boolean;
  agreementId: string;
  agreementVersion: number;
  agreementStatus: 'active' | 'suspended' | 'revoked' | 'expired';
  agreementValidFrom: string;
  agreementValidUntil: string | null;
  offeringStatus: 'draft' | 'submitted' | 'published' | 'suspended' | 'archived';
  offeringValidFrom: string;
  offeringValidUntil: string | null;
  coverage: z.infer<typeof serviceOfferingCoverageSchema>;
  eligibility: z.infer<typeof serviceEligibilityPolicySchema>;
};

export type TrustedServiceRequestContext = {
  now: number;
  workspaceId: string;
  providerPartyId: string;
  agreementId: string;
  agreementVersion: number;
  resource: z.infer<typeof serviceResourceReferenceSchema> | null;
  effectiveRole: boolean;
  capabilityCodes: ReadonlySet<string>;
  policyCodes: ReadonlySet<string>;
};

/** Pure planning over server-read snapshots; never an authorization boundary. */
export function evaluateServiceOfferingEligibility(
  offering: TrustedServiceOfferingSnapshot,
  request: TrustedServiceRequestContext,
): ServiceOfferingEligibilityResult {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!request.effectiveRole) return 'ROLE_REVOKED';
  if (!same(offering.workspaceId, request.workspaceId)) return 'SCOPE_DENIED';
  if (!offering.providerActive || !same(offering.providerPartyId, request.providerPartyId)) return 'PROVIDER_INVALID';
  if (!same(offering.agreementId, request.agreementId)
    || offering.agreementVersion !== request.agreementVersion) return 'STALE_REFERENCE';

  const agreementStart = Date.parse(offering.agreementValidFrom);
  const agreementEnd = offering.agreementValidUntil === null ? null : Date.parse(offering.agreementValidUntil);
  if (offering.agreementStatus !== 'active' || !Number.isFinite(request.now)
    || !Number.isFinite(agreementStart) || request.now < agreementStart
    || (agreementEnd !== null && (!Number.isFinite(agreementEnd) || request.now >= agreementEnd))) return 'AGREEMENT_INACTIVE';

  const offeringStart = Date.parse(offering.offeringValidFrom);
  const offeringEnd = offering.offeringValidUntil === null ? null : Date.parse(offering.offeringValidUntil);
  if (offering.offeringStatus !== 'published' || !Number.isFinite(offeringStart) || request.now < offeringStart
    || (offeringEnd !== null && (!Number.isFinite(offeringEnd) || request.now >= offeringEnd))) return 'OFFERING_UNAVAILABLE';

  if (offering.coverage.kind === 'resources') {
    if (request.resource === null) return 'SCOPE_DENIED';
    const covered = offering.coverage.resources.some(resource => same(resource.resource_id, request.resource!.resource_id)
      && resource.resource_version === request.resource!.resource_version
      && resource.resource_type === request.resource!.resource_type);
    if (!covered) return 'SCOPE_DENIED';
  }
  if (offering.coverage.kind === 'geographic') return 'PREREQUISITE_MISSING';

  if (offering.eligibility.required_resource_types.length > 0
    && (request.resource === null
      || !offering.eligibility.required_resource_types.includes(request.resource.resource_type))) return 'PREREQUISITE_MISSING';
  if (offering.eligibility.required_capabilities.some(code => !request.capabilityCodes.has(code))
    || offering.eligibility.required_policy_codes.some(code => !request.policyCodes.has(code))) return 'PREREQUISITE_MISSING';
  return 'OK';
}
