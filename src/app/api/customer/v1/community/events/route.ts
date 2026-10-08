import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { eventCommandSchema } from '@/lib/community/event-interest-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const uuid = z.string().uuid();
const querySchema = z.object({ context_id: uuid, workspace_id: uuid }).strict();

const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers: HEADERS });

function rpcFailure(error: { code?: string }) {
  if (['42883', 'PGRST202'].includes(error.code ?? '')) return fail('CE_EVENT_CONNECTION_NOT_READY', 503);
  if (error.code === '42501') return fail('CE_EVENT_ACCESS_DENIED', 403);
  if (['23505', '23514', '40001'].includes(error.code ?? '')) return fail('CE_EVENT_CONFLICT', 409);
  if (['22023', '22P02'].includes(error.code ?? '')) return fail('INVALID_REQUEST', 400);
  if (error.code === 'P0002') return fail('CE_EVENT_NOT_FOUND', 404);
  return fail('CE_EVENT_QUERY_FAILED', 500);
}

export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  if (Array.from(request.nextUrl.searchParams.keys()).some((key) => !['context_id', 'workspace_id'].includes(key))
    || request.nextUrl.searchParams.getAll('context_id').length !== 1
    || request.nextUrl.searchParams.getAll('workspace_id').length !== 1) return fail('INVALID_REQUEST', 400);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await (supabase.schema('customer_api') as any).rpc('read_ce_events_v1', {
    p_context_id: parsed.data.context_id,
    p_workspace_id: parsed.data.workspace_id,
  });
  if (error) return rpcFailure(error);
  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return fail('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return fail('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = eventCommandSchema.safeParse(body);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await (supabase.schema('customer_api') as any).rpc('command_ce_event_v1', { p_request: parsed.data });
  if (error) return rpcFailure(error);
  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
