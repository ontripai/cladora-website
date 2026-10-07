import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET() {
  const authCtx = await getPlatformAuthContext();
  if (!authCtx.isAuthorized || !authCtx.platformUser) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS', message: 'Authentication required.' } },
      { status: 401, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformAal2(authCtx)) {
    return NextResponse.json(
      { error: { code: 'MFA_REQUIRED', message: 'A verified AAL2 session is required.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }
  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Operations or Super Admin role required.' } },
      { status: 403, headers: NO_CACHE_HEADERS },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('customer_api')
    .from('workspace_primary_admin_roles_v1')
    .select('id,code,name')
    .order('code');

  if (error) {
    return NextResponse.json(
      { error: { code: 'ROLE_CATALOG_UNAVAILABLE', message: 'Invitation roles could not be loaded.' } },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }

  return NextResponse.json({ roles: data ?? [] }, { status: 200, headers: NO_CACHE_HEADERS });
}
