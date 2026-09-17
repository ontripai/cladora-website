import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-roles-schema';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contextIdParam = searchParams.get('context_id');

  const parsedContextId = uuidSchema.safeParse(contextIdParam);
  if (!parsedContextId.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_QUERY', message: 'Valid UUID context_id is required' } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, headers: HEADERS }
    );
  }

  const { data, error: rpcError } = await (supabase.schema('customer_api') as any)
    .rpc('get_workspace_roles_v1', {
      p_context_id: parsedContextId.data,
    });

  if (rpcError) {
    const msg = rpcError.message || '';
    if (msg.includes('workspace_role_read_permission_required')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Permission workspace.role.read required' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('customer_context_access_denied')) {
      return NextResponse.json(
        { error: { code: 'CONTEXT_ACCESS_DENIED', message: 'Context access denied or expired' } },
        { status: 403, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
