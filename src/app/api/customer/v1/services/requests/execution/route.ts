import { NextRequest, NextResponse } from 'next/server';
import {
  operationsExecutionRequestReceiptV1Schema,
  serviceOperationsExecutionRequestV1Schema,
} from '@/lib/core/operations-execution-receipt-v1';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

function failure(code: string, status: number) {
  return NextResponse.json({ error: { code } }, { status, headers });
}

function rpcFailure(code: string) {
  if (code === '42501') return failure('OPERATIONS_EXECUTION_ACCESS_DENIED', 403);
  if (['23505', '40001'].includes(code)) return failure('OPERATIONS_EXECUTION_CONFLICT', 409);
  if (['22023', '22P02', '22003', '23514'].includes(code)) return failure('INVALID_REQUEST', 400);
  return failure('OPERATIONS_EXECUTION_FAILED', 500);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return failure('INVALID_ORIGIN', 403);
  if (!isApplicationJson(request.headers.get('content-type'))) return failure('INVALID_REQUEST', 400);
  if (request.nextUrl.search) return failure('INVALID_REQUEST', 400);

  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 24 * 1024);
  if (errorResponse) return errorResponse;
  const command = serviceOperationsExecutionRequestV1Schema.safeParse(body);
  if (!command.success) return failure('INVALID_REQUEST', 400);

  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  if (authError || !claims?.claims?.sub) return failure('UNAUTHORIZED', 401);

  const { data, error } = await db.schema('customer_api').rpc(
    'request_service_execution_v1' as never,
    { p_request: command.data } as never,
  );
  if (error) return rpcFailure(error.code);

  const receipt = operationsExecutionRequestReceiptV1Schema.safeParse(data);
  if (!receipt.success) return failure('OPERATIONS_EXECUTION_RECEIPT_INVALID', 502);
  return NextResponse.json(receipt.data, {
    status: receipt.data.request_status === 'accepted' ? 201 : 200,
    headers,
  });
}
