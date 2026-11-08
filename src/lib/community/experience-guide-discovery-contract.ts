import {z} from 'zod';
export const guideSelectionV1Schema=z.object({context_id:z.string().uuid(),membership_id:z.string().uuid(),workspace_id:z.string().uuid(),tenant_name:z.string().min(1).max(256),role_name:z.string().min(1).max(256)});
export const guideDiscoveryV1Schema=z.strictObject({contract:z.literal('ce-guide-discovery.v1'),selections:z.array(guideSelectionV1Schema).max(50),limit:z.literal(50),truncated:z.literal(false),authority:z.literal('not_evaluated')});
export type GuideSelectionV1=z.infer<typeof guideSelectionV1Schema>;
