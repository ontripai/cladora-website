import { z } from 'zod';
import { uuidSchema } from '../customer/workspace-composition-schema.ts';

const timestampSchema = z.string().datetime({ offset: true });
const dateSchema = z.string().date();
const permissionCodeSchema = z.string().regex(/^[a-z0-9_.:-]{3,128}$/);
const purposeSchema = z.string().regex(/^[a-z0-9_.:-]{3,128}$/);

export const canonicalResourceTypeV1Schema = z.enum([
  'party',
  'property',
  'building',
  'entrance',
  'unit',
  'asset',
]);

export const canonicalPartyKindV1Schema = z.enum([
  'person',
  'company',
  'association',
  'public_body',
]);

export const canonicalResourceReferenceV1InputSchema = z.strictObject({
  contract_version: z.literal('canonical-resource-reference.v1'),
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  resource_type: canonicalResourceTypeV1Schema,
  resource_id: uuidSchema,
  resource_version: z.number().int().positive(),
  permission_code: permissionCodeSchema,
  purpose: purposeSchema,
});

const canonicalResourceVerifiedV1Schema = z.strictObject({
  contract_version: z.literal('canonical-resource-reference.v1'),
  reference_status: z.literal('verified'),
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  resource_type: canonicalResourceTypeV1Schema,
  resource_id: uuidSchema,
  resource_version: z.number().int().positive(),
  party_kind: canonicalPartyKindV1Schema.nullable(),
  display_name: z.string().min(1).max(240).nullable(),
  lifecycle_status: z.string().min(1).max(64),
  evaluated_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
});

const canonicalResourceStaleV1Schema = canonicalResourceVerifiedV1Schema.extend({
  reference_status: z.literal('stale'),
});

const canonicalResourceAbsentV1Schema = z.strictObject({
  contract_version: z.literal('canonical-resource-reference.v1'),
  reference_status: z.literal('not_found'),
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  resource_type: canonicalResourceTypeV1Schema,
  resource_id: uuidSchema,
  resource_version: z.null(),
  party_kind: z.null(),
  display_name: z.null(),
  lifecycle_status: z.null(),
  evaluated_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
});

const canonicalResourceWithheldV1Schema = canonicalResourceAbsentV1Schema.extend({
  reference_status: z.literal('withheld'),
  tenant_id: z.null(),
  workspace_id: z.null(),
  resource_type: z.null(),
  resource_id: z.null(),
});

export const canonicalResourceReferenceV1Schema = z.discriminatedUnion('reference_status', [
  canonicalResourceVerifiedV1Schema,
  canonicalResourceStaleV1Schema,
  canonicalResourceAbsentV1Schema,
  canonicalResourceWithheldV1Schema,
]);

export const resourceRelationshipKindV1Schema = z.enum([
  'ownership',
  'management',
  'operation',
  'occupancy',
  'representation',
  'provider',
  'access',
]);

export const resourceRelationshipV1Schema = z.strictObject({
  contract_version: z.literal('resource-relationship.v1'),
  relationship_id: uuidSchema,
  relationship_version: z.number().int().positive(),
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  party_id: uuidSchema,
  party_kind: canonicalPartyKindV1Schema,
  resource_type: canonicalResourceTypeV1Schema,
  resource_id: uuidSchema,
  relationship_kind: resourceRelationshipKindV1Schema,
  scope_codes: z.array(z.string().regex(/^[a-z0-9_.:-]{1,128}$/)).max(64),
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
  evidence_reference: z.string().min(1).max(240).nullable(),
  relationship_status: z.enum(['effective', 'expired', 'revoked', 'superseded']),
  evaluated_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
}).superRefine((value, ctx) => {
  if (value.valid_until !== null && value.valid_until <= value.valid_from) {
    ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'valid_until_must_follow_valid_from' });
  }
});

