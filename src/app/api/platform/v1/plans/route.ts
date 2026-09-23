import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const READ_ROLES = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_FINANCE', 'PLATFORM_AUDITOR'] as const;
const STATUSES = ['draft', 'active', 'deprecated', 'retired'] as const;

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
  const limit = Math.min(Math.max(Number(params.get('limit')) || 12, 1), 50);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);
  const status = params.get('status');
  const q = (params.get('q') ?? '').trim().slice(0, 100).replace(/[^a-zA-Z0-9\u0100-\u024f\u0600-\u06ff\s._-]/g, '');
  const supabase = await createClient();
  let query = supabase.schema('customer_api').from('subscription_plans_v1').select('*', { count: 'exact' });
  if (status && STATUSES.includes(status as typeof STATUSES[number])) query = query.eq('status', status);
  if (q) query = query.or(`display_name.ilike.%${q}%,plan_code.ilike.%${q}%`);
  const { data, count, error } = await query.order('plan_code').order('version', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: { code: 'DATABASE_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  const ids = (data ?? []).map((plan) => plan.id);
  const { data: counts, error: countsError } = ids.length
    ? await supabase.schema('customer_api').rpc('get_plan_dependency_counts_v1', { p_plan_ids: ids })
    : { data: [], error: null };
  if (countsError) return NextResponse.json({ error: { code: 'DEPENDENCY_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  const dependencyCounts = (counts ?? []) as Array<{ plan_id: string; workspace_count: number; contract_count: number }>;
  return NextResponse.json({
    plans: (data ?? []).map((plan) => ({ ...plan, dependencies: dependencyCounts.find((row) => row.plan_id === plan.id) ?? { workspace_count: 0, contract_count: 0 } })),
    canManage: hasPlatformRole(access.auth, 'PLATFORM_SUPER_ADMIN'),
    pagination: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
  }, { headers: HEADERS });
}

export async function POST(request: Request) {
  const access = await authorize(['PLATFORM_SUPER_ADMIN']);
  if ('response' in access) return access.response;
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  try {
    const body = await request.json();
    if (typeof body.plan_code !== 'string' || typeof body.display_name !== 'string' || !Array.isArray(body.feature_catalogue) || !body.limit_schema || typeof body.limit_schema !== 'object' || typeof body.reason !== 'string' || body.reason.trim().length < 8) {
      return NextResponse.json({ error: { code: 'INVALID_PLAN_PARAMETERS' } }, { status: 400, headers: HEADERS });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('create_subscription_plan_version_v1', {
      p_plan_code: body.plan_code, p_display_name: body.display_name,
      p_feature_catalogue: body.feature_catalogue, p_limit_schema: body.limit_schema,
      p_effective_from: body.effective_from || new Date().toISOString(), p_effective_until: body.effective_until || null,
      p_reason: body.reason.trim(),
    });
    if (error) return NextResponse.json({ error: { code: 'PLAN_VERSION_CREATE_FAILED' } }, { status: 400, headers: HEADERS });
    return NextResponse.json({ plan: data }, { status: 201, headers: HEADERS });
  } catch { return NextResponse.json({ error: { code: 'MALFORMED_JSON' } }, { status: 400, headers: HEADERS }); }
}
