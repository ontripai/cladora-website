import { z } from 'zod';

export const CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMIT_CANDIDATE_V1 =
  'core-jurisdiction-domain-artifact-commit-candidate.v1' as const;

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const timestamp = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);

export const coreJurisdictionDomainArtifactFingerprintV1Schema = z.strictObject({
  profile_id: uuid,
  profile_code: code,
  profile_version: z.number().int().positive().safe(),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  profile_manifest_sha256: sha256,
  domain_code: code,
  domain_version: code,
  artifact_sha256: sha256,
  effective_from: timestamp,
  effective_to: timestamp.nullable(),
  lifecycle_status: z.literal('active'),
  canonical_bytes_sha256: sha256,
  canonical_byte_length: z.number().int().positive().max(1_048_576).safe(),
}).refine(value => value.artifact_sha256 === value.canonical_bytes_sha256,
  'Artifact and canonical-byte hashes must match');

/**
 * A bounded value created only from an accepted current resolver decision.
 * The transaction host supplies all receipt, tenant, Workspace, actor, command
 * and attempt identity when it persists the corresponding projection.
 */
export const coreJurisdictionDomainArtifactCommitCandidateV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_COMMIT_CANDIDATE_V1),
  source_resolver_contract_version: z.literal(
    'core-jurisdiction-domain-artifact-resolver-decision.v1',
  ),
  resolver_version: z.literal(1),
  resolver_decision_id: uuid,
  mode: z.literal('current'),
  evaluated_at: timestamp,
  property_id: uuid,
  fingerprint: coreJurisdictionDomainArtifactFingerprintV1Schema,
  reusable_as_command_authority: z.literal(false),
});

export type CoreJurisdictionDomainArtifactCommitCandidateV1 = z.infer<
  typeof coreJurisdictionDomainArtifactCommitCandidateV1Schema
>;
