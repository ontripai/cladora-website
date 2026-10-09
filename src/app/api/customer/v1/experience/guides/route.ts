import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ce012CommandSchema } from '@/lib/community/experience-guide-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const querySchema = z.object({ context_id: uuid, workspace_id: uuid, reference_id: uuid.optional() }).strict();
type RpcResult = { data: unknown; error: { code?: string } | null };
type GuideRpc = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers: HEADERS });

function rpcFailure(error: { code?: string }) {
  if (['42883', 'PGRST202', 'PGRST106', '55000'].includes(error.code ?? '')) return fail('CE_GUIDE_CONNECTION_NOT_READY', 503);
  if (error.code === '42501') return fail('CE_GUIDE_ACCESS_DENIED', 403);
  if (['23505', '23514', '40001'].includes(error.code ?? '')) return fail('CE_GUIDE_CONFLICT', 409);
  if (['22023', '22P02', '22003'].includes(error.code ?? '')) return fail('INVALID_REQUEST', 400);
  if (error.code === 'P0002') return fail('CE_GUIDE_NOT_FOUND', 404);
  return fail('CE_GUIDE_QUERY_FAILED', 500);
}

export async function GET(request: NextRequest) {
  const allowed = ['context_id', 'workspace_id', 'reference_id'];
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  if (Array.from(request.nextUrl.searchParams.keys()).some((key) => !allowed.includes(key))
    || request.nextUrl.searchParams.getAll('context_id').length !== 1
    || request.nextUrl.searchParams.getAll('workspace_id').length !== 1
    || request.nextUrl.searchParams.getAll('reference_id').length > 1) return fail('INVALID_REQUEST', 400);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const rpc = supabase.schema('customer_api') as unknown as GuideRpc;
  const { data, error } = parsed.data.reference_id
    ? await rpc.rpc('resolve_ce_guide_reference_v1', {
      p_context_id: parsed.data.context_id,
      p_workspace_id: parsed.data.workspace_id,
      p_reference_id: parsed.data.reference_id,
    })
    : await rpc.rpc('read_ce_guides_v1', {
      p_context_id: parsed.data.context_id,
      p_workspace_id: parsed.data.workspace_id,
    });
  if (error) return rpcFailure(error);
  if (data == null) return fail('CE_GUIDE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return fail('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return fail('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 768 * 1024);
  if (errorResponse) {
    for (const [key, value] of Object.entries(HEADERS)) errorResponse.headers.set(key, value);
    return errorResponse;
  }
  const parsed = ce012CommandSchema.safeParse(body);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await (supabase.schema('customer_api') as unknown as GuideRpc)
    .rpc('command_ce_guide_v1', { p_request: parsed.data });
  if (error) return rpcFailure(error);
  if (data == null) return fail('CE_GUIDE_QUERY_FAILED', 500);
  return NextResponse.json(data, { headers: HEADERS });
}
