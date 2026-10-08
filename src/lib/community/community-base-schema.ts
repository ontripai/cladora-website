import { z } from 'zod';
import { eventAudienceSchema } from './event-interest-schema.ts';

const uuid = z.string().uuid();
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

export const proposedCe010Permissions = [
  'community.community.manage',
  'community.announcement.publish',
  'community.report.create',
  'community.report.decide',
] as const;

export const ce010AuthoritySchema = z.object({
  tenant_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  actor_user_id: uuid,
  membership_id: uuid,
  membership_active: z.boolean(),
  capability_active: z.boolean(),
  audience_result: z.enum(['eligible', 'ineligible']),
  role_codes: z.array(z.string()),
  permissions: z.array(z.enum(proposedCe010Permissions)),
}).strict();

const commandBase = z.object({
  command_id: uuid,
  idempotency_key: idempotencyKey,
  context_id: uuid,
  workspace_id: uuid,
  expected_version: z.number().int().nonnegative(),
  reason: z.string().trim().min(5).max(500),
}).strict();

export const ce010CommandSchema = z.discriminatedUnion('type', [
  commandBase.extend({ type: z.literal('create_community'), community_id: uuid, name: z.string().trim().min(2).max(120), audience: eventAudienceSchema }).strict(),
  commandBase.extend({ type: z.literal('create_announcement'), community_id: uuid, announcement_id: uuid, body: z.string().trim().min(1).max(5000), audience: eventAudienceSchema }).strict(),
  commandBase.extend({ type: z.literal('publish_announcement'), community_id: uuid, announcement_id: uuid }).strict(),
  commandBase.extend({ type: z.literal('cancel_announcement'), community_id: uuid, announcement_id: uuid }).strict(),
  commandBase.extend({ type: z.literal('report_content'), community_id: uuid, report_id: uuid, target_type: z.enum(['announcement']), target_id: uuid, report_reason: z.string().trim().min(5).max(1000) }).strict(),
  commandBase.extend({ type: z.literal('decide_content_report'), community_id: uuid, report_id: uuid, decision: z.enum(['dismissed', 'action_required']), decision_reason: z.string().trim().min(5).max(1000) }).strict(),
]);

export type Ce010Authority = z.infer<typeof ce010AuthoritySchema>;
export type Ce010Command = z.infer<typeof ce010CommandSchema>;
export type CommunityAudience = z.infer<typeof eventAudienceSchema>;
