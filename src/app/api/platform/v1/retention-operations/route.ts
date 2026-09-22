import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { parseRetentionOperationsQuery } from '@/lib/platform/retention-operations';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const READ_ROLES = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as const;

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}
export async function GET(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return failure('UNAUTHORIZED_PLATFORM_ACCESS', 401);
  if (!hasPlatformAal2(auth)) return failure('MFA_REQUIRED', 403);
  if (!hasPlatformRole(auth, [...READ_ROLES])) return failure('INSUFFICIENT_ROLE_PRIVILEGES', 403);

  let query;
  try {
    query = parseRetentionOperationsQuery(request.url);
  } catch {
    return failure('INVALID_RETENTION_OPERATIONS_FILTERS', 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema('platform').rpc('get_retention_operations_v1', {
    p_section: query.section,
    p_tenant_id: query.tenantId,
    p_status: query.status,
    p_limit: query.limit,
    p_offset: query.offset,
  });
  if (error) return failure(error.code === '42501' ? 'RETENTION_SCOPE_DENIED' : 'RETENTION_OPERATIONS_QUERY_FAILED', error.code === '42501' ? 403 : 500);
  return NextResponse.json(data, { headers: HEADERS });
}
