import { z } from 'zod';

const authorityRevisionSchema = z.number().int().positive().safe();

/**
 * Closed server-owned profile for the future current content-policy read host.
 * This value describes registry binding only. It is neither an authority
 * decision nor a reusable receipt.
 */
export const coreReadAuthorityProfileV1Schema = z.strictObject({
  contract_version: z.literal('core-read-authority-profile.v1'),
  profile_version: z.literal(1),
  permission_code: z.literal('experience.guide.read'),
  module_code: z.literal('experience_guides'),
  entitlement_code: z.literal('module.experience_guides'),
  evaluation_purpose: z.literal('experience.guide.content_policy.read'),
  domain_code: z.literal('content.policy'),
  domain_version: z.literal('content-policy.v1'),
  entitlement_required: z.literal(true),
  server_owned: z.literal(true),
  immutable: z.literal(true),
  reusable_as_command_authority: z.literal(false),
});

/**
 * The only caller-observed profile input. A future sealed read host compares
 * this value with current canonical authority and treats inequality as stale.
 * Parsing it grants no permission or entitlement.
 */
export const coreReadAuthorityRevisionPreconditionV1Schema = z.strictObject({
  contract_version: z.literal('core-read-authority-revision-precondition.v1'),
  expected_authority_revision: authorityRevisionSchema,
});

export type CoreReadAuthorityProfileV1 = z.infer<typeof coreReadAuthorityProfileV1Schema>;
export type CoreReadAuthorityRevisionPreconditionV1 = z.infer<
  typeof coreReadAuthorityRevisionPreconditionV1Schema
>;

export const CORE_READ_AUTHORITY_PROFILE_V1: Readonly<CoreReadAuthorityProfileV1> = Object.freeze(
  coreReadAuthorityProfileV1Schema.parse({
    contract_version: 'core-read-authority-profile.v1',
    profile_version: 1,
    permission_code: 'experience.guide.read',
    module_code: 'experience_guides',
    entitlement_code: 'module.experience_guides',
    evaluation_purpose: 'experience.guide.content_policy.read',
    domain_code: 'content.policy',
    domain_version: 'content-policy.v1',
    entitlement_required: true,
    server_owned: true,
    immutable: true,
    reusable_as_command_authority: false,
  }),
);
