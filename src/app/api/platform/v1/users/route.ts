import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const READ_ROLES = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_FINANCE', 'PLATFORM_SUPPORT', 'PLATFORM_AUDITOR'] as const;

export async function GET(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS' } }, { status: 401, headers: HEADERS });
  if (!hasPlatformAal2(auth)) return NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers: HEADERS });
  if (!hasPlatformRole(auth, [...READ_ROLES])) return NextResponse.json({ error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES' } }, { status: 403, headers: HEADERS });

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const q = (params.get('q') ?? '').trim().slice(0, 100).replace(/[^a-zA-Z0-9\u0100-\u024f\u0600-\u06ff\s._-]/g, '');
  const status = params.get('status');
  const supabase = await createClient();
  let query = supabase.schema('customer_api').from('platform_users_v1')
    .select('id,employee_ref,display_name,status,created_at,updated_at,deactivated_at', { count: 'exact' });
  if (q) query = query.or(`display_name.ilike.%${q}%,employee_ref.ilike.%${q}%`);
  if (status && ['active', 'suspended', 'archived'].includes(status)) query = query.eq('status', status);
  const { data: users, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: { code: 'DATABASE_QUERY_FAILED' } }, { status: 500, headers: HEADERS });

  const ids = (users ?? []).map((user) => user.id);
  const now = new Date().toISOString();
  const { data: roles } = ids.length ? await supabase.schema('customer_api').from('platform_role_assignments_v1')
    .select('platform_user_id,role,valid_from,valid_until,status').in('platform_user_id', ids)
    .order('created_at', { ascending: false }) : { data: [] };
  return NextResponse.json({
    users: (users ?? []).map((user) => ({
      ...user,
      roles: (roles ?? []).filter((role) => role.platform_user_id === user.id && role.status === 'active' && role.valid_from <= now && (!role.valid_until || role.valid_until > now)).map((role) => role.role),
    })),
    pagination: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
  }, { headers: HEADERS });
}
