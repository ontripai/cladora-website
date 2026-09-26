import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishWorkspaceRoleRequestSchema } from '@/lib/customer/workspace-roles-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: 'BAD_ORIGIN', message: 'Untrusted mutation origin' } },
      { status: 403, headers: HEADERS }
    );
  }

  if (!isApplicationJson(request.headers.get('content-type'))) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected application/json' } },
      { status: 415, headers: HEADERS }
    );
  }

  const { data: body, errorResponse } = await parseJsonWithLimit(request, 16 * 1024);
  if (errorResponse) return errorResponse;

  const parsed = publishWorkspaceRoleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload failed schema validation',
          details: parsed.error.format(),
        },
      },
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
    .rpc('publish_workspace_role_v1', {
      p_context_id: parsed.data.context_id,
      p_workspace_role_id: parsed.data.workspace_role_id,
      p_expected_lock_version: parsed.data.expected_lock_version,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotency_key,
    });

  if (rpcError) {
    const msg = rpcError.message || '';

    if (rpcError.code === '40001' || msg.includes('workspace_role_expected_lock_version_conflict')) {
      return NextResponse.json(
        { error: { code: 'LOCK_VERSION_CONFLICT', message: 'Role was modified concurrently. Please reload.' } },
        { status: 409, headers: HEADERS }
      );
    }
    if (msg.includes('mfa_required')) {
      return NextResponse.json(
        {
          error: {
            code: 'MFA_REQUIRED',
            message: 'Multi-Factor Authentication (AAL2) is required to publish roles.',
            redirect_to: '/mfa',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_role_publish_permission_required')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Permission workspace.role.publish required' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_role_publish_requires_at_least_one_module') || msg.includes('workspace_role_publish_requires_at_least_one_permission')) {
      return NextResponse.json(
        { error: { code: 'INCOMPLETE_ROLE', message: 'Role must have at least one module and one permission before publishing.' } },
        { status: 422, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
