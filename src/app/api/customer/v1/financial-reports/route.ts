import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  financialReportQuerySchema,
  financialReportResponseSchema,
} from '@/lib/customer/financial-reports-schema';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = financialReportQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_QUERY_PARAMETERS',
          message: 'Invalid report query parameters',
          details: parsed.error.format(),
        },
      },
      { status: 400, headers: HEADERS }
    );
  }

  const { context_id, report_type, from, to, currency } = parsed.data;

  // Supabase User Client (never service role)
  const supabase = await createClient();
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
      message = rpcError.message || 'Invalid report request parameters';
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
