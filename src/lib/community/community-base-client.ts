import { z } from 'zod';
import type { Language } from '@/types';
import type { CommunityBaseView } from '@/components/customer/CustomerCommunityBase';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const audienceKind = z.enum(['workspace', 'roles', 'members']);

const communitySchema = z.strictObject({
  id: uuid,
  workspace_id: uuid,
  name: z.string().trim().min(2).max(120),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  audience_kind: audienceKind,
  can_create_announcement: z.boolean(),
  can_decide_reports: z.boolean(),
});

const announcementSchema = z.strictObject({
  id: uuid,
  community_id: uuid,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  status: z.enum(['draft', 'published', 'cancelled']),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  can_report: z.boolean(),
  can_publish: z.boolean(),
  can_cancel: z.boolean(),
});

const reportSchema = z.strictObject({
  id: uuid,
  community_id: uuid,
  target_title: z.string().trim().min(1).max(120),
  report_reason: z.string().trim().min(5).max(1000),
  status: z.enum(['open', 'dismissed', 'action_required']),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const communityReadResponseSchema = z.strictObject({
  workspace_id: uuid,
  communities: z.array(communitySchema).max(100),
  announcements: z.array(announcementSchema).max(100),
  reports: z.array(reportSchema).max(100),
  limit: z.literal(100),
});

export type CommunityReadResponse = z.infer<typeof communityReadResponseSchema>;
export type CommunityLoadFailure = 'session' | 'denied' | 'not_ready' | 'retry';

const audienceLabels = {
  ro: { workspace: 'Spațiul de lucru', roles: 'Roluri eligibile', members: 'Membri selectați' },
  en: { workspace: 'Workspace', roles: 'Eligible roles', members: 'Selected members' },
  fa: { workspace: 'فضای کاری', roles: 'نقش‌های مجاز', members: 'اعضای انتخاب‌شده' },
} as const;

export function toCommunityViews(payload: CommunityReadResponse, lang: Language): CommunityBaseView[] {
  return payload.communities.map((community) => ({
    community_id: community.id,
    workspace_id: community.workspace_id,
    name: community.name,
    audience_label: audienceLabels[lang][community.audience_kind],
    version: community.version,
    can_create_announcement: community.can_create_announcement,
    can_decide_reports: community.can_decide_reports,
    announcements: payload.announcements.filter((item) => item.community_id === community.id),
    reports: payload.reports.filter((item) => item.community_id === community.id),
  }));
}

export function classifyCommunityResponse(status: number): CommunityLoadFailure {
  if (status === 401) return 'session';
  if (status === 403 || status === 404) return 'denied';
  if (status === 503) return 'not_ready';
  return 'retry';
}

export function newCommunityCommandIdentity(randomUUID: () => string = () => crypto.randomUUID()) {
  const commandId = randomUUID();
  return { command_id: commandId, idempotency_key: `ce010.ui.${commandId}` };
}
