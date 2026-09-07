import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const querySchema = z.object({
  context_id: z.string().uuid(),
  query: z.string().trim().max(120).optional(),
  action: z.string().trim().max(80).optional(),
  from: z.string().trim().optional(),
  until: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_AUDIT_QUERY', details: parsed.error.format() } },
      { status: 400, headers: HEADERS }
    );
  }

  // Use standard Supabase User Client bound to cookie session (no service role)
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS }
    );
  }

  const p = parsed.data;

  // Optional date format validation if present
  let parsedFrom: string | null = null;
  let parsedUntil: string | null = null;
  if (p.from) {
    const d = new Date(p.from);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: { code: 'INVALID_FROM_DATE' } },
        { status: 400, headers: HEADERS }
      );
    }
    parsedFrom = d.toISOString();
  }
  if (p.until) {
    const d = new Date(p.until);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: { code: 'INVALID_UNTIL_DATE' } },
        { status: 400, headers: HEADERS }
      );
    }
    parsedUntil = d.toISOString();
  }

  // Customer API Gateway: delegates to audit rpc('get_customer_events')
  const { data, error: rpcError } = await supabase
    .schema('customer_api')
    .rpc('get_audit_events_v1', {
      p_context_id: p.context_id,
      p_limit: p.limit,
      p_offset: p.offset,
      p_query: p.query || null,
      p_action: p.action || null,
      p_from: parsedFrom,
      p_until: parsedUntil,
    });

  if (rpcError) {
    const isForbidden = rpcError.code === '42501';
    return NextResponse.json(
      {
        error: {
          code: isForbidden ? 'AUDIT_ACCESS_DENIED' : 'AUDIT_QUERY_FAILED',
          message: isForbidden
            ? 'Access denied to customer audit events'
            : 'Failed to retrieve customer audit events',
        },
      },
      { status: isForbidden ? 403 : 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { headers: HEADERS });
}
