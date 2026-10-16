import { z } from 'zod';

import {
  calculateJurisdictionDomainArtifactSha256V1,
  coreJurisdictionDomainArtifactV1Schema,
  type CoreJurisdictionDomainArtifactV1,
} from '../core/jurisdiction-domain-artifact-v1.ts';

export const AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_REQUEST_V1 =
  'airprop-address-structure-presentation-request.v1' as const;
export const AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_DECISION_V1 =
  'airprop-address-structure-presentation-decision.v1' as const;

const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const timestamp = z.string().datetime({ offset: true });

const PRESENTATION_SAFE_ADDRESS_FIELD_CODES = new Set([
  'administrative_area',
  'building',
  'country_code',
  'district',
  'locality',
  'postal_code',
  'street_name',
  'street_number',
  'unit',
]);

const unsafeDisplayValue =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ud800-\udfff]/;

const explicitAddressFieldSchema = z.strictObject({
  field_code: code,
  value: z.string().max(4096),
});

export const airpropAddressStructurePresentationRequestV1Schema = z.strictObject({
  contract_version: z.literal(AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_REQUEST_V1),
  artifact: z.unknown().refine(value => value !== undefined, 'Artifact is required'),
  effective_at: timestamp,
  country_code: countryCode,
  address_fields: z.array(explicitAddressFieldSchema).max(64),
});

const displayPartSchema = z.strictObject({
  field_code: code,
  value: z.string().max(4096),
});

const decisionBase = {
  contract_version: z.literal(AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_DECISION_V1),
  evaluator_version: z.literal(1),
  reusable_as_command_authority: z.literal(false),
} as const;

export const airpropAddressStructurePresentationDecisionV1Schema =
  z.discriminatedUnion('decision', [
    z.strictObject({
      ...decisionBase,
      decision: z.literal('accepted'),
      denial_reason: z.null(),
      display_parts: z.array(displayPartSchema).min(1).max(64),
    }),
    z.strictObject({
      ...decisionBase,
      decision: z.literal('denied'),
      denial_reason: z.enum([
        'MALFORMED_INPUT',
        'MALFORMED_ARTIFACT',
        'DOMAIN_MISMATCH',
        'ARTIFACT_HASH_MISMATCH',
        'ARTIFACT_INACTIVE',
        'ARTIFACT_NOT_EFFECTIVE',
        'REVIEW_UNAVAILABLE',
        'COUNTRY_MISMATCH',
        'UNKNOWN_FIELD',
        'AMBIGUOUS_FIELD',
        'REQUIRED_FIELD_MISSING',
        'FIELD_VALUE_INVALID',
        'POSTAL_CODE_INVALID',
      ]),
      display_parts: z.null(),
    }),
  ]);

export type AirpropAddressStructurePresentationRequestV1 = z.input<
  typeof airpropAddressStructurePresentationRequestV1Schema
>;
export type AirpropAddressStructurePresentationDecisionV1 = z.infer<
  typeof airpropAddressStructurePresentationDecisionV1Schema
>;

type ParsedRequest = z.infer<typeof airpropAddressStructurePresentationRequestV1Schema>;
type DenialReason = Extract<AirpropAddressStructurePresentationDecisionV1,
  { decision: 'denied' }>['denial_reason'];
type AddressArtifact = CoreJurisdictionDomainArtifactV1 & {
  domain: Extract<CoreJurisdictionDomainArtifactV1['domain'],
    { domain_code: 'address.structure' }>;
};
type PostalValidation = AddressArtifact['domain']['policy']['postal_code']['validation'];
type PostalFormat = Extract<PostalValidation,
  { kind: 'country_artifact_grammar' }>['formats'][number];

function deny(reason: DenialReason): AirpropAddressStructurePresentationDecisionV1 {
  return airpropAddressStructurePresentationDecisionV1Schema.parse({
    contract_version: AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_DECISION_V1,
    evaluator_version: 1,
    decision: 'denied',
    denial_reason: reason,
    display_parts: null,
    reusable_as_command_authority: false,
  });
}

function hasApprovedReviewAt(
  review: CoreJurisdictionDomainArtifactV1['legal_review'],
  effectiveAt: number,
): boolean {
  return review.status === 'approved'
    && review.reviewed_at !== null
    && review.evidence_sha256 !== null
    && Date.parse(review.reviewed_at) <= effectiveAt;
}

function postalCharacterMatches(
  kind: 'digits' | 'letters' | 'alphanumeric',
  character: string,
): boolean {
  const point = character.charCodeAt(0);
  const digit = point >= 0x30 && point <= 0x39;
  const letter = point >= 0x41 && point <= 0x5a || point >= 0x61 && point <= 0x7a;
  return kind === 'digits' ? digit : kind === 'letters' ? letter : digit || letter;
}

function postalFormatMatches(
  format: PostalFormat,
  value: string,
): boolean {
  let offset = 0;
  for (const segment of format.segments) {
    if (segment.kind === 'literal') {
      if (!value.startsWith(segment.value, offset)) return false;
      offset += segment.value.length;
      continue;
    }
    const candidate = value.slice(offset, offset + segment.length);
    if (candidate.length !== segment.length
      || candidate.split('').some(character =>
        !postalCharacterMatches(segment.kind, character))) return false;
    offset += segment.length;
  }
  return offset === value.length;
}

