import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'no-store, private' };
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS' } }, { status: 401, headers });
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_OPERATIONS']) ||
    (!hasWorkspaceAssignment(auth, id, 'commercial') && !hasWorkspaceAssignment(auth, id, 'workspace'))) {
    return NextResponse.json({ error: { code: 'FORBIDDEN_ENTITLEMENT_CONFIGURATION' } }, { status: 403, headers });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: { code: 'INVALID_WORKSPACE_ID' } }, { status: 400, headers });
  const client = await createClient();
  const [workspace, entitlement] = await Promise.all([
    client.schema('customer_api').from('customer_workspaces_v1').select('id,environment,lifecycle_status').eq('id', id).maybeSingle(),
    client.schema('customer_api').from('workspace_entitlements_v1')
      .select('value_type,boolean_value,numeric_value,text_value,json_value,override_value_json,override_reason,override_expires_at,valid_from,valid_until,updated_at')
      .eq('customer_workspace_id', id).eq('entitlement_key', 'module.services_orders').maybeSingle(),
  ]);
  if (workspace.error || entitlement.error) return NextResponse.json({ error: { code: 'SERVICE_REQUEST_ACCESS_READ_FAILED' } }, { status: 500, headers });
  if (!workspace.data) return NextResponse.json({ error: { code: 'WORKSPACE_NOT_FOUND' } }, { status: 404, headers });
  return NextResponse.json({ workspace: workspace.data, entitlement: entitlement.data }, { headers });
}
