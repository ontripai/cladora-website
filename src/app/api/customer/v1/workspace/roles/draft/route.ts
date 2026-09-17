import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWorkspaceRoleDraftRequestSchema } from '@/lib/customer/workspace-roles-schema';
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

  const body = await parseJsonWithLimit(request, 16 * 1024);
  if (!body) {
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 16KB limit or invalid JSON' } },
      { status: 413, headers: HEADERS }
    );
  }

  const parsed = createWorkspaceRoleDraftRequestSchema.safeParse(body);
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
    .rpc('create_workspace_role_draft_v1', {
      p_context_id: parsed.data.context_id,
      p_code: parsed.data.code,
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_scope_ceiling: parsed.data.scope_ceiling,
      p_base_role_id: parsed.data.base_role_id ?? null,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotency_key,
    });

  if (rpcError) {
    const msg = rpcError.message || '';

    if (rpcError.code === '40001' || msg.includes('workspace_role_draft_already_exists')) {
      return NextResponse.json(
        { error: { code: 'DRAFT_ALREADY_EXISTS', message: 'An active draft for this role code already exists.' } },
        { status: 409, headers: HEADERS }
      );
    }
    if (msg.includes('mfa_required')) {
      return NextResponse.json(
        {
          error: {
            code: 'MFA_REQUIRED',
            message: 'Multi-Factor Authentication (AAL2) is required to manage workspace roles.',
            redirect_to: '/mfa',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_role_manage_permission_required')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Permission workspace.role.manage required' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_role_idempotency_conflict')) {
      return NextResponse.json(
        { error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reused with different payload' } },
        { status: 400, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
