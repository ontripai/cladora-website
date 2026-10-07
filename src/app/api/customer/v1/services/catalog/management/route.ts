import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { updateServiceDefinitionSchema } from '@/lib/customer/service-catalog-management-schema';

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers });
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(query.get('context_id'));
  const workspace = uuidSchema.safeParse(query.get('workspace_id'));
  const after = query.has('after') ? uuidSchema.safeParse(query.get('after')) : null;
  if (!context.success || !workspace.success || (after && !after.success)
    || query.getAll('context_id').length !== 1 || query.getAll('workspace_id').length !== 1
    || query.getAll('after').length > 1 || Array.from(query.keys()).some(key => !['context_id', 'workspace_id', 'after'].includes(key))) {
    return fail('INVALID_REQUEST', 400);
  }
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await supabase.schema('customer_api').rpc('read_service_catalog_management_v1' as never,
    { p_context_id: context.data, p_workspace_id: workspace.data, p_after: after?.data ?? null } as never);
  if (error) return fail(error.code === '42501' ? 'SERVICE_ACCESS_DENIED' : 'SERVICE_QUERY_FAILED', error.code === '42501' ? 403 : 500);
  if (!data) return fail('SERVICE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return fail('INVALID_ORIGIN', 403);
  if (request.nextUrl.search || request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('INVALID_REQUEST', 400); }
  const parsed = updateServiceDefinitionSchema.safeParse(body);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const { data, error } = await supabase.schema('customer_api').rpc('update_service_definition_v1' as never, { p_request: parsed.data } as never);
  if (error) {
    if (error.code === '42501') return fail('SERVICE_ACCESS_DENIED', 403);
    if (['23505', '40001'].includes(error.code)) return fail('SERVICE_CONFLICT', 409);
    if (error.code === 'P0002') return fail('SERVICE_NOT_FOUND', 404);
    if (['22023', '22P02', '22003', '23514'].includes(error.code)) return fail('INVALID_REQUEST', 400);
    return fail('SERVICE_QUERY_FAILED', 500);
  }
  if (!data) return fail('SERVICE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers });
}
