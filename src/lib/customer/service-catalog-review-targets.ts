import type { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';
import { serviceCatalogManagementSchema } from './service-catalog-management-schema';

type Client = Awaited<ReturnType<typeof createClient>>;
export type ServiceReviewTarget = { contextId: string; workspaceId: string; label: string };
const contextsSchema = z.array(z.object({ context_id: uuidSchema, scope_type: z.string(), tenant_name: z.string() }));
const targetsSchema = z.array(z.object({ workspace_id: uuidSchema }));

// Discovery is read-only and uses the signed-in client's canonical RPC guards.
// A base role name alone never authorizes access to the SERVICE review surface.
export async function listServiceReviewTargets(db: Client): Promise<ServiceReviewTarget[]> {
  const contexts = await db.schema('customer_api').rpc('list_contexts_v1');
  if (contexts.error) throw new Error('SERVICE_REVIEW_QUERY_FAILED');
  const result: ServiceReviewTarget[] = [];
  for (const context of contextsSchema.parse(contexts.data ?? []).filter(item => item.scope_type === 'tenant')) {
    const targets = await db.schema('customer_api').rpc('list_workspace_targets_v2' as never,
      { p_context_id: context.context_id } as never);
    if (targets.error?.code === '42501') continue;
    if (targets.error) throw new Error('SERVICE_REVIEW_QUERY_FAILED');
    for (const target of targetsSchema.parse(targets.data ?? [])) {
      const access = await db.schema('customer_api').rpc('read_service_catalog_management_v1' as never,
        { p_context_id: context.context_id, p_workspace_id: target.workspace_id, p_after: null } as never);
      if (access.error?.code === '42501') continue;
      if (access.error) throw new Error('SERVICE_REVIEW_QUERY_FAILED');
      if (!serviceCatalogManagementSchema.parse(access.data).can_publish) continue;
      if (!result.some(item => item.workspaceId === target.workspace_id)) {
        result.push({ contextId: context.context_id, workspaceId: target.workspace_id, label: context.tenant_name });
      }
    }
  }
  return result;
}
