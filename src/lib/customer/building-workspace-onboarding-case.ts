import { z } from 'zod';
import { buildingSetupIdSchema } from './building-setup-schema';
export const caseWorkspaceCommandSchema = z.object({
  case_id: buildingSetupIdSchema, workspace_type: z.enum(['ASSOCIATION','PROPERTY_MANAGER','OWNER_PORTFOLIO','HYBRID']),
  profile_code: z.string().regex(/^[a-z0-9_]{3,64}$/), model_code: z.string().regex(/^[a-z0-9_]{3,64}$/),
  commercial_owner: z.string().trim().min(3).max(200), reason: z.string().trim().min(8).max(500),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
}).strict();
export const caseWorkspaceReceiptSchema = z.object({ workspace_id: buildingSetupIdSchema, tenant_id: buildingSetupIdSchema, status: z.literal('LEAD') });
