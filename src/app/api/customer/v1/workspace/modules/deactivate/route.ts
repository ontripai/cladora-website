import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  deactivateWorkspaceModuleRequestSchema,
  deactivateWorkspaceModuleResponseSchema,
} from '@/lib/customer/workspace-composition-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

export async function POST(request: NextRequest) {
  // 1. Same-Origin Enforcement
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: 'BAD_ORIGIN', message: 'Untrusted mutation origin' } },
      { status: 403, headers: HEADERS }
    );
  }

  // 2. Application/JSON Content-Type Check
  if (!isApplicationJson(request.headers.get('content-type'))) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Expected application/json' } },
      { status: 415, headers: HEADERS }
    );
  }

  // 3. Parse and Limit Body Size (16KB strict limit)
  const { data: body, errorResponse } = await parseJsonWithLimit(request, 16 * 1024);
  if (errorResponse) return errorResponse;

  // 4. Zod Schema Validation
  const parsed = deactivateWorkspaceModuleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload failed schema validation',
          details: parsed.error.format(),
        },
      },
      { status: 400, headers: HEADERS }
    );
  }

  // 5. Authoritative user client (strictly NO service role)
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401, headers: HEADERS }
    );
  }

  // 6. Invoke Database Gateway RPC
  const { data, error: rpcError } = await (supabase.schema('customer_api') as any)
    .rpc('deactivate_workspace_module_v1', {
      p_context_id: parsed.data.context_id,
      p_expected_workspace_module_id: parsed.data.expected_workspace_module_id,
      p_idempotency_key: parsed.data.idempotency_key,
      p_reason: parsed.data.reason,
    });

  if (rpcError) {
    const msg = rpcError.message || '';

    // Concurrency Conflict (SQLSTATE 40001)
    if (rpcError.code === '40001' || msg.includes('workspace_module_expected_state_conflict')) {
      return NextResponse.json(
        {
          error: {
            code: 'EXPECTED_STATE_CONFLICT',
            message: 'Workspace module state has changed concurrently. Please reload and try again.',
          },
        },
        { status: 409, headers: HEADERS }
      );
    }

    // MFA AAL2 Required
    if (msg.includes('mfa_required')) {
      return NextResponse.json(
        {
          error: {
            code: 'MFA_REQUIRED',
            message: 'Multi-Factor Authentication (AAL2) is required to deactivate sensitive modules.',
            redirect_to: '/mfa',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }

    // Dependent Module Active Protection
    if (msg.includes('workspace_module_dependent_active')) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPENDENT_ACTIVE',
            message: msg,
          },
        },
        { status: 422, headers: HEADERS }
      );
    }

    // Reason required or invalid
    if (msg.includes('workspace_module_deactivation_reason_required') || msg.includes('workspace_module_invalid_reason')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REASON',
            message: 'A valid reason of 5 to 500 characters is required for deactivation.',
          },
        },
        { status: 400, headers: HEADERS }
      );
    }

    // Idempotency Conflict
    if (rpcError.code === '22023' && msg.includes('workspace_module_idempotency_conflict')) {
      return NextResponse.json(
        {
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key was previously used with different parameters.',
          },
        },
        { status: 409, headers: HEADERS }
      );
    }

    // General Permission Denied
    if (rpcError.code === '42501') {
      return NextResponse.json(
        {
          error: {
            code: 'PERMISSION_DENIED',
            message: msg || 'Insufficient privileges to deactivate workspace module.',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'DEACTIVATION_FAILED',
          message: msg || 'Failed to deactivate workspace module',
        },
      },
      { status: 500, headers: HEADERS }
    );
  }

  const validated = deactivateWorkspaceModuleResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'SCHEMA_VALIDATION_FAILED', message: 'Invalid response from database' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(
    { data: validated.data },
    { status: 200, headers: HEADERS }
  );
}
