import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { eventLookupRequestSchema, eventLookupResponseSchema } from '@/lib/community/event-receipt-lookup';
import { parseEventCommandResult } from '@/lib/community/event-interest-client';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };
const fail = (code: string, status: number) => NextResponse.json({ error: { code } }, { status, headers });
// POST carries the original bounded command privately; this endpoint only reads.
export async function POST(request: NextRequest) {
  try {
    if (!hasTrustedMutationOrigin(request)) return fail('BAD_ORIGIN', 403);
    if (!isApplicationJson(request.headers.get('content-type'))) return fail('UNSUPPORTED_MEDIA_TYPE', 415);
    const { data: original, errorResponse } = await parseJsonWithLimit<unknown>(request, 16384);
    if (errorResponse) return fail('INVALID_REQUEST', errorResponse.status);
    const parsed = eventLookupRequestSchema.safeParse(original);
    if (!parsed.success) return fail('INVALID_REQUEST', 400);
    const client = await createClient();
    const { data: claims, error: authError } = await client.auth.getClaims();
    if (authError || !claims?.claims?.sub) return fail('UNAUTHORIZED', 401);
    const { data, error } = await (client.schema('customer_api') as any).rpc('lookup_ce_event_receipt_v1', { p_request: original });
    if (error) return fail(['42883', 'PGRST202'].includes(error.code) ? 'CE_RECEIPT_NOT_READY' : 'CE_RECEIPT_UNAVAILABLE',
      ['42883', 'PGRST202'].includes(error.code) ? 503 : error.code === '42501' ? 403 : error.code === '22023' ? 400 : error.code === '23505' ? 409 : 500);
    try {
      const result = eventLookupResponseSchema.parse(data);
      if (result.status === 'matched') result.result = parseEventCommandResult(result.result, parsed.data);
      return NextResponse.json(result, { headers });
    } catch { return fail('CE_RECEIPT_INVALID_RESULT', 502); }
  } catch { return fail('CE_RECEIPT_UNAVAILABLE', 500); }
}
