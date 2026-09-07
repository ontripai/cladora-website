import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';

export const API_HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    correlation_id: string;
  };
}

export function apiErrorResponse(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
  code: string,
  message?: string,
  existingCorrelationId?: string
): NextResponse<ApiErrorBody> {
  const correlationId = existingCorrelationId ?? crypto.randomUUID();
  const defaultMsg = getDefaultMessage(status);

  return NextResponse.json(
    {
      error: {
        code,
        message: message ?? defaultMsg,
        correlation_id: correlationId,
      },
    },
    { status, headers: API_HEADERS }
  );
}

function getDefaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request input is invalid or missing required parameters.';
    case 401:
      return 'Authentication is required to access this resource.';
    case 403:
      return 'Access to the requested resource or context is denied.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'The requested operation conflicts with the current resource state.';
    case 422:
      return 'The request payload is unprocessable.';
    case 500:
    default:
      return 'An unexpected server error occurred. Please try again later.';
  }
}

export interface ErrorMappingOptions {
  accessDeniedCode?: string;
  queryFailedCode?: string;
  notFoundCode?: string;
  conflictCode?: string;
  invalidCode?: string;
}

export function handleGatewayError(
  error: any,
  options: ErrorMappingOptions = {}
): NextResponse<ApiErrorBody> {
  const correlationId = crypto.randomUUID();
  const code = error?.code ? String(error.code) : '';
  const rawMsg = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  // Server-side sanitized logging for observability — strictly NO secrets, tokens, or PII
  console.error(
    `[CUSTOMER_GATEWAY_OBSERVABILITY] correlation_id=${correlationId} sqlstate=${code || 'N/A'}`
  );

  const accessDeniedCode = options.accessDeniedCode ?? 'CONTEXT_ACCESS_DENIED';
  const queryFailedCode = options.queryFailedCode ?? 'QUERY_FAILED';
  const notFoundCode = options.notFoundCode ?? 'NOT_FOUND';
  const conflictCode = options.conflictCode ?? 'CONFLICT';
  const invalidCode = options.invalidCode ?? 'INVALID_REQUEST';

  // 1. Permission Denied / Authentication Required (403)
  if (
    code === '42501' ||
    rawMsg.includes('authentication_required') ||
    rawMsg.includes('permission denied') ||
    rawMsg.includes('insufficient_privilege')
  ) {
    return apiErrorResponse(403, accessDeniedCode, undefined, correlationId);
  }

  // 2. Not Found (404)
  if (
    code === 'P0002' ||
    rawMsg.includes('not_found') ||
    rawMsg.includes('does not exist')
  ) {
    return apiErrorResponse(404, notFoundCode, undefined, correlationId);
  }

  // 3. Conflict / Concurrency / Invariant Violation (409)
  if (
    code === '25000' ||
    code === '23P01' ||
    code === '40001' ||
    rawMsg.includes('already_closed') ||
    rawMsg.includes('conflict')
  ) {
    return apiErrorResponse(409, conflictCode, undefined, correlationId);
  }

  // 4. Invalid Input Parameter at DB Level (400)
  if (code === '22023' || rawMsg.includes('invalid_parameter')) {
    return apiErrorResponse(400, invalidCode, undefined, correlationId);
  }

  // 5. Default: Sanitized 500 (Never leak SQLSTATE, table/function names, PGRST codes, stack)
  return apiErrorResponse(500, queryFailedCode, undefined, correlationId);
}
