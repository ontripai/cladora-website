import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import {
  closePeriodRequestSchema,
  closePeriodResponseSchema,
} from '@/lib/customer/financial-reports-schema';
import { uuidSchema } from '@/lib/customer/dashboard-schema';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const MAX_BODY_BYTES = 10 * 1024; // 10 KB limit

const paramsSchema = z.object({
  id: uuidSchema,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Same-Origin Verification
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: 'UNTRUSTED_ORIGIN', message: 'Untrusted mutation origin' } },
      { status: 403, headers: HEADERS }
    );
  }

  // 2. Content-Type Check
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' } },
      { status: 415, headers: HEADERS }
    );
  }

  // 3. Body Size Limitation
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds maximum allowed size (10KB)' } },
      { status: 413, headers: HEADERS }
    );
  }

  const rawParams = await context.params;
  const parsedParams = paramsSchema.safeParse(rawParams);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_PERIOD_ID', message: 'Invalid period UUID format' } },
      { status: 400, headers: HEADERS }
    );
  }

  let bodyJson: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds maximum allowed size' } },
        { status: 413, headers: HEADERS }
      );
    }
    bodyJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: 'MALFORMED_JSON', message: 'Body contains invalid JSON' } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsedBody = closePeriodRequestSchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REQUEST_PAYLOAD',
          message: 'Invalid close period payload',
          details: parsedBody.error.format(),
        },
      },
      { status: 400, headers: HEADERS }
    );
  }

  const periodId = parsedParams.data.id;
  const { context_id } = parsedBody.data;

  // 4. Authenticated Supabase User Client (never service role)
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
    .rpc('close_accounting_period', {
      p_context_id: context_id,
      p_period_id: periodId,
    });

  if (rpcError) {
    const isForbidden = rpcError.code === '42501';
    const isConflict = rpcError.code === '40001' || rpcError.message?.includes('already_closed');
    const isNotFound = rpcError.code === 'P0002';
    const isBadRequest = rpcError.code === '22023';

    let code = 'PERIOD_CLOSE_FAILED';
    let message = 'Failed to close accounting period';
    let status = 500;

    if (isForbidden) {
      code = 'PERIOD_CLOSE_DENIED';
      message = rpcError.message || 'Permission denied to close accounting period';
      status = 403;
    } else if (isConflict) {
      code = 'PERIOD_ALREADY_CLOSED';
      message = 'Accounting period is already closed';
      status = 409;
    } else if (isNotFound) {
      code = 'PERIOD_NOT_FOUND';
      message = 'Accounting period was not found';
      status = 404;
    } else if (isBadRequest) {
      code = 'PERIOD_CLOSE_BLOCKED';
      message = rpcError.message || 'Period cannot be closed due to open draft or unbalanced journals';
      status = 400;
    }

    return NextResponse.json(
      { error: { code, message } },
      { status, headers: HEADERS }
    );
  }

  const validated = closePeriodResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'CLOSE_CONTRACT_VIOLATION', message: 'Internal response format error' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(validated.data, { headers: HEADERS });
}
