import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

export async function GET(request: Request) {
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

  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_AUDITOR'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Super Admin or Auditor role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('customer_api')
    .rpc('list_control_plane_audit_events_v1', {
      p_limit: limit,
      p_offset: offset,
      p_query: null,
      p_action: null,
      p_actor_role: null,
      p_entity_type: null,
      p_workspace_id: null,
      p_occurred_from: null,
      p_occurred_until: null,
    });

  if (error) {
    return NextResponse.json(
      { error: { code: 'DATABASE_QUERY_FAILED', message: 'Failed to retrieve audit events' } },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { total_count: number }>;
  const total = Number(rows[0]?.total_count ?? 0);

  return NextResponse.json(
    {
      events: rows.map(({ total_count: _totalCount, ...event }) => event),
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total,
      },
    },
    { status: 200, headers: NO_CACHE_HEADERS }
  );
}
