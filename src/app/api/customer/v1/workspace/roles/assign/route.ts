import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assignWorkspaceRoleRequestSchema } from '@/lib/customer/workspace-roles-schema';
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

  const parsed = assignWorkspaceRoleRequestSchema.safeParse(body);
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
    .rpc('assign_workspace_role_v1', {
      p_context_id: parsed.data.context_id,
      p_target_membership_id: parsed.data.target_membership_id,
      p_workspace_role_id: parsed.data.workspace_role_id,
      p_scope_type: parsed.data.scope_type,
      p_property_id: parsed.data.property_id ?? null,
      p_building_id: parsed.data.building_id ?? null,
      p_unit_id: parsed.data.unit_id ?? null,
      p_valid_until: parsed.data.valid_until ?? null,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotency_key,
    });

  if (rpcError) {
    const msg = rpcError.message || '';

    if (msg.includes('mfa_required')) {
      return NextResponse.json(
        {
          error: {
            code: 'MFA_REQUIRED',
            message: 'Multi-Factor Authentication (AAL2) is required to assign roles.',
            redirect_to: '/mfa',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_role_assign_permission_required')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Permission workspace.role.assign required' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_member_role_exceeds_scope_ceiling')) {
      return NextResponse.json(
        { error: { code: 'EXCEEDS_SCOPE_CEILING', message: 'Assignment scope exceeds the role scope ceiling.' } },
        { status: 422, headers: HEADERS }
      );
    }
    if (msg.includes('property_not_bound_to_workspace')) {
      return NextResponse.json(
        { error: { code: 'PROPERTY_NOT_BOUND', message: 'Target property is not bound to this workspace.' } },
        { status: 422, headers: HEADERS }
      );
    }
    if (msg.includes('ancestry_mismatch')) {
      return NextResponse.json(
        { error: { code: 'ANCESTRY_MISMATCH', message: 'Scope hierarchy mismatch (building/unit relation).' } },
        { status: 422, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_member_role_overlapping_assignment') || rpcError.code === '23505') {
      return NextResponse.json(
        { error: { code: 'OVERLAPPING_ASSIGNMENT', message: 'An active assignment for this target scope already exists.' } },
        { status: 409, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
