import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const READ_ROLES = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ['requested', 'approved', 'cancelled', 'revoked', 'expired'] as const;

async function authorize(roles: readonly (typeof READ_ROLES[number])[]) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return { response: NextResponse.json({ error: { code: 'UNAUTHORIZED_PLATFORM_ACCESS' } }, { status: 401, headers: HEADERS }) };
  if (!hasPlatformAal2(auth)) return { response: NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers: HEADERS }) };
  if (!hasPlatformRole(auth, [...roles])) return { response: NextResponse.json({ error: { code: 'INSUFFICIENT_ROLE_PRIVILEGES' } }, { status: 403, headers: HEADERS }) };
  return { auth };
}

export async function GET(request: Request) {
  const access = await authorize(READ_ROLES);
  if ('response' in access) return access.response;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const status = params.get('status') || null;
  const workspaceId = params.get('workspace_id') || null;
  if ((status && !STATUSES.includes(status as typeof STATUSES[number])) || (workspaceId && !UUID.test(workspaceId))) {
    return NextResponse.json({ error: { code: 'INVALID_SUPPORT_FILTERS' } }, { status: 400, headers: HEADERS });
  }
  const supabase = await createClient();
  const [{ data, error }, workspaceResult] = await Promise.all([
    supabase.schema('customer_api').rpc('list_support_access_v1', { p_limit: limit, p_offset: offset, p_query: q || null, p_status: status, p_workspace_id: workspaceId }),
    hasPlatformRole(access.auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS'])
      ? supabase.schema('customer_api').rpc('list_support_workspaces_v1') : Promise.resolve({ data: [], error: null }),
  ]);
  if (error || workspaceResult.error) return NextResponse.json({ error: { code: 'SUPPORT_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  const rows = (data ?? []) as Array<Record<string, unknown> & { total_count: number }>;
  const total = Number(rows[0]?.total_count ?? 0);
  return NextResponse.json({
    items: rows.map(({ total_count: _totalCount, ...row }) => row),
    workspaces: workspaceResult.data ?? [],
    canManage: hasPlatformRole(access.auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']),
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  }, { headers: HEADERS });
}

export async function POST(request: Request) {
  const access = await authorize(['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']);
  if ('response' in access) return access.response;
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  try {
    const body = await request.json();
    if (!UUID.test(body.workspace_id ?? '') || typeof body.ticket_ref !== 'string' || body.ticket_ref.trim().length < 3 || body.ticket_ref.length > 100 ||
      typeof body.purpose !== 'string' || body.purpose.trim().length < 8 || body.purpose.length > 500 ||
      !['diagnostic', 'technical', 'data_review'].includes(body.requested_scope) || !['standard', 'sensitive', 'critical'].includes(body.sensitivity_level) ||
      !Number.isInteger(body.duration_minutes) || body.duration_minutes < 15 || body.duration_minutes > 240 ||
      typeof body.evidence !== 'string' || body.evidence.trim().length < 3 || body.evidence.length > 1000) {
      return NextResponse.json({ error: { code: 'INVALID_SUPPORT_REQUEST' } }, { status: 400, headers: HEADERS });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('request_support_access_v1', {
      p_workspace_id: body.workspace_id, p_ticket_ref: body.ticket_ref.trim(), p_purpose: body.purpose.trim(),
      p_requested_scope: body.requested_scope, p_sensitivity_level: body.sensitivity_level,
      p_duration_minutes: body.duration_minutes, p_evidence: { reference: body.evidence.trim() },
    });
    if (error) return NextResponse.json({ error: { code: 'SUPPORT_REQUEST_CREATE_FAILED' } }, { status: error.message.includes('access_denied') ? 403 : 400, headers: HEADERS });
    return NextResponse.json({ request: data }, { status: 201, headers: HEADERS });
  } catch { return NextResponse.json({ error: { code: 'MALFORMED_JSON' } }, { status: 400, headers: HEADERS }); }
}
