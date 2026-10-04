import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { createServiceRequestSchema } from '@/lib/customer/service-request-schema';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}
function rpcFailure(code: string) {
  if (code === '42501') return failure('SERVICE_ACCESS_DENIED', 403);
  if (['23505', '40001'].includes(code)) return failure('SERVICE_CONFLICT', 409);
  if (code === 'P0002') return failure('SERVICE_NOT_FOUND', 404);
  if (['22023', '22P02', '22003', '23514'].includes(code)) return failure('INVALID_REQUEST', 400);
  return failure('SERVICE_QUERY_FAILED', 500);
}
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = uuidSchema.safeParse(query.get('context_id'));
  const workspace = uuidSchema.safeParse(query.get('workspace_id'));
  if (!context.success || !workspace.success || query.getAll('context_id').length !== 1
    || query.getAll('workspace_id').length !== 1
    || Array.from(query.keys()).some(key => !['context_id', 'workspace_id'].includes(key))) return failure('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure('UNAUTHORIZED', 401);
  const { data, error } = await supabase.schema('customer_api').rpc('read_service_requests_v1' as never,
    { p_context_id: context.data, p_workspace_id: workspace.data } as never);
  if (error) return rpcFailure(error.code);
  return NextResponse.json(data, { headers: HEADERS });
}
export async function POST(request: NextRequest) {
  // Same-origin JSON writes; neither actor nor tenant nor a client hash is accepted.
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return failure('INVALID_ORIGIN', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return failure('INVALID_REQUEST', 400);
  if (request.nextUrl.search) return failure('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure('UNAUTHORIZED', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return failure('INVALID_REQUEST', 400); }
  const command = createServiceRequestSchema.safeParse(body);
  if (!command.success) return failure('INVALID_REQUEST', 400);
  const { data, error } = await supabase.schema('customer_api').rpc('create_service_request_v1' as never,
    { p_request: command.data } as never);
  if (error) return rpcFailure(error.code);
  if (!data) return failure('SERVICE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers: HEADERS });
}
