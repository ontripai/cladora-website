import { z } from 'zod';
import type { Language } from '@/types';
import { eventAudienceSchema } from './event-interest-schema.ts';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const referenceSchema = z.strictObject({ id: uuid, target_type: z.literal('document'), label: z.string().trim().min(1).max(120) });
const stepSchema = z.strictObject({ id: uuid, title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000), references: z.array(referenceSchema).max(20) });
export const guideReadItemSchema = z.strictObject({
  guide_id: uuid, workspace_id: uuid, title: z.string().trim().min(2).max(160), audience: eventAudienceSchema,
  status: z.enum(['draft', 'published', 'cancelled']), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  can_edit: z.boolean(), steps: z.array(stepSchema).min(1).max(100),
});
export const guideReadResponseSchema = z.strictObject({ guides: z.array(guideReadItemSchema).max(50), limit: z.literal(50) });
export type GuideReadItem = z.infer<typeof guideReadItemSchema>;
export type GuideLoadFailure = 'session' | 'denied' | 'not_ready' | 'retry';

const audienceLabels = {
  ro: { workspace: 'Spațiul de lucru', roles: 'Roluri eligibile', members: 'Membri selectați' },
  en: { workspace: 'Workspace', roles: 'Eligible roles', members: 'Selected members' },
  fa: { workspace: 'فضای کاری', roles: 'نقش‌های مجاز', members: 'اعضای انتخاب‌شده' },
} as const;

export function toExperienceGuideView(item: GuideReadItem, lang: Language) {
  return {
    guide_id: item.guide_id, workspace_id: item.workspace_id, title: item.title,
    audience_label: audienceLabels[lang][item.audience.kind], status: item.status, version: item.version,
    steps: item.steps.map((step) => ({ id: step.id, title: step.title, body: step.body,
      references: step.references.map((reference) => ({ id: reference.id, label: reference.label })) })),
    // Editing stays closed until the Documents-owned named target selector is accepted.
    can_edit: false,
  };
}

export function classifyGuideResponse(status: number): GuideLoadFailure {
  if (status === 401) return 'session';
  if (status === 403 || status === 404) return 'denied';
  if (status === 503) return 'not_ready';
  return 'retry';
}
