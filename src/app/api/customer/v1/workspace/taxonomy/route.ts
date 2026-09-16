import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  workspaceTaxonomyResponseSchema,
  assignWorkspaceTaxonomyRequestSchema,
  assignWorkspaceTaxonomyResponseSchema,
  uuidSchema,
} from '@/lib/customer/workspace-taxonomy-schema';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const HEADERS = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  Vary: 'Cookie',
};

const querySchema = z.object({
  context_id: uuidSchema,
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    context_id: request.nextUrl.searchParams.get('context_id'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_CONTEXT' } },
      { status: 400, headers: HEADERS }
    );
  }

  // Authoritative user client (strictly NO service role)
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS }
    );
  }

  // Call Customer API Taxonomy RPC
  const { data, error: queryError } = await (supabase.schema('customer_api') as any)
    .rpc('get_workspace_taxonomy_v1', {
      p_context_id: parsed.data.context_id,
    });

  if (queryError) {
    if (queryError.message?.includes('workspace_taxonomy_context_not_workspace_bound')) {
      return NextResponse.json(
        {
          error: {
            code: 'TAXONOMY_NOT_CONFIGURED',
            message: 'Workspace classification is not configured yet.',
          },
        },
        { status: 409, headers: HEADERS }
      );
    }

    const isAccessDenied = queryError.code === '42501';
    return NextResponse.json(
      {
        error: {
          code: isAccessDenied ? 'CONTEXT_ACCESS_DENIED' : 'TAXONOMY_QUERY_FAILED',
        },
      },
      { status: isAccessDenied ? 403 : 500, headers: HEADERS }
    );
  }

  const validated = workspaceTaxonomyResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'SCHEMA_VALIDATION_FAILED' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(
    { data: validated.data },
    { status: 200, headers: HEADERS }
  );
}

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
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'application/json required' } },
      { status: 415, headers: HEADERS }
    );
  }

  // 3. Bounded request body parsing (max 32KB)
  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 32 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid body' } },
      { status: 400, headers: HEADERS }
    );
  }

  // 4. Strict Zod schema validation (rejects unknown fields)
  const parsed = assignWorkspaceTaxonomyRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_REQUEST',
          message: parsed.error.issues[0]?.message || 'Validation failed',
          issues: parsed.error.issues,
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
      { error: { code: 'UNAUTHORIZED' } },
      { status: 401, headers: HEADERS }
    );
  }

  const payload = parsed.data;

  // 6. Call Customer API Transactional Mutation RPC
  const { data, error: mutationError } = await (supabase.schema('customer_api') as any)
    .rpc('assign_workspace_taxonomy_v1', {
      p_context_id: payload.context_id,
      p_property_profile_code: payload.property_profile_code,
      p_operating_model_code: payload.operating_model_code,
      p_country_code: payload.country_code,
      p_idempotency_key: payload.idempotency_key,
      p_expected_assignment_id: payload.expected_assignment_id ?? null,
      p_reason: payload.reason ?? null,
    });

  if (mutationError) {
    const msg = mutationError.message || '';

    if (msg.includes('mfa_required')) {
      return NextResponse.json(
        { error: { code: 'MFA_REQUIRED', message: 'AAL2 step-up verification required.' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_manage_permission_required')) {
      return NextResponse.json(
        { error: { code: 'PERMISSION_DENIED', message: 'workspace.taxonomy.manage permission required.' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('customer_context_access_denied')) {
      return NextResponse.json(
        { error: { code: 'CONTEXT_ACCESS_DENIED', message: 'Access denied for requested context grant.' } },
        { status: 403, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_expected_assignment_conflict')) {
      return NextResponse.json(
        { error: { code: 'EXPECTED_ASSIGNMENT_CONFLICT', message: 'Workspace assignment has been modified concurrently. Please refresh and retry.' } },
        { status: 409, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_idempotency_conflict')) {
      return NextResponse.json(
        { error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key has already been used with conflicting payload.' } },
        { status: 409, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_incompatible')) {
      return NextResponse.json(
        { error: { code: 'TAXONOMY_INCOMPATIBLE', message: 'Selected Property Profile and Operating Model are incompatible.' } },
        { status: 422, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_review_reason_required')) {
      return NextResponse.json(
        { error: { code: 'REVIEW_REASON_REQUIRED', message: 'Approval reason is required for review_required taxonomy combinations.' } },
        { status: 422, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_catalog_version_not_current')) {
      return NextResponse.json(
        { error: { code: 'CATALOG_VERSION_NOT_CURRENT', message: 'Selected taxonomy profile or operating model version is inactive or expired.' } },
        { status: 400, headers: HEADERS }
      );
    }
    if (msg.includes('workspace_taxonomy_context_not_workspace_bound')) {
      return NextResponse.json(
        { error: { code: 'CONTEXT_NOT_WORKSPACE_BOUND', message: 'Context grant is not bound to an active customer workspace.' } },
        { status: 409, headers: HEADERS }
      );
    }

    const isAccessDenied = mutationError.code === '42501';
    return NextResponse.json(
      { error: { code: isAccessDenied ? 'ACCESS_DENIED' : 'MUTATION_FAILED', message: msg } },
      { status: isAccessDenied ? 403 : 500, headers: HEADERS }
    );
  }

  const validated = assignWorkspaceTaxonomyResponseSchema.safeParse(data);
  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'SCHEMA_VALIDATION_FAILED' } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(
    { data: validated.data },
    { status: 200, headers: HEADERS }
  );
}
