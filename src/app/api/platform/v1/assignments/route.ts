import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
  Vary: 'Cookie',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPES = ['workspace', 'commercial', 'technical', 'support', 'audit'] as const;

export async function GET(request: Request) {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS' } }, { status: 401, headers: NO_CACHE_HEADERS });
  if (!hasPlatformAal2(authCtx)) return NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers: NO_CACHE_HEADERS });
  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_FINANCE', 'PLATFORM_SUPPORT', 'PLATFORM_AUDITOR'])) {
    return NextResponse.json({ error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES' } }, { status: 403, headers: NO_CACHE_HEADERS });
  }
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const status = params.get('status');
  const scope = params.get('scope');
  const q = (params.get('q') ?? '').trim().slice(0, 100).replace(/[^a-zA-Z0-9\u0100-\u024f\u0600-\u06ff\s._-]/g, '');
  const supabase = await createClient();
  let query = supabase.schema('customer_api').from('platform_customer_assignments_v1').select('*', { count: 'exact' });
  if (status && ['active', 'revoked', 'expired'].includes(status)) query = query.eq('status', status);
  if (scope && SCOPES.includes(scope as typeof SCOPES[number])) query = query.eq('scope_type', scope);
  if (q) query = query.or(`assignment_reason.ilike.%${q}%,scope_id.ilike.%${q}%`);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: { code: 'DATABASE_QUERY_FAILED' } }, { status: 500, headers: NO_CACHE_HEADERS });
  const userIds = Array.from(new Set((data ?? []).map((item) => item.platform_user_id)));
  const workspaceIds = Array.from(new Set((data ?? []).map((item) => item.customer_workspace_id)));
  const [{ data: users }, { data: workspaces }] = await Promise.all([
    userIds.length ? supabase.schema('customer_api').from('platform_users_v1').select('id,display_name,employee_ref').in('id', userIds) : Promise.resolve({ data: [] }),
    workspaceIds.length ? supabase.schema('customer_api').from('customer_workspaces_v1').select('id,tenant_id,workspace_type,environment,lifecycle_status').in('id', workspaceIds) : Promise.resolve({ data: [] }),
  ]);
  return NextResponse.json({
    assignments: (data ?? []).map((item) => ({ ...item, user: (users ?? []).find((u) => u.id === item.platform_user_id) ?? null, workspace: (workspaces ?? []).find((w) => w.id === item.customer_workspace_id) ?? null })),
    canManage: hasPlatformRole(authCtx, 'PLATFORM_SUPER_ADMIN'),
    pagination: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
  }, { headers: NO_CACHE_HEADERS });
}

export async function POST(request: Request) {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication required' } },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasPlatformRole(authCtx, 'PLATFORM_SUPER_ADMIN')) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: NO_CACHE_HEADERS });

  try {
    const body = await request.json();
    const { platform_user_id, customer_workspace_id, scope_type = 'workspace', scope_id, assignment_reason, valid_from, valid_until } = body;

    if (!UUID.test(platform_user_id ?? '') || !UUID.test(customer_workspace_id ?? '') || !SCOPES.includes(scope_type) || typeof assignment_reason !== 'string' || assignment_reason.trim().length < 8 || assignment_reason.length > 500) {
      return NextResponse.json(
        { error: { code: 'INVALID_ASSIGNMENT_PARAMETERS', message: 'Valid user, workspace, scope, and an 8-500 character reason are required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('grant_customer_assignment_v1', {
      p_platform_user_id: platform_user_id,
      p_customer_workspace_id: customer_workspace_id,
      p_scope_type: scope_type || 'workspace',
      p_scope_id: scope_id || null,
      p_valid_from: valid_from || new Date().toISOString(),
      p_valid_until: valid_until || null,
      p_reason: assignment_reason.trim(),
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_ASSIGNMENT', message: 'Insufficient privileges or unassigned operator attempting delegation.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'ASSIGNMENT_GRANT_FAILED', message: 'Failed to grant customer assignment.' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ assignment: data }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
