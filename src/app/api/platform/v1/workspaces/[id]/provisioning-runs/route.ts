import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole, hasWorkspaceAssignment } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, private',
};

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await props.params;
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

  if (!hasPlatformRole(authCtx, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])) {
    return NextResponse.json(
      { error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES', message: 'Operations or Super Admin role required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  if (!hasWorkspaceAssignment(authCtx, workspaceId, 'workspace')) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_ASSIGNMENT_REQUIRED', message: 'Explicit customer workspace assignment required' } },
      { status: 403, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { idempotency_key, task_types } = body;

    if (!idempotency_key || typeof idempotency_key !== 'string' || !Array.isArray(task_types) || task_types.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_PROVISIONING_PARAMETERS', message: 'String idempotency_key and non-empty array of task_types are required' } },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('create_provisioning_run_v1', {
      p_workspace_id: workspaceId,
      p_idempotency_key: idempotency_key.trim(),
      p_task_types: task_types,
    });

    if (error) {
      if (error.message.includes('access_denied')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN_PROVISIONING', message: 'Insufficient privileges to initiate provisioning run.' } },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
      return NextResponse.json(
        { error: { code: 'PROVISIONING_RUN_FAILED', message: 'Failed to create provisioning run.' } },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ run: data }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Invalid JSON request body' } },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
