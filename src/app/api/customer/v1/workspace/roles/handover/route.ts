import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handoverWorkspaceRoleRequestSchema } from '@/lib/customer/workspace-roles-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: 'BAD_ORIGIN' } }, { status: 403, headers });
  }
  if (!isApplicationJson(request.headers.get('content-type'))) {
    return NextResponse.json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }, { status: 415, headers });
  }
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = handoverWorkspaceRoleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', details: parsed.error.format() } }, { status: 400, headers });
  }
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers });
  }
  const { data, error } = await (supabase.schema('customer_api') as any).rpc('handover_workspace_role_v2', {
    p_context_id: parsed.data.context_id,
    p_authority_context_id: parsed.data.authority_context_id ?? null,
    p_assignment_id: parsed.data.assignment_id,
    p_expected_lock_version: parsed.data.expected_lock_version,
    p_successor_membership_id: parsed.data.successor_membership_id,
    p_valid_until: parsed.data.valid_until ?? null,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) {
    const message = error.message || '';
    if (message.includes('mfa_required')) {
      return NextResponse.json({ error: { code: 'MFA_REQUIRED', redirect_to: '/mfa' } }, { status: 403, headers });
    }
    if (error.code === '40001' || message.includes('idempotency_conflict') ||
        message.includes('already_revoked') || message.includes('overlapping_assignment')) {
      return NextResponse.json({ error: { code: 'CONFLICT' } }, { status: 409, headers });
    }
    if (error.code === '42501') {
      return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
    }
    if (error.code === '22023') {
      return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500, headers });
  }
  if (!data) return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500, headers });
  return NextResponse.json(data, { status: 200, headers });
}
