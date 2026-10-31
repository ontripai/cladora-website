import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  sharedCapacityAllocationReceiptV1Schema,
  sharedCapacityAllocationRequestV1Schema,
} from '@/lib/core/shared-capacity-time-v1';
import { amenityCapacityReadV1Schema } from '@/lib/customer/amenity-capacity-v1';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const querySchema = z.strictObject({ context_id: z.string().uuid(), workspace_id: z.string().uuid() });
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers: HEADERS });

function rpcFailure(code?: string) {
  if (['42883', 'PGRST202'].includes(code ?? '')) return fail('AMENITY_BOOKING_CONNECTION_NOT_READY', 503);
  if (code === '42501') return fail('AMENITY_BOOKING_ACCESS_DENIED', 403);
  if (['23505', '23514', '40001'].includes(code ?? '')) return fail('AMENITY_BOOKING_CONFLICT', 409);
  if (['22023', '22P02'].includes(code ?? '')) return fail('INVALID_REQUEST', 400);
  return fail('AMENITY_BOOKING_FAILED', 500);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (Array.from(params.keys()).some((key) => !['context_id', 'workspace_id'].includes(key))
      || params.getAll('context_id').length !== 1 || params.getAll('workspace_id').length !== 1) {
    return fail('INVALID_REQUEST', 400);
  }
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await (supabase.schema('customer_api') as never as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }>;
  }).rpc('read_amenity_capacity_v1', {
    p_context_id: parsed.data.context_id,
    p_workspace_id: parsed.data.workspace_id,
  });
  if (error) return rpcFailure(error.code);
  const result = amenityCapacityReadV1Schema.safeParse(data);
  return result.success ? NextResponse.json(result.data, { headers: HEADERS }) : fail('AMENITY_BOOKING_INVALID_RESPONSE', 502);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return fail('BAD_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return fail('UNSUPPORTED_MEDIA_TYPE', 415);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 32 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = sharedCapacityAllocationRequestV1Schema.safeParse(body);
  if (!parsed.success) return fail('INVALID_REQUEST', 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
  const { data, error } = await (supabase.schema('customer_api') as never as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }>;
  }).rpc('command_amenity_capacity_v1', { p_request: parsed.data });
  if (error) return rpcFailure(error.code);
  const result = sharedCapacityAllocationReceiptV1Schema.safeParse(data);
  return result.success ? NextResponse.json(result.data, { headers: HEADERS }) : fail('AMENITY_BOOKING_INVALID_RESPONSE', 502);
}
