import { z } from 'zod';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,79}$/);
const version = z.number().int().positive().safe();

export const coreJurisdictionProfileStatusV1Schema = z.enum([
  'draft',
  'validated',
  'active',
  'suspended',
  'retired',
]);

export const coreJurisdictionDomainArtifactV1Schema = z.strictObject({
  domain_code: code,
  contract_version: code,
  artifact_sha256: sha256,
  required: z.boolean(),
  status: z.enum(['validated', 'active', 'retired']),
});

/**
 * Immutable identity of one effective jurisdiction profile revision.
 * Locale is deliberately absent: language never selects governing law.
 */
export const coreJurisdictionProfileV1Schema = z.strictObject({
  contract_version: z.literal('core-jurisdiction-profile.v1'),
  profile_id: uuid,
  profile_code: code,
  profile_version: version,
  country_code: countryCode,
  default_currency_code: currencyCode,
  default_timezone: z.string().min(1).max(80),
  calendar_code: code,
  manifest_sha256: sha256,
  status: coreJurisdictionProfileStatusV1Schema,
  valid_from: z.string().date(),
  valid_to: z.string().date().nullable(),
  legal_signoff_present: z.boolean(),
  accounting_signoff_present: z.boolean(),
  domains: z.array(coreJurisdictionDomainArtifactV1Schema).max(64),
});

export const corePropertyJurisdictionEvidenceV1Schema = z.strictObject({
  contract_version: z.literal('core-property-jurisdiction-evidence.v1'),
  assignment_id: uuid,
  assignment_version: version,
  tenant_id: uuid,
  workspace_id: uuid,
  property_id: uuid,
  profile: coreJurisdictionProfileV1Schema,
  evaluated_at: z.string().datetime({ offset: true }),
  source_disclosure: z.literal('status_only'),
  reusable_as_command_authority: z.literal(false),
});

export type CoreJurisdictionProfileV1 = z.infer<typeof coreJurisdictionProfileV1Schema>;
export type CorePropertyJurisdictionEvidenceV1 = z.infer<
  typeof corePropertyJurisdictionEvidenceV1Schema
>;

/** Fail closed unless the exact property/workspace/country profile is active. */
export function bindCorePropertyJurisdictionEvidenceV1(input: {
  expected_workspace_id: string;
  expected_property_id: string;
  expected_country_code?: string;
  evidence: unknown;
}): CorePropertyJurisdictionEvidenceV1 {
  const evidence = corePropertyJurisdictionEvidenceV1Schema.parse(input.evidence);
  const workspaceId = uuid.parse(input.expected_workspace_id);
  const propertyId = uuid.parse(input.expected_property_id);

  if (evidence.workspace_id !== workspaceId || evidence.property_id !== propertyId) {
    throw new Error('jurisdiction_profile_binding_mismatch');
  }
  if (
    input.expected_country_code !== undefined
    && evidence.profile.country_code !== countryCode.parse(input.expected_country_code)
  ) {
    throw new Error('jurisdiction_profile_country_mismatch');
  }
  if (evidence.profile.status !== 'active') {
    throw new Error('jurisdiction_profile_inactive');
  }
  if (!evidence.profile.legal_signoff_present || !evidence.profile.accounting_signoff_present) {
    throw new Error('jurisdiction_profile_signoff_missing');
  }
  if (
    evidence.profile.domains.some(domain => domain.required && domain.status !== 'active')
  ) {
    throw new Error('jurisdiction_profile_domain_unavailable');
  }
  return evidence;
}