export const providerAgreementVerificationV1InputSchema = z.strictObject({
  contract_version: z.literal('provider-agreement-verification.v1'),
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  provider_agreement_id: uuidSchema,
  provider_agreement_version: z.number().int().positive(),
  requested_service_scope: z.array(z.string().regex(/^[a-z0-9_.:-]{1,128}$/)).min(1).max(64),
  permission_code: permissionCodeSchema,
});

export const providerAgreementVerificationV1Schema = z.discriminatedUnion('agreement_status', [
  z.strictObject({
    contract_version: z.literal('provider-agreement-verification.v1'),
    agreement_status: z.enum(['effective', 'expired', 'revoked', 'not_effective']),
    tenant_id: uuidSchema,
    workspace_id: uuidSchema,
    provider_party_id: uuidSchema,
    provider_agreement_id: uuidSchema,
    provider_agreement_version: z.number().int().positive(),
    valid_from: dateSchema,
    valid_until: dateSchema.nullable(),
    allowed_service_scope: z.array(z.string().regex(/^[a-z0-9_.:-]{1,128}$/)).max(64),
    evaluated_at: timestampSchema,
    action_authorization: z.literal('not_evaluated'),
  }),
  z.strictObject({
    contract_version: z.literal('provider-agreement-verification.v1'),
    agreement_status: z.literal('withheld'),
    tenant_id: z.null(),
    workspace_id: z.null(),
    provider_party_id: z.null(),
    provider_agreement_id: z.null(),
    provider_agreement_version: z.null(),
    valid_from: z.null(),
    valid_until: z.null(),
    allowed_service_scope: z.array(z.never()).max(0),
    evaluated_at: timestampSchema,
    action_authorization: z.literal('not_evaluated'),
  }),
]);

export const geographicCoverageResolutionV1InputSchema = z.strictObject({
  contract_version: z.literal('geographic-coverage-resolution.v1'),
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  country_code: z.string().regex(/^[A-Z]{2}$/),
  region_code: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,31}$/).nullable(),
  source_version: z.number().int().positive().nullable(),
  permission_code: permissionCodeSchema,
  purpose: purposeSchema,
});

export const geographicCoverageResolutionV1Schema = z.discriminatedUnion('resolution_status', [
  z.strictObject({
    contract_version: z.literal('geographic-coverage-resolution.v1'),
    resolution_status: z.enum(['verified', 'stale', 'unsupported']),
    tenant_id: uuidSchema,
    workspace_id: uuidSchema,
    country_code: z.string().regex(/^[A-Z]{2}$/),
    region_code: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,31}$/).nullable(),
    geography_version: z.number().int().positive(),
    source_code: z.string().regex(/^[a-z0-9_.:-]{1,128}$/),
    evaluated_at: timestampSchema,
    action_authorization: z.literal('not_evaluated'),
  }),
  z.strictObject({
    contract_version: z.literal('geographic-coverage-resolution.v1'),
    resolution_status: z.literal('withheld'),
    tenant_id: z.null(),
    workspace_id: z.null(),
    country_code: z.null(),
    region_code: z.null(),
    geography_version: z.null(),
    source_code: z.null(),
    evaluated_at: timestampSchema,
    action_authorization: z.literal('not_evaluated'),
  }),
]);

export type CanonicalResourceReferenceV1Input = z.infer<typeof canonicalResourceReferenceV1InputSchema>;
export type CanonicalResourceReferenceV1 = z.infer<typeof canonicalResourceReferenceV1Schema>;
export type ResourceRelationshipV1 = z.infer<typeof resourceRelationshipV1Schema>;
export type ProviderAgreementVerificationV1Input = z.infer<typeof providerAgreementVerificationV1InputSchema>;
export type ProviderAgreementVerificationV1 = z.infer<typeof providerAgreementVerificationV1Schema>;
export type GeographicCoverageResolutionV1Input = z.infer<typeof geographicCoverageResolutionV1InputSchema>;
export type GeographicCoverageResolutionV1 = z.infer<typeof geographicCoverageResolutionV1Schema>;
