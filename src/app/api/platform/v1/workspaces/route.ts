import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.generated';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

export async function GET(request: Request) {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication as a platform user is required' } },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  const supabase = await createClient();
  let query = supabase
    .schema('customer_api')
    .from('customer_workspaces_v1')
    .select('*', { count: 'exact' });

  if (!hasPlatformRole(authCtx, 'PLATFORM_SUPER_ADMIN')) {
    const isAuditorOnly = hasPlatformRole(authCtx, 'PLATFORM_AUDITOR')
      && authCtx.roles.every((role) => role === 'PLATFORM_AUDITOR');
    const assignedIds = authCtx.assignments
      .filter((assignment) => !isAuditorOnly || ['workspace', 'audit'].includes(assignment.scope_type))
      .map((assignment) => assignment.customer_workspace_id);
    query = query.in('id', assignedIds.length > 0 ? assignedIds : ['00000000-0000-0000-0000-000000000000']);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { error: { code: 'DATABASE_QUERY_FAILED', message: 'Failed to retrieve workspaces' } },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      workspaces: data,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count ?? 0),
      },
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}

export async function POST(request: Request) {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication as a platform user is required' } },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }
  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }
  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Operations or Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { tenant_id, workspace_type, commercial_owner, environment } = body;

    if (!tenant_id || !workspace_type || !commercial_owner) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST_PAYLOAD', message: 'tenant_id, workspace_type, and commercial_owner are required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const validTypes: Database['platform']['Enums']['workspace_type'][] = [
      'ASSOCIATION',
      'PROPERTY_MANAGER',
      'OWNER_PORTFOLIO',
      'HYBRID',
    ];
    if (!validTypes.includes(workspace_type)) {
      return NextResponse.json(
        { error: { code: 'INVALID_WORKSPACE_TYPE', message: `workspace_type must be one of: ${validTypes.join(', ')}` } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('create_customer_workspace_v1', {
      p_tenant_id: tenant_id,
      p_workspace_type: workspace_type,
      p_commercial_owner: commercial_owner,
      p_environment: environment === 'PRODUCTION' ? 'PRODUCTION' : 'PILOT',
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_WORKSPACE_CREATION', message: 'Insufficient privileges to create workspace.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'WORKSPACE_CREATION_FAILED', message: 'Failed to create customer workspace' } },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ workspace: data }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
