import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAirpropOpportunityV2Schema } from '@/lib/airprop/opportunity-contract-v2';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const querySchema = z.strictObject({
  context_id: z.string().uuid(), workspace_id: z.string().uuid(),
  limit: z.string().regex(/^(?:[1-9][0-9]?|100)$/).optional(),
});
function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}
function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') return failure(error.message === 'mfa_required' ? 'MFA_REQUIRED' : 'AIRPROP_ACCESS_DENIED', 403);
  if (error.code === '22023' && error.message === 'airprop_idempotency_conflict') return failure('IDEMPOTENCY_CONFLICT', 409);
  if (['22023', '22P02', '22003'].includes(error.code ?? '')) return failure('INVALID_REQUEST', 400);
  return failure('AIRPROP_REQUEST_FAILED', 500);
}
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return failure('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return failure('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 16 * 1024);
  if (errorResponse) {
    for (const [key, value] of Object.entries(HEADERS)) errorResponse.headers.set(key, value);
    return errorResponse;
  }
  const parsed = createAirpropOpportunityV2Schema.safeParse(body);
  if (!parsed.success) return failure('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure('UNAUTHORIZED', 401);
  const p = parsed.data;
  const { data, error } = await supabase.schema('customer_api').rpc('create_airprop_opportunity_v2' as never, {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id,
    p_idempotency_key: p.idempotency_key, p_payload: p.payload,
  } as never);
  if (error) return databaseFailure(error);
  if (!data || typeof data !== 'object' || !('idempotent' in data)) return failure('AIRPROP_REQUEST_FAILED', 500);
  return NextResponse.json(data, { status: (data as { idempotent: boolean }).idempotent ? 200 : 201, headers: HEADERS });
}
export async function GET(request: NextRequest) {
  const entries = Array.from(request.nextUrl.searchParams.entries());
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return failure('INVALID_REQUEST', 400);
  const parsed = querySchema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) return failure('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure('UNAUTHORIZED', 401);
  const { data, error } = await supabase.schema('customer_api').rpc('list_airprop_opportunities_v2' as never, {
    p_context_id: parsed.data.context_id, p_workspace_id: parsed.data.workspace_id,
    p_limit: Number(parsed.data.limit ?? '50'),
  } as never);
  if (error) return databaseFailure(error);
  if (!data) return failure('AIRPROP_REQUEST_FAILED', 500);
  return NextResponse.json(data, { headers: HEADERS });
}
