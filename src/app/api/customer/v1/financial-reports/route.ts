import { NextRequest, NextResponse } from 'next/server.js';
import { createClient } from '../../../../../lib/supabase/server.ts';
import {
  financialReportQuerySchema,
  financialReportResponseSchema,
} from '../../../../../lib/customer/financial-reports-schema.ts';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function handleGetFinancialReport(request: NextRequest, supabaseClient?: any) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = financialReportQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REPORT_REQUEST',
          message: 'Invalid financial report request',
        },
      },
      { status: 400, headers: HEADERS }
    );
  }

  const { context_id, report_type, from, to, currency } = parsed.data;

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
    .rpc('get_customer_financial_report', {
      p_context_id: context_id,
      p_report_type: report_type,
      p_from: from,
      p_to: to,
      p_currency: currency,
    });

  if (rpcError) {
    const isForbidden = rpcError.code === '42501';
    const isBadRequest = rpcError.code === '22023';

    let code = 'REPORT_QUERY_FAILED';
    let message = 'Failed to generate financial report';
    let status = 500;

    if (isForbidden) {
      code = 'REPORT_ACCESS_DENIED';
      message = 'Access denied to financial report';
      status = 403;
    } else if (isBadRequest) {
      code = 'INVALID_REPORT_REQUEST';
      message = 'Invalid financial report request';
      status = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status, headers: HEADERS }
    );
  }

  const validated = financialReportResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'REPORT_CONTRACT_VIOLATION', message: 'Internal report format error' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(validated.data, { headers: HEADERS });
}

export async function GET(request: NextRequest) {
  return handleGetFinancialReport(request);
}
