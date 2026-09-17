import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  activateWorkspaceModuleRequestSchema,
  activateWorkspaceModuleResponseSchema,
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
  const body = await parseJsonWithLimit(request, 16 * 1024);
  if (!body) {
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 16KB limit or invalid JSON' } },
      { status: 413, headers: HEADERS }
    );
  }

  // 4. Zod Schema Validation
  const parsed = activateWorkspaceModuleRequestSchema.safeParse(body);
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
    .rpc('activate_workspace_module_v1', {
      p_context_id: parsed.data.context_id,
      p_module_definition_id: parsed.data.module_definition_id,
      p_expected_workspace_module_id: parsed.data.expected_workspace_module_id ?? null,
      p_config_json: parsed.data.config_json ?? {},
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
            message: 'Multi-Factor Authentication (AAL2) is required to activate sensitive modules.',
            redirect_to: '/mfa',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }

    // Dependency Missing
    if (msg.includes('workspace_module_dependency_missing')) {
      return NextResponse.json(
        {
          error: {
            code: 'DEPENDENCY_MISSING',
            message: msg,
          },
        },
        { status: 422, headers: HEADERS }
      );
    }

    // Entitlement Required
    if (msg.includes('workspace_module_entitlement_required')) {
      return NextResponse.json(
        {
          error: {
            code: 'ENTITLEMENT_REQUIRED',
            message: 'Active subscription entitlement is required for this module.',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }

    // Taxonomy Incompatible
    if (msg.includes('workspace_module_taxonomy_incompatible')) {
      return NextResponse.json(
        {
          error: {
            code: 'TAXONOMY_INCOMPATIBLE',
            message: 'Module is not compatible with this workspace profile or operating model.',
          },
        },
        { status: 422, headers: HEADERS }
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

    // Config mutation deferred
    if (msg.includes('workspace_module_config_mutation_deferred')) {
      return NextResponse.json(
        {
          error: {
            code: 'CONFIG_MUTATION_DEFERRED',
            message: 'Custom module configuration mutation is deferred in this release package.',
          },
        },
        { status: 422, headers: HEADERS }
      );
    }

    // General Permission Denied
    if (rpcError.code === '42501') {
      return NextResponse.json(
        {
          error: {
            code: 'PERMISSION_DENIED',
            message: msg || 'Insufficient privileges to manage workspace modules.',
          },
        },
        { status: 403, headers: HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'ACTIVATION_FAILED',
          message: msg || 'Failed to activate workspace module',
        },
      },
      { status: 500, headers: HEADERS }
    );
  }

  const validated = activateWorkspaceModuleResponseSchema.safeParse(data);
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