function normalizePostal(
  policy: AddressArtifact['domain']['policy']['postal_code'],
  value: string,
): string {
  if (policy.normalization === 'trim') return value.trim();
  if (policy.normalization === 'uppercase_trim') return value.trim().toUpperCase();
  return value;
}

function postalMatches(
  policy: AddressArtifact['domain']['policy']['postal_code'],
  value: string,
): boolean {
  if (policy.validation.kind === 'none') return true;
  return policy.validation.formats.some(format => postalFormatMatches(format, value));
}

/**
 * Pure, inactive presentation of explicit address data using an already supplied
 * Core address.structure artifact. This function performs no lookup, inference,
 * authority resolution, clock read, I/O or mutation. It returns bounded display
 * parts only and cannot be reused as command authority.
 */
export function evaluateAirpropAddressStructurePresentationV1(
  inputValue: unknown,
): AirpropAddressStructurePresentationDecisionV1 {
  const request = airpropAddressStructurePresentationRequestV1Schema.safeParse(inputValue);
  if (!request.success) return deny('MALFORMED_INPUT');

  const artifact = coreJurisdictionDomainArtifactV1Schema.safeParse(request.data.artifact);
  if (!artifact.success) return deny('MALFORMED_ARTIFACT');

  const { artifact_sha256: declaredHash, ...hashInput } = artifact.data;
  let calculatedHash: string;
  try {
    calculatedHash = calculateJurisdictionDomainArtifactSha256V1(hashInput);
  } catch {
    return deny('MALFORMED_ARTIFACT');
  }
  if (declaredHash !== calculatedHash) return deny('ARTIFACT_HASH_MISMATCH');

  if (artifact.data.domain.domain_code !== 'address.structure'
    || artifact.data.domain.domain_version !== 'address-structure.v1') {
    return deny('DOMAIN_MISMATCH');
  }
  const addressArtifact = artifact.data as AddressArtifact;
  const effectiveAt = Date.parse(request.data.effective_at);

  if (addressArtifact.status !== 'active') return deny('ARTIFACT_INACTIVE');
  if (effectiveAt < Date.parse(addressArtifact.effective_from)
    || addressArtifact.effective_to !== null
      && effectiveAt >= Date.parse(addressArtifact.effective_to)) {
    return deny('ARTIFACT_NOT_EFFECTIVE');
  }
  if (!hasApprovedReviewAt(addressArtifact.legal_review, effectiveAt)
    || !hasApprovedReviewAt(addressArtifact.accounting_review, effectiveAt)) {
    return deny('REVIEW_UNAVAILABLE');
  }
  if (addressArtifact.profile.country_code !== request.data.country_code) {
    return deny('COUNTRY_MISMATCH');
  }

  const fields = request.data.address_fields;
  if (fields.some(field => field.field_code === 'country_code')) {
    return deny('AMBIGUOUS_FIELD');
  }
  const suppliedCodes = fields.map(field => field.field_code);
  if (new Set(suppliedCodes).size !== suppliedCodes.length) {
    return deny('AMBIGUOUS_FIELD');
  }

  const policy = addressArtifact.domain.policy;
  if (policy.ordered_fields.some(field =>
    !PRESENTATION_SAFE_ADDRESS_FIELD_CODES.has(field.field_code))) {
    return deny('MALFORMED_ARTIFACT');
  }
  const artifactFields = new Map(policy.ordered_fields.map(field =>
    [field.field_code, field] as const));
  if (fields.some(field => !artifactFields.has(field.field_code))) {
    return deny('UNKNOWN_FIELD');
  }
  const postalField = artifactFields.get('postal_code');
  if (postalField !== undefined && postalField.required !== policy.postal_code.required) {
    return deny('MALFORMED_ARTIFACT');
  }

  const supplied = new Map(fields.map(field => [field.field_code, field.value] as const));
  const displayParts: Array<{ field_code: string; value: string }> = [];
  for (const field of policy.ordered_fields) {
    const rawValue = field.field_code === 'country_code'
      ? request.data.country_code : supplied.get(field.field_code);
    if (rawValue === undefined) {
      if (field.required) return deny('REQUIRED_FIELD_MISSING');
      continue;
    }
    if (rawValue.length > field.max_length || rawValue.trim().length === 0) {
      return deny('FIELD_VALUE_INVALID');
    }
    if (unsafeDisplayValue.test(rawValue)) return deny('FIELD_VALUE_INVALID');
    const value = field.field_code === 'postal_code'
      ? normalizePostal(policy.postal_code, rawValue) : rawValue;
    if (value.length > field.max_length || value.trim().length === 0) {
      return deny('FIELD_VALUE_INVALID');
    }
    if (field.field_code === 'postal_code' && !postalMatches(policy.postal_code, value)) {
      return deny('POSTAL_CODE_INVALID');
    }
    displayParts.push({ field_code: field.field_code, value });
  }

  return airpropAddressStructurePresentationDecisionV1Schema.parse({
    contract_version: AIRPROP_ADDRESS_STRUCTURE_PRESENTATION_DECISION_V1,
    evaluator_version: 1,
    decision: 'accepted',
    denial_reason: null,
    display_parts: displayParts,
    reusable_as_command_authority: false,
  });
}
