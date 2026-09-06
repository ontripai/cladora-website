import { NextRequest, NextResponse } from 'next/server.js';
import { createClient } from '../../../../../../lib/supabase/server.ts';
import {
  listPeriodsQuerySchema,
  listPeriodsResponseSchema,
} from '../../../../../../lib/customer/financial-reports-schema.ts';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function handleGetPeriods(request: NextRequest, supabaseClient?: any) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listPeriodsQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_QUERY_PARAMETERS',
          message: 'Invalid query parameters',
        },
      },
      { status: 400, headers: HEADERS }
    );
  }

  const { context_id } = parsed.data;

  // Supabase User Client (never service role; injectable for testing)
  const supabase = supabaseClient ?? (await createClient());
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, headers: HEADERS }
    );
  }

  const { data, error: rpcError } = await supabase
    .schema('finance')
    .rpc('list_customer_accounting_periods', {
      p_context_id: context_id,
    });

  if (rpcError) {
    const isForbidden = rpcError.code === '42501';
    const isBadRequest = rpcError.code === '22023';

    let code = 'PERIODS_QUERY_FAILED';
    let message = 'Failed to retrieve accounting periods';
    let status = 500;

    if (isForbidden) {
      code = 'PERIODS_ACCESS_DENIED';
      message = 'Access denied to accounting periods';
      status = 403;
    } else if (isBadRequest) {
      code = 'INVALID_REQUEST';
      message = 'Invalid request parameters';
      status = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status, headers: HEADERS }
    );
  }

  const validated = listPeriodsResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'PERIODS_CONTRACT_VIOLATION', message: 'Internal periods format error' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(validated.data, { headers: HEADERS });
}

export async function GET(request: NextRequest) {
  return handleGetPeriods(request);
}
