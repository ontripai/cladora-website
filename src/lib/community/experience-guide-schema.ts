import { z } from 'zod';
import { eventAudienceSchema } from './event-interest-schema.ts';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
export const proposedCe012Permissions = ['experience.guide.manage', 'experience.guide.read'] as const;

export const ce012AuthoritySchema = z.object({ tenant_id: uuid, context_id: uuid, workspace_id: uuid, actor_user_id: uuid, membership_id: uuid, membership_active: z.boolean(), capability_active: z.boolean(), audience_result: z.enum(['eligible', 'ineligible']), role_codes: z.array(z.string()), permissions: z.array(z.enum(proposedCe012Permissions)) }).strict();
export const guideReferenceSchema = z.object({ target_type: z.enum(['document', 'service', 'event', 'community', 'external_url']), target_id: uuid.optional(), url: z.string().url().max(2048).optional(), label: z.string().trim().min(1).max(120) }).strict().superRefine((value, context) => {
  if (value.target_type === 'external_url' ? !value.url || value.target_id : !value.target_id || value.url) context.addIssue({ code: 'custom', message: 'Reference target does not match its type' });
});
export const guideStepSchema = z.object({ id: uuid, title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000), references: z.array(guideReferenceSchema).max(20) }).strict();
const base = z.object({ command_id: uuid, idempotency_key: idempotencyKey, context_id: uuid, workspace_id: uuid, expected_version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), reason: z.string().trim().min(5).max(500) }).strict();
export const ce012CommandSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('create_guide'), guide_id: uuid, title: z.string().trim().min(2).max(160), audience: eventAudienceSchema, steps: z.array(guideStepSchema).min(1).max(100) }).strict(),
  base.extend({ type: z.literal('revise_guide'), guide_id: uuid, title: z.string().trim().min(2).max(160), audience: eventAudienceSchema, steps: z.array(guideStepSchema).min(1).max(100) }).strict(),
  base.extend({ type: z.literal('publish_guide'), guide_id: uuid }).strict(),
  base.extend({ type: z.literal('cancel_guide'), guide_id: uuid }).strict(),
]);
export type Ce012Authority = z.infer<typeof ce012AuthoritySchema>;
export type Ce012Command = z.infer<typeof ce012CommandSchema>;
export type GuideStep = z.infer<typeof guideStepSchema>;
