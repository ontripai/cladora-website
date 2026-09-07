import { NextRequest, NextResponse } from 'next/server.js';
import { z } from 'zod';
import { createClient } from '../../../../../../../../lib/supabase/server.ts';
import {
  closeReadinessResponseSchema,
} from '../../../../../../../../lib/customer/financial-reports-schema.ts';
import { uuidSchema } from '../../../../../../../../lib/customer/dashboard-schema.ts';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const paramsSchema = z.object({
  id: uuidSchema,
});

const querySchema = z.object({
  context_id: uuidSchema,
});

export async function handleGetCloseReadiness(
  request: NextRequest,
  rawParams: { id: string },
  supabaseClient?: any
) {
  const parsedParams = paramsSchema.safeParse(rawParams);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_READINESS_REQUEST', message: 'Invalid close readiness request' } },
      { status: 400, headers: HEADERS }
    );
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(searchParams);

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_READINESS_REQUEST', message: 'Invalid close readiness request' } },
      { status: 400, headers: HEADERS }
    );
  }

  const periodId = parsedParams.data.id;
  const contextId = parsedQuery.data.context_id;

  // Authenticated user client (never service role; injectable for testing)
  const supabase = supabaseClient ?? (await createClient());
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, headers: HEADERS }
    );
  }

  // Customer API Gateway: delegates to finance.get_close_readiness
  const { data, error: rpcError } = await supabase
    .schema('customer_api')
    .rpc('get_close_readiness_v1', {
      p_context_id: contextId,
      p_period_id: periodId,
    });

  if (rpcError) {
    const isForbidden = rpcError.code === '42501';
    const isNotFound = rpcError.code === 'P0002';
    const isBadRequest = rpcError.code === '22023';

    let code = 'READINESS_CHECK_FAILED';
    let message = 'Failed to evaluate period close readiness';
    let status = 500;

    if (isForbidden) {
      code = 'PERIOD_ACCESS_DENIED';
      message = 'Access denied to period close readiness';
      status = 403;
    } else if (isNotFound) {
      code = 'PERIOD_NOT_FOUND';
      message = 'Accounting period was not found';
      status = 404;
    } else if (isBadRequest) {
      code = 'INVALID_READINESS_REQUEST';
      message = 'Invalid close readiness request';
      status = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status, headers: HEADERS }
    );
  }

  const validated = closeReadinessResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'READINESS_CONTRACT_VIOLATION', message: 'Internal readiness format error' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(validated.data, { headers: HEADERS });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rawParams = await context.params;
  return handleGetCloseReadiness(request, rawParams);
}
