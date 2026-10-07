import { NextResponse } from 'next/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const READ_ROLES = ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as const;
const RUN_STATUSES = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;
const DEFAULT_TASKS = ['validate_workspace', 'validate_contract', 'apply_plan', 'materialize_entitlements', 'initialize_workspace', 'verify_provisioning'];

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
  const q = (params.get('q') ?? '').trim().slice(0, 100).replace(/[^a-zA-Z0-9._:-]/g, '');
  const supabase = await createClient();
  let query = supabase.schema('customer_api').from('provisioning_runs_v1').select('*', { count: 'exact' });
  if (status && RUN_STATUSES.includes(status as typeof RUN_STATUSES[number])) query = query.eq('status', status);
  if (q) query = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(q)
    ? query.or(`idempotency_key.ilike.%${q}%,customer_workspace_id.eq.${q}`)
    : query.ilike('idempotency_key', `%${q}%`);
  const { data: runs, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: { code: 'DATABASE_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  const runIds = (runs ?? []).map((run) => run.id);
  const { data: tasks, error: tasksError } = runIds.length
    ? await supabase.schema('customer_api').from('provisioning_tasks_v1').select('*').in('run_id', runIds).order('task_order')
    : { data: [], error: null };
  if (tasksError) return NextResponse.json({ error: { code: 'TASK_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  const canManage = hasPlatformRole(access.auth, ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']);
  const { data: eligible, error: eligibleError } = canManage ? await supabase.schema('customer_api').rpc('list_provisionable_workspaces_v1') : { data: [], error: null };
  if (eligibleError) return NextResponse.json({ error: { code: 'ELIGIBILITY_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  return NextResponse.json({
    runs: (runs ?? []).map((run) => ({ ...run, tasks: (tasks ?? []).filter((task) => task.run_id === run.id) })),
    eligibleWorkspaces: eligible ?? [], canManage,
    pagination: { total: count ?? 0, limit, offset, hasMore: offset + limit < (count ?? 0) },
  }, { headers: HEADERS });
}

export async function POST(request: Request) {
  const access = await authorize(['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS']);
  if ('response' in access) return access.response;
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers: HEADERS });
  try {
    const body = await request.json();
    if (typeof body.workspace_id !== 'string' || typeof body.idempotency_key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(body.idempotency_key)) {
      return NextResponse.json({ error: { code: 'INVALID_PROVISIONING_PARAMETERS' } }, { status: 400, headers: HEADERS });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.schema('customer_api').rpc('create_provisioning_run_v1', {
      p_workspace_id: body.workspace_id, p_idempotency_key: body.idempotency_key, p_task_types: DEFAULT_TASKS,
    });
    if (error) return NextResponse.json({ error: { code: 'PROVISIONING_RUN_CREATE_FAILED' } }, { status: error.message.includes('access_denied') ? 403 : 400, headers: HEADERS });
    return NextResponse.json({ run: data }, { status: 201, headers: HEADERS });
  } catch { return NextResponse.json({ error: { code: 'MALFORMED_JSON' } }, { status: 400, headers: HEADERS }); }
}
