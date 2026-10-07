import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
  Vary: 'Cookie',
};

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await props.params;
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
    const { revoke_reason } = body;

    if (typeof revoke_reason !== 'string' || revoke_reason.trim().length < 8 || revoke_reason.length > 500) {
      return NextResponse.json(
        { error: { code: 'INVALID_REVOKE_PARAMETERS', message: 'Non-empty revoke_reason is required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('revoke_customer_assignment_v1', {
      p_assignment_id: assignmentId,
      p_reason: revoke_reason.trim(),
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_REVOCATION', message: 'Insufficient privileges to revoke this assignment.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'REVOCATION_FAILED', message: 'Failed to revoke customer assignment.' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ assignment: data }, { status: 200, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
