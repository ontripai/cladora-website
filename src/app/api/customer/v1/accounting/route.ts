import { NextRequest, NextResponse } from 'next/server.js';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase/server.ts';
import { uuidSchema } from '../../../../../lib/customer/dashboard-schema.ts';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const schema = z.object({
  context_id: uuidSchema,
  query: z.string().trim().max(120).optional(),
  status: z.enum(['draft', 'posted', 'reversed']).optional(),
  account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  journal_id: uuidSchema.optional(),
});

export async function handleGetLedger(request: NextRequest, client?: any) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_LEDGER_QUERY' } }, { status: 400, headers: HEADERS });
  }

  const supabase = client ?? (await createClient());
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  // Customer API Gateway: delegates to finance.get_customer_ledger
  const { data, error: queryError } = await supabase.schema('customer_api').rpc('get_ledger_v1', {
    p_context_id: p.context_id,
    p_query: p.query ?? null,
    p_status: p.status ?? null,
    p_account_type: p.account_type ?? null,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
    p_journal_id: p.journal_id ?? null,
  });

  if (queryError) {
    if (queryError.code === 'P0002' || queryError.message?.includes('ledger_journal_not_found')) {
      return NextResponse.json({ error: { code: 'LEDGER_JOURNAL_NOT_FOUND' } }, { status: 404, headers: HEADERS });
    }
    if (queryError.code === '42501' || queryError.message?.includes('denied') || queryError.message?.includes('required')) {
      return NextResponse.json({ error: { code: 'LEDGER_ACCESS_DENIED' } }, { status: 403, headers: HEADERS });
    }
    return NextResponse.json({ error: { code: 'LEDGER_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function GET(request: NextRequest) {
  return handleGetLedger(request);
}
