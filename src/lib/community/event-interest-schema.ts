import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/, 'Invalid local date-time');

export const timezoneSchema = z.string().trim().min(1).max(64).refine((timezone) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA timezone');

export const ce011Permissions = [
  'events.event.read',
  'events.event.publish',
  'events.event.cancel',
  'events.interest.manage_self',
  'events.attendance.record',
  'events.attendance.correct',
] as const;

export const CE011_CAPABILITY_CODE = 'ce.event.basic' as const;
export const CE011_MODULE_CODE = 'community_events' as const;

export const eventAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('workspace') }).strict(),
  z.object({ kind: z.literal('roles'), role_codes: z.array(z.string().min(2).max(64)).min(1).max(32) }).strict(),
  z.object({ kind: z.literal('members'), membership_ids: z.array(uuid).min(1).max(500) }).strict(),
]);

export const authoritySnapshotSchema = z.object({
  tenant_id: uuid,
  context_id: uuid,
  actor_user_id: uuid,
  membership_id: uuid,
  represented_party_id: uuid.nullable(),
  workspace_id: uuid,
  membership_active: z.boolean(),
  capability_active: z.boolean(),
  capability_code: z.literal(CE011_CAPABILITY_CODE),
  module_code: z.literal(CE011_MODULE_CODE),
  audience_policy_id: uuid,
  audience_policy_version: z.number().int().positive(),
  audience_result: z.enum(['eligible', 'ineligible']),
  assurance_level: z.string().trim().min(1).max(32),
  evaluated_at: z.string().datetime({ offset: true }),
  role_codes: z.array(z.string()),
  permissions: z.array(z.enum(ce011Permissions)),
}).strict();

const commandBase = z.object({
  command_id: uuid,
  idempotency_key: idempotencyKey,
  context_id: uuid,
  workspace_id: uuid,
  expected_version: z.number().int().nonnegative(),
  reason: z.string().trim().min(5).max(500),
}).strict();

export const eventCommandSchema = z.discriminatedUnion('type', [
  commandBase.extend({
    type: z.literal('create_event'),
    event_id: uuid,
    occurrence_id: uuid,
    title: z.string().trim().min(2).max(160),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    timezone: timezoneSchema,
    community_ref: uuid.nullable().optional(),
    audience: eventAudienceSchema,
  }).strict(),
  commandBase.extend({ type: z.literal('publish_event'), event_id: uuid }).strict(),
  commandBase.extend({ type: z.literal('cancel_event'), event_id: uuid }).strict(),
  commandBase.extend({ type: z.literal('register_interest'), event_id: uuid, expected_interest_version: z.number().int().nonnegative() }).strict(),
  commandBase.extend({ type: z.literal('withdraw_interest'), event_id: uuid, expected_interest_version: z.number().int().positive() }).strict(),
  commandBase.extend({
    type: z.literal('record_attendance'),
    event_id: uuid,
    target_membership_id: uuid,
    observed_local: localDateTime,
    timezone: timezoneSchema,
  }).strict(),
  commandBase.extend({
    type: z.literal('correct_attendance'),
    event_id: uuid,
    attendance_id: uuid,
    expected_attendance_version: z.number().int().positive(),
    attended: z.boolean(),
    observed_local: localDateTime,
    timezone: timezoneSchema,
  }).strict(),
]);

export type EventAudience = z.infer<typeof eventAudienceSchema>;
export type AuthoritySnapshot = z.infer<typeof authoritySnapshotSchema>;
export type EventCommand = z.infer<typeof eventCommandSchema>;
