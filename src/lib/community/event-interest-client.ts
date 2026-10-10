import { z } from 'zod';
import type { Language } from '@/types';

const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const eventStatus = z.enum(['draft', 'published', 'cancelled']);
const interestStatus = z.enum(['interested', 'withdrawn']).nullable();

export const eventReadItemSchema = z.strictObject({
  event_id: uuidSchema,
  occurrence_id: uuidSchema,
  workspace_id: uuidSchema,
  title: z.string().trim().min(2).max(160),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(64),
  status: eventStatus,
  version: z.number().int().positive(),
  audience_kind: z.enum(['workspace', 'roles', 'members']),
  interest_status: interestStatus,
  interest_version: z.number().int().nonnegative(),
  can_publish: z.boolean(),
  can_cancel: z.boolean(),
  can_register_interest: z.boolean(),
  can_withdraw_interest: z.boolean(),
  can_record_attendance: z.boolean(),
  eligible_attendance_members: z.array(z.strictObject({
    membership_id: uuidSchema,
    display_name: z.string().trim().min(1).max(120),
  })).max(500),
});

export const eventReadResponseSchema = z.strictObject({
  workspace_id: uuidSchema,
  events: z.array(eventReadItemSchema).max(100),
});

export type EventReadItem = z.infer<typeof eventReadItemSchema>;
export type EventReadResponse = z.infer<typeof eventReadResponseSchema>;
export type EventLoadFailure = 'session' | 'denied' | 'not_ready' | 'retry';

const audienceLabels = {
  ro: { workspace: 'Spațiul de lucru', roles: 'Roluri eligibile', members: 'Membri selectați' },
  en: { workspace: 'Workspace', roles: 'Eligible roles', members: 'Selected members' },
  fa: { workspace: 'فضای کاری', roles: 'نقش‌های مجاز', members: 'اعضای انتخاب‌شده' },
} as const;

export function toEventInterestView(item: EventReadItem, lang: Language) {
  return {
    event_id: item.event_id,
    workspace_id: item.workspace_id,
    title: item.title,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    timezone: item.timezone,
    status: item.status,
    audience_label: audienceLabels[lang][item.audience_kind],
    version: item.version,
    interest_status: item.interest_status,
    interest_version: item.interest_version,
    can_publish: item.can_publish,
    can_cancel: item.can_cancel,
    can_register_interest: item.can_register_interest,
    can_withdraw_interest: item.can_withdraw_interest,
    can_record_attendance: item.can_record_attendance,
  };
}

export function classifyEventResponse(status: number): EventLoadFailure {
  if (status === 401) return 'session';
  if (status === 403 || status === 404) return 'denied';
  if (status === 503) return 'not_ready';
  return 'retry';
}

export function newEventCommandIdentity(randomUUID: () => string = () => crypto.randomUUID()) {
  const commandId = randomUUID();
  return {
    command_id: commandId,
    idempotency_key: `ce011.ui.${commandId}`,
  };
}
