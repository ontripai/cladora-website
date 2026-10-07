import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string; key: string }> }
) {
  const { id: workspaceId, key: entitlementKey } = await props.params;
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

  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Finance, Operations, or Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasWorkspaceAssignment(authCtx, workspaceId, 'commercial') && !hasWorkspaceAssignment(authCtx, workspaceId, 'workspace')) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_ASSIGNMENT_REQUIRED', message: 'Explicit customer workspace assignment required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { value_type, numeric_value, boolean_value, text_value, json_value, override_value_json, override_reason, override_expires_at } = body;

    const validTypes = ['numeric', 'boolean', 'string', 'array', 'json'];
    if (!validTypes.includes(value_type)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ENTITLEMENT_TYPE', message: `value_type must be one of: ${validTypes.join(', ')}` } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('set_workspace_entitlement_v1', {
      p_workspace_id: workspaceId,
      p_entitlement_key: entitlementKey,
      p_value_type: value_type,
      p_numeric_value: numeric_value ?? null,
      p_boolean_value: boolean_value ?? null,
      p_text_value: text_value ?? null,
      p_json_value: json_value ?? null,
      p_override_value_json: override_value_json ?? null,
      p_override_reason: override_reason ?? null,
      p_override_expires_at: override_expires_at ?? null,
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_ENTITLEMENT_CONFIGURATION', message: 'Insufficient privileges to configure entitlement.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'ENTITLEMENT_UPDATE_FAILED', message: 'Failed to configure entitlement' } },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ entitlement: data }, { status: 200, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
