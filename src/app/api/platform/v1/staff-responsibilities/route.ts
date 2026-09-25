import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
const uuid = z.uuid();
const reason = z.string().trim().min(8).max(500);
const duty = z.enum(['commercial_owner', 'sales_collaborator', 'contract_reviewer', 'finance_reviewer', 'onboarding_trainer', 'technical_contact']);
const mutation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('assign'), workspace_id: uuid, platform_user_id: uuid, responsibility: duty, reason, valid_until: z.iso.datetime().nullable().optional() }),
  z.object({ action: z.literal('transfer'), workspace_id: uuid, platform_user_id: uuid, reason }),
  z.object({ action: z.literal('revoke'), assignment_id: uuid, reason }),
]);

export async function GET(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers });
  if (!hasPlatformAal2(auth)) return NextResponse.json({ error: { code: 'MFA_REQUIRED' } }, { status: 403, headers });
  const params = new URL(request.url).searchParams;
  const workspaceId = params.get('workspace_id');
  if (workspaceId && !uuid.safeParse(workspaceId).success) return NextResponse.json({ error: { code: 'INVALID_WORKSPACE' } }, { status: 400, headers });
  const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(params.get('limit')) || 20)));
  const supabase = await createClient();
  let query = supabase.schema('customer_api').from('customer_staff_responsibilities_v1').select('*', { count: 'exact' });
  if (workspaceId) query = query.eq('customer_workspace_id', workspaceId);
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: { code: 'QUERY_FAILED' } }, { status: 500, headers });
  return NextResponse.json({ responsibilities: data ?? [], canManage: hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN'), pagination: { total: count ?? 0, offset, limit } }, { headers });
}

export async function POST(request: Request) {
  const auth = await getPlatformAuthContext();
  if (!auth.isAuthorized || !auth.platformUser) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers });
  if (!hasPlatformAal2(auth) || !hasPlatformRole(auth, 'PLATFORM_SUPER_ADMIN'))
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: 'UNTRUSTED_ORIGIN' } }, { status: 403, headers });
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT' } }, { status: 400, headers });
  const supabase = await createClient();
  const input = parsed.data;
  const result = input.action === 'assign'
    ? await supabase.schema('customer_api').rpc('assign_customer_staff_responsibility_v1', {
        p_workspace_id: input.workspace_id, p_platform_user_id: input.platform_user_id,
        p_responsibility: input.responsibility, p_reason: input.reason, p_valid_until: input.valid_until ?? null,
      })
    : input.action === 'transfer'
      ? await supabase.schema('customer_api').rpc('transfer_customer_commercial_owner_v1', {
          p_workspace_id: input.workspace_id, p_new_user_id: input.platform_user_id, p_reason: input.reason,
        })
      : await supabase.schema('customer_api').rpc('revoke_customer_staff_responsibility_v1', {
          p_id: input.assignment_id, p_reason: input.reason,
        });
  if (result.error) {
    const code = result.error.code === '42501' ? 'FORBIDDEN' : result.error.code === '23505' ? 'CONFLICT' : 'MUTATION_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'FORBIDDEN' ? 403 : code === 'CONFLICT' ? 409 : 400, headers });
  }
  return NextResponse.json({ responsibility: result.data }, { headers });
}
